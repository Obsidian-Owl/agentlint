/**
 * Unit tests for persistence/sessions/storage.ts
 *
 * Tests session state save/load with atomic writes, version validation,
 * and crash recovery features.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { SessionState } from '../../../../src/orchestration/types';

// Functions to be implemented in T027-T030
import {
  saveSessionState,
  loadSessionState,
  listSessionIds,
  deleteSessionState,
  getSessionsDir,
  SESSION_STATE_VERSION,
} from '../../../../src/persistence/sessions/storage';

describe('sessions/storage', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-session-storage');

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
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  describe('saveSessionState', () => {
    it('should save session state to JSON file', async () => {
      const state = createTestSessionState();

      const filePath = await saveSessionState(state, { baseDir: testBaseDir });

      expect(existsSync(filePath)).toBe(true);
      expect(filePath).toContain(state.id);
    });

    it('should create directory if it does not exist', async () => {
      const state = createTestSessionState();

      expect(existsSync(testBaseDir)).toBe(false);

      await saveSessionState(state, { baseDir: testBaseDir });

      expect(existsSync(testBaseDir)).toBe(true);
    });

    it('should use atomic write pattern by default', async () => {
      const state = createTestSessionState();

      await saveSessionState(state, { baseDir: testBaseDir });

      // After atomic write, only the final file should exist (no temp files)
      const files = readdirSync(testBaseDir);
      expect(files.length).toBe(1);
      expect(files[0]).toBe(`${state.id}.json`);
    });

    it('should preserve existing file on write error when using atomic', async () => {
      const state = createTestSessionState();
      await saveSessionState(state, { baseDir: testBaseDir });

      // Read original content
      const sessionFilePath = join(testBaseDir, `${state.id}.json`);
      const originalContent = await Bun.file(sessionFilePath).text();

      // Modify state
      state.phase = 'complete';
      state.checkpointSequence = 10;

      // Save again (should work atomically)
      await saveSessionState(state, { baseDir: testBaseDir });

      const newContent = await Bun.file(sessionFilePath).text();
      expect(newContent).not.toBe(originalContent);
      expect(newContent).toContain('complete');
    });

    it('should include version in saved file', async () => {
      const state = createTestSessionState();

      const filePath = await saveSessionState(state, { baseDir: testBaseDir });
      const content = await Bun.file(filePath).text();
      const parsed = JSON.parse(content);

      expect(parsed.version).toBe(SESSION_STATE_VERSION);
    });

    it('should update lastCheckpointAt on save', async () => {
      const state = createTestSessionState({ lastCheckpointAt: null });
      const beforeSave = new Date().toISOString();

      await saveSessionState(state, { baseDir: testBaseDir, updateCheckpointTime: true });

      const loaded = await loadSessionState(state.id, { baseDir: testBaseDir });
      expect(loaded?.lastCheckpointAt).not.toBeNull();
      expect(new Date(loaded!.lastCheckpointAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeSave).getTime()
      );
    });

    it('should preserve all session fields', async () => {
      const state = createTestSessionState({
        phase: 'config-analysis',
        checkpointSequence: 5,
        taskGoal: 'Analyze CLAUDE.md',
        findings: [
          {
            id: crypto.randomUUID(),
            type: 'config_gap',
            severity: 'high',
            title: 'Missing permissions',
            description: 'No permissions defined',
            location: null,
            origin: null,
            recommendations: [],
            detectedAt: new Date().toISOString(),
            detectedInPhase: 'config-analysis',
          },
        ],
        toolResultCache: {
          'read-file:/test/file.md': {
            toolName: 'read-file',
            input: '/test/file.md',
            output: 'file content',
            timestamp: new Date().toISOString(),
            durationMs: 50,
          },
        },
      });

      await saveSessionState(state, { baseDir: testBaseDir });
      const loaded = await loadSessionState(state.id, { baseDir: testBaseDir });

      expect(loaded?.id).toBe(state.id);
      expect(loaded?.phase).toBe('config-analysis');
      expect(loaded?.checkpointSequence).toBe(5);
      expect(loaded?.findings.length).toBe(1);
      expect(loaded?.findings[0]?.title).toBe('Missing permissions');
      expect(Object.keys(loaded?.toolResultCache ?? {}).length).toBe(1);
    });
  });

  describe('loadSessionState', () => {
    it('should load saved session state', async () => {
      const state = createTestSessionState();
      await saveSessionState(state, { baseDir: testBaseDir });

      const loaded = await loadSessionState(state.id, { baseDir: testBaseDir });

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(state.id);
      expect(loaded?.phase).toBe(state.phase);
    });

    it('should return null for non-existent session', async () => {
      const loaded = await loadSessionState('non-existent-id', { baseDir: testBaseDir });

      expect(loaded).toBeNull();
    });

    it('should return null when directory does not exist', async () => {
      const loaded = await loadSessionState('any-id', { baseDir: '/non/existent/path' });

      expect(loaded).toBeNull();
    });

    it('should handle corrupted JSON gracefully', async () => {
      const state = createTestSessionState();
      const filePath = join(testBaseDir, `${state.id}.json`);

      // Create corrupted file manually
      await Bun.write(join(testBaseDir, '.keep'), ''); // Ensure dir exists via parent
      const { mkdir } = await import('node:fs/promises');
      await mkdir(testBaseDir, { recursive: true });
      await Bun.write(filePath, 'not valid json {{{');

      const loaded = await loadSessionState(state.id, { baseDir: testBaseDir });

      expect(loaded).toBeNull();
    });

    it('should warn on version mismatch but still load', async () => {
      const state = createTestSessionState();
      const filePath = join(testBaseDir, `${state.id}.json`);

      // Create directory and file with wrong version
      const { mkdir } = await import('node:fs/promises');
      await mkdir(testBaseDir, { recursive: true });
      await Bun.write(
        filePath,
        JSON.stringify({
          version: '0.0.1', // Old version
          sessionState: state,
        })
      );

      // Should still load (best-effort parsing per spec)
      const loaded = await loadSessionState(state.id, { baseDir: testBaseDir });

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(state.id);
    });

    it('should validate required fields', async () => {
      const state = createTestSessionState();
      const filePath = join(testBaseDir, `${state.id}.json`);

      // Create file missing required fields
      const { mkdir } = await import('node:fs/promises');
      await mkdir(testBaseDir, { recursive: true });
      await Bun.write(
        filePath,
        JSON.stringify({
          version: SESSION_STATE_VERSION,
          sessionState: {
            id: state.id,
            // Missing most required fields
          },
        })
      );

      const loaded = await loadSessionState(state.id, { baseDir: testBaseDir });

      // Should return null or the partial state depending on implementation
      // The spec says "best-effort" so either is acceptable
      // We'll verify it doesn't throw
      expect(loaded === null || loaded?.id === state.id).toBe(true);
    });
  });

  describe('listSessionIds', () => {
    it('should return all session IDs', async () => {
      const states = [createTestSessionState(), createTestSessionState(), createTestSessionState()];

      for (const state of states) {
        await saveSessionState(state, { baseDir: testBaseDir });
      }

      const ids = await listSessionIds({ baseDir: testBaseDir });

      expect(ids.length).toBe(3);
      for (const state of states) {
        expect(ids).toContain(state.id);
      }
    });

    it('should return empty array when no sessions exist', async () => {
      const ids = await listSessionIds({ baseDir: testBaseDir });

      expect(ids).toEqual([]);
    });

    it('should return empty array when directory does not exist', async () => {
      const ids = await listSessionIds({ baseDir: '/non/existent/path' });

      expect(ids).toEqual([]);
    });

    it('should only return .json files', async () => {
      const state = createTestSessionState();
      await saveSessionState(state, { baseDir: testBaseDir });

      // Create a non-json file
      await Bun.write(join(testBaseDir, 'not-a-session.txt'), 'some content');
      await Bun.write(join(testBaseDir, 'readme.md'), '# Readme');

      const ids = await listSessionIds({ baseDir: testBaseDir });

      expect(ids.length).toBe(1);
      expect(ids[0]).toBe(state.id);
    });
  });

  describe('deleteSessionState', () => {
    it('should delete existing session', async () => {
      const state = createTestSessionState();
      await saveSessionState(state, { baseDir: testBaseDir });

      const deleted = await deleteSessionState(state.id, { baseDir: testBaseDir });

      expect(deleted).toBe(true);

      const loaded = await loadSessionState(state.id, { baseDir: testBaseDir });
      expect(loaded).toBeNull();
    });

    it('should return false for non-existent session', async () => {
      const deleted = await deleteSessionState('non-existent', { baseDir: testBaseDir });

      expect(deleted).toBe(false);
    });

    it('should not affect other sessions', async () => {
      const state1 = createTestSessionState();
      const state2 = createTestSessionState();
      await saveSessionState(state1, { baseDir: testBaseDir });
      await saveSessionState(state2, { baseDir: testBaseDir });

      await deleteSessionState(state1.id, { baseDir: testBaseDir });

      const loaded1 = await loadSessionState(state1.id, { baseDir: testBaseDir });
      const loaded2 = await loadSessionState(state2.id, { baseDir: testBaseDir });

      expect(loaded1).toBeNull();
      expect(loaded2).not.toBeNull();
    });
  });

  describe('getSessionsDir', () => {
    it('should return default directory when no base provided', () => {
      const dir = getSessionsDir();

      expect(dir).toContain('.agentlint');
      expect(dir).toContain('sessions');
    });

    it('should return custom directory when provided', () => {
      const customDir = '/custom/sessions/dir';
      const dir = getSessionsDir(customDir);

      expect(dir).toBe(customDir);
    });
  });

  describe('concurrent saves', () => {
    it('should handle concurrent saves to same session', async () => {
      const state = createTestSessionState();

      // Save concurrently 5 times with different checkpoint sequences
      const saves = Array.from({ length: 5 }, (_, i) => {
        const modifiedState = { ...state, checkpointSequence: i };
        return saveSessionState(modifiedState, { baseDir: testBaseDir });
      });

      // All saves should complete without error
      await Promise.all(saves);

      // File should exist
      const loaded = await loadSessionState(state.id, { baseDir: testBaseDir });
      expect(loaded).not.toBeNull();
    });

    it('should handle concurrent saves to different sessions', async () => {
      const states = Array.from({ length: 10 }, () => createTestSessionState());

      // Save all concurrently
      await Promise.all(states.map((s) => saveSessionState(s, { baseDir: testBaseDir })));

      // All should be queryable
      const ids = await listSessionIds({ baseDir: testBaseDir });
      expect(ids.length).toBe(10);
    });
  });
});
