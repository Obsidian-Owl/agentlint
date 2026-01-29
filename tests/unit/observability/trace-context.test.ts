import { describe, it, expect } from 'bun:test';
import { TraceContextProvider } from '../../../src/observability/trace-context';

describe('TraceContextProvider', () => {
  it('should create trace context within run()', async () => {
    const provider = new TraceContextProvider();

    await provider.run(async () => {
      const ctx = provider.getContext();
      expect(ctx).toBeDefined();
      expect(ctx?.traceId).toHaveLength(32);
      expect(ctx?.spanId).toHaveLength(16);
      expect(ctx?.traceFlags).toBe(1);
    });
  });

  it('should return undefined outside of run()', () => {
    const provider = new TraceContextProvider();
    expect(provider.getContext()).toBeUndefined();
  });

  it('should propagate context across async boundaries', async () => {
    const provider = new TraceContextProvider();
    let capturedTraceId: string | undefined;

    await provider.run(async () => {
      const ctx1 = provider.getContext();
      capturedTraceId = ctx1?.traceId;

      await new Promise((resolve) => setTimeout(resolve, 10));

      const ctx2 = provider.getContext();
      expect(ctx2?.traceId).toBe(capturedTraceId);
    });
  });

  it('should create child spans with parent context', async () => {
    const provider = new TraceContextProvider();

    await provider.run(async () => {
      const parentCtx = provider.getContext();

      await provider.withSpan({ name: 'child' }, async (_span) => {
        const childCtx = provider.getContext();
        expect(childCtx?.traceId).toBe(parentCtx?.traceId);
        expect(childCtx?.parentSpanId).toBe(parentCtx?.spanId);
        expect(childCtx?.spanId).not.toBe(parentCtx?.spanId);
      });
    });
  });
});
