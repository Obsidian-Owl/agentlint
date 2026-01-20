/**
 * EP10 Recommendation Advisor - refine_recommendation Tool
 *
 * SDK tool definition for updating recommendation fields with audit trail.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * @module recommendations/tools/refine-recommendation
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { loadRecommendation, saveRecommendation } from '../storage';
import type { Recommendation, RecommendationEvent, Priority, RefineRecommendationInput } from '../types';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Input schema for refine_recommendation tool.
 */
const refineRecommendationInputSchema = {
  recommendationId: z.string().uuid().describe('The UUID of the recommendation to refine'),

  action: z.string().optional().describe('New action text (what to change)'),

  target: z.string().optional().describe('New target (where to make the change)'),

  priority: z
    .enum(['high', 'medium', 'low'])
    .optional()
    .describe('New priority level'),
};

// =============================================================================
// Types
// =============================================================================

interface StorageOptions {
  baseDir?: string;
}

interface RefineRecommendationResult {
  success: boolean;
  recommendation?: Recommendation;
  error?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build refinement event content with arrow format.
 * Per T041: "Action: [old] → [new]" or "Priority: [old] → [new]"
 */
function buildRefinementContent(changes: { field: string; old: string; new: string }[]): string {
  return changes.map((c) => `${c.field}: ${c.old} → ${c.new}`).join('; ');
}

/**
 * Create a refinement event.
 */
function createRefinementEvent(content: string): RecommendationEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'refinement',
    content,
  };
}

// =============================================================================
// Core Function
// =============================================================================

/**
 * Refine a recommendation by updating fields with audit trail.
 * @internal Exported for testing
 */
export async function refineRecommendation(
  input: RefineRecommendationInput,
  options: StorageOptions = {}
): Promise<RefineRecommendationResult> {
  try {
    const storageOptions = options.baseDir ? { baseDir: options.baseDir } : {};
    const recommendation = await loadRecommendation(input.recommendationId, storageOptions);

    if (!recommendation) {
      return {
        success: false,
        error: `Recommendation not found: ${input.recommendationId}`,
      };
    }

    // T042: Validate not completed
    if (recommendation.completedAt) {
      return {
        success: false,
        error: `Cannot refine completed recommendation: ${input.recommendationId}`,
      };
    }

    // Track actual changes
    const changes: { field: string; old: string; new: string }[] = [];

    // Check each field for changes
    if (input.action !== undefined && input.action !== recommendation.action) {
      changes.push({ field: 'Action', old: recommendation.action, new: input.action });
      recommendation.action = input.action;
    }

    if (input.target !== undefined && input.target !== recommendation.target) {
      changes.push({ field: 'Target', old: recommendation.target, new: input.target });
      recommendation.target = input.target;
    }

    if (input.priority !== undefined && input.priority !== recommendation.priority) {
      changes.push({ field: 'Priority', old: recommendation.priority, new: input.priority });
      recommendation.priority = input.priority as Priority;
    }

    // Only create event if there were actual changes
    if (changes.length > 0) {
      const content = buildRefinementContent(changes);
      const event = createRefinementEvent(content);
      recommendation.events.push(event);

      // Persist changes
      await saveRecommendation(recommendation, storageOptions);
    }

    return {
      success: true,
      recommendation,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to refine recommendation: ${errorMessage}`,
    };
  }
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Format the tool output for display.
 */
function formatToolOutput(result: RefineRecommendationResult): string {
  if (!result.success) {
    return `**Error**: ${result.error ?? 'Unknown error'}`;
  }

  if (!result.recommendation) {
    return '**Error**: No recommendation returned';
  }

  const rec = result.recommendation;
  const lines: string[] = [];

  lines.push(`## Recommendation Refined: ${rec.id.slice(0, 8)}...`);
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Action | ${rec.action.slice(0, 60)}${rec.action.length > 60 ? '...' : ''} |`);
  lines.push(`| Target | ${rec.target} |`);
  lines.push(`| Priority | ${rec.priority} |`);
  lines.push(`| Status | ${rec.status} |`);
  lines.push(`| Events | ${rec.events.length} |`);
  lines.push('');

  // Show most recent event
  const lastEvent = rec.events[rec.events.length - 1];
  if (lastEvent) {
    lines.push(`**Latest Event**: [${lastEvent.type}] ${lastEvent.content}`);
  }

  return lines.join('\n');
}

/**
 * refine_recommendation tool definition.
 *
 * Updates recommendation fields and creates audit trail.
 *
 * @example
 * ```typescript
 * import { refineRecommendationTool } from './recommendations/tools/refine-recommendation';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(refineRecommendationTool);
 * ```
 */
export const refineRecommendationTool = tool(
  'refine_recommendation',
  `
Refine a recommendation by updating its fields.

Updates any of these fields:
- action: What change to make (the specific recommendation)
- target: Where to make the change (file, config, etc.)
- priority: high, medium, or low

Creates a 'refinement' event with audit trail showing old → new values.

Use this tool to:
- Clarify vague recommendations with more specific actions
- Retarget recommendations to a different file or config
- Adjust priority based on new evidence or user feedback

Cannot refine completed recommendations. Use complete_recommendation to
close a recommendation, or create a new one if the original was wrong.
  `.trim(),
  refineRecommendationInputSchema,
  async (args) => {
    const input: RefineRecommendationInput = {
      recommendationId: args.recommendationId,
    };

    if (args.action !== undefined) {
      input.action = args.action;
    }
    if (args.target !== undefined) {
      input.target = args.target;
    }
    if (args.priority !== undefined) {
      input.priority = args.priority;
    }

    const result = await refineRecommendation(input);

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
