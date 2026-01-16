/**
 * EP02 Orchestration Core - Session State Tests
 *
 * Tests for T041, T042:
 * - T041: SessionState saves to JSON file
 * - T042: loadState() restores SessionState from file
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { SessionState } from '../../../src/orchestration/types';
import {
  saveState,
  loadState,
  getSessionFilePath,
  getSessionsDir,
  listSessions,
  deleteSession,
  buildStateSummary,
} from '../../../src/orchestration/session-state';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestSessionState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    id: 'test-session-123',
    phase: 'discovery',
    startedAt: '2026-01-16T10:00:00.000Z',
    lastCheckpointAt: '2026-01-16T10:05:00.000Z',
    findings: [
      {
        id: 'finding-1',
        type: 'config_gap',
        severity: 'medium',
        title: 'Missing CLAUDE.md section',
        description: 'The CLAUDE.md file is missing a testing section',
        location: { file: '/project/CLAUDE.md', line: 10 },
        origin: null,
        recommendations: [
          {
            type: 'preventive',
            action: 'Add testing section to CLAUDE.md',
            rationale: 'Helps agents understand testing patterns',
            priority: 'medium',
          },
        ],
        detectedAt: '2026-01-16T10:03:00.000Z',
        detectedInPhase: 'discovery',
      },
    ],
    toolResultCache: {
      'read_file:/project/CLAUDE.md': {
        toolName: 'read_file',
        input: { path: '/project/CLAUDE.md' },
        output: '# CLAUDE.md content',
        timestamp: '2026-01-16T10:02:00.000Z',
        durationMs: 15,
      },
    },
    checkpointSequence: 3,
    taskGoal: 'Analyze project configuration',
    projectContext: {
      name: 'test-project',
      path: '/project',
      hasClaudeMd: true,
      primaryLanguage: 'typescript',
      agentType: 'claude-code',
    },
    ...overrides,
  };
}

// Use temp directory for tests
let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `session-state-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  if (testDir && existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

// =============================================================================
// T041: SessionState saves to JSON file
// =============================================================================

describe('saveState() (T041)', () => {
  test('saves session state to JSON file', async () => {
    const state = createTestSessionState();
    const filePath = await saveState(state, testDir);

    expect(existsSync(filePath)).toBe(true);
  });

  test('creates sessions directory if it does not exist', async () => {
    const nestedDir = join(testDir, 'nested', 'sessions');
    const state = createTestSessionState();

    const filePath = await saveState(state, nestedDir);

    expect(existsSync(filePath)).toBe(true);
    expect(filePath.startsWith(nestedDir)).toBe(true);
  });

  test('uses session ID as filename', async () => {
    const state = createTestSessionState({ id: 'my-unique-session' });
    const filePath = await saveState(state, testDir);

    expect(filePath).toContain('my-unique-session.json');
  });

  test('includes version in saved file', async () => {
    const state = createTestSessionState();
    await saveState(state, testDir);

    const loaded = await loadState(state.id, testDir);
    // File format includes version
    expect(loaded).toBeDefined();
  });

  test('overwrites existing file for same session ID', async () => {
    const state1 = createTestSessionState({ phase: 'discovery' });
    const state2 = createTestSessionState({ phase: 'analysis' });

    await saveState(state1, testDir);
    await saveState(state2, testDir);

    const loaded = await loadState(state1.id, testDir);
    expect(loaded?.phase).toBe('analysis');
  });

  test('preserves all session state fields', async () => {
    const state = createTestSessionState();
    await saveState(state, testDir);

    const loaded = await loadState(state.id, testDir);

    expect(loaded).toBeDefined();
    expect(loaded!.id).toBe(state.id);
    expect(loaded!.phase).toBe(state.phase);
    expect(loaded!.startedAt).toBe(state.startedAt);
    expect(loaded!.lastCheckpointAt).toBe(state.lastCheckpointAt);
    expect(loaded!.checkpointSequence).toBe(state.checkpointSequence);
    expect(loaded!.taskGoal).toBe(state.taskGoal);
    expect(loaded!.findings).toHaveLength(1);
    expect(loaded!.findings[0]!.id).toBe('finding-1');
    expect(loaded!.projectContext.name).toBe('test-project');
  });

  test('handles special characters in task goal', async () => {
    const state = createTestSessionState({
      taskGoal: 'Analyze "special" chars: <>&\'',
    });

    await saveState(state, testDir);
    const loaded = await loadState(state.id, testDir);

    expect(loaded?.taskGoal).toBe('Analyze "special" chars: <>&\'');
  });
});

// =============================================================================
// T042: loadState() restores SessionState from file
// =============================================================================

describe('loadState() (T042)', () => {
  test('loads session state from JSON file', async () => {
    const state = createTestSessionState();
    await saveState(state, testDir);

    const loaded = await loadState(state.id, testDir);

    expect(loaded).toBeDefined();
    expect(loaded!.id).toBe(state.id);
  });

  test('returns null for non-existent session', async () => {
    const loaded = await loadState('non-existent-session', testDir);
    expect(loaded).toBeNull();
  });

  test('restores findings array', async () => {
    const state = createTestSessionState();
    await saveState(state, testDir);

    const loaded = await loadState(state.id, testDir);

    expect(loaded?.findings).toHaveLength(1);
    const finding = loaded?.findings[0];
    expect(finding?.id).toBe('finding-1');
    expect(finding?.type).toBe('config_gap');
    expect(finding?.severity).toBe('medium');
    expect(finding?.recommendations).toHaveLength(1);
  });

  test('restores toolResultCache', async () => {
    const state = createTestSessionState();
    await saveState(state, testDir);

    const loaded = await loadState(state.id, testDir);

    expect(loaded?.toolResultCache).toBeDefined();
    const cache = loaded?.toolResultCache['read_file:/project/CLAUDE.md'];
    expect(cache?.toolName).toBe('read_file');
    expect(cache?.output).toBe('# CLAUDE.md content');
    expect(cache?.durationMs).toBe(15);
  });

  test('restores projectContext', async () => {
    const state = createTestSessionState();
    await saveState(state, testDir);

    const loaded = await loadState(state.id, testDir);

    expect(loaded?.projectContext).toBeDefined();
    expect(loaded?.projectContext.name).toBe('test-project');
    expect(loaded?.projectContext.path).toBe('/project');
    expect(loaded?.projectContext.hasClaudeMd).toBe(true);
    expect(loaded?.projectContext.primaryLanguage).toBe('typescript');
  });

  test('handles empty findings array', async () => {
    const state = createTestSessionState({ findings: [] });
    await saveState(state, testDir);

    const loaded = await loadState(state.id, testDir);
    expect(loaded?.findings).toEqual([]);
  });

  test('handles empty toolResultCache', async () => {
    const state = createTestSessionState({ toolResultCache: {} });
    await saveState(state, testDir);

    const loaded = await loadState(state.id, testDir);
    expect(loaded?.toolResultCache).toEqual({});
  });

  test('throws for corrupted JSON', async () => {
    const state = createTestSessionState();
    const filePath = await saveState(state, testDir);

    // Corrupt the file
    const fs = await import('node:fs/promises');
    await fs.writeFile(filePath, 'not valid json {{{');

    expect(loadState(state.id, testDir)).rejects.toThrow();
  });
});

// =============================================================================
// Helper Functions
// =============================================================================

describe('getSessionFilePath()', () => {
  test('returns correct file path', () => {
    const path = getSessionFilePath('session-abc', testDir);
    expect(path).toBe(join(testDir, 'session-abc.json'));
  });

  test('handles UUIDs', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const path = getSessionFilePath(uuid, testDir);
    expect(path).toBe(join(testDir, `${uuid}.json`));
  });
});

describe('getSessionsDir()', () => {
  test('returns default sessions directory', () => {
    const dir = getSessionsDir();
    expect(dir).toContain('.agentlint');
    expect(dir).toContain('sessions');
  });

  test('accepts custom base directory', () => {
    const dir = getSessionsDir('/custom/base');
    expect(dir).toBe('/custom/base');
  });
});

describe('listSessions()', () => {
  test('returns empty array when no sessions', async () => {
    const sessions = await listSessions(testDir);
    expect(sessions).toEqual([]);
  });

  test('lists all saved sessions', async () => {
    await saveState(createTestSessionState({ id: 'session-1' }), testDir);
    await saveState(createTestSessionState({ id: 'session-2' }), testDir);
    await saveState(createTestSessionState({ id: 'session-3' }), testDir);

    const sessions = await listSessions(testDir);

    expect(sessions).toHaveLength(3);
    expect(sessions).toContain('session-1');
    expect(sessions).toContain('session-2');
    expect(sessions).toContain('session-3');
  });

  test('ignores non-JSON files', async () => {
    await saveState(createTestSessionState({ id: 'valid-session' }), testDir);

    // Create a non-JSON file
    const fs = await import('node:fs/promises');
    await fs.writeFile(join(testDir, 'readme.txt'), 'not a session');

    const sessions = await listSessions(testDir);
    expect(sessions).toEqual(['valid-session']);
  });
});

describe('deleteSession()', () => {
  test('deletes existing session file', async () => {
    const state = createTestSessionState();
    const filePath = await saveState(state, testDir);

    expect(existsSync(filePath)).toBe(true);

    const deleted = await deleteSession(state.id, testDir);

    expect(deleted).toBe(true);
    expect(existsSync(filePath)).toBe(false);
  });

  test('returns false for non-existent session', async () => {
    const deleted = await deleteSession('non-existent', testDir);
    expect(deleted).toBe(false);
  });
});

// =============================================================================
// buildStateSummary()
// =============================================================================

describe('buildStateSummary()', () => {
  test('builds summary for resume injection', () => {
    const state = createTestSessionState({
      phase: 'analysis',
      checkpointSequence: 5,
      findings: [
        {
          id: 'f1',
          type: 'config_gap',
          severity: 'high',
          title: 'Missing section',
          description: 'Test',
          location: null,
          origin: null,
          recommendations: [],
          detectedAt: '2026-01-16T10:00:00.000Z',
          detectedInPhase: 'discovery',
        },
        {
          id: 'f2',
          type: 'config_antipattern',
          severity: 'medium',
          title: 'Anti-pattern detected',
          description: 'Test',
          location: null,
          origin: null,
          recommendations: [],
          detectedAt: '2026-01-16T10:01:00.000Z',
          detectedInPhase: 'analysis',
        },
      ],
    });

    const summary = buildStateSummary(state);

    expect(summary.taskGoal).toBe('Analyze project configuration');
    expect(summary.currentPhase).toBe('analysis');
    expect(summary.findingsCount).toBe(2);
    expect(summary.checkpointSequence).toBe(5);
    expect(summary.elapsedTime).toBeDefined();
  });

  test('formats summary for system prompt injection', () => {
    const state = createTestSessionState();
    const summary = buildStateSummary(state);

    expect(summary.formattedSummary).toContain('Task Goal:');
    expect(summary.formattedSummary).toContain('Current Phase:');
    expect(summary.formattedSummary).toContain('Findings:');
    expect(summary.formattedSummary).toContain('Checkpoint:');
  });

  test('includes finding summaries', () => {
    const state = createTestSessionState();
    const summary = buildStateSummary(state);

    expect(summary.findingSummaries).toHaveLength(1);
    expect(summary.findingSummaries[0]!.id).toBe('finding-1');
    expect(summary.findingSummaries[0]!.title).toBe('Missing CLAUDE.md section');
    expect(summary.findingSummaries[0]!.severity).toBe('medium');
  });

  test('handles session with no findings', () => {
    const state = createTestSessionState({ findings: [] });
    const summary = buildStateSummary(state);

    expect(summary.findingsCount).toBe(0);
    expect(summary.findingSummaries).toEqual([]);
    expect(summary.formattedSummary).toContain('Findings: 0');
  });
});
