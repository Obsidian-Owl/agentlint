/**
 * EP09 Temporal Analysis - list_baselines Tool
 *
 * SDK tool definition for listing available baseline snapshots with filtering.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * @module temporal/tools/list-baselines
 */

import { z } from 'zod';

import { adaptTool } from '../../opencode/tool-adapter';

import { initBaselineSchema, getIndexedBaselines } from '../../persistence/baselines/indexer';
import type { BaselineSummary } from '../../persistence/types';
import { TOOL_DESCRIPTIONS } from './descriptions';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Input schema for list_baselines tool.
 * Matches ListBaselinesInputSchema from contracts/temporal-tools.ts
 */
const listBaselinesInputSchema = {
  limit: z.number().optional().default(20).describe('Maximum number of baselines to return'),
  after: z.string().optional().describe('Only return baselines after this ISO-8601 date'),
  before: z.string().optional().describe('Only return baselines before this ISO-8601 date'),
  label: z.string().optional().describe('Filter by label (exact match)'),
  orderBy: z
    .enum(['createdAt', 'findingsCount'])
    .optional()
    .default('createdAt')
    .describe('Sort field'),
  order: z.enum(['asc', 'desc']).optional().default('desc').describe('Sort direction'),
};

// =============================================================================
// Types
// =============================================================================

/**
 * Single baseline entry in list result.
 */
interface BaselineListEntry {
  id: string;
  createdAt: string;
  label?: string;
  gitCommit?: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
}

/**
 * Result from list_baselines tool.
 */
interface ListBaselinesResult {
  baselines: BaselineListEntry[];
  total: number;
  hasMore: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert a BaselineSummary to a list entry.
 */
function toListEntry(summary: BaselineSummary): BaselineListEntry {
  const entry: BaselineListEntry = {
    id: summary.id,
    createdAt: summary.createdAt,
    findingsCount: summary.metrics.findingsCount,
    criticalCount: summary.metrics.criticalCount,
    highCount: summary.metrics.highCount,
  };

  if (summary.label) {
    entry.label = summary.label;
  }
  if (summary.gitCommit) {
    entry.gitCommit = summary.gitCommit;
  }

  return entry;
}

/**
 * Format the list result for human-readable output.
 */
function formatToolOutput(result: ListBaselinesResult): string {
  const lines: string[] = [];

  if (result.baselines.length === 0) {
    lines.push('## No Baselines Found\n');
    lines.push('Use `store_baseline` to capture your first baseline snapshot.');
    return lines.join('\n');
  }

  lines.push(`## Baselines (${result.total} total)\n`);

  for (const baseline of result.baselines) {
    let line = `- **${baseline.id.slice(0, 8)}...** `;
    line += `(${formatDate(baseline.createdAt)})`;

    if (baseline.label) {
      line += ` [${baseline.label}]`;
    }

    // Add severity indicators
    const severities: string[] = [];
    if (baseline.criticalCount > 0) {
      severities.push(`🔴 ${baseline.criticalCount}`);
    }
    if (baseline.highCount > 0) {
      severities.push(`🟠 ${baseline.highCount}`);
    }
    if (baseline.findingsCount > 0 && severities.length === 0) {
      severities.push(`📋 ${baseline.findingsCount} findings`);
    }

    if (severities.length > 0) {
      line += ` ${severities.join(' ')}`;
    }

    if (baseline.gitCommit) {
      line += ` @ ${baseline.gitCommit.slice(0, 7)}`;
    }

    lines.push(line);
  }

  if (result.hasMore) {
    lines.push(
      `\n*... and ${result.total - result.baselines.length} more. Use 'limit' to see more.*`
    );
  }

  return lines.join('\n');
}

/**
 * Format a date string for display.
 */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * list_baselines tool definition.
 *
 * Lists available baseline snapshots with filtering and sorting options.
 *
 * @example
 * ```typescript
 * import { listBaselinesTool } from './temporal/tools/list-baselines';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(listBaselinesTool);
 * ```
 */
export const listBaselinesTool = adaptTool({
  name: 'list_baselines',
  description: TOOL_DESCRIPTIONS.list_baselines,
  schema: listBaselinesInputSchema,
  handler: async (args: unknown) => {
    const typedArgs = args as {
      limit?: number;
      after?: string;
      before?: string;
      label?: string;
      orderBy?: 'createdAt' | 'findingsCount';
      order?: 'asc' | 'desc';
    };
    try {
      // Open the database
      const db = await initBaselineSchema();

      try {
        // Query baselines with filters
        // Request one more than limit to check for hasMore
        const limit = typedArgs.limit ?? 20;
        const requestLimit = limit + 1;

        // Build query options, only including defined properties
        const queryOptions: Parameters<typeof getIndexedBaselines>[1] = {
          orderBy: typedArgs.orderBy ?? 'createdAt',
          order: typedArgs.order ?? 'desc',
          limit: requestLimit,
        };

        // Only add optional filters if they have values
        if (typedArgs.after !== undefined) {
          queryOptions.after = typedArgs.after;
        }
        if (typedArgs.before !== undefined) {
          queryOptions.before = typedArgs.before;
        }
        if (typedArgs.label !== undefined) {
          queryOptions.label = typedArgs.label;
        }

        const summaries = getIndexedBaselines(db, queryOptions);

        // Determine if there are more results
        const hasMore = summaries.length > limit;
        const displaySummaries = hasMore ? summaries.slice(0, limit) : summaries;

        // Count total (approximate if hasMore)
        const total = hasMore ? summaries.length : displaySummaries.length;

        // Convert to list entries
        const baselines = displaySummaries.map(toListEntry);

        const result: ListBaselinesResult = {
          baselines,
          total,
          hasMore,
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: formatToolOutput(result),
            },
          ],
          _rawData: result,
        };
      } finally {
        db.close();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error listing baselines: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  },
});
