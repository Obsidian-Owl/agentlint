/**
 * Unit tests for tool sequence extraction
 *
 * Tests tool call extraction, input hash calculation, and repeat pattern detection.
 *
 * @module tests/unit/sessions/extraction/tool-sequences.test.ts
 */

import { describe, it, expect } from 'bun:test';
import type { SessionEntry } from '../../../../src/tools/sessions/types';
import {
  extractToolSequences,
  calculateInputHash,
  detectRepeatPatterns,
} from '../../../../src/sessions/extraction/tool-sequences';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a minimal assistant entry with tool use blocks.
 */
function createAssistantWithTools(
  timestamp: string,
  lineNumber: number,
  tools: Array<{ id: string; name: string; input: Record<string, unknown> }>
): SessionEntry {
  return {
    type: 'assistant',
    uuid: `assistant-${lineNumber}`,
    timestamp,
    lineNumber,
    message: {
      role: 'assistant',
      content: tools.map((tool) => ({
        type: 'tool_use' as const,
        id: tool.id,
        name: tool.name,
        input: tool.input,
      })),
    },
  };
}

/**
 * Create a tool result entry.
 */
function createToolResult(
  toolUseId: string,
  content: string,
  isError: boolean,
  timestamp: string,
  lineNumber: number
): SessionEntry {
  return {
    type: 'tool_result',
    uuid: `result-${lineNumber}`,
    timestamp,
    lineNumber,
    toolResult: {
      toolUseId,
      content,
      isError,
    },
  };
}

/**
 * Create a user entry.
 */
function createUserEntry(content: string, timestamp: string, lineNumber: number): SessionEntry {
  return {
    type: 'user',
    uuid: `user-${lineNumber}`,
    timestamp,
    lineNumber,
    message: {
      role: 'user',
      content: [{ type: 'text', text: content }],
    },
  };
}

// =============================================================================
// Tool Sequence Extraction Tests (T029)
// =============================================================================

describe('extractToolSequences', () => {
  it('should extract tool calls from assistant messages', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Read the file', '2026-01-24T00:00:00Z', 1),
      createAssistantWithTools('2026-01-24T00:00:01Z', 2, [
        { id: 'tool-1', name: 'Read', input: { file_path: '/src/index.ts' } },
      ]),
      createToolResult('tool-1', 'File contents...', false, '2026-01-24T00:00:02Z', 3),
    ];

    const sequences = extractToolSequences(entries, 'session-123');

    expect(sequences).toHaveLength(1);
    expect(sequences[0]!.toolName).toBe('Read');
    expect(sequences[0]!.sessionId).toBe('session-123');
    expect(sequences[0]!.sequenceIndex).toBe(0);
    expect(sequences[0]!.isError).toBe(false);
    expect(sequences[0]!.timestamp).toBe('2026-01-24T00:00:01Z');
  });

  it('should extract multiple tool calls in sequence order', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Edit files', '2026-01-24T00:00:00Z', 1),
      createAssistantWithTools('2026-01-24T00:00:01Z', 2, [
        { id: 'tool-1', name: 'Read', input: { file_path: '/src/a.ts' } },
      ]),
      createToolResult('tool-1', 'Contents A', false, '2026-01-24T00:00:02Z', 3),
      createAssistantWithTools('2026-01-24T00:00:03Z', 4, [
        { id: 'tool-2', name: 'Edit', input: { file_path: '/src/a.ts' } },
      ]),
      createToolResult('tool-2', 'Edited', false, '2026-01-24T00:00:04Z', 5),
      createAssistantWithTools('2026-01-24T00:00:05Z', 6, [
        { id: 'tool-3', name: 'Bash', input: { command: 'npm test' } },
      ]),
      createToolResult('tool-3', 'Tests passed', false, '2026-01-24T00:00:06Z', 7),
    ];

    const sequences = extractToolSequences(entries, 'session-456');

    expect(sequences).toHaveLength(3);
    expect(sequences[0]!.toolName).toBe('Read');
    expect(sequences[0]!.sequenceIndex).toBe(0);
    expect(sequences[1]!.toolName).toBe('Edit');
    expect(sequences[1]!.sequenceIndex).toBe(1);
    expect(sequences[2]!.toolName).toBe('Bash');
    expect(sequences[2]!.sequenceIndex).toBe(2);
  });

  it('should handle multiple tools in single assistant message', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Read both files', '2026-01-24T00:00:00Z', 1),
      createAssistantWithTools('2026-01-24T00:00:01Z', 2, [
        { id: 'tool-1', name: 'Read', input: { file_path: '/src/a.ts' } },
        { id: 'tool-2', name: 'Read', input: { file_path: '/src/b.ts' } },
      ]),
      createToolResult('tool-1', 'Contents A', false, '2026-01-24T00:00:02Z', 3),
      createToolResult('tool-2', 'Contents B', false, '2026-01-24T00:00:03Z', 4),
    ];

    const sequences = extractToolSequences(entries, 'session-789');

    expect(sequences).toHaveLength(2);
    expect(sequences[0]!.sequenceIndex).toBe(0);
    expect(sequences[1]!.sequenceIndex).toBe(1);
  });

  it('should detect errors from tool results', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Run tests', '2026-01-24T00:00:00Z', 1),
      createAssistantWithTools('2026-01-24T00:00:01Z', 2, [
        { id: 'tool-1', name: 'Bash', input: { command: 'npm test' } },
      ]),
      createToolResult('tool-1', 'Error: 5 tests failed', true, '2026-01-24T00:00:02Z', 3),
    ];

    const sequences = extractToolSequences(entries, 'session-err');

    expect(sequences).toHaveLength(1);
    expect(sequences[0]!.isError).toBe(true);
    expect(sequences[0]!.errorMessage).toBe('Error: 5 tests failed');
  });

  it('should include file path and line number for causal tracing', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Read', '2026-01-24T00:00:00Z', 1),
      {
        ...createAssistantWithTools('2026-01-24T00:00:01Z', 42, [
          { id: 'tool-1', name: 'Read', input: { file_path: '/test.ts' } },
        ]),
        filePath: '/Users/test/.claude/sessions/session.jsonl',
      },
      createToolResult('tool-1', 'Contents', false, '2026-01-24T00:00:02Z', 43),
    ];

    const sequences = extractToolSequences(entries, 'session-trace');

    expect(sequences[0]!.filePath).toBe('/Users/test/.claude/sessions/session.jsonl');
    expect(sequences[0]!.lineNumber).toBe(42);
  });

  it('should return empty array when no tool calls', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Hello', '2026-01-24T00:00:00Z', 1),
      {
        type: 'assistant',
        uuid: 'assistant-1',
        timestamp: '2026-01-24T00:00:01Z',
        lineNumber: 2,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello!' }],
        },
      },
    ];

    const sequences = extractToolSequences(entries, 'session-no-tools');

    expect(sequences).toHaveLength(0);
  });

  it('should skip entries without messages', () => {
    const entries: SessionEntry[] = [
      {
        type: 'summary',
        uuid: 'summary-1',
        timestamp: '2026-01-24T00:00:00Z',
        lineNumber: 1,
        summary: 'Session summary...',
      },
      createUserEntry('Continue', '2026-01-24T00:00:01Z', 2),
    ];

    const sequences = extractToolSequences(entries, 'session-summary');

    expect(sequences).toHaveLength(0);
  });
});

// =============================================================================
// Input Hash Calculation Tests (T030)
// =============================================================================

describe('calculateInputHash', () => {
  it('should calculate consistent SHA-256 hash for same input', () => {
    const input = { file_path: '/src/index.ts' };

    const hash1 = calculateInputHash(input);
    const hash2 = calculateInputHash(input);

    expect(hash1).toBe(hash2);
    // SHA-256 produces 64 character hex string
    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should produce different hashes for different inputs', () => {
    const input1 = { file_path: '/src/a.ts' };
    const input2 = { file_path: '/src/b.ts' };

    const hash1 = calculateInputHash(input1);
    const hash2 = calculateInputHash(input2);

    expect(hash1).not.toBe(hash2);
  });

  it('should handle complex nested inputs', () => {
    const input = {
      old_string: 'function foo() {}',
      new_string: 'function bar() {}',
      options: {
        preserve_formatting: true,
        lines: [1, 2, 3],
      },
    };

    const hash = calculateInputHash(input);

    expect(hash).toHaveLength(64);
  });

  it('should produce same hash regardless of key order', () => {
    const input1 = { a: 1, b: 2, c: 3 };
    const input2 = { c: 3, a: 1, b: 2 };

    const hash1 = calculateInputHash(input1);
    const hash2 = calculateInputHash(input2);

    expect(hash1).toBe(hash2);
  });

  it('should handle empty input object', () => {
    const hash = calculateInputHash({});

    expect(hash).toHaveLength(64);
  });

  it('should handle null/undefined values in input', () => {
    const input = { file_path: '/test.ts', optional: null };

    const hash = calculateInputHash(input);

    expect(hash).toHaveLength(64);
  });
});

// =============================================================================
// Repeat Pattern Detection Tests (T030)
// =============================================================================

describe('detectRepeatPatterns', () => {
  it('should detect repeated tool calls with same input hash', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Read the file', '2026-01-24T00:00:00Z', 1),
      createAssistantWithTools('2026-01-24T00:00:01Z', 2, [
        { id: 'tool-1', name: 'Read', input: { file_path: '/src/index.ts' } },
      ]),
      createToolResult('tool-1', 'Contents...', false, '2026-01-24T00:00:02Z', 3),
      createAssistantWithTools('2026-01-24T00:00:03Z', 4, [
        { id: 'tool-2', name: 'Read', input: { file_path: '/src/index.ts' } },
      ]),
      createToolResult('tool-2', 'Contents...', false, '2026-01-24T00:00:04Z', 5),
      createAssistantWithTools('2026-01-24T00:00:05Z', 6, [
        { id: 'tool-3', name: 'Read', input: { file_path: '/src/index.ts' } },
      ]),
      createToolResult('tool-3', 'Contents...', false, '2026-01-24T00:00:06Z', 7),
    ];

    const sequences = extractToolSequences(entries, 'session-repeat');
    const patterns = detectRepeatPatterns(sequences);

    expect(patterns).toHaveLength(1);
    expect(patterns[0]!.toolName).toBe('Read');
    expect(patterns[0]!.repeatCount).toBe(3);
    expect(patterns[0]!.firstOccurrence).toBe(0);
    expect(patterns[0]!.lastOccurrence).toBe(2);
  });

  it('should not flag single occurrences as repeats', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Read files', '2026-01-24T00:00:00Z', 1),
      createAssistantWithTools('2026-01-24T00:00:01Z', 2, [
        { id: 'tool-1', name: 'Read', input: { file_path: '/src/a.ts' } },
      ]),
      createToolResult('tool-1', 'A', false, '2026-01-24T00:00:02Z', 3),
      createAssistantWithTools('2026-01-24T00:00:03Z', 4, [
        { id: 'tool-2', name: 'Read', input: { file_path: '/src/b.ts' } },
      ]),
      createToolResult('tool-2', 'B', false, '2026-01-24T00:00:04Z', 5),
    ];

    const sequences = extractToolSequences(entries, 'session-no-repeat');
    const patterns = detectRepeatPatterns(sequences);

    expect(patterns).toHaveLength(0);
  });

  it('should detect multiple different repeat patterns', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Read and test', '2026-01-24T00:00:00Z', 1),
      // Read /src/index.ts twice
      createAssistantWithTools('2026-01-24T00:00:01Z', 2, [
        { id: 'tool-1', name: 'Read', input: { file_path: '/src/index.ts' } },
      ]),
      createToolResult('tool-1', 'Contents', false, '2026-01-24T00:00:02Z', 3),
      createAssistantWithTools('2026-01-24T00:00:03Z', 4, [
        { id: 'tool-2', name: 'Read', input: { file_path: '/src/index.ts' } },
      ]),
      createToolResult('tool-2', 'Contents', false, '2026-01-24T00:00:04Z', 5),
      // Run tests twice
      createAssistantWithTools('2026-01-24T00:00:05Z', 6, [
        { id: 'tool-3', name: 'Bash', input: { command: 'npm test' } },
      ]),
      createToolResult('tool-3', 'Failed', true, '2026-01-24T00:00:06Z', 7),
      createAssistantWithTools('2026-01-24T00:00:07Z', 8, [
        { id: 'tool-4', name: 'Bash', input: { command: 'npm test' } },
      ]),
      createToolResult('tool-4', 'Passed', false, '2026-01-24T00:00:08Z', 9),
    ];

    const sequences = extractToolSequences(entries, 'session-multi-repeat');
    const patterns = detectRepeatPatterns(sequences);

    expect(patterns).toHaveLength(2);
    expect(patterns.find((p) => p.toolName === 'Read')?.repeatCount).toBe(2);
    expect(patterns.find((p) => p.toolName === 'Bash')?.repeatCount).toBe(2);
  });

  it('should track first and last occurrence indices correctly', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Run tests repeatedly', '2026-01-24T00:00:00Z', 1),
      // Other tool first
      createAssistantWithTools('2026-01-24T00:00:01Z', 2, [
        { id: 'tool-1', name: 'Read', input: { file_path: '/test.ts' } },
      ]),
      createToolResult('tool-1', 'Contents', false, '2026-01-24T00:00:02Z', 3),
      // Then repeated tests
      createAssistantWithTools('2026-01-24T00:00:03Z', 4, [
        { id: 'tool-2', name: 'Bash', input: { command: 'npm test' } },
      ]),
      createToolResult('tool-2', 'Failed', true, '2026-01-24T00:00:04Z', 5),
      createAssistantWithTools('2026-01-24T00:00:05Z', 6, [
        { id: 'tool-3', name: 'Bash', input: { command: 'npm test' } },
      ]),
      createToolResult('tool-3', 'Failed', true, '2026-01-24T00:00:06Z', 7),
      createAssistantWithTools('2026-01-24T00:00:07Z', 8, [
        { id: 'tool-4', name: 'Bash', input: { command: 'npm test' } },
      ]),
      createToolResult('tool-4', 'Passed', false, '2026-01-24T00:00:08Z', 9),
    ];

    const sequences = extractToolSequences(entries, 'session-indices');
    const patterns = detectRepeatPatterns(sequences);

    const bashPattern = patterns.find((p) => p.toolName === 'Bash');
    expect(bashPattern).toBeDefined();
    expect(bashPattern!.firstOccurrence).toBe(1); // Index 1 (after Read at index 0)
    expect(bashPattern!.lastOccurrence).toBe(3); // Index 3
    expect(bashPattern!.repeatCount).toBe(3);
  });

  it('should return empty array when sequences is empty', () => {
    const patterns = detectRepeatPatterns([]);

    expect(patterns).toHaveLength(0);
  });

  it('should use combined tool name and input hash as repeat key', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Edit different files', '2026-01-24T00:00:00Z', 1),
      // Edit file A twice
      createAssistantWithTools('2026-01-24T00:00:01Z', 2, [
        { id: 'tool-1', name: 'Edit', input: { file_path: '/a.ts', content: 'x' } },
      ]),
      createToolResult('tool-1', 'Edited', false, '2026-01-24T00:00:02Z', 3),
      createAssistantWithTools('2026-01-24T00:00:03Z', 4, [
        { id: 'tool-2', name: 'Edit', input: { file_path: '/a.ts', content: 'x' } },
      ]),
      createToolResult('tool-2', 'Edited', false, '2026-01-24T00:00:04Z', 5),
      // Edit file B once (same tool, different input)
      createAssistantWithTools('2026-01-24T00:00:05Z', 6, [
        { id: 'tool-3', name: 'Edit', input: { file_path: '/b.ts', content: 'y' } },
      ]),
      createToolResult('tool-3', 'Edited', false, '2026-01-24T00:00:06Z', 7),
    ];

    const sequences = extractToolSequences(entries, 'session-diff-files');
    const patterns = detectRepeatPatterns(sequences);

    // Only the repeated Edit of /a.ts should be detected
    expect(patterns).toHaveLength(1);
    expect(patterns[0]!.repeatCount).toBe(2);
  });
});

// =============================================================================
// Error Extraction Tests (T034 - included here for context)
// =============================================================================

describe('error extraction', () => {
  it('should extract error message from tool result', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Build', '2026-01-24T00:00:00Z', 1),
      createAssistantWithTools('2026-01-24T00:00:01Z', 2, [
        { id: 'tool-1', name: 'Bash', input: { command: 'npm run build' } },
      ]),
      createToolResult(
        'tool-1',
        'Error: Module not found: @types/foo',
        true,
        '2026-01-24T00:00:02Z',
        3
      ),
    ];

    const sequences = extractToolSequences(entries, 'session-error');

    expect(sequences[0]!.isError).toBe(true);
    expect(sequences[0]!.errorMessage).toBe('Error: Module not found: @types/foo');
  });

  it('should truncate very long error messages', () => {
    const longError = 'Error: ' + 'x'.repeat(2000);
    const entries: SessionEntry[] = [
      createUserEntry('Build', '2026-01-24T00:00:00Z', 1),
      createAssistantWithTools('2026-01-24T00:00:01Z', 2, [
        { id: 'tool-1', name: 'Bash', input: { command: 'npm run build' } },
      ]),
      createToolResult('tool-1', longError, true, '2026-01-24T00:00:02Z', 3),
    ];

    const sequences = extractToolSequences(entries, 'session-long-error');

    // Error message should be truncated to reasonable length
    expect(sequences[0]!.errorMessage!.length).toBeLessThanOrEqual(1024);
  });
});
