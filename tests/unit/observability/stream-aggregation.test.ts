import { describe, it, expect, beforeEach } from 'bun:test';
import { TracingSpanFactory, AgentlintAttributes } from '../../../src/observability/span-factory';
import { TraceContextProvider } from '../../../src/observability/trace-context';

describe('Stream Aggregation', () => {
  let factory: TracingSpanFactory;
  let provider: TraceContextProvider;

  beforeEach(() => {
    factory = new TracingSpanFactory();
    provider = new TraceContextProvider();
  });

  describe('event count aggregation', () => {
    it('should record chunk count as attribute not individual events', async () => {
      await provider.run(async () => {
        await factory.createStreamSpan({ streamId: 'stream-123' }, async (span) => {
          // Instead of: span.addEvent('chunk', { id: 1 })
          // Instead of: span.addEvent('chunk', { id: 2 })
          // We aggregate to a count attribute
          span.setAttribute(AgentlintAttributes.STREAM_CHUNK_COUNT, 150);

          // Should have aggregated count, not 150 individual events
          expect(span.attributes[AgentlintAttributes.STREAM_CHUNK_COUNT]).toBe(150);
          expect(span.events).toHaveLength(0);
        });
      });
    });

    it('should record only milestone events, not every chunk', async () => {
      await provider.run(async () => {
        await factory.createStreamSpan({ streamId: 'stream-123' }, async (span) => {
          // Milestone events only
          span.addEvent('first_token', { latency_ms: 100 });
          span.addEvent('stream_complete', {});

          // Aggregate stats
          span.setAttribute(AgentlintAttributes.STREAM_CHUNK_COUNT, 250);
          span.setAttribute(AgentlintAttributes.STREAM_DURATION_MS, 2500);

          // Should have only milestone events, not 250 chunk events
          expect(span.events).toHaveLength(2);
          expect(span.attributes[AgentlintAttributes.STREAM_CHUNK_COUNT]).toBe(250);
        });
      });
    });

    it('should aggregate final stream statistics as attributes', async () => {
      await provider.run(async () => {
        await factory.createStreamSpan({ streamId: 'stream-123' }, async (span) => {
          // Simulate stream processing
          let chunkCount = 0;
          const startTime = span.startTime;

          // First token received
          const firstTokenLatency = 125;
          span.addEvent('first_token', { latency_ms: firstTokenLatency });
          span.setAttribute(AgentlintAttributes.STREAM_FIRST_TOKEN_MS, firstTokenLatency);

          // Process chunks (not recorded as individual events)
          for (let i = 0; i < 75; i++) {
            chunkCount++;
          }

          // Simulate some time passing
          await new Promise((resolve) => setTimeout(resolve, 1));

          // Record aggregates on complete
          const endTime = Date.now();
          const duration = endTime - startTime;
          span.setAttribute(AgentlintAttributes.STREAM_CHUNK_COUNT, chunkCount);
          span.setAttribute(AgentlintAttributes.STREAM_DURATION_MS, duration);

          // Verify aggregation
          expect(span.events).toHaveLength(1); // Only first_token event
          expect(span.attributes[AgentlintAttributes.STREAM_CHUNK_COUNT]).toBe(75);
          expect(span.attributes[AgentlintAttributes.STREAM_DURATION_MS]).toBeGreaterThanOrEqual(0);
          expect(span.attributes[AgentlintAttributes.STREAM_FIRST_TOKEN_MS]).toBe(125);
        });
      });
    });

    it('should avoid span bloat from high-volume chunk events', async () => {
      await provider.run(async () => {
        await factory.createStreamSpan({ streamId: 'stream-123' }, async (span) => {
          // If we recorded every chunk as an event, this would create 1000 events
          const chunkCount = 1000;

          // Instead, aggregate to single attribute
          span.setAttribute(AgentlintAttributes.STREAM_CHUNK_COUNT, chunkCount);

          // Verify span size is bounded
          expect(span.events.length).toBeLessThan(10); // Only milestone events
          expect(span.attributes[AgentlintAttributes.STREAM_CHUNK_COUNT]).toBe(1000);
        });
      });
    });

    it('should support incremental count updates during streaming', async () => {
      await provider.run(async () => {
        await factory.createStreamSpan({ streamId: 'stream-123' }, async (span) => {
          let count = 0;

          // Simulate streaming with incremental count updates
          count += 10;
          span.setAttribute(AgentlintAttributes.STREAM_CHUNK_COUNT, count);
          expect(span.attributes[AgentlintAttributes.STREAM_CHUNK_COUNT]).toBe(10);

          count += 15;
          span.setAttribute(AgentlintAttributes.STREAM_CHUNK_COUNT, count);
          expect(span.attributes[AgentlintAttributes.STREAM_CHUNK_COUNT]).toBe(25);

          count += 20;
          span.setAttribute(AgentlintAttributes.STREAM_CHUNK_COUNT, count);
          expect(span.attributes[AgentlintAttributes.STREAM_CHUNK_COUNT]).toBe(45);

          // Only final value persisted
          expect(span.attributes[AgentlintAttributes.STREAM_CHUNK_COUNT]).toBe(45);
        });
      });
    });
  });

  describe('statistics aggregation', () => {
    it('should aggregate token statistics as attributes', async () => {
      await provider.run(async () => {
        await factory.createStreamSpan({ streamId: 'stream-123' }, async (span) => {
          // Aggregate token counts
          span.setAttribute('gen_ai.usage.input_tokens', 1500);
          span.setAttribute('gen_ai.usage.output_tokens', 2500);

          expect(span.attributes['gen_ai.usage.input_tokens']).toBe(1500);
          expect(span.attributes['gen_ai.usage.output_tokens']).toBe(2500);
        });
      });
    });

    it('should calculate throughput statistics on completion', async () => {
      await provider.run(async () => {
        await factory.createStreamSpan({ streamId: 'stream-123' }, async (span) => {
          // Simulate streaming with timing
          const startTime = span.startTime;
          await new Promise((resolve) => setTimeout(resolve, 100));
          const endTime = Date.now();

          const duration = endTime - startTime;
          const outputTokens = 500;
          const tokensPerSecond = (outputTokens / duration) * 1000;

          span.setAttribute(AgentlintAttributes.STREAM_DURATION_MS, duration);
          span.setAttribute('gen_ai.usage.output_tokens', outputTokens);
          span.setAttribute('gen_ai.response.tokens_per_second', tokensPerSecond);

          expect(span.attributes[AgentlintAttributes.STREAM_DURATION_MS]).toBeGreaterThanOrEqual(
            100
          );
          expect(span.attributes['gen_ai.response.tokens_per_second']).toBeGreaterThan(0);
        });
      });
    });
  });
});
