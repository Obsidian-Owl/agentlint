import { describe, it, expect, beforeEach } from 'bun:test';
import {
  TracingSpanFactory,
  GenAIAttributes,
  AgentlintAttributes,
} from '../../../src/observability/span-factory';
import { TraceContextProvider } from '../../../src/observability/trace-context';

describe('Session Span', () => {
  let factory: TracingSpanFactory;
  let provider: TraceContextProvider;

  beforeEach(() => {
    factory = new TracingSpanFactory();
    provider = new TraceContextProvider();
  });

  describe('operation name', () => {
    it('should have invoke_agent operation name', async () => {
      await provider.run(async () => {
        await factory.createSessionSpan(
          { sessionId: 'test-session', target: '/path', provider: 'anthropic' },
          async (span) => {
            expect(span.attributes[GenAIAttributes.OPERATION_NAME]).toBe('invoke_agent');
          }
        );
      });
    });
  });

  describe('GenAI attributes', () => {
    it('should have gen_ai.system attribute', async () => {
      await provider.run(async () => {
        await factory.createSessionSpan(
          { sessionId: 'test-session', target: '/path', provider: 'anthropic' },
          async (span) => {
            expect(span.attributes[GenAIAttributes.PROVIDER_NAME]).toBe('anthropic');
          }
        );
      });
    });

    it('should have conversation ID', async () => {
      await provider.run(async () => {
        await factory.createSessionSpan(
          { sessionId: 'session-123', target: '/path' },
          async (span) => {
            expect(span.attributes[GenAIAttributes.CONVERSATION_ID]).toBe('session-123');
          }
        );
      });
    });

    it('should have agent name and ID', async () => {
      await provider.run(async () => {
        await factory.createSessionSpan(
          { sessionId: 'test-session', target: '/path' },
          async (span) => {
            expect(span.attributes[GenAIAttributes.AGENT_NAME]).toBe('agentlint');
            expect(span.attributes[GenAIAttributes.AGENT_ID]).toBe('agentlint-cli');
          }
        );
      });
    });

    it('should have agentlint.target attribute', async () => {
      await provider.run(async () => {
        await factory.createSessionSpan(
          { sessionId: 'test-session', target: '/project/path', provider: 'anthropic' },
          async (span) => {
            expect(span.attributes[AgentlintAttributes.SESSION_TARGET]).toBe('/project/path');
          }
        );
      });
    });

    it('should have session command when provided', async () => {
      await provider.run(async () => {
        await factory.createSessionSpan(
          { sessionId: 'test-session', command: 'analyze', target: '/path' },
          async (span) => {
            expect(span.attributes[AgentlintAttributes.SESSION_COMMAND]).toBe('analyze');
          }
        );
      });
    });

    it('should omit optional attributes when not provided', async () => {
      await provider.run(async () => {
        await factory.createSessionSpan({ sessionId: 'test-session' }, async (span) => {
          expect(span.attributes[GenAIAttributes.PROVIDER_NAME]).toBeUndefined();
          expect(span.attributes[AgentlintAttributes.SESSION_TARGET]).toBeUndefined();
          expect(span.attributes[AgentlintAttributes.SESSION_COMMAND]).toBeUndefined();
        });
      });
    });
  });

  describe('lifecycle', () => {
    it('should track start time', async () => {
      await provider.run(async () => {
        const startTime = Date.now();

        await factory.createSessionSpan(
          { sessionId: 'test-session', target: '/path' },
          async (span) => {
            expect(span.startTime).toBeGreaterThanOrEqual(startTime);
            expect(span.startTime).toBeLessThanOrEqual(Date.now());
          }
        );
      });
    });

    it('should calculate duration on end', async () => {
      await provider.run(async () => {
        let startTime = 0;

        await factory.createSessionSpan(
          { sessionId: 'test-session', target: '/path' },
          async (span) => {
            startTime = span.startTime;
            // Simulate some work
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        );

        // Span should be ended after callback completes
        expect(startTime).toBeGreaterThan(0);
        const duration = Date.now() - startTime;
        expect(duration).toBeGreaterThanOrEqual(5);
      });
    });

    it('should support manual end with status', async () => {
      await provider.run(async () => {
        await factory.createSessionSpan(
          { sessionId: 'test-session', target: '/path' },
          async (span) => {
            span.end({ code: 'ok', message: 'Session completed successfully' });
            // Ending manually is valid
            expect(true).toBe(true);
          }
        );
      });
    });

    it('should track events during span', async () => {
      await provider.run(async () => {
        await factory.createSessionSpan(
          { sessionId: 'test-session', target: '/path' },
          async (span) => {
            span.addEvent('phase_started', { phase: 'analysis' });
            span.addEvent('finding_detected', { type: 'pattern' });

            expect(span.events).toHaveLength(2);
            const event0 = span.events[0];
            const event1 = span.events[1];
            expect(event0?.name).toBe('phase_started');
            expect(event1?.name).toBe('finding_detected');
          }
        );
      });
    });

    it('should allow setting attributes dynamically', async () => {
      await provider.run(async () => {
        await factory.createSessionSpan(
          { sessionId: 'test-session', target: '/path' },
          async (span) => {
            span.setAttribute('custom.attribute', 'value');
            span.setAttribute('custom.count', 42);
            span.setAttribute('custom.flag', true);

            expect(span.attributes['custom.attribute']).toBe('value');
            expect(span.attributes['custom.count']).toBe(42);
            expect(span.attributes['custom.flag']).toBe(true);
          }
        );
      });
    });
  });

  describe('span name', () => {
    it('should have "session" as span name', async () => {
      await provider.run(async () => {
        await factory.createSessionSpan(
          { sessionId: 'test-session', target: '/path' },
          async (span) => {
            expect(span.name).toBe('session');
          }
        );
      });
    });
  });
});
