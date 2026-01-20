/**
 * EP10 Recommendation Advisor - complete_recommendation Tool
 *
 * SDK tool definition for soft-closing recommendations with completion reason.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * @module recommendations/tools/complete-recommendation
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { loadRecommendation, saveRecommendation } from '../storage';
import type { Recommendation, RecommendationEvent, CompletionReason, CompleteRecommendationInput } from '../types';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Input schema for complete_recommendation tool.
 */
const completeRecommendationInputSchema = {
  recommendationId: z.string().uuid().describe('The UUID of the recommendation to complete'),

  reason: z
    .enum(['implemented', 'superseded', 'obsolete', 'rejected'])
    .describe('Why the recommendation case is being closed'),

  supersededBy: z
    .string()
    .uuid()
    .optional()
    .describe('ID of the replacement recommendation (when reason is superseded)'),
};

// =============================================================================
// Types
// =============================================================================

interface StorageOptions {
  baseDir?: string;
}

interface CompleteRecommendationResult {
  success: boolean;
  recommendation?: Recommendation;
  error?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Create a completed event.
 */
function createCompletedEvent(reason: CompletionReason, supersededBy?: string): RecommendationEvent {
  let content = `Completed: ${reason}`;
  if (supersededBy) {
    content += ` (superseded by ${supersededBy.slice(0, 8)}...)`;
  }

  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'completed',
    content,
  };
}

// =============================================================================
// Core Function
// =============================================================================

/**
 * Complete a recommendation with reason and optional supersededBy link.
 * @internal Exported for testing
 */
export async function completeRecommendation(
  input: CompleteRecommendationInput,
  options: StorageOptions = {}
): Promise<CompleteRecommendationResult> {
  try {
    const storageOptions = options.baseDir ? { baseDir: options.baseDir } : {};
    const recommendation = await loadRecommendation(input.recommendationId, storageOptions);

    if (!recommendation) {
      return {
        success: false,
        error: `Recommendation not found: ${input.recommendationId}`,
      };
    }

    // Reject if already completed
    if (recommendation.completedAt) {
      return {
        success: false,
        error: `Recommendation already completed: ${input.recommendationId}`,
      };
    }

    // Set completion fields
    recommendation.completedAt = new Date().toISOString();
    recommendation.completionReason = input.reason;

    if (input.supersededBy) {
      recommendation.supersededBy = input.supersededBy;
    }

    // Create completed event
    const event = createCompletedEvent(input.reason, input.supersededBy);
    recommendation.events.push(event);

    // Persist changes
    await saveRecommendation(recommendation, storageOptions);

    return {
      success: true,
      recommendation,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to complete recommendation: ${errorMessage}`,
    };
  }
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Format the tool output for display.
 */
function formatToolOutput(result: CompleteRecommendationResult): string {
  if (!result.success) {
    return `**Error**: ${result.error ?? 'Unknown error'}`;
  }

  if (!result.recommendation) {
    return '**Error**: No recommendation returned';
  }

  const rec = result.recommendation;
  const lines: string[] = [];

  lines.push(`## Recommendation Completed: ${rec.id.slice(0, 8)}...`);
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Reason | ${rec.completionReason} |`);
  lines.push(`| Completed At | ${rec.completedAt?.slice(0, 10)} |`);
  if (rec.supersededBy) {
    lines.push(`| Superseded By | ${rec.supersededBy.slice(0, 8)}... |`);
  }
  lines.push(`| Total Events | ${rec.events.length} |`);

  return lines.join('\n');
}

/**
 * complete_recommendation tool definition.
 *
 * Soft-closes a recommendation case with reason.
 *
 * @example
 * ```typescript
 * import { completeRecommendationTool } from './recommendations/tools/complete-recommendation';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(completeRecommendationTool);
 * ```
 */
export const completeRecommendationTool = tool(
  'complete_recommendation',
  `
Complete (soft-close) a recommendation case.

Completion reasons:
- implemented: The recommendation was applied successfully
- superseded: A better recommendation replaced this one
- obsolete: Changes made this recommendation irrelevant
- rejected: User decided not to implement this recommendation

When using 'superseded', provide the supersededBy parameter with the
ID of the replacement recommendation to maintain traceability.

This sets completedAt timestamp which excludes the recommendation from
default queries. Completed recommendations remain in storage for audit.

Use this tool to:
- Close implemented recommendations after monitoring
- Mark recommendations that are no longer relevant
- Record rejected recommendations with reason for future reference
  `.trim(),
  completeRecommendationInputSchema,
  async (args) => {
    const input: CompleteRecommendationInput = {
      recommendationId: args.recommendationId,
      reason: args.reason,
    };

    if (args.supersededBy !== undefined) {
      input.supersededBy = args.supersededBy;
    }

    const result = await completeRecommendation(input);

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
