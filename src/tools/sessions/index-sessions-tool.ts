/**
 * EP06 Session Analysis Tools - Index Sessions Tool
 *
 * SDK tool definition for indexing session files into the FTS database.
 * Allows the agent to refresh the session index during analysis.
 *
 * @module src/tools/sessions/index-sessions-tool
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { discoverSessions } from './discovery';
import { indexSessions, type IndexSessionsResult } from './indexer';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Input schema for index_sessions tool.
 */
const indexSessionsInputSchema = {
  projectPath: z
    .string()
    .optional()
    .describe('Filter to sessions for a specific project path. If omitted, indexes all sessions.'),

  force: z
    .boolean()
    .optional()
    .default(false)
    .describe('Force re-indexing of files even if they are unchanged.'),
};

// =============================================================================
// Types
// =============================================================================

interface IndexSessionsToolResult {
  success: boolean;
  filesIndexed: number;
  filesSkipped: number;
  entriesIndexed: number;
  durationMs: number;
  errors: Array<{ filePath: string; error: string }>;
}

// =============================================================================
// Core Function
// =============================================================================

/**
 * Index session files into the FTS database.
 * @internal Exported for testing
 */
export async function indexSessionsCore(
  projectPath?: string,
  force?: boolean
): Promise<IndexSessionsToolResult> {
  try {
    // Discover sessions to index
    const discovered = await discoverSessions({ projectPath });

    if (discovered.files.length === 0) {
      return {
        success: true,
        filesIndexed: 0,
        filesSkipped: 0,
        entriesIndexed: 0,
        durationMs: 0,
        errors: [],
      };
    }

    // Index discovered sessions
    const result: IndexSessionsResult = await indexSessions(
      discovered.files.map((f) => ({ path: f.path, projectPath: f.projectPath })),
      { force: force ?? false }
    );

    return {
      success: result.errors.length === 0,
      filesIndexed: result.filesIndexed,
      filesSkipped: result.filesSkipped,
      entriesIndexed: result.entriesIndexed,
      durationMs: result.durationMs,
      errors: result.errors,
    };
  } catch (error) {
    return {
      success: false,
      filesIndexed: 0,
      filesSkipped: 0,
      entriesIndexed: 0,
      durationMs: 0,
      errors: [{ filePath: '', error: error instanceof Error ? error.message : String(error) }],
    };
  }
}

// =============================================================================
// Tool Output Formatting
// =============================================================================

/**
 * Format the tool output for display.
 */
function formatToolOutput(result: IndexSessionsToolResult): string {
  const lines: string[] = [];

  if (!result.success) {
    lines.push('## Session Indexing Failed\n');
    for (const err of result.errors) {
      lines.push(`- ${err.filePath ? `${err.filePath}: ` : ''}${err.error}`);
    }
    return lines.join('\n');
  }

  lines.push('## Session Indexing Complete\n');
  lines.push(`**Files indexed**: ${result.filesIndexed}`);
  lines.push(`**Files skipped** (unchanged): ${result.filesSkipped}`);
  lines.push(`**Entries indexed**: ${result.entriesIndexed}`);
  lines.push(`**Duration**: ${result.durationMs}ms`);

  if (result.errors.length > 0) {
    lines.push('\n### Errors\n');
    for (const err of result.errors) {
      lines.push(`- ${err.filePath}: ${err.error}`);
    }
  }

  if (result.filesIndexed === 0 && result.filesSkipped === 0) {
    lines.push('\n*No session files found to index.*');
  }

  return lines.join('\n');
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * index_sessions tool definition.
 *
 * Indexes session log files into the FTS database for searching.
 *
 * @example
 * ```typescript
 * import { indexSessionsTool } from './tools/sessions/index-sessions-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(indexSessionsTool);
 * ```
 */
export const indexSessionsTool = tool(
  'index_sessions',
  `
Index Claude Code session log files into the search database.

Use this tool to:
- Refresh the session index to include newly created sessions
- Force re-index sessions after making changes
- Index sessions for a specific project

The session index enables full-text search across all session content,
allowing you to find patterns, issues, and insights from past sessions.

Note: Sessions are automatically indexed when running \`agentlint analyse\`,
so you typically only need this tool if you want to refresh during analysis.
  `.trim(),
  indexSessionsInputSchema,
  async (args) => {
    const result = await indexSessionsCore(args.projectPath, args.force);

    return {
      content: [
        {
          type: 'text' as const,
          text: formatToolOutput(result),
        },
      ],
      isError: !result.success,
      _rawData: result,
    };
  }
);
