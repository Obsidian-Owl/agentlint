/**
 * Tests for telemetry client functionality.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  getTelemetryClient,
  createTelemetryClient,
  resetTelemetryClient,
  isTelemetryEnabled,
  getTelemetryMode,
  getTelemetryConfig,
} from '../../../src/telemetry';

describe('Telemetry Client', () => {
  // Save original env
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetTelemetryClient();
    // Clear ALL telemetry env vars to prevent test pollution
    delete process.env['AGENTLINT_TELEMETRY'];
    delete process.env['AGENTLINT_TELEMETRY_DEBUG'];
    delete process.env['AGENTLINT_OTLP_ENDPOINT'];
    delete process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
  });

  afterEach(() => {
    resetTelemetryClient();
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('isTelemetryEnabled', () => {
    test('returns false by default', () => {
      expect(isTelemetryEnabled()).toBe(false);
    });

    test('returns true when AGENTLINT_TELEMETRY=1', () => {
      process.env['AGENTLINT_TELEMETRY'] = '1';
      expect(isTelemetryEnabled()).toBe(true);
    });

    test('returns true when AGENTLINT_TELEMETRY=alpha', () => {
      process.env['AGENTLINT_TELEMETRY'] = 'alpha';
      expect(isTelemetryEnabled()).toBe(true);
    });

    test('returns true when AGENTLINT_TELEMETRY=otel', () => {
      process.env['AGENTLINT_TELEMETRY'] = 'otel';
      expect(isTelemetryEnabled()).toBe(true);
    });

    test('returns false for invalid values', () => {
      process.env['AGENTLINT_TELEMETRY'] = 'true';
      expect(isTelemetryEnabled()).toBe(false);

      process.env['AGENTLINT_TELEMETRY'] = 'yes';
      expect(isTelemetryEnabled()).toBe(false);
    });
  });

  describe('getTelemetryMode', () => {
    test('returns disabled by default', () => {
      expect(getTelemetryMode()).toBe('disabled');
    });

    test('returns alpha when AGENTLINT_TELEMETRY=1', () => {
      process.env['AGENTLINT_TELEMETRY'] = '1';
      expect(getTelemetryMode()).toBe('alpha');
    });

    test('returns alpha when AGENTLINT_TELEMETRY=alpha', () => {
      process.env['AGENTLINT_TELEMETRY'] = 'alpha';
      expect(getTelemetryMode()).toBe('alpha');
    });

    test('returns otel when AGENTLINT_TELEMETRY=otel', () => {
      process.env['AGENTLINT_TELEMETRY'] = 'otel';
      expect(getTelemetryMode()).toBe('otel');
    });
  });

  describe('getTelemetryConfig', () => {
    test('returns disabled config by default', () => {
      const config = getTelemetryConfig();
      expect(config.enabled).toBe(false);
      expect(config.mode).toBe('disabled');
      expect(config.redactContent).toBe(true);
    });

    test('returns enabled alpha config when env is set', () => {
      process.env['AGENTLINT_TELEMETRY'] = 'alpha';
      const config = getTelemetryConfig();
      expect(config.enabled).toBe(true);
      expect(config.mode).toBe('alpha');
      expect(config.redactContent).toBe(true);
    });

    test('includes OTEL endpoint when set', () => {
      process.env['AGENTLINT_TELEMETRY'] = 'otel';
      process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://localhost:4318';
      const config = getTelemetryConfig();
      expect(config.endpoint).toBe('http://localhost:4318');
    });
  });

  describe('createTelemetryClient', () => {
    test('creates NoOpTelemetryClient when disabled', () => {
      const client = createTelemetryClient({
        enabled: false,
        mode: 'disabled',
        redactContent: true,
      });
      expect(client.isEnabled()).toBe(false);
      expect(client.mode).toBe('disabled');
    });

    test('creates AlphaTelemetryClient when alpha mode', () => {
      const client = createTelemetryClient({
        enabled: true,
        mode: 'alpha',
        redactContent: true,
      });
      expect(client.mode).toBe('alpha');
    });

    test('creates OtelTelemetryClient when otel mode', () => {
      const client = createTelemetryClient({
        enabled: true,
        mode: 'otel',
        redactContent: true,
      });
      expect(client.mode).toBe('otel'); // EP22 US-005: OTEL mode now supported
    });
  });

  describe('getTelemetryClient', () => {
    test('returns same instance on multiple calls', () => {
      const client1 = getTelemetryClient();
      const client2 = getTelemetryClient();
      expect(client1).toBe(client2);
    });

    test('resets when resetTelemetryClient is called', async () => {
      const client1 = getTelemetryClient();
      resetTelemetryClient();
      const client2 = getTelemetryClient();
      expect(client1).not.toBe(client2);
    });
  });

  describe('NoOpTelemetryClient', () => {
    test('all methods are no-ops', async () => {
      const client = createTelemetryClient({
        enabled: false,
        mode: 'disabled',
        redactContent: true,
      });

      // These should not throw
      client.sessionStart('test-session');
      client.trackTool('test-session', 'tool', 100, true);
      client.trackFinding('test-session', 'config_missing', 'warning');
      client.trackLLM('test-session', 'claude', 100, 50);
      client.trackError('test-session', 'TestError');
      client.sessionEnd('test-session', {
        durationMs: 1000,
        toolCallCount: 5,
        findingCount: 2,
        success: true,
      });
      await client.flush();
      await client.shutdown();

      expect(client.isEnabled()).toBe(false);
    });
  });

  describe('AlphaTelemetryClient', () => {
    test('isEnabled returns true when initialized', async () => {
      const client = createTelemetryClient({
        enabled: true,
        mode: 'alpha',
        redactContent: true,
      });
      await client.init({
        enabled: true,
        mode: 'alpha',
        redactContent: true,
      });
      expect(client.isEnabled()).toBe(true);
      await client.shutdown();
    });

    test('tracks session lifecycle', async () => {
      const client = createTelemetryClient({
        enabled: true,
        mode: 'alpha',
        redactContent: true,
      });
      await client.init({
        enabled: true,
        mode: 'alpha',
        redactContent: true,
      });

      // These should not throw
      client.sessionStart('test-session', { command: 'analyse', hasConfig: true });
      client.trackTool('test-session', 'discover_configs', 150, true);
      client.trackFinding('test-session', 'config_missing', 'warning');
      client.trackLLM('test-session', 'claude', 100, 50, 500);
      client.sessionEnd('test-session', {
        durationMs: 5000,
        toolCallCount: 10,
        findingCount: 3,
        success: true,
      });

      await client.shutdown();
    });
  });
});
