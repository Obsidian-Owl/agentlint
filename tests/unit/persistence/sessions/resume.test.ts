/**
 * Unit tests for session load/resume functionality
 *
 * Tests findIncomplete() for crash recovery and cleanup() for retention.
 * Related to US-003 and US-004.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { SessionState } from '../../../../src/orchestration/types';

// Functions to be implemented in T027-T030
import {
  saveSessionState,
  loadSessionState,
  findIncomplete,
  cleanup,
  listSessionIds,
} from '../../../../src/persistence/sessions/storage';

describe('sessions/resume', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-session-resume');

  // Helper to create a test session state
  function createTestSessionState(overrides: Partial<SessionState> = {}): SessionState {
    return {
      id: crypto.randomUUID(),
      phase: 'analysis',
      startedAt: new Date().toISOString(),
      lastCheckpointAt: null,
      findings: [],
      toolResultCache: {},
      checkpointSequence: 0,
      taskGoal: 'Test analysis task',
      projectContext: {
        name: 'test-project',
        path: '/test/project',
        hasClaudeMd: true,
        primaryLanguage: 'typescript',
        agentType: 'claude-code',
      },
      ...overrides,
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

  describe('findIncomplete', () => {
    it('should return empty array when no sessions exist', async () => {
      const incomplete = await findIncomplete({ baseDir: testBaseDir });

      expect(incomplete).toEqual([]);
    });

    it('should return empty array when directory does not exist', async () => {
      const incomplete = await findIncomplete({ baseDir: '/non/existent/path' });

      expect(incomplete).toEqual([]);
    });

    it('should find sessions in non-complete phase', async () => {
      // Create an incomplete session (analysis phase)
      const incomplete1 = createTestSessionState({ phase: 'analysis' });
      await saveSessionState(incomplete1, { baseDir: testBaseDir });

      // Create another incomplete session (config-analysis phase)
      const incomplete2 = createTestSessionState({ phase: 'config-analysis' });
      await saveSessionState(incomplete2, { baseDir: testBaseDir });

      // Create a complete session
      const complete = createTestSessionState({ phase: 'complete' });
      await saveSessionState(complete, { baseDir: testBaseDir });

      const results = await findIncomplete({ baseDir: testBaseDir });

      expect(results.length).toBe(2);
      const ids = results.map((r) => r.sessionId);
      expect(ids).toContain(incomplete1.id);
      expect(ids).toContain(incomplete2.id);
      expect(ids).not.toContain(complete.id);
    });

    it('should return full session info for each incomplete session', async () => {
      const state = createTestSessionState({
        phase: 'quality-analysis',
        checkpointSequence: 5,
        taskGoal: 'Analyze project quality',
        lastCheckpointAt: new Date().toISOString(),
      });
      await saveSessionState(state, { baseDir: testBaseDir });

      const results = await findIncomplete({ baseDir: testBaseDir });

      expect(results.length).toBe(1);
      expect(results[0]?.sessionId).toBe(state.id);
      expect(results[0]?.state.phase).toBe('quality-analysis');
      expect(results[0]?.state.checkpointSequence).toBe(5);
      expect(results[0]?.state.taskGoal).toBe('Analyze project quality');
      expect(results[0]?.filePath).toContain(state.id);
      expect(results[0]?.lastCheckpointAt).toBe(state.lastCheckpointAt);
    });

    it('should skip corrupted session files', async () => {
      // Create a valid incomplete session
      const valid = createTestSessionState({ phase: 'analysis' });
      await saveSessionState(valid, { baseDir: testBaseDir });

      // Create a corrupted session file manually
      const { mkdir } = await import('node:fs/promises');
      await mkdir(testBaseDir, { recursive: true });
      await Bun.write(join(testBaseDir, 'corrupted-session.json'), 'not valid json');

      const results = await findIncomplete({ baseDir: testBaseDir });

      expect(results.length).toBe(1);
      expect(results[0]?.sessionId).toBe(valid.id);
    });

    it('should consider error phase as incomplete', async () => {
      const errorSession = createTestSessionState({ phase: 'error' });
      await saveSessionState(errorSession, { baseDir: testBaseDir });

      const results = await findIncomplete({ baseDir: testBaseDir });

      // Error is not complete, so should be found
      expect(results.length).toBe(1);
    });

    it('should order by lastCheckpointAt (most recent first)', async () => {
      const older = createTestSessionState({
        phase: 'analysis',
        lastCheckpointAt: '2026-01-01T10:00:00.000Z',
      });
      const newer = createTestSessionState({
        phase: 'analysis',
        lastCheckpointAt: '2026-01-01T12:00:00.000Z',
      });
      const oldest = createTestSessionState({
        phase: 'analysis',
        lastCheckpointAt: '2026-01-01T08:00:00.000Z',
      });

      await saveSessionState(older, { baseDir: testBaseDir });
      await saveSessionState(newer, { baseDir: testBaseDir });
      await saveSessionState(oldest, { baseDir: testBaseDir });

      const results = await findIncomplete({ baseDir: testBaseDir });

      expect(results.length).toBe(3);
      expect(results[0]?.sessionId).toBe(newer.id);
      expect(results[1]?.sessionId).toBe(older.id);
      expect(results[2]?.sessionId).toBe(oldest.id);
    });
  });

  describe('cleanup', () => {
    it('should delete sessions older than retention period', async () => {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;

      // Create old completed session (40 days ago)
      const oldComplete = createTestSessionState({
        phase: 'complete',
        startedAt: new Date(now - 40 * msPerDay).toISOString(),
        lastCheckpointAt: new Date(now - 40 * msPerDay).toISOString(),
      });
      await saveSessionState(oldComplete, { baseDir: testBaseDir });

      // Create recent completed session (5 days ago)
      const recentComplete = createTestSessionState({
        phase: 'complete',
        startedAt: new Date(now - 5 * msPerDay).toISOString(),
        lastCheckpointAt: new Date(now - 5 * msPerDay).toISOString(),
      });
      await saveSessionState(recentComplete, { baseDir: testBaseDir });

      // Cleanup with 30 day retention
      const deleted = await cleanup({ baseDir: testBaseDir, retentionDays: 30 });

      expect(deleted).toBe(1);

      const remaining = await listSessionIds({ baseDir: testBaseDir });
      expect(remaining.length).toBe(1);
      expect(remaining).toContain(recentComplete.id);
      expect(remaining).not.toContain(oldComplete.id);
    });

    it('should NOT delete incomplete sessions regardless of age', async () => {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;

      // Create old incomplete session (100 days ago)
      const oldIncomplete = createTestSessionState({
        phase: 'analysis', // Not complete
        startedAt: new Date(now - 100 * msPerDay).toISOString(),
        lastCheckpointAt: new Date(now - 100 * msPerDay).toISOString(),
      });
      await saveSessionState(oldIncomplete, { baseDir: testBaseDir });

      // Cleanup with 30 day retention
      const deleted = await cleanup({ baseDir: testBaseDir, retentionDays: 30 });

      expect(deleted).toBe(0);

      const remaining = await listSessionIds({ baseDir: testBaseDir });
      expect(remaining).toContain(oldIncomplete.id);
    });

    it('should use default 30 day retention when not specified', async () => {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;

      // Create session 35 days ago (older than default 30)
      const old = createTestSessionState({
        phase: 'complete',
        startedAt: new Date(now - 35 * msPerDay).toISOString(),
        lastCheckpointAt: new Date(now - 35 * msPerDay).toISOString(),
      });
      await saveSessionState(old, { baseDir: testBaseDir });

      // Create session 25 days ago (within default 30)
      const recent = createTestSessionState({
        phase: 'complete',
        startedAt: new Date(now - 25 * msPerDay).toISOString(),
        lastCheckpointAt: new Date(now - 25 * msPerDay).toISOString(),
      });
      await saveSessionState(recent, { baseDir: testBaseDir });

      const deleted = await cleanup({ baseDir: testBaseDir });

      expect(deleted).toBe(1);

      const remaining = await listSessionIds({ baseDir: testBaseDir });
      expect(remaining).toContain(recent.id);
      expect(remaining).not.toContain(old.id);
    });

    it('should return 0 when no sessions to clean', async () => {
      const deleted = await cleanup({ baseDir: testBaseDir });

      expect(deleted).toBe(0);
    });

    it('should return 0 when directory does not exist', async () => {
      const deleted = await cleanup({ baseDir: '/non/existent/path' });

      expect(deleted).toBe(0);
    });

    it('should skip corrupted files', async () => {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;

      // Create valid old complete session
      const old = createTestSessionState({
        phase: 'complete',
        startedAt: new Date(now - 40 * msPerDay).toISOString(),
        lastCheckpointAt: new Date(now - 40 * msPerDay).toISOString(),
      });
      await saveSessionState(old, { baseDir: testBaseDir });

      // Create corrupted file
      await Bun.write(join(testBaseDir, 'corrupted.json'), 'not json');

      const deleted = await cleanup({ baseDir: testBaseDir, retentionDays: 30 });

      expect(deleted).toBe(1); // Only the valid old one

      // Corrupted file should still exist (we skip, don't delete)
      const files = await Bun.file(join(testBaseDir, 'corrupted.json')).exists();
      expect(files).toBe(true);
    });

    it('should handle custom retention periods', async () => {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;

      // Create sessions at various ages (clearly inside or outside 7-day retention)
      // 3, 6 days = within retention (kept)
      // 10, 15, 20 days = outside retention (deleted)
      const ages = [3, 6, 10, 15, 20];
      const sessions: SessionState[] = [];

      for (const daysAgo of ages) {
        const s = createTestSessionState({
          phase: 'complete',
          startedAt: new Date(now - daysAgo * msPerDay).toISOString(),
          lastCheckpointAt: new Date(now - daysAgo * msPerDay).toISOString(),
        });
        await saveSessionState(s, { baseDir: testBaseDir });
        sessions.push(s);
      }

      // Cleanup with 7 day retention - should delete 10, 15, 20 day old
      const deleted = await cleanup({ baseDir: testBaseDir, retentionDays: 7 });

      expect(deleted).toBe(3);

      const remaining = await listSessionIds({ baseDir: testBaseDir });
      expect(remaining.length).toBe(2);
    });
  });

  describe('session resume flow', () => {
    it('should support full crash recovery flow', async () => {
      // 1. Create initial session state
      const state = createTestSessionState({
        phase: 'config-analysis',
        taskGoal: 'Analyze CLAUDE.md for security issues',
        checkpointSequence: 3,
        findings: [
          {
            id: crypto.randomUUID(),
            type: 'config_gap',
            severity: 'high',
            title: 'Missing permissions',
            description: 'No permissions defined',
            location: { file: 'CLAUDE.md', line: 10 },
            origin: { type: 'config', reference: 'CLAUDE.md', description: 'Config analysis' },
            recommendations: [
              {
                type: 'preventive',
                action: 'Add permissions section',
                rationale: 'Explicit is better',
                priority: 'high',
              },
            ],
            detectedAt: new Date().toISOString(),
            detectedInPhase: 'config-analysis',
          },
        ],
        toolResultCache: {
          'read-file:CLAUDE.md': {
            toolName: 'read-file',
            input: 'CLAUDE.md',
            output: '# Claude Configuration\n...',
            timestamp: new Date().toISOString(),
            durationMs: 25,
          },
        },
      });

      // 2. Save state (simulating checkpoint)
      await saveSessionState(state, { baseDir: testBaseDir, updateCheckpointTime: true });

      // 3. Simulate crash - state object is "lost"
      // (In reality the process would crash here)

      // 4. Find incomplete sessions for recovery
      const incomplete = await findIncomplete({ baseDir: testBaseDir });
      expect(incomplete.length).toBe(1);

      // 5. Load the recovered session
      const recovered = await loadSessionState(incomplete[0]!.sessionId, { baseDir: testBaseDir });

      // 6. Verify all state is preserved
      expect(recovered).not.toBeNull();
      expect(recovered?.id).toBe(state.id);
      expect(recovered?.phase).toBe('config-analysis');
      expect(recovered?.taskGoal).toBe('Analyze CLAUDE.md for security issues');
      expect(recovered?.checkpointSequence).toBe(3);
      expect(recovered?.findings.length).toBe(1);
      expect(recovered?.findings[0]?.title).toBe('Missing permissions');
      expect(Object.keys(recovered?.toolResultCache ?? {}).length).toBe(1);
      expect(recovered?.toolResultCache['read-file:CLAUDE.md']?.output).toContain('# Claude');
    });

    it('should allow continuing analysis after resume', async () => {
      // Initial state
      const initial = createTestSessionState({
        phase: 'config-analysis',
        checkpointSequence: 2,
      });
      await saveSessionState(initial, { baseDir: testBaseDir });

      // Resume and continue
      const recovered = await loadSessionState(initial.id, { baseDir: testBaseDir });
      expect(recovered).not.toBeNull();

      // Simulate continuing analysis
      const continued: SessionState = {
        ...recovered!,
        phase: 'quality-analysis',
        checkpointSequence: recovered!.checkpointSequence + 1,
        findings: [
          ...recovered!.findings,
          {
            id: crypto.randomUUID(),
            type: 'quality_issue',
            severity: 'medium',
            title: 'New finding after resume',
            description: 'Found during continued analysis',
            location: null,
            origin: null,
            recommendations: [],
            detectedAt: new Date().toISOString(),
            detectedInPhase: 'quality-analysis',
          },
        ],
      };

      // Save new checkpoint
      await saveSessionState(continued, { baseDir: testBaseDir });

      // Verify the update persisted
      const final = await loadSessionState(initial.id, { baseDir: testBaseDir });
      expect(final?.phase).toBe('quality-analysis');
      expect(final?.checkpointSequence).toBe(3);
      expect(final?.findings.length).toBe(1);
    });
  });
});
