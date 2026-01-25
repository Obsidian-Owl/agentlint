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
import type { ITelemetryClient, SessionStartData, SessionMetrics } from './index';
import { type TelemetryEvent, createTelemetryEvent, getTelemetryMeta } from './events';

// =============================================================================
// Constants
// =============================================================================

/**
 * Vercel proxy endpoint for telemetry.
 * In production, this would be the actual Vercel deployment URL.
 */
const PROXY_ENDPOINT =
  process.env['AGENTLINT_TELEMETRY_ENDPOINT'] ?? 'https://agentlint.vercel.app/api/events';

/** Flush interval in milliseconds (10 seconds) */
const FLUSH_INTERVAL_MS = 10_000;

/** Maximum events to buffer before forcing flush */
const MAX_BUFFER_SIZE = 100;

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 5_000;

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
      void this.flush();
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

    this.buffer.push(event);

    // Flush if buffer is full
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      void this.flush();
    }
  }

  /**
   * Record session start.
   */
  sessionStart(sessionId: string, data?: SessionStartData): void {
    if (!this.enabled) {
      return;
    }

    this.sequence = 0;

    this.record(
      createTelemetryEvent('session.start', sessionId, this.sequence++, {
        command: data?.command ?? 'analyse',
        hasConfig: data?.hasConfig ?? false,
        projectType: data?.projectType,
      })
    );
  }

  /**
   * Record session end with metrics.
   */
  sessionEnd(sessionId: string, metrics: SessionMetrics): void {
    if (!this.enabled) {
      return;
    }

    this.record(
      createTelemetryEvent('session.end', sessionId, this.sequence++, {
        durationMs: metrics.durationMs,
        toolCallCount: metrics.toolCallCount,
        findingCount: metrics.findingCount,
        recommendationCount: metrics.recommendationCount ?? 0,
        totalInputTokens: metrics.totalInputTokens ?? 0,
        totalOutputTokens: metrics.totalOutputTokens ?? 0,
        success: metrics.success,
        interrupted: metrics.interrupted ?? false,
      })
    );
  }

  /**
   * Track a tool call.
   */
  trackTool(sessionId: string, tool: string, durationMs: number, success: boolean): void {
    if (!this.enabled) {
      return;
    }

    this.record(
      createTelemetryEvent('tool.call', sessionId, this.sequence++, {
        tool,
        durationMs,
        success,
      })
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

    this.record(
      createTelemetryEvent('finding.detected', sessionId, this.sequence++, {
        findingType,
        severity,
      })
    );
  }

  /**
   * Track LLM token usage.
   */
  trackLLM(
    sessionId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    latencyMs?: number
  ): void {
    if (!this.enabled) {
      return;
    }

    this.record(
      createTelemetryEvent('llm.usage', sessionId, this.sequence++, {
        model,
        inputTokens,
        outputTokens,
        latencyMs,
      })
    );
  }

  /**
   * Track an error (type only, no content).
   */
  trackError(sessionId: string, errorType: string, errorCode?: string): void {
    if (!this.enabled) {
      return;
    }

    this.record(
      createTelemetryEvent('session.error', sessionId, this.sequence++, {
        errorType,
        errorCode,
      })
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

      if (!response.ok) {
        // Rate limited or server error - log but don't crash
        if (response.status === 429) {
          // Rate limited - back off
          this.logWarning('Telemetry rate limited, events dropped');
        } else if (response.status >= 500) {
          // Server error - could retry but for now just drop
          this.logWarning(`Telemetry server error: ${response.status}`);
        }
        // Don't re-add events to buffer to avoid memory growth
      }
    } catch (error) {
      // Network error - graceful degradation
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          this.logWarning('Telemetry request timed out');
        } else {
          this.logWarning(`Telemetry send failed: ${error.name}`);
        }
      }
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
      console.error(`[telemetry] ${message}`);
    }
  }
}
