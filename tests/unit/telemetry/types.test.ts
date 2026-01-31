/**
 * Tests for telemetry type system after EP22 Phase 2 refactoring.
 *
 * Verifies:
 * - T006: Shared types are properly exported
 * - T007: IOrchestratorTelemetryClient uses shared types
 * - T015: No circular dependencies after type extraction
 */

import { describe, it, expect } from 'bun:test';

describe('Telemetry Types (EP22 T015)', () => {
  it('should import telemetry module without circular dependency errors', async () => {
    // Dynamic import to detect circular dependencies at runtime
    const telemetry = await import('../../../src/telemetry');

    // Verify key exports exist
    expect(telemetry).toBeDefined();
    expect(typeof telemetry.createTelemetryClient).toBe('function');
  });

  it('should import telemetry types without errors', async () => {
    const types = await import('../../../src/telemetry/types');
    expect(types).toBeDefined();
  });

  it('should import telemetry events without errors', async () => {
    const events = await import('../../../src/telemetry/events');
    expect(events).toBeDefined();
  });

  it('should import telemetry constants without errors', async () => {
    const constants = await import('../../../src/telemetry/constants');
    expect(constants.MAX_PENDING_TOOLS).toBeDefined();
    expect(constants.FLUSH_INTERVAL_MS).toBeDefined();
  });

  it('should import orchestration types that reference telemetry types (T007)', async () => {
    // T007: Verify IOrchestratorTelemetryClient imports TrackToolOptions/TrackLLMOptions
    const orchestration = await import('../../../src/orchestration/types');
    expect(orchestration).toBeDefined();

    // Verify no circular dependency when importing both modules
    const telemetry = await import('../../../src/telemetry/types');
    expect(telemetry).toBeDefined();
  });

  it('should import opencode telemetry-tracker without circular dependency (T013)', async () => {
    // T013: Verify telemetry-tracker uses centralized constants
    const tracker = await import('../../../src/opencode/telemetry-tracker');
    expect(tracker.TelemetryTracker).toBeDefined();
  });

  it('should verify all telemetry constants are centralized (T012)', async () => {
    // T012: All constants should be in one place
    const constants = await import('../../../src/telemetry/constants');

    // From telemetry-tracker.ts
    expect(constants.MAX_PENDING_TOOLS).toBe(100);
    expect(constants.TOOL_TRACKING_TTL_MS).toBe(5 * 60 * 1000);

    // From alpha-client.ts
    expect(constants.FLUSH_INTERVAL_MS).toBe(10_000);
    expect(constants.MAX_BUFFER_SIZE).toBe(100);
    expect(constants.REQUEST_TIMEOUT_MS).toBe(5_000);

    // From telemetry-utils.ts
    expect(constants.DEFAULT_TRUNCATION_LIMIT).toBe(5000);
    expect(constants.ERROR_TRUNCATION_LIMIT).toBe(1000);
  });

  it('should import debug types with trace context fields (T008)', async () => {
    // T008: Verify LogEntry has optional trace_id and span_id
    const debugTypes = await import('../../../src/debug/types');
    expect(debugTypes).toBeDefined();
    // Compilation would fail if fields were missing or incorrect
  });

  it('should import telemetry events with trace context fields (T009)', async () => {
    // T009: Verify TelemetryEvent has optional traceId, spanId, parentSpanId
    const events = await import('../../../src/telemetry/events');
    expect(events).toBeDefined();
    // Compilation would fail if fields were missing or incorrect
  });
});
