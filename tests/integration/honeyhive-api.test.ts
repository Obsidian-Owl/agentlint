/**
 * HoneyHive API Integration Tests
 *
 * These tests validate the HoneyHive API request/response format.
 * Requires: HONEYHIVE_API_KEY environment variable
 *
 * Run with: HONEYHIVE_API_KEY=<key> bun test tests/integration/honeyhive-api.test.ts
 */

import { describe, test, expect, beforeAll } from 'bun:test';

const HONEYHIVE_API_URL = 'https://api.honeyhive.ai';
const API_KEY = process.env['HONEYHIVE_API_KEY'];

// Helper to generate valid UUIDs (HoneyHive requires UUID format for IDs)
function generateUUID(): string {
  return crypto.randomUUID();
}

// Response types for the Vercel telemetry API
interface VercelSuccessResponse {
  success: boolean;
  eventsReceived: number;
}

/**
 * HoneyHive API Integration Tests
 *
 * These tests verify the HoneyHive API request/response format.
 * All tests use project: 'agentlint' with source: 'integration-test' for filtering.
 *
 * Per HoneyHive best practices, we use the `source` field to distinguish
 * test data from production data, not separate projects.
 */
describe('HoneyHive API Integration', () => {
  beforeAll(() => {
    if (!API_KEY) {
      throw new Error(
        'HONEYHIVE_API_KEY environment variable is required.\n' +
          'Set it to run these tests: HONEYHIVE_API_KEY=xxx bun test tests/integration/honeyhive-api.test.ts'
      );
    }
  });
  const testSessionId = generateUUID();

  // All tests use same project with 'integration-test' source for filtering
  const PROJECT = 'agentlint';
  const SOURCE = 'integration-test';

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
            project: PROJECT,
            session_name: `integration-test-${testSessionId.slice(0, 8)}`,
            source: SOURCE,
            session_id: testSessionId,
            user_properties: {
              version: '0.1.0-test',
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

    test('accepts requests without session wrapper (HoneyHive quirk)', async () => {
      // HoneyHive actually accepts requests without the session wrapper
      // It just extracts fields from the top level
      const response = await fetch(`${HONEYHIVE_API_URL}/session/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          // No 'session' wrapper - HoneyHive accepts this
          project: PROJECT,
          session_name: 'integration-test-no-wrapper',
          source: SOURCE,
        }),
      });

      console.log('No-wrapper response status:', response.status);
      const body = await response.text();
      console.log('No-wrapper response body:', body);

      // HoneyHive accepts this (documented as requiring wrapper but actually doesn't)
      expect(response.ok).toBe(true);
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
            project: PROJECT,
            source: SOURCE,
            session_id: testSessionId,
            event_id: eventId,
            event_type: 'tool',
            event_name: 'Tool: test_tool',
            config: { tool: 'test_tool' },
            inputs: { test: true },
            outputs: { success: true },
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
          project: PROJECT,
          source: SOURCE,
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
            project: PROJECT,
            source: SOURCE,
            session_id: testSessionId,
            event_id: eventId,
            event_type: 'model',
            event_name: 'Claude: claude-sonnet-4',
            config: { model: 'claude-sonnet-4', provider: 'anthropic' },
            inputs: { prompt_tokens: 100 },
            outputs: { completion_tokens: 50 },
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
            project: PROJECT,
            source: SOURCE,
            session_id: testSessionId,
            event_id: eventId,
            event_type: 'chain',
            event_name: 'Session: Start',
            config: { command: 'analyse' },
            inputs: { command: 'analyse', directory: 'test-project' },
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
            project: PROJECT,
            session_name: 'test',
            source: SOURCE,
          },
        }),
      });

      expect(response.status).toBe(401);
    });

    test('accepts session even with invalid project name (uses default)', async () => {
      // HoneyHive creates sessions even if project doesn't exist
      // It falls back to a default project or creates one
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
            source: SOURCE,
          },
        }),
      });

      console.log('Invalid project response:', response.status);
      const body = await response.text();
      console.log('Invalid project body:', body);

      // HoneyHive accepts this and uses a default project
      expect(response.ok).toBe(true);
    });
  });
});

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
describe('Vercel Proxy Integration', () => {
  const VERCEL_ENDPOINT = 'https://agentlint.vercel.app/api/events';

  test('accepts events and returns success', async () => {
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
            // Mark as integration test for easy filtering in HoneyHive
            data: {
              command: 'integration-test',
              hasConfig: false,
              directory: 'test-project',
            },
            meta: {
              version: '0.1.0-test',
              platform: 'test',
              nodeVersion: 'v22.0.0',
              // Source will be overridden to 'agentlint-cli' by proxy
              source: 'agentlint-cli-test',
            },
          },
        ],
      }),
    });

    console.log('Vercel proxy response status:', response.status);
    const body = (await response.json()) as VercelSuccessResponse;
    console.log('Vercel proxy response body:', JSON.stringify(body, null, 2));
    console.log('Test session ID:', testSessionId);

    expect(response.ok).toBe(true);
    expect(body.success).toBe(true);
    expect(body.eventsReceived).toBe(1);
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
    const body = (await response.json()) as VercelSuccessResponse;
    console.log('Tool event proxy response body:', JSON.stringify(body, null, 2));

    expect(response.ok).toBe(true);
    expect(body.success).toBe(true);
    expect(body.eventsReceived).toBe(2);
  });
});
