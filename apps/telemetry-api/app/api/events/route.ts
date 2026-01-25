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
}

interface TelemetryEvent {
  type: string;
  timestamp: string;
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

      // Create or update session in HoneyHive
      const sessionResponse = await fetch('https://api.honeyhive.ai/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          project: 'agentlint',
          session_name: sessionId,
          source: 'agentlint-cli',
          session_id: sessionId,
          user_properties: {
            version: firstEvent?.meta.version ?? 'unknown',
            platform: firstEvent?.meta.platform ?? 'unknown',
          },
        }),
      });

      if (!sessionResponse.ok) {
        console.error(
          `[telemetry-api] HoneyHive session create failed: ${sessionResponse.status}`
        );
        // Continue anyway to try logging events
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

        const eventPayload = {
          project: 'agentlint',
          session_id: sessionId,
          event_id: event.eventId,
          event_type: eventType,
          event_name: event.type,
          config: {},
          inputs: {},
          outputs: {},
          duration:
            typeof event.data.durationMs === 'number' ? event.data.durationMs : 0,
          metadata: {
            ...event.data,
            agentlint_version: event.meta.version,
            platform: event.meta.platform,
            sequence: event.sequence,
          },
          parent_id: event.parentEventId,
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
          console.error(
            `[telemetry-api] HoneyHive event log failed: ${eventResponse.status}`
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

  // Forward to HoneyHive (don't wait, respond immediately)
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  forwardToHoneyHive(body.events);

  return NextResponse.json({ success: true, eventsReceived: body.events.length });
}

// Route segment config (App Router)
export const runtime = 'edge';
export const preferredRegion = ['iad1', 'sfo1', 'cdg1'];
export const maxDuration = 10;
