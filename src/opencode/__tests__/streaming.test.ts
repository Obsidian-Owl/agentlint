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

// ========================================
// Test Helpers
// ========================================

/** Helper to convert array to async iterable */
// eslint-disable-next-line @typescript-eslint/require-await
async function* toAsyncIterable<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

/** Event builders for common test events */
const createTextEvent = (partId: string, text: string): OpencodeEvent => ({
  type: 'message.part.updated',
  properties: {
    part: { id: partId, type: 'text', text },
  },
});

const createThinkingEvent = (partId: string, text: string): OpencodeEvent => ({
  type: 'message.part.updated',
  properties: {
    part: { id: partId, type: 'thinking', text },
  },
});

const createReasoningEvent = (partId: string, text: string): OpencodeEvent => ({
  type: 'message.part.updated',
  properties: {
    part: { id: partId, type: 'reasoning', text },
  },
});

const createStatusEvent = (status: string): OpencodeEvent => ({
  type: 'status.updated',
  properties: { status },
});

const createToolCallEvent = (name: string): OpencodeEvent => ({
  type: 'tool.call.started',
  properties: { name },
});

/** Mock span factory with captured events and attributes */
interface MockSpanContext {
  span: ActiveSpan;
  events: Array<{ name: string; attributes?: Record<string, unknown> }>;
  attributes: Record<string, string | number | boolean>;
}

function createMockSpan(): MockSpanContext {
  const events: Array<{ name: string; attributes?: Record<string, unknown> }> = [];
  const attributes: Record<string, string | number | boolean> = {};

  const span: ActiveSpan = {
    spanId: 'test-span-id',
    name: 'test-span',
    startTime: Date.now(),
    attributes,
    events: events as Array<{
      name: string;
      timestamp: number;
      attributes?: Record<string, unknown>;
    }>,
    addEvent: mock((name: string, attrs?: Record<string, unknown>) => {
      events.push(attrs === undefined ? { name } : { name, attributes: attrs });
    }),
    setAttribute: mock((key: string, value: string | number | boolean) => {
      attributes[key] = value;
    }),
    end: mock(() => {
      // noop
    }),
  };

  return { span, events, attributes };
}

/** Create a mock createStreamSpan spy that uses the given span */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function mockCreateStreamSpan(mockSpanContext: MockSpanContext) {
  const spy = mock(
    async (_options: { streamId: string }, fn: (span: ActiveSpan) => Promise<void>) => {
      await fn(mockSpanContext.span);
    }
  );
  spanFactory.createStreamSpan = spy as typeof spanFactory.createStreamSpan;
  return spy;
}

/** Run events through adapter and collect chunks */
async function adaptAndCollectChunks(
  adapter: StreamAdapter,
  events: OpencodeEvent[]
): Promise<unknown[]> {
  const chunks = [];
  for await (const chunk of adapter.adaptStream(toAsyncIterable(events))) {
    chunks.push(chunk);
  }
  return chunks;
}

/** Run adapter in trace context */
async function adaptInTraceContext(
  adapter: StreamAdapter,
  events: OpencodeEvent[]
): Promise<unknown[]> {
  return traceContextProvider.run(() => adaptAndCollectChunks(adapter, events));
}

/** Find event by name in span events */
function findSpanEvent(
  events: Array<{ name: string; attributes?: Record<string, unknown> }>,
  name: string
): { name: string; attributes?: Record<string, unknown> } | undefined {
  return events.find((e) => e.name === name);
}

/** Filter events by name */
function filterSpanEvents(
  events: Array<{ name: string; attributes?: Record<string, unknown> }>,
  name: string
): Array<{ name: string; attributes?: Record<string, unknown> }> {
  return events.filter((e) => e.name === name);
}

describe('Stream Span Instrumentation', () => {
  let adapter: StreamAdapter;
  let mockSpanContext: MockSpanContext;

  beforeEach(() => {
    adapter = new StreamAdapter();
    mockSpanContext = createMockSpan();
  });

  describe('T040: Stream span created on stream start', () => {
    it('should create a stream span when streaming starts with trace context', async () => {
      const createStreamSpanSpy = mockCreateStreamSpan(mockSpanContext);
      const events = [createTextEvent('part-1', 'Hello')];

      await adaptInTraceContext(adapter, events);

      expect(createStreamSpanSpy).toHaveBeenCalled();

      const calls = createStreamSpanSpy.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const firstCall = calls[0];
      expect(firstCall).toBeDefined();
      if (firstCall) {
        expect(firstCall[0]).toHaveProperty('streamId');
        expect(typeof firstCall[0].streamId).toBe('string');
      }
    });

    it('should include stream metadata in span attributes', async () => {
      const spy = mock(
        async (options: { streamId: string }, fn: (span: ActiveSpan) => Promise<void>) => {
          expect(options.streamId).toBeDefined();
          expect(typeof options.streamId).toBe('string');
          return fn(mockSpanContext.span);
        }
      );
      spanFactory.createStreamSpan = spy as typeof spanFactory.createStreamSpan;

      const events = [createTextEvent('part-1', 'test')];
      await adaptInTraceContext(adapter, events);

      expect(spy).toHaveBeenCalled();
    });

    it('should not create span when no trace context exists', async () => {
      const createStreamSpanSpy = mockCreateStreamSpan(mockSpanContext);
      const events = [createTextEvent('part-1', 'Hello')];

      // WITHOUT trace context
      await adaptAndCollectChunks(adapter, events);

      expect(createStreamSpanSpy).not.toHaveBeenCalled();
    });

    it('should generate unique stream ID for each stream', async () => {
      const streamIds: string[] = [];
      const spy = mock(
        async (options: { streamId: string }, fn: (span: ActiveSpan) => Promise<void>) => {
          streamIds.push(options.streamId);
          return fn(mockSpanContext.span);
        }
      );
      spanFactory.createStreamSpan = spy as typeof spanFactory.createStreamSpan;

      await traceContextProvider.run(async () => {
        await adaptAndCollectChunks(adapter, [createTextEvent('part-1', 'First')]);
        await adaptAndCollectChunks(adapter, [createTextEvent('part-2', 'Second')]);

        expect(streamIds.length).toBe(2);
        expect(streamIds[0]).not.toBe(streamIds[1]);
        expect(streamIds[0]).toMatch(/^stream-\d+-[a-z0-9]+$/);
        expect(streamIds[1]).toMatch(/^stream-\d+-[a-z0-9]+$/);
      });
    });
  });

  describe('T041: first_token event recorded with timestamp', () => {
    it('should record first_token event when first text chunk is received', async () => {
      mockCreateStreamSpan(mockSpanContext);
      const events = [createTextEvent('part-1', 'First token')];

      await adaptInTraceContext(adapter, events);

      expect(mockSpanContext.events.length).toBeGreaterThan(0);

      const firstTokenEvent = findSpanEvent(mockSpanContext.events, 'first_token');
      expect(firstTokenEvent).toBeDefined();
      expect(firstTokenEvent?.attributes).toHaveProperty('latency_ms');
      expect(typeof firstTokenEvent?.attributes?.latency_ms).toBe('number');
    });

    it('should include latency_ms in first_token event', async () => {
      mockCreateStreamSpan(mockSpanContext);
      const startTime = Date.now();

      const events = [createTextEvent('part-1', 'Hello world')];
      await adaptInTraceContext(adapter, events);

      const endTime = Date.now();

      const firstTokenEvent = findSpanEvent(mockSpanContext.events, 'first_token');
      expect(firstTokenEvent).toBeDefined();

      const latencyMs = firstTokenEvent?.attributes?.latency_ms as number;
      expect(latencyMs).toBeGreaterThanOrEqual(0);
      expect(latencyMs).toBeLessThanOrEqual(endTime - startTime);
    });

    it('should record first_token only once even with multiple chunks', async () => {
      mockCreateStreamSpan(mockSpanContext);

      const events = [
        createTextEvent('part-1', 'First'),
        createTextEvent('part-1', 'First Second'),
        createTextEvent('part-1', 'First Second Third'),
      ];

      await adaptInTraceContext(adapter, events);

      const firstTokenEvents = filterSpanEvents(mockSpanContext.events, 'first_token');
      expect(firstTokenEvents.length).toBe(1);
    });

    it('should not record first_token for non-text events', async () => {
      mockCreateStreamSpan(mockSpanContext);

      const events = [createStatusEvent('running'), createToolCallEvent('read_file')];

      await adaptInTraceContext(adapter, events);

      const firstTokenEvents = filterSpanEvents(mockSpanContext.events, 'first_token');
      expect(firstTokenEvents.length).toBe(0);
    });

    it('should record first_token attribute on span', async () => {
      mockCreateStreamSpan(mockSpanContext);

      await traceContextProvider.run(async () => {
        const events = [createTextEvent('part-1', 'Token')];
        const chunks = await adaptAndCollectChunks(adapter, events);

        expect(chunks.length).toBeGreaterThan(0);
        expect(Object.keys(mockSpanContext.attributes).length).toBeGreaterThan(0);
        // Use direct property access instead of toHaveProperty (Bun bug workaround)
        expect('agentlint.stream.first_token_ms' in mockSpanContext.attributes).toBe(true);
        expect(typeof mockSpanContext.attributes['agentlint.stream.first_token_ms']).toBe('number');
      });
    });

    it('should filter reasoning/thinking chunks before first_token detection', async () => {
      mockCreateStreamSpan(mockSpanContext);

      const events = [
        createThinkingEvent('thinking-1', 'Let me think...'),
        createReasoningEvent('reasoning-1', 'Reasoning about this...'),
        createTextEvent('text-1', 'Actual response'),
      ];

      await adaptInTraceContext(adapter, events);

      const firstTokenEvents = filterSpanEvents(mockSpanContext.events, 'first_token');
      expect(firstTokenEvents.length).toBe(1);
    });
  });

  describe('Stream completion metrics', () => {
    it('should record stream_complete event when stream ends', async () => {
      mockCreateStreamSpan(mockSpanContext);
      const events = [createTextEvent('part-1', 'Hello')];

      await adaptInTraceContext(adapter, events);

      const completeEvent = findSpanEvent(mockSpanContext.events, 'stream_complete');
      expect(completeEvent).toBeDefined();
    });

    it('should record chunk count in span attributes', async () => {
      mockCreateStreamSpan(mockSpanContext);

      await traceContextProvider.run(async () => {
        const events = [
          createTextEvent('part-1', 'A'),
          createTextEvent('part-1', 'AB'),
          createTextEvent('part-1', 'ABC'),
        ];
        const chunks = await adaptAndCollectChunks(adapter, events);

        expect(chunks.length).toBe(3);
        // Use direct property access instead of toHaveProperty (Bun bug workaround)
        expect('agentlint.stream.chunk_count' in mockSpanContext.attributes).toBe(true);
        expect(mockSpanContext.attributes['agentlint.stream.chunk_count']).toBe(3);
      });
    });

    it('should record stream duration in span attributes', async () => {
      mockCreateStreamSpan(mockSpanContext);

      await traceContextProvider.run(async () => {
        const events = [createTextEvent('part-1', 'Test')];
        const chunks = await adaptAndCollectChunks(adapter, events);

        expect(chunks.length).toBeGreaterThan(0);
        // Use direct property access instead of toHaveProperty (Bun bug workaround)
        expect('agentlint.stream.duration_ms' in mockSpanContext.attributes).toBe(true);
        expect(typeof mockSpanContext.attributes['agentlint.stream.duration_ms']).toBe('number');
        expect(mockSpanContext.attributes['agentlint.stream.duration_ms']).toBeGreaterThanOrEqual(
          0
        );
      });
    });
  });
});
