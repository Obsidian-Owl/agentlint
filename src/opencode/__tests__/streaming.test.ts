/**
 * EP23: Stream Span Instrumentation Tests
 *
 * Tests for stream span creation and first_token event recording.
 *
 * Tasks: T040, T041
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { StreamAdapter } from '../streaming';
import type { OpencodeEvent } from '../streaming';
import { spanFactory } from '../../observability/span-factory';
import { traceContextProvider } from '../../observability/trace-context';
import type { ActiveSpan } from '../../observability/types';

// Helper to convert array to async iterable
// eslint-disable-next-line @typescript-eslint/require-await
async function* toAsyncIterable<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

describe('Stream Span Instrumentation', () => {
  let adapter: StreamAdapter;
  let mockSpan: ActiveSpan;
  let spanEvents: Array<{ name: string; attributes?: Record<string, unknown> }>;
  let spanAttributes: Record<string, string | number | boolean>;

  beforeEach(() => {
    adapter = new StreamAdapter();
    spanEvents = [];
    spanAttributes = {};

    // Create mock span that captures events and attributes
    mockSpan = {
      spanId: 'test-span-id',
      name: 'test-span',
      startTime: Date.now(),
      attributes: spanAttributes,
      events: spanEvents as Array<{
        name: string;
        timestamp: number;
        attributes?: Record<string, unknown>;
      }>,
      addEvent: mock((name: string, attributes?: Record<string, unknown>) => {
        if (attributes === undefined) {
          spanEvents.push({ name });
        } else {
          spanEvents.push({ name, attributes });
        }
      }),
      setAttribute: mock((key: string, value: string | number | boolean) => {
        spanAttributes[key] = value;
      }),
      end: mock(() => {
        // noop
      }),
    };
  });

  describe('T040: Stream span created on stream start', () => {
    it('should create a stream span when streaming starts with trace context', async () => {
      // Mock spanFactory.createStreamSpan
      const createStreamSpanSpy = mock(
        async (_options: { streamId: string }, fn: (span: ActiveSpan) => Promise<void>) => {
          return fn(mockSpan);
        }
      );
      spanFactory.createStreamSpan = createStreamSpanSpy as typeof spanFactory.createStreamSpan;

      // Create trace context
      await traceContextProvider.run(async () => {
        // Create mock events
        const events: OpencodeEvent[] = [
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'part-1', type: 'text' },
              text: 'Hello',
            },
          },
        ];

        // Adapt stream
        const chunks = [];
        for await (const chunk of adapter.adaptStream(toAsyncIterable(events))) {
          chunks.push(chunk);
        }

        // Verify span was created
        expect(createStreamSpanSpy).toHaveBeenCalled();

        // Verify span received stream ID
        const calls = createStreamSpanSpy.mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const firstCall = calls[0];
        expect(firstCall).toBeDefined();
        if (firstCall) {
          expect(firstCall[0]).toHaveProperty('streamId');
          expect(typeof firstCall[0].streamId).toBe('string');
        }
      });
    });

    it('should include stream metadata in span attributes', async () => {
      // Mock spanFactory.createStreamSpan
      const createStreamSpanSpy = mock(
        async (options: { streamId: string }, fn: (span: ActiveSpan) => Promise<void>) => {
          // Verify streamId is passed
          expect(options.streamId).toBeDefined();
          expect(typeof options.streamId).toBe('string');
          return fn(mockSpan);
        }
      );
      spanFactory.createStreamSpan = createStreamSpanSpy as typeof spanFactory.createStreamSpan;

      await traceContextProvider.run(async () => {
        const events: OpencodeEvent[] = [
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'part-1', type: 'text' },
              text: 'test',
            },
          },
        ];

        const chunks = [];
        for await (const chunk of adapter.adaptStream(toAsyncIterable(events))) {
          chunks.push(chunk);
        }

        expect(createStreamSpanSpy).toHaveBeenCalled();
      });
    });

    it('should not create span when no trace context exists', async () => {
      // Mock spanFactory.createStreamSpan
      const createStreamSpanSpy = mock(
        async (_options: { streamId: string }, fn: (span: ActiveSpan) => Promise<void>) => {
          return fn(mockSpan);
        }
      );
      spanFactory.createStreamSpan = createStreamSpanSpy as typeof spanFactory.createStreamSpan;

      // Adapt stream WITHOUT trace context
      const events: OpencodeEvent[] = [
        {
          type: 'message.part.updated',
          properties: {
            part: { id: 'part-1', type: 'text' },
            text: 'Hello',
          },
        },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(toAsyncIterable(events))) {
        chunks.push(chunk);
      }

      // Verify span was NOT created (no trace context)
      expect(createStreamSpanSpy).not.toHaveBeenCalled();
    });

    it('should generate unique stream ID for each stream', async () => {
      const streamIds: string[] = [];

      const createStreamSpanSpy = mock(
        async (options: { streamId: string }, fn: (span: ActiveSpan) => Promise<void>) => {
          streamIds.push(options.streamId);
          return fn(mockSpan);
        }
      );
      spanFactory.createStreamSpan = createStreamSpanSpy as typeof spanFactory.createStreamSpan;

      await traceContextProvider.run(async () => {
        // First stream
        const events1: OpencodeEvent[] = [
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'part-1', type: 'text' },
              text: 'First',
            },
          },
        ];

        for await (const _chunk of adapter.adaptStream(toAsyncIterable(events1))) {
          // consume
        }

        // Second stream
        const events2: OpencodeEvent[] = [
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'part-2', type: 'text' },
              text: 'Second',
            },
          },
        ];

        for await (const _chunk of adapter.adaptStream(toAsyncIterable(events2))) {
          // consume
        }

        // Verify two different stream IDs
        expect(streamIds.length).toBe(2);
        expect(streamIds[0]).not.toBe(streamIds[1]);
        expect(streamIds[0]).toMatch(/^stream-\d+-[a-z0-9]+$/);
        expect(streamIds[1]).toMatch(/^stream-\d+-[a-z0-9]+$/);
      });
    });
  });

  describe('T041: first_token event recorded with timestamp', () => {
    it('should record first_token event when first text chunk is received', async () => {
      let capturedSpan: ActiveSpan | null = null;

      const createStreamSpanSpy = mock(
        async (_options: { streamId: string }, fn: (span: ActiveSpan) => Promise<void>) => {
          capturedSpan = mockSpan;
          return fn(mockSpan);
        }
      );
      spanFactory.createStreamSpan = createStreamSpanSpy as typeof spanFactory.createStreamSpan;

      await traceContextProvider.run(async () => {
        const events: OpencodeEvent[] = [
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'part-1', type: 'text' },
              text: 'First token',
            },
          },
        ];

        const chunks = [];
        for await (const chunk of adapter.adaptStream(toAsyncIterable(events))) {
          chunks.push(chunk);
        }

        // Verify span was created and first_token event was recorded
        expect(capturedSpan).not.toBeNull();
        // Verify events were added by checking the captured events array
        expect(spanEvents.length).toBeGreaterThan(0);

        // Find first_token event
        const firstTokenEvent = spanEvents.find((e) => e.name === 'first_token');
        expect(firstTokenEvent).toBeDefined();
        expect(firstTokenEvent?.attributes).toHaveProperty('latency_ms');
        expect(typeof firstTokenEvent?.attributes?.latency_ms).toBe('number');
      });
    });

    it('should include latency_ms in first_token event', async () => {
      let capturedSpan: ActiveSpan | null = null;

      const createStreamSpanSpy = mock(
        async (_options: { streamId: string }, fn: (span: ActiveSpan) => Promise<void>) => {
          capturedSpan = mockSpan;
          return fn(mockSpan);
        }
      );
      spanFactory.createStreamSpan = createStreamSpanSpy as typeof spanFactory.createStreamSpan;

      await traceContextProvider.run(async () => {
        const startTime = Date.now();

        const events: OpencodeEvent[] = [
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'part-1', type: 'text' },
              text: 'Hello world',
            },
          },
        ];

        const chunks = [];
        for await (const chunk of adapter.adaptStream(toAsyncIterable(events))) {
          chunks.push(chunk);
        }

        const endTime = Date.now();

        expect(capturedSpan).not.toBeNull();

        // Find first_token event
        const firstTokenEvent = spanEvents.find((e) => e.name === 'first_token');
        expect(firstTokenEvent).toBeDefined();

        const latencyMs = firstTokenEvent?.attributes?.latency_ms as number;
        expect(latencyMs).toBeGreaterThanOrEqual(0);
        expect(latencyMs).toBeLessThanOrEqual(endTime - startTime);
      });
    });

    it('should record first_token only once even with multiple chunks', async () => {
      let capturedSpan: ActiveSpan | null = null;

      const createStreamSpanSpy = mock(
        async (_options: { streamId: string }, fn: (span: ActiveSpan) => Promise<void>) => {
          capturedSpan = mockSpan;
          return fn(mockSpan);
        }
      );
      spanFactory.createStreamSpan = createStreamSpanSpy as typeof spanFactory.createStreamSpan;

      await traceContextProvider.run(async () => {
        const events: OpencodeEvent[] = [
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'part-1', type: 'text' },
              text: 'First',
            },
          },
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'part-1', type: 'text' },
              text: 'First Second',
            },
          },
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'part-1', type: 'text' },
              text: 'First Second Third',
            },
          },
        ];

        const chunks = [];
        for await (const chunk of adapter.adaptStream(toAsyncIterable(events))) {
          chunks.push(chunk);
        }

        expect(capturedSpan).not.toBeNull();

        // Count first_token events (should be exactly 1)
        const firstTokenEvents = spanEvents.filter((e) => e.name === 'first_token');
        expect(firstTokenEvents.length).toBe(1);
      });
    });

    it('should not record first_token for non-text events', async () => {
      let capturedSpan: ActiveSpan | null = null;

      const createStreamSpanSpy = mock(
        async (_options: { streamId: string }, fn: (span: ActiveSpan) => Promise<void>) => {
          capturedSpan = mockSpan;
          return fn(mockSpan);
        }
      );
      spanFactory.createStreamSpan = createStreamSpanSpy as typeof spanFactory.createStreamSpan;

      await traceContextProvider.run(async () => {
        const events: OpencodeEvent[] = [
          {
            type: 'status.updated',
            properties: {
              status: 'running',
            },
          },
          {
            type: 'tool.call.started',
            properties: {
              name: 'read_file',
            },
          },
        ];

        const chunks = [];
        for await (const chunk of adapter.adaptStream(toAsyncIterable(events))) {
          chunks.push(chunk);
        }

        expect(capturedSpan).not.toBeNull();

        // Should NOT have first_token event (no text chunks)
        const firstTokenEvents = spanEvents.filter((e) => e.name === 'first_token');
        expect(firstTokenEvents.length).toBe(0);
      });
    });

    it('should record first_token attribute on span', async () => {
      let capturedSpan: ActiveSpan | null = null;

      const createStreamSpanSpy = mock(
        async (_options: { streamId: string }, fn: (span: ActiveSpan) => Promise<void>) => {
          capturedSpan = mockSpan;
          return fn(mockSpan);
        }
      );
      spanFactory.createStreamSpan = createStreamSpanSpy as typeof spanFactory.createStreamSpan;

      await traceContextProvider.run(async () => {
        const events: OpencodeEvent[] = [
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'part-1', type: 'text' },
              text: 'Token',
            },
          },
        ];

        const chunks = [];
        for await (const chunk of adapter.adaptStream(toAsyncIterable(events))) {
          chunks.push(chunk);
        }

        expect(capturedSpan).not.toBeNull();
        // Verify attributes were set by checking the captured attributes object
        expect(Object.keys(spanAttributes).length).toBeGreaterThan(0);

        // Check for stream.first_token_ms attribute
        expect(spanAttributes).toHaveProperty('agentlint.stream.first_token_ms');
        expect(typeof spanAttributes['agentlint.stream.first_token_ms']).toBe('number');
      });
    });

    it('should filter reasoning/thinking chunks before first_token detection', async () => {
      let capturedSpan: ActiveSpan | null = null;

      const createStreamSpanSpy = mock(
        async (_options: { streamId: string }, fn: (span: ActiveSpan) => Promise<void>) => {
          capturedSpan = mockSpan;
          return fn(mockSpan);
        }
      );
      spanFactory.createStreamSpan = createStreamSpanSpy as typeof spanFactory.createStreamSpan;

      await traceContextProvider.run(async () => {
        const events: OpencodeEvent[] = [
          // Thinking chunk (should be filtered, not trigger first_token)
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'thinking-1', type: 'thinking' },
              text: 'Let me think...',
            },
          },
          // Reasoning chunk (should be filtered, not trigger first_token)
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'reasoning-1', type: 'reasoning' },
              text: 'Reasoning about this...',
            },
          },
          // Actual text chunk (should trigger first_token)
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'text-1', type: 'text' },
              text: 'Actual response',
            },
          },
        ];

        const chunks = [];
        for await (const chunk of adapter.adaptStream(toAsyncIterable(events))) {
          chunks.push(chunk);
        }

        expect(capturedSpan).not.toBeNull();

        // Should have exactly 1 first_token event (for the text chunk)
        const firstTokenEvents = spanEvents.filter((e) => e.name === 'first_token');
        expect(firstTokenEvents.length).toBe(1);
      });
    });
  });

  describe('Stream completion metrics', () => {
    it('should record stream_complete event when stream ends', async () => {
      let capturedSpan: ActiveSpan | null = null;

      const createStreamSpanSpy = mock(
        async (_options: { streamId: string }, fn: (span: ActiveSpan) => Promise<void>) => {
          capturedSpan = mockSpan;
          return fn(mockSpan);
        }
      );
      spanFactory.createStreamSpan = createStreamSpanSpy as typeof spanFactory.createStreamSpan;

      await traceContextProvider.run(async () => {
        const events: OpencodeEvent[] = [
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'part-1', type: 'text' },
              text: 'Hello',
            },
          },
        ];

        const chunks = [];
        for await (const chunk of adapter.adaptStream(toAsyncIterable(events))) {
          chunks.push(chunk);
        }

        expect(capturedSpan).not.toBeNull();

        // Find stream_complete event
        const completeEvent = spanEvents.find((e) => e.name === 'stream_complete');
        expect(completeEvent).toBeDefined();
      });
    });

    it('should record chunk count in span attributes', async () => {
      let capturedSpan: ActiveSpan | null = null;

      const createStreamSpanSpy = mock(
        async (_options: { streamId: string }, fn: (span: ActiveSpan) => Promise<void>) => {
          capturedSpan = mockSpan;
          return fn(mockSpan);
        }
      );
      spanFactory.createStreamSpan = createStreamSpanSpy as typeof spanFactory.createStreamSpan;

      await traceContextProvider.run(async () => {
        const events: OpencodeEvent[] = [
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'part-1', type: 'text' },
              text: 'A',
            },
          },
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'part-1', type: 'text' },
              text: 'AB',
            },
          },
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'part-1', type: 'text' },
              text: 'ABC',
            },
          },
        ];

        const chunks = [];
        for await (const chunk of adapter.adaptStream(toAsyncIterable(events))) {
          chunks.push(chunk);
        }

        expect(capturedSpan).not.toBeNull();

        // Check for chunk count attribute
        expect(spanAttributes).toHaveProperty('agentlint.stream.chunk_count');
        expect(spanAttributes['agentlint.stream.chunk_count']).toBe(3);
      });
    });

    it('should record stream duration in span attributes', async () => {
      let capturedSpan: ActiveSpan | null = null;

      const createStreamSpanSpy = mock(
        async (_options: { streamId: string }, fn: (span: ActiveSpan) => Promise<void>) => {
          capturedSpan = mockSpan;
          return fn(mockSpan);
        }
      );
      spanFactory.createStreamSpan = createStreamSpanSpy as typeof spanFactory.createStreamSpan;

      await traceContextProvider.run(async () => {
        const events: OpencodeEvent[] = [
          {
            type: 'message.part.updated',
            properties: {
              part: { id: 'part-1', type: 'text' },
              text: 'Test',
            },
          },
        ];

        const chunks = [];
        for await (const chunk of adapter.adaptStream(toAsyncIterable(events))) {
          chunks.push(chunk);
        }

        expect(capturedSpan).not.toBeNull();

        // Check for duration attribute
        expect(spanAttributes).toHaveProperty('agentlint.stream.duration_ms');
        expect(typeof spanAttributes['agentlint.stream.duration_ms']).toBe('number');
        expect(spanAttributes['agentlint.stream.duration_ms']).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
