/**
 * Unit tests for get_session_timeline tool
 *
 * Tests the session timeline extraction tool.
 *
 * @module tests/unit/sessions/tools/get-session-timeline.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getSessionTimeline } from '../../../../src/sessions/tools/get-session-timeline-tool';

describe('get_session_timeline tool', () => {
  let tempDir: string;
  let sessionFilePath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'get-timeline-test-'));
    sessionFilePath = join(tempDir, 'session.jsonl');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Create a minimal session JSONL file for testing.
   */
  async function createTestSession(
    entries: Array<{
      type: string;
      uuid: string;
      sessionId?: string;
      timestamp: string;
      message?: {
        role: string;
        content: Array<{
          type: string;
          text?: string;
          name?: string;
          input?: Record<string, unknown>;
        }>;
        usage?: { input_tokens: number; output_tokens: number };
      };
      toolResult?: {
        toolUseId: string;
        content: string;
        isError?: boolean;
      };
      summary?: string;
    }>
  ): Promise<string> {
    const lines = entries.map((e) => JSON.stringify(e));
    await writeFile(sessionFilePath, lines.join('\n') + '\n');
    return sessionFilePath;
  }

  describe('extractTimelineFromFile', () => {
    it('should extract intent from first user message', async () => {
      await createTestSession([
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:00:00Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Help me fix the login bug' }],
          },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:00:05Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'I will help you fix the login bug.' }],
            usage: { input_tokens: 100, output_tokens: 50 },
          },
        },
      ]);

      const result = await getSessionTimeline({
        filePath: sessionFilePath,
        projectPath: '/test/project',
      });

      expect(result.success).toBe(true);
      expect(result.timeline).toBeDefined();
      expect(result.timeline!.intent.firstUserPrompt).toBe('Help me fix the login bug');
      expect(result.timeline!.intent.promptLength).toBe(25);
    });

    it('should extract outcome signals from last user message', async () => {
      await createTestSession([
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:00:00Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Fix the bug' }],
          },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:00:05Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Done!' }],
            usage: { input_tokens: 100, output_tokens: 50 },
          },
        },
        {
          type: 'user',
          uuid: 'user-2',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:01:00Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Thanks, that works!' }],
          },
        },
      ]);

      const result = await getSessionTimeline({
        filePath: sessionFilePath,
        projectPath: '/test/project',
      });

      expect(result.success).toBe(true);
      expect(result.timeline!.outcome.lastUserPrompt).toBe('Thanks, that works!');
      expect(result.timeline!.outcome.signals.containsThanks).toBe(true);
    });

    it('should detect commit activity in session', async () => {
      await createTestSession([
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:00:00Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Commit the changes' }],
          },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:00:05Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'tool_use', name: 'Bash', input: { command: 'git commit -m "Fix bug"' } },
            ],
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:00:06Z',
          toolResult: {
            toolUseId: 'tool-1',
            content: 'Committed successfully',
          },
        },
      ]);

      const result = await getSessionTimeline({
        filePath: sessionFilePath,
        projectPath: '/test/project',
      });

      expect(result.success).toBe(true);
      expect(result.timeline!.outcome.hasCommitActivity).toBe(true);
    });

    it('should calculate duration from timestamps', async () => {
      await createTestSession([
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:00:00Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Start' }],
          },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:05:00Z', // 5 minutes later
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Done' }],
          },
        },
      ]);

      const result = await getSessionTimeline({
        filePath: sessionFilePath,
        projectPath: '/test/project',
      });

      expect(result.success).toBe(true);
      expect(result.timeline!.startTime).toBe('2026-01-24T10:00:00Z');
      expect(result.timeline!.endTime).toBe('2026-01-24T10:05:00Z');
      expect(result.timeline!.duration).toBe(300000); // 5 minutes in ms
    });

    it('should extract compression events', async () => {
      await createTestSession([
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:00:00Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Start working' }],
          },
        },
        {
          type: 'summary',
          uuid: 'summary-1',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T11:00:00Z',
          summary: 'Session summary after compression...',
        },
        {
          type: 'user',
          uuid: 'user-2',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T11:00:01Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Continue' }],
          },
        },
      ]);

      const result = await getSessionTimeline({
        filePath: sessionFilePath,
        projectPath: '/test/project',
      });

      expect(result.success).toBe(true);
      expect(result.timeline!.metrics.compressionCount).toBe(1);
    });

    it('should aggregate token metrics', async () => {
      await createTestSession([
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:00:00Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Hello' }],
          },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:00:01Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hi!' }],
            usage: { input_tokens: 100, output_tokens: 50 },
          },
        },
        {
          type: 'user',
          uuid: 'user-2',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:00:02Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Help me' }],
          },
        },
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:00:03Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Of course' }],
            usage: { input_tokens: 150, output_tokens: 75 },
          },
        },
      ]);

      const result = await getSessionTimeline({
        filePath: sessionFilePath,
        projectPath: '/test/project',
      });

      expect(result.success).toBe(true);
      expect(result.timeline!.metrics.inputTokens).toBe(250);
      expect(result.timeline!.metrics.outputTokens).toBe(125);
    });

    it('should handle empty session file', async () => {
      await writeFile(sessionFilePath, '');

      const result = await getSessionTimeline({
        filePath: sessionFilePath,
        projectPath: '/test/project',
      });

      expect(result.success).toBe(true);
      expect(result.timeline!.turnCount).toBe(0);
      expect(result.timeline!.intent.firstUserPrompt).toBe('');
    });

    it('should return error for non-existent file', async () => {
      const result = await getSessionTimeline({
        filePath: '/non/existent/file.jsonl',
        projectPath: '/test/project',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('SESSION_FILE_NOT_FOUND');
    });

    it('should count turns correctly', async () => {
      await createTestSession([
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Turn 1' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:00:01Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Response 1' }] },
        },
        {
          type: 'user',
          uuid: 'user-2',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:00:02Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Turn 2' }] },
        },
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'test-session-123',
          timestamp: '2026-01-24T10:00:03Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Response 2' }] },
        },
      ]);

      const result = await getSessionTimeline({
        filePath: sessionFilePath,
        projectPath: '/test/project',
      });

      expect(result.success).toBe(true);
      expect(result.timeline!.turnCount).toBe(4);
    });
  });
});
