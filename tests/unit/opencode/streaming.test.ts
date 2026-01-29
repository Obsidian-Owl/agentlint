import { describe, expect, it } from 'bun:test';
import { StreamAdapter, type OpencodeEvent } from '../../../src/opencode/streaming';

async function* createMockEventStream(events: OpencodeEvent[]): AsyncIterable<OpencodeEvent> {
  for (const event of events) {
    yield event;
  }
}

describe('StreamAdapter', () => {
  describe('adaptStream', () => {
    it('should convert text events to StreamChunks', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [
        {
          type: 'message.part.updated',
          properties: { part: { type: 'text', text: 'Hello world' } },
        },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('text');
      expect(chunks[0]?.content).toBe('Hello world');
      expect(chunks[0]?.level).toBe('normal');
    });

    it('should convert tool start events', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [
        { type: 'tool.call.started', properties: { name: 'analyze_config' } },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('tool_start');
      expect(chunks[0]?.content).toContain('analyze_config');
      expect(chunks[0]?.level).toBe('verbose');
    });

    it('should convert tool result events', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [
        { type: 'tool.call.completed', properties: { name: 'analyze_config' } },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('tool_result');
      expect(chunks[0]?.content).toContain('analyze_config');
    });

    it('should convert status events', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [
        { type: 'status.updated', properties: { status: 'thinking' } },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('status');
      expect(chunks[0]?.content).toBe('thinking');
    });

    it('should skip unknown event types', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [
        { type: 'unknown.event', properties: {} },
        { type: 'message.part.updated', properties: { part: { type: 'text', text: 'visible' } } },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.content).toBe('visible');
    });

    it('should handle multiple events in sequence', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [
        { type: 'message.part.updated', properties: { text: 'First' } },
        { type: 'tool.call.started', properties: { name: 'tool1' } },
        { type: 'tool.call.completed', properties: { name: 'tool1' } },
        { type: 'message.part.updated', properties: { text: 'Second' } },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(4);
      expect(chunks[0]?.type).toBe('text');
      expect(chunks[1]?.type).toBe('tool_start');
      expect(chunks[2]?.type).toBe('tool_result');
      expect(chunks[3]?.type).toBe('text');
    });

    it('should convert message.updated events with tokens and cost', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [
        {
          type: 'message.updated',
          properties: {
            tokens: { input: 100, output: 50, reasoning: 10, cache: { read: 20, write: 5 } },
            cost: 0.003,
            finish: 'end_turn',
          },
        },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

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
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [{ type: 'message.updated', properties: {} }];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(0);
    });

    it('should convert session.error events', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [
        { type: 'session.error', properties: { message: 'Rate limit exceeded', code: 429 } },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('error');
      expect(chunks[0]?.content).toBe('Rate limit exceeded');
      // Security fix: only 'message' is copied from error events (no arbitrary properties)
      expect(chunks[0]?.metadata?.message).toBe('Rate limit exceeded');
      expect(chunks[0]?.metadata?.code).toBeUndefined();
    });

    it('should handle session.error with no data', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [{ type: 'session.error' }];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('error');
      expect(chunks[0]?.content).toBe('Unknown session error');
    });

    it('should include timing data in tool.call.completed metadata', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [
        {
          type: 'tool.call.completed',
          properties: {
            name: 'analyze_config',
            time: { start: 1000, end: 2000 },
            output: { result: 'ok' },
          },
        },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('tool_result');
      // Security fix: only name, input, output, isError are copied (no arbitrary properties)
      expect(chunks[0]?.metadata?.time).toBeUndefined();
      expect(chunks[0]?.metadata?.output).toEqual({ result: 'ok' });
      expect(chunks[0]?.metadata?.name).toBe('analyze_config');
    });
  });

  describe('edge cases', () => {
    it('should propagate isError in tool result metadata', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [
        {
          type: 'tool.call.completed',
          properties: { name: 'broken_tool', output: 'fail', isError: true },
        },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('tool_result');
      expect(chunks[0]?.metadata?.isError).toBe(true);
    });

    it('should handle message.updated with only tokens', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [
        {
          type: 'message.updated',
          properties: { tokens: { input: 10, output: 5 } },
        },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('status');
      expect(chunks[0]?.metadata?.tokens).toEqual({ input: 10, output: 5 });
      expect('cost' in (chunks[0]?.metadata ?? {})).toBe(false);
      expect('finish' in (chunks[0]?.metadata ?? {})).toBe(false);
    });

    it('should handle message.updated with only cost', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [
        {
          type: 'message.updated',
          properties: { cost: 0.001 },
        },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('status');
      expect(chunks[0]?.metadata?.cost).toBe(0.001);
      expect('tokens' in (chunks[0]?.metadata ?? {})).toBe(false);
      expect('finish' in (chunks[0]?.metadata ?? {})).toBe(false);
    });

    it('should handle message.updated with only finish', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [
        {
          type: 'message.updated',
          properties: { finish: 'stop' },
        },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('status');
      expect(chunks[0]?.metadata?.finish).toBe('stop');
      expect('tokens' in (chunks[0]?.metadata ?? {})).toBe(false);
      expect('cost' in (chunks[0]?.metadata ?? {})).toBe(false);
    });

    it('should yield zero chunks for empty event stream', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(0);
    });

    it('should handle null data gracefully for all event types', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [
        { type: 'message.part.updated', properties: null },
        { type: 'tool.call.started', properties: null },
        { type: 'tool.call.completed', properties: null },
        { type: 'status.updated', properties: null },
        { type: 'message.updated', properties: null },
        { type: 'session.error', properties: null },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      // message.part.updated with null data → extractText returns ''
      expect(chunks[0]?.type).toBe('text');
      expect(chunks[0]?.content).toBe('');

      // tool.call.started with null data → extractToolName returns 'unknown'
      expect(chunks[1]?.type).toBe('tool_start');
      expect(chunks[1]?.content).toContain('unknown');

      // tool.call.completed with null data → extractToolName returns 'unknown'
      expect(chunks[2]?.type).toBe('tool_result');
      expect(chunks[2]?.content).toContain('unknown');

      // status.updated with null data → extractStatus returns 'status update'
      expect(chunks[3]?.type).toBe('status');
      expect(chunks[3]?.content).toBe('status update');

      // message.updated with null data → filtered out (isMessageEventData returns false)
      // session.error with null data → 'Unknown session error'
      expect(chunks[4]?.type).toBe('error');
      expect(chunks[4]?.content).toBe('Unknown session error');

      expect(chunks).toHaveLength(5);
    });

    it('should handle non-string text values', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [{ type: 'message.part.updated', properties: { text: 42 } }];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('text');
      expect(chunks[0]?.content).toBe('');
    });

    it('should handle non-string status values', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [{ type: 'status.updated', properties: { status: 123 } }];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('status');
      expect(chunks[0]?.content).toBe('status update');
    });

    it('should handle tool events with undefined data', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [
        { type: 'tool.call.started' },
        { type: 'tool.call.completed' },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]?.type).toBe('tool_start');
      expect(chunks[0]?.content).toContain('unknown');
      expect(chunks[1]?.type).toBe('tool_result');
      expect(chunks[1]?.content).toContain('unknown');
    });
  });
});
