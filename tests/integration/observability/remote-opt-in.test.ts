/**
 * EP22 US-005 T059: Integration test for remote export opt-in
 * Verify no remote calls without explicit opt-in.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  getTelemetryClient,
  resetTelemetryClient,
  createTelemetryClient,
} from '../../../src/telemetry';
import type { TelemetryConfig } from '../../../src/persistence/types';

// Mock fetch to verify no remote calls
let fetchCalls: Array<{ url: string; options: RequestInit }> = [];
const originalFetch = global.fetch;

function mockFetch(url: string | URL | Request, options?: RequestInit): Promise<Response> {
  let urlString: string;
  if (typeof url === 'string') {
    urlString = url;
  } else if (url instanceof URL) {
    urlString = url.href;
  } else {
    urlString = url.url;
  }
  fetchCalls.push({
    url: urlString,
    options: options ?? {},
  });
  return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
}

describe('Remote export opt-in verification', () => {
  beforeEach(() => {
    // Reset state
    resetTelemetryClient();
    fetchCalls = [];
    global.fetch = mockFetch as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    resetTelemetryClient();
  });

  it('should not make remote calls when telemetry is disabled', async () => {
    const config: TelemetryConfig = {
      enabled: false,
      mode: 'disabled',
      redactContent: true,
    };

    const client = createTelemetryClient(config);
    await client.init(config);

    client.sessionStart('test-session', { command: 'analyse', hasConfig: true });
    client.trackTool('test-session', 'test_tool', 100, true);
    client.sessionEnd('test-session', {
      durationMs: 1000,
      toolCallCount: 1,
      findingCount: 0,
      success: true,
    });

    await client.flush();
    await client.shutdown();

    expect(fetchCalls).toHaveLength(0);
  });

  it('should not make remote calls in alpha mode (uses proxy)', async () => {
    const config: TelemetryConfig = {
      enabled: true,
      mode: 'alpha',
      redactContent: true,
    };

    const client = createTelemetryClient(config);
    await client.init(config);

    client.sessionStart('test-session', { command: 'analyse', hasConfig: true });
    client.sessionEnd('test-session', {
      durationMs: 1000,
      toolCallCount: 0,
      findingCount: 0,
      success: true,
    });

    // Flush without waiting - alpha mode batches internally
    await client.shutdown();

    // Alpha mode sends to proxy, not direct OTLP
    // This test just ensures no OTLP endpoint calls happen
    const otlpCalls = fetchCalls.filter((call) => call.url.includes('/v1/traces'));
    expect(otlpCalls).toHaveLength(0);
  });

  it('should not make remote calls in otel mode without endpoint', async () => {
    const config: TelemetryConfig = {
      enabled: true,
      mode: 'otel',
      redactContent: true,
      // No endpoint specified
    };

    const client = createTelemetryClient(config);
    await client.init(config);

    client.sessionStart('test-session', { command: 'analyse', hasConfig: true });
    client.sessionEnd('test-session', {
      durationMs: 1000,
      toolCallCount: 0,
      findingCount: 0,
      success: true,
    });

    await client.flush();
    await client.shutdown();

    expect(fetchCalls).toHaveLength(0);
  });

  it('should make remote calls ONLY when otel mode is enabled with endpoint', async () => {
    const config: TelemetryConfig = {
      enabled: true,
      mode: 'otel',
      endpoint: 'http://localhost:4318/v1/traces',
      redactContent: true,
    };

    const client = createTelemetryClient(config);
    await client.init(config);

    client.sessionStart('test-session', { command: 'analyse', hasConfig: true });
    client.sessionEnd('test-session', {
      durationMs: 1000,
      toolCallCount: 0,
      findingCount: 0,
      success: true,
    });

    await client.flush();
    await client.shutdown();

    // Should have made exactly one call to the OTLP endpoint
    expect(fetchCalls.length).toBeGreaterThan(0);
    expect(fetchCalls[0]?.url).toBe('http://localhost:4318/v1/traces');
    expect(fetchCalls[0]?.options.method).toBe('POST');
  });

  it('should respect AGENTLINT_TELEMETRY environment variable', () => {
    const originalEnv = process.env['AGENTLINT_TELEMETRY'];

    try {
      // Test disabled
      delete process.env['AGENTLINT_TELEMETRY'];
      resetTelemetryClient();

      let client = getTelemetryClient();
      expect(client.isEnabled()).toBe(false);

      // Test alpha mode
      process.env['AGENTLINT_TELEMETRY'] = 'alpha';
      resetTelemetryClient();

      client = getTelemetryClient();
      expect(client.isEnabled()).toBe(true);
      expect(client.mode).toBe('alpha');

      // Test otel mode
      process.env['AGENTLINT_TELEMETRY'] = 'otel';
      resetTelemetryClient();

      client = getTelemetryClient();
      // OTEL mode requires endpoint to be truly enabled
      // Without endpoint, it initializes but doesn't send
      expect(client.mode).toBe('otel');
    } finally {
      if (originalEnv !== undefined) {
        process.env['AGENTLINT_TELEMETRY'] = originalEnv;
      } else {
        delete process.env['AGENTLINT_TELEMETRY'];
      }
      resetTelemetryClient();
    }
  });

  it('should not send data before user consent', async () => {
    const config: TelemetryConfig = {
      enabled: true,
      mode: 'otel',
      endpoint: 'http://localhost:4318/v1/traces',
      redactContent: true,
    };

    const client = createTelemetryClient(config);
    await client.init(config);

    // All operations happen after init, which validates consent
    // This test verifies init doesn't send telemetry itself
    expect(fetchCalls).toHaveLength(0);

    await client.shutdown();
  });
});
