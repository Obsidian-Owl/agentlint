/**
 * Integration tests for session persistence
 *
 * Tests the full flow: checkpoint → crash → recover → resume
 * Uses real filesystem and atomic writes.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { SessionState, Finding, ToolResult } from '../../../src/orchestration/types';

// Full public API
import {
  saveSessionState,
  loadSessionState,
  findIncomplete,
  cleanup,
  listSessionIds,
  SESSION_STATE_VERSION,
} from '../../../src/persistence/sessions/storage';

describe('Session Persistence Integration', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-integration-sessions');

  // Helper to create a realistic session state
  function createRealisticSession(overrides: Partial<SessionState> = {}): SessionState {
    return {
      id: crypto.randomUUID(),
      phase: 'config-analysis',
      startedAt: new Date().toISOString(),
      lastCheckpointAt: null,
      findings: createRealisticFindings(),
      toolResultCache: createRealisticToolCache(),
      checkpointSequence: 3,
      taskGoal: 'Analyze CLAUDE.md configuration for best practices and security issues',
      projectContext: {
        name: 'my-awesome-project',
        path: '/home/user/projects/my-awesome-project',
        hasClaudeMd: true,
        primaryLanguage: 'typescript',
        agentType: 'claude-code',
      },
      ...overrides,
    };
  }

  function createRealisticFindings(): Finding[] {
    return [
      {
        id: crypto.randomUUID(),
        type: 'config_gap',
        severity: 'high',
        title: 'Missing file permissions configuration',
        description:
          'The CLAUDE.md file does not define file permissions, allowing the agent to potentially modify files outside the intended scope.',
        location: {
          file: 'CLAUDE.md',
          line: 1,
          snippet: '# Project Configuration\n\n## Overview',
        },
        origin: {
          type: 'config',
          reference: 'CLAUDE.md',
          description: 'Configuration file analysis',
        },
        recommendations: [
          {
            type: 'preventive',
            action: 'Add an explicit permissions section specifying allowed directories',
            rationale: 'Explicit permissions prevent unintended file modifications',
            priority: 'high',
          },
          {
            type: 'symptomatic',
            action: "Add 'allow_edit: src/**, tests/**' to restrict edit access",
            rationale: 'Limits potential damage from overly broad access',
            priority: 'high',
          },
        ],
        detectedAt: new Date().toISOString(),
        detectedInPhase: 'config-analysis',
      },
      {
        id: crypto.randomUUID(),
        type: 'config_antipattern',
        severity: 'medium',
        title: 'Using wildcard in shell command allowlist',
        description:
          'The allow_bash pattern "npm *" is overly permissive and could allow unintended commands.',
        location: {
          file: 'CLAUDE.md',
          line: 45,
          snippet: 'allow_bash: npm *',
        },
        origin: {
          type: 'config',
          reference: 'CLAUDE.md:45',
          description: 'Security policy analysis',
        },
        recommendations: [
          {
            type: 'preventive',
            action:
              'Replace "npm *" with specific commands: "npm install", "npm test", "npm run build"',
            rationale: 'Explicit allowlist prevents command injection vectors',
            priority: 'medium',
          },
        ],
        detectedAt: new Date().toISOString(),
        detectedInPhase: 'config-analysis',
      },
    ];
  }

  function createRealisticToolCache(): Record<string, ToolResult> {
    return {
      'read-file:CLAUDE.md': {
        toolName: 'read-file',
        input: 'CLAUDE.md',
        output:
          '# Project Configuration\n\n## Overview\nThis is a TypeScript project...\n\n## Permissions\nallow_bash: npm *\n',
        timestamp: new Date().toISOString(),
        durationMs: 15,
      },
      'glob:src/**/*.ts': {
        toolName: 'glob',
        input: 'src/**/*.ts',
        output: ['src/index.ts', 'src/utils/helper.ts', 'src/types/index.ts'],
        timestamp: new Date().toISOString(),
        durationMs: 45,
      },
      'grep:TODO': {
        toolName: 'grep',
        input: 'TODO',
        output: [
          { file: 'src/index.ts', line: 15, content: '// TODO: Add error handling' },
          { file: 'src/utils/helper.ts', line: 42, content: '// TODO: Optimize this loop' },
        ],
        timestamp: new Date().toISOString(),
        durationMs: 120,
      },
    };
  }

  beforeEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  describe('Full Session Lifecycle', () => {
    it('should support complete checkpoint → crash → recover flow', async () => {
      // Phase 1: Normal operation with checkpoints
      const session = createRealisticSession({
        phase: 'config-analysis',
        checkpointSequence: 0,
      });

      // First checkpoint
      session.checkpointSequence = 1;
      session.lastCheckpointAt = new Date().toISOString();
      await saveSessionState(session, { baseDir: testBaseDir, updateCheckpointTime: true });

      // Phase transition checkpoint
      session.phase = 'quality-analysis';
      session.checkpointSequence = 2;
      session.findings.push({
        id: crypto.randomUUID(),
        type: 'quality_issue',
        severity: 'low',
        title: 'Missing JSDoc comments',
        description: 'Several exported functions lack documentation',
        location: { file: 'src/index.ts', line: 1 },
        origin: null,
        recommendations: [],
        detectedAt: new Date().toISOString(),
        detectedInPhase: 'quality-analysis',
      });
      await saveSessionState(session, { baseDir: testBaseDir, updateCheckpointTime: true });

      // Phase 2: Simulate crash (state object is "lost")
      // In reality, the process would crash here and session would be undefined

      // Phase 3: Recovery
      const incomplete = await findIncomplete({ baseDir: testBaseDir });
      expect(incomplete.length).toBe(1);
      expect(incomplete[0]?.sessionId).toBe(session.id);

      // Phase 4: Resume
      const recovered = await loadSessionState(incomplete[0]!.sessionId, { baseDir: testBaseDir });

      // Verify all state preserved
      expect(recovered).not.toBeNull();
      expect(recovered?.id).toBe(session.id);
      expect(recovered?.phase).toBe('quality-analysis');
      expect(recovered?.checkpointSequence).toBe(2);
      expect(recovered?.findings.length).toBe(3); // Original 2 + 1 added
      expect(recovered?.taskGoal).toBe(session.taskGoal);
      expect(Object.keys(recovered?.toolResultCache ?? {}).length).toBe(3);

      // Phase 5: Continue and complete
      const continued = { ...recovered! };
      continued.phase = 'complete';
      continued.checkpointSequence = 3;
      await saveSessionState(continued, { baseDir: testBaseDir });

      // Should no longer be incomplete
      const afterComplete = await findIncomplete({ baseDir: testBaseDir });
      expect(afterComplete.length).toBe(0);
    });

    it('should maintain data integrity across multiple checkpoints', async () => {
      const session = createRealisticSession();
      const originalId = session.id;
      const originalTask = session.taskGoal;

      // Simulate 10 checkpoint cycles
      for (let i = 1; i <= 10; i++) {
        session.checkpointSequence = i;
        session.lastCheckpointAt = new Date().toISOString();

        // Add a finding every 3 checkpoints
        if (i % 3 === 0) {
          session.findings.push({
            id: crypto.randomUUID(),
            type: 'improvement',
            severity: 'info',
            title: `Finding at checkpoint ${i}`,
            description: 'Auto-generated finding for test',
            location: null,
            origin: null,
            recommendations: [],
            detectedAt: new Date().toISOString(),
            detectedInPhase: session.phase,
          });
        }

        await saveSessionState(session, { baseDir: testBaseDir });
      }

      // Load and verify
      const loaded = await loadSessionState(originalId, { baseDir: testBaseDir });

      expect(loaded?.id).toBe(originalId);
      expect(loaded?.taskGoal).toBe(originalTask);
      expect(loaded?.checkpointSequence).toBe(10);
      expect(loaded?.findings.length).toBe(5); // 2 original + 3 added (at 3, 6, 9)
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent saves without data loss', async () => {
      const sessions = Array.from({ length: 10 }, () => createRealisticSession());

      // Save all concurrently
      await Promise.all(sessions.map((s) => saveSessionState(s, { baseDir: testBaseDir })));

      // All should be present
      const ids = await listSessionIds({ baseDir: testBaseDir });
      expect(ids.length).toBe(10);

      for (const session of sessions) {
        expect(ids).toContain(session.id);
      }
    });

    it('should handle concurrent reads and writes', async () => {
      const session = createRealisticSession();
      await saveSessionState(session, { baseDir: testBaseDir });

      // Concurrent operations: saves, loads, and lists
      const operations = [
        saveSessionState({ ...session, checkpointSequence: 10 }, { baseDir: testBaseDir }),
        loadSessionState(session.id, { baseDir: testBaseDir }),
        listSessionIds({ baseDir: testBaseDir }),
        findIncomplete({ baseDir: testBaseDir }),
        loadSessionState(session.id, { baseDir: testBaseDir }),
      ];

      // All should complete without error
      await Promise.all(operations);

      // File should still exist
      const finalLoad = await loadSessionState(session.id, { baseDir: testBaseDir });
      expect(finalLoad).not.toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted session files gracefully', async () => {
      // Create a valid session
      const valid = createRealisticSession({ phase: 'analysis' });
      await saveSessionState(valid, { baseDir: testBaseDir });

      // Create a corrupted file
      await Bun.write(join(testBaseDir, 'corrupted.json'), '{ not valid json');

      // Operations should not throw
      const ids = await listSessionIds({ baseDir: testBaseDir });
      expect(ids.length).toBe(2); // Both files (one corrupted)

      const incomplete = await findIncomplete({ baseDir: testBaseDir });
      expect(incomplete.length).toBe(1); // Only the valid one
      expect(incomplete[0]?.sessionId).toBe(valid.id);

      const cleaned = await cleanup({ baseDir: testBaseDir, retentionDays: 0 });
      expect(cleaned).toBe(0); // Corrupted skipped, valid is incomplete
    });

    it('should recover from partial JSON writes', async () => {
      const session = createRealisticSession();

      // Save a valid session
      await saveSessionState(session, { baseDir: testBaseDir });

      // Simulate partial write (truncated JSON)
      const filePath = join(testBaseDir, `${session.id}.json`);
      const content = await Bun.file(filePath).text();
      const truncated = content.substring(0, content.length / 2);
      await Bun.write(filePath, truncated);

      // Load should return null for corrupted file
      const loaded = await loadSessionState(session.id, { baseDir: testBaseDir });
      expect(loaded).toBeNull();
    });
  });

  describe('Cleanup and Retention', () => {
    it('should clean up old completed sessions while preserving incomplete', async () => {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;

      // Old completed session
      const oldComplete = createRealisticSession({
        phase: 'complete',
        startedAt: new Date(now - 60 * msPerDay).toISOString(),
        lastCheckpointAt: new Date(now - 60 * msPerDay).toISOString(),
      });
      await saveSessionState(oldComplete, { baseDir: testBaseDir });

      // Old incomplete session (should NOT be deleted)
      const oldIncomplete = createRealisticSession({
        phase: 'analysis',
        startedAt: new Date(now - 60 * msPerDay).toISOString(),
        lastCheckpointAt: new Date(now - 60 * msPerDay).toISOString(),
      });
      await saveSessionState(oldIncomplete, { baseDir: testBaseDir });

      // Recent complete session
      const recentComplete = createRealisticSession({
        phase: 'complete',
        startedAt: new Date(now - 5 * msPerDay).toISOString(),
        lastCheckpointAt: new Date(now - 5 * msPerDay).toISOString(),
      });
      await saveSessionState(recentComplete, { baseDir: testBaseDir });

      // Cleanup
      const deleted = await cleanup({ baseDir: testBaseDir, retentionDays: 30 });

      expect(deleted).toBe(1); // Only oldComplete

      const remaining = await listSessionIds({ baseDir: testBaseDir });
      expect(remaining.length).toBe(2);
      expect(remaining).toContain(oldIncomplete.id);
      expect(remaining).toContain(recentComplete.id);
      expect(remaining).not.toContain(oldComplete.id);
    });
  });

  describe('Tool Result Cache', () => {
    it('should preserve tool result cache across checkpoint/resume cycle', async () => {
      const session = createRealisticSession();

      // Add more complex tool results
      session.toolResultCache['bash:npm test'] = {
        toolName: 'bash',
        input: 'npm test',
        output: {
          exitCode: 0,
          stdout: 'All 50 tests passed',
          stderr: '',
        },
        timestamp: new Date().toISOString(),
        durationMs: 5000,
      };

      await saveSessionState(session, { baseDir: testBaseDir });
      const loaded = await loadSessionState(session.id, { baseDir: testBaseDir });

      expect(loaded?.toolResultCache['bash:npm test']).toBeDefined();
      const bashResult = loaded?.toolResultCache['bash:npm test'];
      expect((bashResult?.output as { exitCode: number }).exitCode).toBe(0);
      expect((bashResult?.output as { stdout: string }).stdout).toContain('50 tests');
    });

    it('should handle large tool result caches', async () => {
      const session = createRealisticSession();

      // Add 100 tool results (simulating intensive analysis)
      for (let i = 0; i < 100; i++) {
        session.toolResultCache[`tool-${i}:input-${i}`] = {
          toolName: `tool-${i}`,
          input: `input-${i}`,
          output: `Output for tool ${i}: ${'x'.repeat(1000)}`, // ~1KB each
          timestamp: new Date().toISOString(),
          durationMs: i * 10,
        };
      }

      await saveSessionState(session, { baseDir: testBaseDir });

      // Check file size (should be manageable)
      const filePath = join(testBaseDir, `${session.id}.json`);
      const stats = statSync(filePath);
      expect(stats.size).toBeLessThan(500 * 1024); // Under 500KB

      // Should still load correctly
      const loaded = await loadSessionState(session.id, { baseDir: testBaseDir });
      expect(Object.keys(loaded?.toolResultCache ?? {}).length).toBe(103); // 3 original + 100 added
    });
  });

  describe('Findings Preservation', () => {
    it('should preserve all finding fields through checkpoint cycle', async () => {
      const session = createRealisticSession();

      await saveSessionState(session, { baseDir: testBaseDir });
      const loaded = await loadSessionState(session.id, { baseDir: testBaseDir });

      expect(loaded?.findings.length).toBe(2);

      const finding = loaded?.findings[0];
      expect(finding?.id).toBeDefined();
      expect(finding?.type).toBe('config_gap');
      expect(finding?.severity).toBe('high');
      expect(finding?.title).toBe('Missing file permissions configuration');
      expect(finding?.description).toContain('does not define file permissions');
      expect(finding?.location?.file).toBe('CLAUDE.md');
      expect(finding?.origin?.type).toBe('config');
      expect(finding?.recommendations.length).toBe(2);
      expect(finding?.recommendations[0]?.type).toBe('preventive');
    });
  });

  describe('Version Validation', () => {
    it('should include correct version in saved files', async () => {
      const session = createRealisticSession();
      await saveSessionState(session, { baseDir: testBaseDir });

      const filePath = join(testBaseDir, `${session.id}.json`);
      const content = await Bun.file(filePath).text();
      const parsed = JSON.parse(content);

      expect(parsed.version).toBe(SESSION_STATE_VERSION);
    });

    it('should handle future version gracefully', async () => {
      const session = createRealisticSession();
      const filePath = join(testBaseDir, `${session.id}.json`);

      // Create directory and write file with future version
      const { mkdir } = await import('node:fs/promises');
      await mkdir(testBaseDir, { recursive: true });
      await Bun.write(
        filePath,
        JSON.stringify({
          version: '99.0.0', // Future version
          sessionState: session,
        })
      );

      // Should still load (best-effort)
      const loaded = await loadSessionState(session.id, { baseDir: testBaseDir });
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(session.id);
    });
  });
});
