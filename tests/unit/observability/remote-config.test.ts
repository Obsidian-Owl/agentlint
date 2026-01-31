/**
 * EP22 US-005 T054: Remote export disabled by default
 * Verify remote telemetry is opt-in only.
 */

import { describe, it, expect } from 'bun:test';

describe('Remote export configuration', () => {
  it('should be disabled by default (no env vars)', () => {
    // Save original env
    const originalTelemetry = process.env['AGENTLINT_TELEMETRY'];
    const originalOtlp = process.env['AGENTLINT_OTLP_ENDPOINT'];

    try {
      // Clear telemetry env vars
      delete process.env['AGENTLINT_TELEMETRY'];
      delete process.env['AGENTLINT_OTLP_ENDPOINT'];

      // Re-import to get fresh config
      const { getTelemetryConfig } = require('../../../src/telemetry');
      const config = getTelemetryConfig();

      expect(config.enabled).toBe(false);
      expect(config.mode).toBe('disabled');
    } finally {
      // Restore original env
      if (originalTelemetry !== undefined) {
        process.env['AGENTLINT_TELEMETRY'] = originalTelemetry;
      }
      if (originalOtlp !== undefined) {
        process.env['AGENTLINT_OTLP_ENDPOINT'] = originalOtlp;
      }
    }
  });

  it('should not enable OTLP mode without AGENTLINT_TELEMETRY=otel', () => {
    const originalTelemetry = process.env['AGENTLINT_TELEMETRY'];
    const originalOtlp = process.env['AGENTLINT_OTLP_ENDPOINT'];

    try {
      delete process.env['AGENTLINT_TELEMETRY'];
      process.env['AGENTLINT_OTLP_ENDPOINT'] = 'http://localhost:4318/v1/traces';

      const { getTelemetryConfig } = require('../../../src/telemetry');
      const config = getTelemetryConfig();

      expect(config.enabled).toBe(false);
      expect(config.mode).toBe('disabled');
    } finally {
      if (originalTelemetry !== undefined) {
        process.env['AGENTLINT_TELEMETRY'] = originalTelemetry;
      }
      if (originalOtlp !== undefined) {
        process.env['AGENTLINT_OTLP_ENDPOINT'] = originalOtlp;
      }
    }
  });

  it('should enable OTLP mode when AGENTLINT_TELEMETRY=otel', () => {
    const originalTelemetry = process.env['AGENTLINT_TELEMETRY'];
    const originalOtlp = process.env['AGENTLINT_OTLP_ENDPOINT'];

    try {
      process.env['AGENTLINT_TELEMETRY'] = 'otel';
      process.env['AGENTLINT_OTLP_ENDPOINT'] = 'http://localhost:4318/v1/traces';

      const { getTelemetryConfig } = require('../../../src/telemetry');
      const config = getTelemetryConfig();

      expect(config.enabled).toBe(true);
      expect(config.mode).toBe('otel');
      expect(config.endpoint).toBe('http://localhost:4318/v1/traces');
    } finally {
      if (originalTelemetry !== undefined) {
        process.env['AGENTLINT_TELEMETRY'] = originalTelemetry;
      } else {
        delete process.env['AGENTLINT_TELEMETRY'];
      }
      if (originalOtlp !== undefined) {
        process.env['AGENTLINT_OTLP_ENDPOINT'] = originalOtlp;
      } else {
        delete process.env['AGENTLINT_OTLP_ENDPOINT'];
      }
    }
  });

  it('should use OTEL_EXPORTER_OTLP_ENDPOINT when AGENTLINT_OTLP_ENDPOINT not set', () => {
    const originalTelemetry = process.env['AGENTLINT_TELEMETRY'];
    const originalOtlp = process.env['AGENTLINT_OTLP_ENDPOINT'];
    const originalStandardOtlp = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];

    try {
      process.env['AGENTLINT_TELEMETRY'] = 'otel';
      delete process.env['AGENTLINT_OTLP_ENDPOINT'];
      process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://otel-collector:4318';

      const { getTelemetryConfig } = require('../../../src/telemetry');
      const config = getTelemetryConfig();

      expect(config.enabled).toBe(true);
      expect(config.mode).toBe('otel');
      expect(config.endpoint).toBe('http://otel-collector:4318');
    } finally {
      if (originalTelemetry !== undefined) {
        process.env['AGENTLINT_TELEMETRY'] = originalTelemetry;
      } else {
        delete process.env['AGENTLINT_TELEMETRY'];
      }
      if (originalOtlp !== undefined) {
        process.env['AGENTLINT_OTLP_ENDPOINT'] = originalOtlp;
      }
      if (originalStandardOtlp !== undefined) {
        process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = originalStandardOtlp;
      } else {
        delete process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
      }
    }
  });
});
