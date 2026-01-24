/**
 * T088: Integration tests for permission event extraction
 *
 * Tests the permission extraction with realistic session data
 * to ensure patterns are suitable for configuration improvement recommendations.
 *
 * Per FR-022: Tool extracts permission approval/denial events.
 * Per US-008: Permission patterns per tool/command are available.
 *
 * @module tests/integration/sessions/extraction/permissions
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  extractPermissionEvents,
  aggregatePermissionPatterns,
  getDeniedEvents,
} from '../../../../src/sessions/extraction/permissions';
import { getPermissionEvents } from '../../../../src/sessions/tools/get-permission-events-tool';

// =============================================================================
// Test Data - Realistic Session Scenarios
// =============================================================================

/**
 * Session entry type for test data (internal format).
 * Used for direct extractPermissionEvents calls.
 */
interface TestSessionEntry {
  type: string;
  uuid?: string;
  timestamp: string;
  sessionId?: string;
  message?: {
    role?: string;
    content?: Array<{
      type: string;
      name?: string;
      input?: Record<string, unknown>;
      text?: string;
    }>;
  };
  toolResult?: {
    toolUseId: string;
    isError?: boolean;
  };
  permissionRequest?: {
    toolName: string;
    toolInput: Record<string, unknown>;
    decision: 'approved' | 'denied' | 'auto_approved';
    timestamp: string;
  };
}

/**
 * JSONL format entry (snake_case for file serialization).
 */
interface JsonlSessionEntry {
  type: string;
  uuid?: string;
  timestamp: string;
  sessionId?: string;
  message?: {
    role?: string;
    content?: Array<{
      type: string;
      name?: string;
      input?: Record<string, unknown>;
      text?: string;
    }>;
  };
  tool_result?: {
    tool_use_id: string;
    is_error?: boolean;
  };
}

const BASE_TIMESTAMP = '2026-01-24T10:00:00Z';

function makeTimestamp(offsetMinutes: number): string {
  const date = new Date(BASE_TIMESTAMP);
  date.setMinutes(date.getMinutes() + offsetMinutes);
  return date.toISOString();
}

/**
 * Scenario 1: User approves all tool requests (happy path).
 */
function createApprovedOnlySession(): TestSessionEntry[] {
  return [
    {
      type: 'init',
      timestamp: makeTimestamp(0),
      sessionId: 'session-approved-only',
    },
    {
      type: 'user',
      timestamp: makeTimestamp(0),
      message: { role: 'user', content: [{ type: 'text', text: 'Run tests' }] },
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
      type: 'tool_result',
      timestamp: makeTimestamp(2),
      toolResult: { toolUseId: 'tool-1' },
    },
    {
      type: 'assistant',
      timestamp: makeTimestamp(3),
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Edit', input: { file_path: '/src/app.ts' } }],
      },
    },
    {
      type: 'tool_result',
      timestamp: makeTimestamp(4),
      toolResult: { toolUseId: 'tool-2' },
    },
  ];
}

/**
 * Scenario 2: User denies some tool requests (friction scenario).
 */
function createMixedDecisionSession(): TestSessionEntry[] {
  return [
    {
      type: 'init',
      timestamp: makeTimestamp(0),
      sessionId: 'session-mixed-decisions',
    },
    {
      type: 'user',
      timestamp: makeTimestamp(0),
      message: { role: 'user', content: [{ type: 'text', text: 'Deploy to prod' }] },
    },
    // First tool approved
    {
      type: 'assistant',
      timestamp: makeTimestamp(1),
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm run build' } }],
      },
    },
    {
      type: 'tool_result',
      timestamp: makeTimestamp(2),
      toolResult: { toolUseId: 'tool-1' },
    },
    // Second tool denied (deploy without confirmation)
    {
      type: 'assistant',
      timestamp: makeTimestamp(3),
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm run deploy' } }],
      },
    },
    {
      type: 'permission',
      timestamp: makeTimestamp(3),
      permissionRequest: {
        toolName: 'Bash',
        toolInput: { command: 'npm run deploy' },
        decision: 'denied',
        timestamp: makeTimestamp(3),
      },
    },
    // Third tool approved (after user clarified)
    {
      type: 'assistant',
      timestamp: makeTimestamp(5),
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm run deploy:staging' } }],
      },
    },
    {
      type: 'tool_result',
      timestamp: makeTimestamp(6),
      toolResult: { toolUseId: 'tool-3' },
    },
  ];
}

/**
 * Scenario 3: High-friction session with multiple denials.
 */
function createHighFrictionSession(): TestSessionEntry[] {
  return [
    {
      type: 'init',
      timestamp: makeTimestamp(0),
      sessionId: 'session-high-friction',
    },
    {
      type: 'user',
      timestamp: makeTimestamp(0),
      message: { role: 'user', content: [{ type: 'text', text: 'Clean up files' }] },
    },
    // Multiple denials for rm commands
    {
      type: 'assistant',
      timestamp: makeTimestamp(1),
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Bash', input: { command: 'rm -rf node_modules' } }],
      },
    },
    {
      type: 'permission',
      timestamp: makeTimestamp(1),
      permissionRequest: {
        toolName: 'Bash',
        toolInput: { command: 'rm -rf node_modules' },
        decision: 'denied',
        timestamp: makeTimestamp(1),
      },
    },
    {
      type: 'assistant',
      timestamp: makeTimestamp(2),
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Bash', input: { command: 'rm -rf dist' } }],
      },
    },
    {
      type: 'permission',
      timestamp: makeTimestamp(2),
      permissionRequest: {
        toolName: 'Bash',
        toolInput: { command: 'rm -rf dist' },
        decision: 'denied',
        timestamp: makeTimestamp(2),
      },
    },
    {
      type: 'assistant',
      timestamp: makeTimestamp(3),
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Bash', input: { command: 'rm -rf .cache' } }],
      },
    },
    {
      type: 'permission',
      timestamp: makeTimestamp(3),
      permissionRequest: {
        toolName: 'Bash',
        toolInput: { command: 'rm -rf .cache' },
        decision: 'denied',
        timestamp: makeTimestamp(3),
      },
    },
    // Finally, a safe command approved
    {
      type: 'assistant',
      timestamp: makeTimestamp(4),
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'Bash', input: { command: 'npm cache clean --force' } },
        ],
      },
    },
    {
      type: 'tool_result',
      timestamp: makeTimestamp(5),
      toolResult: { toolUseId: 'tool-4' },
    },
  ];
}

/**
 * Scenario 4: Safe tools only (no permission needed).
 */
function createSafeToolsSession(): TestSessionEntry[] {
  return [
    {
      type: 'init',
      timestamp: makeTimestamp(0),
      sessionId: 'session-safe-tools',
    },
    {
      type: 'user',
      timestamp: makeTimestamp(0),
      message: { role: 'user', content: [{ type: 'text', text: 'Show me the code' }] },
    },
    {
      type: 'assistant',
      timestamp: makeTimestamp(1),
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/src/app.ts' } }],
      },
    },
    {
      type: 'tool_result',
      timestamp: makeTimestamp(2),
      toolResult: { toolUseId: 'tool-1' },
    },
    {
      type: 'assistant',
      timestamp: makeTimestamp(3),
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Glob', input: { pattern: '*.ts' } }],
      },
    },
    {
      type: 'tool_result',
      timestamp: makeTimestamp(4),
      toolResult: { toolUseId: 'tool-2' },
    },
    {
      type: 'assistant',
      timestamp: makeTimestamp(5),
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Grep', input: { pattern: 'function' } }],
      },
    },
    {
      type: 'tool_result',
      timestamp: makeTimestamp(6),
      toolResult: { toolUseId: 'tool-3' },
    },
  ];
}

/**
 * Convert internal format to JSONL format (camelCase -> snake_case).
 */
function toJsonlFormat(
  entry: TestSessionEntry
): JsonlSessionEntry & { permissionRequest?: TestSessionEntry['permissionRequest'] } {
  const result: JsonlSessionEntry & { permissionRequest?: TestSessionEntry['permissionRequest'] } =
    {
      type: entry.type,
      timestamp: entry.timestamp,
    };

  if (entry.uuid) result.uuid = entry.uuid;
  if (entry.sessionId) result.sessionId = entry.sessionId;
  if (entry.message) result.message = entry.message;

  if (entry.toolResult) {
    result.tool_result = {
      tool_use_id: entry.toolResult.toolUseId,
    };
    if (entry.toolResult.isError !== undefined) {
      result.tool_result.is_error = entry.toolResult.isError;
    }
  }

  // Include permission request for explicit permission entries
  if (entry.permissionRequest) {
    result.permissionRequest = entry.permissionRequest;
  }

  return result;
}

/**
 * Write session entries to a JSONL file.
 */
async function writeSessionFile(filePath: string, entries: TestSessionEntry[]): Promise<void> {
  const lines = entries.map((e) => JSON.stringify(toJsonlFormat(e))).join('\n');
  await writeFile(filePath, lines + '\n');
}

// =============================================================================
// Integration Tests
// =============================================================================

describe('Permission Extraction Integration Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agentlint-perm-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Approved-Only Session', () => {
    it('should extract all approvals with no friction candidates', async () => {
      const entries = createApprovedOnlySession();
      const events = extractPermissionEvents(entries, { inferFromToolUse: true });

      // Should have 2 approved events (Bash and Edit)
      expect(events.length).toBe(2);
      expect(events.every((e) => e.decision === 'approved')).toBe(true);

      // No friction candidates
      const patterns = aggregatePermissionPatterns(events);
      const frictionCandidates = patterns.filter((p) => p.isFrictionCandidate);
      expect(frictionCandidates.length).toBe(0);
    });

    it('should track per-tool patterns correctly', async () => {
      const entries = createApprovedOnlySession();
      const events = extractPermissionEvents(entries, { inferFromToolUse: true });
      const patterns = aggregatePermissionPatterns(events);

      // Should have 2 patterns (Bash and Edit)
      expect(patterns.length).toBe(2);

      const bashPattern = patterns.find((p) => p.toolName === 'Bash');
      expect(bashPattern).toBeDefined();
      expect(bashPattern!.approvedCount).toBe(1);
      expect(bashPattern!.deniedCount).toBe(0);
      expect(bashPattern!.approvalRate).toBe(1);
    });
  });

  describe('Mixed Decision Session', () => {
    it('should identify friction candidates from denials', async () => {
      const entries = createMixedDecisionSession();
      const events = extractPermissionEvents(entries, { inferFromToolUse: true });

      // Should have 3 events (2 approved + 1 denied)
      expect(events.length).toBe(3);

      const deniedEvents = getDeniedEvents(events);
      expect(deniedEvents.length).toBe(1);
      expect(deniedEvents[0]!.toolName).toBe('Bash');
      expect(deniedEvents[0]!.command).toBe('npm run deploy');
    });

    it('should calculate correct denial rate', async () => {
      const entries = createMixedDecisionSession();
      const events = extractPermissionEvents(entries, { inferFromToolUse: true });
      const patterns = aggregatePermissionPatterns(events);

      const bashPattern = patterns.find((p) => p.toolName === 'Bash');
      expect(bashPattern).toBeDefined();
      expect(bashPattern!.totalCount).toBe(3);
      expect(bashPattern!.approvedCount).toBe(2);
      expect(bashPattern!.deniedCount).toBe(1);
      expect(bashPattern!.isFrictionCandidate).toBe(true);

      // Approval rate = 2 / 3 = 0.667
      expect(bashPattern!.approvalRate).toBeCloseTo(0.667, 2);
    });
  });

  describe('High Friction Session', () => {
    it('should flag high-friction tools', async () => {
      const entries = createHighFrictionSession();
      const events = extractPermissionEvents(entries, { inferFromToolUse: true });

      // 3 denied + 1 approved = 4 events
      expect(events.length).toBe(4);

      const deniedEvents = getDeniedEvents(events);
      expect(deniedEvents.length).toBe(3);

      // All denied should be Bash with rm commands
      for (const event of deniedEvents) {
        expect(event.toolName).toBe('Bash');
        expect(event.command).toContain('rm');
      }
    });

    it('should provide command patterns for friction analysis', async () => {
      const entries = createHighFrictionSession();
      const events = extractPermissionEvents(entries, { inferFromToolUse: true });
      const patterns = aggregatePermissionPatterns(events);

      const bashPattern = patterns.find((p) => p.toolName === 'Bash');
      expect(bashPattern).toBeDefined();
      expect(bashPattern!.isFrictionCandidate).toBe(true);

      // Should have command patterns
      expect(bashPattern!.commandPatterns).toBeDefined();
      const commands = Object.keys(bashPattern!.commandPatterns!);
      expect(commands.length).toBe(4); // 3 rm commands + 1 npm command

      // Approval rate should be low
      expect(bashPattern!.approvalRate).toBe(0.25); // 1/4
    });
  });

  describe('Safe Tools Session', () => {
    it('should not flag safe tools as permission events', async () => {
      const entries = createSafeToolsSession();
      const events = extractPermissionEvents(entries, { inferFromToolUse: true });

      // Safe tools (Read, Glob, Grep) don't require permission
      expect(events.length).toBe(0);
    });
  });

  describe('Tool Integration - getPermissionEvents', () => {
    it('should extract events from JSONL file via tool', async () => {
      const entries = createMixedDecisionSession();
      const filePath = join(tempDir, 'mixed-session.jsonl');
      await writeSessionFile(filePath, entries);

      const result = await getPermissionEvents({ filePath });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.sessionId).toBe('session-mixed-decisions');
      expect(result.data!.totalEvents).toBe(3);
      expect(result.data!.deniedCount).toBe(1);
      expect(result.data!.frictionCandidates.length).toBe(1);
    });

    it('should filter by tool name', async () => {
      const entries = createApprovedOnlySession();
      const filePath = join(tempDir, 'approved-session.jsonl');
      await writeSessionFile(filePath, entries);

      const result = await getPermissionEvents({
        filePath,
        toolName: 'Bash',
      });

      expect(result.success).toBe(true);
      expect(result.data!.totalEvents).toBe(1);
      expect(result.data!.events[0]!.toolName).toBe('Bash');
    });

    it('should handle non-existent file gracefully', async () => {
      const result = await getPermissionEvents({
        filePath: '/nonexistent/path/session.jsonl',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('SESSION_FILE_NOT_FOUND');
    });
  });

  describe('Cross-Session Analysis', () => {
    it('should aggregate patterns across multiple sessions', async () => {
      // Combine events from multiple sessions
      const approvedEvents = extractPermissionEvents(createApprovedOnlySession(), {
        inferFromToolUse: true,
      });
      const mixedEvents = extractPermissionEvents(createMixedDecisionSession(), {
        inferFromToolUse: true,
      });
      const highFrictionEvents = extractPermissionEvents(createHighFrictionSession(), {
        inferFromToolUse: true,
      });

      const allEvents = [...approvedEvents, ...mixedEvents, ...highFrictionEvents];
      const patterns = aggregatePermissionPatterns(allEvents);

      // Should have Bash and Edit patterns
      expect(patterns.length).toBe(2);

      const bashPattern = patterns.find((p) => p.toolName === 'Bash');
      expect(bashPattern).toBeDefined();

      // Total Bash: 1 (approved) + 3 (mixed) + 4 (high friction) = 8
      expect(bashPattern!.totalCount).toBe(8);

      // Approved: 1 + 2 + 1 = 4
      expect(bashPattern!.approvedCount).toBe(4);

      // Denied: 0 + 1 + 3 = 4
      expect(bashPattern!.deniedCount).toBe(4);

      // Should be a friction candidate due to denials
      expect(bashPattern!.isFrictionCandidate).toBe(true);
    });
  });

  describe('Permission Data for Agent Interpretation', () => {
    it('should provide sufficient data for agent to recommend config changes', async () => {
      const entries = createHighFrictionSession();
      const events = extractPermissionEvents(entries, { inferFromToolUse: true });
      const patterns = aggregatePermissionPatterns(events);
      const deniedEvents = getDeniedEvents(events);

      // Verify agent has access to:
      // 1. Which tools have friction
      const frictionTools = patterns.filter((p) => p.isFrictionCandidate);
      expect(frictionTools.length).toBeGreaterThan(0);

      // 2. Specific commands that were denied
      expect(deniedEvents.every((e) => e.command !== undefined)).toBe(true);

      // 3. Approval rates for severity assessment
      const bashPattern = patterns.find((p) => p.toolName === 'Bash');
      expect(bashPattern!.approvalRate).toBeDefined();
      expect(typeof bashPattern!.approvalRate).toBe('number');

      // Agent can now:
      // - Identify "rm" commands as friction source
      // - Recommend specific allowlist entries
      // - Assess whether pattern warrants config change
    });
  });
});
