/**
 * Unit tests for delegation event extraction
 *
 * Tests Task tool detection and subagent type parsing from session entries.
 *
 * @module tests/unit/sessions/extraction/delegations.test.ts
 */

import { describe, it, expect } from 'bun:test';
import type { SessionEntry } from '../../../../src/tools/sessions/types';
import {
  extractDelegationEvents,
  aggregateDelegations,
} from '../../../../src/sessions/extraction/delegations';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create an assistant entry with a Task tool use block.
 */
function createTaskToolEntry(
  toolId: string,
  subagentType: string,
  prompt: string,
  timestamp: string,
  lineNumber: number,
  description?: string
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
          name: 'Task',
          input: {
            subagent_type: subagentType,
            prompt,
            description: description ?? `Run ${subagentType}`,
          },
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
  lineNumber: number,
  isError = false
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

// =============================================================================
// Delegation Detection Tests (T039)
// =============================================================================

describe('extractDelegationEvents', () => {
  describe('Task tool detection', () => {
    it('should extract delegation from Task tool call', () => {
      const entries: SessionEntry[] = [
        createTaskToolEntry('task-1', 'Explore', 'Find all test files', '2026-01-24T10:00:00Z', 1),
        createToolResult('task-1', 'Found 10 test files', '2026-01-24T10:00:10Z', 2),
      ];

      const events = extractDelegationEvents(entries, 'session-123');

      expect(events).toHaveLength(1);
      expect(events[0]!.subagentType).toBe('Explore');
      expect(events[0]!.taskPrompt).toBe('Find all test files');
      expect(events[0]!.sessionId).toBe('session-123');
      expect(events[0]!.success).toBe(true);
    });

    it('should track turn index correctly', () => {
      const entries: SessionEntry[] = [
        {
          type: 'user',
          uuid: 'user-1',
          timestamp: '2026-01-24T10:00:00Z',
          lineNumber: 1,
          message: { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          timestamp: '2026-01-24T10:00:01Z',
          lineNumber: 2,
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hi, let me help.' }],
          },
        },
        createTaskToolEntry('task-1', 'Explore', 'Find files', '2026-01-24T10:00:02Z', 3),
        createToolResult('task-1', 'Done', '2026-01-24T10:00:03Z', 4),
      ];

      const events = extractDelegationEvents(entries, 'session-idx');

      expect(events).toHaveLength(1);
      expect(events[0]!.turnIndex).toBe(2); // 0-indexed, third entry
    });

    it('should detect failed delegation', () => {
      const entries: SessionEntry[] = [
        createTaskToolEntry('task-1', 'Bash', 'Run npm test', '2026-01-24T10:00:00Z', 1),
        createToolResult('task-1', 'Error: tests failed', '2026-01-24T10:00:10Z', 2, true),
      ];

      const events = extractDelegationEvents(entries, 'session-fail');

      expect(events).toHaveLength(1);
      expect(events[0]!.success).toBe(false);
    });

    it('should extract multiple delegations', () => {
      const entries: SessionEntry[] = [
        createTaskToolEntry('task-1', 'Explore', 'Find test files', '2026-01-24T10:00:00Z', 1),
        createToolResult('task-1', 'Found files', '2026-01-24T10:00:05Z', 2),
        createTaskToolEntry('task-2', 'Bash', 'Run tests', '2026-01-24T10:00:10Z', 3),
        createToolResult('task-2', 'Tests passed', '2026-01-24T10:00:20Z', 4),
        createTaskToolEntry(
          'task-3',
          'general-purpose',
          'Analyze results',
          '2026-01-24T10:00:25Z',
          5
        ),
        createToolResult('task-3', 'Analysis complete', '2026-01-24T10:00:35Z', 6),
      ];

      const events = extractDelegationEvents(entries, 'session-multi');

      expect(events).toHaveLength(3);
      expect(events[0]!.subagentType).toBe('Explore');
      expect(events[1]!.subagentType).toBe('Bash');
      expect(events[2]!.subagentType).toBe('general-purpose');
    });

    it('should not extract non-Task tool calls', () => {
      const entries: SessionEntry[] = [
        {
          type: 'assistant',
          uuid: 'assistant-1',
          timestamp: '2026-01-24T10:00:00Z',
          lineNumber: 1,
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'read-1',
                name: 'Read',
                input: { file_path: '/src/index.ts' },
              },
            ],
          },
        },
        createToolResult('read-1', 'File contents', '2026-01-24T10:00:01Z', 2),
      ];

      const events = extractDelegationEvents(entries, 'session-no-task');

      expect(events).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty entries', () => {
      const events = extractDelegationEvents([], 'session-empty');

      expect(events).toHaveLength(0);
    });

    it('should handle Task call without result (assume pending)', () => {
      const entries: SessionEntry[] = [
        createTaskToolEntry('task-1', 'Explore', 'Find files', '2026-01-24T10:00:00Z', 1),
        // No result entry
      ];

      const events = extractDelegationEvents(entries, 'session-pending');

      expect(events).toHaveLength(1);
      // Without result, assume success (not error)
      expect(events[0]!.success).toBe(true);
    });

    it('should preserve source location for tracing', () => {
      const entries: SessionEntry[] = [
        {
          ...createTaskToolEntry('task-1', 'Explore', 'Find files', '2026-01-24T10:00:00Z', 42),
          filePath: '/path/to/session.jsonl',
        },
        createToolResult('task-1', 'Done', '2026-01-24T10:00:05Z', 43),
      ];

      const events = extractDelegationEvents(entries, 'session-trace');

      expect(events[0]!.filePath).toBe('/path/to/session.jsonl');
      expect(events[0]!.lineNumber).toBe(42);
    });
  });
});

// =============================================================================
// Subagent Type Parsing Tests (T040)
// =============================================================================

describe('subagent type parsing', () => {
  it('should parse standard subagent types', () => {
    const types = ['Explore', 'Bash', 'general-purpose', 'Plan', 'claude-code-guide'];

    for (const subagentType of types) {
      const entries: SessionEntry[] = [
        createTaskToolEntry('task-1', subagentType, 'Test prompt', '2026-01-24T10:00:00Z', 1),
        createToolResult('task-1', 'Done', '2026-01-24T10:00:05Z', 2),
      ];

      const events = extractDelegationEvents(entries, `session-${subagentType}`);

      expect(events).toHaveLength(1);
      expect(events[0]!.subagentType).toBe(subagentType);
    }
  });

  it('should parse custom subagent types with prefixes', () => {
    const entries: SessionEntry[] = [
      createTaskToolEntry(
        'task-1',
        'agent-sdk-dev:agent-sdk-verifier-ts',
        'Verify TypeScript setup',
        '2026-01-24T10:00:00Z',
        1
      ),
      createToolResult('task-1', 'Verified', '2026-01-24T10:00:05Z', 2),
    ];

    const events = extractDelegationEvents(entries, 'session-custom');

    expect(events).toHaveLength(1);
    expect(events[0]!.subagentType).toBe('agent-sdk-dev:agent-sdk-verifier-ts');
  });

  it('should handle missing subagent_type gracefully', () => {
    const entries: SessionEntry[] = [
      {
        type: 'assistant',
        uuid: 'assistant-1',
        timestamp: '2026-01-24T10:00:00Z',
        lineNumber: 1,
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'task-1',
              name: 'Task',
              input: {
                prompt: 'Do something',
                // Missing subagent_type
              },
            },
          ],
        },
      },
      createToolResult('task-1', 'Done', '2026-01-24T10:00:05Z', 2),
    ];

    const events = extractDelegationEvents(entries, 'session-missing-type');

    expect(events).toHaveLength(1);
    expect(events[0]!.subagentType).toBe('unknown');
  });
});

// =============================================================================
// Delegation Aggregation Tests
// =============================================================================

describe('aggregateDelegations', () => {
  it('should aggregate by subagent type', () => {
    const entries: SessionEntry[] = [
      createTaskToolEntry('task-1', 'Explore', 'Find A', '2026-01-24T10:00:00Z', 1),
      createToolResult('task-1', 'Found A', '2026-01-24T10:00:05Z', 2),
      createTaskToolEntry('task-2', 'Explore', 'Find B', '2026-01-24T10:00:10Z', 3),
      createToolResult('task-2', 'Found B', '2026-01-24T10:00:15Z', 4),
      createTaskToolEntry('task-3', 'Bash', 'Run test', '2026-01-24T10:00:20Z', 5),
      createToolResult('task-3', 'Passed', '2026-01-24T10:00:25Z', 6),
    ];

    const events = extractDelegationEvents(entries, 'session-agg');
    const summary = aggregateDelegations(events);

    expect(summary.totalDelegations).toBe(3);
    expect(summary.successCount).toBe(3);
    expect(summary.failureCount).toBe(0);
    expect(summary.successRate).toBe(1);

    expect(summary.bySubagentType).toHaveLength(2);

    const explore = summary.bySubagentType.find((s) => s.subagentType === 'Explore');
    expect(explore).toBeDefined();
    expect(explore!.count).toBe(2);
    expect(explore!.successCount).toBe(2);

    const bash = summary.bySubagentType.find((s) => s.subagentType === 'Bash');
    expect(bash).toBeDefined();
    expect(bash!.count).toBe(1);
  });

  it('should calculate success rate correctly', () => {
    const entries: SessionEntry[] = [
      createTaskToolEntry('task-1', 'Bash', 'Test 1', '2026-01-24T10:00:00Z', 1),
      createToolResult('task-1', 'Passed', '2026-01-24T10:00:05Z', 2),
      createTaskToolEntry('task-2', 'Bash', 'Test 2', '2026-01-24T10:00:10Z', 3),
      createToolResult('task-2', 'Failed', '2026-01-24T10:00:15Z', 4, true),
      createTaskToolEntry('task-3', 'Bash', 'Test 3', '2026-01-24T10:00:20Z', 5),
      createToolResult('task-3', 'Passed', '2026-01-24T10:00:25Z', 6),
      createTaskToolEntry('task-4', 'Bash', 'Test 4', '2026-01-24T10:00:30Z', 7),
      createToolResult('task-4', 'Failed', '2026-01-24T10:00:35Z', 8, true),
    ];

    const events = extractDelegationEvents(entries, 'session-rate');
    const summary = aggregateDelegations(events);

    expect(summary.totalDelegations).toBe(4);
    expect(summary.successCount).toBe(2);
    expect(summary.failureCount).toBe(2);
    expect(summary.successRate).toBe(0.5);
  });

  it('should return empty summary for no delegations', () => {
    const summary = aggregateDelegations([]);

    expect(summary.totalDelegations).toBe(0);
    expect(summary.successCount).toBe(0);
    expect(summary.failureCount).toBe(0);
    expect(summary.successRate).toBe(1); // No failures = 100% success
    expect(summary.bySubagentType).toHaveLength(0);
  });

  it('should sort by count descending', () => {
    const entries: SessionEntry[] = [
      createTaskToolEntry('task-1', 'TypeA', 'Prompt', '2026-01-24T10:00:00Z', 1),
      createToolResult('task-1', 'Done', '2026-01-24T10:00:01Z', 2),
      createTaskToolEntry('task-2', 'TypeB', 'Prompt', '2026-01-24T10:00:02Z', 3),
      createToolResult('task-2', 'Done', '2026-01-24T10:00:03Z', 4),
      createTaskToolEntry('task-3', 'TypeB', 'Prompt', '2026-01-24T10:00:04Z', 5),
      createToolResult('task-3', 'Done', '2026-01-24T10:00:05Z', 6),
      createTaskToolEntry('task-4', 'TypeB', 'Prompt', '2026-01-24T10:00:06Z', 7),
      createToolResult('task-4', 'Done', '2026-01-24T10:00:07Z', 8),
    ];

    const events = extractDelegationEvents(entries, 'session-sort');
    const summary = aggregateDelegations(events);

    expect(summary.bySubagentType[0]!.subagentType).toBe('TypeB');
    expect(summary.bySubagentType[0]!.count).toBe(3);
    expect(summary.bySubagentType[1]!.subagentType).toBe('TypeA');
    expect(summary.bySubagentType[1]!.count).toBe(1);
  });
});
