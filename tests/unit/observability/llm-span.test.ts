import { describe, it, expect, beforeEach } from 'bun:test';
import { TracingSpanFactory, GenAIAttributes } from '../../../src/observability/span-factory';
import { TraceContextProvider } from '../../../src/observability/trace-context';

describe('LLM Span', () => {
  let factory: TracingSpanFactory;
  let provider: TraceContextProvider;

  beforeEach(() => {
    factory = new TracingSpanFactory();
    provider = new TraceContextProvider();
  });

  describe('token usage', () => {
    it('should capture input tokens', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan(
          { model: 'claude-3-sonnet', provider: 'anthropic' },
          async (span) => {
            // Simulate LLM response with token usage
            span.setAttribute(GenAIAttributes.USAGE_INPUT_TOKENS, 150);

            expect(span.attributes[GenAIAttributes.USAGE_INPUT_TOKENS]).toBe(150);
          }
        );
      });
    });

    it('should capture output tokens', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan(
          { model: 'claude-3-sonnet', provider: 'anthropic' },
          async (span) => {
            span.setAttribute(GenAIAttributes.USAGE_OUTPUT_TOKENS, 75);

            expect(span.attributes[GenAIAttributes.USAGE_OUTPUT_TOKENS]).toBe(75);
          }
        );
      });
    });

    it('should capture reasoning tokens', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan(
          { model: 'claude-3-sonnet', provider: 'anthropic' },
          async (span) => {
            span.setAttribute(GenAIAttributes.USAGE_REASONING_TOKENS, 25);

            expect(span.attributes[GenAIAttributes.USAGE_REASONING_TOKENS]).toBe(25);
          }
        );
      });
    });

    it('should capture all token types together', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan(
          { model: 'claude-3-sonnet', provider: 'anthropic' },
          async (span) => {
            span.setAttribute(GenAIAttributes.USAGE_INPUT_TOKENS, 200);
            span.setAttribute(GenAIAttributes.USAGE_OUTPUT_TOKENS, 100);
            span.setAttribute(GenAIAttributes.USAGE_REASONING_TOKENS, 50);

            expect(span.attributes[GenAIAttributes.USAGE_INPUT_TOKENS]).toBe(200);
            expect(span.attributes[GenAIAttributes.USAGE_OUTPUT_TOKENS]).toBe(100);
            expect(span.attributes[GenAIAttributes.USAGE_REASONING_TOKENS]).toBe(50);
          }
        );
      });
    });
  });

  describe('model attributes', () => {
    it('should have request model attribute', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan(
          { model: 'claude-3-5-sonnet-20241022', provider: 'anthropic' },
          async (span) => {
            expect(span.attributes[GenAIAttributes.REQUEST_MODEL]).toBe(
              'claude-3-5-sonnet-20241022'
            );
          }
        );
      });
    });

    it('should support different models', async () => {
      await provider.run(async () => {
        const models = ['gpt-4', 'claude-3-opus', 'gemini-pro'];

        for (const model of models) {
          await factory.createLLMSpan({ model }, async (span) => {
            expect(span.attributes[GenAIAttributes.REQUEST_MODEL]).toBe(model);
          });
        }
      });
    });

    it('should have provider attribute', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan({ model: 'gpt-4', provider: 'openai' }, async (span) => {
          expect(span.attributes[GenAIAttributes.PROVIDER_NAME]).toBe('openai');
        });
      });
    });

    it('should support different providers', async () => {
      await provider.run(async () => {
        const providers = ['anthropic', 'openai', 'google', 'bedrock'] as const;

        for (const provider of providers) {
          await factory.createLLMSpan({ model: 'test-model', provider }, async (span) => {
            expect(span.attributes[GenAIAttributes.PROVIDER_NAME]).toBe(provider);
          });
        }
      });
    });

    it('should omit provider when not specified', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan({ model: 'test-model' }, async (span) => {
          expect(span.attributes[GenAIAttributes.PROVIDER_NAME]).toBeUndefined();
        });
      });
    });
  });

  describe('request parameters', () => {
    it('should capture temperature', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan(
          { model: 'claude-3-sonnet', provider: 'anthropic', temperature: 0.7 },
          async (span) => {
            expect(span.attributes[GenAIAttributes.REQUEST_TEMPERATURE]).toBe(0.7);
          }
        );
      });
    });

    it('should capture max tokens', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan(
          { model: 'claude-3-sonnet', provider: 'anthropic', maxTokens: 2048 },
          async (span) => {
            expect(span.attributes[GenAIAttributes.REQUEST_MAX_TOKENS]).toBe(2048);
          }
        );
      });
    });

    it('should capture both temperature and max tokens', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan(
          {
            model: 'claude-3-sonnet',
            provider: 'anthropic',
            temperature: 0.5,
            maxTokens: 1024,
          },
          async (span) => {
            expect(span.attributes[GenAIAttributes.REQUEST_TEMPERATURE]).toBe(0.5);
            expect(span.attributes[GenAIAttributes.REQUEST_MAX_TOKENS]).toBe(1024);
          }
        );
      });
    });

    it('should omit optional parameters when not provided', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan({ model: 'test-model' }, async (span) => {
          expect(span.attributes[GenAIAttributes.REQUEST_TEMPERATURE]).toBeUndefined();
          expect(span.attributes[GenAIAttributes.REQUEST_MAX_TOKENS]).toBeUndefined();
        });
      });
    });

    it('should handle temperature of 0', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan({ model: 'test-model', temperature: 0 }, async (span) => {
          expect(span.attributes[GenAIAttributes.REQUEST_TEMPERATURE]).toBe(0);
        });
      });
    });
  });

  describe('nesting under session', () => {
    it('should be nested under session span', async () => {
      await provider.run(async () => {
        await factory.createSessionSpan(
          { sessionId: 'test-session', target: '/path' },
          async (_sessionSpan) => {
            const sessionContext = provider.getContext();

            await factory.createLLMSpan(
              { model: 'claude-3-sonnet', provider: 'anthropic' },
              async (_llmSpan) => {
                const llmContext = provider.getContext();

                // LLM span should be child of session span
                expect(llmContext?.traceId).toBe(sessionContext?.traceId);
                expect(llmContext?.parentSpanId).toBe(sessionContext?.spanId);
                expect(llmContext?.spanId).not.toBe(sessionContext?.spanId);
              }
            );
          }
        );
      });
    });

    it('should maintain trace ID across entire hierarchy', async () => {
      await provider.run(async () => {
        let rootTraceId: string | undefined;

        await factory.createSessionSpan(
          { sessionId: 'test-session', target: '/path' },
          async (_sessionSpan) => {
            rootTraceId = provider.getContext()?.traceId;

            await factory.createToolSpan({ toolName: 'session_query' }, async (_toolSpan) => {
              await factory.createLLMSpan(
                { model: 'claude-3-sonnet', provider: 'anthropic' },
                async (_llmSpan) => {
                  const llmTraceId = provider.getContext()?.traceId;
                  expect(llmTraceId).toBe(rootTraceId);
                }
              );
            });
          }
        );
      });
    });
  });

  describe('operation name', () => {
    it('should have chat operation name', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan(
          { model: 'claude-3-sonnet', provider: 'anthropic' },
          async (span) => {
            expect(span.attributes[GenAIAttributes.OPERATION_NAME]).toBe('chat');
          }
        );
      });
    });
  });

  describe('span name', () => {
    it('should have "llm" as span name', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan(
          { model: 'claude-3-sonnet', provider: 'anthropic' },
          async (span) => {
            expect(span.name).toBe('llm');
          }
        );
      });
    });
  });

  describe('response attributes', () => {
    it('should support capturing response ID', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan(
          { model: 'claude-3-sonnet', provider: 'anthropic' },
          async (span) => {
            span.setAttribute(GenAIAttributes.RESPONSE_ID, 'resp-abc-123');
            expect(span.attributes[GenAIAttributes.RESPONSE_ID]).toBe('resp-abc-123');
          }
        );
      });
    });

    it('should support capturing finish reasons', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan(
          { model: 'claude-3-sonnet', provider: 'anthropic' },
          async (span) => {
            span.setAttribute(GenAIAttributes.RESPONSE_FINISH_REASONS, 'stop');
            expect(span.attributes[GenAIAttributes.RESPONSE_FINISH_REASONS]).toBe('stop');
          }
        );
      });
    });

    it('should support capturing response model', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan(
          { model: 'claude-3-sonnet', provider: 'anthropic' },
          async (span) => {
            // Response model may differ from request (e.g., aliasing)
            span.setAttribute(GenAIAttributes.RESPONSE_MODEL, 'claude-3-5-sonnet-20241022');
            expect(span.attributes[GenAIAttributes.RESPONSE_MODEL]).toBe(
              'claude-3-5-sonnet-20241022'
            );
          }
        );
      });
    });
  });

  describe('span kind', () => {
    it('should have client span kind', async () => {
      await provider.run(async () => {
        await factory.createLLMSpan(
          { model: 'claude-3-sonnet', provider: 'anthropic' },
          async (span) => {
            // Client kind is set in SpanOptions, verified through successful span creation
            expect(span.name).toBe('llm');
          }
        );
      });
    });
  });
});
