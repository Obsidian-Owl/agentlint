/**
 * EP10 Recommendation Advisor - list_recommendations Tool
 *
 * SDK tool definition for querying recommendations with filters and limits.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * @module recommendations/tools/list-recommendations
 */

import { z } from 'zod';

import { adaptTool } from '../../opencode/tool-adapter';

import { listRecommendationIds, loadRecommendation } from '../storage';
import type { Recommendation, ListRecommendationsInput } from '../types';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Input schema for list_recommendations tool.
 */
const listRecommendationsInputSchema = {
  status: z
    .enum(['open', 'pending_confirmation', 'implemented', 'monitoring'])
    .optional()
    .describe('Filter by status'),

  type: z
    .enum(['symptomatic', 'preventive', 'systemic'])
    .optional()
    .describe('Filter by recommendation type'),

  priority: z.enum(['high', 'medium', 'low']).optional().describe('Filter by priority'),

  target: z
    .string()
    .optional()
    .describe(
      'Filter by target (partial match). Use to find duplicates targeting the same file/area.'
    ),

  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .default(50)
    .describe('Maximum recommendations to return (default: 50, max: 100)'),

  includeCompleted: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to include completed recommendations (default: false for cleaner results)'),
};

// =============================================================================
// Types
// =============================================================================

interface StorageOptions {
  baseDir?: string;
}

interface ListRecommendationsResult {
  success: boolean;
  recommendations: Recommendation[];
  total: number;
  error?: string;
}

// =============================================================================
// Core Function
// =============================================================================

/**
 * List recommendations with filters.
 * @internal Exported for testing
 */
export async function listRecommendations(
  input: ListRecommendationsInput,
  options: StorageOptions = {}
): Promise<ListRecommendationsResult> {
  try {
    const storageOptions = options.baseDir ? { baseDir: options.baseDir } : {};
    const ids = listRecommendationIds(storageOptions);

    if (ids.length === 0) {
      return {
        success: true,
        recommendations: [],
        total: 0,
      };
    }

    // Load all recommendations
    const allRecommendations: Recommendation[] = [];
    for (const id of ids) {
      const rec = await loadRecommendation(id, storageOptions);
      if (rec) {
        allRecommendations.push(rec);
      }
    }

    // Apply filters
    let filtered = allRecommendations;

    // Filter by status
    if (input.status) {
      filtered = filtered.filter((r) => r.status === input.status);
    }

    // Filter by type
    if (input.type) {
      filtered = filtered.filter((r) => r.type === input.type);
    }

    // Filter by priority
    if (input.priority) {
      filtered = filtered.filter((r) => r.priority === input.priority);
    }

    // Filter by target (partial match, case-insensitive) - AGE-674
    if (input.target) {
      const targetLower = input.target.toLowerCase();
      filtered = filtered.filter((r) => r.target.toLowerCase().includes(targetLower));
    }

    // Filter out completed unless requested
    if (input.includeCompleted === false) {
      filtered = filtered.filter((r) => !r.completedAt);
    }

    // Sort by createdAt descending (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply limit
    const limit = input.limit ?? 50;
    const limited = filtered.slice(0, limit);

    return {
      success: true,
      recommendations: limited,
      total: filtered.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      recommendations: [],
      total: 0,
      error: `Failed to list recommendations: ${errorMessage}`,
    };
  }
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Format the tool output for display.
 */
function formatToolOutput(result: ListRecommendationsResult): string {
  if (!result.success) {
    return `**Error**: ${result.error ?? 'Unknown error'}`;
  }

  const lines: string[] = [];

  lines.push(`## Recommendations (${result.recommendations.length} of ${result.total})\n`);

  if (result.recommendations.length === 0) {
    lines.push('No recommendations found matching the filters.');
    return lines.join('\n');
  }

  for (const rec of result.recommendations) {
    lines.push(`### ${rec.id.slice(0, 8)}... | ${rec.type} | ${rec.priority}`);
    lines.push(`- **Status**: ${rec.status}`);
    lines.push(`- **Target**: ${rec.target}`);
    lines.push(`- **Action**: ${rec.action.slice(0, 100)}${rec.action.length > 100 ? '...' : ''}`);
    lines.push(`- **Events**: ${rec.events.length}`);
    lines.push(`- **Created**: ${rec.createdAt.slice(0, 10)}`);
    lines.push('');
  }

  if (result.recommendations.length < result.total) {
    lines.push(`---`);
    lines.push(
      `Showing ${result.recommendations.length} of ${result.total} total. Use limit parameter to see more.`
    );
  }

  return lines.join('\n');
}

/**
 * list_recommendations tool definition.
 *
 * Queries recommendations with optional filters.
 *
 * @example
 * ```typescript
 * import { listRecommendationsTool } from './recommendations/tools/list-recommendations';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(listRecommendationsTool);
 * ```
 */
export const listRecommendationsTool = adaptTool({
  name: 'list_recommendations',
  description: `
List recommendations with optional filters.

Use this tool to:
- Query all open recommendations
- Filter by status, type, priority, or target
- Check for existing recommendations before creating new ones
- Find recommendations targeting the same file/area

Filters:
- status: open, pending_confirmation, implemented, monitoring
- type: symptomatic, preventive, systemic
- priority: high, medium, low
- target: partial match on target field (e.g., "CLAUDE.md")

By default, completed recommendations are excluded. Set includeCompleted: true to see them.
Results are sorted newest-first. Use limit to control how many are returned.

**Example: Finding related recommendations**
Before creating a recommendation for "CLAUDE.md", use:
  list_recommendations({ target: "CLAUDE.md" })
This reveals if similar recommendations already exist. If so, consider:
- Adding an observation to the existing recommendation (add_recommendation_event)
- Refining the existing recommendation (refine_recommendation)
- Creating new only if truly distinct

Use get_recommendation for full details of a specific recommendation.
Use get_recommendation_summary for a compressed view.
  `.trim(),
  schema: listRecommendationsInputSchema,
  handler: async (args: unknown) => {
    const typedArgs = args as {
      status?: string;
      type?: string;
      priority?: string;
      target?: string;
      limit?: number;
      includeCompleted?: boolean;
    };

    const input: ListRecommendationsInput = {};

    // Add optional fields only if defined
    if (typedArgs.status !== undefined && typedArgs.status !== null) {
      input.status = typedArgs.status as
        | 'open'
        | 'pending_confirmation'
        | 'implemented'
        | 'monitoring';
    }
    if (typedArgs.type !== undefined && typedArgs.type !== null) {
      input.type = typedArgs.type as 'symptomatic' | 'preventive' | 'systemic';
    }
    if (typedArgs.priority !== undefined && typedArgs.priority !== null) {
      input.priority = typedArgs.priority as 'high' | 'medium' | 'low';
    }
    if (typedArgs.target !== undefined) {
      input.target = typedArgs.target;
    }
    if (typedArgs.limit !== undefined) {
      input.limit = typedArgs.limit;
    }
    if (typedArgs.includeCompleted !== undefined) {
      input.includeCompleted = typedArgs.includeCompleted;
    }

    const result = await listRecommendations(input);

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
  },
});
