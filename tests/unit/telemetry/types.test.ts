import { describe, it, expect } from 'bun:test';

describe('Telemetry Types', () => {
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
});
