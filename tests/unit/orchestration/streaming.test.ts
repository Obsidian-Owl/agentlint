/**
 * EP02 Orchestration Core - Streaming Tests
 *
 * Tests for T027, T028:
 * - T027: StreamProcessor converts SDK messages to StreamChunks
 * - T028: filterByVerbosity() filters chunks correctly
 */

import { describe, test, expect } from 'bun:test';
import type { StreamChunk, VerbosityLevel } from '../../../src/orchestration/types';
import {
  StreamProcessor,
  filterByVerbosity,
  shouldDisplay,
  createStreamChunk,
} from '../../../src/orchestration/streaming';

// =============================================================================
// T027: StreamProcessor converts SDK messages to StreamChunks
// =============================================================================

describe('StreamProcessor', () => {
  describe('process()', () => {
    test('converts assistant text message to text chunk', () => {
      const processor = new StreamProcessor();
      const message = {
        type: 'assistant',
        content: [{ type: 'text', text: 'Analyzing the configuration...' }],
      };

      const chunks = processor.process(message);

      expect(chunks).toHaveLength(1);
      const chunk = chunks[0]!;
      expect(chunk.type).toBe('text');
      expect(chunk.content).toBe('Analyzing the configuration...');
      expect(chunk.level).toBe('normal');
    });

    test('converts tool_use message to tool_start chunk', () => {
      const processor = new StreamProcessor();
      const message = {
        type: 'assistant',
        content: [
          {
            type: 'tool_use',
            name: 'read_file',
            input: { path: '/test/file.ts' },
          },
        ],
      };

      const chunks = processor.process(message);

      expect(chunks).toHaveLength(1);
      const chunk = chunks[0]!;
      expect(chunk.type).toBe('tool_start');
      expect(chunk.content).toContain('read_file');
      expect(chunk.level).toBe('verbose');
      expect(chunk.metadata?.toolName).toBe('read_file');
    });

    test('converts tool_result message to tool_result chunk', () => {
      const processor = new StreamProcessor();
      const message = {
        type: 'tool_result',
        tool_use_id: 'tool_123',
        content: 'File contents here',
      };

      const chunks = processor.process(message);

      expect(chunks).toHaveLength(1);
      const chunk = chunks[0]!;
      expect(chunk.type).toBe('tool_result');
      expect(chunk.level).toBe('verbose');
      expect(chunk.metadata?.toolId).toBe('tool_123');
    });

    test('converts result message to status chunk', () => {
      const processor = new StreamProcessor();
      const message = {
        type: 'result',
        session_id: 'session_123',
        input_tokens: 1000,
        output_tokens: 500,
      };

      const chunks = processor.process(message);

      expect(chunks).toHaveLength(1);
      const chunk = chunks[0]!;
      expect(chunk.type).toBe('status');
      expect(chunk.level).toBe('normal');
      expect(chunk.metadata?.sessionId).toBe('session_123');
    });

    test('handles multiple content blocks in one message', () => {
      const processor = new StreamProcessor();
      const message = {
        type: 'assistant',
        content: [
          { type: 'text', text: 'Let me check the file.' },
          { type: 'tool_use', name: 'read_file', input: { path: '/test.ts' } },
        ],
      };

      const chunks = processor.process(message);

      expect(chunks).toHaveLength(2);
      expect(chunks[0]!.type).toBe('text');
      expect(chunks[1]!.type).toBe('tool_start');
    });

    test('returns empty array for unknown message type', () => {
      const processor = new StreamProcessor();
      const message = { type: 'unknown', data: 'something' };

      const chunks = processor.process(message);

      expect(chunks).toEqual([]);
    });

    test('includes timestamp on all chunks', () => {
      const processor = new StreamProcessor();
      const message = {
        type: 'assistant',
        content: [{ type: 'text', text: 'Hello' }],
      };

      const chunks = processor.process(message);

      expect(chunks).toHaveLength(1);
      const chunk = chunks[0]!;
      expect(chunk.timestamp).toBeDefined();
      expect(new Date(chunk.timestamp).toISOString()).toBe(chunk.timestamp);
    });
  });
});

// =============================================================================
// T028: filterByVerbosity() filters chunks correctly
// =============================================================================

describe('filterByVerbosity()', () => {
  const createChunk = (level: VerbosityLevel): StreamChunk => ({
    type: 'text',
    level,
    content: `${level} content`,
    timestamp: new Date().toISOString(),
  });

  test('quiet level shows only quiet chunks', () => {
    const chunks = [
      createChunk('quiet'),
      createChunk('normal'),
      createChunk('verbose'),
      createChunk('debug'),
    ];

    const filtered = filterByVerbosity(chunks, 'quiet');

    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.level).toBe('quiet');
  });

  test('normal level shows quiet and normal chunks', () => {
    const chunks = [
      createChunk('quiet'),
      createChunk('normal'),
      createChunk('verbose'),
      createChunk('debug'),
    ];

    const filtered = filterByVerbosity(chunks, 'normal');

    expect(filtered).toHaveLength(2);
    expect(filtered.map((c) => c.level)).toEqual(['quiet', 'normal']);
  });

  test('verbose level shows quiet, normal, and verbose chunks', () => {
    const chunks = [
      createChunk('quiet'),
      createChunk('normal'),
      createChunk('verbose'),
      createChunk('debug'),
    ];

    const filtered = filterByVerbosity(chunks, 'verbose');

    expect(filtered).toHaveLength(3);
    expect(filtered.map((c) => c.level)).toEqual(['quiet', 'normal', 'verbose']);
  });

  test('debug level shows all chunks', () => {
    const chunks = [
      createChunk('quiet'),
      createChunk('normal'),
      createChunk('verbose'),
      createChunk('debug'),
    ];

    const filtered = filterByVerbosity(chunks, 'debug');

    expect(filtered).toHaveLength(4);
  });

  test('returns empty array for empty input', () => {
    const filtered = filterByVerbosity([], 'normal');
    expect(filtered).toEqual([]);
  });

  test('preserves chunk order', () => {
    const chunks = [
      { ...createChunk('quiet'), content: 'first' },
      { ...createChunk('quiet'), content: 'second' },
      { ...createChunk('quiet'), content: 'third' },
    ];

    const filtered = filterByVerbosity(chunks, 'quiet');

    expect(filtered.map((c) => c.content)).toEqual(['first', 'second', 'third']);
  });
});

// =============================================================================
// shouldDisplay() helper
// =============================================================================

describe('shouldDisplay()', () => {
  test('quiet chunk visible at all levels', () => {
    expect(shouldDisplay('quiet', 'quiet')).toBe(true);
    expect(shouldDisplay('quiet', 'normal')).toBe(true);
    expect(shouldDisplay('quiet', 'verbose')).toBe(true);
    expect(shouldDisplay('quiet', 'debug')).toBe(true);
  });

  test('normal chunk visible at normal and above', () => {
    expect(shouldDisplay('normal', 'quiet')).toBe(false);
    expect(shouldDisplay('normal', 'normal')).toBe(true);
    expect(shouldDisplay('normal', 'verbose')).toBe(true);
    expect(shouldDisplay('normal', 'debug')).toBe(true);
  });

  test('verbose chunk visible at verbose and above', () => {
    expect(shouldDisplay('verbose', 'quiet')).toBe(false);
    expect(shouldDisplay('verbose', 'normal')).toBe(false);
    expect(shouldDisplay('verbose', 'verbose')).toBe(true);
    expect(shouldDisplay('verbose', 'debug')).toBe(true);
  });

  test('debug chunk visible only at debug level', () => {
    expect(shouldDisplay('debug', 'quiet')).toBe(false);
    expect(shouldDisplay('debug', 'normal')).toBe(false);
    expect(shouldDisplay('debug', 'verbose')).toBe(false);
    expect(shouldDisplay('debug', 'debug')).toBe(true);
  });
});

// =============================================================================
// createStreamChunk() helper
// =============================================================================

describe('createStreamChunk()', () => {
  test('creates chunk with required properties', () => {
    const chunk = createStreamChunk('text', 'normal', 'Hello world');

    expect(chunk.type).toBe('text');
    expect(chunk.level).toBe('normal');
    expect(chunk.content).toBe('Hello world');
    expect(chunk.timestamp).toBeDefined();
  });

  test('creates chunk with optional metadata', () => {
    const chunk = createStreamChunk('tool_start', 'verbose', 'Starting tool', {
      toolName: 'read_file',
      input: { path: '/test.ts' },
    });

    expect(chunk.metadata).toBeDefined();
    expect(chunk.metadata?.toolName).toBe('read_file');
    expect(chunk.metadata?.input).toEqual({ path: '/test.ts' });
  });

  test('creates timestamp in ISO-8601 format', () => {
    const before = new Date();
    const chunk = createStreamChunk('status', 'quiet', 'Status');
    const after = new Date();

    const chunkTime = new Date(chunk.timestamp);
    expect(chunkTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(chunkTime.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
