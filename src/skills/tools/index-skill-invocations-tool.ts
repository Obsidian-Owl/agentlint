/**
 * EP14: Skills Effectiveness Analysis - index_skill_invocations Tool
 *
 * SDK tool definition for indexing skill invocations from session logs.
 * Builds the skill_invocations table for later querying.
 *
 * @module src/skills/tools/index-skill-invocations-tool
 */

import { z } from 'zod';
import { adaptTool } from '../../opencode/tool-adapter';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { openDatabaseSync, tableExists } from '../../persistence/common/database';
import { discoverSessions } from '../../tools/sessions/discovery';
import { parseSessionFile } from '../../tools/sessions/parser';
import { initializeSkillsSchema, getSkillInvocationCount } from '../storage/schema';
import { insertSkillInvocationsBatch, deleteAllSkillInvocations } from '../storage/queries';
import { detectSkillInvocations } from '../detection';
import type { IndexSkillInvocationsResult, SkillInvocationRow } from '../types';

// =============================================================================
// Constants
// =============================================================================

/** Default path to sessions database */
const DEFAULT_DB_PATH = join(homedir(), '.agentlint', 'sessions.db');

/**
 * Input schema for index_skill_invocations tool.
 */
const indexSkillInvocationsInputSchema = {
  projectPath: z.string().optional().describe('Filter to a specific project path'),
  force: z.boolean().optional().default(false).describe('Force re-index even if already indexed'),
};

/**
 * Format indexing result for human-readable output.
 */
function formatToolOutput(result: IndexSkillInvocationsResult): string {
  const lines: string[] = [];

  lines.push(`## Skill Invocations Indexing\n`);

  if (!result.success) {
    lines.push(`**Status**: Failed`);
    lines.push(`**Error**: ${result.error ?? 'Unknown error'}`);
    return lines.join('\n');
  }

  lines.push(`**Status**: Success`);
  lines.push(`**Sessions Indexed**: ${result.sessionsIndexed}`);
  lines.push(`**Invocations Found**: ${result.invocationsFound}`);
  lines.push(`**New Since Last Index**: ${result.newSinceLastIndex}`);
  lines.push(`**Indexed At**: ${result.indexedAt}`);

  return lines.join('\n');
}

/**
 * index_skill_invocations tool definition.
 *
 * Indexes skill invocations from session logs into the database.
 * This enables efficient querying of skill usage data.
 *
 * @example
 * ```typescript
 * import { indexSkillInvocationsTool } from './skills/tools/index-skill-invocations-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(indexSkillInvocationsTool);
 * ```
 */
export const indexSkillInvocationsTool = adaptTool({
  name: 'index_skill_invocations',
  description: `Index skill invocations from session logs into the database.

This tool scans Claude Code session logs and extracts Skill tool invocations,
storing them in the database for efficient querying.

Parameters:
- **projectPath**: Optional filter to a specific project
- **force**: Force re-index even if already indexed (default: false)

Returns:
- sessionsIndexed: Number of sessions processed
- invocationsFound: Total skill invocations found
- newSinceLastIndex: New invocations since last run
- indexedAt: Timestamp of indexing

Use this before querying skill invocations to ensure data is current.`,
  schema: indexSkillInvocationsInputSchema,
  handler: async (args: unknown) => {
    try {
      const typedArgs = args as { projectPath?: string; force?: boolean };
      const result = await indexSkillInvocations(typedArgs.projectPath, typedArgs.force);
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
      const result: IndexSkillInvocationsResult = {
        sessionsIndexed: 0,
        invocationsFound: 0,
        newSinceLastIndex: 0,
        indexedAt: new Date().toISOString(),
        success: false,
        error: errorMessage,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: `Error indexing skill invocations: ${errorMessage}`,
          },
        ],
        isError: true,
        _rawData: result,
      };
    }
  },
});

/**
 * Index skill invocations from session logs.
 *
 * @param projectPath - Optional filter to specific project
 * @param force - Force re-index
 * @returns Indexing result
 */
async function indexSkillInvocations(
  projectPath?: string,
  force?: boolean
): Promise<IndexSkillInvocationsResult> {
  const indexedAt = new Date().toISOString();

  // Open database
  const db = openDatabaseSync(DEFAULT_DB_PATH);

  try {
    // Ensure schema exists
    initializeSkillsSchema(db);

    // Get count before indexing
    const countBefore = getSkillInvocationCount(db);

    // If force, clear existing data
    if (force) {
      deleteAllSkillInvocations(db);
    }

    // Check if sessions table exists
    if (!tableExists(db, 'sessions')) {
      return {
        sessionsIndexed: 0,
        invocationsFound: 0,
        newSinceLastIndex: 0,
        indexedAt,
        success: true,
        error: 'No sessions table found. Run session indexing first.',
      };
    }

    // Discover session files
    const discoverOptions = projectPath ? { projectPath } : {};
    const discovery = await discoverSessions(discoverOptions);
    const sessionFiles = discovery.files;

    let sessionsIndexed = 0;
    let invocationsFound = 0;
    const allInvocations: Array<Omit<SkillInvocationRow, 'id'>> = [];

    // Process each session file
    for (const sessionFile of sessionFiles) {
      try {
        const parsed = await parseSessionFile(sessionFile.path);

        if (!parsed.entries || parsed.entries.length === 0) {
          continue;
        }

        // Detect skill invocations in this session
        const detected = detectSkillInvocations(
          parsed.entries,
          sessionFile.path, // Use file path as session ID fallback
          sessionFile.path
        );

        // Convert to database format
        for (const invocation of detected) {
          allInvocations.push({
            session_id: invocation.sessionId,
            skill_name: invocation.skillName,
            timestamp: invocation.timestamp,
            user_prompt_snippet: invocation.userPromptSnippet || null,
            file_path: invocation.filePath || null,
            line_number: invocation.lineNumber || null,
          });
        }

        sessionsIndexed++;
        invocationsFound += detected.length;
      } catch {
        // Skip problematic files
        continue;
      }
    }

    // Batch insert all invocations
    if (allInvocations.length > 0) {
      insertSkillInvocationsBatch(db, allInvocations);
    }

    // Calculate new invocations
    const countAfter = getSkillInvocationCount(db);
    const newSinceLastIndex = force ? countAfter : countAfter - countBefore;

    return {
      sessionsIndexed,
      invocationsFound,
      newSinceLastIndex,
      indexedAt,
      success: true,
    };
  } finally {
    db.close();
  }
}
