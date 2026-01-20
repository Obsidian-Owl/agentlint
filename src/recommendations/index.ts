/**
 * EP10 Recommendation Advisor Module
 *
 * Synthesizes actionable recommendations from analysis findings through a
 * reasoning-heavy subagent. Maintains case-based state management with
 * append-only event logs for recommendations that evolve over time.
 *
 * @module recommendations
 */

// =============================================================================
// Types
// =============================================================================

export type {
  RecommendationType,
  RecommendationStatus,
  CompletionReason,
  EventType,
  Priority,
  TracedOrigin,
  RecommendationEvent,
  Recommendation,
  Milestones,
  RecommendationSummary,
  QuestionOption,
  ClarifyingQuestion,
  AdvisorOutput,
  RecommendationFile,
  CreateRecommendationInput,
  AddEventInput,
  ListRecommendationsInput,
  RefineRecommendationInput,
  CompleteRecommendationInput,
  SpawnAdvisorInput,
  RecommendationAdvisorContext,
} from './types';

// =============================================================================
// Schemas
// =============================================================================

export {
  RecommendationTypeSchema,
  RecommendationStatusSchema,
  CompletionReasonSchema,
  EventTypeSchema,
  PrioritySchema,
  TracedOriginSchema,
  RecommendationEventSchema,
  RecommendationSchema,
  RecommendationFileSchema,
} from './schemas';

// =============================================================================
// Storage
// =============================================================================

export {
  saveRecommendation,
  loadRecommendation,
  listRecommendationIds,
  deleteRecommendation,
} from './storage';

export {
  estimateTokens,
  compressRecommendation,
  loadRecommendationsForContext,
  formatEventsVerbatim,
  TOKEN_BUDGET,
  CHARS_PER_TOKEN,
} from './storage/compression';

// =============================================================================
// Tools
// =============================================================================

export {
  // Spawn advisor
  spawnRecommendationAdvisorTool,
  buildAdvisorContext,
  buildQueryPrompt,
  // CRUD
  createRecommendationTool,
  createRecommendation,
  getRecommendationTool,
  getRecommendation,
  // Events
  addRecommendationEventTool,
  addRecommendationEvent,
  // Query
  listRecommendationsTool,
  listRecommendations,
  getRecommendationSummaryTool,
  getRecommendationSummary,
  // Refinement
  refineRecommendationTool,
  refineRecommendation,
  // Status management
  updateRecommendationStatusTool,
  updateRecommendationStatus,
  completeRecommendationTool,
  completeRecommendation,
} from './tools';

// =============================================================================
// Subagent
// =============================================================================

export {
  recommendationAdvisorInstructions,
  buildRecommendationAdvisorAgent,
  buildRecommendationSubagents,
  RECOMMENDATION_ADVISOR_TOOLS,
  toAgentDefinition,
  // Question handling
  createClarifyingQuestion,
  validateClarifyingQuestion,
  formatClarifyingQuestion,
  formatAdvisorOutput,
  parseClarifyingQuestions,
  parseAssumptions,
} from './subagent';

// =============================================================================
// Convenience: All Tools Array
// =============================================================================

/**
 * All recommendation tools for registry registration.
 */
export const RECOMMENDATION_TOOLS = [
  'spawn_recommendation_advisor',
  'create_recommendation',
  'get_recommendation',
  'add_recommendation_event',
  'list_recommendations',
  'get_recommendation_summary',
  'refine_recommendation',
  'update_recommendation_status',
  'complete_recommendation',
] as const;
