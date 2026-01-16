/**
 * EP02 Orchestration Core - Cognitive Workspace Tests
 *
 * Tests for T049:
 * - T049: CognitiveWorkspace builds hierarchical context
 */

import { describe, test, expect } from 'bun:test';
import type { SessionState, BaselineAwareness } from '../../../src/orchestration/types';
import {
  buildCognitiveWorkspace,
  formatWorkspaceForPrompt,
  createProgressSummary,
  compressFindingsToSummary,
} from '../../../src/orchestration/cognitive-workspace';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestSessionState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    id: 'test-session-123',
    phase: 'analysis',
    startedAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    lastCheckpointAt: null,
    findings: [
      {
        id: 'finding-1',
        type: 'config_gap',
        severity: 'high',
        title: 'Missing CLAUDE.md sections',
        description: 'Several recommended sections are missing',
        location: { file: '/project/CLAUDE.md', line: 1 },
        origin: null,
        recommendations: [],
        detectedAt: '2026-01-16T10:03:00.000Z',
        detectedInPhase: 'discovery',
      },
      {
        id: 'finding-2',
        type: 'config_antipattern',
        severity: 'medium',
        title: 'Overly broad permissions',
        description: 'Permissions section is too permissive',
        location: { file: '/project/CLAUDE.md', line: 50 },
        origin: null,
        recommendations: [],
        detectedAt: '2026-01-16T10:04:00.000Z',
        detectedInPhase: 'analysis',
      },
    ],
    toolResultCache: {
      read_file_1: { toolName: 'read_file', input: {}, output: '', timestamp: '', durationMs: 10 },
      read_file_2: { toolName: 'read_file', input: {}, output: '', timestamp: '', durationMs: 15 },
      grep_1: { toolName: 'grep', input: {}, output: '', timestamp: '', durationMs: 20 },
    },
    checkpointSequence: 5,
    taskGoal: 'Analyze CLAUDE.md for configuration quality',
    projectContext: {
      name: 'my-project',
      path: '/home/user/my-project',
      hasClaudeMd: true,
      primaryLanguage: 'typescript',
      agentType: 'claude-code',
    },
    ...overrides,
  };
}

// =============================================================================
// T049: CognitiveWorkspace builds hierarchical context
// =============================================================================

describe('buildCognitiveWorkspace() (T049)', () => {
  test('builds workspace from session state', () => {
    const state = createTestSessionState();
    const workspace = buildCognitiveWorkspace(state);

    expect(workspace.taskGoal).toBe('Analyze CLAUDE.md for configuration quality');
    expect(workspace.projectContext.name).toBe('my-project');
  });

  test('includes progress summary', () => {
    const state = createTestSessionState();
    const workspace = buildCognitiveWorkspace(state);

    expect(workspace.progress.currentPhase).toBe('analysis');
    expect(workspace.progress.findingsCount).toBe(2);
    expect(workspace.progress.toolsInvoked).toBe(3);
    expect(workspace.progress.elapsedMs).toBeGreaterThan(0);
  });

  test('compresses findings to summaries', () => {
    const state = createTestSessionState();
    const workspace = buildCognitiveWorkspace(state);

    expect(workspace.findings).toHaveLength(2);
    expect(workspace.findings[0]?.id).toBe('finding-1');
    expect(workspace.findings[0]?.title).toBe('Missing CLAUDE.md sections');
    expect(workspace.findings[0]?.severity).toBe('high');
    expect(workspace.findings[0]?.type).toBe('config_gap');
  });

  test('handles empty findings', () => {
    const state = createTestSessionState({ findings: [] });
    const workspace = buildCognitiveWorkspace(state);

    expect(workspace.findings).toEqual([]);
    expect(workspace.progress.findingsCount).toBe(0);
  });

  test('handles empty tool cache', () => {
    const state = createTestSessionState({ toolResultCache: {} });
    const workspace = buildCognitiveWorkspace(state);

    expect(workspace.progress.toolsInvoked).toBe(0);
  });

  test('includes baseline awareness when provided', () => {
    const baseline: BaselineAwareness = {
      lastAnalysisDate: '2026-01-15T10:00:00.000Z',
      previousScore: 75,
      deltaFindings: -2,
      improvementAreas: ['testing', 'documentation'],
    };

    const state = createTestSessionState();
    const workspace = buildCognitiveWorkspace(state, baseline);

    expect(workspace.baselineAwareness).toBeDefined();
    expect(workspace.baselineAwareness?.previousScore).toBe(75);
    expect(workspace.baselineAwareness?.deltaFindings).toBe(-2);
  });

  test('baseline awareness is null when not provided', () => {
    const state = createTestSessionState();
    const workspace = buildCognitiveWorkspace(state);

    expect(workspace.baselineAwareness).toBeNull();
  });

  test('includes global learnings when provided', () => {
    const state = createTestSessionState();
    const learnings = [
      'TypeScript projects benefit from strict tsconfig',
      'CLAUDE.md should include testing patterns',
    ];

    const workspace = buildCognitiveWorkspace(state, null, learnings);

    expect(workspace.globalLearnings).toHaveLength(2);
    expect(workspace.globalLearnings).toContain('TypeScript projects benefit from strict tsconfig');
  });

  test('global learnings defaults to empty array', () => {
    const state = createTestSessionState();
    const workspace = buildCognitiveWorkspace(state);

    expect(workspace.globalLearnings).toEqual([]);
  });
});

// =============================================================================
// formatWorkspaceForPrompt()
// =============================================================================

describe('formatWorkspaceForPrompt()', () => {
  test('formats workspace as structured text', () => {
    const state = createTestSessionState();
    const workspace = buildCognitiveWorkspace(state);
    const formatted = formatWorkspaceForPrompt(workspace);

    expect(formatted).toContain('[Cognitive Workspace]');
    expect(formatted).toContain('Task Goal:');
    expect(formatted).toContain('Analyze CLAUDE.md for configuration quality');
  });

  test('includes project context section', () => {
    const state = createTestSessionState();
    const workspace = buildCognitiveWorkspace(state);
    const formatted = formatWorkspaceForPrompt(workspace);

    expect(formatted).toContain('Project:');
    expect(formatted).toContain('my-project');
    expect(formatted).toContain('typescript');
  });

  test('includes progress section', () => {
    const state = createTestSessionState();
    const workspace = buildCognitiveWorkspace(state);
    const formatted = formatWorkspaceForPrompt(workspace);

    expect(formatted).toContain('Progress:');
    expect(formatted).toContain('Phase: analysis');
    expect(formatted).toContain('Tools: 3');
    expect(formatted).toContain('Findings: 2');
  });

  test('includes findings summary section', () => {
    const state = createTestSessionState();
    const workspace = buildCognitiveWorkspace(state);
    const formatted = formatWorkspaceForPrompt(workspace);

    expect(formatted).toContain('Current Findings:');
    expect(formatted).toContain('[HIGH]');
    expect(formatted).toContain('Missing CLAUDE.md sections');
  });

  test('includes baseline section when available', () => {
    const baseline: BaselineAwareness = {
      lastAnalysisDate: '2026-01-15T10:00:00.000Z',
      previousScore: 75,
      deltaFindings: -2,
      improvementAreas: ['testing'],
    };

    const state = createTestSessionState();
    const workspace = buildCognitiveWorkspace(state, baseline);
    const formatted = formatWorkspaceForPrompt(workspace);

    expect(formatted).toContain('Baseline:');
    expect(formatted).toContain('Previous Score: 75');
    expect(formatted).toContain('Delta: -2 findings');
  });

  test('omits baseline section when not available', () => {
    const state = createTestSessionState();
    const workspace = buildCognitiveWorkspace(state);
    const formatted = formatWorkspaceForPrompt(workspace);

    expect(formatted).not.toContain('Baseline:');
  });

  test('includes global learnings when available', () => {
    const state = createTestSessionState();
    const learnings = ['Learning 1', 'Learning 2'];
    const workspace = buildCognitiveWorkspace(state, null, learnings);
    const formatted = formatWorkspaceForPrompt(workspace);

    expect(formatted).toContain('Global Learnings:');
    expect(formatted).toContain('Learning 1');
  });

  test('ends with workspace close marker', () => {
    const state = createTestSessionState();
    const workspace = buildCognitiveWorkspace(state);
    const formatted = formatWorkspaceForPrompt(workspace);

    expect(formatted).toContain('[End Cognitive Workspace]');
  });
});

// =============================================================================
// Helper Functions
// =============================================================================

describe('createProgressSummary()', () => {
  test('creates progress summary from state', () => {
    const state = createTestSessionState();
    const progress = createProgressSummary(state);

    expect(progress.currentPhase).toBe('analysis');
    expect(progress.findingsCount).toBe(2);
    expect(progress.toolsInvoked).toBe(3);
    expect(progress.elapsedMs).toBeGreaterThan(0);
  });

  test('calculates elapsed time from startedAt', () => {
    const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString();
    const state = createTestSessionState({ startedAt: fiveMinutesAgo });
    const progress = createProgressSummary(state);

    // Should be approximately 5 minutes (300000ms) with some tolerance
    expect(progress.elapsedMs).toBeGreaterThan(290000);
    expect(progress.elapsedMs).toBeLessThan(310000);
  });
});

describe('compressFindingsToSummary()', () => {
  test('extracts essential fields from findings', () => {
    const state = createTestSessionState();
    const summaries = compressFindingsToSummary(state.findings);

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toEqual({
      id: 'finding-1',
      type: 'config_gap',
      severity: 'high',
      title: 'Missing CLAUDE.md sections',
    });
  });

  test('returns empty array for no findings', () => {
    const summaries = compressFindingsToSummary([]);
    expect(summaries).toEqual([]);
  });

  test('omits description and recommendations', () => {
    const state = createTestSessionState();
    const summaries = compressFindingsToSummary(state.findings);

    // FindingSummary should not have description or recommendations
    const summary = summaries[0]!;
    expect(Object.keys(summary)).toEqual(['id', 'type', 'severity', 'title']);
  });
});
