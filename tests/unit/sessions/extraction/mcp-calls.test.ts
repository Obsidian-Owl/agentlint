/**
 * Unit tests for MCP tool call extraction
 *
 * Tests mcp__ prefix parsing and per-server error tracking from session entries.
 *
 * @module tests/unit/sessions/extraction/mcp-calls.test.ts
 */

import { describe, it, expect } from 'bun:test';
import type { SessionEntry } from '../../../../src/tools/sessions/types';
import {
  extractMcpCalls,
  aggregateMcpUsage,
  parseMcpToolName,
} from '../../../../src/sessions/extraction/mcp-calls';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create an assistant entry with an MCP tool use block.
 */
function createMcpToolEntry(
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
// MCP Prefix Parsing Tests (T055)
// =============================================================================

describe('parseMcpToolName', () => {
  it('should parse standard mcp__ prefixed tool name', () => {
    const result = parseMcpToolName('mcp__linear__list_issues');

    expect(result).not.toBeNull();
    expect(result!.serverName).toBe('linear');
    expect(result!.toolName).toBe('list_issues');
  });

  it('should parse tool name with underscores', () => {
    const result = parseMcpToolName('mcp__github__create_pull_request');

    expect(result).not.toBeNull();
    expect(result!.serverName).toBe('github');
    expect(result!.toolName).toBe('create_pull_request');
  });

  it('should parse nested server names with plugin prefix', () => {
    const result = parseMcpToolName('mcp__plugin_deepwiki_deepwiki__read_wiki_contents');

    expect(result).not.toBeNull();
    expect(result!.serverName).toBe('plugin_deepwiki_deepwiki');
    expect(result!.toolName).toBe('read_wiki_contents');
  });

  it('should return null for non-MCP tool names', () => {
    expect(parseMcpToolName('Read')).toBeNull();
    expect(parseMcpToolName('Bash')).toBeNull();
    expect(parseMcpToolName('Task')).toBeNull();
  });

  it('should return null for malformed MCP names', () => {
    expect(parseMcpToolName('mcp_single_underscore')).toBeNull();
    expect(parseMcpToolName('mcp__')).toBeNull();
    expect(parseMcpToolName('mcp__server')).toBeNull(); // No tool name
  });

  it('should handle server name with special characters', () => {
    const result = parseMcpToolName('mcp__my-server__get_data');

    expect(result).not.toBeNull();
    expect(result!.serverName).toBe('my-server');
    expect(result!.toolName).toBe('get_data');
  });
});

describe('extractMcpCalls', () => {
  describe('MCP tool detection', () => {
    it('should extract MCP tool calls from assistant messages', () => {
      const entries: SessionEntry[] = [
        createMcpToolEntry(
          'mcp-1',
          'mcp__linear__list_issues',
          { project: 'test' },
          '2026-01-24T10:00:00Z',
          1
        ),
        createToolResult('mcp-1', 'Found 5 issues', '2026-01-24T10:00:05Z', 2),
      ];

      const calls = extractMcpCalls(entries, 'session-123');

      expect(calls).toHaveLength(1);
      expect(calls[0]!.serverName).toBe('linear');
      expect(calls[0]!.toolName).toBe('list_issues');
      expect(calls[0]!.sessionId).toBe('session-123');
      expect(calls[0]!.isError).toBe(false);
    });

    it('should not extract non-MCP tool calls', () => {
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

      const calls = extractMcpCalls(entries, 'session-no-mcp');

      expect(calls).toHaveLength(0);
    });

    it('should extract multiple MCP calls from different servers', () => {
      const entries: SessionEntry[] = [
        createMcpToolEntry('mcp-1', 'mcp__linear__list_issues', {}, '2026-01-24T10:00:00Z', 1),
        createToolResult('mcp-1', 'Issues', '2026-01-24T10:00:05Z', 2),
        createMcpToolEntry('mcp-2', 'mcp__github__list_repos', {}, '2026-01-24T10:00:10Z', 3),
        createToolResult('mcp-2', 'Repos', '2026-01-24T10:00:15Z', 4),
        createMcpToolEntry(
          'mcp-3',
          'mcp__linear__get_issue',
          { id: '123' },
          '2026-01-24T10:00:20Z',
          5
        ),
        createToolResult('mcp-3', 'Issue details', '2026-01-24T10:00:25Z', 6),
      ];

      const calls = extractMcpCalls(entries, 'session-multi');

      expect(calls).toHaveLength(3);
      expect(calls[0]!.serverName).toBe('linear');
      expect(calls[1]!.serverName).toBe('github');
      expect(calls[2]!.serverName).toBe('linear');
    });
  });

  describe('error tracking', () => {
    it('should detect failed MCP calls', () => {
      const entries: SessionEntry[] = [
        createMcpToolEntry(
          'mcp-1',
          'mcp__linear__update_issue',
          { id: '123' },
          '2026-01-24T10:00:00Z',
          1
        ),
        createToolResult('mcp-1', 'Permission denied', '2026-01-24T10:00:05Z', 2, true),
      ];

      const calls = extractMcpCalls(entries, 'session-error');

      expect(calls).toHaveLength(1);
      expect(calls[0]!.isError).toBe(true);
      expect(calls[0]!.errorMessage).toBe('Permission denied');
    });

    it('should include error message for failed calls', () => {
      const errorMessage = 'Rate limit exceeded: 429 Too Many Requests';
      const entries: SessionEntry[] = [
        createMcpToolEntry('mcp-1', 'mcp__github__create_issue', {}, '2026-01-24T10:00:00Z', 1),
        createToolResult('mcp-1', errorMessage, '2026-01-24T10:00:05Z', 2, true),
      ];

      const calls = extractMcpCalls(entries, 'session-rate-limit');

      expect(calls[0]!.errorMessage).toBe(errorMessage);
    });

    it('should handle MCP call without result', () => {
      const entries: SessionEntry[] = [
        createMcpToolEntry('mcp-1', 'mcp__linear__list_issues', {}, '2026-01-24T10:00:00Z', 1),
        // No result entry
      ];

      const calls = extractMcpCalls(entries, 'session-pending');

      expect(calls).toHaveLength(1);
      // Without result, assume success (not error)
      expect(calls[0]!.isError).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty entries', () => {
      const calls = extractMcpCalls([], 'session-empty');

      expect(calls).toHaveLength(0);
    });

    it('should handle unparseable server name (use "unknown")', () => {
      // This tests T062: Handle unparseable server name edge case
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
                id: 'mcp-1',
                // Malformed MCP name - missing tool part
                name: 'mcp__orphan',
                input: {},
              },
            ],
          },
        },
      ];

      const calls = extractMcpCalls(entries, 'session-malformed');

      // Should not extract malformed MCP names
      expect(calls).toHaveLength(0);
    });

    it('should preserve source location for tracing', () => {
      const entries: SessionEntry[] = [
        {
          ...createMcpToolEntry(
            'mcp-1',
            'mcp__linear__list_issues',
            {},
            '2026-01-24T10:00:00Z',
            42
          ),
          filePath: '/path/to/session.jsonl',
        },
        createToolResult('mcp-1', 'Done', '2026-01-24T10:00:05Z', 43),
      ];

      const calls = extractMcpCalls(entries, 'session-trace');

      expect(calls[0]!.filePath).toBe('/path/to/session.jsonl');
      expect(calls[0]!.lineNumber).toBe(42);
    });
  });
});

// =============================================================================
// Error Rate Calculation Tests (T056)
// =============================================================================

describe('aggregateMcpUsage', () => {
  it('should aggregate by server', () => {
    const entries: SessionEntry[] = [
      createMcpToolEntry('mcp-1', 'mcp__linear__list_issues', {}, '2026-01-24T10:00:00Z', 1),
      createToolResult('mcp-1', 'OK', '2026-01-24T10:00:05Z', 2),
      createMcpToolEntry('mcp-2', 'mcp__linear__get_issue', {}, '2026-01-24T10:00:10Z', 3),
      createToolResult('mcp-2', 'OK', '2026-01-24T10:00:15Z', 4),
      createMcpToolEntry('mcp-3', 'mcp__github__list_repos', {}, '2026-01-24T10:00:20Z', 5),
      createToolResult('mcp-3', 'OK', '2026-01-24T10:00:25Z', 6),
    ];

    const calls = extractMcpCalls(entries, 'session-agg');
    const usage = aggregateMcpUsage(calls);

    expect(usage.servers).toHaveLength(2);

    const linear = usage.servers.find((s) => s.serverName === 'linear');
    expect(linear).toBeDefined();
    expect(linear!.callCount).toBe(2);
    expect(linear!.errorCount).toBe(0);
    expect(linear!.errorRate).toBe(0);

    const github = usage.servers.find((s) => s.serverName === 'github');
    expect(github).toBeDefined();
    expect(github!.callCount).toBe(1);
  });

  it('should calculate error rate correctly', () => {
    const entries: SessionEntry[] = [
      createMcpToolEntry('mcp-1', 'mcp__linear__call1', {}, '2026-01-24T10:00:00Z', 1),
      createToolResult('mcp-1', 'OK', '2026-01-24T10:00:01Z', 2),
      createMcpToolEntry('mcp-2', 'mcp__linear__call2', {}, '2026-01-24T10:00:02Z', 3),
      createToolResult('mcp-2', 'Error', '2026-01-24T10:00:03Z', 4, true),
      createMcpToolEntry('mcp-3', 'mcp__linear__call3', {}, '2026-01-24T10:00:04Z', 5),
      createToolResult('mcp-3', 'OK', '2026-01-24T10:00:05Z', 6),
      createMcpToolEntry('mcp-4', 'mcp__linear__call4', {}, '2026-01-24T10:00:06Z', 7),
      createToolResult('mcp-4', 'Error', '2026-01-24T10:00:07Z', 8, true),
    ];

    const calls = extractMcpCalls(entries, 'session-rate');
    const usage = aggregateMcpUsage(calls);

    expect(usage.totalCalls).toBe(4);
    expect(usage.totalErrors).toBe(2);
    expect(usage.overallErrorRate).toBe(0.5);

    const linear = usage.servers[0]!;
    expect(linear.callCount).toBe(4);
    expect(linear.errorCount).toBe(2);
    expect(linear.errorRate).toBe(0.5);
  });

  it('should track per-tool statistics within server', () => {
    const entries: SessionEntry[] = [
      createMcpToolEntry('mcp-1', 'mcp__linear__list_issues', {}, '2026-01-24T10:00:00Z', 1),
      createToolResult('mcp-1', 'OK', '2026-01-24T10:00:01Z', 2),
      createMcpToolEntry('mcp-2', 'mcp__linear__list_issues', {}, '2026-01-24T10:00:02Z', 3),
      createToolResult('mcp-2', 'Error', '2026-01-24T10:00:03Z', 4, true),
      createMcpToolEntry('mcp-3', 'mcp__linear__get_issue', {}, '2026-01-24T10:00:04Z', 5),
      createToolResult('mcp-3', 'OK', '2026-01-24T10:00:05Z', 6),
    ];

    const calls = extractMcpCalls(entries, 'session-tools');
    const usage = aggregateMcpUsage(calls);

    const linear = usage.servers[0]!;
    expect(linear.tools).toHaveLength(2);

    const listIssues = linear.tools.find((t) => t.toolName === 'list_issues');
    expect(listIssues).toBeDefined();
    expect(listIssues!.callCount).toBe(2);
    expect(listIssues!.errorCount).toBe(1);

    const getIssue = linear.tools.find((t) => t.toolName === 'get_issue');
    expect(getIssue).toBeDefined();
    expect(getIssue!.callCount).toBe(1);
    expect(getIssue!.errorCount).toBe(0);
  });

  it('should return empty usage for no MCP calls', () => {
    const usage = aggregateMcpUsage([]);

    expect(usage.servers).toHaveLength(0);
    expect(usage.totalCalls).toBe(0);
    expect(usage.totalErrors).toBe(0);
    expect(usage.overallErrorRate).toBe(0);
  });

  it('should sort servers by call count descending', () => {
    const entries: SessionEntry[] = [
      createMcpToolEntry('mcp-1', 'mcp__linear__call', {}, '2026-01-24T10:00:00Z', 1),
      createToolResult('mcp-1', 'OK', '2026-01-24T10:00:01Z', 2),
      createMcpToolEntry('mcp-2', 'mcp__github__call', {}, '2026-01-24T10:00:02Z', 3),
      createToolResult('mcp-2', 'OK', '2026-01-24T10:00:03Z', 4),
      createMcpToolEntry('mcp-3', 'mcp__github__call', {}, '2026-01-24T10:00:04Z', 5),
      createToolResult('mcp-3', 'OK', '2026-01-24T10:00:05Z', 6),
      createMcpToolEntry('mcp-4', 'mcp__github__call', {}, '2026-01-24T10:00:06Z', 7),
      createToolResult('mcp-4', 'OK', '2026-01-24T10:00:07Z', 8),
    ];

    const calls = extractMcpCalls(entries, 'session-sort');
    const usage = aggregateMcpUsage(calls);

    expect(usage.servers[0]!.serverName).toBe('github');
    expect(usage.servers[0]!.callCount).toBe(3);
    expect(usage.servers[1]!.serverName).toBe('linear');
    expect(usage.servers[1]!.callCount).toBe(1);
  });
});
