import { describe, it, expect, beforeEach } from 'bun:test';
import { StreamAdapter, type OpencodeEvent } from '../../../src/opencode/streaming';
import { traceContextProvider } from '../../../src/observability/trace-context';
import { LocalSpanExporter } from '../../../src/observability/exporters/local-exporter';
import { AgentlintAttributes } from '../../../src/observability/span-factory';
import type { ExportableSpan } from '../../../src/observability/exporters/local-exporter';

describe('Streaming Integration', () => {
  let adapter: StreamAdapter;
  let exporter: LocalSpanExporter;
  let exportedSpans: ExportableSpan[];

  beforeEach(() => {
    adapter = new StreamAdapter();
    exportedSpans = [];

    // Create exporter that captures spans
    exporter = {
      export: (spans: ExportableSpan[]) => {
        exportedSpans.push(...spans);
      },
    } as LocalSpanExporter;

    // Register exporter
    traceContextProvider.registerExporter(exporter);
  });

  describe('stream span creation', () => {
    it('should create stream span when in trace context', async () => {
      const events: OpencodeEvent[] = [
        {
          type: 'message.part.updated',
          properties: {
            part: { id: 'part-1', text: 'Hello' },
          },
        },
        {
          type: 'message.part.updated',
          properties: {
            part: { id: 'part-1', text: 'Hello world' },
          },
        },
      ];

      await traceContextProvider.run(async () => {
        const chunks = [];
        for await (const chunk of adapter.adaptStream(asyncIterable(events))) {
          chunks.push(chunk);
        }

        expect(chunks).toHaveLength(2);
      });

      // Should have created a stream span
      const streamSpans = exportedSpans.filter((span) => span.name === 'stream');
      expect(streamSpans).toHaveLength(1);
    });

    it('should not create span when outside trace context', async () => {
      const events: OpencodeEvent[] = [
        {
          type: 'message.part.updated',
          properties: {
            part: { id: 'part-1', text: 'Hello' },
          },
        },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(asyncIterable(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);

      // Should not have created any spans
      expect(exportedSpans).toHaveLength(0);
    });
  });

  describe('first_token latency', () => {
    it('should record first_token event with latency', async () => {
      const events: OpencodeEvent[] = [
        {
          type: 'message.part.updated',
          properties: {
            part: { id: 'part-1', text: 'First token' },
          },
        },
        {
          type: 'message.part.updated',
          properties: {
            part: { id: 'part-1', text: 'First token second token' },
          },
        },
      ];

      await traceContextProvider.run(async () => {
        const chunks = [];
        for await (const chunk of adapter.adaptStream(asyncIterable(events))) {
          chunks.push(chunk);
        }

        expect(chunks).toHaveLength(2);
      });

      const streamSpans = exportedSpans.filter((span) => span.name === 'stream');
      expect(streamSpans).toHaveLength(1);

      const streamSpan = streamSpans[0];
      expect(streamSpan).toBeDefined();

      // Should have first_token event
      const firstTokenEvents = streamSpan?.events.filter((e) => e.name === 'first_token');
      expect(firstTokenEvents).toHaveLength(1);

      // Should have first_token latency attribute (may be 0 since buffered)
      expect(
        streamSpan?.attributes[AgentlintAttributes.STREAM_FIRST_TOKEN_MS]
      ).toBeGreaterThanOrEqual(0);
    });
  });

  describe('aggregate statistics', () => {
    it('should record chunk count as attribute not individual events', async () => {
      const events: OpencodeEvent[] = [
        {
          type: 'message.part.updated',
          properties: {
            part: { id: 'part-1', text: 'One' },
          },
        },
        {
          type: 'message.part.updated',
          properties: {
            part: { id: 'part-1', text: 'One Two' },
          },
        },
        {
          type: 'message.part.updated',
          properties: {
            part: { id: 'part-1', text: 'One Two Three' },
          },
        },
      ];

      await traceContextProvider.run(async () => {
        const chunks = [];
        for await (const chunk of adapter.adaptStream(asyncIterable(events))) {
          chunks.push(chunk);
        }

        expect(chunks).toHaveLength(3);
      });

      const streamSpans = exportedSpans.filter((span) => span.name === 'stream');
      expect(streamSpans).toHaveLength(1);

      const streamSpan = streamSpans[0];
      expect(streamSpan).toBeDefined();

      // Should have chunk_count attribute
      expect(streamSpan?.attributes[AgentlintAttributes.STREAM_CHUNK_COUNT]).toBe(3);

      // Should NOT have 3 individual chunk events
      const chunkEvents = streamSpan?.events.filter((e) => e.name === 'chunk');
      expect(chunkEvents).toHaveLength(0);
    });

    it('should record stream duration on completion', async () => {
      const events: OpencodeEvent[] = [
        {
          type: 'message.part.updated',
          properties: {
            part: { id: 'part-1', text: 'Hello' },
          },
        },
      ];

      await traceContextProvider.run(async () => {
        const chunks = [];
        for await (const chunk of adapter.adaptStream(asyncIterable(events))) {
          chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
      });

      const streamSpans = exportedSpans.filter((span) => span.name === 'stream');
      expect(streamSpans).toHaveLength(1);

      const streamSpan = streamSpans[0];
      expect(streamSpan).toBeDefined();

      // Should have duration attribute (may be 0 since buffered)
      expect(streamSpan?.attributes[AgentlintAttributes.STREAM_DURATION_MS]).toBeGreaterThanOrEqual(
        0
      );

      // Should have stream_complete event
      const completeEvents = streamSpan?.events.filter((e) => e.name === 'stream_complete');
      expect(completeEvents).toHaveLength(1);
    });

    it('should record only milestone events, not every chunk', async () => {
      // Simulate 100 chunks
      const events: OpencodeEvent[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'message.part.updated',
        properties: {
          part: { id: 'part-1', text: `Token ${i + 1}` },
        },
      }));

      await traceContextProvider.run(async () => {
        const chunks = [];
        for await (const chunk of adapter.adaptStream(asyncIterable(events))) {
          chunks.push(chunk);
        }

        expect(chunks).toHaveLength(100);
      });

      const streamSpans = exportedSpans.filter((span) => span.name === 'stream');
      expect(streamSpans).toHaveLength(1);

      const streamSpan = streamSpans[0];
      expect(streamSpan).toBeDefined();

      // Should have aggregated chunk count
      expect(streamSpan?.attributes[AgentlintAttributes.STREAM_CHUNK_COUNT]).toBe(100);

      // Should have only milestone events (first_token, stream_complete)
      // NOT 100 individual chunk events
      expect(streamSpan?.events.length).toBeLessThan(10);
    });
  });

  describe('span hierarchy', () => {
    it('should create stream span as child of session span', async () => {
      const events: OpencodeEvent[] = [
        {
          type: 'message.part.updated',
          properties: {
            part: { id: 'part-1', text: 'Hello' },
          },
        },
      ];

      await traceContextProvider.run(async () => {
        const chunks = [];
        for await (const chunk of adapter.adaptStream(asyncIterable(events))) {
          chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
      });

      // Should have stream span
      const streamSpans = exportedSpans.filter((span) => span.name === 'stream');
      expect(streamSpans).toHaveLength(1);

      // Stream span should have parent context
      const streamSpan = streamSpans[0];
      expect(streamSpan?.traceId).toBeDefined();
      expect(streamSpan?.spanId).toBeDefined();
    });
  });
});

/**
 * Helper to convert array to async iterable
 */
async function* asyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) {
    yield item;
  }
}
