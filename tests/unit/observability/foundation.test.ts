import { describe, it, expect } from 'bun:test';
import {
  TraceContextProvider,
  TracingSpanFactory,
  GenAIAttributes,
  traceContextProvider,
  type SpanExporter,
  type ExportableSpan,
} from '../../../src/observability';

describe('Observability Foundation Integration', () => {
  const provider = new TraceContextProvider();
  const factory = new TracingSpanFactory();
  // Use the singleton for tests that need exporter integration
  // (TracingSpanFactory uses the singleton internally)

  it('should work end-to-end: session -> tool -> LLM spans', async () => {
    const capturedSpans: string[] = [];

    await provider.run(async () => {
      const rootCtx = provider.getContext();
      expect(rootCtx?.traceId).toHaveLength(32);

      await factory.createSessionSpan(
        { sessionId: 'integration-test', provider: 'anthropic' },
        async (sessionSpan) => {
          capturedSpans.push(sessionSpan.name);
          expect(sessionSpan.attributes[GenAIAttributes.OPERATION_NAME]).toBe('invoke_agent');

          await factory.createToolSpan({ toolName: 'test_tool' }, async (toolSpan) => {
            capturedSpans.push(toolSpan.name);

            // Verify parent-child relationship
            const toolCtx = provider.getContext();
            expect(toolCtx?.traceId).toBe(rootCtx?.traceId);

            toolSpan.addEvent('tool_started');
            toolSpan.setAttribute('test.key', 'test-value');
          });

          await factory.createLLMSpan(
            { model: 'claude-3-sonnet', temperature: 0.5 },
            async (llmSpan) => {
              capturedSpans.push(llmSpan.name);
              llmSpan.addEvent('first_token');
            }
          );
        }
      );
    });

    expect(capturedSpans).toEqual(['session', 'tool:test_tool', 'llm']);
  });

  it('should maintain trace context across concurrent operations', async () => {
    await provider.run(async () => {
      const rootTraceId = provider.getContext()?.traceId;

      const results = await Promise.all([
        factory.createToolSpan({ toolName: 'tool1' }, async () => {
          return provider.getContext()?.traceId;
        }),
        factory.createToolSpan({ toolName: 'tool2' }, async () => {
          return provider.getContext()?.traceId;
        }),
        factory.createToolSpan({ toolName: 'tool3' }, async () => {
          return provider.getContext()?.traceId;
        }),
      ]);

      // All concurrent operations should share the same trace
      results.forEach((traceId) => {
        expect(traceId).toBe(rootTraceId);
      });
    });
  });

  it('should export spans with correct hierarchy via registered exporter', async () => {
    const exportedSpans: ExportableSpan[] = [];
    const collectingExporter: SpanExporter = {
      export: (spans: ExportableSpan[]) => {
        exportedSpans.push(...spans);
      },
    };

    // Register exporter on the singleton (which TracingSpanFactory uses internally)
    traceContextProvider.registerExporter(collectingExporter);

    await traceContextProvider.run(async () => {
      const rootCtx = traceContextProvider.getContext();
      expect(rootCtx).toBeDefined();

      await factory.createSessionSpan(
        { sessionId: 'export-test', provider: 'anthropic' },
        async (sessionSpan) => {
          sessionSpan.setAttribute('session.custom', 'value1');

          await factory.createToolSpan({ toolName: 'export_tool' }, async (toolSpan) => {
            toolSpan.setAttribute('tool.custom', 'value2');
            toolSpan.addEvent('tool_processing');

            await factory.createLLMSpan(
              { model: 'claude-3-sonnet', temperature: 0.7 },
              async (llmSpan) => {
                llmSpan.setAttribute('llm.custom', 'value3');
                llmSpan.addEvent('token_generation');
              }
            );
          });
        }
      );
    });

    // Verify all spans were exported
    expect(exportedSpans.length).toBeGreaterThanOrEqual(3);

    // Find spans by name
    const sessionSpan = exportedSpans.find((s) => s.name === 'session');
    const toolSpan = exportedSpans.find((s) => s.name === 'tool:export_tool');
    const llmSpan = exportedSpans.find((s) => s.name === 'llm');

    expect(sessionSpan).toBeDefined();
    expect(toolSpan).toBeDefined();
    expect(llmSpan).toBeDefined();

    // Verify all spans share the same trace ID
    expect(toolSpan!.traceId).toBe(sessionSpan!.traceId);
    expect(llmSpan!.traceId).toBe(sessionSpan!.traceId);

    // Verify parent-child relationships
    expect(toolSpan!.parentSpanId).toBe(sessionSpan!.spanId);
    expect(llmSpan!.parentSpanId).toBe(toolSpan!.spanId);

    // Verify custom attributes were preserved
    expect(sessionSpan!.attributes['session.custom']).toBe('value1');
    expect(toolSpan!.attributes['tool.custom']).toBe('value2');
    expect(llmSpan!.attributes['llm.custom']).toBe('value3');

    // Verify GenAI attributes (using actual operation names from span-factory.ts)
    expect(sessionSpan!.attributes[GenAIAttributes.OPERATION_NAME]).toBe('invoke_agent');
    expect(toolSpan!.attributes[GenAIAttributes.OPERATION_NAME]).toBe('execute_tool');
    expect(llmSpan!.attributes[GenAIAttributes.OPERATION_NAME]).toBe('chat');

    // Verify events were captured
    const toolEvents = toolSpan!.events;
    const llmEvents = llmSpan!.events;
    expect(toolEvents.some((e) => e.name === 'tool_processing')).toBe(true);
    expect(llmEvents.some((e) => e.name === 'token_generation')).toBe(true);

    // Verify all spans completed successfully
    expect(sessionSpan!.status.code).toBe('ok');
    expect(toolSpan!.status.code).toBe('ok');
    expect(llmSpan!.status.code).toBe('ok');

    // Verify duration tracking (spans may complete in 0ms in fast tests)
    expect(sessionSpan!.durationMs).toBeGreaterThanOrEqual(0);
    expect(toolSpan!.durationMs).toBeGreaterThanOrEqual(0);
    expect(llmSpan!.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof sessionSpan!.durationMs).toBe('number');
  });
});
