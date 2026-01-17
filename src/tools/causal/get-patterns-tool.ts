/**
 * EP07 Causal Tracing Engine - get_issue_patterns SDK Tool
 *
 * SDK tool definition for retrieving recurring issue patterns.
 * Uses the Claude Agent SDK's tool() pattern for MCP integration.
 *
 * @module tools/causal/get-patterns-tool
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import type { IssuePattern, GetPatternsOutput, GapType } from './types';
import { GapTypeSchema } from './types';
import { getPatternsByProject, getAllPatterns } from '../../persistence/causal';
import { openDatabase, closeDatabase } from '../../persistence/sessions/fts';
import { DEFAULT_SESSIONS_DB_PATH } from '../sessions/utils';
import { SYSTEMIC_THRESHOLD } from './pattern-detector';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Input schema for get_issue_patterns tool.
 */
const getPatternsInputSchema = {
  projectPath: z.string().optional().describe('Filter patterns to this project path'),
  minFrequency: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Minimum pattern frequency (default: 1)'),
  category: GapTypeSchema.optional().describe(
    'Filter by gap category (missing_guidance, missing_config, etc.)'
  ),
  systemicOnly: z
    .boolean()
    .optional()
    .describe(`Only return systemic patterns (frequency >= ${SYSTEMIC_THRESHOLD})`),
};

// =============================================================================
// Output Formatting
// =============================================================================

/**
 * Format a single pattern for display.
 */
function formatPattern(pattern: IssuePattern, index: number): string {
  const lines: string[] = [];

  lines.push(`### Pattern ${index + 1}: ${pattern.category.replace(/_/g, ' ')}`);
  lines.push('');
  lines.push(`- **ID**: \`${pattern.id}\``);
  lines.push(`- **Frequency**: ${pattern.frequency} occurrences`);
  lines.push(
    `- **Systemic**: ${pattern.isSystemic ? '⚠️ Yes' : 'No'} (threshold: ${SYSTEMIC_THRESHOLD})`
  );
  lines.push(`- **First Seen**: ${pattern.firstOccurrence}`);
  lines.push(`- **Last Seen**: ${pattern.lastOccurrence}`);
  if (pattern.projectPath) {
    lines.push(`- **Project**: ${pattern.projectPath}`);
  }
  lines.push('');
  lines.push(`**Summary**: ${pattern.summary}`);
  lines.push('');
  lines.push(`**Linked Chains**: ${pattern.chainIds.length} chain(s)`);
  if (pattern.chainIds.length <= 5) {
    for (const chainId of pattern.chainIds) {
      lines.push(`  - \`${chainId}\``);
    }
  } else {
    for (const chainId of pattern.chainIds.slice(0, 3)) {
      lines.push(`  - \`${chainId}\``);
    }
    lines.push(`  - ... and ${pattern.chainIds.length - 3} more`);
  }

  return lines.join('\n');
}

/**
 * Format patterns for tool output.
 */
function formatPatterns(patterns: IssuePattern[], totalCount: number): string {
  const lines: string[] = [];

  lines.push('## Issue Patterns\n');

  if (patterns.length === 0) {
    lines.push('No patterns found matching the criteria.\n');
    lines.push('**Tips:**');
    lines.push('- Run `trace_issue_origin` on detected issues to build causal chains');
    lines.push('- Patterns are detected when multiple chains share the same gap category');
    lines.push('- Try removing filters to see all patterns');
    return lines.join('\n');
  }

  // Summary statistics
  const systemicCount = patterns.filter((p) => p.isSystemic).length;
  lines.push(`**Found**: ${patterns.length} pattern(s)`);
  if (patterns.length < totalCount) {
    lines.push(`**Total (unfiltered)**: ${totalCount}`);
  }
  if (systemicCount > 0) {
    lines.push(
      `**Systemic Issues**: ${systemicCount} pattern(s) with ${SYSTEMIC_THRESHOLD}+ occurrences`
    );
  }
  lines.push('');

  // Category breakdown
  const byCategory = new Map<GapType, number>();
  for (const pattern of patterns) {
    byCategory.set(pattern.category, (byCategory.get(pattern.category) ?? 0) + 1);
  }
  if (byCategory.size > 1) {
    lines.push('**By Category**:');
    for (const [cat, count] of byCategory) {
      lines.push(`- ${cat.replace(/_/g, ' ')}: ${count}`);
    }
    lines.push('');
  }

  // Individual patterns
  lines.push('---\n');
  for (let i = 0; i < patterns.length; i++) {
    lines.push(formatPattern(patterns[i]!, i));
    if (i < patterns.length - 1) {
      lines.push('');
      lines.push('---\n');
    }
  }

  return lines.join('\n');
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * get_issue_patterns tool definition.
 *
 * Retrieves recurring issue patterns detected from causal chains.
 * Patterns are grouped by gap category and can be filtered.
 *
 * @example
 * ```typescript
 * import { getIssuePatternsTool } from './tools/causal/get-patterns-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(getIssuePatternsTool);
 * ```
 */
export const getIssuePatternsTool = tool(
  'get_issue_patterns',
  `Retrieve recurring issue patterns detected from causal chains.

Patterns represent categories of issues that recur across multiple sessions.
They are grouped by gap category (missing_guidance, missing_config, etc.)
and marked as systemic when they occur ${SYSTEMIC_THRESHOLD} or more times.

Use this tool to:
- Identify the most common root causes in a project
- Find systemic issues that need configuration improvements
- Track whether fixes are reducing issue frequency

Patterns are created automatically when trace_issue_origin builds causal chains.
Each pattern links back to the chains that contributed to it.

Returns patterns sorted by frequency (most common first).`,
  getPatternsInputSchema,
  // eslint-disable-next-line @typescript-eslint/require-await
  async (args) => {
    const dbPath = DEFAULT_SESSIONS_DB_PATH;

    try {
      const db = openDatabase(dbPath);
      try {
        // Fetch patterns from database
        let patterns: IssuePattern[] = args.projectPath
          ? getPatternsByProject(db, args.projectPath)
          : getAllPatterns(db);

        const totalCount = patterns.length;

        // Apply filters
        if (args.minFrequency && args.minFrequency > 1) {
          patterns = patterns.filter((p) => p.frequency >= args.minFrequency!);
        }

        if (args.category) {
          patterns = patterns.filter((p) => p.category === args.category);
        }

        if (args.systemicOnly) {
          patterns = patterns.filter((p) => p.isSystemic);
        }

        // Sort by frequency descending
        patterns.sort((a, b) => b.frequency - a.frequency);

        const output: GetPatternsOutput = {
          success: true,
          patterns,
          totalCount,
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: formatPatterns(patterns, totalCount),
            },
          ],
          _rawData: output,
        };
      } finally {
        closeDatabase(db);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      const output: GetPatternsOutput = {
        success: false,
        patterns: [],
        totalCount: 0,
        error: errorMessage,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: `## Pattern Query Error\n\n${errorMessage}\n\n**Tips:**\n- Ensure the sessions database exists\n- Run trace_issue_origin first to create causal chains`,
          },
        ],
        isError: true,
        _rawData: output,
      };
    }
  }
);
