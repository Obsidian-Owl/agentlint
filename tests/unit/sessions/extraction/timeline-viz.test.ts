/**
 * T079: Unit tests for timeline visualization data structures
 *
 * Tests timeline event structures suitable for rendering in future TUI (EP17).
 * Per FR-021: Timeline data includes phase markers (exploration, implementation, debugging).
 *
 * @module tests/unit/sessions/extraction/timeline-viz
 */

import { describe, it, expect } from 'bun:test';

import {
  type TimelineVizEvent,
  createTimelineVizEvent,
  flagKeyMoment,
  isKeyMoment,
  TIMELINE_VIZ_EVENT_TYPES,
  KEY_MOMENT_TYPES,
} from '../../../../src/sessions/extraction/timeline-viz';

// =============================================================================
// Test Data
// =============================================================================

const BASE_TIMESTAMP = '2026-01-24T10:00:00Z';

function makeTimestamp(offsetMinutes: number): string {
  const date = new Date(BASE_TIMESTAMP);
  date.setMinutes(date.getMinutes() + offsetMinutes);
  return date.toISOString();
}

// =============================================================================
// Tests
// =============================================================================

describe('Timeline Visualization Event Types', () => {
  describe('TIMELINE_VIZ_EVENT_TYPES constant', () => {
    it('should include all required event types', () => {
      expect(TIMELINE_VIZ_EVENT_TYPES).toContain('user_message');
      expect(TIMELINE_VIZ_EVENT_TYPES).toContain('assistant_message');
      expect(TIMELINE_VIZ_EVENT_TYPES).toContain('tool_call');
      expect(TIMELINE_VIZ_EVENT_TYPES).toContain('tool_result');
      expect(TIMELINE_VIZ_EVENT_TYPES).toContain('compression');
      expect(TIMELINE_VIZ_EVENT_TYPES).toContain('error');
      expect(TIMELINE_VIZ_EVENT_TYPES).toContain('delegation');
    });
  });

  describe('KEY_MOMENT_TYPES constant', () => {
    it('should include all key moment types', () => {
      expect(KEY_MOMENT_TYPES).toContain('error');
      expect(KEY_MOMENT_TYPES).toContain('compression');
      expect(KEY_MOMENT_TYPES).toContain('milestone');
      expect(KEY_MOMENT_TYPES).toContain('phase_transition');
      expect(KEY_MOMENT_TYPES).toContain('delegation_start');
      expect(KEY_MOMENT_TYPES).toContain('delegation_end');
    });
  });
});

describe('createTimelineVizEvent', () => {
  it('should create a user message event', () => {
    const event = createTimelineVizEvent({
      type: 'user_message',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 1,
      summary: 'Fix the login bug',
    });

    expect(event.type).toBe('user_message');
    expect(event.timestamp).toBe(BASE_TIMESTAMP);
    expect(event.turnIndex).toBe(1);
    expect(event.summary).toBe('Fix the login bug');
    expect(event.isKeyMoment).toBe(false);
    expect(event.keyMomentType).toBeUndefined();
  });

  it('should create an assistant message event', () => {
    const event = createTimelineVizEvent({
      type: 'assistant_message',
      timestamp: makeTimestamp(1),
      turnIndex: 2,
      summary: 'Let me analyze the login validation code',
    });

    expect(event.type).toBe('assistant_message');
    expect(event.turnIndex).toBe(2);
  });

  it('should create a tool call event with tool metadata', () => {
    const event = createTimelineVizEvent({
      type: 'tool_call',
      timestamp: makeTimestamp(2),
      turnIndex: 3,
      summary: 'Read src/auth/login.ts',
      toolName: 'Read',
      toolCategory: 'navigation',
    });

    expect(event.type).toBe('tool_call');
    expect(event.toolName).toBe('Read');
    expect(event.toolCategory).toBe('navigation');
  });

  it('should create a compression event as key moment', () => {
    const event = createTimelineVizEvent({
      type: 'compression',
      timestamp: makeTimestamp(30),
      turnIndex: 50,
      summary: 'Context compressed, 150K tokens saved',
      isKeyMoment: true,
      keyMomentType: 'compression',
      metadata: {
        preTokens: 180000,
        postTokens: 30000,
        tokensSaved: 150000,
      },
    });

    expect(event.type).toBe('compression');
    expect(event.isKeyMoment).toBe(true);
    expect(event.keyMomentType).toBe('compression');
    expect(event.metadata?.preTokens).toBe(180000);
    expect(event.metadata?.tokensSaved).toBe(150000);
  });

  it('should create an error event as key moment', () => {
    const event = createTimelineVizEvent({
      type: 'error',
      timestamp: makeTimestamp(10),
      turnIndex: 15,
      summary: 'Test failed: Expected 200 but got 401',
      isKeyMoment: true,
      keyMomentType: 'error',
      metadata: {
        errorType: 'test_failure',
        severity: 'high',
      },
    });

    expect(event.type).toBe('error');
    expect(event.isKeyMoment).toBe(true);
    expect(event.keyMomentType).toBe('error');
    expect(event.metadata?.errorType).toBe('test_failure');
  });

  it('should create a delegation event', () => {
    const event = createTimelineVizEvent({
      type: 'delegation',
      timestamp: makeTimestamp(5),
      turnIndex: 8,
      summary: 'Spawned Explore agent to find auth patterns',
      isKeyMoment: true,
      keyMomentType: 'delegation_start',
      metadata: {
        subagentType: 'Explore',
        taskPrompt: 'Find authentication patterns in the codebase',
      },
    });

    expect(event.type).toBe('delegation');
    expect(event.keyMomentType).toBe('delegation_start');
    expect(event.metadata?.subagentType).toBe('Explore');
  });
});

describe('flagKeyMoment', () => {
  it('should flag an existing event as a key moment', () => {
    const event = createTimelineVizEvent({
      type: 'tool_call',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 5,
      summary: 'Tests pass after fix',
      toolName: 'Bash',
    });

    expect(event.isKeyMoment).toBe(false);

    const flaggedEvent = flagKeyMoment(event, 'milestone');

    expect(flaggedEvent.isKeyMoment).toBe(true);
    expect(flaggedEvent.keyMomentType).toBe('milestone');
    // Original event unchanged (immutable)
    expect(event.isKeyMoment).toBe(false);
  });

  it('should handle phase transition flagging', () => {
    const event = createTimelineVizEvent({
      type: 'tool_call',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 20,
      summary: 'Starting to write implementation',
      toolName: 'Write',
    });

    const flaggedEvent = flagKeyMoment(event, 'phase_transition', {
      fromPhase: 'exploration',
      toPhase: 'implementation',
    });

    expect(flaggedEvent.isKeyMoment).toBe(true);
    expect(flaggedEvent.keyMomentType).toBe('phase_transition');
    expect(flaggedEvent.metadata?.fromPhase).toBe('exploration');
    expect(flaggedEvent.metadata?.toPhase).toBe('implementation');
  });
});

describe('isKeyMoment', () => {
  it('should return true for key moment events', () => {
    const keyEvent = createTimelineVizEvent({
      type: 'error',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 1,
      summary: 'Error occurred',
      isKeyMoment: true,
      keyMomentType: 'error',
    });

    expect(isKeyMoment(keyEvent)).toBe(true);
  });

  it('should return false for non-key moment events', () => {
    const normalEvent = createTimelineVizEvent({
      type: 'tool_call',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 1,
      summary: 'Read a file',
    });

    expect(isKeyMoment(normalEvent)).toBe(false);
  });
});

describe('TimelineVizEvent structure', () => {
  it('should have consistent structure across all event types', () => {
    const events: TimelineVizEvent[] = [
      createTimelineVizEvent({
        type: 'user_message',
        timestamp: makeTimestamp(0),
        turnIndex: 1,
        summary: 'User prompt',
      }),
      createTimelineVizEvent({
        type: 'assistant_message',
        timestamp: makeTimestamp(1),
        turnIndex: 2,
        summary: 'Assistant response',
      }),
      createTimelineVizEvent({
        type: 'tool_call',
        timestamp: makeTimestamp(2),
        turnIndex: 3,
        summary: 'Tool invocation',
        toolName: 'Read',
      }),
      createTimelineVizEvent({
        type: 'compression',
        timestamp: makeTimestamp(30),
        turnIndex: 50,
        summary: 'Context compressed',
        isKeyMoment: true,
        keyMomentType: 'compression',
      }),
    ];

    // All events should have the same base structure
    for (const event of events) {
      expect(typeof event.type).toBe('string');
      expect(typeof event.timestamp).toBe('string');
      expect(typeof event.turnIndex).toBe('number');
      expect(typeof event.summary).toBe('string');
      expect(typeof event.isKeyMoment).toBe('boolean');
    }
  });

  it('should support metadata for any event type', () => {
    const event = createTimelineVizEvent({
      type: 'tool_call',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 1,
      summary: 'Read file',
      metadata: {
        filePath: '/src/index.ts',
        linesRead: 150,
        customField: 'custom value',
      },
    });

    expect(event.metadata).toBeDefined();
    expect(event.metadata?.filePath).toBe('/src/index.ts');
    expect(event.metadata?.linesRead).toBe(150);
    expect(event.metadata?.customField).toBe('custom value');
  });
});

describe('Tool categories', () => {
  it('should categorize navigation tools', () => {
    const event = createTimelineVizEvent({
      type: 'tool_call',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 1,
      summary: 'Read code',
      toolName: 'Read',
      toolCategory: 'navigation',
    });

    expect(event.toolCategory).toBe('navigation');
  });

  it('should categorize mutation tools', () => {
    const event = createTimelineVizEvent({
      type: 'tool_call',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 1,
      summary: 'Write code',
      toolName: 'Write',
      toolCategory: 'mutation',
    });

    expect(event.toolCategory).toBe('mutation');
  });

  it('should categorize execution tools', () => {
    const event = createTimelineVizEvent({
      type: 'tool_call',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 1,
      summary: 'Run tests',
      toolName: 'Bash',
      toolCategory: 'execution',
    });

    expect(event.toolCategory).toBe('execution');
  });

  it('should categorize coordination tools', () => {
    const event = createTimelineVizEvent({
      type: 'tool_call',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 1,
      summary: 'Delegate task',
      toolName: 'Task',
      toolCategory: 'coordination',
    });

    expect(event.toolCategory).toBe('coordination');
  });

  it('should categorize external tools', () => {
    const event = createTimelineVizEvent({
      type: 'tool_call',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 1,
      summary: 'MCP call',
      toolName: 'mcp__linear__list_issues',
      toolCategory: 'external',
    });

    expect(event.toolCategory).toBe('external');
  });
});
