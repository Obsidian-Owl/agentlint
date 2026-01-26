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
// Validation
// =============================================================================

function isValidEvent(event: unknown): event is TelemetryEvent {
  if (!event || typeof event !== 'object') return false;

  const e = event as Record<string, unknown>;
  return (
    typeof e.type === 'string' &&
    typeof e.timestamp === 'string' &&
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

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

// =============================================================================
// HoneyHive Forwarding
// =============================================================================

/**
 * Build HoneyHive config object based on event type.
 */
function buildHoneyHiveConfig(event: TelemetryEvent): Record<string, unknown> {
  const eventType = event.type;

  if (eventType === 'llm.usage') {
    return {
      model: event.data.model ?? 'claude',
      provider: event.data.provider ?? 'anthropic',
    };
  }

  if (eventType === 'tool.call') {
    return {
      tool_name: event.data.tool,
    };
  }

  if (eventType === 'session.start') {
    return {
      command: event.data.command,
    };
  }

  return {};
}

/**
 * Build HoneyHive inputs object based on event type.
 */
function buildHoneyHiveInputs(event: TelemetryEvent): Record<string, unknown> {
  const eventType = event.type;

  if (eventType === 'llm.usage') {
    return {
      token_count: event.data.inputTokens ?? 0,
    };
  }

  if (eventType === 'tool.call') {
    return {
      tool: event.data.tool,
    };
  }

  if (eventType === 'session.start') {
    return {
      command: event.data.command,
      hasConfig: event.data.hasConfig,
    };
  }

  return {};
}

/**
 * Build HoneyHive outputs object based on event type.
 */
function buildHoneyHiveOutputs(event: TelemetryEvent): Record<string, unknown> {
  const eventType = event.type;

  if (eventType === 'llm.usage') {
    return {
      token_count: event.data.outputTokens ?? 0,
    };
  }

  if (eventType === 'tool.call') {
    return {
      success: event.data.success ?? false,
    };
  }

  if (eventType === 'session.end') {
    return {
      success: event.data.success ?? false,
      findingCount: event.data.findingCount ?? 0,
      toolCallCount: event.data.toolCallCount ?? 0,
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
      total_tokens: (event.data.inputTokens as number ?? 0) + (event.data.outputTokens as number ?? 0),
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

async function forwardToHoneyHive(events: TelemetryEvent[]): Promise<void> {
  const apiKey = process.env['HONEYHIVE_API_KEY'];

  if (!apiKey) {
    console.error('[telemetry-api] HONEYHIVE_API_KEY not configured');
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

      // Get source from event metadata (defaults to 'agentlint-cli' for backward compat)
      const source = firstEvent?.meta.source ?? 'agentlint-cli';

      // Create or update session in HoneyHive
      // API expects body wrapped in { session: { ... } }
      const sessionResponse = await fetch('https://api.honeyhive.ai/session/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          session: {
            project: 'agentlint',
            session_name: sessionId,
            source: source,
            session_id: sessionId,
            user_properties: {
              version: firstEvent?.meta.version ?? 'unknown',
              platform: firstEvent?.meta.platform ?? 'unknown',
            },
          },
        }),
      });

      if (!sessionResponse.ok) {
        const errorBody = await sessionResponse.text();
        console.error(
          `[telemetry-api] HoneyHive session create failed: ${sessionResponse.status} - ${errorBody}`
        );
        // Continue anyway to try logging events
      } else {
        console.log(`[telemetry-api] HoneyHive session created: ${sessionId}`);
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

        // API expects body wrapped in { event: { ... } }
        // Required fields: project, event_type, event_name, source, config, inputs, duration
        const eventPayload = {
          event: {
            project: 'agentlint',
            source: event.meta.source ?? source,
            session_id: sessionId,
            event_id: event.eventId,
            event_type: eventType,
            event_name: event.type,
            // Timestamps in UTC milliseconds (HoneyHive requirement)
            start_time: startTime,
            end_time: endTime,
            duration: duration,
            // Populated based on event type
            config: buildHoneyHiveConfig(event),
            inputs: buildHoneyHiveInputs(event),
            outputs: buildHoneyHiveOutputs(event),
            metadata: buildHoneyHiveMetadata(event),
            // Parent ID for trace hierarchy
            parent_id: parentId,
          },
        };

        const eventResponse = await fetch('https://api.honeyhive.ai/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(eventPayload),
        });

        if (!eventResponse.ok) {
          const errorBody = await eventResponse.text();
          console.error(
            `[telemetry-api] HoneyHive event log failed: ${eventResponse.status} - ${errorBody}`
          );
        }
      }
    } catch (error) {
      console.error('[telemetry-api] HoneyHive forwarding error:', error);
    }
  }
}

// =============================================================================
// Request Handler
// =============================================================================

export async function POST(request: Request): Promise<Response> {
  // Get client IP for rate limiting
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'anonymous';

  // Check rate limit
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  // Parse and validate payload
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!isValidPayload(body)) {
    return NextResponse.json({ error: 'Invalid payload schema' }, { status: 400 });
  }

  // Forward to HoneyHive and wait for completion to prevent event loss
  await forwardToHoneyHive(body.events);

  return NextResponse.json({ success: true, eventsReceived: body.events.length });
}

// Route segment config (App Router)
export const runtime = 'edge';
export const preferredRegion = ['iad1', 'sfo1', 'cdg1'];
export const maxDuration = 10;
