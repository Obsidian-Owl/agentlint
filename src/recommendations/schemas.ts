/**
 * EP10 Recommendation Advisor - Zod Validation Schemas
 *
 * Runtime validation schemas for the recommendation system.
 * Type definitions are in types.ts.
 *
 * @module recommendations/schemas
 */

import { z } from 'zod';

// =============================================================================
// Enum Schemas
// =============================================================================

export const RecommendationTypeSchema = z.enum(['symptomatic', 'preventive', 'systemic']);

export const RecommendationStatusSchema = z.enum([
  'open',
  'pending_confirmation',
  'implemented',
  'monitoring',
]);

export const CompletionReasonSchema = z.enum([
  'implemented',
  'superseded',
  'obsolete',
  'rejected',
]);

export const EventTypeSchema = z.enum([
  'created',
  'observation',
  'refinement',
  'user_feedback',
  'evidence',
  'implementation_signal',
  'status_change',
  'completed',
]);

export const PrioritySchema = z.enum(['high', 'medium', 'low']);

// =============================================================================
// Core Entity Schemas
// =============================================================================

/**
 * Schema for TracedOrigin - requires at least one field.
 */
export const TracedOriginSchema = z
  .object({
    findingId: z.string().uuid().optional(),
    sessionId: z.string().optional(),
    configGap: z.string().max(500).optional(),
    pattern: z.string().max(500).optional(),
  })
  .refine((data) => data.findingId || data.sessionId || data.configGap || data.pattern, {
    message: 'At least one traced origin field must be provided',
  });

/**
 * Schema for RecommendationEvent - content limited to 200 chars.
 */
export const RecommendationEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  type: EventTypeSchema,
  content: z.string().max(200, 'Event content must be ≤ 200 characters'),
  baselineId: z.string().uuid().optional(),
  sessionId: z.string().optional(),
  commitHash: z.string().optional(),
});

/**
 * Schema for full Recommendation entity.
 */
export const RecommendationSchema = z.object({
  id: z.string().uuid(),
  projectPath: z.string(),
  createdAt: z.string().datetime(),
  type: RecommendationTypeSchema,
  action: z.string().min(1).max(1000),
  target: z.string().min(1).max(500),
  rationale: z.string().min(1).max(2000),
  priority: PrioritySchema,
  tracedOrigin: TracedOriginSchema,
  status: RecommendationStatusSchema,
  events: z.array(RecommendationEventSchema).min(1),
  completedAt: z.string().datetime().optional(),
  completionReason: CompletionReasonSchema.optional(),
  supersededBy: z.string().uuid().optional(),
});

// =============================================================================
// Summary Schemas
// =============================================================================

export const MilestonesSchema = z.object({
  created: z.string().datetime(),
  firstEvidence: z.string().datetime().optional(),
  implemented: z.string().datetime().optional(),
  completed: z.string().datetime().optional(),
});

export const RecommendationSummarySchema = z.object({
  id: z.string().uuid(),
  type: RecommendationTypeSchema,
  status: RecommendationStatusSchema,
  actionSummary: z.string().max(100),
  target: z.string(),
  priority: PrioritySchema,
  eventCount: z.number().int().nonnegative(),
  lastEventAt: z.string().datetime(),
  lastEventType: EventTypeSchema,
  recentActivity: z.string(),
  milestones: MilestonesSchema,
});

// =============================================================================
// Interaction Schemas
// =============================================================================

export const QuestionOptionSchema = z.object({
  label: z.string(),
  description: z.string(),
});

export const ClarifyingQuestionSchema = z.object({
  question: z.string(),
  options: z.array(QuestionOptionSchema).optional(),
  context: z.string(),
  defaultAnswer: z.string().optional(),
});

export const AdvisorOutputSchema = z.object({
  recommendations: z.array(RecommendationSchema),
  clarifyingQuestions: z.array(ClarifyingQuestionSchema).optional(),
  assumptions: z.array(z.string()).optional(),
});

// =============================================================================
// Storage Schemas
// =============================================================================

export const RecommendationFileSchema = z.object({
  version: z.string(),
  recommendation: RecommendationSchema,
});

// =============================================================================
// Tool Input Schemas
// =============================================================================

/**
 * Input for create_recommendation tool.
 */
export const CreateRecommendationInputSchema = z.object({
  type: RecommendationTypeSchema,
  action: z.string().min(1).max(1000),
  target: z.string().min(1).max(500),
  rationale: z.string().min(1).max(2000),
  priority: PrioritySchema,
  tracedOrigin: TracedOriginSchema,
});

/**
 * Input for add_recommendation_event tool.
 * Note: 'created' and 'completed' types are system-generated only.
 */
export const AddEventInputSchema = z.object({
  recommendationId: z.string().uuid(),
  type: z.enum([
    'observation',
    'refinement',
    'user_feedback',
    'evidence',
    'implementation_signal',
    'status_change',
  ]), // 'created' and 'completed' are system-generated
  content: z.string().max(200, 'Event content must be ≤ 200 characters'),
  baselineId: z.string().uuid().optional(),
  sessionId: z.string().optional(),
  commitHash: z.string().optional(),
});

/**
 * Input for list_recommendations tool.
 */
export const ListRecommendationsInputSchema = z.object({
  status: RecommendationStatusSchema.optional(),
  type: RecommendationTypeSchema.optional(),
  priority: PrioritySchema.optional(),
  limit: z.number().int().positive().max(100).optional(),
  includeCompleted: z.boolean().optional(),
});

/**
 * Input for refine_recommendation tool.
 */
export const RefineRecommendationInputSchema = z.object({
  recommendationId: z.string().uuid(),
  action: z.string().min(1).max(1000).optional(),
  target: z.string().min(1).max(500).optional(),
  priority: PrioritySchema.optional(),
});

/**
 * Input for complete_recommendation tool.
 */
export const CompleteRecommendationInputSchema = z.object({
  recommendationId: z.string().uuid(),
  reason: CompletionReasonSchema,
  supersededBy: z.string().uuid().optional(),
});

/**
 * Input for update_recommendation_status tool.
 */
export const UpdateStatusInputSchema = z.object({
  recommendationId: z.string().uuid(),
  status: RecommendationStatusSchema,
});

/**
 * Input for spawn_recommendation_advisor tool.
 */
export const SpawnAdvisorInputSchema = z.object({
  findings: z.array(z.unknown()),
  causalTraces: z.array(z.unknown()).optional(),
  includeHistoricRecs: z.boolean().optional(),
  interactionMode: z.enum(['ask', 'propose', 'confirm']).optional(),
});

// =============================================================================
// Subagent Schemas
// =============================================================================

export const RecommendationAdvisorContextSchema = z.object({
  focus: z.enum(['config', 'workflow', 'prevention', 'comprehensive']).optional(),
  query: z.string().optional(),
  projectPath: z.string().optional(),
  historicRecCount: z.number().int().nonnegative(),
  recentRecSummary: z.string().optional(),
  findingCount: z.number().int().nonnegative(),
  causalTraceCount: z.number().int().nonnegative(),
  interactionMode: z.enum(['ask', 'propose', 'confirm']),
});

export const RecommendationSubagentInstructionsSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  description: z.string(),
  prompt: z.string(),
  tools: z.array(z.string()),
  priority: z.number(),
  model: z.enum(['sonnet', 'opus', 'haiku', 'inherit']).optional(),
});
