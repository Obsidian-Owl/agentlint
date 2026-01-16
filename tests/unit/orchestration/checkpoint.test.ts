/**
 * EP02 Orchestration Core - Checkpoint Tests
 *
 * Tests for T035, T036, T037:
 * - T035: CheckpointHandler emits events on triggers
 * - T036: Interval-based checkpoint fires after configured time
 * - T037: CheckpointEvent contains full SessionState snapshot
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import type { CheckpointEvent, SessionState } from '../../../src/orchestration/types';
import {
  createCheckpointHandler,
  type ICheckpointHandler,
} from '../../../src/orchestration/checkpoint';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestSessionState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    id: 'test-session-123',
    phase: 'discovery',
    startedAt: '2026-01-16T10:00:00.000Z',
    lastCheckpointAt: null,
    findings: [],
    toolResultCache: {},
    checkpointSequence: 0,
    taskGoal: 'Analyze project for configuration issues',
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

// =============================================================================
// T035: CheckpointHandler emits events on triggers
// =============================================================================

describe('CheckpointHandler', () => {
  describe('trigger-based checkpoints (T035)', () => {
    test('emits checkpoint event on tool_complete trigger', () => {
      const events: CheckpointEvent[] = [];
      const handler = createCheckpointHandler({
        onCheckpoint: (event) => events.push(event),
      });
      const state = createTestSessionState();

      handler.emit('tool_complete', state, { toolName: 'read_file' });

      expect(events).toHaveLength(1);
      const event = events[0]!;
      expect(event.trigger).toBe('tool_complete');
      expect(event.metadata?.toolName).toBe('read_file');
    });

    test('emits checkpoint event on finding trigger', () => {
      const events: CheckpointEvent[] = [];
      const handler = createCheckpointHandler({
        onCheckpoint: (event) => events.push(event),
      });
      const state = createTestSessionState({
        findings: [
          {
            id: 'finding-1',
            type: 'config_gap',
            severity: 'medium',
            title: 'Missing CLAUDE.md',
            description: 'No CLAUDE.md file found',
            location: null,
            origin: null,
            recommendations: [],
            detectedAt: '2026-01-16T10:05:00.000Z',
            detectedInPhase: 'discovery',
          },
        ],
      });

      handler.emit('finding', state, { findingId: 'finding-1' });

      expect(events).toHaveLength(1);
      const event = events[0]!;
      expect(event.trigger).toBe('finding');
      expect(event.metadata?.findingId).toBe('finding-1');
    });

    test('emits checkpoint event on phase_change trigger', () => {
      const events: CheckpointEvent[] = [];
      const handler = createCheckpointHandler({
        onCheckpoint: (event) => events.push(event),
      });
      const state = createTestSessionState({ phase: 'analysis' });

      handler.emit('phase_change', state, {
        previousPhase: 'discovery',
        newPhase: 'analysis',
      });

      expect(events).toHaveLength(1);
      const event = events[0]!;
      expect(event.trigger).toBe('phase_change');
      expect(event.metadata?.previousPhase).toBe('discovery');
      expect(event.metadata?.newPhase).toBe('analysis');
    });

    test('emits checkpoint event on pre_compact trigger', () => {
      const events: CheckpointEvent[] = [];
      const handler = createCheckpointHandler({
        onCheckpoint: (event) => events.push(event),
      });
      const state = createTestSessionState();

      handler.emit('pre_compact', state, {
        compactionTrigger: 'auto',
        preCompactTokens: 180000,
      });

      expect(events).toHaveLength(1);
      const event = events[0]!;
      expect(event.trigger).toBe('pre_compact');
      expect(event.metadata?.compactionTrigger).toBe('auto');
      expect(event.metadata?.preCompactTokens).toBe(180000);
    });

    test('emits checkpoint event on session_end trigger', () => {
      const events: CheckpointEvent[] = [];
      const handler = createCheckpointHandler({
        onCheckpoint: (event) => events.push(event),
      });
      const state = createTestSessionState();

      handler.emit('session_end', state);

      expect(events).toHaveLength(1);
      expect(events[0]!.trigger).toBe('session_end');
    });

    test('emits checkpoint event on user_request trigger', () => {
      const events: CheckpointEvent[] = [];
      const handler = createCheckpointHandler({
        onCheckpoint: (event) => events.push(event),
      });
      const state = createTestSessionState();

      handler.emit('user_request', state);

      expect(events).toHaveLength(1);
      expect(events[0]!.trigger).toBe('user_request');
    });

    test('increments sequence number with each checkpoint', () => {
      const events: CheckpointEvent[] = [];
      const handler = createCheckpointHandler({
        onCheckpoint: (event) => events.push(event),
      });
      const state = createTestSessionState();

      handler.emit('tool_complete', state, { toolName: 'tool1' });
      handler.emit('tool_complete', state, { toolName: 'tool2' });
      handler.emit('finding', state, { findingId: 'f1' });

      expect(events).toHaveLength(3);
      expect(events[0]!.sequence).toBe(1);
      expect(events[1]!.sequence).toBe(2);
      expect(events[2]!.sequence).toBe(3);
    });

    test('includes session ID from state', () => {
      const events: CheckpointEvent[] = [];
      const handler = createCheckpointHandler({
        onCheckpoint: (event) => events.push(event),
      });
      const state = createTestSessionState({ id: 'custom-session-456' });

      handler.emit('tool_complete', state);

      expect(events[0]!.sessionId).toBe('custom-session-456');
    });
  });

  // ===========================================================================
  // T036: Interval-based checkpoint fires after configured time
  // ===========================================================================

  describe('interval-based checkpoints (T036)', () => {
    let handler: ICheckpointHandler;
    let events: CheckpointEvent[];

    beforeEach(() => {
      events = [];
    });

    afterEach(() => {
      handler?.stop();
    });

    test('fires checkpoint after interval elapses', async () => {
      const state = createTestSessionState();
      handler = createCheckpointHandler({
        intervalMs: 50, // Short interval for testing
        onCheckpoint: (event) => events.push(event),
        getState: () => state,
      });

      handler.start();

      // Wait for interval to elapse
      await new Promise((resolve) => setTimeout(resolve, 70));

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]!.trigger).toBe('interval');
    });

    test('fires multiple checkpoints over time', async () => {
      const state = createTestSessionState();
      handler = createCheckpointHandler({
        intervalMs: 30,
        onCheckpoint: (event) => events.push(event),
        getState: () => state,
      });

      handler.start();

      // Wait for multiple intervals
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(events.length).toBeGreaterThanOrEqual(2);
      events.forEach((e) => expect(e.trigger).toBe('interval'));
    });

    test('stops firing after stop() is called', async () => {
      const state = createTestSessionState();
      handler = createCheckpointHandler({
        intervalMs: 30,
        onCheckpoint: (event) => events.push(event),
        getState: () => state,
      });

      handler.start();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const countBeforeStop = events.length;

      handler.stop();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // No new events should have fired after stop
      expect(events.length).toBe(countBeforeStop);
    });

    test('does not fire if not started', async () => {
      const state = createTestSessionState();
      handler = createCheckpointHandler({
        intervalMs: 30,
        onCheckpoint: (event) => events.push(event),
        getState: () => state,
      });

      // Don't call start()
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(events).toHaveLength(0);
    });

    test('can restart after stopping', async () => {
      const state = createTestSessionState();
      handler = createCheckpointHandler({
        intervalMs: 30,
        onCheckpoint: (event) => events.push(event),
        getState: () => state,
      });

      handler.start();
      await new Promise((resolve) => setTimeout(resolve, 50));
      handler.stop();
      const countAfterFirstStop = events.length;

      handler.start();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(events.length).toBeGreaterThan(countAfterFirstStop);
    });

    test('uses default interval if not configured', () => {
      const state = createTestSessionState();
      handler = createCheckpointHandler({
        onCheckpoint: (event) => events.push(event),
        getState: () => state,
      });

      // Default interval should be 60000ms (1 minute)
      expect(handler.getIntervalMs()).toBe(60000);
    });

    test('respects custom interval configuration', () => {
      const state = createTestSessionState();
      handler = createCheckpointHandler({
        intervalMs: 120000, // 2 minutes
        onCheckpoint: (event) => events.push(event),
        getState: () => state,
      });

      expect(handler.getIntervalMs()).toBe(120000);
    });
  });

  // ===========================================================================
  // T037: CheckpointEvent contains full SessionState snapshot
  // ===========================================================================

  describe('CheckpointEvent SessionState snapshot (T037)', () => {
    test('contains complete SessionState object', () => {
      const events: CheckpointEvent[] = [];
      const handler = createCheckpointHandler({
        onCheckpoint: (event) => events.push(event),
      });
      const state = createTestSessionState({
        phase: 'analysis',
        checkpointSequence: 5,
        findings: [
          {
            id: 'f1',
            type: 'config_gap',
            severity: 'high',
            title: 'Test finding',
            description: 'Test',
            location: null,
            origin: null,
            recommendations: [],
            detectedAt: '2026-01-16T10:00:00.000Z',
            detectedInPhase: 'discovery',
          },
        ],
      });

      handler.emit('tool_complete', state);

      const event = events[0]!;
      expect(event.state).toBeDefined();
      expect(event.state.id).toBe('test-session-123');
      expect(event.state.phase).toBe('analysis');
      expect(event.state.taskGoal).toBe('Analyze project for configuration issues');
      expect(event.state.findings).toHaveLength(1);
      expect(event.state.findings[0]!.id).toBe('f1');
    });

    test('snapshot is a deep copy (not reference)', () => {
      const events: CheckpointEvent[] = [];
      const handler = createCheckpointHandler({
        onCheckpoint: (event) => events.push(event),
      });
      const state = createTestSessionState({
        findings: [],
      });

      handler.emit('tool_complete', state);

      // Modify original state
      state.findings.push({
        id: 'new-finding',
        type: 'config_gap',
        severity: 'low',
        title: 'New',
        description: 'New finding',
        location: null,
        origin: null,
        recommendations: [],
        detectedAt: '2026-01-16T10:00:00.000Z',
        detectedInPhase: 'analysis',
      });

      // Snapshot should not be affected
      const snapshot = events[0]!.state;
      expect(snapshot.findings).toHaveLength(0);
    });

    test('includes projectContext in snapshot', () => {
      const events: CheckpointEvent[] = [];
      const handler = createCheckpointHandler({
        onCheckpoint: (event) => events.push(event),
      });
      const state = createTestSessionState({
        projectContext: {
          name: 'my-project',
          path: '/home/user/my-project',
          hasClaudeMd: true,
          primaryLanguage: 'python',
          agentType: 'claude-code',
        },
      });

      handler.emit('finding', state, { findingId: 'f1' });

      const snapshot = events[0]!.state;
      expect(snapshot.projectContext.name).toBe('my-project');
      expect(snapshot.projectContext.path).toBe('/home/user/my-project');
      expect(snapshot.projectContext.primaryLanguage).toBe('python');
    });

    test('includes toolResultCache in snapshot', () => {
      const events: CheckpointEvent[] = [];
      const handler = createCheckpointHandler({
        onCheckpoint: (event) => events.push(event),
      });
      const state = createTestSessionState({
        toolResultCache: {
          'read_file:/test.ts': {
            toolName: 'read_file',
            input: { path: '/test.ts' },
            output: 'file contents',
            timestamp: '2026-01-16T10:05:00.000Z',
            durationMs: 50,
          },
        },
      });

      handler.emit('tool_complete', state, { toolName: 'read_file' });

      const snapshot = events[0]!.state;
      expect(snapshot.toolResultCache['read_file:/test.ts']).toBeDefined();
      expect(snapshot.toolResultCache['read_file:/test.ts']!.output).toBe('file contents');
    });

    test('includes ISO-8601 timestamp', () => {
      const events: CheckpointEvent[] = [];
      const handler = createCheckpointHandler({
        onCheckpoint: (event) => events.push(event),
      });
      const state = createTestSessionState();

      const before = new Date();
      handler.emit('tool_complete', state);
      const after = new Date();

      const event = events[0]!;
      expect(event.timestamp).toBeDefined();
      const eventTime = new Date(event.timestamp);
      expect(eventTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(eventTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('updates state lastCheckpointAt in snapshot', () => {
      const events: CheckpointEvent[] = [];
      const handler = createCheckpointHandler({
        onCheckpoint: (event) => events.push(event),
      });
      const state = createTestSessionState({
        lastCheckpointAt: null,
      });

      handler.emit('tool_complete', state);

      const event = events[0]!;
      // The snapshot should have lastCheckpointAt updated to the checkpoint time
      expect(event.state.lastCheckpointAt).toBe(event.timestamp);
    });

    test('increments checkpointSequence in snapshot', () => {
      const events: CheckpointEvent[] = [];
      const handler = createCheckpointHandler({
        onCheckpoint: (event) => events.push(event),
      });
      const state = createTestSessionState({
        checkpointSequence: 0,
      });

      handler.emit('tool_complete', state);
      handler.emit('tool_complete', state);

      // Each emit increments handler sequence, which updates snapshot
      expect(events[0]!.sequence).toBe(1);
      expect(events[0]!.state.checkpointSequence).toBe(1);
      expect(events[1]!.sequence).toBe(2);
      expect(events[1]!.state.checkpointSequence).toBe(2);
    });
  });

  // ===========================================================================
  // CheckpointHandler class methods
  // ===========================================================================

  describe('CheckpointHandler class', () => {
    test('exposes isRunning() status', () => {
      const handler = createCheckpointHandler({
        intervalMs: 60000,
        onCheckpoint: () => {},
        getState: () => createTestSessionState(),
      });

      expect(handler.isRunning()).toBe(false);

      handler.start();
      expect(handler.isRunning()).toBe(true);

      handler.stop();
      expect(handler.isRunning()).toBe(false);
    });

    test('exposes getSequence() for current sequence number', () => {
      const handler = createCheckpointHandler({
        onCheckpoint: () => {},
      });
      const state = createTestSessionState();

      expect(handler.getSequence()).toBe(0);

      handler.emit('tool_complete', state);
      expect(handler.getSequence()).toBe(1);

      handler.emit('finding', state);
      expect(handler.getSequence()).toBe(2);
    });

    test('can be reset to initial state', () => {
      const events: CheckpointEvent[] = [];
      const handler = createCheckpointHandler({
        onCheckpoint: (event) => events.push(event),
      });
      const state = createTestSessionState();

      handler.emit('tool_complete', state);
      handler.emit('tool_complete', state);
      expect(handler.getSequence()).toBe(2);

      handler.reset();
      expect(handler.getSequence()).toBe(0);

      handler.emit('tool_complete', state);
      expect(handler.getSequence()).toBe(1);
    });
  });
});
