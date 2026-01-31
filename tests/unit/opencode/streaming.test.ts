import { describe, expect, it } from 'bun:test';
import { StreamAdapter, type OpencodeEvent } from '../../../src/opencode/streaming';
import type {
  StreamChunk,
  StreamChunkType,
  VerbosityLevel,
} from '../../../src/orchestration/types';

// ====== Test Helpers ======

async function* createMockEventStream(events: OpencodeEvent[]): AsyncIterable<OpencodeEvent> {
  for (const event of events) {
    yield event;
  }
}

/**
 * Adapts events to chunks using StreamAdapter.
 * Reduces boilerplate: adapter creation + chunk collection loop.
 */
async function adaptEvents(events: OpencodeEvent[]): Promise<StreamChunk[]> {
  const adapter = new StreamAdapter();
  const chunks: StreamChunk[] = [];
  for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
    chunks.push(chunk);
  }
  return chunks;
}

/**
 * Creates a text part event (message.part.updated).
 */
function textEvent(text: string, id?: string): OpencodeEvent {
  return {
    type: 'message.part.updated',
    properties: { part: id ? { id, text } : { text } },
  };
}

/**
 * Creates a tool start event.
 */
function toolStartEvent(name: string): OpencodeEvent {
  return { type: 'tool.call.started', properties: { name } };
}

/**
 * Creates a tool completed event.
 */
function toolCompletedEvent(
  name: string,
  options?: { output?: unknown; isError?: boolean; time?: { start: number; end: number } }
): OpencodeEvent {
  return {
    type: 'tool.call.completed',
    properties: { name, ...options },
  };
}

/**
 * Creates a status updated event.
 */
function statusEvent(status: string | number): OpencodeEvent {
  return { type: 'status.updated', properties: { status } };
}

/**
 * Creates a message.updated event with tokens/cost/finish.
 */
function messageUpdatedEvent(data: {
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: { read?: number; write?: number };
  };
  cost?: number;
  finish?: string;
}): OpencodeEvent {
  return { type: 'message.updated', properties: data };
}

/**
 * Creates a session.error event.
 */
function errorEvent(message?: string, code?: number): OpencodeEvent {
  return {
    type: 'session.error',
    properties: message || code ? { message, code } : undefined,
  };
}

// ====== Assertion Helpers ======

/**
 * Assert chunk count + type + content pattern.
 */
function expectSingleChunk(
  chunks: StreamChunk[],
  expected: { type: StreamChunkType; content?: string | RegExp; level?: VerbosityLevel }
): void {
  expect(chunks).toHaveLength(1);
  expect(chunks[0]?.type).toBe(expected.type);
  if (expected.content) {
    if (typeof expected.content === 'string') {
      if (expected.content.includes('*')) {
        expect(chunks[0]?.content).toContain(expected.content.replace(/\*/g, ''));
      } else {
        expect(chunks[0]?.content).toBe(expected.content);
      }
    } else {
      expect(chunks[0]?.content).toMatch(expected.content);
    }
  }
  if (expected.level) {
    expect(chunks[0]?.level).toBe(expected.level);
  }
}

describe('StreamAdapter', () => {
  describe('adaptStream', () => {
    it('should convert text events to StreamChunks', async () => {
      const chunks = await adaptEvents([textEvent('Hello world')]);
      expectSingleChunk(chunks, { type: 'text', content: 'Hello world', level: 'normal' });
    });

    it('should convert tool start events', async () => {
      const chunks = await adaptEvents([toolStartEvent('analyze_config')]);
      expectSingleChunk(chunks, {
        type: 'tool_start',
        content: '*analyze_config*',
        level: 'verbose',
      });
    });

    it('should convert tool result events', async () => {
      const chunks = await adaptEvents([toolCompletedEvent('analyze_config')]);
      expectSingleChunk(chunks, { type: 'tool_result', content: '*analyze_config*' });
    });

    it('should convert status events', async () => {
      const chunks = await adaptEvents([statusEvent('thinking')]);
      expectSingleChunk(chunks, { type: 'status', content: 'thinking' });
    });

    it('should skip unknown event types', async () => {
      const chunks = await adaptEvents([
        { type: 'unknown.event', properties: {} },
        textEvent('visible'),
      ]);
      expectSingleChunk(chunks, { type: 'text', content: 'visible' });
    });

    it('should handle multiple events in sequence', async () => {
      const chunks = await adaptEvents([
        textEvent('First'),
        toolStartEvent('tool1'),
        toolCompletedEvent('tool1'),
        textEvent('Second'),
      ]);
      expect(chunks).toHaveLength(4);
      expect(chunks[0]?.type).toBe('text');
      expect(chunks[1]?.type).toBe('tool_start');
      expect(chunks[2]?.type).toBe('tool_result');
      expect(chunks[3]?.type).toBe('text');
    });

    it('should convert message.updated events with tokens and cost', async () => {
      const chunks = await adaptEvents([
        messageUpdatedEvent({
          tokens: { input: 100, output: 50, reasoning: 10, cache: { read: 20, write: 5 } },
          cost: 0.003,
          finish: 'end_turn',
        }),
      ]);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('status');
      expect(chunks[0]?.metadata?.tokens).toEqual({
        input: 100,
        output: 50,
        reasoning: 10,
        cache: { read: 20, write: 5 },
      });
      expect(chunks[0]?.metadata?.cost).toBe(0.003);
      expect(chunks[0]?.metadata?.finish).toBe('end_turn');
    });

    it('should skip message.updated events with no telemetry data', async () => {
      const chunks = await adaptEvents([{ type: 'message.updated', properties: {} }]);
      expect(chunks).toHaveLength(0);
    });

    it('should convert session.error events', async () => {
      const chunks = await adaptEvents([errorEvent('Rate limit exceeded', 429)]);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('error');
      expect(chunks[0]?.content).toBe('Rate limit exceeded');
      // Security fix: only 'message' is copied from error events (no arbitrary properties)
      expect(chunks[0]?.metadata?.message).toBe('Rate limit exceeded');
      expect(chunks[0]?.metadata?.code).toBeUndefined();
    });

    it('should handle session.error with no data', async () => {
      const chunks = await adaptEvents([{ type: 'session.error' }]);
      expectSingleChunk(chunks, { type: 'error', content: 'Unknown session error' });
    });

    it('should include timing data in tool.call.completed metadata', async () => {
      const chunks = await adaptEvents([
        toolCompletedEvent('analyze_config', {
          time: { start: 1000, end: 2000 },
          output: { result: 'ok' },
        }),
      ]);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('tool_result');
      // Security fix: only name, input, output, isError are copied (no arbitrary properties)
      expect(chunks[0]?.metadata?.time).toBeUndefined();
      expect(chunks[0]?.metadata?.output).toEqual({ result: 'ok' });
      expect(chunks[0]?.metadata?.name).toBe('analyze_config');
    });
  });

  describe('delta tracking (streaming duplicate fix)', () => {
    it('should calculate deltas when SDK sends accumulated text in each event', async () => {
      // Simulate real Opencode SDK behavior - each event has FULL accumulated text
      const chunks = await adaptEvents([
        textEvent('Hello', 'part1'),
        textEvent('Hello world', 'part1'),
        textEvent('Hello world!', 'part1'),
      ]);
      expect(chunks).toHaveLength(3);
      expect(chunks[0]?.content).toBe('Hello'); // First chunk: full text
      expect(chunks[1]?.content).toBe(' world'); // Second chunk: only delta
      expect(chunks[2]?.content).toBe('!'); // Third chunk: only delta
    });

    it('should handle multiple parts with separate state tracking', async () => {
      const chunks = await adaptEvents([
        textEvent('First', 'part1'),
        textEvent('Second', 'part2'),
        textEvent('First part', 'part1'),
        textEvent('Second part', 'part2'),
      ]);
      expect(chunks).toHaveLength(4);
      expect(chunks[0]?.content).toBe('First');
      expect(chunks[1]?.content).toBe('Second');
      expect(chunks[2]?.content).toBe(' part'); // Delta for part1
      expect(chunks[3]?.content).toBe(' part'); // Delta for part2
    });

    it('should handle duplicate events (no new content)', async () => {
      const chunks = await adaptEvents([
        textEvent('Hello', 'part1'),
        textEvent('Hello', 'part1'), // Duplicate
        textEvent('Hello world', 'part1'),
      ]);
      expect(chunks).toHaveLength(2); // Duplicate filtered out
      expect(chunks[0]?.content).toBe('Hello');
      expect(chunks[1]?.content).toBe(' world');
    });

    it('should use default part ID when no ID provided', async () => {
      const chunks = await adaptEvents([
        textEvent('First'), // No ID
        textEvent('First chunk'), // No ID
      ]);
      expect(chunks).toHaveLength(2);
      expect(chunks[0]?.content).toBe('First');
      expect(chunks[1]?.content).toBe(' chunk');
    });
  });

  describe('edge cases', () => {
    it('should propagate isError in tool result metadata', async () => {
      const chunks = await adaptEvents([
        toolCompletedEvent('broken_tool', { output: 'fail', isError: true }),
      ]);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('tool_result');
      expect(chunks[0]?.metadata?.isError).toBe(true);
    });

    it('should handle message.updated with only tokens', async () => {
      const chunks = await adaptEvents([messageUpdatedEvent({ tokens: { input: 10, output: 5 } })]);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('status');
      expect(chunks[0]?.metadata?.tokens).toEqual({ input: 10, output: 5 });
      expect('cost' in (chunks[0]?.metadata ?? {})).toBe(false);
      expect('finish' in (chunks[0]?.metadata ?? {})).toBe(false);
    });

    it('should handle message.updated with only cost', async () => {
      const chunks = await adaptEvents([messageUpdatedEvent({ cost: 0.001 })]);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('status');
      expect(chunks[0]?.metadata?.cost).toBe(0.001);
      expect('tokens' in (chunks[0]?.metadata ?? {})).toBe(false);
      expect('finish' in (chunks[0]?.metadata ?? {})).toBe(false);
    });

    it('should handle message.updated with only finish', async () => {
      const chunks = await adaptEvents([messageUpdatedEvent({ finish: 'stop' })]);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('status');
      expect(chunks[0]?.metadata?.finish).toBe('stop');
      expect('tokens' in (chunks[0]?.metadata ?? {})).toBe(false);
      expect('cost' in (chunks[0]?.metadata ?? {})).toBe(false);
    });

    it('should yield zero chunks for empty event stream', async () => {
      const chunks = await adaptEvents([]);
      expect(chunks).toHaveLength(0);
    });

    it('should handle null data gracefully for all event types', async () => {
      const chunks = await adaptEvents([
        { type: 'message.part.updated', properties: null },
        { type: 'tool.call.started', properties: null },
        { type: 'tool.call.completed', properties: null },
        { type: 'status.updated', properties: null },
        { type: 'message.updated', properties: null },
        { type: 'session.error', properties: null },
      ]);

      // message.part.updated with null data → extractText returns '', delta is empty, filtered out
      // tool.call.started with null data → extractToolName returns 'unknown'
      expect(chunks[0]?.type).toBe('tool_start');
      expect(chunks[0]?.content).toContain('unknown');

      // tool.call.completed with null data → extractToolName returns 'unknown'
      expect(chunks[1]?.type).toBe('tool_result');
      expect(chunks[1]?.content).toContain('unknown');

      // status.updated with null data → extractStatus returns 'status update'
      expect(chunks[2]?.type).toBe('status');
      expect(chunks[2]?.content).toBe('status update');

      // message.updated with null data → filtered out (isMessageEventData returns false)
      // session.error with null data → 'Unknown session error'
      expect(chunks[3]?.type).toBe('error');
      expect(chunks[3]?.content).toBe('Unknown session error');

      expect(chunks).toHaveLength(4);
    });

    it('should handle non-string text values', async () => {
      const chunks = await adaptEvents([
        { type: 'message.part.updated', properties: { text: 42 } },
      ]);
      // Non-string text → extractText returns '', delta is empty, filtered out
      expect(chunks).toHaveLength(0);
    });

    it('should handle non-string status values', async () => {
      const chunks = await adaptEvents([statusEvent(123)]);
      expectSingleChunk(chunks, { type: 'status', content: 'status update' });
    });

    it('should handle tool events with undefined data', async () => {
      const chunks = await adaptEvents([
        { type: 'tool.call.started' },
        { type: 'tool.call.completed' },
      ]);
      expect(chunks).toHaveLength(2);
      expect(chunks[0]?.type).toBe('tool_start');
      expect(chunks[0]?.content).toContain('unknown');
      expect(chunks[1]?.type).toBe('tool_result');
      expect(chunks[1]?.content).toContain('unknown');
    });
  });
});
