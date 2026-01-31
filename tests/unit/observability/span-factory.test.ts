import { describe, it, expect, beforeEach } from 'bun:test';
import {
  TracingSpanFactory,
  GenAIAttributes,
  AgentlintAttributes,
} from '../../../src/observability/span-factory';
import { traceContextProvider, type SpanExporter } from '../../../src/observability/trace-context';
import type { ExportableSpan } from '../../../src/observability/exporters/local-exporter';

describe('TracingSpanFactory', () => {
  const factory = new TracingSpanFactory();
  // Use singleton provider that the factory uses
  const provider = traceContextProvider;

  // Clear exporter before each test to avoid contamination
  beforeEach(() => {
    provider.clearExporter();
  });

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

    it('should include optional session attributes', async () => {
      const exportedSpans: ExportableSpan[] = [];
      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await factory.createSessionSpan(
          {
            sessionId: 'test-session',
            target: '/path/to/target',
            command: 'analyze',
            provider: 'anthropic',
          },
          async () => {
            // Session work
          }
        );
      });

      expect(exportedSpans[0]!.attributes[AgentlintAttributes.SESSION_TARGET]).toBe(
        '/path/to/target'
      );
      expect(exportedSpans[0]!.attributes[AgentlintAttributes.SESSION_COMMAND]).toBe('analyze');
      expect(exportedSpans[0]!.attributes[GenAIAttributes.PROVIDER_NAME]).toBe('anthropic');
    });

    it('should omit optional attributes when not provided', async () => {
      const exportedSpans: ExportableSpan[] = [];
      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await factory.createSessionSpan({ sessionId: 'test-session' }, async () => {
          // Session work
        });
      });

      expect(exportedSpans[0]!.attributes[AgentlintAttributes.SESSION_TARGET]).toBeUndefined();
      expect(exportedSpans[0]!.attributes[AgentlintAttributes.SESSION_COMMAND]).toBeUndefined();
      expect(exportedSpans[0]!.attributes[GenAIAttributes.PROVIDER_NAME]).toBeUndefined();
    });

    it('should use correct span name', async () => {
      const exportedSpans: ExportableSpan[] = [];
      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await factory.createSessionSpan({ sessionId: 'test-session' }, async () => {
          // Session work
        });
      });

      expect(exportedSpans[0]!.name).toBe('session');
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

    it('should include call ID when provided', async () => {
      const exportedSpans: ExportableSpan[] = [];
      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await factory.createToolSpan({ toolName: 'read_file', callId: 'call-abc123' }, async () => {
          // Tool execution
        });
      });

      expect(exportedSpans[0]!.attributes[GenAIAttributes.TOOL_CALL_ID]).toBe('call-abc123');
    });

    it('should use tool name in span name', async () => {
      const exportedSpans: ExportableSpan[] = [];
      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await factory.createToolSpan({ toolName: 'session_query' }, async () => {
          // Tool execution
        });
      });

      expect(exportedSpans[0]!.name).toBe('tool:session_query');
    });

    it('should omit call ID when not provided', async () => {
      const exportedSpans: ExportableSpan[] = [];
      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await factory.createToolSpan({ toolName: 'read_file' }, async () => {
          // Tool execution
        });
      });

      expect(exportedSpans[0]!.attributes[GenAIAttributes.TOOL_CALL_ID]).toBeUndefined();
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

    it('should include optional LLM parameters', async () => {
      const exportedSpans: ExportableSpan[] = [];
      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await factory.createLLMSpan(
          {
            model: 'claude-3-sonnet',
            provider: 'anthropic',
            temperature: 0.7,
            maxTokens: 4000,
          },
          async () => {
            // LLM call
          }
        );
      });

      expect(exportedSpans[0]!.attributes[GenAIAttributes.REQUEST_TEMPERATURE]).toBe(0.7);
      expect(exportedSpans[0]!.attributes[GenAIAttributes.REQUEST_MAX_TOKENS]).toBe(4000);
      expect(exportedSpans[0]!.attributes[GenAIAttributes.PROVIDER_NAME]).toBe('anthropic');
    });

    it('should omit optional parameters when not provided', async () => {
      const exportedSpans: ExportableSpan[] = [];
      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await factory.createLLMSpan({ model: 'claude-3-sonnet' }, async () => {
          // LLM call
        });
      });

      expect(exportedSpans[0]!.attributes[GenAIAttributes.REQUEST_TEMPERATURE]).toBeUndefined();
      expect(exportedSpans[0]!.attributes[GenAIAttributes.REQUEST_MAX_TOKENS]).toBeUndefined();
      expect(exportedSpans[0]!.attributes[GenAIAttributes.PROVIDER_NAME]).toBeUndefined();
    });

    it('should use correct span name and kind', async () => {
      const exportedSpans: ExportableSpan[] = [];
      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await factory.createLLMSpan({ model: 'claude-3-sonnet' }, async () => {
          // LLM call
        });
      });

      expect(exportedSpans[0]!.name).toBe('llm');
      expect(exportedSpans[0]!.kind).toBe('client');
    });

    it('should handle zero temperature', async () => {
      const exportedSpans: ExportableSpan[] = [];
      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await factory.createLLMSpan({ model: 'claude-3-sonnet', temperature: 0 }, async () => {
          // LLM call
        });
      });

      expect(exportedSpans[0]!.attributes[GenAIAttributes.REQUEST_TEMPERATURE]).toBe(0);
    });
  });

  describe('createStreamSpan', () => {
    it('should create stream span with correct attributes', async () => {
      const exportedSpans: ExportableSpan[] = [];
      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await factory.createStreamSpan({ streamId: 'stream-123' }, async (span) => {
          expect(span.attributes[GenAIAttributes.OPERATION_NAME]).toBe('sse_streaming');
        });
      });

      expect(exportedSpans[0]!.name).toBe('stream');
      expect(exportedSpans[0]!.kind).toBe('internal');
    });
  });

  describe('Nested spans with factory', () => {
    it('should create nested tool and LLM spans within session', async () => {
      const exportedSpans: ExportableSpan[] = [];
      const mockExporter: SpanExporter = {
        export: (spans: ExportableSpan[]) => {
          exportedSpans.push(...spans);
        },
      };

      provider.registerExporter(mockExporter);

      await provider.run(async () => {
        await factory.createSessionSpan({ sessionId: 'session-1' }, async () => {
          await factory.createToolSpan({ toolName: 'tool-1' }, async () => {
            // Tool work
          });

          await factory.createLLMSpan({ model: 'claude-3-sonnet' }, async () => {
            // LLM work
          });
        });
      });

      expect(exportedSpans).toHaveLength(3);
      expect(exportedSpans.map((s) => s.name)).toEqual(['tool:tool-1', 'llm', 'session']);

      // Verify parent relationships
      const sessionSpan = exportedSpans[2]!;
      const toolSpan = exportedSpans[0]!;
      const llmSpan = exportedSpans[1]!;

      expect(toolSpan.parentSpanId).toBeDefined();
      expect(llmSpan.parentSpanId).toBeDefined();
      expect(toolSpan.traceId).toBe(sessionSpan.traceId);
      expect(llmSpan.traceId).toBe(sessionSpan.traceId);
    });
  });
});
