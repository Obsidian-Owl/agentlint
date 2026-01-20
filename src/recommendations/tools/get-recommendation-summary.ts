/**
 * EP10 Recommendation Advisor - get_recommendation_summary Tool
 *
 * SDK tool definition for retrieving a compressed summary of a recommendation.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * @module recommendations/tools/get-recommendation-summary
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { loadRecommendation } from '../storage';
import { compressRecommendation } from '../storage/compression';
import type { RecommendationSummary } from '../types';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Input schema for get_recommendation_summary tool.
 */
const getRecommendationSummaryInputSchema = {
  recommendationId: z.string().uuid().describe('The UUID of the recommendation to summarize'),
};

// =============================================================================
// Types
// =============================================================================

interface StorageOptions {
  baseDir?: string;
}

interface GetRecommendationSummaryResult {
  success: boolean;
  summary?: RecommendationSummary;
  error?: string;
}

// =============================================================================
// Core Function
// =============================================================================

/**
 * Get a compressed summary of a recommendation.
 * @internal Exported for testing
 */
export async function getRecommendationSummary(
  recommendationId: string,
  options: StorageOptions = {}
): Promise<GetRecommendationSummaryResult> {
  try {
    const storageOptions = options.baseDir ? { baseDir: options.baseDir } : {};
    const recommendation = await loadRecommendation(recommendationId, storageOptions);

    if (!recommendation) {
      return {
        success: false,
        error: `Recommendation not found: ${recommendationId}`,
      };
    }

    const summary = compressRecommendation(recommendation);

    return {
      success: true,
      summary,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to get recommendation summary: ${errorMessage}`,
    };
  }
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Format the tool output for display.
 */
function formatToolOutput(result: GetRecommendationSummaryResult): string {
  if (!result.success) {
    return `**Error**: ${result.error ?? 'Unknown error'}`;
  }

  if (!result.summary) {
    return '**Error**: No summary available';
  }

  const s = result.summary;
  const lines: string[] = [];

  lines.push(`## Recommendation Summary: ${s.id.slice(0, 8)}...`);
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Type | ${s.type} |`);
  lines.push(`| Status | ${s.status} |`);
  lines.push(`| Priority | ${s.priority} |`);
  lines.push(`| Target | ${s.target} |`);
  lines.push(`| Events | ${s.eventCount} |`);
  lines.push(`| Last Event | ${s.lastEventType} at ${s.lastEventAt.slice(0, 10)} |`);
  lines.push('');
  lines.push(`**Action**: ${s.actionSummary}`);
  lines.push('');
  lines.push('**Recent Activity**:');
  lines.push(s.recentActivity || 'No activity');
  lines.push('');
  lines.push('**Milestones**:');
  lines.push(`- Created: ${s.milestones.created.slice(0, 10)}`);
  if (s.milestones.firstEvidence) {
    lines.push(`- First Evidence: ${s.milestones.firstEvidence.slice(0, 10)}`);
  }
  if (s.milestones.implemented) {
    lines.push(`- Implemented: ${s.milestones.implemented.slice(0, 10)}`);
  }
  if (s.milestones.completed) {
    lines.push(`- Completed: ${s.milestones.completed.slice(0, 10)}`);
  }

  return lines.join('\n');
}

/**
 * get_recommendation_summary tool definition.
 *
 * Retrieves a compressed summary of a recommendation.
 * Use this for quick context loading instead of full recommendation.
 *
 * @example
 * ```typescript
 * import { getRecommendationSummaryTool } from './recommendations/tools/get-recommendation-summary';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(getRecommendationSummaryTool);
 * ```
 */
export const getRecommendationSummaryTool = tool(
  'get_recommendation_summary',
  `
Get a compressed summary of a recommendation for efficient context loading.

Returns a summary view with:
- Core fields: type, status, priority, target
- Compressed action (max 100 chars)
- Event count and recent activity
- Key milestones (created, first evidence, implemented, completed)

Use this tool to:
- Quickly check a recommendation's current state
- Load multiple recommendations efficiently within token budget
- Get an overview before deciding to load full details

Use get_recommendation for full details including all events and rationale.
  `.trim(),
  getRecommendationSummaryInputSchema,
  async (args) => {
    const result = await getRecommendationSummary(args.recommendationId);

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
