/**
 * Alpha Phase Telemetry Client
 *
 * Sends telemetry to agentlint's Vercel proxy for forwarding to HoneyHive.
 * The CLI contains NO secrets - it just POSTs JSON to the proxy endpoint.
 *
 * Features:
 * - Buffered event collection with periodic flush
 * - Graceful degradation on network failure
 * - Rate limiting awareness
 * - Automatic sanitization of event data
 *
 * @module telemetry/alpha-client
 */

import type { TelemetryConfig } from '../persistence/types';
import type {
  ITelemetryClient,
  SessionStartData,
  SessionMetrics,
  TrackToolOptions,
  TrackLLMOptions,
  TrackPromptOptions,
} from './index';
import { type TelemetryEvent, createTelemetryEvent, getTelemetryMeta } from './events';
import { createDebugLogger, DEBUG_NAMESPACES } from '../debug';
import { FLUSH_INTERVAL_MS, MAX_BUFFER_SIZE, REQUEST_TIMEOUT_MS } from './constants';
import { traceContextProvider } from '../observability/trace-context';

// Create module-level logger
const logger = createDebugLogger({
  namespaces: [DEBUG_NAMESPACES.ORCHESTRATION],
});

// =============================================================================
// Constants
// =============================================================================

/**
 * Vercel proxy endpoint for telemetry.
 * In production, this would be the actual Vercel deployment URL.
 */
const PROXY_ENDPOINT =
  process.env['AGENTLINT_TELEMETRY_ENDPOINT'] ?? 'https://agentlint.vercel.app/api/events';

// =============================================================================
// Error Classification
// =============================================================================

/**
 * Categories for telemetry errors to enable structured analysis.
 */
export type TelemetryErrorCategory =
  | 'timeout'
  | 'network'
  | 'rate_limited'
  | 'server_error'
  | 'unknown';

/**
 * Structured telemetry error for observability.
 */
export interface TelemetryError {
  category: TelemetryErrorCategory;
  message: string;
  eventCount: number;
  timestamp: string;
}

/**
 * Options for AlphaTelemetryClient.
 */
export interface TelemetryClientOptions {
  /**
   * Optional callback invoked when telemetry operations fail.
   * Enables callers to observe failures without breaking graceful degradation.
   */
  onError?: (error: TelemetryError) => void;
}

/**
 * Metrics tracking telemetry health for observability.
 */
export interface TelemetryMetrics {
  /** Total flush attempts */
  flushAttempts: number;
  /** Successful flush count */
  flushSuccesses: number;
  /** Failed flush count */
  flushFailures: number;
  /** Total events dropped due to errors */
  eventsDropped: number;
  /** Total events successfully sent */
  eventsSent: number;
  /** Error counts by category */
  errorsByCategory: Record<TelemetryErrorCategory, number>;
}

// =============================================================================
// Alpha Telemetry Client
// =============================================================================

/**
 * Alpha phase telemetry client that sends events to the Vercel proxy.
 */
export class AlphaTelemetryClient implements ITelemetryClient {
  readonly mode = 'alpha' as const;

  private enabled = false;
  private buffer: TelemetryEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private sequence = 0;

  /** Maximum tracked sessions to prevent unbounded memory growth */
  private static readonly MAX_TRACKED_SESSIONS = 100;

  /** Maximum time to keep session tracking entries (1 hour) */
  private static readonly SESSION_TTL_MS = 60 * 60 * 1000;

  /** Maps sessionId to the session.start event ID for hierarchy */
  private sessionEventIds = new Map<string, string>();

  /** Maps sessionId to start time for duration calculation */
  private sessionStartTimes = new Map<string, number>();

  /** Optional error callback for observability */
  private onError: ((error: TelemetryError) => void) | null = null;

  /** Metrics tracking telemetry health */
  private metrics: TelemetryMetrics = {
    flushAttempts: 0,
    flushSuccesses: 0,
    flushFailures: 0,
    eventsDropped: 0,
    eventsSent: 0,
    errorsByCategory: {
      timeout: 0,
      network: 0,
      rate_limited: 0,
      server_error: 0,
      unknown: 0,
    },
  };

  /**
   * Configure client options.
   * Call before init() to set error callback.
   */
  configure(options: TelemetryClientOptions): void {
    this.onError = options.onError ?? null;
  }

  /**
   * Get telemetry health metrics.
   * Useful for monitoring and debugging telemetry issues.
   */
  getMetrics(): TelemetryMetrics {
    return { ...this.metrics };
  }

  /**
   * Classify an error for structured reporting.
   */
  private classifyError(error: unknown, eventCount: number): TelemetryError {
    const timestamp = new Date().toISOString();

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { category: 'timeout', message: error.message, eventCount, timestamp };
      }
      if (
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ) {
        return { category: 'network', message: error.message, eventCount, timestamp };
      }
    }

    return {
      category: 'unknown',
      message: error instanceof Error ? error.message : String(error),
      eventCount,
      timestamp,
    };
  }

  /**
   * Handle a telemetry error with logging and optional callback.
   */
  private handleError(error: unknown, eventCount: number, context: string): void {
    const classified = this.classifyError(error, eventCount);

    this.logWarning(
      `${context}: ${classified.category} - ${classified.message} (${eventCount} events)`
    );

    if (this.onError) {
      this.onError(classified);
    }
  }

  /**
   * Clean up stale session tracking entries older than TTL.
   * Prevents memory leaks when sessionEnd() is never called.
   */
  private cleanupStaleSessions(): void {
    const now = Date.now();
    const ttl = AlphaTelemetryClient.SESSION_TTL_MS;

    for (const [sessionId, startTime] of this.sessionStartTimes) {
      if (now - startTime > ttl) {
        this.sessionEventIds.delete(sessionId);
        this.sessionStartTimes.delete(sessionId);
        this.logWarning(`Cleaned up stale session: ${sessionId}`);
      }
    }
  }

  /**
   * Enforce maximum tracked sessions by removing oldest entries.
   */
  private enforceMaxSessions(): void {
    const maxSessions = AlphaTelemetryClient.MAX_TRACKED_SESSIONS;

    if (this.sessionStartTimes.size >= maxSessions) {
      // Find and remove the oldest session
      let oldestId: string | null = null;
      let oldestTime = Infinity;

      for (const [sessionId, startTime] of this.sessionStartTimes) {
        if (startTime < oldestTime) {
          oldestTime = startTime;
          oldestId = sessionId;
        }
      }

      if (oldestId) {
        this.sessionEventIds.delete(oldestId);
        this.sessionStartTimes.delete(oldestId);
      }
    }
  }

  /**
   * Initialize the telemetry client.
   */
  init(config: TelemetryConfig): Promise<void> {
    this.enabled = config.enabled && config.mode === 'alpha';

    if (!this.enabled) {
      return Promise.resolve();
    }

    // Start periodic flush
    this.flushInterval = setInterval(() => {
      this.flush().catch((error) => {
        this.handleError(error, this.buffer.length, 'Interval flush');
      });
    }, FLUSH_INTERVAL_MS);

    // Ensure interval doesn't prevent process exit
    if (this.flushInterval.unref) {
      this.flushInterval.unref();
    }

    return Promise.resolve();
  }

  /**
   * Check if telemetry is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Record a raw telemetry event.
   */
  record(event: TelemetryEvent): void {
    if (!this.enabled) {
      return;
    }

    // Inject trace context for correlation
    const traceContext = traceContextProvider.getContext();
    if (traceContext?.traceId) {
      event.traceId = traceContext.traceId;
    }

    this.buffer.push(event);

    // Flush if buffer is full
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this.flush().catch((error) => {
        this.handleError(error, this.buffer.length, 'Buffer overflow flush');
      });
    }
  }

  /**
   * Record session start.
   */
  sessionStart(sessionId: string, data?: SessionStartData): void {
    if (!this.enabled) {
      return;
    }

    // Clean up stale sessions and enforce max limit before adding new session
    this.cleanupStaleSessions();
    this.enforceMaxSessions();

    this.sequence = 0;
    const startTime = Date.now();

    // Track session start time for later duration calculation
    this.sessionStartTimes.set(sessionId, startTime);

    // Build event data, only including defined fields
    const eventData: Record<string, unknown> = {
      command: data?.command ?? 'analyse',
      hasConfig: data?.hasConfig ?? false,
    };
    if (data?.projectType !== undefined) {
      eventData.projectType = data.projectType;
    }
    if (data?.directory !== undefined) {
      eventData.directory = data.directory;
    }

    const event = createTelemetryEvent('session.start', sessionId, this.sequence++, eventData, {
      startTime,
      endTime: startTime,
    });

    // Track the session event ID for hierarchy (child events use this as parent)
    this.sessionEventIds.set(sessionId, event.eventId);

    this.record(event);
  }

  /**
   * Get session event ID for hierarchy.
   */
  getSessionEventId(sessionId: string): string | undefined {
    return this.sessionEventIds.get(sessionId);
  }

  /**
   * Record session end with metrics.
   */
  sessionEnd(sessionId: string, metrics: SessionMetrics): void {
    if (!this.enabled) {
      return;
    }

    const endTime = Date.now();
    const startTime = this.sessionStartTimes.get(sessionId) ?? endTime - metrics.durationMs;

    this.record(
      createTelemetryEvent(
        'session.end',
        sessionId,
        this.sequence++,
        {
          durationMs: metrics.durationMs,
          toolCallCount: metrics.toolCallCount,
          findingCount: metrics.findingCount,
          recommendationCount: metrics.recommendationCount ?? 0,
          totalInputTokens: metrics.totalInputTokens ?? 0,
          totalOutputTokens: metrics.totalOutputTokens ?? 0,
          success: metrics.success,
          interrupted: metrics.interrupted ?? false,
        },
        { startTime, endTime }
      )
    );

    // Cleanup session tracking
    this.sessionEventIds.delete(sessionId);
    this.sessionStartTimes.delete(sessionId);
  }

  /**
   * Track a tool call (simple signature for backward compat).
   */
  trackTool(sessionId: string, tool: string, durationMs: number, success: boolean): void {
    this.trackToolEx(sessionId, { tool, durationMs, success });
  }

  /**
   * Track a tool call with extended options (timing, hierarchy).
   */
  trackToolEx(sessionId: string, options: TrackToolOptions): void {
    if (!this.enabled) {
      return;
    }

    const endTime = options.endTime ?? Date.now();
    const startTime = options.startTime ?? endTime - options.durationMs;
    const parentEventId = options.parentEventId ?? this.sessionEventIds.get(sessionId);

    // Build options object, only including parentEventId if defined
    const eventOptions: { startTime: number; endTime: number; parentEventId?: string } = {
      startTime,
      endTime,
    };
    if (parentEventId !== undefined) {
      eventOptions.parentEventId = parentEventId;
    }

    // Build event data with optional fields
    const eventData: Record<string, unknown> = {
      tool: options.tool,
      durationMs: options.durationMs,
      success: options.success,
    };

    // Include full tool inputs if available (sanitized by createTelemetryEvent)
    if (options.toolInput !== undefined) {
      eventData.toolInput = options.toolInput;
    }

    // Include tool output if available (sanitized by createTelemetryEvent)
    if (options.toolOutput !== undefined) {
      eventData.toolOutput = options.toolOutput;
    }

    // Include error message if tool failed
    if (options.errorMessage !== undefined) {
      eventData.errorMessage = options.errorMessage;
    }

    this.record(
      createTelemetryEvent('tool.call', sessionId, this.sequence++, eventData, eventOptions)
    );
  }

  /**
   * Track a finding.
   */
  trackFinding(
    sessionId: string,
    findingType: string,
    severity: 'info' | 'warning' | 'error' | 'critical'
  ): void {
    if (!this.enabled) {
      return;
    }

    const now = Date.now();
    const parentEventId = this.sessionEventIds.get(sessionId);

    // Build options object, only including parentEventId if defined
    const eventOptions: { startTime: number; endTime: number; parentEventId?: string } = {
      startTime: now,
      endTime: now,
    };
    if (parentEventId !== undefined) {
      eventOptions.parentEventId = parentEventId;
    }

    this.record(
      createTelemetryEvent(
        'finding.detected',
        sessionId,
        this.sequence++,
        {
          findingType,
          severity,
        },
        eventOptions
      )
    );
  }

  /**
   * Track LLM token usage (simple signature for backward compat).
   */
  trackLLM(
    sessionId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    latencyMs?: number
  ): void {
    // Build options without undefined values
    const llmOptions: TrackLLMOptions = { model, inputTokens, outputTokens };
    if (latencyMs !== undefined) {
      llmOptions.latencyMs = latencyMs;
    }
    this.trackLLMEx(sessionId, llmOptions);
  }

  /**
   * Track LLM token usage with extended options (timing, hierarchy, cost).
   */
  trackLLMEx(sessionId: string, options: TrackLLMOptions): void {
    if (!this.enabled) {
      return;
    }

    const endTime = options.endTime ?? Date.now();
    const startTime = options.startTime ?? endTime - (options.latencyMs ?? 0);
    const parentEventId = options.parentEventId ?? this.sessionEventIds.get(sessionId);

    // Build event data without undefined values
    const eventData: Record<string, unknown> = {
      model: options.model,
      provider: options.provider ?? 'anthropic',
      inputTokens: options.inputTokens,
      outputTokens: options.outputTokens,
    };
    if (options.latencyMs !== undefined) {
      eventData.latencyMs = options.latencyMs;
    }
    if (options.cost !== undefined) {
      eventData.cost = options.cost;
    }
    // Model parameters for HoneyHive config
    if (options.temperature !== undefined) {
      eventData.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
      eventData.maxTokens = options.maxTokens;
    }
    if (options.topP !== undefined) {
      eventData.topP = options.topP;
    }
    if (options.stopReason !== undefined) {
      eventData.stopReason = options.stopReason;
    }
    // Cache token tracking (prompt caching)
    if (options.cacheReadTokens !== undefined) {
      eventData.cacheReadTokens = options.cacheReadTokens;
    }
    if (options.cacheCreationTokens !== undefined) {
      eventData.cacheCreationTokens = options.cacheCreationTokens;
    }

    // Build options object, only including parentEventId if defined
    const eventOptions: { startTime: number; endTime: number; parentEventId?: string } = {
      startTime,
      endTime,
    };
    if (parentEventId !== undefined) {
      eventOptions.parentEventId = parentEventId;
    }

    this.record(
      createTelemetryEvent('llm.usage', sessionId, this.sequence++, eventData, eventOptions)
    );
  }

  /**
   * Track an error (type only, no content).
   */
  trackError(sessionId: string, errorType: string, errorCode?: string): void {
    if (!this.enabled) {
      return;
    }

    const now = Date.now();
    const parentEventId = this.sessionEventIds.get(sessionId);

    // Build event data without undefined values
    const eventData: Record<string, unknown> = { errorType };
    if (errorCode !== undefined) {
      eventData.errorCode = errorCode;
    }

    // Build options object, only including parentEventId if defined
    const eventOptions: { startTime: number; endTime: number; parentEventId?: string } = {
      startTime: now,
      endTime: now,
    };
    if (parentEventId !== undefined) {
      eventOptions.parentEventId = parentEventId;
    }

    this.record(
      createTelemetryEvent('session.error', sessionId, this.sequence++, eventData, eventOptions)
    );
  }

  trackPrompt(sessionId: string, options: TrackPromptOptions): void {
    if (!this.enabled) {
      return;
    }

    const now = Date.now();
    const parentEventId = this.sessionEventIds.get(sessionId);

    const eventData: Record<string, unknown> = {
      promptId: options.promptId,
      promptVersion: options.promptVersion,
      promptKey: options.promptKey,
      usageContext: options.usageContext,
      messageCount: options.messageCount,
      contentLength: options.contentLength,
    };

    const eventOptions: { startTime: number; endTime: number; parentEventId?: string } = {
      startTime: now,
      endTime: now,
    };
    if (parentEventId !== undefined) {
      eventOptions.parentEventId = parentEventId;
    }

    this.record(
      createTelemetryEvent('prompt.used', sessionId, this.sequence++, eventData, eventOptions)
    );
  }

  /**
   * Flush buffered events to the proxy.
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    // Take current buffer and reset
    const events = [...this.buffer];
    this.buffer = [];

    // Track metrics
    this.metrics.flushAttempts++;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(PROXY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `agentlint/${getTelemetryMeta().version}`,
        },
        body: JSON.stringify({ events }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        // Success - track metrics
        this.metrics.flushSuccesses++;
        this.metrics.eventsSent += events.length;
      } else {
        // Rate limited or server error - classify and report
        const category: TelemetryErrorCategory =
          response.status === 429 ? 'rate_limited' : 'server_error';
        const classified: TelemetryError = {
          category,
          message: `HTTP ${response.status}`,
          eventCount: events.length,
          timestamp: new Date().toISOString(),
        };

        // Track failure metrics
        this.metrics.flushFailures++;
        this.metrics.eventsDropped += events.length;
        this.metrics.errorsByCategory[category]++;

        this.logWarning(
          `Telemetry ${category}: ${classified.message} (${events.length} events dropped)`
        );

        if (this.onError) {
          this.onError(classified);
        }
        // Don't re-add events to buffer to avoid memory growth
      }
    } catch (error) {
      // Network error - graceful degradation with structured error
      const classified = this.classifyError(error, events.length);

      // Track failure metrics
      this.metrics.flushFailures++;
      this.metrics.eventsDropped += events.length;
      this.metrics.errorsByCategory[classified.category]++;

      this.handleError(error, events.length, 'Telemetry flush');
      // Don't crash, just continue
    }
  }

  /**
   * Shutdown the client and flush remaining events.
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Final flush
    await this.flush();

    this.enabled = false;
  }

  /**
   * Log a warning without crashing.
   * Uses AGENTLINT_TELEMETRY_DEBUG to control visibility.
   */
  private logWarning(message: string): void {
    if (process.env['AGENTLINT_TELEMETRY_DEBUG'] === '1') {
      logger.warn(DEBUG_NAMESPACES.ORCHESTRATION, `[telemetry] ${message}`);
    }
  }
}
