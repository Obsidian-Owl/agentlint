/**
 * EP10 Recommendation Advisor - update_recommendation_status Tool
 *
 * SDK tool definition for transitioning recommendation status.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * @module recommendations/tools/update-status
 */

import { z } from 'zod';

import { adaptTool } from '../../opencode/tool-adapter';

import { loadRecommendation, saveRecommendation } from '../storage';
import type { Recommendation, RecommendationEvent, RecommendationStatus } from '../types';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Input schema for update_recommendation_status tool.
 */
const updateRecommendationStatusInputSchema = {
  recommendationId: z.string().uuid().describe('The UUID of the recommendation to update'),

  status: z
    .enum(['open', 'pending_confirmation', 'implemented', 'monitoring'])
    .describe('The new status'),
};

// =============================================================================
// Types
// =============================================================================

interface StorageOptions {
  baseDir?: string;
}

interface UpdateStatusInput {
  recommendationId: string;
  status: RecommendationStatus;
}

interface UpdateRecommendationStatusResult {
  success: boolean;
  recommendation?: Recommendation;
  error?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Create a status_change event.
 */
function createStatusChangeEvent(oldStatus: string, newStatus: string): RecommendationEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'status_change',
    content: `Status: ${oldStatus} → ${newStatus}`,
  };
}

// =============================================================================
// Core Function
// =============================================================================

/**
 * Update recommendation status with audit trail.
 * @internal Exported for testing
 */
export async function updateRecommendationStatus(
  input: UpdateStatusInput,
  options: StorageOptions = {}
): Promise<UpdateRecommendationStatusResult> {
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
        error: `Cannot update status of completed recommendation: ${input.recommendationId}`,
      };
    }

    // Check if status actually changed
    if (recommendation.status === input.status) {
      return {
        success: true,
        recommendation,
      };
    }

    const oldStatus = recommendation.status;
    recommendation.status = input.status;

    // Create status_change event
    const event = createStatusChangeEvent(oldStatus, input.status);
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
      error: `Failed to update recommendation status: ${errorMessage}`,
    };
  }
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Format the tool output for display.
 */
function formatToolOutput(result: UpdateRecommendationStatusResult): string {
  if (!result.success) {
    return `**Error**: ${result.error ?? 'Unknown error'}`;
  }

  if (!result.recommendation) {
    return '**Error**: No recommendation returned';
  }

  const rec = result.recommendation;
  const lines: string[] = [];

  lines.push(`## Status Updated: ${rec.id.slice(0, 8)}...`);
  lines.push('');
  lines.push(`**New Status**: ${rec.status}`);
  lines.push(`**Events**: ${rec.events.length}`);
  lines.push('');

  // Show most recent event
  const lastEvent = rec.events[rec.events.length - 1];
  if (lastEvent) {
    lines.push(`**Latest Event**: [${lastEvent.type}] ${lastEvent.content}`);
  }

  return lines.join('\n');
}

/**
 * update_recommendation_status tool definition.
 *
 * Transitions recommendation status with audit trail.
 *
 * @example
 * ```typescript
 * import { updateRecommendationStatusTool } from './recommendations/tools/update-status';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(updateRecommendationStatusTool);
 * ```
 */
export const updateRecommendationStatusTool = adaptTool({
  name: 'update_recommendation_status',
  description: `
Update the status of a recommendation through its lifecycle.

Status transitions:
- open: Active recommendation awaiting action
- pending_confirmation: Implementation detected, awaiting user confirmation
- implemented: User confirmed implementation
- monitoring: Tracking effectiveness post-implementation

Creates a 'status_change' event with old → new transition.

Use this tool to:
- Mark a recommendation as pending when implementation is detected
- Confirm implementation after user validation
- Move to monitoring phase for effectiveness tracking

Cannot update status of completed recommendations. Use complete_recommendation
to close a recommendation case entirely.
  `.trim(),
  schema: updateRecommendationStatusInputSchema,
  handler: async (args: unknown) => {
    const typedArgs = args as {
      recommendationId: string;
      status: string;
    };

    const result = await updateRecommendationStatus({
      recommendationId: typedArgs.recommendationId,
      status: typedArgs.status as RecommendationStatus,
    });

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
