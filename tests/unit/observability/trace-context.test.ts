import { describe, it, expect } from 'bun:test';
import { TraceContextProvider, type SpanExporter } from '../../../src/observability/trace-context';
import type { ExportableSpan } from '../../../src/observability/exporters/local-exporter';

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

  it('should isolate context between concurrent executions', async () => {
    const provider = new TraceContextProvider();
    const traceIds: string[] = [];

    // Start 3 concurrent trace contexts
    await Promise.all([
      provider.run(async () => {
        const ctx = provider.getContext();
        traceIds.push(ctx!.traceId);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }),
      provider.run(async () => {
        const ctx = provider.getContext();
        traceIds.push(ctx!.traceId);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }),
      provider.run(async () => {
        const ctx = provider.getContext();
        traceIds.push(ctx!.traceId);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }),
    ]);

    // All trace IDs should be unique (no cross-contamination)
    expect(new Set(traceIds).size).toBe(3);
  });

  it('should handle nested async operations', async () => {
    const provider = new TraceContextProvider();

    await provider.run(async () => {
      const outerCtx = provider.getContext();

      await provider.withSpan({ name: 'level-1' }, async () => {
        const level1Ctx = provider.getContext();
        expect(level1Ctx?.traceId).toBe(outerCtx?.traceId);
        expect(level1Ctx?.parentSpanId).toBe(outerCtx?.spanId);

        await provider.withSpan({ name: 'level-2' }, async () => {
          const level2Ctx = provider.getContext();
          expect(level2Ctx?.traceId).toBe(outerCtx?.traceId);
          expect(level2Ctx?.parentSpanId).toBe(level1Ctx?.spanId);
        });
      });
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

  describe('Span Export', () => {
    it('should export completed spans when exporter is registered', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await provider.withSpan({ name: 'test-span' }, async (span) => {
          span.setAttribute('test.key', 'test-value');
          span.addEvent('test-event');
        });
      });

      expect(exportedSpans).toHaveLength(1);
      expect(exportedSpans[0]!.name).toBe('test-span');
      expect(exportedSpans[0]!.status.code).toBe('ok');
      expect(exportedSpans[0]!.attributes['test.key']).toBe('test-value');
      expect(exportedSpans[0]!.events).toHaveLength(1);
      expect(exportedSpans[0]!.events[0]!.name).toBe('test-event');
    });

    it('should export spans with error status when span fails', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        try {
          await provider.withSpan({ name: 'failing-span' }, async () => {
            throw new Error('Test error');
          });
        } catch {
          // Expected error
        }
      });

      expect(exportedSpans).toHaveLength(1);
      expect(exportedSpans[0]!.name).toBe('failing-span');
      expect(exportedSpans[0]!.status.code).toBe('error');
      expect(exportedSpans[0]!.status.message).toBe('Test error');
    });

    it('should not export spans when no exporter is registered', async () => {
      const provider = new TraceContextProvider();

      // Should not throw even without exporter
      await provider.run(async () => {
        await provider.withSpan({ name: 'test-span' }, async (span) => {
          span.setAttribute('test.key', 'test-value');
        });
      });
    });

    it('should calculate span duration correctly', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await provider.withSpan({ name: 'timed-span' }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });
      });

      expect(exportedSpans).toHaveLength(1);
      const span = exportedSpans[0]!;
      expect(span.durationMs).toBeGreaterThanOrEqual(40); // Allow 10ms variance for CI
      expect(span.endTime).toBeGreaterThan(span.startTime);
      expect(span.endTime - span.startTime).toBe(span.durationMs);
    });

    it('should preserve parent span ID in exported spans', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        const parentCtx = provider.getContext();
        expect(parentCtx).toBeDefined();

        await provider.withSpan({ name: 'child-span' }, async () => {
          // Child span work
        });

        expect(exportedSpans).toHaveLength(1);
        expect(exportedSpans[0]!.parentSpanId).toBe(parentCtx!.spanId);
        expect(exportedSpans[0]!.traceId).toBe(parentCtx!.traceId);
      });
    });

    it('should export multiple nested spans', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await provider.withSpan({ name: 'parent' }, async () => {
          await provider.withSpan({ name: 'child-1' }, async () => {
            // Child 1 work
          });

          await provider.withSpan({ name: 'child-2' }, async () => {
            // Child 2 work
          });
        });
      });

      expect(exportedSpans).toHaveLength(3);
      expect(exportedSpans.map((s) => s.name)).toEqual(['child-1', 'child-2', 'parent']);
    });

    it('should export spans without exporter registered', async () => {
      const provider = new TraceContextProvider();

      // Should not throw when no exporter is registered
      await expect(async () => {
        await provider.withSpan({ name: 'test-span' }, async (span) => {
          span.setAttribute('key', 'value');
          span.addEvent('event');
        });
      }).not.toThrow();
    });
  });

  describe('ActiveSpan API', () => {
    it('should support adding events to spans', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await provider.withSpan({ name: 'test-span' }, async (span) => {
          span.addEvent('event-1');
          span.addEvent('event-2', { detail: 'extra-info' });
        });
      });

      expect(exportedSpans[0]!.events).toHaveLength(2);
      expect(exportedSpans[0]!.events[0]!.name).toBe('event-1');
      expect(exportedSpans[0]!.events[1]!.name).toBe('event-2');
      expect(exportedSpans[0]!.events[1]!.attributes).toEqual({ detail: 'extra-info' });
    });

    it('should support setting multiple attributes', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await provider.withSpan({ name: 'test-span' }, async (span) => {
          span.setAttribute('string-attr', 'value');
          span.setAttribute('number-attr', 42);
          span.setAttribute('boolean-attr', true);
        });
      });

      expect(exportedSpans[0]!.attributes).toEqual({
        'string-attr': 'value',
        'number-attr': 42,
        'boolean-attr': true,
      });
    });

    it('should preserve initial attributes from options', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await provider.withSpan(
          { name: 'test-span', attributes: { initial: 'value' } },
          async (span) => {
            span.setAttribute('added', 'later');
          }
        );
      });

      expect(exportedSpans[0]!.attributes).toEqual({
        initial: 'value',
        added: 'later',
      });
    });
  });

  describe('createChildContext', () => {
    it('should create child context from current context', async () => {
      const provider = new TraceContextProvider();

      await provider.run(async () => {
        const parentCtx = provider.getContext();
        const childCtx = provider.createChildContext();

        expect(childCtx.traceId).toBe(parentCtx!.traceId);
        expect(childCtx.parentSpanId).toBe(parentCtx!.spanId);
        expect(childCtx.spanId).not.toBe(parentCtx!.spanId);
      });
    });

    it('should create root context when no parent', () => {
      const provider = new TraceContextProvider();
      const ctx = provider.createChildContext();

      expect(ctx.traceId).toHaveLength(32);
      expect(ctx.spanId).toHaveLength(16);
      expect(ctx.parentSpanId).toBeUndefined();
      expect(ctx.traceFlags).toBe(1);
    });
  });

  describe('clearExporter', () => {
    it('should clear registered exporter', async () => {
      const provider = new TraceContextProvider();
      const exportedSpans: ExportableSpan[] = [];

      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);
      provider.clearExporter();

      await provider.run(async () => {
        await provider.withSpan({ name: 'test-span' }, async () => {
          // Span work
        });
      });

      // No spans should be exported after clearing
      expect(exportedSpans).toHaveLength(0);
    });
  });
});
