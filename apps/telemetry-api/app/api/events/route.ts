/**
 * Telemetry Events API Route
 *
 * Vercel Edge Function that receives telemetry from agentlint CLI
 * and forwards to HoneyHive for observability.
 *
 * Features:
 * - Rate limiting via Upstash Redis
 * - Payload validation
 * - HoneyHive forwarding
 *
 * Environment variables required:
 * - HONEYHIVE_API_KEY: HoneyHive API key
 * - UPSTASH_REDIS_REST_URL: Upstash Redis URL (from Vercel integration)
 * - UPSTASH_REDIS_REST_TOKEN: Upstash Redis token (from Vercel integration)
 *
 * @module apps/telemetry-api/api/events
 */

import { NextResponse } from 'next/server';

// =============================================================================
// Types
// =============================================================================

interface TelemetryEventMeta {
  version: string;
  platform: string;
  nodeVersion: string;
  /** Source identifier (agentlint-cli for production, agentlint-cli-test for tests) */
  source?: string;
}

interface TelemetryEvent {
  type: string;
  timestamp: string;
  /** Start time in UTC milliseconds */
  startTime: number;
  /** End time in UTC milliseconds */
  endTime: number;
  sessionId: string;
  eventId: string;
  sequence: number;
  parentEventId?: string;
  data: Record<string, unknown>;
  meta: TelemetryEventMeta;
}

interface TelemetryPayload {
  events: TelemetryEvent[];
}

// =============================================================================
// Error Classification
// =============================================================================

type ErrorCategory = 'timeout' | 'network' | 'api_error' | 'validation' | 'unknown';

interface ClassifiedError {
  category: ErrorCategory;
  name: string;
  message: string;
}

/**
 * Classify an error for structured logging.
 * Helps with debugging and alerting by categorizing error types.
 */
function classifyError(error: unknown): ClassifiedError {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return { category: 'timeout', name: 'AbortError', message: error.message };
    }
    if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
      return { category: 'network', name: error.name, message: error.message };
    }
    if (error.message.includes('API') || error.message.includes('401') || error.message.includes('403')) {
      return { category: 'api_error', name: error.name, message: error.message };
    }
    return { category: 'unknown', name: error.name, message: error.message };
  }
  return { category: 'unknown', name: 'UnknownError', message: String(error) };
}

// =============================================================================
// Validation
// =============================================================================

function isValidEvent(event: unknown): event is TelemetryEvent {
  if (!event || typeof event !== 'object') return false;

  const e = event as Record<string, unknown>;
  return (
    typeof e.type === 'string' &&
    typeof e.timestamp === 'string' &&
    typeof e.startTime === 'number' &&
    typeof e.endTime === 'number' &&
    typeof e.sessionId === 'string' &&
    typeof e.eventId === 'string' &&
    typeof e.sequence === 'number' &&
    typeof e.data === 'object' &&
    e.data !== null &&
    typeof e.meta === 'object' &&
    e.meta !== null
  );
}

function isValidPayload(body: unknown): body is TelemetryPayload {
  if (!body || typeof body !== 'object') return false;

  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.events)) return false;

  return b.events.every(isValidEvent);
}

// =============================================================================
// Rate Limiting (Simple in-memory for now, switch to Upstash later)
// =============================================================================

/** Maximum entries in rate limit map before LRU eviction */
const RATE_LIMIT_MAX_ENTRIES = 10_000;
/** Number of oldest entries to evict when limit reached */
const RATE_LIMIT_EVICTION_BATCH = 1_000;

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP

/** HoneyHive API request timeout - leaves margin within 10s Edge Function limit */
const HONEYHIVE_TIMEOUT_MS = 5_000;

/**
 * Evict oldest entries when map exceeds size limit.
 * Uses LRU-style eviction based on lastAccess timestamp.
 * More reliable than setInterval in Edge Function contexts.
 */
function evictOldestEntries(): void {
  if (rateLimitMap.size <= RATE_LIMIT_MAX_ENTRIES) return;

  // Sort by lastAccess and evict oldest
  const entries = [...rateLimitMap.entries()]
    .sort((a, b) => a[1].lastAccess - b[1].lastAccess)
    .slice(0, RATE_LIMIT_EVICTION_BATCH);

  for (const [ip] of entries) {
    rateLimitMap.delete(ip);
  }
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    // Evict old entries inline (more reliable than setInterval in Edge Functions)
    evictOldestEntries();
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
      lastAccess: now,
    });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  entry.lastAccess = now;
  return true;
}

/**
 * Generate a unique request ID for tracing.
 * Format: req-{timestamp_base36}-{random}
 */
function generateRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================================================
// HoneyHive Forwarding
// =============================================================================

/**
 * Build a human-readable session name from session events.
 * Format: "agentlint-{command}-{date}" (e.g., "agentlint-analyse-2026-01-26")
 */
function buildSessionName(sessionEvents: TelemetryEvent[]): string {
  // Find session.start event for context
  const sessionStartEvent = sessionEvents.find((e) => e.type === 'session.start');
  const command = (sessionStartEvent?.data?.command as string) ?? 'session';
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  return `agentlint-${command}-${timestamp}`;
}

/**
 * Build a descriptive event name based on event type.
 * Maps raw event types to human-readable names for HoneyHive display.
 */
function buildEventName(event: TelemetryEvent): string {
  const type = event.type;

  if (type === 'tool.call') {
    const toolName = (event.data.tool as string) ?? 'unknown';
    return `Tool: ${toolName}`;
  }

  if (type === 'llm.usage') {
    const model = (event.data.model as string) ?? 'claude';
    // Extract short model name (e.g., "claude-sonnet-4" from "claude-sonnet-4-20250514")
    const shortModel = model.replace(/-\d{8}$/, '');
    return `Claude: ${shortModel}`;
  }

  if (type === 'session.start') {
    return 'Session: Start';
  }

  if (type === 'session.end') {
    return 'Session: End';
  }

  if (type === 'session.error') {
    return 'Session: Error';
  }

  if (type === 'finding.detected') {
    const findingType = (event.data.findingType as string) ?? 'unknown';
    return `Finding: ${findingType}`;
  }

  if (type === 'recommendation.generated') {
    return 'Recommendation: Generated';
  }

  // Fallback to formatted raw type
  return type
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(': ');
}

/**
 * Build HoneyHive config object based on event type.
 * Per HoneyHive docs: config contains event-specific settings/parameters
 *
 * Model event config fields per HoneyHive schema:
 * - model, provider, temperature, top_p, top_k, max_tokens
 * - type ("chat" or "completion"), is_streaming
 * - tools, tool_choice, stop_sequences
 */
function buildHoneyHiveConfig(event: TelemetryEvent): Record<string, unknown> {
  const eventType = event.type;

  if (eventType === 'llm.usage') {
    const config: Record<string, unknown> = {
      model: event.data.model ?? 'claude',
      provider: event.data.provider ?? 'anthropic',
      // Claude uses chat format
      type: 'chat',
      // We always stream from the SDK
      is_streaming: true,
    };
    // Include model parameters if available (undefined values are filtered later)
    if (event.data.temperature !== undefined) config.temperature = event.data.temperature;
    if (event.data.maxTokens !== undefined) config.max_tokens = event.data.maxTokens;
    if (event.data.topP !== undefined) config.top_p = event.data.topP;
    return config;
  }

  if (eventType === 'tool.call') {
    return {
      tool_name: event.data.tool,
      provider: 'agentlint', // Tool provider for categorization
    };
  }

  if (eventType === 'session.start') {
    return {
      command: event.data.command,
      project_type: event.data.projectType,
    };
  }

  if (eventType === 'finding.detected') {
    return {
      finding_type: event.data.findingType,
      severity: event.data.severity,
    };
  }

  return {};
}

/**
 * Build HoneyHive user_properties for events.
 * Per HoneyHive docs: user_properties can include user id, country, tier, etc.
 * We use this for consistent context across all events.
 */
function buildHoneyHiveUserProperties(event: TelemetryEvent): Record<string, unknown> {
  return {
    // App context
    agentlint_version: event.meta.version,
    platform: event.meta.platform,
    node_version: event.meta.nodeVersion,
    // Event context
    event_sequence: event.sequence,
  };
}

/**
 * Build HoneyHive error object for failed events.
 * Per HoneyHive docs: error field captures failure details
 */
function buildHoneyHiveError(event: TelemetryEvent): string | null {
  // Tool failures
  if (event.type === 'tool.call' && event.data.success === false) {
    return (event.data.errorMessage as string) ?? 'Tool execution failed';
  }

  // Session errors
  if (event.type === 'session.error') {
    const errorType = event.data.errorType ?? 'UnknownError';
    const errorCode = event.data.errorCode ? ` (${event.data.errorCode})` : '';
    return `${errorType}${errorCode}`;
  }

  // Session end with failure
  if (event.type === 'session.end' && event.data.success === false) {
    return event.data.interrupted ? 'Session interrupted' : 'Session failed';
  }

  return null;
}

/**
 * Build HoneyHive metrics object for events.
 * Per HoneyHive docs: metrics contains computed KPIs (latency, token counts, scores)
 */
function buildHoneyHiveMetrics(event: TelemetryEvent): Record<string, unknown> {
  const metrics: Record<string, unknown> = {};

  if (event.type === 'llm.usage') {
    // Token metrics
    const inputTokens = (event.data.inputTokens as number) ?? 0;
    const outputTokens = (event.data.outputTokens as number) ?? 0;
    metrics.prompt_tokens = inputTokens;
    metrics.completion_tokens = outputTokens;
    metrics.total_tokens = inputTokens + outputTokens;

    // Cache token metrics (prompt caching)
    if (typeof event.data.cacheReadTokens === 'number') {
      metrics.cache_read_tokens = event.data.cacheReadTokens;
    }
    if (typeof event.data.cacheCreationTokens === 'number') {
      metrics.cache_creation_tokens = event.data.cacheCreationTokens;
    }

    // Cost metrics
    if (typeof event.data.cost === 'number') {
      metrics.cost = event.data.cost;
    }

    // Latency metrics
    if (typeof event.data.latencyMs === 'number') {
      metrics.latency_ms = event.data.latencyMs;
      // Tokens per second (if latency > 0)
      if (event.data.latencyMs > 0) {
        metrics.tokens_per_second = Math.round((outputTokens / event.data.latencyMs) * 1000);
      }
    }
  }

  if (event.type === 'tool.call') {
    // Duration metrics
    if (typeof event.data.durationMs === 'number') {
      metrics.duration_ms = event.data.durationMs;
    }
    // Success metric (1 or 0 for aggregation)
    metrics.success = event.data.success ? 1 : 0;
  }

  if (event.type === 'session.end') {
    // Session-level aggregates
    if (typeof event.data.durationMs === 'number') {
      metrics.duration_ms = event.data.durationMs;
    }
    if (typeof event.data.toolCallCount === 'number') {
      metrics.tool_calls = event.data.toolCallCount;
    }
    if (typeof event.data.findingCount === 'number') {
      metrics.findings = event.data.findingCount;
    }
    if (typeof event.data.totalInputTokens === 'number') {
      metrics.total_input_tokens = event.data.totalInputTokens;
    }
    if (typeof event.data.totalOutputTokens === 'number') {
      metrics.total_output_tokens = event.data.totalOutputTokens;
    }
  }

  return metrics;
}

/**
 * Build HoneyHive inputs object based on event type.
 * Includes full tool arguments and context for observability.
 */
function buildHoneyHiveInputs(event: TelemetryEvent): Record<string, unknown> {
  const eventType = event.type;

  if (eventType === 'tool.call') {
    return {
      tool: event.data.tool,
      arguments: event.data.toolInput ?? {},
    };
  }

  if (eventType === 'llm.usage') {
    const inputs: Record<string, unknown> = {
      model: event.data.model,
      provider: event.data.provider ?? 'anthropic',
      prompt_tokens: event.data.inputTokens ?? 0,
    };
    // Include model parameters if available
    if (event.data.temperature !== undefined) inputs.temperature = event.data.temperature;
    if (event.data.maxTokens !== undefined) inputs.max_tokens = event.data.maxTokens;
    if (event.data.topP !== undefined) inputs.top_p = event.data.topP;
    return inputs;
  }

  if (eventType === 'session.start') {
    return {
      command: event.data.command,
      directory: event.data.directory,
      hasConfig: event.data.hasConfig,
      projectType: event.data.projectType,
    };
  }

  if (eventType === 'finding.detected') {
    return {
      findingType: event.data.findingType,
      severity: event.data.severity,
    };
  }

  // Return all data fields as inputs for unknown types
  return event.data;
}

/**
 * Build HoneyHive outputs object based on event type.
 * Includes full tool results for observability.
 */
function buildHoneyHiveOutputs(event: TelemetryEvent): Record<string, unknown> {
  const eventType = event.type;

  if (eventType === 'tool.call') {
    const outputs: Record<string, unknown> = {
      success: event.data.success ?? false,
    };
    // Include tool output if available (truncated at source)
    if (event.data.toolOutput !== undefined) {
      outputs.result = event.data.toolOutput;
    }
    // Include error message if failed
    if (event.data.errorMessage) {
      outputs.error = event.data.errorMessage;
    }
    return outputs;
  }

  if (eventType === 'llm.usage') {
    const outputs: Record<string, unknown> = {
      completion_tokens: event.data.outputTokens ?? 0,
    };
    // Include stop reason if available
    if (event.data.stopReason) outputs.stop_reason = event.data.stopReason;
    return outputs;
  }

  if (eventType === 'session.end') {
    return {
      success: event.data.success ?? false,
      duration_ms: event.data.durationMs,
      tool_count: event.data.toolCallCount ?? 0,
      finding_count: event.data.findingCount ?? 0,
      recommendation_count: event.data.recommendationCount ?? 0,
    };
  }

  if (eventType === 'session.error') {
    return {
      error_type: event.data.errorType,
      error_code: event.data.errorCode,
    };
  }

  if (eventType === 'finding.detected') {
    return {
      findingType: event.data.findingType,
      severity: event.data.severity,
    };
  }

  return {};
}

/**
 * Build HoneyHive metadata object based on event type.
 */
function buildHoneyHiveMetadata(event: TelemetryEvent): Record<string, unknown> {
  const base: Record<string, unknown> = {
    agentlint_version: event.meta.version,
    platform: event.meta.platform,
    sequence: event.sequence,
  };

  if (event.type === 'llm.usage') {
    return {
      ...base,
      total_tokens: ((event.data.inputTokens as number) ?? 0) + ((event.data.outputTokens as number) ?? 0),
      prompt_tokens: event.data.inputTokens ?? 0,
      completion_tokens: event.data.outputTokens ?? 0,
      cost: event.data.cost,
      latency_ms: event.data.latencyMs,
    };
  }

  if (event.type === 'tool.call') {
    return {
      ...base,
      success: event.data.success,
      duration_ms: event.data.durationMs,
    };
  }

  if (event.type === 'session.end') {
    return {
      ...base,
      total_input_tokens: event.data.totalInputTokens,
      total_output_tokens: event.data.totalOutputTokens,
      recommendation_count: event.data.recommendationCount,
    };
  }

  return base;
}

async function forwardToHoneyHive(events: TelemetryEvent[], requestId: string): Promise<void> {
  const apiKey = process.env['HONEYHIVE_API_KEY'];

  if (!apiKey) {
    console.error(JSON.stringify({
      level: 'error',
      requestId,
      event: 'config_error',
      message: 'HONEYHIVE_API_KEY not configured',
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // Group events by session for efficient forwarding
  const eventsBySession = new Map<string, TelemetryEvent[]>();
  for (const event of events) {
    const existing = eventsBySession.get(event.sessionId) || [];
    existing.push(event);
    eventsBySession.set(event.sessionId, existing);
  }

  // Forward each session's events
  for (const [sessionId, sessionEvents] of eventsBySession) {
    try {
      // First event usually contains session.start with metadata
      const firstEvent = sessionEvents[0];
      // Find session.start event for the session event ID
      const sessionStartEvent = sessionEvents.find((e) => e.type === 'session.start');
      const sessionEventId = sessionStartEvent?.eventId ?? firstEvent?.eventId;

      // Use source from client metadata for environment filtering (HoneyHive best practice)
      // Client sets 'agentlint-cli' for production, 'agentlint-cli-test' for test environments
      // This enables filtering test data from production in HoneyHive dashboard
      const source = firstEvent?.meta.source ?? 'agentlint-cli';

      // Build human-readable session name from event context
      const sessionName = buildSessionName(sessionEvents);

      // Extract session context from session.start event
      const sessionEndEvent = sessionEvents.find((e) => e.type === 'session.end');

      // Build session-level inputs (command context)
      const sessionInputs: Record<string, unknown> = {};
      if (sessionStartEvent?.data) {
        if (sessionStartEvent.data.command) sessionInputs.command = sessionStartEvent.data.command;
        if (sessionStartEvent.data.directory) sessionInputs.directory = sessionStartEvent.data.directory;
        if (sessionStartEvent.data.projectType) sessionInputs.project_type = sessionStartEvent.data.projectType;
        if (sessionStartEvent.data.hasConfig !== undefined) sessionInputs.has_config = sessionStartEvent.data.hasConfig;
      }

      // Build session-level outputs (from session.end if available)
      const sessionOutputs: Record<string, unknown> = {};
      if (sessionEndEvent?.data) {
        if (sessionEndEvent.data.success !== undefined) sessionOutputs.success = sessionEndEvent.data.success;
        if (sessionEndEvent.data.findingCount !== undefined) sessionOutputs.finding_count = sessionEndEvent.data.findingCount;
        if (sessionEndEvent.data.recommendationCount !== undefined) sessionOutputs.recommendation_count = sessionEndEvent.data.recommendationCount;
        if (sessionEndEvent.data.toolCallCount !== undefined) sessionOutputs.tool_count = sessionEndEvent.data.toolCallCount;
      }

      // Build session-level metrics (aggregated from events)
      const sessionMetrics: Record<string, unknown> = {};
      let totalTokens = 0;
      let totalCost = 0;
      let modelEventCount = 0;
      let toolEventCount = 0;
      for (const evt of sessionEvents) {
        if (evt.type === 'llm.usage') {
          modelEventCount++;
          totalTokens += ((evt.data.inputTokens as number) ?? 0) + ((evt.data.outputTokens as number) ?? 0);
          if (typeof evt.data.cost === 'number') totalCost += evt.data.cost;
        }
        if (evt.type === 'tool.call') toolEventCount++;
      }
      if (totalTokens > 0) sessionMetrics.total_tokens = totalTokens;
      if (totalCost > 0) sessionMetrics.total_cost = totalCost;
      if (modelEventCount > 0) sessionMetrics.model_calls = modelEventCount;
      if (toolEventCount > 0) sessionMetrics.tool_calls = toolEventCount;
      if (sessionEndEvent?.data?.durationMs) sessionMetrics.duration_ms = sessionEndEvent.data.durationMs;

      // Build session-level config (app settings)
      const sessionConfig: Record<string, unknown> = {
        app_version: firstEvent?.meta.version ?? 'unknown',
        node_version: firstEvent?.meta.nodeVersion ?? 'unknown',
      };
      if (sessionStartEvent?.data?.command) {
        sessionConfig.command = sessionStartEvent.data.command;
      }

      // Create or update session in HoneyHive
      // API expects body wrapped in { session: { ... } }
      // Include all recommended fields per HoneyHive best practices
      const sessionController = new AbortController();
      const sessionTimeout = setTimeout(() => sessionController.abort(), HONEYHIVE_TIMEOUT_MS);

      const sessionResponse = await fetch('https://api.honeyhive.ai/session/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          session: {
            project: 'agentlint',
            session_name: sessionName,
            source: source,
            session_id: sessionId,
            // User properties for filtering/segmentation
            user_properties: {
              version: firstEvent?.meta.version ?? 'unknown',
              platform: firstEvent?.meta.platform ?? 'unknown',
              node_version: firstEvent?.meta.nodeVersion ?? 'unknown',
            },
            // Session config (app settings)
            config: sessionConfig,
            // Session inputs (command context)
            inputs: sessionInputs,
            // Session outputs (results) - populated if session.end received
            outputs: sessionOutputs,
            // Session metrics (aggregated KPIs)
            metrics: sessionMetrics,
          },
        }),
        signal: sessionController.signal,
      });

      clearTimeout(sessionTimeout);

      if (!sessionResponse.ok) {
        const errorBody = await sessionResponse.text();
        console.error(JSON.stringify({
          level: 'error',
          requestId,
          sessionId,
          event: 'session_create_error',
          status: sessionResponse.status,
          errorBody: errorBody.slice(0, 200),
          timestamp: new Date().toISOString(),
        }));
        // Continue anyway to try logging events
      } else {
        console.log(JSON.stringify({
          level: 'info',
          requestId,
          sessionId,
          event: 'session_created',
          sessionName,
          timestamp: new Date().toISOString(),
        }));
      }

      // Log individual events
      for (const event of sessionEvents) {
        // Map agentlint event types to HoneyHive event types
        let eventType: 'model' | 'tool' | 'chain' = 'chain';
        if (event.type === 'llm.usage') {
          eventType = 'model';
        } else if (event.type === 'tool.call') {
          eventType = 'tool';
        }

        // Calculate duration from start/end times or fallback to data.durationMs
        const startTime = event.startTime ?? new Date(event.timestamp).getTime();
        const endTime = event.endTime ?? startTime + (typeof event.data.durationMs === 'number' ? event.data.durationMs : 0);
        const duration = endTime - startTime;

        // Parent ID: use event's parentEventId, or session event ID as fallback for child events
        // Session events (session.start, session.end) should have null parent
        const isSessionEvent = event.type === 'session.start' || event.type === 'session.end';
        const parentId = isSessionEvent ? null : (event.parentEventId ?? sessionEventId);

        // Build error field if event failed
        const errorMessage = buildHoneyHiveError(event);

        // Build metrics for KPI tracking
        const metrics = buildHoneyHiveMetrics(event);

        // Build user_properties for event-level context
        const userProperties = buildHoneyHiveUserProperties(event);

        // API expects body wrapped in { event: { ... } }
        // Include all HoneyHive fields for maximum observability
        const eventPayload: Record<string, unknown> = {
          event: {
            project: 'agentlint',
            source: source,
            session_id: sessionId,
            event_id: event.eventId,
            event_type: eventType,
            event_name: buildEventName(event),
            // Timestamps in UTC milliseconds (HoneyHive requirement)
            start_time: startTime,
            end_time: endTime,
            duration: duration,
            // Core data fields
            config: buildHoneyHiveConfig(event),
            inputs: buildHoneyHiveInputs(event),
            outputs: buildHoneyHiveOutputs(event),
            metadata: buildHoneyHiveMetadata(event),
            // User properties for filtering/segmentation (per HoneyHive docs)
            user_properties: userProperties,
            // Metrics for KPI tracking (latency, tokens, costs)
            metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
            // Error field for failed events
            error: errorMessage,
            // Parent ID for trace hierarchy
            parent_id: parentId,
          },
        };

        // Remove undefined fields to keep payload clean
        const eventData = eventPayload.event as Record<string, unknown>;
        for (const key of Object.keys(eventData)) {
          if (eventData[key] === undefined || eventData[key] === null) {
            delete eventData[key];
          }
        }

        const eventController = new AbortController();
        const eventTimeout = setTimeout(() => eventController.abort(), HONEYHIVE_TIMEOUT_MS);

        const eventResponse = await fetch('https://api.honeyhive.ai/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(eventPayload),
          signal: eventController.signal,
        });

        clearTimeout(eventTimeout);

        if (!eventResponse.ok) {
          const errorBody = await eventResponse.text();
          console.error(JSON.stringify({
            level: 'error',
            requestId,
            sessionId,
            event: 'event_log_error',
            eventId: event.eventId,
            eventType: event.type,
            status: eventResponse.status,
            errorBody: errorBody.slice(0, 200),
            timestamp: new Date().toISOString(),
          }));
        }
      }
    } catch (error) {
      const classified = classifyError(error);
      console.error(JSON.stringify({
        level: 'error',
        requestId,
        sessionId,
        event: 'session_forward_error',
        category: classified.category,
        errorName: classified.name,
        errorMessage: classified.message,
        eventCount: sessionEvents.length,
        timestamp: new Date().toISOString(),
      }));
    }
  }
}

// =============================================================================
// Request Handler
// =============================================================================

export async function POST(request: Request): Promise<Response> {
  const requestId = generateRequestId();

  // Get client IP for rate limiting
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'anonymous';

  console.log(JSON.stringify({
    level: 'info',
    requestId,
    event: 'request_start',
    ip,
    timestamp: new Date().toISOString(),
  }));

  // Check rate limit
  if (!checkRateLimit(ip)) {
    console.log(JSON.stringify({
      level: 'warn',
      requestId,
      event: 'rate_limited',
      ip,
      timestamp: new Date().toISOString(),
    }));
    return NextResponse.json({ error: 'Rate limited', requestId }, { status: 429 });
  }

  // Parse and validate payload
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.log(JSON.stringify({
      level: 'warn',
      requestId,
      event: 'invalid_json',
      timestamp: new Date().toISOString(),
    }));
    return NextResponse.json({ error: 'Invalid JSON', requestId }, { status: 400 });
  }

  if (!isValidPayload(body)) {
    console.log(JSON.stringify({
      level: 'warn',
      requestId,
      event: 'invalid_schema',
      timestamp: new Date().toISOString(),
    }));
    return NextResponse.json({ error: 'Invalid payload schema', requestId }, { status: 400 });
  }

  // Forward to HoneyHive and wait for completion to prevent event loss
  await forwardToHoneyHive(body.events, requestId);

  console.log(JSON.stringify({
    level: 'info',
    requestId,
    event: 'request_complete',
    eventsReceived: body.events.length,
    timestamp: new Date().toISOString(),
  }));

  return NextResponse.json({ success: true, eventsReceived: body.events.length, requestId });
}

// Route segment config (App Router)
export const runtime = 'edge';
export const preferredRegion = ['iad1', 'sfo1', 'cdg1'];
export const maxDuration = 10;
