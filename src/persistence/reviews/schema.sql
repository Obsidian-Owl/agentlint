-- EP09 Temporal Analysis - Reviews Schema
-- Version: 1.0.0
--
-- This schema extends the baselines.db SQLite database with indexes
-- for qualitative reviews and recommendation tracking.
--
-- Usage: Run these statements against .agentlint/baselines.db

-- =============================================================================
-- Qualitative Reviews Index
-- =============================================================================
-- Indexes metadata from .agentlint/reviews/{id}.json files for fast querying.
-- Full review data is stored in JSON files; this table enables filtering.

CREATE TABLE IF NOT EXISTS qualitative_reviews (
  -- Primary identifier (UUID v4)
  id TEXT PRIMARY KEY,

  -- Foreign key to baselines table (required)
  baseline_id TEXT NOT NULL,

  -- ISO-8601 creation timestamp
  created_at TEXT NOT NULL,

  -- Aggregate sentiment score (-2 to +2)
  overall_sentiment REAL NOT NULL,

  -- JSON array of extracted themes (e.g., '["context-switching", "file-navigation"]')
  themes TEXT,

  -- Why this review was triggered: 'scheduled', 'triggered', 'manual'
  trigger_reason TEXT,

  -- Path to the JSON file (relative to project root)
  file_path TEXT NOT NULL,

  -- Foreign key constraint (note: baselines table must exist)
  FOREIGN KEY (baseline_id) REFERENCES baselines(id) ON DELETE CASCADE
);

-- Index for finding reviews by baseline
CREATE INDEX IF NOT EXISTS idx_reviews_baseline_id
  ON qualitative_reviews(baseline_id);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_reviews_created_at
  ON qualitative_reviews(created_at);

-- Index for sentiment trend analysis
CREATE INDEX IF NOT EXISTS idx_reviews_sentiment
  ON qualitative_reviews(overall_sentiment);

-- Index for finding reviews by trigger type
CREATE INDEX IF NOT EXISTS idx_reviews_trigger_reason
  ON qualitative_reviews(trigger_reason);

-- =============================================================================
-- Recommendation Tracking Index
-- =============================================================================
-- Indexes metadata from .agentlint/tracking/{id}.json files.
-- Enables queries like "find all implemented recommendations" without file I/O.

CREATE TABLE IF NOT EXISTS recommendation_tracking (
  -- Primary identifier (UUID v4)
  id TEXT PRIMARY KEY,

  -- Reference to the original recommendation
  recommendation_id TEXT NOT NULL,

  -- Current status: 'pending', 'detected_pending_confirm', 'implemented',
  -- 'partial', 'rejected', 'ineffective'
  status TEXT NOT NULL,

  -- When implementation was auto-detected (ISO-8601)
  detected_at TEXT,

  -- When user confirmed the implementation (ISO-8601)
  confirmed_at TEXT,

  -- Baseline before implementation (for effectiveness comparison)
  pre_baseline_id TEXT,

  -- Baseline after implementation
  post_baseline_id TEXT,

  -- Calculated effectiveness score (0-100)
  effectiveness_score REAL,

  -- Path to the JSON file
  file_path TEXT NOT NULL,

  -- Foreign key constraints
  FOREIGN KEY (pre_baseline_id) REFERENCES baselines(id) ON DELETE SET NULL,
  FOREIGN KEY (post_baseline_id) REFERENCES baselines(id) ON DELETE SET NULL
);

-- Index for finding tracking by recommendation
CREATE INDEX IF NOT EXISTS idx_tracking_recommendation_id
  ON recommendation_tracking(recommendation_id);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_tracking_status
  ON recommendation_tracking(status);

-- Index for finding by effectiveness
CREATE INDEX IF NOT EXISTS idx_tracking_effectiveness
  ON recommendation_tracking(effectiveness_score);

-- Index for date range queries on detection
CREATE INDEX IF NOT EXISTS idx_tracking_detected_at
  ON recommendation_tracking(detected_at);

-- =============================================================================
-- Migration Metadata
-- =============================================================================
-- Track schema version using SQLite PRAGMA
-- To set: PRAGMA user_version = 1;
-- To get: PRAGMA user_version;
--
-- Version History:
-- 0: Initial EP03 baselines schema
-- 1: EP09 adds qualitative_reviews and recommendation_tracking
