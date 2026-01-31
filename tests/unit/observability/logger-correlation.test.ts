import { describe, it, expect, beforeEach } from 'bun:test';
import { DebugLogger } from '../../../src/debug/logger';
import { traceContextProvider } from '../../../src/observability/trace-context';
import type { LogEntry } from '../../../src/debug/types';

/**
 * T026: Test that DebugLogger auto-injects trace_id/span_id when inside TraceContextProvider.run()
 * and logs work normally (no trace fields) when outside TraceContextProvider.
 */

describe('DebugLogger Trace Correlation', () => {
  let capturedLogs: LogEntry[] = [];

  beforeEach(() => {
    capturedLogs = [];
    // Disable TUI mode for tests
    DebugLogger.setTuiActive(false);
  });

  /**
   * Helper: Create logger that captures log entries instead of writing to console/file
   */
  function createCapturingLogger(): DebugLogger {
    const logger = new DebugLogger({
      level: 'trace',
      namespaces: ['test:*'],
      output: 'console', // We'll override the output method
    });

    // Override the private output method to capture logs
    // @ts-expect-error - accessing private method for testing
    const originalOutput = logger.output.bind(logger);
    // @ts-expect-error - accessing private method for testing
    logger.output = (entry: LogEntry) => {
      capturedLogs.push(entry);
      originalOutput(entry);
    };

    return logger;
  }

  it('should inject trace_id and span_id when inside TraceContextProvider.run()', async () => {
    const logger = createCapturingLogger();

    await traceContextProvider.run(async () => {
      const ctx = traceContextProvider.getContext();
      expect(ctx).toBeDefined();

      logger.info('test:correlation', 'Message with trace context');

      expect(capturedLogs).toHaveLength(1);
      const logEntry = capturedLogs[0]!;

      // Should have trace fields injected
      expect(logEntry.data).toBeDefined();
      expect(logEntry.data?.trace_id).toBe(ctx?.traceId);
      expect(logEntry.data?.span_id).toBe(ctx?.spanId);
    });
  });

  it('should not inject trace fields when outside TraceContextProvider', () => {
    const logger = createCapturingLogger();

    // No trace context active
    expect(traceContextProvider.getContext()).toBeUndefined();

    logger.info('test:correlation', 'Message without trace context');

    expect(capturedLogs).toHaveLength(1);
    const logEntry = capturedLogs[0]!;

    // Should not have trace fields (or data should be undefined)
    if (logEntry.data) {
      expect(logEntry.data.trace_id).toBeUndefined();
      expect(logEntry.data.span_id).toBeUndefined();
    }
  });

  it('should inject parent_span_id when inside nested span', async () => {
    const logger = createCapturingLogger();

    await traceContextProvider.run(async () => {
      const rootCtx = traceContextProvider.getContext();

      await traceContextProvider.withSpan({ name: 'child' }, async (_span) => {
        const childCtx = traceContextProvider.getContext();

        logger.info('test:correlation', 'Nested span message');

        expect(capturedLogs).toHaveLength(1);
        const logEntry = capturedLogs[0]!;

        // Should have trace fields with parent_span_id
        expect(logEntry.data).toBeDefined();
        expect(logEntry.data?.trace_id).toBe(rootCtx?.traceId);
        expect(logEntry.data?.span_id).toBe(childCtx?.spanId);
        expect(logEntry.data?.parent_span_id).toBe(rootCtx?.spanId);
      });
    });
  });

  it('should preserve user data alongside trace fields', async () => {
    const logger = createCapturingLogger();

    await traceContextProvider.run(async () => {
      const ctx = traceContextProvider.getContext();

      logger.info('test:correlation', 'Message with user data', {
        userId: 'test-user',
        action: 'test-action',
      });

      expect(capturedLogs).toHaveLength(1);
      const logEntry = capturedLogs[0]!;

      // Should have both trace fields AND user data
      expect(logEntry.data).toBeDefined();
      expect(logEntry.data?.trace_id).toBe(ctx?.traceId);
      expect(logEntry.data?.span_id).toBe(ctx?.spanId);
      expect(logEntry.data?.userId).toBe('test-user');
      expect(logEntry.data?.action).toBe('test-action');
    });
  });

  it('should work across multiple log calls in same trace', async () => {
    const logger = createCapturingLogger();

    await traceContextProvider.run(async () => {
      const ctx = traceContextProvider.getContext();

      logger.info('test:correlation', 'First message');
      logger.debug('test:correlation', 'Second message');
      logger.warn('test:correlation', 'Third message');

      expect(capturedLogs).toHaveLength(3);

      // All should have same trace_id
      for (const entry of capturedLogs) {
        expect(entry.data?.trace_id).toBe(ctx?.traceId);
        expect(entry.data?.span_id).toBe(ctx?.spanId);
      }
    });
  });

  it('should work with child logger', async () => {
    const logger = createCapturingLogger();
    const childLogger = logger.child('test:child');

    await traceContextProvider.run(async () => {
      const ctx = traceContextProvider.getContext();

      // Use child logger
      childLogger.info('Message from child logger');

      expect(capturedLogs).toHaveLength(1);
      const logEntry = capturedLogs[0]!;

      // Should have trace fields
      expect(logEntry.namespace).toBe('test:child');
      expect(logEntry.data?.trace_id).toBe(ctx?.traceId);
      expect(logEntry.data?.span_id).toBe(ctx?.spanId);
    });
  });
});
