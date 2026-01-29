import { describe, it, expect } from 'bun:test';
import {
  TraceContextProvider,
  TracingSpanFactory,
  GenAIAttributes,
} from '../../../src/observability';

describe('Observability Foundation Integration', () => {
  const provider = new TraceContextProvider();
  const factory = new TracingSpanFactory();

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
});
