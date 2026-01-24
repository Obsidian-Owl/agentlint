/**
 * Unit tests for file access extraction
 *
 * Tests file operation tracking from session entries.
 *
 * @module tests/unit/sessions/extraction/file-accesses.test.ts
 */

import { describe, it, expect } from 'bun:test';
import type { SessionEntry } from '../../../../src/tools/sessions/types';
import {
  extractFileAccesses,
  aggregateFileAccesses,
} from '../../../../src/sessions/extraction/file-accesses';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create an assistant entry with a tool use block.
 */
function createToolUseEntry(
  toolId: string,
  toolName: string,
  input: Record<string, unknown>,
  timestamp: string,
  lineNumber: number
): SessionEntry {
  return {
    type: 'assistant',
    uuid: `assistant-${lineNumber}`,
    timestamp,
    lineNumber,
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: toolId,
          name: toolName,
          input,
        },
      ],
    },
  };
}

/**
 * Create a tool result entry.
 */
function createToolResult(
  toolUseId: string,
  content: string,
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
      isError: false,
    },
  };
}

// =============================================================================
// File Access Extraction Tests (T031)
// =============================================================================

describe('extractFileAccesses', () => {
  describe('Read tool', () => {
    it('should extract read operation from Read tool', () => {
      const entries: SessionEntry[] = [
        createToolUseEntry(
          'tool-1',
          'Read',
          { file_path: '/src/index.ts' },
          '2026-01-24T00:00:00Z',
          1
        ),
        createToolResult('tool-1', 'File contents...', '2026-01-24T00:00:01Z', 2),
      ];

      const accesses = extractFileAccesses(entries, 'session-123');

      expect(accesses).toHaveLength(1);
      expect(accesses[0]!.filePath).toBe('/src/index.ts');
      expect(accesses[0]!.operation).toBe('read');
      expect(accesses[0]!.sessionId).toBe('session-123');
      expect(accesses[0]!.timestamp).toBe('2026-01-24T00:00:00Z');
    });

    it('should track access sequence order', () => {
      const entries: SessionEntry[] = [
        createToolUseEntry('tool-1', 'Read', { file_path: '/src/a.ts' }, '2026-01-24T00:00:00Z', 1),
        createToolResult('tool-1', 'A', '2026-01-24T00:00:01Z', 2),
        createToolUseEntry('tool-2', 'Read', { file_path: '/src/b.ts' }, '2026-01-24T00:00:02Z', 3),
        createToolResult('tool-2', 'B', '2026-01-24T00:00:03Z', 4),
        createToolUseEntry('tool-3', 'Read', { file_path: '/src/c.ts' }, '2026-01-24T00:00:04Z', 5),
        createToolResult('tool-3', 'C', '2026-01-24T00:00:05Z', 6),
      ];

      const accesses = extractFileAccesses(entries, 'session-seq');

      expect(accesses).toHaveLength(3);
      expect(accesses[0]!.accessSequence).toBe(0);
      expect(accesses[1]!.accessSequence).toBe(1);
      expect(accesses[2]!.accessSequence).toBe(2);
    });
  });

  describe('Write tool', () => {
    it('should extract write operation from Write tool', () => {
      const entries: SessionEntry[] = [
        createToolUseEntry(
          'tool-1',
          'Write',
          { file_path: '/src/new-file.ts', content: 'export {}' },
          '2026-01-24T00:00:00Z',
          1
        ),
        createToolResult('tool-1', 'File written', '2026-01-24T00:00:01Z', 2),
      ];

      const accesses = extractFileAccesses(entries, 'session-write');

      expect(accesses).toHaveLength(1);
      expect(accesses[0]!.filePath).toBe('/src/new-file.ts');
      expect(accesses[0]!.operation).toBe('write');
    });
  });

  describe('Edit tool', () => {
    it('should extract edit operation from Edit tool', () => {
      const entries: SessionEntry[] = [
        createToolUseEntry(
          'tool-1',
          'Edit',
          { file_path: '/src/index.ts', old_string: 'foo', new_string: 'bar' },
          '2026-01-24T00:00:00Z',
          1
        ),
        createToolResult('tool-1', 'File edited', '2026-01-24T00:00:01Z', 2),
      ];

      const accesses = extractFileAccesses(entries, 'session-edit');

      expect(accesses).toHaveLength(1);
      expect(accesses[0]!.filePath).toBe('/src/index.ts');
      expect(accesses[0]!.operation).toBe('edit');
    });
  });

  describe('Glob tool', () => {
    it('should not extract file accesses from Glob (pattern, not file)', () => {
      const entries: SessionEntry[] = [
        createToolUseEntry('tool-1', 'Glob', { pattern: '**/*.ts' }, '2026-01-24T00:00:00Z', 1),
        createToolResult('tool-1', '["/src/a.ts", "/src/b.ts"]', '2026-01-24T00:00:01Z', 2),
      ];

      const accesses = extractFileAccesses(entries, 'session-glob');

      expect(accesses).toHaveLength(0);
    });
  });

  describe('Bash tool with file operations', () => {
    it('should extract read from cat command', () => {
      const entries: SessionEntry[] = [
        createToolUseEntry(
          'tool-1',
          'Bash',
          { command: 'cat /src/config.json' },
          '2026-01-24T00:00:00Z',
          1
        ),
        createToolResult('tool-1', '{"key": "value"}', '2026-01-24T00:00:01Z', 2),
      ];

      const accesses = extractFileAccesses(entries, 'session-bash-cat');

      expect(accesses).toHaveLength(1);
      expect(accesses[0]!.filePath).toBe('/src/config.json');
      expect(accesses[0]!.operation).toBe('read');
    });

    it('should extract write from redirect (>)', () => {
      const entries: SessionEntry[] = [
        createToolUseEntry(
          'tool-1',
          'Bash',
          { command: 'echo "content" > /tmp/output.txt' },
          '2026-01-24T00:00:00Z',
          1
        ),
        createToolResult('tool-1', '', '2026-01-24T00:00:01Z', 2),
      ];

      const accesses = extractFileAccesses(entries, 'session-bash-redirect');

      expect(accesses).toHaveLength(1);
      expect(accesses[0]!.filePath).toBe('/tmp/output.txt');
      expect(accesses[0]!.operation).toBe('write');
    });

    it('should not extract non-file bash commands', () => {
      const entries: SessionEntry[] = [
        createToolUseEntry('tool-1', 'Bash', { command: 'npm install' }, '2026-01-24T00:00:00Z', 1),
        createToolResult('tool-1', 'added 100 packages', '2026-01-24T00:00:01Z', 2),
      ];

      const accesses = extractFileAccesses(entries, 'session-bash-npm');

      expect(accesses).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty entries', () => {
      const accesses = extractFileAccesses([], 'session-empty');

      expect(accesses).toHaveLength(0);
    });

    it('should skip entries without tool use blocks', () => {
      const entries: SessionEntry[] = [
        {
          type: 'user',
          uuid: 'user-1',
          timestamp: '2026-01-24T00:00:00Z',
          lineNumber: 1,
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Hello' }],
          },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          timestamp: '2026-01-24T00:00:01Z',
          lineNumber: 2,
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hi!' }],
          },
        },
      ];

      const accesses = extractFileAccesses(entries, 'session-no-tools');

      expect(accesses).toHaveLength(0);
    });

    it('should handle missing file_path in tool input gracefully', () => {
      const entries: SessionEntry[] = [
        createToolUseEntry('tool-1', 'Read', {}, '2026-01-24T00:00:00Z', 1),
        createToolResult('tool-1', 'Error', '2026-01-24T00:00:01Z', 2),
      ];

      const accesses = extractFileAccesses(entries, 'session-no-path');

      expect(accesses).toHaveLength(0);
    });
  });
});

// =============================================================================
// File Access Aggregation Tests
// =============================================================================

describe('aggregateFileAccesses', () => {
  it('should aggregate accesses by file path', () => {
    const entries: SessionEntry[] = [
      createToolUseEntry(
        'tool-1',
        'Read',
        { file_path: '/src/index.ts' },
        '2026-01-24T00:00:00Z',
        1
      ),
      createToolResult('tool-1', 'Contents', '2026-01-24T00:00:01Z', 2),
      createToolUseEntry(
        'tool-2',
        'Edit',
        { file_path: '/src/index.ts' },
        '2026-01-24T00:00:02Z',
        3
      ),
      createToolResult('tool-2', 'Edited', '2026-01-24T00:00:03Z', 4),
      createToolUseEntry(
        'tool-3',
        'Read',
        { file_path: '/src/index.ts' },
        '2026-01-24T00:00:04Z',
        5
      ),
      createToolResult('tool-3', 'Contents', '2026-01-24T00:00:05Z', 6),
    ];

    const accesses = extractFileAccesses(entries, 'session-agg');
    const summary = aggregateFileAccesses(accesses);

    expect(summary).toHaveLength(1);
    expect(summary[0]!.filePath).toBe('/src/index.ts');
    expect(summary[0]!.operations.read).toBe(2);
    expect(summary[0]!.operations.edit).toBe(1);
    expect(summary[0]!.operations.write).toBe(0);
    expect(summary[0]!.totalAccesses).toBe(3);
  });

  it('should return summaries for multiple files', () => {
    const entries: SessionEntry[] = [
      createToolUseEntry('tool-1', 'Read', { file_path: '/src/a.ts' }, '2026-01-24T00:00:00Z', 1),
      createToolResult('tool-1', 'A', '2026-01-24T00:00:01Z', 2),
      createToolUseEntry('tool-2', 'Read', { file_path: '/src/b.ts' }, '2026-01-24T00:00:02Z', 3),
      createToolResult('tool-2', 'B', '2026-01-24T00:00:03Z', 4),
      createToolUseEntry('tool-3', 'Write', { file_path: '/src/c.ts' }, '2026-01-24T00:00:04Z', 5),
      createToolResult('tool-3', 'Written', '2026-01-24T00:00:05Z', 6),
    ];

    const accesses = extractFileAccesses(entries, 'session-multi');
    const summary = aggregateFileAccesses(accesses);

    expect(summary).toHaveLength(3);
    expect(summary.find((s) => s.filePath === '/src/a.ts')?.operations.read).toBe(1);
    expect(summary.find((s) => s.filePath === '/src/b.ts')?.operations.read).toBe(1);
    expect(summary.find((s) => s.filePath === '/src/c.ts')?.operations.write).toBe(1);
  });

  it('should sort by total accesses descending', () => {
    const entries: SessionEntry[] = [
      // File A - read 3 times
      createToolUseEntry('tool-1', 'Read', { file_path: '/src/a.ts' }, '2026-01-24T00:00:00Z', 1),
      createToolResult('tool-1', 'A', '2026-01-24T00:00:01Z', 2),
      createToolUseEntry('tool-2', 'Read', { file_path: '/src/a.ts' }, '2026-01-24T00:00:02Z', 3),
      createToolResult('tool-2', 'A', '2026-01-24T00:00:03Z', 4),
      createToolUseEntry('tool-3', 'Read', { file_path: '/src/a.ts' }, '2026-01-24T00:00:04Z', 5),
      createToolResult('tool-3', 'A', '2026-01-24T00:00:05Z', 6),
      // File B - read 1 time
      createToolUseEntry('tool-4', 'Read', { file_path: '/src/b.ts' }, '2026-01-24T00:00:06Z', 7),
      createToolResult('tool-4', 'B', '2026-01-24T00:00:07Z', 8),
    ];

    const accesses = extractFileAccesses(entries, 'session-sort');
    const summary = aggregateFileAccesses(accesses);

    expect(summary[0]!.filePath).toBe('/src/a.ts');
    expect(summary[0]!.totalAccesses).toBe(3);
    expect(summary[1]!.filePath).toBe('/src/b.ts');
    expect(summary[1]!.totalAccesses).toBe(1);
  });

  it('should return empty array for no accesses', () => {
    const summary = aggregateFileAccesses([]);

    expect(summary).toHaveLength(0);
  });
});
