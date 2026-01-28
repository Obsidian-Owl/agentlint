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
        { type: 'message.part.updated', data: { text: 'Hello world' } },
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
        { type: 'tool.call.started', data: { name: 'analyze_config' } },
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
        { type: 'tool.call.completed', data: { name: 'analyze_config' } },
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
      const events: OpencodeEvent[] = [{ type: 'status.updated', data: { status: 'thinking' } }];

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
        { type: 'unknown.event', data: {} },
        { type: 'message.part.updated', data: { text: 'visible' } },
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
        { type: 'message.part.updated', data: { text: 'First' } },
        { type: 'tool.call.started', data: { name: 'tool1' } },
        { type: 'tool.call.completed', data: { name: 'tool1' } },
        { type: 'message.part.updated', data: { text: 'Second' } },
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
          data: {
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
      const events: OpencodeEvent[] = [{ type: 'message.updated', data: {} }];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(0);
    });

    it('should convert session.error events', async () => {
      const adapter = new StreamAdapter();
      const events: OpencodeEvent[] = [
        { type: 'session.error', data: { message: 'Rate limit exceeded', code: 429 } },
      ];

      const chunks = [];
      for await (const chunk of adapter.adaptStream(createMockEventStream(events))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('error');
      expect(chunks[0]?.content).toBe('Rate limit exceeded');
      expect(chunks[0]?.metadata?.code).toBe(429);
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
          data: {
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
      expect(chunks[0]?.metadata?.time).toEqual({ start: 1000, end: 2000 });
      expect(chunks[0]?.metadata?.output).toEqual({ result: 'ok' });
    });
  });
});
