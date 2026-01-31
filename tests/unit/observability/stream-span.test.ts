import { describe, it, expect, beforeEach } from 'bun:test';
import {
  TracingSpanFactory,
  GenAIAttributes,
  AgentlintAttributes,
} from '../../../src/observability/span-factory';
import { TraceContextProvider } from '../../../src/observability/trace-context';

describe('Stream Span', () => {
  let factory: TracingSpanFactory;
  let provider: TraceContextProvider;

  beforeEach(() => {
    factory = new TracingSpanFactory();
    provider = new TraceContextProvider();
  });

  describe('operation name', () => {
    it('should have sse_streaming operation name', async () => {
      await provider.run(async () => {
        await factory.createStreamSpan({ streamId: 'stream-123' }, async (span) => {
          expect(span.attributes[GenAIAttributes.OPERATION_NAME]).toBe('sse_streaming');
        });
      });
    });
  });

  describe('lifecycle', () => {
    it('should track start time', async () => {
      await provider.run(async () => {
        const startTime = Date.now();

        await factory.createStreamSpan({ streamId: 'stream-123' }, async (span) => {
          expect(span.startTime).toBeGreaterThanOrEqual(startTime);
          expect(span.startTime).toBeLessThanOrEqual(Date.now());
        });
      });
    });

    it('should capture first_token event with latency', async () => {
      await provider.run(async () => {
        await factory.createStreamSpan({ streamId: 'stream-123' }, async (span) => {
          // Record first token event
          span.addEvent('first_token', { latency_ms: 250 });

          expect(span.events).toHaveLength(1);
          const event = span.events[0];
          expect(event?.name).toBe('first_token');
          expect(event?.attributes?.latency_ms).toBe(250);
        });
      });
    });

    it('should support setting first_token latency as attribute', async () => {
      await provider.run(async () => {
        await factory.createStreamSpan({ streamId: 'stream-123' }, async (span) => {
          span.setAttribute(AgentlintAttributes.STREAM_FIRST_TOKEN_MS, 150);

          expect(span.attributes[AgentlintAttributes.STREAM_FIRST_TOKEN_MS]).toBe(150);
        });
      });
    });

    it('should track multiple stream events', async () => {
      await provider.run(async () => {
        await factory.createStreamSpan({ streamId: 'stream-123' }, async (span) => {
          span.addEvent('first_token', { latency_ms: 100 });
          span.addEvent('chunk_received', { chunk_id: 1 });
          span.addEvent('chunk_received', { chunk_id: 2 });
          span.addEvent('stream_complete', {});

          expect(span.events).toHaveLength(4);
          expect(span.events[0]?.name).toBe('first_token');
          expect(span.events[3]?.name).toBe('stream_complete');
        });
      });
    });

    it('should calculate duration on end', async () => {
      await provider.run(async () => {
        let startTime = 0;

        await factory.createStreamSpan({ streamId: 'stream-123' }, async (span) => {
          startTime = span.startTime;
          // Simulate some streaming work
          await new Promise((resolve) => setTimeout(resolve, 10));
        });

        // Span should be ended after callback completes
        expect(startTime).toBeGreaterThan(0);
        const duration = Date.now() - startTime;
        expect(duration).toBeGreaterThanOrEqual(10);
      });
    });

    it('should allow setting stream attributes dynamically', async () => {
      await provider.run(async () => {
        await factory.createStreamSpan({ streamId: 'stream-123' }, async (span) => {
          span.setAttribute(AgentlintAttributes.STREAM_CHUNK_COUNT, 42);
          span.setAttribute(AgentlintAttributes.STREAM_DURATION_MS, 1500);
          span.setAttribute(AgentlintAttributes.STREAM_FIRST_TOKEN_MS, 200);

          expect(span.attributes[AgentlintAttributes.STREAM_CHUNK_COUNT]).toBe(42);
          expect(span.attributes[AgentlintAttributes.STREAM_DURATION_MS]).toBe(1500);
          expect(span.attributes[AgentlintAttributes.STREAM_FIRST_TOKEN_MS]).toBe(200);
        });
      });
    });
  });

  describe('span name', () => {
    it('should have "stream" as span name', async () => {
      await provider.run(async () => {
        await factory.createStreamSpan({ streamId: 'stream-123' }, async (span) => {
          expect(span.name).toBe('stream');
        });
      });
    });
  });
});
