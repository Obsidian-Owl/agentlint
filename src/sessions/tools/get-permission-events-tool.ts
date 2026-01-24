/**
 * EP15 Session Intelligence - get_permission_events Tool
 *
 * SDK tool definition for extracting permission approval/denial events from sessions.
 *
 * Per Constitution Principle VII: Returns data (events, patterns),
 * agent interprets whether permission patterns indicate friction opportunities.
 *
 * Per FR-022: Tool extracts permission approval/denial events.
 * Per US-008: Permission patterns per tool/command are available.
 *
 * @module sessions/tools/get-permission-events-tool
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { PermissionEvent, PermissionPattern } from '../extraction/permissions';
import {
  extractPermissionEvents,
  aggregatePermissionPatterns,
  getDeniedEvents,
} from '../extraction/permissions';
import { parseSessionLine } from '../../tools/sessions/parser';

// =============================================================================
// Types
// =============================================================================

/**
 * Error details for permission event extraction.
 */
export interface PermissionEventsError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** File path if applicable */
  filePath?: string;
  /** Suggestion for resolution */
  suggestion?: string;
}

/**
 * Input for getPermissionEvents function.
 */
export interface GetPermissionEventsInput {
  /** Path to session JSONL file */
  filePath: string;
  /** Project path for context */
  projectPath?: string;
  /** Filter by tool name */
  toolName?: string;
  /** Include auto-approved events */
  includeAutoApproved?: boolean;
  /** Whether to infer permissions from tool_use patterns */
  inferFromToolUse?: boolean;
}

/**
 * Output from getPermissionEvents.
 */
export interface GetPermissionEventsOutput {
  /** Session ID */
  sessionId: string;
  /** Total permission events */
  totalEvents: number;
  /** Number of approved events */
  approvedCount: number;
  /** Number of denied events */
  deniedCount: number;
  /** Number of auto-approved events */
  autoApprovedCount: number;
  /** Denial rate (denied / manual decisions) */
  denialRate: number;
  /** All extracted permission events */
  events: PermissionEvent[];
  /** Denied events only (for quick friction identification) */
  deniedEvents: PermissionEvent[];
  /** Aggregated patterns by tool */
  patterns: PermissionPattern[];
  /** Friction candidates (tools with denials) */
  frictionCandidates: PermissionPattern[];
}

/**
 * Result from getPermissionEvents function.
 */
export interface GetPermissionEventsResult {
  /** Whether extraction succeeded */
  success: boolean;
  /** The extracted data (if success) */
  data?: GetPermissionEventsOutput;
  /** Error details (if failed) */
  error?: PermissionEventsError;
}

// =============================================================================
// Core Function
// =============================================================================

/**
 * Extract permission events from a JSONL file.
 *
 * Parses the session file and extracts permission events:
 * - Approved/denied/auto-approved decisions
 * - Per-tool and per-command patterns
 * - Friction candidates (tools with denials)
 *
 * @param input - File path and query parameters
 * @returns Permission events extraction result
 */
export async function getPermissionEvents(
  input: GetPermissionEventsInput
): Promise<GetPermissionEventsResult> {
  const { filePath, toolName, includeAutoApproved = true, inferFromToolUse = true } = input;

  // Check file exists
  try {
    await access(filePath, constants.R_OK);
  } catch {
    return {
      success: false,
      error: {
        code: 'SESSION_FILE_NOT_FOUND',
        message: `Session file not found: ${filePath}`,
        filePath,
        suggestion: 'Verify the session ID is correct and the file has not been deleted.',
      },
    };
  }

  // Parse session file
  const entries: Array<{
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
    permissionRequest?: {
      toolName: string;
      toolInput: Record<string, unknown>;
      decision: 'approved' | 'denied' | 'auto_approved';
      timestamp: string;
    };
  }> = [];
  let sessionId = 'unknown';

  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      const result = parseSessionLine(line, lineNumber);
      if (result.success) {
        const entry = result.entry;

        // Extract sessionId from first entry
        if (sessionId === 'unknown' && entry.sessionId) {
          sessionId = entry.sessionId;
        }

        // Convert to permission extraction format
        // Build entry object conditionally to satisfy exactOptionalPropertyTypes
        const permEntry: {
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
          permissionRequest?: {
            toolName: string;
            toolInput: Record<string, unknown>;
            decision: 'approved' | 'denied' | 'auto_approved';
            timestamp: string;
          };
        } = {
          type: entry.type,
          timestamp: entry.timestamp,
        };

        if (entry.message) {
          const msgContent = entry.message.content?.map((c) => {
            const block: { type: string; name?: string; input?: Record<string, unknown> } = {
              type: c.type,
            };
            if (c.name !== undefined) block.name = c.name;
            if (c.input !== undefined) block.input = c.input;
            return block;
          });

          permEntry.message = {
            role: entry.message.role,
          };
          if (msgContent) {
            permEntry.message.content = msgContent;
          }
        }

        if (entry.toolResult) {
          permEntry.toolResult = {
            toolUseId: entry.toolResult.toolUseId,
          };
          if (entry.toolResult.isError !== undefined) {
            permEntry.toolResult.isError = entry.toolResult.isError;
          }
        }

        // Check for permission request entries (if present in session format)
        if (entry.type === 'permission') {
          const rawEntry = entry as unknown as { permissionRequest?: unknown };
          if (rawEntry.permissionRequest) {
            permEntry.permissionRequest = rawEntry.permissionRequest as {
              toolName: string;
              toolInput: Record<string, unknown>;
              decision: 'approved' | 'denied' | 'auto_approved';
              timestamp: string;
            };
          }
        }

        entries.push(permEntry);
      }
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SESSION_FILE_UNREADABLE',
        message: `Failed to read session file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        suggestion: 'Check file permissions and encoding.',
      },
    };
  }

  // Extract permission events
  let events = extractPermissionEvents(entries, { inferFromToolUse });

  // Filter by tool name if specified
  if (toolName) {
    events = events.filter((e) => e.toolName === toolName);
  }

  // Filter out auto-approved if not included
  if (!includeAutoApproved) {
    events = events.filter((e) => e.decision !== 'auto_approved');
  }

  // Get denied events
  const deniedEvents = getDeniedEvents(events);

  // Aggregate patterns
  const patterns = aggregatePermissionPatterns(events);

  // Identify friction candidates
  const frictionCandidates = patterns.filter((p) => p.isFrictionCandidate);

  // Calculate counts
  const approvedCount = events.filter((e) => e.decision === 'approved').length;
  const deniedCount = events.filter((e) => e.decision === 'denied').length;
  const autoApprovedCount = events.filter((e) => e.decision === 'auto_approved').length;
  const manualDecisions = approvedCount + deniedCount;
  const denialRate = manualDecisions > 0 ? deniedCount / manualDecisions : 0;

  return {
    success: true,
    data: {
      sessionId,
      totalEvents: events.length,
      approvedCount,
      deniedCount,
      autoApprovedCount,
      denialRate,
      events,
      deniedEvents,
      patterns,
      frictionCandidates,
    },
  };
}

// =============================================================================
// SDK Tool Definition
// =============================================================================

/**
 * Input schema for get_permission_events tool.
 */
const getPermissionEventsInputSchema = {
  filePath: z.string().describe('Absolute path to the session JSONL file'),
  projectPath: z.string().optional().describe('Project path for context reference'),
  toolName: z.string().optional().describe('Filter events to a specific tool name'),
  includeAutoApproved: z
    .boolean()
    .optional()
    .describe('Whether to include auto-approved events (default: true)'),
  inferFromToolUse: z
    .boolean()
    .optional()
    .describe('Infer permissions from tool_use/tool_result pairs (default: true)'),
};

/**
 * Format permission events for tool output.
 */
function formatToolOutput(data: GetPermissionEventsOutput): string {
  const lines: string[] = [];

  lines.push(`## Permission Events\n`);

  // Summary
  lines.push(`### Summary\n`);
  lines.push(`- **Session ID**: ${data.sessionId}`);
  lines.push(`- **Total events**: ${data.totalEvents}`);
  lines.push(`- **Approved**: ${data.approvedCount}`);
  lines.push(`- **Denied**: ${data.deniedCount}`);
  lines.push(`- **Auto-approved**: ${data.autoApprovedCount}`);
  lines.push(`- **Denial rate**: ${(data.denialRate * 100).toFixed(1)}%`);
  lines.push('');

  // Friction candidates
  if (data.frictionCandidates.length > 0) {
    lines.push(`### Friction Candidates (Tools with Denials)\n`);
    lines.push('| Tool | Total | Approved | Denied | Denial Rate |');
    lines.push('|------|-------|----------|--------|-------------|');

    for (const pattern of data.frictionCandidates) {
      const denialRate = ((1 - pattern.approvalRate) * 100).toFixed(0);
      lines.push(
        `| ${pattern.toolName} | ${pattern.totalCount} | ${pattern.approvedCount} | ${pattern.deniedCount} | ${denialRate}% |`
      );
    }
    lines.push('');
  }

  // Denied events detail
  if (data.deniedEvents.length > 0) {
    lines.push(`### Denied Events\n`);
    for (const event of data.deniedEvents.slice(0, 5)) {
      lines.push(`- **${event.toolName}** at turn ${event.turnIndex}`);
      if (event.command) {
        lines.push(`  - Command: \`${event.command}\``);
      }
      if (event.denialReason) {
        lines.push(`  - Reason: ${event.denialReason}`);
      }
    }
    if (data.deniedEvents.length > 5) {
      lines.push(`\n*... and ${data.deniedEvents.length - 5} more denied events*`);
    }
    lines.push('');
  }

  // All patterns
  if (data.patterns.length > 0) {
    lines.push(`### All Tool Patterns\n`);
    lines.push('| Tool | Total | Approved | Denied | Auto | Approval Rate |');
    lines.push('|------|-------|----------|--------|------|---------------|');

    for (const pattern of data.patterns) {
      const approvalRate = (pattern.approvalRate * 100).toFixed(0);
      lines.push(
        `| ${pattern.toolName} | ${pattern.totalCount} | ${pattern.approvedCount} | ${pattern.deniedCount} | ${pattern.autoApprovedCount} | ${approvalRate}% |`
      );
    }
    lines.push('');
  }

  if (data.totalEvents === 0) {
    lines.push('*No permission events detected*');
  }

  return lines.join('\n');
}

/**
 * get_permission_events tool definition.
 *
 * Extracts permission approval/denial events from a session.
 */
export const getPermissionEventsTool = tool(
  'get_permission_events',
  `Extract permission approval/denial events from a Claude Code session.

Returns:
- **Permission events**: Approved, denied, and auto-approved tool requests
- **Aggregated patterns**: Per-tool approval/denial statistics
- **Friction candidates**: Tools with user denials (improvement opportunities)
- **Denial rate**: Overall user denial frequency

Use this tool to understand permission interaction patterns:
- Which tools required permission prompts
- How often the user approved vs denied actions
- Which tools are friction candidates (repeated denials)
- Command patterns that could benefit from auto-approval

The agent interprets patterns to suggest configuration improvements.`,
  getPermissionEventsInputSchema,
  async (args) => {
    try {
      // Build input conditionally to satisfy exactOptionalPropertyTypes
      const input: GetPermissionEventsInput = {
        filePath: args.filePath,
      };
      if (args.projectPath !== undefined) {
        input.projectPath = args.projectPath;
      }
      if (args.toolName !== undefined) {
        input.toolName = args.toolName;
      }
      if (args.includeAutoApproved !== undefined) {
        input.includeAutoApproved = args.includeAutoApproved;
      }
      if (args.inferFromToolUse !== undefined) {
        input.inferFromToolUse = args.inferFromToolUse;
      }

      const result = await getPermissionEvents(input);

      if (!result.success || !result.data) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Permission extraction error: ${result.error?.message ?? 'Unknown error'}`,
            },
          ],
          isError: true,
          _rawData: result,
        };
      }

      const output = formatToolOutput(result.data);

      return {
        content: [
          {
            type: 'text' as const,
            text: output,
          },
        ],
        _rawData: result.data,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Permission extraction failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);
