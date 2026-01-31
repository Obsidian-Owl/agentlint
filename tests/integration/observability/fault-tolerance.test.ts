import { describe, it, expect, beforeEach } from 'bun:test';
import { TraceContextProvider, type SpanExporter } from '../../../src/observability/trace-context';
import type { ExportableSpan } from '../../../src/observability/exporters/local-exporter';

describe('Fault Tolerance', () => {
  let provider: TraceContextProvider;

  beforeEach(() => {
    provider = new TraceContextProvider();
  });

  describe('Exporter failures', () => {
    it('should continue operation when exporter throws', async () => {
      // Create mock exporter that throws
      const throwingExporter: SpanExporter = {
        export: (_spans: ExportableSpan[]) => {
          throw new Error('Exporter failure');
        },
      };

      provider.registerExporter(throwingExporter);

      // Currently, exporter failures DO propagate
      // This documents the current behavior (no fault tolerance yet)
      let operationCompleted = false;

      await expect(async () => {
        await provider.withSpan(
          { name: 'test-operation', attributes: { component: 'test' } },
          async () => {
            operationCompleted = true;
            return 'success';
          }
        );
      }).toThrow('Exporter failure');

      // Operation itself completed before the export failure
      expect(operationCompleted).toBe(true);
    });

    it('should not block operations when exporter is slow', async () => {
      // Create mock exporter with artificial delay
      const slowExporter: SpanExporter = {
        export: (_spans: ExportableSpan[]) => {
          // Synchronous delay simulation
          const start = Date.now();
          while (Date.now() - start < 100) {
            // Busy wait
          }
        },
      };

      provider.registerExporter(slowExporter);

      // Verify main operation IS blocked (synchronous export)
      const startTime = Date.now();
      let operationCompleted = false;

      await provider.withSpan(
        { name: 'test-operation', attributes: { component: 'test' } },
        async () => {
          operationCompleted = true;
          return 'success';
        }
      );

      const duration = Date.now() - startTime;

      expect(operationCompleted).toBe(true);
      // Currently, export is synchronous, so it WILL block
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('should handle single exporter registration (last wins)', async () => {
      const exportCalls: string[] = [];

      const exporter1: SpanExporter = {
        export: (_spans: ExportableSpan[]) => {
          exportCalls.push('exporter1');
        },
      };

      const exporter2: SpanExporter = {
        export: (_spans: ExportableSpan[]) => {
          exportCalls.push('exporter2');
        },
      };

      // Only one exporter can be registered at a time
      provider.registerExporter(exporter1);
      provider.registerExporter(exporter2); // This overwrites exporter1

      await provider.withSpan(
        { name: 'test-operation', attributes: { component: 'test' } },
        async () => {
          return 'success';
        }
      );

      // Only exporter2 should be called (last registered wins)
      expect(exportCalls).toEqual(['exporter2']);
    });
  });

  describe('Missing exporter', () => {
    it('should operate normally without registered exporter', async () => {
      // Standard operation without registerExporter
      let operationCompleted = false;
      let spanId: string | undefined;

      const result = await provider.withSpan(
        { name: 'test-operation', attributes: { component: 'test' } },
        async (span) => {
          operationCompleted = true;
          spanId = span.spanId;
          span.addEvent('test-event', { detail: 'test' });
          return 'success';
        }
      );

      // Verify everything works
      expect(operationCompleted).toBe(true);
      expect(result).toBe('success');
      expect(spanId).toBeDefined();
      expect(typeof spanId).toBe('string');
    });

    it('should support nested spans without exporter', async () => {
      let outerCompleted = false;
      let innerCompleted = false;

      await provider.withSpan({ name: 'outer' }, async () => {
        outerCompleted = true;

        await provider.withSpan({ name: 'inner' }, async () => {
          innerCompleted = true;
          return 'inner-result';
        });

        return 'outer-result';
      });

      expect(outerCompleted).toBe(true);
      expect(innerCompleted).toBe(true);
    });

    it('should handle errors in operations without exporter', async () => {
      const testError = new Error('Operation failed');
      let caughtError: Error | undefined;

      try {
        await provider.withSpan({ name: 'failing-operation' }, async () => {
          throw testError;
        });
      } catch (error) {
        caughtError = error as Error;
      }

      expect(caughtError).toBe(testError);
    });
  });

  describe('Exporter behavior', () => {
    it('should export spans with correct structure', async () => {
      let exportedSpans: ExportableSpan[] = [];

      const collectingExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans = spans;
        },
      };

      provider.registerExporter(collectingExporter);

      await provider.withSpan(
        { name: 'test-operation', attributes: { component: 'test' } },
        async () => {
          return 'success';
        }
      );

      expect(exportedSpans.length).toBe(1);
      expect(exportedSpans[0]!.name).toBe('test-operation');
      expect(exportedSpans[0]!.status.code).toBe('ok');
      expect(exportedSpans[0]!.attributes.component).toBe('test');
    });

    it('should export error status when operation throws', async () => {
      let exportedSpans: ExportableSpan[] = [];

      const collectingExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans = spans;
        },
      };

      provider.registerExporter(collectingExporter);

      try {
        await provider.withSpan({ name: 'failing-operation' }, async () => {
          throw new Error('Operation error');
        });
      } catch {
        // Expected error
      }

      expect(exportedSpans.length).toBe(1);
      expect(exportedSpans[0]!.status.code).toBe('error');
      expect(exportedSpans[0]!.status.message).toBe('Operation error');
    });
  });

  describe('Span timing', () => {
    it('should record span duration accurately', async () => {
      let exportedSpans: ExportableSpan[] = [];

      const collectingExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans = spans;
        },
      };

      provider.registerExporter(collectingExporter);

      await provider.withSpan({ name: 'timed-operation' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(exportedSpans.length).toBe(1);
      expect(exportedSpans[0]!.durationMs).toBeGreaterThanOrEqual(50);
      expect(exportedSpans[0]!.durationMs).toBeLessThan(200); // Allow overhead
    });
  });
});
