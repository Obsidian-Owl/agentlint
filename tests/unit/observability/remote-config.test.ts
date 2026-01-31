/**
 * EP22 US-005 T054: Remote export disabled by default
 * Verify remote telemetry is opt-in only.
 */

import { describe, it, expect } from 'bun:test';

/**
 * Helper to manage environment variable state across tests.
 * Backs up specified env vars, allows modification, and restores on cleanup.
 */
function withEnv(
  vars: string[],
  setup: () => void,
  test: () => void | Promise<void>
): void | Promise<void> {
  const backup = new Map<string, string | undefined>();

  // Backup current values
  for (const key of vars) {
    backup.set(key, process.env[key]);
  }

  try {
    setup();
    return test();
  } finally {
    // Restore original values
    for (const [key, value] of backup) {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
  }
}

/**
 * Helper to get fresh telemetry config after env changes.
 * Forces module reload to pick up new environment.
 */
function getFreshConfig(): { enabled: boolean; mode: string; endpoint?: string } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getTelemetryConfig } = require('../../../src/telemetry') as {
    getTelemetryConfig: () => { enabled: boolean; mode: string; endpoint?: string };
  };
  return getTelemetryConfig();
}

/**
 * Helper to assert config is disabled.
 */
function expectDisabled(config: ReturnType<typeof getFreshConfig>) {
  expect(config.enabled).toBe(false);
  expect(config.mode).toBe('disabled');
}

describe('Remote export configuration', () => {
  it('should be disabled by default (no env vars)', async () => {
    await withEnv(
      ['AGENTLINT_TELEMETRY', 'AGENTLINT_OTLP_ENDPOINT'],
      () => {
        delete process.env['AGENTLINT_TELEMETRY'];
        delete process.env['AGENTLINT_OTLP_ENDPOINT'];
      },
      () => {
        const config = getFreshConfig();
        expectDisabled(config);
      }
    );
  });

  it('should not enable OTLP mode without AGENTLINT_TELEMETRY=otel', async () => {
    await withEnv(
      ['AGENTLINT_TELEMETRY', 'AGENTLINT_OTLP_ENDPOINT'],
      () => {
        delete process.env['AGENTLINT_TELEMETRY'];
        process.env['AGENTLINT_OTLP_ENDPOINT'] = 'http://localhost:4318/v1/traces';
      },
      () => {
        const config = getFreshConfig();
        expectDisabled(config);
      }
    );
  });

  it('should enable OTLP mode when AGENTLINT_TELEMETRY=otel', async () => {
    await withEnv(
      ['AGENTLINT_TELEMETRY', 'AGENTLINT_OTLP_ENDPOINT'],
      () => {
        process.env['AGENTLINT_TELEMETRY'] = 'otel';
        process.env['AGENTLINT_OTLP_ENDPOINT'] = 'http://localhost:4318/v1/traces';
      },
      () => {
        const config = getFreshConfig();
        expect(config.enabled).toBe(true);
        expect(config.mode).toBe('otel');
        expect(config.endpoint).toBe('http://localhost:4318/v1/traces');
      }
    );
  });

  it('should use OTEL_EXPORTER_OTLP_ENDPOINT when AGENTLINT_OTLP_ENDPOINT not set', async () => {
    await withEnv(
      ['AGENTLINT_TELEMETRY', 'AGENTLINT_OTLP_ENDPOINT', 'OTEL_EXPORTER_OTLP_ENDPOINT'],
      () => {
        process.env['AGENTLINT_TELEMETRY'] = 'otel';
        delete process.env['AGENTLINT_OTLP_ENDPOINT'];
        process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://otel-collector:4318';
      },
      () => {
        const config = getFreshConfig();
        expect(config.enabled).toBe(true);
        expect(config.mode).toBe('otel');
        expect(config.endpoint).toBe('http://otel-collector:4318');
      }
    );
  });
});
