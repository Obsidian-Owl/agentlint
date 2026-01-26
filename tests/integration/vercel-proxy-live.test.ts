/**
 * Vercel Proxy Integration Tests (LIVE)
 *
 * Tests the agentlint telemetry proxy endpoint by making actual network calls
 * to the deployed Vercel function. These tests verify the proxy accepts events
 * and forwards them to HoneyHive correctly.
 *
 * These tests are blocked by preload unless RUN_LIVE_TESTS=1 is set.
 *
 * Run with: bun run test:live tests/integration/vercel-proxy-live.test.ts
 *
 * @module tests/integration/vercel-proxy-live
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

/**
 * Vercel Proxy Integration Tests
 *
 * These tests verify the Vercel proxy endpoint at agentlint.vercel.app works correctly.
 *
 * The proxy:
 * - Uses human-readable session names like "agentlint-analyse-2026-01-26"
 * - Passes through source from client for filtering (e.g., 'agentlint-cli-test')
 * - Generates descriptive event names like "Tool: discover_configs"
 *
 * Filter test data in HoneyHive by: source != 'agentlint-cli'
 */
describe('Vercel Telemetry Proxy', () => {
  test('accepts valid events payload', async () => {
    const sessionId = generateUUID();
    const now = Date.now();

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
            startTime: now,
            endTime: now,
            sessionId,
            eventId: generateUUID(),
            sequence: 0,
            data: { command: 'analyse', hasConfig: true },
            meta: {
              version: '0.1.0',
              platform: 'test',
              nodeVersion: 'v22.0.0',
              source: 'agentlint-cli-test',
            },
          },
          {
            type: 'tool.call',
            timestamp: new Date().toISOString(),
            startTime: now + 100,
            endTime: now + 250,
            sessionId,
            eventId: generateUUID(),
            sequence: 1,
            data: { tool: 'discover_configs', durationMs: 150, success: true },
            meta: {
              version: '0.1.0',
              platform: 'test',
              nodeVersion: 'v22.0.0',
              source: 'agentlint-cli-test',
            },
          },
          {
            type: 'session.end',
            timestamp: new Date().toISOString(),
            startTime: now,
            endTime: now + 5000,
            sessionId,
            eventId: generateUUID(),
            sequence: 2,
            data: { durationMs: 5000, toolCallCount: 1, success: true },
            meta: {
              version: '0.1.0',
              platform: 'test',
              nodeVersion: 'v22.0.0',
              source: 'agentlint-cli-test',
            },
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

  test('forwards tool events with inputs/outputs', async () => {
    const now = Date.now();
    const testSessionId = generateUUID();

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
            startTime: now,
            endTime: now,
            sessionId: testSessionId,
            eventId: generateUUID(),
            sequence: 0,
            data: { command: 'integration-test', hasConfig: true },
            meta: {
              version: '0.1.0-test',
              platform: 'test',
              nodeVersion: 'v22.0.0',
              source: 'agentlint-cli-test',
            },
          },
          {
            type: 'tool.call',
            timestamp: new Date().toISOString(),
            startTime: now,
            endTime: now + 150,
            sessionId: testSessionId,
            eventId: generateUUID(),
            sequence: 1,
            data: {
              tool: 'discover_configs',
              durationMs: 150,
              success: true,
              // New: Include tool inputs and outputs
              toolInput: { directory: '/test/project', types: ['claude-code'] },
              toolOutput: { configs_found: 2, files: ['CLAUDE.md', '.mcp.json'] },
            },
            meta: {
              version: '0.1.0-test',
              platform: 'test',
              nodeVersion: 'v22.0.0',
              source: 'agentlint-cli-test',
            },
          },
        ],
      }),
    });

    console.log('Tool event proxy response status:', response.status);
    const body = (await response.json()) as SuccessResponse;
    console.log('Tool event proxy response body:', JSON.stringify(body, null, 2));

    expect(response.ok).toBe(true);
    expect(body.success).toBe(true);
    expect(body.eventsReceived).toBe(2);
  });
});
