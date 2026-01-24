/**
 * T083: Integration tests for timeline visualization data structures
 *
 * Tests the timeline visualization extraction with realistic session data
 * to ensure structures are suitable for TUI rendering (EP17).
 *
 * Per FR-021: Timeline data includes phase markers (exploration, implementation, debugging).
 *
 * @module tests/integration/sessions/extraction/timeline-viz
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  type TimelineVizEvent,
  type ToolCategory,
  createTimelineVizEvent,
  flagKeyMoment,
  filterKeyMoments,
  groupEventsByType,
  getEventCounts,
  classifyToolCategory,
} from '../../../../src/sessions/extraction/timeline-viz';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Simulate extracting timeline viz events from a session log.
 * In a real implementation, this would parse JSONL and create events.
 */
function extractTimelineVizEvents(entries: SessionEntry[]): TimelineVizEvent[] {
  const events: TimelineVizEvent[] = [];
  let turnIndex = 1;

  for (const entry of entries) {
    if (entry.type === 'user') {
      events.push(
        createTimelineVizEvent({
          type: 'user_message',
          timestamp: entry.timestamp,
          turnIndex: turnIndex++,
          summary: extractTextContent(entry.message?.content),
        })
      );
    } else if (entry.type === 'assistant') {
      // Add assistant message event
      events.push(
        createTimelineVizEvent({
          type: 'assistant_message',
          timestamp: entry.timestamp,
          turnIndex: turnIndex++,
          summary: extractTextContent(entry.message?.content),
        })
      );

      // Add tool call events
      const toolUses = extractToolUses(entry.message?.content);
      for (const toolUse of toolUses) {
        const toolName = toolUse.name ?? 'unknown';
        events.push(
          createTimelineVizEvent({
            type: 'tool_call',
            timestamp: entry.timestamp,
            turnIndex,
            summary: `${toolName}: ${summarizeToolInput(toolUse)}`,
            toolName,
            toolCategory: classifyToolCategory(toolName),
          })
        );
      }
    } else if (entry.type === 'tool_result') {
      const isError = entry.tool_result?.is_error === true;
      const event = createTimelineVizEvent({
        type: 'tool_result',
        timestamp: entry.timestamp,
        turnIndex,
        summary: isError ? 'Tool error' : 'Tool success',
        metadata: {
          success: !isError,
        },
      });

      // Flag errors as key moments
      if (isError) {
        events.push(flagKeyMoment(event, 'error'));
      } else {
        events.push(event);
      }
    } else if (entry.type === 'summary') {
      // Compression events are key moments
      events.push(
        createTimelineVizEvent({
          type: 'compression',
          timestamp: entry.timestamp,
          turnIndex,
          summary: entry.summary ?? 'Context compressed',
          isKeyMoment: true,
          keyMomentType: 'compression',
        })
      );
    } else if (entry.type === 'delegation') {
      // Delegation start is a key moment
      // Build metadata conditionally to satisfy exactOptionalPropertyTypes
      const metadata: Record<string, unknown> = {};
      if (entry.subagentType !== undefined) {
        metadata.subagentType = entry.subagentType;
      }
      if (entry.taskPrompt !== undefined) {
        metadata.taskPrompt = entry.taskPrompt;
      }

      events.push(
        createTimelineVizEvent({
          type: 'delegation',
          timestamp: entry.timestamp,
          turnIndex,
          summary: `Spawned ${entry.subagentType ?? 'unknown'} agent`,
          isKeyMoment: true,
          keyMomentType: 'delegation_start',
          metadata,
        })
      );
    }
  }

  return events;
}

// Session entry types (simplified)
interface SessionEntry {
  type: string;
  timestamp: string;
  message?: {
    content?: ContentBlock[];
  };
  tool_result?: {
    is_error?: boolean;
    content?: string;
  };
  summary?: string;
  subagentType?: string;
  taskPrompt?: string;
}

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
}

function extractTextContent(content?: ContentBlock[]): string {
  if (!content) return '';
  const textBlocks = content.filter((b) => b.type === 'text');
  return textBlocks.map((b) => b.text ?? '').join(' ');
}

function extractToolUses(content?: ContentBlock[]): ContentBlock[] {
  if (!content) return [];
  return content.filter((b) => b.type === 'tool_use');
}

function summarizeToolInput(toolUse: ContentBlock): string {
  const input = toolUse.input;
  if (!input) return '';
  if ('file_path' in input) return String(input.file_path);
  if ('command' in input) return String(input.command).slice(0, 50);
  if ('pattern' in input) return String(input.pattern);
  return JSON.stringify(input).slice(0, 50);
}

// =============================================================================
// Tests
// =============================================================================

describe('Timeline Visualization Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'timeline-viz-integration-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Real Session Extraction', () => {
    it('should extract timeline viz events from a debugging session', async () => {
      const entries: SessionEntry[] = [
        {
          type: 'user',
          timestamp: '2026-01-24T10:00:00Z',
          message: {
            content: [{ type: 'text', text: 'Fix the login validation bug' }],
          },
        },
        {
          type: 'assistant',
          timestamp: '2026-01-24T10:00:05Z',
          message: {
            content: [
              { type: 'text', text: 'Let me look at the code' },
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Read',
                input: { file_path: '/src/auth/login.ts' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          timestamp: '2026-01-24T10:00:06Z',
          tool_result: { is_error: false, content: 'file contents...' },
        },
        {
          type: 'assistant',
          timestamp: '2026-01-24T10:00:15Z',
          message: {
            content: [
              { type: 'text', text: 'Found the issue, fixing now' },
              {
                type: 'tool_use',
                id: 'tool-2',
                name: 'Edit',
                input: { file_path: '/src/auth/login.ts' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          timestamp: '2026-01-24T10:00:16Z',
          tool_result: { is_error: false, content: 'File updated' },
        },
      ];

      const events = extractTimelineVizEvents(entries);

      // Should have all event types:
      // 1 user_message + 2 assistant_message + 2 tool_call + 2 tool_result = 7
      expect(events.length).toBe(7);

      // Check user message
      const userEvents = events.filter((e) => e.type === 'user_message');
      expect(userEvents.length).toBe(1);
      expect(userEvents[0]!.summary).toContain('login');

      // Check assistant messages
      const assistantEvents = events.filter((e) => e.type === 'assistant_message');
      expect(assistantEvents.length).toBe(2);

      // Check tool calls with categories
      const toolCalls = events.filter((e) => e.type === 'tool_call');
      expect(toolCalls.length).toBe(2);
      expect(toolCalls[0]!.toolName).toBe('Read');
      expect(toolCalls[0]!.toolCategory).toBe('navigation');
      expect(toolCalls[1]!.toolName).toBe('Edit');
      expect(toolCalls[1]!.toolCategory).toBe('mutation');

      // Check tool results
      const toolResults = events.filter((e) => e.type === 'tool_result');
      expect(toolResults.length).toBe(2);
    });

    it('should flag errors as key moments', async () => {
      const entries: SessionEntry[] = [
        {
          type: 'user',
          timestamp: '2026-01-24T10:00:00Z',
          message: { content: [{ type: 'text', text: 'Run the tests' }] },
        },
        {
          type: 'assistant',
          timestamp: '2026-01-24T10:00:05Z',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Bash',
                input: { command: 'npm test' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          timestamp: '2026-01-24T10:00:10Z',
          tool_result: { is_error: true, content: 'Tests failed: 5 errors' },
        },
      ];

      const events = extractTimelineVizEvents(entries);
      const keyMoments = filterKeyMoments(events);

      expect(keyMoments.length).toBe(1);
      expect(keyMoments[0]!.type).toBe('tool_result');
      expect(keyMoments[0]!.keyMomentType).toBe('error');
    });

    it('should handle compression events as key moments', async () => {
      const entries: SessionEntry[] = [
        {
          type: 'user',
          timestamp: '2026-01-24T10:00:00Z',
          message: { content: [{ type: 'text', text: 'Refactor the auth module' }] },
        },
        {
          type: 'assistant',
          timestamp: '2026-01-24T10:00:05Z',
          message: { content: [{ type: 'text', text: 'Starting refactor...' }] },
        },
        {
          type: 'summary',
          timestamp: '2026-01-24T11:00:00Z',
          summary: 'Completed auth middleware refactor. Updated JWT handling.',
        },
        {
          type: 'user',
          timestamp: '2026-01-24T11:00:01Z',
          message: { content: [{ type: 'text', text: 'Continue with sessions' }] },
        },
      ];

      const events = extractTimelineVizEvents(entries);
      const keyMoments = filterKeyMoments(events);

      expect(keyMoments.length).toBe(1);
      expect(keyMoments[0]!.type).toBe('compression');
      expect(keyMoments[0]!.keyMomentType).toBe('compression');
      expect(keyMoments[0]!.summary).toContain('JWT');
    });

    it('should handle delegation events as key moments', async () => {
      const entries: SessionEntry[] = [
        {
          type: 'user',
          timestamp: '2026-01-24T10:00:00Z',
          message: { content: [{ type: 'text', text: 'Find auth patterns' }] },
        },
        {
          type: 'delegation',
          timestamp: '2026-01-24T10:00:05Z',
          subagentType: 'Explore',
          taskPrompt: 'Find authentication patterns in the codebase',
        },
      ];

      const events = extractTimelineVizEvents(entries);
      const keyMoments = filterKeyMoments(events);

      expect(keyMoments.length).toBe(1);
      expect(keyMoments[0]!.type).toBe('delegation');
      expect(keyMoments[0]!.keyMomentType).toBe('delegation_start');
      expect(keyMoments[0]!.metadata?.subagentType).toBe('Explore');
    });
  });

  describe('Utility Functions with Real Data', () => {
    it('should group events by type correctly', () => {
      const entries: SessionEntry[] = [
        {
          type: 'user',
          timestamp: '2026-01-24T10:00:00Z',
          message: { content: [{ type: 'text', text: 'Task 1' }] },
        },
        {
          type: 'assistant',
          timestamp: '2026-01-24T10:00:05Z',
          message: {
            content: [
              { type: 'text', text: 'Working...' },
              { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/a.ts' } },
            ],
          },
        },
        {
          type: 'tool_result',
          timestamp: '2026-01-24T10:00:06Z',
          tool_result: { is_error: false },
        },
        {
          type: 'user',
          timestamp: '2026-01-24T10:01:00Z',
          message: { content: [{ type: 'text', text: 'Task 2' }] },
        },
        {
          type: 'assistant',
          timestamp: '2026-01-24T10:01:05Z',
          message: {
            content: [
              { type: 'text', text: 'More work...' },
              { type: 'tool_use', id: 't2', name: 'Write', input: { file_path: '/b.ts' } },
            ],
          },
        },
        {
          type: 'tool_result',
          timestamp: '2026-01-24T10:01:06Z',
          tool_result: { is_error: false },
        },
      ];

      const events = extractTimelineVizEvents(entries);
      const grouped = groupEventsByType(events);

      expect(grouped.get('user_message')?.length).toBe(2);
      expect(grouped.get('assistant_message')?.length).toBe(2);
      expect(grouped.get('tool_call')?.length).toBe(2);
      expect(grouped.get('tool_result')?.length).toBe(2);
    });

    it('should count events by type correctly', () => {
      const entries: SessionEntry[] = [
        {
          type: 'user',
          timestamp: '2026-01-24T10:00:00Z',
          message: { content: [{ type: 'text', text: 'Start' }] },
        },
        {
          type: 'assistant',
          timestamp: '2026-01-24T10:00:05Z',
          message: {
            content: [
              { type: 'text', text: 'Working' },
              { type: 'tool_use', id: 't1', name: 'Read', input: {} },
              { type: 'tool_use', id: 't2', name: 'Grep', input: {} },
            ],
          },
        },
        { type: 'tool_result', timestamp: '2026-01-24T10:00:06Z', tool_result: {} },
        { type: 'tool_result', timestamp: '2026-01-24T10:00:07Z', tool_result: {} },
        {
          type: 'summary',
          timestamp: '2026-01-24T11:00:00Z',
          summary: 'Compressed',
        },
      ];

      const events = extractTimelineVizEvents(entries);
      const counts = getEventCounts(events);

      expect(counts.user_message).toBe(1);
      expect(counts.assistant_message).toBe(1);
      expect(counts.tool_call).toBe(2);
      expect(counts.tool_result).toBe(2);
      expect(counts.compression).toBe(1);
      expect(counts.error).toBe(0);
      expect(counts.delegation).toBe(0);
    });
  });

  describe('Tool Category Classification', () => {
    it('should classify all tool categories correctly', () => {
      const testCases: Array<{ tool: string; expected: ToolCategory }> = [
        // Navigation
        { tool: 'Read', expected: 'navigation' },
        { tool: 'Glob', expected: 'navigation' },
        { tool: 'Grep', expected: 'navigation' },
        { tool: 'WebFetch', expected: 'navigation' },
        { tool: 'WebSearch', expected: 'navigation' },
        // Mutation
        { tool: 'Edit', expected: 'mutation' },
        { tool: 'Write', expected: 'mutation' },
        { tool: 'NotebookEdit', expected: 'mutation' },
        // Execution
        { tool: 'Bash', expected: 'execution' },
        // Coordination
        { tool: 'Task', expected: 'coordination' },
        { tool: 'Skill', expected: 'coordination' },
        // External
        { tool: 'mcp__linear__list_issues', expected: 'external' },
        { tool: 'mcp__github__create_pr', expected: 'external' },
        // Unknown
        { tool: 'CustomTool', expected: 'unknown' },
        { tool: 'SomethingElse', expected: 'unknown' },
      ];

      for (const { tool: toolName, expected } of testCases) {
        expect(classifyToolCategory(toolName)).toBe(expected);
      }
    });
  });

  describe('Phase Transition Detection', () => {
    it('should flag phase transitions when detected', () => {
      // Simulate detecting a phase transition from exploration to implementation
      const explorationEvent = createTimelineVizEvent({
        type: 'tool_call',
        timestamp: '2026-01-24T10:00:00Z',
        turnIndex: 5,
        summary: 'Read src/auth/login.ts',
        toolName: 'Read',
        toolCategory: 'navigation',
      });

      const implementationEvent = createTimelineVizEvent({
        type: 'tool_call',
        timestamp: '2026-01-24T10:05:00Z',
        turnIndex: 10,
        summary: 'Write src/auth/login.ts',
        toolName: 'Write',
        toolCategory: 'mutation',
      });

      // Verify exploration event is NOT a key moment by default
      expect(explorationEvent.isKeyMoment).toBe(false);

      // Flag the first mutation after navigation as a phase transition
      const flagged = flagKeyMoment(implementationEvent, 'phase_transition', {
        fromPhase: 'exploration',
        toPhase: 'implementation',
      });

      expect(flagged.isKeyMoment).toBe(true);
      expect(flagged.keyMomentType).toBe('phase_transition');
      expect(flagged.metadata?.fromPhase).toBe('exploration');
      expect(flagged.metadata?.toPhase).toBe('implementation');
    });
  });

  describe('Consistent Structure Across Event Types', () => {
    it('should ensure all events have base required fields', () => {
      const entries: SessionEntry[] = [
        {
          type: 'user',
          timestamp: '2026-01-24T10:00:00Z',
          message: { content: [{ type: 'text', text: 'Start' }] },
        },
        {
          type: 'assistant',
          timestamp: '2026-01-24T10:00:05Z',
          message: {
            content: [
              { type: 'text', text: 'Working' },
              { type: 'tool_use', id: 't1', name: 'Read', input: {} },
            ],
          },
        },
        { type: 'tool_result', timestamp: '2026-01-24T10:00:06Z', tool_result: { is_error: true } },
        { type: 'summary', timestamp: '2026-01-24T11:00:00Z', summary: 'Compressed' },
        {
          type: 'delegation',
          timestamp: '2026-01-24T11:00:05Z',
          subagentType: 'Explore',
          taskPrompt: 'Find patterns',
        },
      ];

      const events = extractTimelineVizEvents(entries);

      // All events must have these fields
      for (const event of events) {
        expect(typeof event.type).toBe('string');
        expect(typeof event.timestamp).toBe('string');
        expect(typeof event.turnIndex).toBe('number');
        expect(typeof event.summary).toBe('string');
        expect(typeof event.isKeyMoment).toBe('boolean');
      }

      // Check we have all expected event types
      const types = new Set(events.map((e) => e.type));
      expect(types.has('user_message')).toBe(true);
      expect(types.has('assistant_message')).toBe(true);
      expect(types.has('tool_call')).toBe(true);
      expect(types.has('tool_result')).toBe(true);
      expect(types.has('compression')).toBe(true);
      expect(types.has('delegation')).toBe(true);
    });
  });
});
