/**
 * EP14: Skills Effectiveness Analysis - get_skill_invocations Tool
 *
 * SDK tool definition for querying skill invocation data.
 * Returns raw data for agent reasoning about usage patterns.
 *
 * @module src/skills/tools/get-skill-invocations-tool
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { openDatabaseSync, tableExists } from '../../persistence/common/database';
import {
  querySkillInvocations,
  countSkillInvocations,
  countUniqueSkills,
  countUniqueSessions,
} from '../storage/queries';
import { skillsSchemaExists } from '../storage/schema';
import type { GetSkillInvocationsResult } from '../types';

// =============================================================================
// Constants
// =============================================================================

/** Default path to sessions database */
const DEFAULT_DB_PATH = join(homedir(), '.agentlint', 'sessions.db');

/** Default result limit */
const DEFAULT_LIMIT = 100;

/** Maximum result limit */
const MAX_LIMIT = 500;

/**
 * Input schema for get_skill_invocations tool.
 */
const getSkillInvocationsInputSchema = {
  skillName: z
    .string()
    .optional()
    .describe('Filter to a specific skill name (e.g., "commit", "test")'),
  sessionId: z.string().optional().describe('Filter to a specific session ID'),
  since: z
    .string()
    .optional()
    .describe('ISO-8601 timestamp for start of date range (e.g., "2026-01-01T00:00:00Z")'),
  until: z
    .string()
    .optional()
    .describe('ISO-8601 timestamp for end of date range (e.g., "2026-01-31T23:59:59Z")'),
  limit: z
    .number()
    .optional()
    .default(DEFAULT_LIMIT)
    .describe(
      `Maximum number of invocations to return (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT})`
    ),
  offset: z.number().optional().default(0).describe('Offset for pagination (default: 0)'),
};

/**
 * Format skill invocations for human-readable output.
 */
function formatToolOutput(result: GetSkillInvocationsResult): string {
  const lines: string[] = [];

  lines.push(`## Skill Invocations\n`);
  lines.push(`**Total Matching**: ${result.totalCount}`);
  lines.push(`**Unique Skills**: ${result.uniqueSkills}`);
  lines.push(`**Sessions Queried**: ${result.sessionsQueried}`);
  lines.push(`**Query Time**: ${result.queryTimeMs}ms`);

  // Show active filters
  const activeFilters: string[] = [];
  if (result.filters.skillName) {
    activeFilters.push(`skill="${result.filters.skillName}"`);
  }
  if (result.filters.sessionId) {
    activeFilters.push(`session="${result.filters.sessionId.slice(0, 8)}..."`);
  }
  if (result.filters.since) {
    activeFilters.push(`since=${result.filters.since}`);
  }
  if (result.filters.until) {
    activeFilters.push(`until=${result.filters.until}`);
  }
  if (activeFilters.length > 0) {
    lines.push(`**Filters**: ${activeFilters.join(', ')}`);
  }

  if (result.invocations.length === 0) {
    lines.push('\nNo skill invocations found matching criteria.');
    return lines.join('\n');
  }

  lines.push('');
  lines.push('### Recent Invocations\n');

  // Show up to 20 invocations in formatted output
  const displayInvocations = result.invocations.slice(0, 20);
  for (const inv of displayInvocations) {
    const timestamp = inv.timestamp.split('T')[0]; // Just the date part
    const prompt = inv.userPromptSnippet
      ? ` - "${inv.userPromptSnippet.slice(0, 50)}${inv.userPromptSnippet.length > 50 ? '...' : ''}"`
      : '';
    lines.push(`- **${inv.skillName}** (${timestamp})${prompt}`);
  }

  if (result.invocations.length > 20) {
    lines.push(`\n... and ${result.invocations.length - 20} more invocations`);
  }

  return lines.join('\n');
}

/**
 * get_skill_invocations tool definition.
 *
 * Retrieves skill invocation records with filtering capabilities.
 * This enables the agent to reason about:
 * - Which skills are being used and how often
 * - Usage patterns over time
 * - Context in which skills are invoked
 *
 * Per Constitution Principle VII: Returns raw data, agent reasons about patterns.
 *
 * @example
 * ```typescript
 * import { getSkillInvocationsTool } from './skills/tools/get-skill-invocations-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(getSkillInvocationsTool);
 * ```
 */
export const getSkillInvocationsTool = tool(
  'get_skill_invocations',
  `Query skill invocation records from session history.

Returns raw invocation data for reasoning about skill usage patterns:
- **skillName**: Which skill was invoked
- **sessionId**: In which session
- **timestamp**: When it happened
- **userPromptSnippet**: What the user asked (context)

Use this to analyze:
- How often specific skills are used
- Usage trends over time periods
- Which sessions involved skill usage
- Context that triggers skill invocations

Parameters:
- **skillName**: Filter to specific skill (e.g., "commit")
- **sessionId**: Filter to specific session
- **since/until**: ISO-8601 date range filters
- **limit**: Max results (default: 100, max: 500)
- **offset**: Pagination offset

Run index_skill_invocations first to ensure data is current.
The tool returns facts; the agent reasons about what they mean.`,
  getSkillInvocationsInputSchema,
  async (args) => {
    try {
      // Await to satisfy SDK's async handler requirement
      await Promise.resolve();
      const result = getSkillInvocationsImpl(
        args.skillName,
        args.sessionId,
        args.since,
        args.until,
        Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
        args.offset ?? 0
      );
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
      const result: GetSkillInvocationsResult = {
        invocations: [],
        totalCount: 0,
        uniqueSkills: 0,
        sessionsQueried: 0,
        filters: {},
        queryTimeMs: 0,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: `Error retrieving skill invocations: ${errorMessage}`,
          },
        ],
        isError: true,
        _rawData: result,
      };
    }
  }
);

/**
 * Get skill invocations from the database.
 *
 * @param skillName - Skill name filter
 * @param sessionId - Session ID filter
 * @param since - Start date filter
 * @param until - End date filter
 * @param limit - Maximum results
 * @param offset - Pagination offset
 * @returns Skill invocations result
 */
function getSkillInvocationsImpl(
  skillName: string | undefined,
  sessionId: string | undefined,
  since: string | undefined,
  until: string | undefined,
  limit: number,
  offset: number
): GetSkillInvocationsResult {
  const startTime = Date.now();

  // Build filters object only with defined values
  const filters: GetSkillInvocationsResult['filters'] = {};
  if (skillName !== undefined) {
    filters.skillName = skillName;
  }
  if (sessionId !== undefined) {
    filters.sessionId = sessionId;
  }
  if (since !== undefined) {
    filters.since = since;
  }
  if (until !== undefined) {
    filters.until = until;
  }

  // Open database
  const db = openDatabaseSync(DEFAULT_DB_PATH);

  try {
    // Check if skill_invocations table exists
    if (!tableExists(db, 'skill_invocations') || !skillsSchemaExists(db)) {
      return {
        invocations: [],
        totalCount: 0,
        uniqueSkills: 0,
        sessionsQueried: 0,
        filters,
        queryTimeMs: Date.now() - startTime,
      };
    }

    // Build query input only with defined values
    const queryInput: {
      skillName?: string;
      sessionId?: string;
      since?: string;
      until?: string;
      limit?: number;
      offset?: number;
    } = { limit, offset };

    if (skillName !== undefined) {
      queryInput.skillName = skillName;
    }
    if (sessionId !== undefined) {
      queryInput.sessionId = sessionId;
    }
    if (since !== undefined) {
      queryInput.since = since;
    }
    if (until !== undefined) {
      queryInput.until = until;
    }

    // Query invocations
    const invocations = querySkillInvocations(db, queryInput);

    // Get counts (without limit/offset for accurate totals)
    const countInput: {
      skillName?: string;
      sessionId?: string;
      since?: string;
      until?: string;
    } = {};
    if (skillName !== undefined) {
      countInput.skillName = skillName;
    }
    if (sessionId !== undefined) {
      countInput.sessionId = sessionId;
    }
    if (since !== undefined) {
      countInput.since = since;
    }
    if (until !== undefined) {
      countInput.until = until;
    }

    const totalCount = countSkillInvocations(db, countInput);
    const uniqueSkills = countUniqueSkills(db, countInput);
    const sessionsQueried = countUniqueSessions(db, countInput);

    return {
      invocations,
      totalCount,
      uniqueSkills,
      sessionsQueried,
      filters,
      queryTimeMs: Date.now() - startTime,
    };
  } finally {
    db.close();
  }
}
