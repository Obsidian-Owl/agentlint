/**
 * Type definitions for Recommendation Advisor Subagent
 *
 * Follows EP08 ACT subagent pattern for recommendation synthesis delegation.
 * Per ADR-0019, the subagent provides judgment while tools provide data.
 *
 * @module recommendations/subagent/types
 */

import { z } from 'zod';
import type { AgentDefinition } from '../../act/types';
import type {
  RecommendationSubagentInstructions,
  RecommendationAdvisorContext,
} from '../types';

// =============================================================================
// Tool Sets
// =============================================================================

/**
 * Default tools available to the Recommendation Advisor subagent.
 * Includes all EP10 recommendation management tools.
 *
 * Per Constitution C8: Does NOT include 'Task' (single-depth constraint).
 */
export const RECOMMENDATION_ADVISOR_TOOLS = [
  // Recommendation CRUD
  'create_recommendation',
  'get_recommendation',
  'list_recommendations',
  'get_recommendation_summary',

  // Event management
  'add_recommendation_event',

  // Status management
  'update_recommendation_status',
  'refine_recommendation',
  'complete_recommendation',
] as const;

// =============================================================================
// Validation Schema
// =============================================================================

/**
 * Zod schema for RecommendationSubagentInstructions validation.
 */
export const RecommendationSubagentInstructionsSchema = z.object({
  /** Unique identifier for the subagent */
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens')
    .min(1)
    .max(50),

  /** Human-readable name */
  displayName: z.string().min(1).max(100),

  /** When to invoke - Claude uses this for delegation decisions */
  description: z.string().min(1).max(500),

  /** Full context-engineered system prompt */
  prompt: z.string().min(1).max(51200), // 50KB limit per NFR-005

  /** Tool names this subagent can use (must NOT include 'Task') */
  tools: z
    .array(z.string())
    .min(1)
    .refine((tools) => !tools.includes('Task'), {
      message: "Subagent tools must NOT include 'Task' (single-depth constraint)",
    }),

  /** Selection priority (higher = preferred) */
  priority: z.number().int().min(1).max(100),

  /** Model override (defaults to inherit) */
  model: z.enum(['sonnet', 'opus', 'haiku', 'inherit']).optional(),
});

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Convert RecommendationSubagentInstructions to SDK AgentDefinition format.
 *
 * @param instructions - The recommendation subagent instructions
 * @returns AgentDefinition for SDK registration
 */
export function toAgentDefinition(instructions: RecommendationSubagentInstructions): AgentDefinition {
  const definition: AgentDefinition = {
    description: instructions.description,
    prompt: instructions.prompt,
    tools: [...instructions.tools],
  };

  // Only include model if not 'inherit'
  if (instructions.model && instructions.model !== 'inherit') {
    definition.model = instructions.model;
  }

  return definition;
}

// Re-export types for convenience
export type { RecommendationSubagentInstructions, RecommendationAdvisorContext };
