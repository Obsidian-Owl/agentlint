/**
 * Integration tests for get_tool_sequences tool
 *
 * Tests tool sequence extraction and pagination with realistic session data.
 *
 * @module tests/integration/sessions/tools/get-tool-sequences.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getToolSequences } from '../../../../src/sessions/tools/get-tool-sequences-tool';

describe('get_tool_sequences integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tool-sequences-integration-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Pagination', () => {
    it('should paginate through tool sequences', async () => {
      const sessionPath = join(tempDir, 'many-tools.jsonl');

      // Create session with 15 tool calls
      const entries: unknown[] = [];
      entries.push({
        type: 'user',
        uuid: 'user-1',
        sessionId: 'pagination-test-001',
        timestamp: '2026-01-24T10:00:00Z',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Read all the files' }],
        },
      });

      // Add 15 tool use/result pairs
      for (let i = 0; i < 15; i++) {
        entries.push({
          type: 'assistant',
          uuid: `assistant-${i}`,
          sessionId: 'pagination-test-001',
          timestamp: `2026-01-24T10:00:${String(i * 2).padStart(2, '0')}Z`,
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: `tool-${i}`,
                name: 'Read',
                input: { file_path: `/src/file${i}.ts` },
              },
            ],
          },
        });
        entries.push({
          type: 'tool_result',
          uuid: `result-${i}`,
          sessionId: 'pagination-test-001',
          timestamp: `2026-01-24T10:00:${String(i * 2 + 1).padStart(2, '0')}Z`,
          toolResult: {
            toolUseId: `tool-${i}`,
            content: `Contents of file${i}`,
            is_error: false,
          },
        });
      }

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      // First page (5 items)
      const page1 = await getToolSequences({
        filePath: sessionPath,
        limit: 5,
        offset: 0,
      });

      expect(page1.success).toBe(true);
      expect(page1.data!.sequences).toHaveLength(5);
      expect(page1.data!.totalCount).toBe(15);
      expect(page1.data!.sequences[0]!.sequenceIndex).toBe(0);
      expect(page1.data!.sequences[4]!.sequenceIndex).toBe(4);

      // Second page (5 items)
      const page2 = await getToolSequences({
        filePath: sessionPath,
        limit: 5,
        offset: 5,
      });

      expect(page2.success).toBe(true);
      expect(page2.data!.sequences).toHaveLength(5);
      expect(page2.data!.totalCount).toBe(15);
      expect(page2.data!.sequences[0]!.sequenceIndex).toBe(5);
      expect(page2.data!.sequences[4]!.sequenceIndex).toBe(9);

      // Third page (5 items)
      const page3 = await getToolSequences({
        filePath: sessionPath,
        limit: 5,
        offset: 10,
      });

      expect(page3.success).toBe(true);
      expect(page3.data!.sequences).toHaveLength(5);
      expect(page3.data!.sequences[0]!.sequenceIndex).toBe(10);
      expect(page3.data!.sequences[4]!.sequenceIndex).toBe(14);

      // Beyond data (empty page)
      const page4 = await getToolSequences({
        filePath: sessionPath,
        limit: 5,
        offset: 15,
      });

      expect(page4.success).toBe(true);
      expect(page4.data!.sequences).toHaveLength(0);
      expect(page4.data!.totalCount).toBe(15);
    });

    it('should handle partial last page', async () => {
      const sessionPath = join(tempDir, 'partial-page.jsonl');

      const entries: unknown[] = [];
      entries.push({
        type: 'user',
        uuid: 'user-1',
        sessionId: 'partial-001',
        timestamp: '2026-01-24T10:00:00Z',
        message: { role: 'user', content: [{ type: 'text', text: 'Test' }] },
      });

      // Add 7 tool calls
      for (let i = 0; i < 7; i++) {
        entries.push({
          type: 'assistant',
          uuid: `assistant-${i}`,
          sessionId: 'partial-001',
          timestamp: `2026-01-24T10:00:${String(i).padStart(2, '0')}Z`,
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: `tool-${i}`,
                name: 'Read',
                input: { file_path: `/file${i}` },
              },
            ],
          },
        });
      }

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      // Page with 5 limit, offset 5 should return 2 items
      const result = await getToolSequences({
        filePath: sessionPath,
        limit: 5,
        offset: 5,
      });

      expect(result.success).toBe(true);
      expect(result.data!.sequences).toHaveLength(2);
      expect(result.data!.totalCount).toBe(7);
    });
  });

  describe('Filtering', () => {
    it('should filter by tool name', async () => {
      const sessionPath = join(tempDir, 'mixed-tools.jsonl');

      const entries = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'mixed-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Do some work' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'mixed-001',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: '/a.ts' } },
            ],
          },
        },
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'mixed-001',
          timestamp: '2026-01-24T10:00:02Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'tool-2', name: 'Bash', input: { command: 'npm test' } },
            ],
          },
        },
        {
          type: 'assistant',
          uuid: 'assistant-3',
          sessionId: 'mixed-001',
          timestamp: '2026-01-24T10:00:03Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'tool-3', name: 'Read', input: { file_path: '/b.ts' } },
            ],
          },
        },
        {
          type: 'assistant',
          uuid: 'assistant-4',
          sessionId: 'mixed-001',
          timestamp: '2026-01-24T10:00:04Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'tool-4', name: 'Edit', input: { file_path: '/c.ts' } },
            ],
          },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      // Filter to Read only
      const result = await getToolSequences({
        filePath: sessionPath,
        toolName: 'Read',
      });

      expect(result.success).toBe(true);
      expect(result.data!.sequences).toHaveLength(2);
      expect(result.data!.totalCount).toBe(2);
      expect(result.data!.sequences.every((s) => s.toolName === 'Read')).toBe(true);
    });

    it('should filter errors only', async () => {
      const sessionPath = join(tempDir, 'with-errors.jsonl');

      const entries = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'errors-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Run tests' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'errors-001',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: '/exists.ts' } },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'errors-001',
          timestamp: '2026-01-24T10:00:02Z',
          tool_result: { tool_use_id: 'tool-1', content: 'Contents', is_error: false },
        },
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'errors-001',
          timestamp: '2026-01-24T10:00:03Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-2',
                name: 'Read',
                input: { file_path: '/missing.ts' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-2',
          sessionId: 'errors-001',
          timestamp: '2026-01-24T10:00:04Z',
          tool_result: { tool_use_id: 'tool-2', content: 'File not found', is_error: true },
        },
        {
          type: 'assistant',
          uuid: 'assistant-3',
          sessionId: 'errors-001',
          timestamp: '2026-01-24T10:00:05Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'tool-3', name: 'Bash', input: { command: 'npm test' } },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-3',
          sessionId: 'errors-001',
          timestamp: '2026-01-24T10:00:06Z',
          tool_result: { tool_use_id: 'tool-3', content: 'Tests passed', is_error: false },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      // Filter to errors only
      const result = await getToolSequences({
        filePath: sessionPath,
        errorsOnly: true,
      });

      expect(result.success).toBe(true);
      expect(result.data!.sequences).toHaveLength(1);
      expect(result.data!.totalCount).toBe(1);
      expect(result.data!.sequences[0]!.isError).toBe(true);
      expect(result.data!.sequences[0]!.toolName).toBe('Read');
    });
  });

  describe('Repeat Pattern Detection', () => {
    it('should detect repeated tool calls with same input', async () => {
      const sessionPath = join(tempDir, 'repeated.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'repeat-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Debug the issue' }] },
        },
      ];

      // Same Read call 3 times (might indicate confusion)
      for (let i = 0; i < 3; i++) {
        entries.push({
          type: 'assistant',
          uuid: `assistant-${i}`,
          sessionId: 'repeat-001',
          timestamp: `2026-01-24T10:00:${String(i + 1).padStart(2, '0')}Z`,
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: `tool-${i}`,
                name: 'Read',
                input: { file_path: '/src/index.ts' }, // Same file!
              },
            ],
          },
        });
        entries.push({
          type: 'tool_result',
          uuid: `result-${i}`,
          sessionId: 'repeat-001',
          timestamp: `2026-01-24T10:00:${String(i + 2).padStart(2, '0')}Z`,
          tool_result: { tool_use_id: `tool-${i}`, content: 'Contents', is_error: false },
        });
      }

      // Different file
      entries.push({
        type: 'assistant',
        uuid: 'assistant-other',
        sessionId: 'repeat-001',
        timestamp: '2026-01-24T10:00:10Z',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool-other',
              name: 'Read',
              input: { file_path: '/src/other.ts' }, // Different file
            },
          ],
        },
      });

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getToolSequences({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.repeatPatterns).toHaveLength(1);

      const pattern = result.data!.repeatPatterns[0]!;
      expect(pattern.toolName).toBe('Read');
      expect(pattern.repeatCount).toBe(3);
      expect(pattern.firstOccurrence).toBe(0);
      expect(pattern.lastOccurrence).toBe(2);
    });

    it('should detect multiple repeat patterns', async () => {
      const sessionPath = join(tempDir, 'multi-repeat.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'multi-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Fix and test' }] },
        },
      ];

      // Same Bash command twice
      for (let i = 0; i < 2; i++) {
        entries.push({
          type: 'assistant',
          uuid: `bash-${i}`,
          sessionId: 'multi-001',
          timestamp: `2026-01-24T10:00:0${i}Z`,
          message: {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: `bash-${i}`, name: 'Bash', input: { command: 'npm test' } },
            ],
          },
        });
      }

      // Same Read call twice
      for (let i = 0; i < 2; i++) {
        entries.push({
          type: 'assistant',
          uuid: `read-${i}`,
          sessionId: 'multi-001',
          timestamp: `2026-01-24T10:00:1${i}Z`,
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: `read-${i}`,
                name: 'Read',
                input: { file_path: '/config.json' },
              },
            ],
          },
        });
      }

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getToolSequences({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.repeatPatterns).toHaveLength(2);

      const bashPattern = result.data!.repeatPatterns.find((p) => p.toolName === 'Bash');
      const readPattern = result.data!.repeatPatterns.find((p) => p.toolName === 'Read');

      expect(bashPattern).toBeDefined();
      expect(bashPattern!.repeatCount).toBe(2);

      expect(readPattern).toBeDefined();
      expect(readPattern!.repeatCount).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should return error for non-existent file', async () => {
      const result = await getToolSequences({
        filePath: '/nonexistent/session.jsonl',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SESSION_FILE_NOT_FOUND');
    });

    it('should handle empty session file', async () => {
      const sessionPath = join(tempDir, 'empty.jsonl');
      await writeFile(sessionPath, '');

      const result = await getToolSequences({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.sequences).toHaveLength(0);
      expect(result.data!.totalCount).toBe(0);
    });

    it('should handle session with no tool calls', async () => {
      const sessionPath = join(tempDir, 'no-tools.jsonl');
      const entries = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'no-tools-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'no-tools-001',
          timestamp: '2026-01-24T10:00:01Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Hi!' }] },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getToolSequences({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.sequences).toHaveLength(0);
      expect(result.data!.repeatPatterns).toHaveLength(0);
    });
  });

  describe('Real World Scenarios', () => {
    it('should handle a debugging session with retries', async () => {
      const sessionPath = join(tempDir, 'debug-session.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'debug-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Fix the TypeScript error in index.ts' }],
          },
        },
        // Read the file
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'debug-001',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Read',
                input: { file_path: '/src/index.ts' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'debug-001',
          timestamp: '2026-01-24T10:00:02Z',
          tool_result: { tool_use_id: 'tool-1', content: 'const x: string = 5;', is_error: false },
        },
        // First fix attempt
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'debug-001',
          timestamp: '2026-01-24T10:00:03Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-2',
                name: 'Edit',
                input: {
                  file_path: '/src/index.ts',
                  old_string: 'const x: string = 5;',
                  new_string: 'const x: number = 5;',
                },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-2',
          sessionId: 'debug-001',
          timestamp: '2026-01-24T10:00:04Z',
          tool_result: { tool_use_id: 'tool-2', content: 'File edited', is_error: false },
        },
        // Check with tsc
        {
          type: 'assistant',
          uuid: 'assistant-3',
          sessionId: 'debug-001',
          timestamp: '2026-01-24T10:00:05Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'tool-3', name: 'Bash', input: { command: 'npx tsc' } },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-3',
          sessionId: 'debug-001',
          timestamp: '2026-01-24T10:00:06Z',
          tool_result: { tool_use_id: 'tool-3', content: 'No errors', is_error: false },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getToolSequences({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.sequences).toHaveLength(3);
      expect(result.data!.sequences.map((s) => s.toolName)).toEqual(['Read', 'Edit', 'Bash']);
      expect(result.data!.repeatPatterns).toHaveLength(0); // No repeats
    });
  });
});
