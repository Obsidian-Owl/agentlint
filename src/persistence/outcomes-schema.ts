/**
 * EP11 Quality & Security - Outcomes SQLite Schema
 *
 * SQLite schema definitions for recommendation outcome tracking.
 * Uses Bun's native SQLite support for local-first persistence.
 *
 * @module persistence/outcomes-schema
 */

// =============================================================================
// Schema SQL
// =============================================================================

/**
 * SQL for creating the recommendation outcomes table.
 *
 * Stores user feedback and implicit tracking data for recommendations.
 * Supports querying by session, recommendation, type, and implementation status.
 */
export const OUTCOMES_TABLE_SQL = `
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
`;

/**
 * SQL for creating indexes on the outcomes table.
 */
export const OUTCOMES_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_outcomes_session ON recommendation_outcomes(session_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_recommendation ON recommendation_outcomes(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_type ON recommendation_outcomes(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_outcomes_implemented ON recommendation_outcomes(implemented);
CREATE INDEX IF NOT EXISTS idx_outcomes_created_at ON recommendation_outcomes(created_at);
`;

/**
 * SQL for creating the outcome metrics view.
 *
 * Provides aggregated metrics by recommendation type.
 */
export const OUTCOME_METRICS_VIEW_SQL = `
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

/**
 * Combined schema SQL for initializing the outcomes database.
 */
export const FULL_OUTCOMES_SCHEMA = `
${OUTCOMES_TABLE_SQL}
${OUTCOMES_INDEXES_SQL}
${OUTCOME_METRICS_VIEW_SQL}
`;

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Row type for the recommendation_outcomes table.
 */
export interface OutcomeRow {
  id: string;
  session_id: string;
  recommendation_id: string;
  recommendation_type: 'symptomatic' | 'preventive' | 'systemic';
  recommendation_summary: string;
  implemented: number | null; // SQLite stores booleans as 0/1
  implementation_date: string | null;
  helped: number | null;
  outcome_notes: string | null;
  config_changed_after: number | null;
  similar_issue_recurred: number | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * Row type for the outcome_metrics view.
 */
export interface MetricsRow {
  recommendation_type: 'symptomatic' | 'preventive' | 'systemic';
  total_recommendations: number;
  implemented_count: number;
  helped_count: number;
  implementation_rate: number | null;
  success_rate: number | null;
}

// =============================================================================
// Query Templates
// =============================================================================

/**
 * Insert a new outcome record.
 */
export const INSERT_OUTCOME_SQL = `
INSERT INTO recommendation_outcomes (
  id, session_id, recommendation_id, recommendation_type, recommendation_summary,
  implemented, implementation_date, helped, outcome_notes,
  config_changed_after, similar_issue_recurred, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

/**
 * Update an existing outcome record.
 */
export const UPDATE_OUTCOME_SQL = `
UPDATE recommendation_outcomes SET
  implemented = COALESCE(?, implemented),
  implementation_date = COALESCE(?, implementation_date),
  helped = COALESCE(?, helped),
  outcome_notes = COALESCE(?, outcome_notes),
  config_changed_after = COALESCE(?, config_changed_after),
  similar_issue_recurred = COALESCE(?, similar_issue_recurred),
  updated_at = ?
WHERE id = ?
`;

/**
 * Get outcome by ID.
 */
export const GET_OUTCOME_BY_ID_SQL = `
SELECT * FROM recommendation_outcomes WHERE id = ?
`;

/**
 * Get outcomes by session.
 */
export const GET_OUTCOMES_BY_SESSION_SQL = `
SELECT * FROM recommendation_outcomes WHERE session_id = ? ORDER BY created_at ASC
`;

/**
 * Get outcomes by recommendation.
 */
export const GET_OUTCOMES_BY_RECOMMENDATION_SQL = `
SELECT * FROM recommendation_outcomes WHERE recommendation_id = ? ORDER BY created_at ASC
`;

/**
 * Get pending follow-ups (implemented but not yet rated).
 */
export const GET_PENDING_FOLLOWUPS_SQL = `
SELECT * FROM recommendation_outcomes
WHERE implemented = 1 AND helped IS NULL
  AND datetime(created_at) < datetime('now', '-' || ? || ' days')
ORDER BY created_at ASC
`;

/**
 * Get all pending follow-ups regardless of age.
 * Used when olderThanDays = 0 for testing convenience.
 */
export const GET_ALL_PENDING_FOLLOWUPS_SQL = `
SELECT * FROM recommendation_outcomes
WHERE implemented = 1 AND helped IS NULL
ORDER BY created_at ASC
`;

/**
 * Get aggregated metrics from the view.
 */
export const GET_METRICS_SQL = `
SELECT * FROM outcome_metrics
`;

/**
 * Get overall metrics (all types combined).
 */
export const GET_OVERALL_METRICS_SQL = `
SELECT
  'all' as recommendation_type,
  COUNT(*) as total_recommendations,
  SUM(CASE WHEN implemented = 1 THEN 1 ELSE 0 END) as implemented_count,
  SUM(CASE WHEN helped = 1 THEN 1 ELSE 0 END) as helped_count,
  CAST(SUM(CASE WHEN implemented = 1 THEN 1.0 ELSE 0.0 END) AS REAL) /
    NULLIF(COUNT(*), 0) as implementation_rate,
  CAST(SUM(CASE WHEN helped = 1 THEN 1.0 ELSE 0.0 END) AS REAL) /
    NULLIF(SUM(CASE WHEN implemented = 1 THEN 1 ELSE 0 END), 0) as success_rate
FROM recommendation_outcomes
`;
