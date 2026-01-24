/**
 * Integration tests for get_delegation_events tool
 *
 * Tests delegation event extraction with realistic session data.
 *
 * @module tests/integration/sessions/tools/get-delegation-events.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDelegationEvents } from '../../../../src/sessions/tools/get-delegation-events-tool';

describe('get_delegation_events integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'delegation-events-integration-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Delegation Extraction', () => {
    it('should extract delegation events from Task tool calls', async () => {
      const sessionPath = join(tempDir, 'with-delegations.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'deleg-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Find and fix the bug' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'deleg-001',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'task-1',
                name: 'Task',
                input: {
                  subagent_type: 'Explore',
                  prompt: 'Find all error handling code',
                  description: 'Search codebase',
                },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'deleg-001',
          timestamp: '2026-01-24T10:00:10Z',
          tool_result: {
            tool_use_id: 'task-1',
            content: 'Found 5 error handlers',
            is_error: false,
          },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getDelegationEvents({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.events).toHaveLength(1);
      expect(result.data!.events[0]!.subagentType).toBe('Explore');
      expect(result.data!.events[0]!.taskPrompt).toBe('Find all error handling code');
      expect(result.data!.events[0]!.success).toBe(true);
    });

    it('should track multiple delegations', async () => {
      const sessionPath = join(tempDir, 'multi-deleg.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'multi-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Build and test' }] },
        },
        // First delegation: Explore
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'multi-001',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'task-1',
                name: 'Task',
                input: { subagent_type: 'Explore', prompt: 'Find build config' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'multi-001',
          timestamp: '2026-01-24T10:00:05Z',
          tool_result: { tool_use_id: 'task-1', content: 'Found config', is_error: false },
        },
        // Second delegation: Bash
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'multi-001',
          timestamp: '2026-01-24T10:00:06Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'task-2',
                name: 'Task',
                input: { subagent_type: 'Bash', prompt: 'Run npm build' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-2',
          sessionId: 'multi-001',
          timestamp: '2026-01-24T10:00:15Z',
          tool_result: { tool_use_id: 'task-2', content: 'Build complete', is_error: false },
        },
        // Third delegation: general-purpose
        {
          type: 'assistant',
          uuid: 'assistant-3',
          sessionId: 'multi-001',
          timestamp: '2026-01-24T10:00:16Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'task-3',
                name: 'Task',
                input: { subagent_type: 'general-purpose', prompt: 'Run test suite' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-3',
          sessionId: 'multi-001',
          timestamp: '2026-01-24T10:00:30Z',
          tool_result: { tool_use_id: 'task-3', content: 'All tests pass', is_error: false },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getDelegationEvents({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.events).toHaveLength(3);
      expect(result.data!.totalCount).toBe(3);
      expect(result.data!.successRate).toBe(1);
      expect(result.data!.subagentTypes).toContain('Explore');
      expect(result.data!.subagentTypes).toContain('Bash');
      expect(result.data!.subagentTypes).toContain('general-purpose');
    });

    it('should track failed delegations', async () => {
      const sessionPath = join(tempDir, 'failed-deleg.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'fail-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Run tests' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'fail-001',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'task-1',
                name: 'Task',
                input: { subagent_type: 'Bash', prompt: 'npm test' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'fail-001',
          timestamp: '2026-01-24T10:00:10Z',
          tool_result: { tool_use_id: 'task-1', content: 'Tests failed', is_error: true },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getDelegationEvents({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.events).toHaveLength(1);
      expect(result.data!.events[0]!.success).toBe(false);
      expect(result.data!.successRate).toBe(0);
    });
  });

  describe('Filtering', () => {
    it('should filter by subagent type', async () => {
      const sessionPath = join(tempDir, 'filter-type.jsonl');

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
                id: 'task-1',
                name: 'Task',
                input: { subagent_type: 'Explore', prompt: 'Explore 1' },
              },
            ],
          },
        },
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'filter-001',
          timestamp: '2026-01-24T10:00:02Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'task-2',
                name: 'Task',
                input: { subagent_type: 'Bash', prompt: 'Run command' },
              },
            ],
          },
        },
        {
          type: 'assistant',
          uuid: 'assistant-3',
          sessionId: 'filter-001',
          timestamp: '2026-01-24T10:00:03Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'task-3',
                name: 'Task',
                input: { subagent_type: 'Explore', prompt: 'Explore 2' },
              },
            ],
          },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getDelegationEvents({
        filePath: sessionPath,
        subagentType: 'Explore',
      });

      expect(result.success).toBe(true);
      expect(result.data!.events).toHaveLength(2);
      expect(result.data!.events.every((e) => e.subagentType === 'Explore')).toBe(true);
    });
  });

  describe('Nested Delegation Edge Case (T046)', () => {
    it('should handle nested Task calls within a session', async () => {
      // This tests the case where a session contains Task calls that may have
      // spawned subagent sessions. We track them as separate events.
      const sessionPath = join(tempDir, 'nested-deleg.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'nested-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Complex task' }] },
        },
        // First level delegation
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'nested-001',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'task-1',
                name: 'Task',
                input: { subagent_type: 'Plan', prompt: 'Plan the implementation' },
              },
            ],
          },
        },
        // The Plan subagent internally may have used Task, but that would be
        // in a different session. We just see the result here.
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'nested-001',
          timestamp: '2026-01-24T10:00:30Z',
          tool_result: { tool_use_id: 'task-1', content: 'Plan created', is_error: false },
        },
        // Second delegation based on plan
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'nested-001',
          timestamp: '2026-01-24T10:00:31Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'task-2',
                name: 'Task',
                input: { subagent_type: 'general-purpose', prompt: 'Implement step 1' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-2',
          sessionId: 'nested-001',
          timestamp: '2026-01-24T10:01:00Z',
          tool_result: { tool_use_id: 'task-2', content: 'Step 1 done', is_error: false },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getDelegationEvents({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.events).toHaveLength(2);
      expect(result.data!.subagentTypes).toContain('Plan');
      expect(result.data!.subagentTypes).toContain('general-purpose');
    });
  });

  describe('Error Handling', () => {
    it('should return error for non-existent file', async () => {
      const result = await getDelegationEvents({
        filePath: '/nonexistent/session.jsonl',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SESSION_FILE_NOT_FOUND');
    });

    it('should handle session with no delegations', async () => {
      const sessionPath = join(tempDir, 'no-tasks.jsonl');

      const entries = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'no-task-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'no-task-001',
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

      const result = await getDelegationEvents({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.events).toHaveLength(0);
      expect(result.data!.totalCount).toBe(0);
      expect(result.data!.successRate).toBe(1); // No failures = 100%
    });
  });
});
