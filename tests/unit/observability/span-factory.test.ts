import { describe, it, expect } from 'bun:test';
import { TracingSpanFactory, GenAIAttributes } from '../../../src/observability/span-factory';
import { TraceContextProvider } from '../../../src/observability/trace-context';

describe('TracingSpanFactory', () => {
  const factory = new TracingSpanFactory();
  const provider = new TraceContextProvider();

  describe('createSessionSpan', () => {
    it('should create span with GenAI session attributes', async () => {
      await provider.run(async () => {
        await factory.createSessionSpan(
          { sessionId: 'test-session', target: '/path', provider: 'anthropic' },
          async (span) => {
            expect(span.attributes[GenAIAttributes.OPERATION_NAME]).toBe('invoke_agent');
            expect(span.attributes[GenAIAttributes.CONVERSATION_ID]).toBe('test-session');
            expect(span.attributes[GenAIAttributes.AGENT_NAME]).toBe('agentlint');
          }
        );
      });
    });
  });

  describe('createToolSpan', () => {
    it('should create span with tool attributes', async () => {
      await provider.run(async () => {
        await factory.createToolSpan(
          { toolName: 'session_query', callId: 'call-123' },
          async (span) => {
            expect(span.attributes[GenAIAttributes.OPERATION_NAME]).toBe('execute_tool');
            expect(span.attributes[GenAIAttributes.TOOL_NAME]).toBe('session_query');
          }
        );
      });
    });
  });

  describe('createLLMSpan', () => {
    it('should create span with LLM attributes', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan(
          { model: 'claude-3-sonnet', provider: 'anthropic', temperature: 0.7 },
          async (span) => {
            expect(span.attributes[GenAIAttributes.OPERATION_NAME]).toBe('chat');
            expect(span.attributes[GenAIAttributes.REQUEST_MODEL]).toBe('claude-3-sonnet');
          }
        );
      });
    });
  });
});
