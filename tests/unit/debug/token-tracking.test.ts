/**
 * EP11 Quality & Security - Token Usage Tracking Unit Tests
 *
 * Unit tests for token and latency tracking functionality.
 * Tests usage metrics collection, aggregation, and reporting.
 *
 * @module tests/unit/debug/token-tracking
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createTokenTracker,
  type LLMCallMetrics,
  type ITokenTracker,
} from '../../../src/debug/metrics';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestCall(
  callId: string,
  model: string = 'claude-sonnet-4-20250514',
  inputTokens: number = 1000,
  outputTokens: number = 500,
  durationMs: number = 1500,
  cached: boolean = false
): LLMCallMetrics {
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + durationMs);

  return {
    callId,
    model,
    tokens: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
    latency: {
      durationMs,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    },
    cached,
  };
}

// =============================================================================
// Test Setup
// =============================================================================

let tracker: ITokenTracker;

beforeEach(() => {
  tracker = createTokenTracker();
});

// =============================================================================
// Test Suite
// =============================================================================

describe('TokenTracker', () => {
  describe('recordCall', () => {
    test('records a single LLM call', () => {
      const call = createTestCall('call-1');
      tracker.recordCall(call);

      const calls = tracker.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0]!.callId).toBe('call-1');
    });

    test('records multiple calls', () => {
      tracker.recordCall(createTestCall('call-1'));
      tracker.recordCall(createTestCall('call-2'));
      tracker.recordCall(createTestCall('call-3'));

      expect(tracker.getCalls()).toHaveLength(3);
    });

    test('preserves token counts', () => {
      const call = createTestCall('call-1', 'claude-sonnet-4-20250514', 2000, 1000);
      tracker.recordCall(call);

      const recorded = tracker.getCallById('call-1');
      expect(recorded!.tokens.inputTokens).toBe(2000);
      expect(recorded!.tokens.outputTokens).toBe(1000);
      expect(recorded!.tokens.totalTokens).toBe(3000);
    });

    test('preserves latency metrics', () => {
      const call = createTestCall('call-1', 'claude-sonnet-4-20250514', 1000, 500, 2500);
      tracker.recordCall(call);

      const recorded = tracker.getCallById('call-1');
      expect(recorded!.latency.durationMs).toBe(2500);
    });
  });

  describe('getSummary', () => {
    test('returns zero summary for no calls', () => {
      const summary = tracker.getSummary();

      expect(summary.totalCalls).toBe(0);
      expect(summary.totalTokens).toBe(0);
      expect(summary.averageLatencyMs).toBe(0);
      expect(summary.cacheHitRate).toBe(0);
    });

    test('calculates correct totals', () => {
      tracker.recordCall(createTestCall('call-1', 'claude-sonnet-4-20250514', 1000, 500, 1000));
      tracker.recordCall(createTestCall('call-2', 'claude-sonnet-4-20250514', 2000, 800, 2000));
      tracker.recordCall(createTestCall('call-3', 'claude-sonnet-4-20250514', 1500, 700, 1500));

      const summary = tracker.getSummary();

      expect(summary.totalCalls).toBe(3);
      expect(summary.totalInputTokens).toBe(4500); // 1000 + 2000 + 1500
      expect(summary.totalOutputTokens).toBe(2000); // 500 + 800 + 700
      expect(summary.totalTokens).toBe(6500); // 1500 + 2800 + 2200
      expect(summary.totalLatencyMs).toBe(4500); // 1000 + 2000 + 1500
    });

    test('calculates correct average latency', () => {
      tracker.recordCall(createTestCall('call-1', 'claude-sonnet-4-20250514', 1000, 500, 1000));
      tracker.recordCall(createTestCall('call-2', 'claude-sonnet-4-20250514', 1000, 500, 2000));
      tracker.recordCall(createTestCall('call-3', 'claude-sonnet-4-20250514', 1000, 500, 3000));

      const summary = tracker.getSummary();

      expect(summary.averageLatencyMs).toBe(2000); // (1000 + 2000 + 3000) / 3
    });

    test('calculates correct cache hit rate', () => {
      tracker.recordCall(
        createTestCall('call-1', 'claude-sonnet-4-20250514', 1000, 500, 1000, true)
      );
      tracker.recordCall(
        createTestCall('call-2', 'claude-sonnet-4-20250514', 1000, 500, 1000, false)
      );
      tracker.recordCall(
        createTestCall('call-3', 'claude-sonnet-4-20250514', 1000, 500, 1000, true)
      );
      tracker.recordCall(
        createTestCall('call-4', 'claude-sonnet-4-20250514', 1000, 500, 1000, false)
      );

      const summary = tracker.getSummary();

      expect(summary.cacheHitRate).toBe(0.5); // 2 out of 4
    });

    test('groups calls by model', () => {
      tracker.recordCall(createTestCall('call-1', 'claude-sonnet-4-20250514'));
      tracker.recordCall(createTestCall('call-2', 'claude-sonnet-4-20250514'));
      tracker.recordCall(createTestCall('call-3', 'claude-opus-4-5-20251101'));
      tracker.recordCall(createTestCall('call-4', 'claude-haiku-3.5'));

      const summary = tracker.getSummary();

      expect(summary.callsByModel['claude-sonnet-4-20250514']).toBe(2);
      expect(summary.callsByModel['claude-opus-4-5-20251101']).toBe(1);
      expect(summary.callsByModel['claude-haiku-3.5']).toBe(1);
    });
  });

  describe('getTokensPerModel', () => {
    test('aggregates tokens by model', () => {
      tracker.recordCall(createTestCall('call-1', 'claude-sonnet-4-20250514', 1000, 500));
      tracker.recordCall(createTestCall('call-2', 'claude-sonnet-4-20250514', 2000, 800));
      tracker.recordCall(createTestCall('call-3', 'claude-opus-4-5-20251101', 1500, 1000));

      const byModel = tracker.getTokensPerModel();

      expect(byModel['claude-sonnet-4-20250514']!.inputTokens).toBe(3000);
      expect(byModel['claude-sonnet-4-20250514']!.outputTokens).toBe(1300);
      expect(byModel['claude-sonnet-4-20250514']!.totalTokens).toBe(4300);

      expect(byModel['claude-opus-4-5-20251101']!.inputTokens).toBe(1500);
      expect(byModel['claude-opus-4-5-20251101']!.outputTokens).toBe(1000);
      expect(byModel['claude-opus-4-5-20251101']!.totalTokens).toBe(2500);
    });

    test('returns empty object for no calls', () => {
      const byModel = tracker.getTokensPerModel();
      expect(Object.keys(byModel)).toHaveLength(0);
    });
  });

  describe('reset', () => {
    test('clears all recorded calls', () => {
      tracker.recordCall(createTestCall('call-1'));
      tracker.recordCall(createTestCall('call-2'));
      expect(tracker.getCalls()).toHaveLength(2);

      tracker.reset();

      expect(tracker.getCalls()).toHaveLength(0);
      expect(tracker.getSummary().totalCalls).toBe(0);
    });
  });
});

// =============================================================================
// Latency Tracking Tests
// =============================================================================

describe('Latency Tracking', () => {
  test('captures operation timing correctly', () => {
    const startTime = new Date('2026-01-20T10:00:00.000Z');
    const endTime = new Date('2026-01-20T10:00:01.500Z');

    const call: LLMCallMetrics = {
      callId: 'latency-test',
      model: 'claude-sonnet-4-20250514',
      tokens: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
      latency: {
        durationMs: 1500,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
      cached: false,
    };

    tracker.recordCall(call);
    const recorded = tracker.getCallById('latency-test');

    expect(recorded!.latency.durationMs).toBe(1500);
    expect(
      new Date(recorded!.latency.endTime).getTime() -
        new Date(recorded!.latency.startTime).getTime()
    ).toBe(1500);
  });

  test('cached calls have lower latency impact', () => {
    tracker.recordCall(
      createTestCall('uncached', 'claude-sonnet-4-20250514', 1000, 500, 1500, false)
    );
    tracker.recordCall(createTestCall('cached', 'claude-sonnet-4-20250514', 1000, 500, 50, true));

    const uncached = tracker.getCallById('uncached');
    const cached = tracker.getCallById('cached');

    expect(uncached!.latency.durationMs).toBeGreaterThan(cached!.latency.durationMs);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  test('handles zero token calls', () => {
    const call = createTestCall('zero-tokens', 'claude-sonnet-4-20250514', 0, 0, 100);
    tracker.recordCall(call);

    const summary = tracker.getSummary();
    expect(summary.totalTokens).toBe(0);
    expect(summary.totalCalls).toBe(1);
  });

  test('handles very large token counts', () => {
    const call = createTestCall('large-tokens', 'claude-sonnet-4-20250514', 100000, 50000, 30000);
    tracker.recordCall(call);

    const summary = tracker.getSummary();
    expect(summary.totalInputTokens).toBe(100000);
    expect(summary.totalOutputTokens).toBe(50000);
    expect(summary.totalTokens).toBe(150000);
  });

  test('handles many models', () => {
    const models = [
      'claude-sonnet-4-20250514',
      'claude-opus-4-5-20251101',
      'claude-haiku-3.5',
      'claude-instant-1.2',
      'gpt-4',
    ];

    models.forEach((model, i) => {
      tracker.recordCall(createTestCall(`call-${i}`, model));
    });

    const summary = tracker.getSummary();
    expect(Object.keys(summary.callsByModel)).toHaveLength(5);
  });
});
