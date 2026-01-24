/**
 * Integration tests for get_session_timeline tool
 *
 * Tests the session timeline extraction with realistic session data.
 *
 * @module tests/integration/sessions/tools/get-session-timeline.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getSessionTimeline } from '../../../../src/sessions/tools/get-session-timeline-tool';

describe('get_session_timeline integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'timeline-integration-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Real Session Workflow', () => {
    it('should extract timeline from a realistic debugging session', async () => {
      // Simulate a debugging session with multiple tool uses
      const sessionPath = join(tempDir, 'debug-session.jsonl');
      const entries = [
        // User starts with a bug report
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'debug-session-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'The login form is not validating email correctly. Users can submit invalid emails.',
              },
            ],
          },
        },
        // Assistant reads the code
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'debug-session-001',
          timestamp: '2026-01-24T10:00:05Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Let me look at the login form validation.' },
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Read',
                input: { file_path: '/src/components/LoginForm.tsx' },
              },
            ],
            usage: { input_tokens: 500, output_tokens: 100 },
          },
        },
        // Tool result
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'debug-session-001',
          timestamp: '2026-01-24T10:00:06Z',
          tool_result: {
            tool_use_id: 'tool-1',
            content: 'function validateEmail(email) { return email.includes("@"); }',
          },
        },
        // Assistant makes a fix
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'debug-session-001',
          timestamp: '2026-01-24T10:00:15Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'I found the issue. The validation is too simple.' },
              {
                type: 'tool_use',
                id: 'tool-2',
                name: 'Edit',
                input: { file_path: '/src/components/LoginForm.tsx' },
              },
            ],
            usage: { input_tokens: 600, output_tokens: 150 },
          },
        },
        // Edit result
        {
          type: 'tool_result',
          uuid: 'result-2',
          sessionId: 'debug-session-001',
          timestamp: '2026-01-24T10:00:16Z',
          tool_result: {
            tool_use_id: 'tool-2',
            content: 'File updated successfully',
          },
        },
        // User confirms
        {
          type: 'user',
          uuid: 'user-2',
          sessionId: 'debug-session-001',
          timestamp: '2026-01-24T10:01:00Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Thanks, that looks good!' }],
          },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getSessionTimeline({
        filePath: sessionPath,
        projectPath: '/test/project',
      });

      expect(result.success).toBe(true);
      expect(result.timeline).toBeDefined();

      // Verify intent extraction
      expect(result.timeline!.intent.firstUserPrompt).toContain('login form');
      expect(result.timeline!.intent.firstUserPrompt).toContain('email');

      // Verify outcome signals
      expect(result.timeline!.outcome.signals.containsThanks).toBe(true);
      expect(result.timeline!.outcome.signals.endsWithError).toBe(false);
      expect(result.timeline!.outcome.lastToolCall?.name).toBe('Edit');
      expect(result.timeline!.outcome.lastToolCall?.success).toBe(true);

      // Verify metrics
      expect(result.timeline!.turnCount).toBe(4); // 2 user + 2 assistant
      expect(result.timeline!.metrics.inputTokens).toBe(1100); // 500 + 600
      expect(result.timeline!.metrics.outputTokens).toBe(250); // 100 + 150
    });

    it('should extract timeline from a session with compression events', async () => {
      const sessionPath = join(tempDir, 'long-session.jsonl');
      const entries = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'long-session-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Help me refactor the entire authentication module.' }],
          },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'long-session-001',
          timestamp: '2026-01-24T10:00:05Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'I will help refactor the authentication module.' }],
            usage: { input_tokens: 1000, output_tokens: 200 },
          },
        },
        // First compression event
        {
          type: 'summary',
          uuid: 'summary-1',
          sessionId: 'long-session-001',
          timestamp: '2026-01-24T11:00:00Z',
          summary:
            'Refactored auth middleware and updated JWT handling. Fixed token expiration logic.',
        },
        {
          type: 'user',
          uuid: 'user-2',
          sessionId: 'long-session-001',
          timestamp: '2026-01-24T11:00:01Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Continue with the session management.' }],
          },
        },
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'long-session-001',
          timestamp: '2026-01-24T11:00:10Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Working on session management now.' }],
            usage: { input_tokens: 800, output_tokens: 150 },
          },
        },
        // Second compression event
        {
          type: 'summary',
          uuid: 'summary-2',
          sessionId: 'long-session-001',
          timestamp: '2026-01-24T12:00:00Z',
          summary: 'Completed session management refactor. Added Redis cache for sessions.',
        },
        {
          type: 'user',
          uuid: 'user-3',
          sessionId: 'long-session-001',
          timestamp: '2026-01-24T12:00:01Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Perfect, that is done!' }],
          },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getSessionTimeline({
        filePath: sessionPath,
        projectPath: '/test/project',
      });

      expect(result.success).toBe(true);
      expect(result.timeline!.metrics.compressionCount).toBe(2);
      expect(result.timeline!.outcome.signals.containsDone).toBe(true);

      // Session duration should span from start to end
      expect(result.timeline!.startTime).toBe('2026-01-24T10:00:00Z');
      expect(result.timeline!.endTime).toBe('2026-01-24T12:00:01Z');
      // 2 hours and 1 second = 7201000 ms
      expect(result.timeline!.duration).toBe(7201000);
    });

    it('should handle session with commit activity', async () => {
      const sessionPath = join(tempDir, 'commit-session.jsonl');
      const entries = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'commit-session-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Fix the typo and commit the change.' }],
          },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'commit-session-001',
          timestamp: '2026-01-24T10:00:05Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'tool-1', name: 'Edit', input: { file_path: '/README.md' } },
            ],
            usage: { input_tokens: 200, output_tokens: 50 },
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'commit-session-001',
          timestamp: '2026-01-24T10:00:06Z',
          tool_result: { tool_use_id: 'tool-1', content: 'Edited' },
        },
        {
          type: 'assistant',
          uuid: 'assistant-2',
          sessionId: 'commit-session-001',
          timestamp: '2026-01-24T10:00:10Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-2',
                name: 'Bash',
                input: { command: 'git add README.md && git commit -m "Fix typo"' },
              },
            ],
            usage: { input_tokens: 250, output_tokens: 60 },
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-2',
          sessionId: 'commit-session-001',
          timestamp: '2026-01-24T10:00:11Z',
          tool_result: { tool_use_id: 'tool-2', content: '[main abc123] Fix typo' },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getSessionTimeline({
        filePath: sessionPath,
        projectPath: '/test/project',
      });

      expect(result.success).toBe(true);
      expect(result.timeline!.outcome.hasCommitActivity).toBe(true);
    });

    it('should detect session ending with error', async () => {
      const sessionPath = join(tempDir, 'error-session.jsonl');
      const entries = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'error-session-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Run the failing tests.' }],
          },
        },
        {
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'error-session-001',
          timestamp: '2026-01-24T10:00:05Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'tool-1', name: 'Bash', input: { command: 'npm test' } },
            ],
            usage: { input_tokens: 100, output_tokens: 30 },
          },
        },
        {
          type: 'tool_result',
          uuid: 'result-1',
          sessionId: 'error-session-001',
          timestamp: '2026-01-24T10:00:10Z',
          tool_result: {
            tool_use_id: 'tool-1',
            content: 'Error: 5 tests failed',
            is_error: true,
          },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getSessionTimeline({
        filePath: sessionPath,
        projectPath: '/test/project',
      });

      expect(result.success).toBe(true);
      expect(result.timeline!.outcome.signals.endsWithError).toBe(true);
      expect(result.timeline!.outcome.signals.hasUnresolvedError).toBe(true);
      expect(result.timeline!.outcome.lastToolCall?.name).toBe('Bash');
      expect(result.timeline!.outcome.lastToolCall?.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single-message session', async () => {
      const sessionPath = join(tempDir, 'single-message.jsonl');
      const entries = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'single-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Hello' }],
          },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getSessionTimeline({
        filePath: sessionPath,
        projectPath: '/test/project',
      });

      expect(result.success).toBe(true);
      expect(result.timeline!.intent.firstUserPrompt).toBe('Hello');
      expect(result.timeline!.turnCount).toBe(1);
    });

    it('should handle malformed JSON lines gracefully', async () => {
      const sessionPath = join(tempDir, 'malformed.jsonl');
      const content = [
        JSON.stringify({
          type: 'user',
          uuid: 'user-1',
          sessionId: 'malformed-001',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        }),
        '{ invalid json line',
        JSON.stringify({
          type: 'assistant',
          uuid: 'assistant-1',
          sessionId: 'malformed-001',
          timestamp: '2026-01-24T10:00:05Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Hi!' }] },
        }),
      ].join('\n');

      await writeFile(sessionPath, content);

      const result = await getSessionTimeline({
        filePath: sessionPath,
        projectPath: '/test/project',
      });

      // Should succeed, skipping the malformed line
      expect(result.success).toBe(true);
      expect(result.timeline!.turnCount).toBe(2);
    });

    it('should preserve session ID from entries', async () => {
      const sessionPath = join(tempDir, 'with-session-id.jsonl');
      const entries = [
        {
          type: 'user',
          uuid: 'user-1',
          sessionId: 'specific-session-uuid-12345',
          timestamp: '2026-01-24T10:00:00Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Test' }] },
        },
      ];

      await writeFile(sessionPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

      const result = await getSessionTimeline({
        filePath: sessionPath,
        projectPath: '/test/project',
      });

      expect(result.success).toBe(true);
      expect(result.timeline!.sessionId).toBe('specific-session-uuid-12345');
    });
  });
});
