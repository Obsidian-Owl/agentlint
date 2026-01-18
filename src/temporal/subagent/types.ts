/**
 * Type definitions for Temporal Analyzer Subagent
 *
 * Follows EP08 ACT subagent pattern for temporal analysis delegation.
 * Per ADR-0019, the subagent provides judgment while tools provide data.
 *
 * @module temporal/subagent/types
 */

import { z } from 'zod';
import type { AgentDefinition } from '../../act/types';

// =============================================================================
// Tool Sets
// =============================================================================

/**
 * Default tools available to the Temporal Analyzer subagent.
 * Includes all EP09 temporal analysis tools.
 */
export const TEMPORAL_SUBAGENT_TOOLS = [
  // Baseline management
  'store_baseline',
  'query_baseline',
  'list_baselines',

  // Delta and trends
  'calculate_delta',
  'query_trends',

  // Qualitative reviews
  'conduct_review',
  'get_review_history',
] as const;

/**
 * Read-only tools for trend analysis (no state mutation).
 * Used when subagent is invoked for analysis only.
 */
export const TEMPORAL_READONLY_TOOLS = [
  'query_baseline',
  'list_baselines',
  'calculate_delta',
  'query_trends',
  'get_review_history',
] as const;

// =============================================================================
// Subagent Types
// =============================================================================

/**
 * Context provided to the temporal analyzer subagent.
 * Per ADR-0019, this is data for agent judgment, not instructions.
 */
export interface TemporalAnalysisContext {
  /** Current project path */
  projectPath: string;

  /** Whether baseline history exists */
  hasBaselines: boolean;

  /** Number of baselines available */
  baselineCount: number;

  /** Whether qualitative reviews exist */
  hasReviews: boolean;

  /** Number of reviews available */
  reviewCount: number;

  /** Days since last review (null if no reviews) */
  daysSinceLastReview: number | null;

  /** Whether triggers are suggesting a review */
  reviewTriggered: boolean;

  /** Summary of trigger reasons (if any) */
  triggerSummary?: string;
}

/**
 * Zod schema for TemporalSubagentInstructions validation.
 */
export const TemporalSubagentInstructionsSchema = z.object({
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
  prompt: z.string().min(1).max(51200), // 50KB limit per NFR-002

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

/**
 * Instructions for the temporal analyzer subagent.
 */
export type TemporalSubagentInstructions = z.infer<typeof TemporalSubagentInstructionsSchema>;

/**
 * Result from temporal analysis subagent.
 * Per ADR-0019, this contains agent judgment, not just data.
 */
export interface TemporalAnalysisResult {
  /** Whether analysis was successful */
  success: boolean;

  /** Summary of findings (agent interpretation) */
  summary: string;

  /** Identified trends with agent's interpretation */
  trends?: {
    /** Metric or dimension name */
    name: string;
    /** Agent's interpretation of the trend */
    interpretation: string;
    /** Confidence in interpretation (agent judgment) */
    confidence: 'high' | 'medium' | 'low';
  }[];

  /** Recommendations from agent analysis */
  recommendations?: {
    /** What action to take */
    action: string;
    /** Why this is recommended (agent reasoning) */
    rationale: string;
    /** Priority of the recommendation */
    priority: 'high' | 'medium' | 'low';
  }[];

  /** Whether a qualitative review is recommended */
  reviewRecommended: boolean;

  /** Reason for review recommendation (if any) */
  reviewReason?: string;

  /** Error message if analysis failed */
  error?: string;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Convert TemporalSubagentInstructions to SDK AgentDefinition format.
 *
 * @param instructions - The temporal subagent instructions
 * @returns AgentDefinition for SDK registration
 */
export function toAgentDefinition(instructions: TemporalSubagentInstructions): AgentDefinition {
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
