/**
 * HoneyHive API Integration Tests
 *
 * These tests validate the HoneyHive API request/response format.
 * Run with: HONEYHIVE_API_KEY=<key> bun test tests/integration/honeyhive-api.test.ts
 *
 * Skip in CI unless RUN_HONEYHIVE_TESTS=1 is set.
 */

import { describe, test, expect } from 'bun:test';

const HONEYHIVE_API_URL = 'https://api.honeyhive.ai';
const API_KEY = process.env['HONEYHIVE_API_KEY'];

// Skip tests if no API key or not explicitly enabled
const shouldRun = API_KEY && process.env['RUN_HONEYHIVE_TESTS'] === '1';

// Helper to generate valid UUIDs (HoneyHive requires UUID format for IDs)
function generateUUID(): string {
  return crypto.randomUUID();
}

// Response types for the Vercel telemetry API
interface VercelSuccessResponse {
  success: boolean;
  eventsReceived: number;
}

describe.skipIf(!shouldRun)('HoneyHive API Integration', () => {
  const testSessionId = generateUUID();

  describe('POST /session/start', () => {
    test('creates session with correct format', async () => {
      const response = await fetch(`${HONEYHIVE_API_URL}/session/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          session: {
            project: 'agentlint-test',
            session_name: testSessionId,
            source: 'integration-test',
            session_id: testSessionId,
            user_properties: {
              version: '0.1.0',
              platform: 'test',
            },
          },
        }),
      });

      console.log('Session response status:', response.status);
      const body = await response.json();
      console.log('Session response body:', JSON.stringify(body, null, 2));

      expect(response.ok).toBe(true);
      expect(body).toHaveProperty('session_id');
    });

    test('fails without session wrapper', async () => {
      const response = await fetch(`${HONEYHIVE_API_URL}/session/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          // Missing 'session' wrapper - this should fail
          project: 'agentlint-test',
          session_name: 'test-no-wrapper',
          source: 'integration-test',
        }),
      });

      console.log('No-wrapper response status:', response.status);
      const body = await response.text();
      console.log('No-wrapper response body:', body);

      // This should fail with 400 or 422
      expect(response.ok).toBe(false);
    });
  });

  describe('POST /events', () => {
    test('creates event with correct format', async () => {
      const eventId = generateUUID();

      const response = await fetch(`${HONEYHIVE_API_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          event: {
            project: 'agentlint-test',
            source: 'integration-test',
            session_id: testSessionId,
            event_id: eventId,
            event_type: 'tool',
            event_name: 'test.tool_call',
            config: {},
            inputs: { test: true },
            outputs: {},
            duration: 100,
            metadata: {
              test: true,
              sequence: 1,
            },
          },
        }),
      });

      console.log('Event response status:', response.status);
      const body = await response.json();
      console.log('Event response body:', JSON.stringify(body, null, 2));

      expect(response.ok).toBe(true);
      expect(body).toHaveProperty('event_id');
    });

    test('fails without event wrapper', async () => {
      const response = await fetch(`${HONEYHIVE_API_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          // Missing 'event' wrapper - this should fail
          project: 'agentlint-test',
          source: 'integration-test',
          event_type: 'tool',
          event_name: 'test.no_wrapper',
          config: {},
          inputs: {},
          duration: 0,
        }),
      });

      console.log('No-wrapper event response status:', response.status);
      const body = await response.text();
      console.log('No-wrapper event response body:', body);

      // This should fail with 400 or 422
      expect(response.ok).toBe(false);
    });

    test('creates model event', async () => {
      const eventId = generateUUID();

      const response = await fetch(`${HONEYHIVE_API_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          event: {
            project: 'agentlint-test',
            source: 'integration-test',
            session_id: testSessionId,
            event_id: eventId,
            event_type: 'model',
            event_name: 'llm.usage',
            config: { model: 'claude-sonnet-4' },
            inputs: {},
            outputs: {},
            duration: 500,
            metadata: {
              inputTokens: 100,
              outputTokens: 50,
            },
          },
        }),
      });

      console.log('Model event response status:', response.status);
      const body = await response.json();
      console.log('Model event response body:', JSON.stringify(body, null, 2));

      expect(response.ok).toBe(true);
    });

    test('creates chain event', async () => {
      const eventId = generateUUID();

      const response = await fetch(`${HONEYHIVE_API_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          event: {
            project: 'agentlint-test',
            source: 'integration-test',
            session_id: testSessionId,
            event_id: eventId,
            event_type: 'chain',
            event_name: 'session.start',
            config: {},
            inputs: { command: 'analyse' },
            outputs: {},
            duration: 0,
            metadata: {
              sequence: 0,
            },
          },
        }),
      });

      console.log('Chain event response status:', response.status);
      const body = await response.json();
      console.log('Chain event response body:', JSON.stringify(body, null, 2));

      expect(response.ok).toBe(true);
    });
  });

  describe('API Error Handling', () => {
    test('returns 401 without auth', async () => {
      const response = await fetch(`${HONEYHIVE_API_URL}/session/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No Authorization header
        },
        body: JSON.stringify({
          session: {
            project: 'test',
            session_name: 'test',
            source: 'test',
          },
        }),
      });

      expect(response.status).toBe(401);
    });

    test('returns error for invalid project', async () => {
      const response = await fetch(`${HONEYHIVE_API_URL}/session/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          session: {
            project: 'nonexistent-project-12345',
            session_name: 'test',
            source: 'test',
          },
        }),
      });

      console.log('Invalid project response:', response.status);
      const body = await response.text();
      console.log('Invalid project body:', body);

      // Should fail - project doesn't exist
      expect(response.ok).toBe(false);
    });
  });
});

// Also test the Vercel proxy endpoint
describe.skipIf(!shouldRun)('Vercel Proxy Integration', () => {
  const VERCEL_ENDPOINT = 'https://agentlint.vercel.app/api/events';

  test('accepts events and returns success', async () => {
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
            sessionId: generateUUID(),
            eventId: generateUUID(),
            sequence: 0,
            data: { command: 'analyse', hasConfig: true },
            meta: { version: '0.1.0', platform: 'test', nodeVersion: 'v22.0.0' },
          },
        ],
      }),
    });

    console.log('Vercel proxy response status:', response.status);
    const body = (await response.json()) as VercelSuccessResponse;
    console.log('Vercel proxy response body:', JSON.stringify(body, null, 2));

    expect(response.ok).toBe(true);
    expect(body.success).toBe(true);
    expect(body.eventsReceived).toBe(1);
  });
});
