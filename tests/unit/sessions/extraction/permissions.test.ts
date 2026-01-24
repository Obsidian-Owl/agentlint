/**
 * T084: Unit tests for permission event detection
 *
 * Tests permission approval/denial extraction from session logs.
 * Per FR-022: Tool extracts permission approval/denial events.
 * Per US-008: Permission patterns per tool/command are available.
 *
 * @module tests/unit/sessions/extraction/permissions
 */

import { describe, it, expect } from 'bun:test';

import {
  type PermissionEvent,
  createPermissionEvent,
  extractPermissionEvents,
  aggregatePermissionPatterns,
  PERMISSION_DECISIONS,
  isPermissionRequired,
} from '../../../../src/sessions/extraction/permissions';

// =============================================================================
// Test Data
// =============================================================================

const BASE_TIMESTAMP = '2026-01-24T10:00:00Z';

function makeTimestamp(offsetMinutes: number): string {
  const date = new Date(BASE_TIMESTAMP);
  date.setMinutes(date.getMinutes() + offsetMinutes);
  return date.toISOString();
}

// Simulated session entries for permission testing
interface MockSessionEntry {
  type: string;
  timestamp: string;
  message?: {
    role?: string;
    content?: Array<{
      type: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;
  };
  toolResult?: {
    toolUseId: string;
    isError?: boolean;
  };
  // Permission-specific fields (from canUseTool callback)
  permissionRequest?: {
    toolName: string;
    toolInput: Record<string, unknown>;
    decision: 'approved' | 'denied' | 'auto_approved';
    timestamp: string;
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Permission Event Constants', () => {
  describe('PERMISSION_DECISIONS', () => {
    it('should include all decision types', () => {
      expect(PERMISSION_DECISIONS).toContain('approved');
      expect(PERMISSION_DECISIONS).toContain('denied');
      expect(PERMISSION_DECISIONS).toContain('auto_approved');
    });
  });
});

describe('isPermissionRequired', () => {
  it('should return true for tools that require permission', () => {
    expect(isPermissionRequired('Bash')).toBe(true);
    expect(isPermissionRequired('Edit')).toBe(true);
    expect(isPermissionRequired('Write')).toBe(true);
    expect(isPermissionRequired('NotebookEdit')).toBe(true);
    expect(isPermissionRequired('Task')).toBe(true);
  });

  it('should return false for safe tools', () => {
    expect(isPermissionRequired('Read')).toBe(false);
    expect(isPermissionRequired('Glob')).toBe(false);
    expect(isPermissionRequired('Grep')).toBe(false);
    expect(isPermissionRequired('WebSearch')).toBe(false);
    expect(isPermissionRequired('WebFetch')).toBe(false);
  });

  it('should return false for agentlint MCP tools', () => {
    expect(isPermissionRequired('mcp__agentlint__get_findings')).toBe(false);
    expect(isPermissionRequired('mcp__agentlint__analyse')).toBe(false);
  });

  it('should return true for external MCP tools by default', () => {
    // External MCP tools may need permission depending on config
    expect(isPermissionRequired('mcp__linear__create_issue')).toBe(true);
    expect(isPermissionRequired('mcp__github__create_pr')).toBe(true);
  });
});

describe('createPermissionEvent', () => {
  it('should create an approved permission event', () => {
    const event = createPermissionEvent({
      toolName: 'Bash',
      toolInput: { command: 'npm test', description: 'Run tests' },
      decision: 'approved',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 5,
    });

    expect(event.toolName).toBe('Bash');
    expect(event.decision).toBe('approved');
    expect(event.timestamp).toBe(BASE_TIMESTAMP);
    expect(event.turnIndex).toBe(5);
    expect(event.toolInput?.command).toBe('npm test');
  });

  it('should create a denied permission event', () => {
    const event = createPermissionEvent({
      toolName: 'Bash',
      toolInput: { command: 'rm -rf /', description: 'Dangerous command' },
      decision: 'denied',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 10,
      denialReason: 'User denied this action',
    });

    expect(event.decision).toBe('denied');
    expect(event.denialReason).toBe('User denied this action');
  });

  it('should create an auto-approved permission event', () => {
    const event = createPermissionEvent({
      toolName: 'Read',
      toolInput: { file_path: '/src/index.ts' },
      decision: 'auto_approved',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 3,
    });

    expect(event.decision).toBe('auto_approved');
    expect(event.toolName).toBe('Read');
  });

  it('should extract command from Bash tool input', () => {
    const event = createPermissionEvent({
      toolName: 'Bash',
      toolInput: { command: 'git commit -m "fix"' },
      decision: 'approved',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 1,
    });

    expect(event.command).toBe('git commit -m "fix"');
  });

  it('should extract file path from file tools', () => {
    const editEvent = createPermissionEvent({
      toolName: 'Edit',
      toolInput: { file_path: '/src/app.ts', old_string: 'foo', new_string: 'bar' },
      decision: 'approved',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 1,
    });

    expect(editEvent.filePath).toBe('/src/app.ts');

    const writeEvent = createPermissionEvent({
      toolName: 'Write',
      toolInput: { file_path: '/new-file.ts', content: 'hello' },
      decision: 'approved',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 2,
    });

    expect(writeEvent.filePath).toBe('/new-file.ts');
  });
});

describe('extractPermissionEvents', () => {
  it('should extract permission events from session entries', () => {
    const entries: MockSessionEntry[] = [
      {
        type: 'user',
        timestamp: makeTimestamp(0),
        message: { role: 'user', content: [{ type: 'text' }] },
      },
      {
        type: 'assistant',
        timestamp: makeTimestamp(1),
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm test' } }],
        },
      },
      {
        type: 'permission',
        timestamp: makeTimestamp(1),
        permissionRequest: {
          toolName: 'Bash',
          toolInput: { command: 'npm test' },
          decision: 'approved',
          timestamp: makeTimestamp(1),
        },
      },
      {
        type: 'tool_result',
        timestamp: makeTimestamp(2),
        toolResult: { toolUseId: 'tool-1' },
      },
    ];

    const events = extractPermissionEvents(entries);

    expect(events.length).toBe(1);
    expect(events[0]!.toolName).toBe('Bash');
    expect(events[0]!.decision).toBe('approved');
  });

  it('should handle sessions with no permission events', () => {
    const entries: MockSessionEntry[] = [
      {
        type: 'user',
        timestamp: makeTimestamp(0),
        message: { role: 'user' },
      },
      {
        type: 'assistant',
        timestamp: makeTimestamp(1),
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'Read', input: {} }],
        },
      },
    ];

    const events = extractPermissionEvents(entries);
    expect(events.length).toBe(0);
  });

  it('should handle multiple permission events in sequence', () => {
    const entries: MockSessionEntry[] = [
      {
        type: 'permission',
        timestamp: makeTimestamp(1),
        permissionRequest: {
          toolName: 'Edit',
          toolInput: { file_path: '/a.ts' },
          decision: 'approved',
          timestamp: makeTimestamp(1),
        },
      },
      {
        type: 'permission',
        timestamp: makeTimestamp(2),
        permissionRequest: {
          toolName: 'Bash',
          toolInput: { command: 'npm test' },
          decision: 'denied',
          timestamp: makeTimestamp(2),
        },
      },
      {
        type: 'permission',
        timestamp: makeTimestamp(3),
        permissionRequest: {
          toolName: 'Write',
          toolInput: { file_path: '/b.ts' },
          decision: 'approved',
          timestamp: makeTimestamp(3),
        },
      },
    ];

    const events = extractPermissionEvents(entries);

    expect(events.length).toBe(3);
    expect(events[0]!.decision).toBe('approved');
    expect(events[1]!.decision).toBe('denied');
    expect(events[2]!.decision).toBe('approved');
  });

  it('should infer permission events from tool_use without explicit permission entry', () => {
    // Some sessions may not have explicit permission entries
    // but we can infer from tool_use + tool_result pairs
    const entries: MockSessionEntry[] = [
      {
        type: 'assistant',
        timestamp: makeTimestamp(0),
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm install' } }],
        },
      },
      {
        type: 'tool_result',
        timestamp: makeTimestamp(1),
        toolResult: { toolUseId: 'tool-1', isError: false },
      },
    ];

    const events = extractPermissionEvents(entries, { inferFromToolUse: true });

    // Should infer approval since tool was executed successfully
    expect(events.length).toBe(1);
    expect(events[0]!.toolName).toBe('Bash');
    expect(events[0]!.decision).toBe('approved');
  });
});

describe('aggregatePermissionPatterns', () => {
  it('should aggregate patterns by tool name', () => {
    const events: PermissionEvent[] = [
      createPermissionEvent({
        toolName: 'Bash',
        toolInput: { command: 'npm test' },
        decision: 'approved',
        timestamp: makeTimestamp(0),
        turnIndex: 1,
      }),
      createPermissionEvent({
        toolName: 'Bash',
        toolInput: { command: 'npm run build' },
        decision: 'approved',
        timestamp: makeTimestamp(1),
        turnIndex: 2,
      }),
      createPermissionEvent({
        toolName: 'Bash',
        toolInput: { command: 'rm file.txt' },
        decision: 'denied',
        timestamp: makeTimestamp(2),
        turnIndex: 3,
      }),
      createPermissionEvent({
        toolName: 'Edit',
        toolInput: { file_path: '/app.ts' },
        decision: 'approved',
        timestamp: makeTimestamp(3),
        turnIndex: 4,
      }),
    ];

    const patterns = aggregatePermissionPatterns(events);

    expect(patterns.length).toBe(2);

    const bashPattern = patterns.find((p) => p.toolName === 'Bash');
    expect(bashPattern).toBeDefined();
    expect(bashPattern!.totalCount).toBe(3);
    expect(bashPattern!.approvedCount).toBe(2);
    expect(bashPattern!.deniedCount).toBe(1);
    expect(bashPattern!.approvalRate).toBeCloseTo(0.6667, 2);

    const editPattern = patterns.find((p) => p.toolName === 'Edit');
    expect(editPattern).toBeDefined();
    expect(editPattern!.totalCount).toBe(1);
    expect(editPattern!.approvedCount).toBe(1);
    expect(editPattern!.deniedCount).toBe(0);
    expect(editPattern!.approvalRate).toBe(1);
  });

  it('should identify friction candidates (tools with denials)', () => {
    const events: PermissionEvent[] = [
      createPermissionEvent({
        toolName: 'Bash',
        toolInput: { command: 'rm -rf temp/' },
        decision: 'denied',
        timestamp: makeTimestamp(0),
        turnIndex: 1,
      }),
      createPermissionEvent({
        toolName: 'Bash',
        toolInput: { command: 'rm -rf temp/' },
        decision: 'denied',
        timestamp: makeTimestamp(1),
        turnIndex: 2,
      }),
      createPermissionEvent({
        toolName: 'Edit',
        toolInput: {},
        decision: 'approved',
        timestamp: makeTimestamp(2),
        turnIndex: 3,
      }),
    ];

    const patterns = aggregatePermissionPatterns(events);

    const bashPattern = patterns.find((p) => p.toolName === 'Bash');
    expect(bashPattern!.isFrictionCandidate).toBe(true);

    const editPattern = patterns.find((p) => p.toolName === 'Edit');
    expect(editPattern!.isFrictionCandidate).toBe(false);
  });

  it('should track command patterns for Bash', () => {
    const events: PermissionEvent[] = [
      createPermissionEvent({
        toolName: 'Bash',
        toolInput: { command: 'npm test' },
        decision: 'approved',
        timestamp: makeTimestamp(0),
        turnIndex: 1,
      }),
      createPermissionEvent({
        toolName: 'Bash',
        toolInput: { command: 'npm test' },
        decision: 'approved',
        timestamp: makeTimestamp(1),
        turnIndex: 2,
      }),
      createPermissionEvent({
        toolName: 'Bash',
        toolInput: { command: 'git status' },
        decision: 'approved',
        timestamp: makeTimestamp(2),
        turnIndex: 3,
      }),
    ];

    const patterns = aggregatePermissionPatterns(events);
    const bashPattern = patterns.find((p) => p.toolName === 'Bash');

    expect(bashPattern!.commandPatterns).toBeDefined();
    expect(bashPattern!.commandPatterns!['npm test']).toBe(2);
    expect(bashPattern!.commandPatterns!['git status']).toBe(1);
  });

  it('should return empty array for no events', () => {
    const patterns = aggregatePermissionPatterns([]);
    expect(patterns).toEqual([]);
  });
});

describe('PermissionEvent structure', () => {
  it('should have consistent structure for all decision types', () => {
    const approved = createPermissionEvent({
      toolName: 'Bash',
      toolInput: { command: 'test' },
      decision: 'approved',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 1,
    });

    const denied = createPermissionEvent({
      toolName: 'Edit',
      toolInput: { file_path: '/x.ts' },
      decision: 'denied',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 2,
      denialReason: 'User declined',
    });

    const autoApproved = createPermissionEvent({
      toolName: 'Read',
      toolInput: { file_path: '/y.ts' },
      decision: 'auto_approved',
      timestamp: BASE_TIMESTAMP,
      turnIndex: 3,
    });

    // All should have required fields
    for (const event of [approved, denied, autoApproved]) {
      expect(typeof event.toolName).toBe('string');
      expect(typeof event.decision).toBe('string');
      expect(typeof event.timestamp).toBe('string');
      expect(typeof event.turnIndex).toBe('number');
    }
  });
});
