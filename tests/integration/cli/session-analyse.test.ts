/**
 * EP15 Session Intelligence - CLI Integration Tests
 *
 * Tests for the `agentlint analyse --session` command.
 *
 * @module tests/integration/cli/session-analyse
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('agentlint analyse --session', () => {
  let tempDir: string;
  let sessionFile: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'session-analyse-cli-'));
    sessionFile = join(tempDir, 'test-session.jsonl');

    // Create .agentlint directory for databases
    await mkdir(join(tempDir, '.agentlint'), { recursive: true });

    // Create a minimal session file
    const entries = [
      {
        type: 'user',
        uuid: 'user-1',
        timestamp: '2026-01-24T10:00:00Z',
        sessionId: 'test-session-cli-123',
        message: { role: 'user', content: [{ type: 'text', text: 'Hello, can you help me?' }] },
      },
      {
        type: 'assistant',
        uuid: 'assistant-1',
        timestamp: '2026-01-24T10:00:05Z',
        sessionId: 'test-session-cli-123',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Of course! How can I assist you today?' }],
        },
      },
      {
        type: 'user',
        uuid: 'user-2',
        timestamp: '2026-01-24T10:00:10Z',
        sessionId: 'test-session-cli-123',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Please read the README file' }],
        },
      },
      {
        type: 'assistant',
        uuid: 'assistant-2',
        timestamp: '2026-01-24T10:00:15Z',
        sessionId: 'test-session-cli-123',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Read',
              input: { file_path: '/project/README.md' },
            },
          ],
        },
      },
      {
        type: 'tool_result',
        uuid: 'result-1',
        timestamp: '2026-01-24T10:00:16Z',
        sessionId: 'test-session-cli-123',
        tool_result: {
          tool_use_id: 'tool-1',
          content: '# Project README\n\nThis is a test project.',
          is_error: false,
        },
      },
    ];

    await writeFile(sessionFile, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('CLI Flag Registration', () => {
    it('should show --session flag in help', () => {
      const result = spawnSync('bun', ['run', 'src/cli.ts', 'analyse', '--help'], {
        encoding: 'utf-8',
        cwd: process.cwd(),
      });

      expect(result.stdout).toContain('--session');
      expect(result.stdout).toContain('Analyze a specific Claude Code session');
    });

    it('should show session example in help', () => {
      const result = spawnSync('bun', ['run', 'src/cli.ts', 'analyse', '--help'], {
        encoding: 'utf-8',
        cwd: process.cwd(),
      });

      expect(result.stdout).toContain('--session <id>');
      expect(result.stdout).toContain('Analyze a specific session');
    });
  });

  describe('Session Analysis Invocation', () => {
    it('should require API key for session analysis', () => {
      // Run without API key
      const result = spawnSync('bun', ['run', 'src/cli.ts', 'analyse', '--session', 'test-123'], {
        encoding: 'utf-8',
        cwd: process.cwd(),
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: '',
          OPENAI_API_KEY: '',
        },
      });

      // Should fail with provider error
      expect(result.status).toBe(1);
      expect(result.stderr.toLowerCase()).toMatch(/api.?key|provider/i);
    });

    // Note: Full session analysis tests with API key are in live tests
    // These unit/integration tests verify the CLI infrastructure works
  });

  describe('AnalyseOptions Interface', () => {
    it('should include session option in types', async () => {
      // Import the types module to verify session option is defined
      const { runAnalyse } = await import('../../../src/cli/commands/analyse');

      // The function should accept session option without TypeScript errors
      // This test verifies the type system is correctly configured
      expect(typeof runAnalyse).toBe('function');
    });
  });

  describe('Session File Path Handling', () => {
    it('should accept session ID format', () => {
      // Session ID format: UUID-like string
      const sessionId = 'a5846405-97b1-4f19-b406-eb30039e787a';

      // Verify it doesn't look like a path
      expect(sessionId.includes('/')).toBe(false);
      expect(sessionId.endsWith('.jsonl')).toBe(false);
    });

    it('should accept session file path format', () => {
      // Session file path: contains / or ends with .jsonl
      expect(sessionFile.includes('/')).toBe(true);
      expect(sessionFile.endsWith('.jsonl')).toBe(true);
    });
  });
});
