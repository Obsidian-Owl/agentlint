/**
 * EP14: Skills Effectiveness Analysis - get_session_summaries Tool
 *
 * SDK tool definition for querying session summaries with skills context.
 * Returns data for agent reasoning about missed skill opportunities.
 *
 * @module src/skills/tools/get-session-summaries-tool
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { openDatabaseSync, tableExists } from '../../persistence/common/database';
import { querySessionSummaries } from '../storage/queries';
import type { GetSessionSummariesResult, SessionSummary } from '../types';

// =============================================================================
// Constants
// =============================================================================

/** Default path to sessions database */
const DEFAULT_DB_PATH = join(homedir(), '.agentlint', 'sessions.db');

/**
 * Input schema for get_session_summaries tool.
 */
const getSessionSummariesInputSchema = {
  since: z
    .string()
    .optional()
    .describe('ISO-8601 timestamp for start of date range (e.g., "2026-01-01T00:00:00Z")'),
  until: z
    .string()
    .optional()
    .describe('ISO-8601 timestamp for end of date range (e.g., "2026-01-31T23:59:59Z")'),
  projectPath: z.string().optional().describe('Filter to sessions from a specific project path'),
  limit: z
    .number()
    .optional()
    .default(50)
    .describe('Maximum number of sessions to return (default: 50)'),
};

/**
 * Format session summaries for human-readable output.
 */
function formatToolOutput(result: GetSessionSummariesResult): string {
  const lines: string[] = [];

  lines.push(`## Session Summaries\n`);
  lines.push(`**Sessions Found**: ${result.totalSessions}`);
  lines.push(`**Query Time**: ${result.queryTimeMs}ms`);

  if (result.totalSessions === 0) {
    lines.push('\nNo sessions found matching criteria.');
    return lines.join('\n');
  }

  lines.push('');

  for (const session of result.sessions) {
    lines.push(`### Session ${session.sessionId.slice(0, 8)}...`);
    lines.push(`- **Timestamp**: ${session.timestamp}`);
    lines.push(`- **Turns**: ${session.turnCount}`);

    if (session.firstUserPrompt) {
      const truncatedPrompt =
        session.firstUserPrompt.length > 100
          ? session.firstUserPrompt.slice(0, 100) + '...'
          : session.firstUserPrompt;
      lines.push(`- **First Prompt**: "${truncatedPrompt}"`);
    }

    if (session.filesOperated.length > 0) {
      const displayFiles =
        session.filesOperated.length > 5
          ? [
              ...session.filesOperated.slice(0, 5),
              `... and ${session.filesOperated.length - 5} more`,
            ]
          : session.filesOperated;
      lines.push(`- **Files**: ${displayFiles.join(', ')}`);
    }

    if (session.skillsInvoked.length > 0) {
      lines.push(`- **Skills Used**: ${session.skillsInvoked.join(', ')}`);
    } else {
      lines.push(`- **Skills Used**: (none)`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * get_session_summaries tool definition.
 *
 * Retrieves session summaries with context for skill effectiveness analysis.
 * This enables the agent to reason about patterns like:
 * - Sessions where skills could have been used but weren't
 * - Correlation between task types and skill usage
 * - File patterns that suggest specific skill opportunities
 *
 * Per Constitution Principle VII: Returns raw data, agent reasons about effectiveness.
 *
 * @example
 * ```typescript
 * import { getSessionSummariesTool } from './skills/tools/get-session-summaries-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(getSessionSummariesTool);
 * ```
 */
export const getSessionSummariesTool = tool(
  'get_session_summaries',
  `Retrieve session summaries with skills context for effectiveness analysis.

Returns session data that enables reasoning about skill usage patterns:
- **firstUserPrompt**: What the user asked for (truncated to 500 chars)
- **filesOperated**: Files touched via Read/Write/Edit tools
- **skillsInvoked**: Which skills were actually used
- **turnCount**: Session length indicator

Use this to analyze patterns like:
- Sessions with many file operations but no skills used
- Tasks where certain skills would have been helpful
- Correlation between prompt types and skill adoption

Parameters:
- **since**: ISO-8601 start date (e.g., "2026-01-01T00:00:00Z")
- **until**: ISO-8601 end date
- **projectPath**: Filter to specific project
- **limit**: Max sessions to return (default: 50)

The tool returns facts; the agent reasons about what they mean.`,
  getSessionSummariesInputSchema,
  async (args) => {
    try {
      // Await to satisfy SDK's async handler requirement
      await Promise.resolve();
      const result = getSessionSummariesImpl(args.since, args.until, args.projectPath, args.limit);
      const output = formatToolOutput(result);

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
      const result: GetSessionSummariesResult = {
        sessions: [],
        totalSessions: 0,
        filters: {},
        queryTimeMs: 0,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: `Error retrieving session summaries: ${errorMessage}`,
          },
        ],
        isError: true,
        _rawData: result,
      };
    }
  }
);

/**
 * Get session summaries from the database.
 *
 * @param since - Start date filter
 * @param until - End date filter
 * @param projectPath - Project path filter
 * @param limit - Maximum results
 * @returns Session summaries result
 */
function getSessionSummariesImpl(
  since: string | undefined,
  until: string | undefined,
  projectPath: string | undefined,
  limit: number | undefined
): GetSessionSummariesResult {
  const startTime = Date.now();

  // Build filters object only with defined values
  const filters: GetSessionSummariesResult['filters'] = {};
  if (since !== undefined) {
    filters.since = since;
  }
  if (until !== undefined) {
    filters.until = until;
  }
  if (projectPath !== undefined) {
    filters.projectPath = projectPath;
  }

  // Open database
  const db = openDatabaseSync(DEFAULT_DB_PATH);

  try {
    // Check if sessions table exists
    if (!tableExists(db, 'sessions')) {
      return {
        sessions: [],
        totalSessions: 0,
        filters,
        queryTimeMs: Date.now() - startTime,
      };
    }

    // Build query input only with defined values
    const queryInput: {
      since?: string;
      until?: string;
      projectPath?: string;
      limit?: number;
    } = {};
    if (since !== undefined) {
      queryInput.since = since;
    }
    if (until !== undefined) {
      queryInput.until = until;
    }
    if (projectPath !== undefined) {
      queryInput.projectPath = projectPath;
    }
    if (limit !== undefined) {
      queryInput.limit = limit;
    }

    // Query session summaries
    const sessions: SessionSummary[] = querySessionSummaries(db, queryInput);

    return {
      sessions,
      totalSessions: sessions.length,
      filters,
      queryTimeMs: Date.now() - startTime,
    };
  } finally {
    db.close();
  }
}
