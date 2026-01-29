import { describe, it, expect, beforeEach } from 'bun:test';
import { AlphaTelemetryClient } from '../../../src/telemetry/alpha-client';
import { traceContextProvider } from '../../../src/observability/trace-context';
import type { TelemetryEvent } from '../../../src/telemetry/events';

/**
 * T033: Test that AlphaTelemetryClient injects trace_id into events when inside TraceContextProvider.run()
 */

describe('AlphaTelemetryClient Trace Injection', () => {
  let client: AlphaTelemetryClient;

  beforeEach(async () => {
    client = new AlphaTelemetryClient();
    // Enable the client for testing
    await client.init({ enabled: true, mode: 'alpha', redactContent: true });
  });

  /**
   * Helper to create a minimal telemetry event
   */
  function createTestEvent(): TelemetryEvent {
    return {
      type: 'session.start',
      timestamp: new Date().toISOString(),
      startTime: Date.now(),
      endTime: Date.now(),
      sessionId: 'test-session',
      eventId: 'test-event',
      sequence: 0,
      data: { test: 'data' },
      meta: {
        version: '1.0.0',
        platform: 'test',
        nodeVersion: 'v20',
        source: 'test',
      },
    };
  }

  it('should inject traceId when inside TraceContextProvider.run()', async () => {
    await traceContextProvider.run(async () => {
      const ctx = traceContextProvider.getContext();
      expect(ctx).toBeDefined();

      const event = createTestEvent();
      client.record(event);

      // Should have traceId injected
      expect(event.traceId).toBe(ctx?.traceId);
    });
  });

  it('should not inject traceId when outside TraceContextProvider', () => {
    // No trace context active
    expect(traceContextProvider.getContext()).toBeUndefined();

    const event = createTestEvent();
    client.record(event);

    // Should not have traceId
    expect(event.traceId).toBeUndefined();
  });

  it('should inject same traceId for multiple events in same trace', async () => {
    await traceContextProvider.run(async () => {
      const ctx = traceContextProvider.getContext();

      const event1 = createTestEvent();
      const event2 = createTestEvent();

      client.record(event1);
      client.record(event2);

      // Both should have same traceId
      expect(event1.traceId).toBe(ctx?.traceId);
      expect(event2.traceId).toBe(ctx?.traceId);
    });
  });

  it('should maintain traceId across nested spans', async () => {
    await traceContextProvider.run(async () => {
      const rootCtx = traceContextProvider.getContext();

      await traceContextProvider.withSpan({ name: 'child' }, async (_span) => {
        const event = createTestEvent();
        client.record(event);

        // Should have root traceId (traceId is constant across all spans in a trace)
        expect(event.traceId).toBe(rootCtx?.traceId);
      });
    });
  });
});
