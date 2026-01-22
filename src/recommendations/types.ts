/**
 * EP10 Recommendation Advisor - Type Definitions
 *
 * These interfaces define the API contracts for the recommendation system.
 * Zod schemas for runtime validation are in schemas.ts.
 *
 * @module recommendations/types
 */

// =============================================================================
// Enums / Union Types
// =============================================================================

/**
 * Type of recommendation based on causal depth.
 * Per Constitution III: Causal-First
 */
export type RecommendationType = 'symptomatic' | 'preventive' | 'systemic';

/**
 * Lifecycle status of a recommendation case.
 */
export type RecommendationStatus =
  | 'open' // Active recommendation
  | 'pending_confirmation' // Implementation detected, awaiting confirm
  | 'implemented' // Confirmed implemented
  | 'monitoring'; // Tracking effectiveness

/**
 * Reason for completing a recommendation case.
 */
export type CompletionReason =
  | 'implemented' // Recommendation was applied
  | 'superseded' // Better recommendation replaced this
  | 'obsolete' // Changes made this irrelevant
  | 'rejected' // User decided not to implement
  | 'duplicate'; // Duplicate of another recommendation (AGE-674)

/**
 * Type of event in recommendation history.
 */
export type EventType =
  | 'created'
  | 'observation'
  | 'refinement'
  | 'user_feedback'
  | 'evidence'
  | 'implementation_signal'
  | 'status_change'
  | 'completed';

/**
 * Priority level for recommendations.
 */
export type Priority = 'high' | 'medium' | 'low';

// =============================================================================
// Core Entities
// =============================================================================

/**
 * Causal link to the source of a recommendation.
 * Per Constitution III: Trace issues to their origin.
 */
export interface TracedOrigin {
  /** Finding ID from EP05/EP06/EP07 */
  findingId?: string;
  /** Session that exhibited the issue */
  sessionId?: string;
  /** Description of the configuration gap */
  configGap?: string;
  /** Recurring pattern identified */
  pattern?: string;
}

/**
 * An append-only log entry for a recommendation.
 * Content is limited to 200 characters per NFR-003.
 */
export interface RecommendationEvent {
  /** UUID v4 identifier */
  id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Event category */
  type: EventType;
  /** Succinct description (max 200 chars) */
  content: string;
  /** Related baseline ID */
  baselineId?: string;
  /** Related session ID */
  sessionId?: string;
  /** Related git commit hash */
  commitHash?: string;
}

/**
 * A recommendation case - the core entity.
 * Living document that tracks a suggested improvement over time.
 */
export interface Recommendation {
  /** UUID v4 identifier */
  id: string;
  /** Project root path */
  projectPath: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;

  // Core recommendation fields
  /** Type based on causal depth */
  type: RecommendationType;
  /** SPECIFIC change to make */
  action: string;
  /** WHERE to make the change */
  target: string;
  /** WHY this will help (agent reasoning) */
  rationale: string;
  /** Prioritization */
  priority: Priority;
  /** Causal link to source */
  tracedOrigin: TracedOrigin;

  // Lifecycle fields
  /** Current status */
  status: RecommendationStatus;
  /** Append-only history */
  events: RecommendationEvent[];

  // Completion fields (optional)
  /** ISO 8601 completion timestamp */
  completedAt?: string;
  /** Why case was closed */
  completionReason?: CompletionReason;
  /** ID of replacement recommendation */
  supersededBy?: string;
}

// =============================================================================
// Derived / Summary Types
// =============================================================================

/**
 * Key lifecycle dates for quick reference.
 */
export interface Milestones {
  /** When recommendation was created */
  created: string;
  /** When first evidence was added */
  firstEvidence?: string;
  /** When implementation was confirmed */
  implemented?: string;
  /** When case was closed */
  completed?: string;
}

/**
 * Compressed view for context loading.
 * Per NFR-001: < 500 chars
 * Per NFR-002: 8K token budget for all recommendations
 */
export interface RecommendationSummary {
  /** Reference to full recommendation */
  id: string;
  /** Type based on causal depth */
  type: RecommendationType;
  /** Current status */
  status: RecommendationStatus;
  /** Truncated action (max 100 chars) */
  actionSummary: string;
  /** WHERE to make the change */
  target: string;
  /** Prioritization */
  priority: Priority;
  /** Total events in case */
  eventCount: number;
  /** Most recent event timestamp */
  lastEventAt: string;
  /** Most recent event type */
  lastEventType: EventType;
  /** Rolling summary of activity */
  recentActivity: string;
  /** Key lifecycle dates */
  milestones: Milestones;
}

// =============================================================================
// Interaction Types
// =============================================================================

/**
 * Option for multiple-choice clarifying questions.
 */
export interface QuestionOption {
  /** Short option label */
  label: string;
  /** Explanation of this option */
  description: string;
}

/**
 * Structured question for collaborative interaction.
 * Subagent returns these; orchestrator presents to user.
 */
export interface ClarifyingQuestion {
  /** The question to ask */
  question: string;
  /** Multiple choice options (optional) */
  options?: QuestionOption[];
  /** Why this question matters */
  context: string;
  /** Suggested answer if user declines */
  defaultAnswer?: string;
}

/**
 * Output from the Recommendation Advisor subagent.
 */
export interface AdvisorOutput {
  /** Generated recommendations */
  recommendations: Recommendation[];
  /** Questions needing user input (optional) */
  clarifyingQuestions?: ClarifyingQuestion[];
  /** Assumptions made if questions weren't asked */
  assumptions?: string[];
}

// =============================================================================
// Storage Types
// =============================================================================

/**
 * File format for persisted recommendations.
 */
export interface RecommendationFile {
  /** Schema version */
  version: string;
  /** The recommendation data */
  recommendation: Recommendation;
}

// =============================================================================
// Tool Input Types
// =============================================================================

/**
 * Input for create_recommendation tool.
 */
export interface CreateRecommendationInput {
  type: RecommendationType;
  action: string;
  target: string;
  rationale: string;
  priority: Priority;
  tracedOrigin: TracedOrigin;
}

/**
 * Input for add_recommendation_event tool.
 */
export interface AddEventInput {
  recommendationId: string;
  type: EventType;
  content: string;
  baselineId?: string;
  sessionId?: string;
  commitHash?: string;
}

/**
 * Input for list_recommendations tool.
 */
export interface ListRecommendationsInput {
  status?: RecommendationStatus;
  type?: RecommendationType;
  priority?: Priority;
  /** Filter by target (partial match) - AGE-674 */
  target?: string;
  /** Maximum recommendations to return */
  limit?: number;
  /** Whether to include completed cases */
  includeCompleted?: boolean;
}

/**
 * Input for refine_recommendation tool.
 */
export interface RefineRecommendationInput {
  recommendationId: string;
  action?: string;
  target?: string;
  priority?: Priority;
}

/**
 * Input for complete_recommendation tool.
 */
export interface CompleteRecommendationInput {
  recommendationId: string;
  reason: CompletionReason;
  supersededBy?: string;
}

/**
 * Input for spawn_recommendation_advisor tool.
 */
export interface SpawnAdvisorInput {
  /** Analysis context - findings to base recommendations on */
  findings: unknown[]; // EP05/EP06/EP07 findings
  /** Causal traces from EP07 (optional) */
  causalTraces?: unknown[];
  /** Include historic recommendations for context */
  includeHistoricRecs?: boolean;
  /** Interaction mode */
  interactionMode?: 'ask' | 'propose' | 'confirm';
}

// =============================================================================
// Subagent Types
// =============================================================================

/**
 * Context provided to the Recommendation Advisor subagent.
 * Per ADR-0019: Data for agent judgment, not instructions.
 */
export interface RecommendationAdvisorContext {
  /** Analysis focus */
  focus?: 'config' | 'workflow' | 'prevention' | 'comprehensive';
  /** User's specific question or request */
  query?: string;
  /** Current project path */
  projectPath?: string;
  /** Number of historic recommendations available */
  historicRecCount: number;
  /** Summary of recent recommendations */
  recentRecSummary?: string;
  /** Findings to analyze */
  findingCount: number;
  /** Causal traces available */
  causalTraceCount: number;
  /** Interaction mode */
  interactionMode: 'ask' | 'propose' | 'confirm';
}

/**
 * Instructions for the Recommendation Advisor subagent.
 * Follows EP08 ACT subagent pattern.
 */
export interface RecommendationSubagentInstructions {
  /** Unique identifier */
  name: string;
  /** Human-readable name */
  displayName: string;
  /** When to invoke - Claude uses this for delegation */
  description: string;
  /** Full context-engineered system prompt */
  prompt: string;
  /** Tool names this subagent can use */
  tools: string[];
  /** Selection priority (higher = preferred) */
  priority: number;
  /** Model override */
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
}
