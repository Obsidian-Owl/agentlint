/**
 * Vercel Proxy Integration Tests
 *
 * Tests the agentlint telemetry proxy endpoint.
 * These tests DO NOT require HONEYHIVE_API_KEY - they test the proxy layer.
 *
 * Run with: bun test tests/integration/vercel-proxy.test.ts
 */

import { describe, test, expect } from 'bun:test';

const VERCEL_ENDPOINT = 'https://agentlint.vercel.app/api/events';

// Helper to generate valid UUIDs (HoneyHive requires UUID format)
function generateUUID(): string {
  return crypto.randomUUID();
}

// Response types for the telemetry API
interface SuccessResponse {
  success: boolean;
  eventsReceived: number;
}

interface ErrorResponse {
  error: string;
}

describe('Vercel Telemetry Proxy', () => {
  test('accepts valid events payload', async () => {
    const sessionId = generateUUID();

    const response = await fetch(VERCEL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        events: [
          {
            type: 'session.start',
            timestamp: new Date().toISOString(),
            sessionId,
            eventId: generateUUID(),
            sequence: 0,
            data: { command: 'analyse', hasConfig: true },
            meta: { version: '0.1.0', platform: 'test', nodeVersion: 'v22.0.0' },
          },
          {
            type: 'tool.call',
            timestamp: new Date().toISOString(),
            sessionId,
            eventId: generateUUID(),
            sequence: 1,
            data: { tool: 'discover_configs', durationMs: 150, success: true },
            meta: { version: '0.1.0', platform: 'test', nodeVersion: 'v22.0.0' },
          },
          {
            type: 'session.end',
            timestamp: new Date().toISOString(),
            sessionId,
            eventId: generateUUID(),
            sequence: 2,
            data: { durationMs: 5000, toolCallCount: 1, success: true },
            meta: { version: '0.1.0', platform: 'test', nodeVersion: 'v22.0.0' },
          },
        ],
      }),
    });

    console.log('Response status:', response.status);
    const body = (await response.json()) as SuccessResponse;
    console.log('Response body:', JSON.stringify(body, null, 2));

    expect(response.ok).toBe(true);
    expect(body.success).toBe(true);
    expect(body.eventsReceived).toBe(3);
  });

  test('rejects invalid JSON', async () => {
    const response = await fetch(VERCEL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'not valid json',
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrorResponse;
    expect(body.error).toBe('Invalid JSON');
  });

  test('rejects missing events array', async () => {
    const response = await fetch(VERCEL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notEvents: [] }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrorResponse;
    expect(body.error).toBe('Invalid payload schema');
  });

  test('rejects event missing required fields', async () => {
    const response = await fetch(VERCEL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        events: [
          {
            // Missing type, timestamp, sessionId, eventId, sequence, data, meta
            incomplete: true,
          },
        ],
      }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrorResponse;
    expect(body.error).toBe('Invalid payload schema');
  });

  test('accepts empty events array', async () => {
    const response = await fetch(VERCEL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ events: [] }),
    });

    expect(response.ok).toBe(true);
    const body = (await response.json()) as SuccessResponse;
    expect(body.eventsReceived).toBe(0);
  });
});
