/**
 * EP11 Quality & Security - Outcome Tracking Contracts
 *
 * TypeScript interfaces for recommendation outcome tracking.
 *
 * @module contracts/outcome
 */

// =============================================================================
// Recommendation Types
// =============================================================================

/**
 * Types of recommendations (from Constitution Principle III).
 */
export type RecommendationType =
  | 'symptomatic' // Address immediate issue
  | 'preventive' // Enable prevention of recurrence
  | 'systemic'; // Address root patterns

// =============================================================================
// Outcome Record
// =============================================================================

/**
 * A tracked recommendation outcome.
 */
export interface RecommendationOutcome {
  /** Unique identifier */
  id: string;

  /** Analysis session reference */
  sessionId: string;

  /** Recommendation reference */
  recommendationId: string;

  /** Type of recommendation */
  recommendationType: RecommendationType;

  /** Brief description of the recommendation */
  recommendationSummary: string;

  // User-reported feedback

  /** Did the user implement this? */
  implemented: boolean | null;

  /** When was it implemented? */
  implementationDate: string | null;

  /** Did it help? */
  helped: boolean | null;

  /** User's notes */
  outcomeNotes: string | null;

  // Implicit signals

  /** Did the config change after this recommendation? */
  configChangedAfter: boolean | null;

  /** Did we detect the same issue again later? */
  similarIssueRecurred: boolean | null;

  // Timestamps

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string | null;
}

// =============================================================================
// Feedback Collection
// =============================================================================

/**
 * User feedback response options.
 */
export type FeedbackResponse =
  | 'will_implement' // User will implement
  | 'maybe_later' // User might implement later
  | 'not_relevant' // Not relevant to their needs
  | 'already_done' // Already addressed
  | 'skip'; // Skip this question

/**
 * Feedback prompt for a single recommendation.
 */
export interface FeedbackPrompt {
  /** Recommendation ID */
  recommendationId: string;

  /** Summary to display */
  summary: string;

  /** Response from user */
  response?: FeedbackResponse;
}

/**
 * Follow-up outcome prompt.
 */
export interface OutcomePrompt {
  /** Recommendation ID */
  recommendationId: string;

  /** Summary to remind user */
  summary: string;

  /** Whether it helped */
  helped?: boolean;

  /** Optional notes */
  notes?: string;
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Outcome tracking configuration.
 */
export interface OutcomeTrackingConfig {
  /** Whether to collect feedback */
  collectFeedback: boolean;

  /** Maximum recommendations to prompt about per session */
  maxPromptsPerSession: number;

  /** Days to wait before follow-up prompt */
  followUpDelayDays: number;
}

/**
 * Default configuration.
 */
export const DEFAULT_OUTCOME_CONFIG: OutcomeTrackingConfig = {
  collectFeedback: false, // Opt-in
  maxPromptsPerSession: 3,
  followUpDelayDays: 7,
};

// =============================================================================
// Aggregation
// =============================================================================

/**
 * Aggregated outcome metrics.
 */
export interface OutcomeMetrics {
  /** Total recommendations tracked */
  totalRecommendations: number;

  /** Number implemented */
  implementedCount: number;

  /** Number that helped */
  helpedCount: number;

  /** Implementation rate (0-1) */
  implementationRate: number;

  /** Success rate among implemented (0-1) */
  successRate: number;
}

/**
 * Metrics by recommendation type.
 */
export interface OutcomeMetricsByType {
  symptomatic: OutcomeMetrics;
  preventive: OutcomeMetrics;
  systemic: OutcomeMetrics;
  all: OutcomeMetrics;
}

// =============================================================================
// Implicit Tracking
// =============================================================================

/**
 * Event for implicit tracking.
 */
export interface ImplicitTrackingEvent {
  /** Event type */
  type: 'config_changed' | 'issue_recurred';

  /** Affected recommendation ID */
  recommendationId: string;

  /** Detection timestamp */
  detectedAt: string;

  /** Additional details */
  details?: Record<string, unknown>;
}

// =============================================================================
// Storage Interface
// =============================================================================

/**
 * Interface for outcome storage.
 */
export interface IOutcomeStorage {
  /**
   * Create a new outcome record.
   */
  createOutcome(outcome: Omit<RecommendationOutcome, 'id' | 'createdAt' | 'updatedAt'>): Promise<RecommendationOutcome>;

  /**
   * Update an existing outcome.
   */
  updateOutcome(id: string, updates: Partial<RecommendationOutcome>): Promise<RecommendationOutcome>;

  /**
   * Get outcome by ID.
   */
  getOutcome(id: string): Promise<RecommendationOutcome | null>;

  /**
   * Get outcomes for a session.
   */
  getOutcomesBySession(sessionId: string): Promise<RecommendationOutcome[]>;

  /**
   * Get outcomes for a recommendation.
   */
  getOutcomesByRecommendation(recommendationId: string): Promise<RecommendationOutcome[]>;

  /**
   * Get outcomes pending follow-up.
   */
  getPendingFollowUps(olderThanDays: number): Promise<RecommendationOutcome[]>;

  /**
   * Get aggregated metrics.
   */
  getMetrics(): Promise<OutcomeMetricsByType>;

  /**
   * Record an implicit tracking event.
   */
  recordImplicitEvent(event: ImplicitTrackingEvent): Promise<void>;
}

// =============================================================================
// Feedback Collection Interface
// =============================================================================

/**
 * Interface for feedback collection.
 */
export interface IFeedbackCollector {
  /**
   * Check if feedback collection is enabled.
   */
  isEnabled(): boolean;

  /**
   * Should we prompt for feedback this session?
   */
  shouldPrompt(): Promise<boolean>;

  /**
   * Get recommendations to prompt about.
   */
  getPromptsForSession(
    recommendations: Array<{ id: string; summary: string; type: RecommendationType }>
  ): FeedbackPrompt[];

  /**
   * Record user feedback.
   */
  recordFeedback(prompt: FeedbackPrompt): Promise<void>;

  /**
   * Get pending follow-up prompts.
   */
  getPendingFollowUps(): Promise<OutcomePrompt[]>;

  /**
   * Record follow-up outcome.
   */
  recordFollowUp(prompt: OutcomePrompt): Promise<void>;
}

// =============================================================================
// SQL Schema
// =============================================================================

/**
 * SQL for creating the outcomes table.
 */
export const OUTCOMES_SCHEMA = `
CREATE TABLE IF NOT EXISTS recommendation_outcomes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  recommendation_id TEXT NOT NULL,
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('symptomatic', 'preventive', 'systemic')),
  recommendation_summary TEXT NOT NULL,
  implemented INTEGER,
  implementation_date TEXT,
  helped INTEGER,
  outcome_notes TEXT,
  config_changed_after INTEGER,
  similar_issue_recurred INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_outcomes_session ON recommendation_outcomes(session_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_recommendation ON recommendation_outcomes(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_type ON recommendation_outcomes(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_outcomes_implemented ON recommendation_outcomes(implemented);
`;

/**
 * SQL for aggregated metrics view.
 */
export const OUTCOME_METRICS_VIEW = `
CREATE VIEW IF NOT EXISTS outcome_metrics AS
SELECT
  recommendation_type,
  COUNT(*) as total_recommendations,
  SUM(CASE WHEN implemented = 1 THEN 1 ELSE 0 END) as implemented_count,
  SUM(CASE WHEN helped = 1 THEN 1 ELSE 0 END) as helped_count,
  CAST(SUM(CASE WHEN implemented = 1 THEN 1.0 ELSE 0.0 END) AS REAL) /
    NULLIF(COUNT(*), 0) as implementation_rate,
  CAST(SUM(CASE WHEN helped = 1 THEN 1.0 ELSE 0.0 END) AS REAL) /
    NULLIF(SUM(CASE WHEN implemented = 1 THEN 1 ELSE 0 END), 0) as success_rate
FROM recommendation_outcomes
GROUP BY recommendation_type;
`;
