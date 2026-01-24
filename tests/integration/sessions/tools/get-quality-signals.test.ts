/**
 * Integration tests for get_quality_signals tool
 *
 * Tests quality signal extraction with realistic session data.
 *
 * @module tests/integration/sessions/tools/get-quality-signals.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getQualitySignals } from '../../../../src/sessions/tools/get-quality-signals-tool';

describe('get_quality_signals integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'quality-signals-integration-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Test Output Extraction', () => {
    it('should extract test results from bun test output', async () => {
      const sessionPath = join(tempDir, 'with-tests.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'test-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Run tests' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'test-001',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'bash-1',
                name: 'Bash',
                input: { command: 'bun run test' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'test-001',
          timestamp: '2026-01-24T10:00:10Z',
          tool_result: {
            tool_use_id: 'bash-1',
            content: `bun test v1.2.0

 ✓ tests/unit/example.test.ts > should work
 ✓ tests/unit/example.test.ts > should also work

 2 pass
 0 fail`,
            is_error: false,
          },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getQualitySignals({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.signals).toHaveLength(1);
      expect(result.data!.signals[0]!.signalType).toBe('test');
      expect(result.data!.signals[0]!.passed).toBe(true);
      expect(result.data!.summary.testsPassed).toBe(1);
    });

    it('should detect failing tests', async () => {
      const sessionPath = join(tempDir, 'failing-tests.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'test-002',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Run tests' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'test-002',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'bash-1',
                name: 'Bash',
                input: { command: 'npm test' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'test-002',
          timestamp: '2026-01-24T10:00:15Z',
          tool_result: {
            tool_use_id: 'bash-1',
            content: `FAIL src/__tests__/example.test.ts
  Example
    ✕ should work (5ms)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total`,
            is_error: true,
          },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getQualitySignals({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.signals).toHaveLength(1);
      expect(result.data!.signals[0]!.passed).toBe(false);
      expect(result.data!.summary.testsFailed).toBe(1);
    });
  });

  describe('Build Output Extraction', () => {
    it('should extract build results from tsc', async () => {
      const sessionPath = join(tempDir, 'with-build.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'build-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Type check' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'build-001',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'bash-1',
                name: 'Bash',
                input: { command: 'tsc --noEmit' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'build-001',
          timestamp: '2026-01-24T10:00:05Z',
          tool_result: {
            tool_use_id: 'bash-1',
            content: '',
            is_error: false,
          },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getQualitySignals({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.signals).toHaveLength(1);
      expect(result.data!.signals[0]!.signalType).toBe('build');
      expect(result.data!.signals[0]!.passed).toBe(true);
      expect(result.data!.summary.buildsPassed).toBe(1);
    });

    it('should detect build failures', async () => {
      const sessionPath = join(tempDir, 'failing-build.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'build-002',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Build' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'build-002',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'bash-1',
                name: 'Bash',
                input: { command: 'tsc' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'build-002',
          timestamp: '2026-01-24T10:00:10Z',
          tool_result: {
            tool_use_id: 'bash-1',
            content: `src/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.

Found 1 error.`,
            is_error: true,
          },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getQualitySignals({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.signals).toHaveLength(1);
      expect(result.data!.signals[0]!.passed).toBe(false);
      expect(result.data!.summary.buildsFailed).toBe(1);
    });
  });

  describe('Lint Output Extraction', () => {
    it('should extract lint results', async () => {
      const sessionPath = join(tempDir, 'with-lint.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'lint-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Check lint' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'lint-001',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'bash-1',
                name: 'Bash',
                input: { command: 'npx eslint src/' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'lint-001',
          timestamp: '2026-01-24T10:00:05Z',
          tool_result: {
            tool_use_id: 'bash-1',
            content: '',
            is_error: false,
          },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getQualitySignals({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.signals).toHaveLength(1);
      expect(result.data!.signals[0]!.signalType).toBe('lint');
      expect(result.data!.signals[0]!.passed).toBe(true);
      expect(result.data!.summary.lintsPassed).toBe(1);
    });
  });

  describe('Multiple Signals', () => {
    it('should track full quality verification workflow', async () => {
      const sessionPath = join(tempDir, 'full-workflow.jsonl');

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'workflow-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Run all checks' }] },
        },
        // Build
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'workflow-001',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'bash-1',
                name: 'Bash',
                input: { command: 'tsc --noEmit' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'workflow-001',
          timestamp: '2026-01-24T10:00:05Z',
          tool_result: { tool_use_id: 'bash-1', content: '', is_error: false },
        },
        // Lint
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'workflow-001',
          timestamp: '2026-01-24T10:00:06Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'bash-2',
                name: 'Bash',
                input: { command: 'eslint src/' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-2',
          sessionId: 'workflow-001',
          timestamp: '2026-01-24T10:00:10Z',
          tool_result: { tool_use_id: 'bash-2', content: '', is_error: false },
        },
        // Test
        {
          type: 'assistant',
          uuid: 'assistant-3',
          sessionId: 'workflow-001',
          timestamp: '2026-01-24T10:00:11Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'bash-3',
                name: 'Bash',
                input: { command: 'bun test' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-3',
          sessionId: 'workflow-001',
          timestamp: '2026-01-24T10:00:20Z',
          tool_result: {
            tool_use_id: 'bash-3',
            content: '10 pass\n0 fail',
            is_error: false,
          },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getQualitySignals({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.signals).toHaveLength(3);
      expect(result.data!.summary.buildsPassed).toBe(1);
      expect(result.data!.summary.lintsPassed).toBe(1);
      expect(result.data!.summary.testsPassed).toBe(1);
    });
  });

  describe('Filtering', () => {
    it('should filter by signal type', async () => {
      const sessionPath = join(tempDir, 'multi-type.jsonl');

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
                id: 'bash-1',
                name: 'Bash',
                input: { command: 'tsc --noEmit' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'filter-001',
          timestamp: '2026-01-24T10:00:05Z',
          tool_result: { tool_use_id: 'bash-1', content: '', is_error: false },
        },
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'filter-001',
          timestamp: '2026-01-24T10:00:06Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'bash-2',
                name: 'Bash',
                input: { command: 'bun test' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-2',
          sessionId: 'filter-001',
          timestamp: '2026-01-24T10:00:15Z',
          tool_result: { tool_use_id: 'bash-2', content: '5 pass\n0 fail', is_error: false },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getQualitySignals({
        filePath: sessionPath,
        signalType: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.data!.signals).toHaveLength(1);
      expect(result.data!.signals[0]!.signalType).toBe('test');
    });
  });

  describe('Raw Output for Agent Interpretation', () => {
    it('should include raw output for agent interpretation', async () => {
      const sessionPath = join(tempDir, 'raw-output.jsonl');

      const rawTestOutput = `bun test v1.2.0

 ✓ tests/example.test.ts > should work (5ms)

 1 pass
 0 fail
 1 expect() calls`;

      const entries: unknown[] = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'raw-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Test' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'raw-001',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'bash-1',
                name: 'Bash',
                input: { command: 'bun test' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'raw-001',
          timestamp: '2026-01-24T10:00:10Z',
          tool_result: {
            tool_use_id: 'bash-1',
            content: rawTestOutput,
            is_error: false,
          },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getQualitySignals({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.signals[0]!.rawOutput).toBe(rawTestOutput);
    });
  });

  describe('Error Handling', () => {
    it('should return error for non-existent file', async () => {
      const result = await getQualitySignals({
        filePath: '/nonexistent/session.jsonl',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SESSION_FILE_NOT_FOUND');
    });

    it('should handle session with no quality signals', async () => {
      const sessionPath = join(tempDir, 'no-quality.jsonl');

      const entries = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'no-qual-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'no-qual-001',
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

      const result = await getQualitySignals({ filePath: sessionPath });

      expect(result.success).toBe(true);
      expect(result.data!.signals).toHaveLength(0);
      expect(result.data!.summary.testsPassed).toBe(0);
      expect(result.data!.summary.buildsPassed).toBe(0);
      expect(result.data!.summary.lintsPassed).toBe(0);
    });
  });
});
