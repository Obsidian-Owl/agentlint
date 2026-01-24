/**
 * Integration tests for get_mcp_usage tool
 *
 * Tests MCP usage extraction with realistic session data.
 *
 * @module tests/integration/sessions/tools/get-mcp-usage.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getMcpUsage } from '../../../../src/sessions/tools/get-mcp-usage-tool';

describe('get_mcp_usage integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mcp-usage-integration-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('MCP Call Extraction', () => {
    it('should extract MCP calls from session', async () => {
      const sessionPath = join(tempDir, 'with-mcp.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'mcp-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'List Linear issues' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'mcp-001',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'mcp-1',
                name: 'mcp__linear__list_issues',
                input: { project: 'test' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'mcp-001',
          timestamp: '2026-01-24T10:00:05Z',
          tool_result: {
            tool_use_id: 'mcp-1',
            content: '{"issues": [{"id": "1", "title": "Test issue"}]}',
            is_error: false,
          },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getMcpUsage({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.totalCalls).toBe(1);
      expect(result.data!.servers).toHaveLength(1);
      expect(result.data!.servers[0]!.serverName).toBe('linear');
      expect(result.data!.servers[0]!.callCount).toBe(1);
      expect(result.data!.servers[0]!.errorCount).toBe(0);
    });

    it('should track multiple MCP servers', async () => {
      const sessionPath = join(tempDir, 'multi-server.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'mcp-002',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Get info' }] },
        },
        // Linear call
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'mcp-002',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'mcp-1',
                name: 'mcp__linear__list_issues',
                input: {},
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'mcp-002',
          timestamp: '2026-01-24T10:00:05Z',
          tool_result: { tool_use_id: 'mcp-1', content: 'OK', is_error: false },
        },
        // GitHub call
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'mcp-002',
          timestamp: '2026-01-24T10:00:10Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'mcp-2',
                name: 'mcp__plugin_deepwiki_deepwiki__read_wiki_contents',
                input: { repoName: 'facebook/react' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-2',
          sessionId: 'mcp-002',
          timestamp: '2026-01-24T10:00:15Z',
          tool_result: { tool_use_id: 'mcp-2', content: 'Wiki content', is_error: false },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getMcpUsage({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.totalCalls).toBe(2);
      expect(result.data!.servers).toHaveLength(2);

      const serverNames = result.data!.servers.map((s) => s.serverName);
      expect(serverNames).toContain('linear');
      expect(serverNames).toContain('plugin_deepwiki_deepwiki');
    });
  });

  describe('Error Tracking', () => {
    it('should calculate error rate correctly', async () => {
      const sessionPath = join(tempDir, 'errors.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'mcp-err',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Work' }] },
        },
        // Success
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'mcp-err',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'mcp-1',
                name: 'mcp__linear__list_issues',
                input: {},
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'mcp-err',
          timestamp: '2026-01-24T10:00:02Z',
          tool_result: { tool_use_id: 'mcp-1', content: 'OK', is_error: false },
        },
        // Failure
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'mcp-err',
          timestamp: '2026-01-24T10:00:03Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'mcp-2',
                name: 'mcp__linear__update_issue',
                input: { id: '123' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-2',
          sessionId: 'mcp-err',
          timestamp: '2026-01-24T10:00:04Z',
          tool_result: { tool_use_id: 'mcp-2', content: 'Permission denied', is_error: true },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getMcpUsage({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.totalCalls).toBe(2);
      expect(result.data!.totalErrors).toBe(1);
      expect(result.data!.overallErrorRate).toBe(0.5);

      const linear = result.data!.servers[0]!;
      expect(linear.errorCount).toBe(1);
      expect(linear.errorRate).toBe(0.5);
    });
  });

  describe('Per-Tool Tracking', () => {
    it('should track per-tool statistics', async () => {
      const sessionPath = join(tempDir, 'per-tool.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'mcp-tools',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Work' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'mcp-tools',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'mcp-1',
                name: 'mcp__linear__list_issues',
                input: {},
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'mcp-tools',
          timestamp: '2026-01-24T10:00:02Z',
          tool_result: { tool_use_id: 'mcp-1', content: 'OK', is_error: false },
        },
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'mcp-tools',
          timestamp: '2026-01-24T10:00:03Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'mcp-2',
                name: 'mcp__linear__list_issues',
                input: {},
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-2',
          sessionId: 'mcp-tools',
          timestamp: '2026-01-24T10:00:04Z',
          tool_result: { tool_use_id: 'mcp-2', content: 'OK', is_error: false },
        },
        {
          type: 'assistant',
          uuid: 'assistant-3',
          sessionId: 'mcp-tools',
          timestamp: '2026-01-24T10:00:05Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'mcp-3',
                name: 'mcp__linear__get_issue',
                input: { id: '123' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-3',
          sessionId: 'mcp-tools',
          timestamp: '2026-01-24T10:00:06Z',
          tool_result: { tool_use_id: 'mcp-3', content: 'OK', is_error: false },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getMcpUsage({ filePath: sessionPath });

      expect(result.success).toBe(true);

      const linear = result.data!.servers[0]!;
      expect(linear.tools).toHaveLength(2);

      // Should be sorted by call count
      expect(linear.tools[0]!.toolName).toBe('list_issues');
      expect(linear.tools[0]!.callCount).toBe(2);
      expect(linear.tools[1]!.toolName).toBe('get_issue');
      expect(linear.tools[1]!.callCount).toBe(1);
    });
  });

  describe('Filtering', () => {
    it('should filter by server name', async () => {
      const sessionPath = join(tempDir, 'filter.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'filter-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Work' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'filter-001',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'mcp-1',
                name: 'mcp__linear__list_issues',
                input: {},
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'filter-001',
          timestamp: '2026-01-24T10:00:02Z',
          tool_result: { tool_use_id: 'mcp-1', content: 'OK', is_error: false },
        },
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'filter-001',
          timestamp: '2026-01-24T10:00:03Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'mcp-2',
                name: 'mcp__github__list_repos',
                input: {},
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-2',
          sessionId: 'filter-001',
          timestamp: '2026-01-24T10:00:04Z',
          tool_result: { tool_use_id: 'mcp-2', content: 'OK', is_error: false },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getMcpUsage({
        filePath: sessionPath,
        serverName: 'linear',
      });

      expect(result.success).toBe(true);
      expect(result.data!.totalCalls).toBe(1);
      expect(result.data!.servers).toHaveLength(1);
      expect(result.data!.servers[0]!.serverName).toBe('linear');
    });
  });

  describe('Error Handling', () => {
    it('should return error for non-existent file', async () => {
      const result = await getMcpUsage({
        filePath: '/nonexistent/session.jsonl',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SESSION_FILE_NOT_FOUND');
    });

    it('should handle session with no MCP calls', async () => {
      const sessionPath = join(tempDir, 'no-mcp.jsonl');

      const entries = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'no-mcp-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'no-mcp-001',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'read-1', name: 'Read', input: { file_path: '/a.ts' } },
            ],
          },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getMcpUsage({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.servers).toHaveLength(0);
      expect(result.data!.totalCalls).toBe(0);
      expect(result.data!.totalErrors).toBe(0);
      expect(result.data!.overallErrorRate).toBe(0);
    });
  });

  describe('Unparseable Server Name Edge Case (T062)', () => {
    it('should ignore malformed MCP tool names', async () => {
      const sessionPath = join(tempDir, 'malformed.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'mal-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Work' }] },
        },
        // Valid MCP call
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'mal-001',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'mcp-1',
                name: 'mcp__linear__list_issues',
                input: {},
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'mal-001',
          timestamp: '2026-01-24T10:00:02Z',
          tool_result: { tool_use_id: 'mcp-1', content: 'OK', is_error: false },
        },
        // Malformed MCP call - should be ignored
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'mal-001',
          timestamp: '2026-01-24T10:00:03Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'mcp-2',
                name: 'mcp__orphan', // Missing tool part
                input: {},
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-2',
          sessionId: 'mal-001',
          timestamp: '2026-01-24T10:00:04Z',
          tool_result: { tool_use_id: 'mcp-2', content: 'OK', is_error: false },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getMcpUsage({ filePath: sessionPath });

      expect(result.success).toBe(true);
      // Should only count the valid MCP call
      expect(result.data!.totalCalls).toBe(1);
      expect(result.data!.servers).toHaveLength(1);
      expect(result.data!.servers[0]!.serverName).toBe('linear');
    });
  });
});
