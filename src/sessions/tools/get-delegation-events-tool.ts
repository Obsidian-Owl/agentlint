/**
 * EP15 Session Intelligence - get_delegation_events Tool
 *
 * SDK tool definition for extracting Task tool delegation events from sessions.
 *
 * Per Constitution Principle VII: Returns data (events, counts),
 * agent interprets whether delegation patterns indicate issues.
 *
 * @module sessions/tools/get-delegation-events-tool
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { SessionEntry } from '../../tools/sessions/types';
import type { GetDelegationEventsOutput } from '../types';
import { extractDelegationEvents, aggregateDelegations } from '../extraction/delegations';
import { parseSessionLine } from '../../tools/sessions/parser';

// =============================================================================
// Types
// =============================================================================

/**
 * Error details for delegation events extraction.
 */
export interface DelegationEventsError {
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
 * Input for getDelegationEvents function.
 */
export interface GetDelegationEventsInput {
  /** Path to session JSONL file */
  filePath: string;
  /** Filter by subagent type */
  subagentType?: string;
}

/**
 * Result from getDelegationEvents function.
 */
export interface GetDelegationEventsResult {
  /** Whether extraction succeeded */
  success: boolean;
  /** The extracted data (if success) */
  data?: GetDelegationEventsOutput;
  /** Error details (if failed) */
  error?: DelegationEventsError;
}

// =============================================================================
// Core Function
// =============================================================================

/**
 * Extract delegation events from a JSONL file.
 *
 * Parses the session file and extracts Task tool invocations:
 * - Subagent type and prompt
 * - Success/failure status
 * - Turn position
 *
 * @param input - File path and query parameters
 * @returns Delegation events extraction result
 */
export async function getDelegationEvents(
  input: GetDelegationEventsInput
): Promise<GetDelegationEventsResult> {
  const { filePath, subagentType } = input;

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
  const entries: SessionEntry[] = [];
  let sessionId = 'unknown';

  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const result = parseSessionLine(line, i + 1);
      if (result.success) {
        const entry = result.entry;
        entry.filePath = filePath;
        entry.lineNumber = i + 1;
        entries.push(entry);

        // Capture session ID from first entry
        if (entry.sessionId && sessionId === 'unknown') {
          sessionId = entry.sessionId;
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SESSION_FILE_UNREADABLE',
        message: `Failed to read session file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        suggestion: 'Check file permissions and ensure the file is valid JSONL.',
      },
    };
  }

  // Extract delegation events
  let events = extractDelegationEvents(entries, sessionId);

  // Apply filter
  if (subagentType) {
    events = events.filter((e) => e.subagentType === subagentType);
  }

  // Aggregate
  const summary = aggregateDelegations(events);

  // Get unique subagent types
  const subagentTypes = [...new Set(events.map((e) => e.subagentType))];

  return {
    success: true,
    data: {
      events,
      totalCount: events.length,
      successRate: summary.successRate,
      subagentTypes,
    },
  };
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Input schema for get_delegation_events tool.
 */
const getDelegationEventsInputSchema = {
  sessionId: z.string().describe('The session UUID to analyze'),
  filePath: z
    .string()
    .optional()
    .describe('Direct path to session JSONL file (alternative to sessionId lookup)'),
  subagentType: z
    .string()
    .optional()
    .describe('Filter by subagent type (e.g., "Explore", "Bash", "general-purpose")'),
};

/**
 * Format delegation events for tool output.
 */
function formatToolOutput(data: GetDelegationEventsOutput): string {
  const lines: string[] = [];

  lines.push(`## Delegation Events\n`);

  // Summary
  lines.push(`### Summary\n`);
  lines.push(`- **Total delegations**: ${data.totalCount}`);
  lines.push(`- **Success rate**: ${(data.successRate * 100).toFixed(0)}%`);
  lines.push(`- **Subagent types used**: ${data.subagentTypes.join(', ') || 'none'}`);
  lines.push('');

  // Events table
  lines.push(`### Delegations\n`);

  if (data.events.length === 0) {
    lines.push('*No Task tool delegations found*');
  } else {
    lines.push('| Turn | Subagent | Success | Prompt (truncated) |');
    lines.push('|------|----------|---------|-------------------|');

    for (const event of data.events) {
      const success = event.success ? '✓' : '⚠️';
      const prompt = event.taskPrompt
        ? event.taskPrompt.length > 40
          ? event.taskPrompt.slice(0, 40) + '...'
          : event.taskPrompt
        : '*no prompt*';
      lines.push(`| ${event.turnIndex} | ${event.subagentType} | ${success} | ${prompt} |`);
    }
  }
  lines.push('');

  // Failure analysis if any
  const failures = data.events.filter((e) => !e.success);
  if (failures.length > 0) {
    lines.push(`### Failed Delegations (${failures.length})\n`);
    lines.push(`*Failed delegations may indicate issues with subagent tasks.*\n`);
    for (const failure of failures) {
      lines.push(`- **${failure.subagentType}** at turn ${failure.turnIndex}`);
      if (failure.taskPrompt) {
        const truncated =
          failure.taskPrompt.length > 60
            ? failure.taskPrompt.slice(0, 60) + '...'
            : failure.taskPrompt;
        lines.push(`  > ${truncated}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * get_delegation_events tool definition.
 *
 * Extracts Task tool delegation events from a session.
 *
 * @example
 * ```typescript
 * import { getDelegationEventsTool } from './sessions/tools/get-delegation-events-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(getDelegationEventsTool);
 * ```
 */
export const getDelegationEventsTool = tool(
  'get_delegation_events',
  `Extract Task tool delegation events from a Claude Code session.

Returns:
- **Events**: Each Task tool invocation with subagent type, prompt, and success status
- **Summary**: Total count, success rate, subagent types used

Use this tool to understand how subagents were used during a session.
Delegation patterns are DATA for your interpretation:
- High failure rate might indicate task specification issues
- Many delegations to same type might indicate focused work
- Mixed types might indicate breadth of tasks

Filter options:
- \`subagentType\`: Focus on specific subagent (e.g., "Explore", "Bash")`,
  getDelegationEventsInputSchema,
  async (args) => {
    try {
      // For now, require direct file path
      // TODO: Add session ID lookup via database
      if (!args.filePath) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: filePath is required. Session ID lookup not yet implemented.',
            },
          ],
          isError: true,
        };
      }

      // Build input conditionally to satisfy exactOptionalPropertyTypes
      const input: GetDelegationEventsInput = {
        filePath: args.filePath,
      };
      if (args.subagentType !== undefined) {
        input.subagentType = args.subagentType;
      }

      const result = await getDelegationEvents(input);

      if (!result.success || !result.data) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Delegation events extraction error: ${result.error?.message ?? 'Unknown error'}`,
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
        _rawData: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Error extracting delegation events: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);
