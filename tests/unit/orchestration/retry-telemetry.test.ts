/**
 * EP02 Orchestration Core - Retry Telemetry Tests
 *
 * Tests for retry telemetry tracking:
 * - Tracking retry attempts with success/failure outcomes
 * - Recording retry timing information
 * - Retrieving retry statistics
 */

import { describe, test, expect } from 'bun:test';
import { withRetry, type RetryTelemetryTracker } from '../../../src/orchestration/retry';

// =============================================================================
// Test Fixtures
// =============================================================================

class MockTelemetryTracker implements RetryTelemetryTracker {
  private attempts: Array<{
    operationType: string;
    attemptNumber: number;
    success: boolean;
    retryTimeMs: number;
  }> = [];

  trackRetryAttempt(
    operationType: string,
    attemptNumber: number,
    success: boolean,
    retryTimeMs: number
  ): void {
    this.attempts.push({ operationType, attemptNumber, success, retryTimeMs });
  }

  getAttempts() {
    return [...this.attempts];
  }

  reset() {
    this.attempts = [];
  }
}

// =============================================================================
// Retry Telemetry Tests
// =============================================================================

describe('Retry Telemetry', () => {
  test('tracks successful retry attempt', async () => {
    const tracker = new MockTelemetryTracker();
    let callCount = 0;

    const fn = async () => {
      callCount++;
      if (callCount === 1) {
        const error = new Error('Rate limit exceeded') as Error & { status?: number };
        error.status = 429;
        throw error;
      }
      return 'success';
    };

    await withRetry(
      fn,
      { maxRetries: 3, initialDelayMs: 10, maxDelayMs: 50 },
      undefined,
      'api_call',
      tracker
    );

    const attempts = tracker.getAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.operationType).toBe('api_call');
    expect(attempts[0]!.attemptNumber).toBe(2); // Second attempt (first retry)
    expect(attempts[0]!.success).toBe(true);
    expect(attempts[0]!.retryTimeMs).toBeGreaterThanOrEqual(0); // Can be 0 for very fast operations
  });

  test('tracks failed retry attempts', async () => {
    const tracker = new MockTelemetryTracker();
    let _callCount = 0;

    const fn = async () => {
      _callCount++;
      const error = new Error('Service unavailable') as Error & { status?: number };
      error.status = 503;
      throw error;
    };

    await expect(
      withRetry(
        fn,
        { maxRetries: 2, initialDelayMs: 10, maxDelayMs: 50 },
        undefined,
        'api_call',
        tracker
      )
    ).rejects.toThrow();

    const attempts = tracker.getAttempts();
    expect(attempts).toHaveLength(2); // Two failed retry attempts
    expect(attempts[0]!.operationType).toBe('api_call');
    expect(attempts[0]!.attemptNumber).toBe(2);
    expect(attempts[0]!.success).toBe(false);
    expect(attempts[1]!.attemptNumber).toBe(3);
    expect(attempts[1]!.success).toBe(false);
  });

  test('tracks multiple operations separately', async () => {
    const tracker = new MockTelemetryTracker();

    // First operation - succeeds after one retry
    let callCount1 = 0;
    const fn1 = async () => {
      callCount1++;
      if (callCount1 === 1) {
        const error = new Error('Timeout') as Error & { code?: string };
        error.code = 'ETIMEDOUT';
        throw error;
      }
      return 'success';
    };

    await withRetry(fn1, { maxRetries: 2, initialDelayMs: 10 }, undefined, 'llm_call', tracker);

    // Second operation - succeeds after one retry
    let callCount2 = 0;
    const fn2 = async () => {
      callCount2++;
      if (callCount2 === 1) {
        const error = new Error('Connection reset') as Error & { code?: string };
        error.code = 'ECONNRESET';
        throw error;
      }
      return 'success';
    };

    await withRetry(
      fn2,
      { maxRetries: 2, initialDelayMs: 10 },
      undefined,
      'tool_execution',
      tracker
    );

    const attempts = tracker.getAttempts();
    expect(attempts).toHaveLength(2);
    expect(attempts[0]!.operationType).toBe('llm_call');
    expect(attempts[1]!.operationType).toBe('tool_execution');
  });

  test('does not track first attempt (not a retry)', async () => {
    const tracker = new MockTelemetryTracker();

    const fn = async () => 'success';

    await withRetry(fn, { maxRetries: 2 }, undefined, 'api_call', tracker);

    const attempts = tracker.getAttempts();
    expect(attempts).toHaveLength(0); // No retries occurred
  });

  test('does not track when telemetry tracker is not provided', async () => {
    let callCount = 0;

    const fn = async () => {
      callCount++;
      if (callCount === 1) {
        const error = new Error('Rate limit') as Error & { status?: number };
        error.status = 429;
        throw error;
      }
      return 'success';
    };

    // Should not throw even without tracker
    await withRetry(fn, { maxRetries: 2, initialDelayMs: 10 });

    expect(callCount).toBe(2); // Retry occurred
  });

  test('records timing for each retry attempt', async () => {
    const tracker = new MockTelemetryTracker();
    let callCount = 0;

    const fn = async () => {
      callCount++;
      if (callCount <= 2) {
        const error = new Error('Service unavailable') as Error & { status?: number };
        error.status = 503;
        throw error;
      }
      return 'success';
    };

    await withRetry(
      fn,
      { maxRetries: 3, initialDelayMs: 10, maxDelayMs: 50 },
      undefined,
      'api_call',
      tracker
    );

    const attempts = tracker.getAttempts();
    expect(attempts).toHaveLength(2); // Two failed attempts, one success

    // Each attempt should have a non-negative duration (can be 0 for very fast operations)
    for (const attempt of attempts) {
      expect(attempt.retryTimeMs).toBeGreaterThanOrEqual(0);
    }

    // Later attempts should take at least as long (exponential backoff)
    // Note: This is approximate due to jitter
    expect(attempts[1]!.retryTimeMs).toBeGreaterThanOrEqual(attempts[0]!.retryTimeMs);
  });

  test('does not track non-retryable errors', async () => {
    const tracker = new MockTelemetryTracker();

    const fn = async () => {
      throw new Error('Non-retryable error');
    };

    await expect(
      withRetry(fn, { maxRetries: 3, initialDelayMs: 10 }, undefined, 'api_call', tracker)
    ).rejects.toThrow();

    const attempts = tracker.getAttempts();
    expect(attempts).toHaveLength(0); // No retries for non-retryable errors
  });

  test('includes operation type in tracking', async () => {
    const tracker = new MockTelemetryTracker();
    let callCount = 0;

    const fn = async () => {
      callCount++;
      if (callCount === 1) {
        const error = new Error('Overloaded') as Error & { message: string };
        error.message = 'overloaded';
        throw error;
      }
      return 'success';
    };

    await withRetry(
      fn,
      { maxRetries: 2, initialDelayMs: 10 },
      undefined,
      'custom_operation',
      tracker
    );

    const attempts = tracker.getAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.operationType).toBe('custom_operation');
  });
});
