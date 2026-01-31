import { describe, it, expect, beforeEach } from 'bun:test';
import { TracingSpanFactory, GenAIAttributes } from '../../../src/observability/span-factory';
import { TraceContextProvider } from '../../../src/observability/trace-context';

describe('Tool Span', () => {
  let factory: TracingSpanFactory;
  let provider: TraceContextProvider;

  beforeEach(() => {
    factory = new TracingSpanFactory();
    provider = new TraceContextProvider();
  });

  describe('parent-child hierarchy', () => {
    it('should be children of session span', async () => {
      await provider.run(async () => {
        await factory.createSessionSpan(
          { sessionId: 'test-session', target: '/path' },
          async (_sessionSpan) => {
            const sessionContext = provider.getContext();

            await factory.createToolSpan(
              { toolName: 'session_query', callId: 'call-123' },
              async (_toolSpan) => {
                const toolContext = provider.getContext();

                // Tool span should be child of session span
                expect(toolContext?.traceId).toBe(sessionContext?.traceId);
                expect(toolContext?.parentSpanId).toBe(sessionContext?.spanId);
                expect(toolContext?.spanId).not.toBe(sessionContext?.spanId);
              }
            );
          }
        );
      });
    });

    it('should maintain trace ID across hierarchy', async () => {
      await provider.run(async () => {
        let sessionTraceId: string | undefined;

        await factory.createSessionSpan(
          { sessionId: 'test-session', target: '/path' },
          async (_sessionSpan) => {
            sessionTraceId = provider.getContext()?.traceId;

            await factory.createToolSpan(
              { toolName: 'session_query', callId: 'call-123' },
              async (_toolSpan) => {
                const toolTraceId = provider.getContext()?.traceId;
                expect(toolTraceId).toBe(sessionTraceId);
              }
            );
          }
        );
      });
    });
  });

  describe('tool attributes', () => {
    it('should have correct operation name', async () => {
      await provider.run(async () => {
        await factory.createToolSpan(
          { toolName: 'session_query', callId: 'call-123' },
          async (span) => {
            expect(span.attributes[GenAIAttributes.OPERATION_NAME]).toBe('execute_tool');
          }
        );
      });
    });

    it('should have tool name attribute', async () => {
      await provider.run(async () => {
        await factory.createToolSpan(
          { toolName: 'pattern_search', callId: 'call-456' },
          async (span) => {
            expect(span.attributes[GenAIAttributes.TOOL_NAME]).toBe('pattern_search');
          }
        );
      });
    });

    it('should have tool call ID when provided', async () => {
      await provider.run(async () => {
        await factory.createToolSpan(
          { toolName: 'session_query', callId: 'call-abc-123' },
          async (span) => {
            expect(span.attributes[GenAIAttributes.TOOL_CALL_ID]).toBe('call-abc-123');
          }
        );
      });
    });

    it('should omit call ID when not provided', async () => {
      await provider.run(async () => {
        await factory.createToolSpan({ toolName: 'pattern_search' }, async (span) => {
          expect(span.attributes[GenAIAttributes.TOOL_CALL_ID]).toBeUndefined();
        });
      });
    });
  });

  describe('input/output capture', () => {
    it('should support capturing tool input via attributes', async () => {
      await provider.run(async () => {
        await factory.createToolSpan(
          {
            toolName: 'session_query',
            callId: 'call-123',
            input: { query: 'recent sessions', limit: 10 },
          },
          async (span) => {
            // Input can be captured via addEvent or setAttribute
            span.addEvent('tool_input', { query: 'recent sessions', limit: 10 });
            expect(span.events).toHaveLength(1);
            const event = span.events[0];
            expect(event?.name).toBe('tool_input');
          }
        );
      });
    });

    it('should support capturing tool output via events', async () => {
      await provider.run(async () => {
        await factory.createToolSpan(
          { toolName: 'session_query', callId: 'call-123' },
          async (span) => {
            // Simulate tool execution
            const result = { count: 5, sessions: [] };

            span.addEvent('tool_output', { count: result.count });
            expect(span.events).toHaveLength(1);
            const event = span.events[0];
            expect(event).toBeDefined();
            if (event?.attributes) {
              expect(event.attributes.count).toBe(5);
            }
          }
        );
      });
    });

    it('should support capturing errors via status', async () => {
      await provider.run(async () => {
        let errorCaptured = false;

        await factory.createToolSpan(
          { toolName: 'session_query', callId: 'call-123' },
          async (span) => {
            try {
              throw new Error('Database connection failed');
            } catch (error) {
              span.end({
                code: 'error',
                message: error instanceof Error ? error.message : 'Unknown error',
              });
              errorCaptured = true;
            }
          }
        );

        // Error handling completed
        expect(errorCaptured).toBe(true);
      });
    });
  });

  describe('span name', () => {
    it('should prefix tool name with "tool:"', async () => {
      await provider.run(async () => {
        await factory.createToolSpan(
          { toolName: 'session_query', callId: 'call-123' },
          async (span) => {
            expect(span.name).toBe('tool:session_query');
          }
        );
      });
    });

    it('should handle different tool names', async () => {
      await provider.run(async () => {
        await factory.createToolSpan({ toolName: 'pattern_search' }, async (span) => {
          expect(span.name).toBe('tool:pattern_search');
        });

        await factory.createToolSpan({ toolName: 'feedback_submit' }, async (span) => {
          expect(span.name).toBe('tool:feedback_submit');
        });
      });
    });
  });

  describe('multiple tool spans', () => {
    it('should create separate spans for sequential tool calls', async () => {
      await provider.run(async () => {
        await factory.createSessionSpan(
          { sessionId: 'test-session', target: '/path' },
          async (_sessionSpan) => {
            const toolSpanIds: string[] = [];

            await factory.createToolSpan({ toolName: 'tool_1' }, async (span) => {
              toolSpanIds.push(span.spanId);
            });

            await factory.createToolSpan({ toolName: 'tool_2' }, async (span) => {
              toolSpanIds.push(span.spanId);
            });

            await factory.createToolSpan({ toolName: 'tool_3' }, async (span) => {
              toolSpanIds.push(span.spanId);
            });

            // All span IDs should be unique
            expect(new Set(toolSpanIds).size).toBe(3);
          }
        );
      });
    });
  });
});
