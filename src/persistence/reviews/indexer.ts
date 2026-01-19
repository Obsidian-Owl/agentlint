/**
 * EP09 Temporal Analysis - Review Indexer
 *
 * Provides SQLite indexing for fast qualitative review queries.
 * The index stores metadata for efficient filtering while full reviews
 * are stored in JSON files.
 *
 * @module persistence/reviews/indexer
 */

import { Database } from 'bun:sqlite';

import type { QualitativeReview } from '../../temporal/types';
import { openDatabase, execute, queryAll, queryOne, setSchemaVersion } from '../common';
import { getBaselinesDbPath } from '../common/directories';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for review indexer operations.
 */
export interface ReviewIndexerOptions {
  /** Base directory for the database (default: .agentlint) */
  baseDir?: string;
}

/**
 * Query options for filtering reviews.
 */
export interface ReviewQueryOptions {
  /** Filter by baseline ID */
  baselineId?: string;
  /** Filter by date range start (ISO-8601) */
  after?: string;
  /** Filter by date range end (ISO-8601) */
  before?: string;
  /** Filter by trigger reason */
  triggerReason?: 'scheduled' | 'triggered' | 'manual';
  /** Filter by minimum sentiment */
  minSentiment?: number;
  /** Filter by maximum sentiment */
  maxSentiment?: number;
  /** Maximum results to return */
  limit?: number;
  /** Order by field */
  orderBy?: 'createdAt' | 'overallSentiment';
  /** Sort direction */
  order?: 'asc' | 'desc';
}

/**
 * Summary of a review from the index.
 */
export interface ReviewSummary {
  id: string;
  baselineId: string;
  createdAt: string;
  overallSentiment: number;
  themes: string[];
  triggerReason?: string;
  filePath?: string;
}

/**
 * Row from the qualitative_reviews table.
 */
interface ReviewRow {
  id: string;
  baseline_id: string;
  created_at: string;
  overall_sentiment: number;
  themes: string | null;
  trigger_reason: string | null;
  file_path: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Current schema version for reviews */
const SCHEMA_VERSION = '1.0.0';

// =============================================================================
// Schema
// =============================================================================

const CREATE_REVIEWS_TABLE = `
  CREATE TABLE IF NOT EXISTS qualitative_reviews (
    id TEXT PRIMARY KEY,
    baseline_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    overall_sentiment REAL NOT NULL,
    themes TEXT,
    trigger_reason TEXT,
    file_path TEXT NOT NULL
  )
`;

const CREATE_INDEXES = [
  // Single-column indexes for direct lookups
  'CREATE INDEX IF NOT EXISTS idx_reviews_baseline_id ON qualitative_reviews(baseline_id)',
  'CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON qualitative_reviews(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_reviews_sentiment ON qualitative_reviews(overall_sentiment)',
  'CREATE INDEX IF NOT EXISTS idx_reviews_trigger_reason ON qualitative_reviews(trigger_reason)',
  // Composite indexes for common query patterns (T062 optimization)
  'CREATE INDEX IF NOT EXISTS idx_reviews_baseline_created ON qualitative_reviews(baseline_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_reviews_date_sentiment ON qualitative_reviews(created_at, overall_sentiment)',
  'CREATE INDEX IF NOT EXISTS idx_reviews_trigger_created ON qualitative_reviews(trigger_reason, created_at DESC)',
];

// =============================================================================
// Public API
// =============================================================================

/**
 * Get or open the review index database.
 * Uses the same baselines.db database file.
 *
 * @param options - Indexer options
 * @returns The opened database connection
 */
export async function getReviewIndexDb(options: ReviewIndexerOptions = {}): Promise<Database> {
  const projectPath = options.baseDir ?? process.cwd();
  const dbPath = getBaselinesDbPath(projectPath);

  const db = await openDatabase(dbPath);

  // Create tables and indexes
  db.exec(CREATE_REVIEWS_TABLE);
  for (const indexSql of CREATE_INDEXES) {
    db.exec(indexSql);
  }

  // Set schema version
  setSchemaVersion(db, SCHEMA_VERSION, '_meta_reviews');

  return db;
}

/**
 * Add or update a review in the index.
 *
 * @param db - Database connection
 * @param review - The review to index
 * @param filePath - Path to the review JSON file
 */
export function indexReview(db: Database, review: QualitativeReview, filePath: string): void {
  const sql = `
    INSERT INTO qualitative_reviews (
      id, baseline_id, created_at, overall_sentiment, themes, trigger_reason, file_path
    ) VALUES (
      $id, $baseline_id, $created_at, $overall_sentiment, $themes, $trigger_reason, $file_path
    )
    ON CONFLICT(id) DO UPDATE SET
      baseline_id = excluded.baseline_id,
      created_at = excluded.created_at,
      overall_sentiment = excluded.overall_sentiment,
      themes = excluded.themes,
      trigger_reason = excluded.trigger_reason,
      file_path = excluded.file_path
  `;

  execute(db, sql, {
    $id: review.id,
    $baseline_id: review.baselineId,
    $created_at: review.createdAt,
    $overall_sentiment: review.overallSentiment,
    $themes: review.themes.length > 0 ? JSON.stringify(review.themes) : null,
    $trigger_reason: review.triggerReason ?? null,
    $file_path: filePath,
  });
}

/**
 * Remove a review from the index.
 *
 * @param db - Database connection
 * @param id - Review UUID
 * @returns True if removed, false if not found
 */
export function removeReviewIndex(db: Database, id: string): boolean {
  const changes = execute(db, 'DELETE FROM qualitative_reviews WHERE id = $id', { $id: id });
  return changes > 0;
}

/**
 * Query indexed reviews.
 *
 * @param db - Database connection
 * @param options - Query options
 * @returns Array of review summaries
 */
export function queryReviews(db: Database, options: ReviewQueryOptions = {}): ReviewSummary[] {
  const conditions: string[] = [];
  const params: Record<string, string | number | null> = {};

  // Build WHERE conditions
  if (options.baselineId !== undefined) {
    conditions.push('baseline_id = $baseline_id');
    params.$baseline_id = options.baselineId;
  }

  if (options.after !== undefined) {
    conditions.push('created_at >= $after');
    params.$after = options.after;
  }

  if (options.before !== undefined) {
    conditions.push('created_at <= $before');
    params.$before = options.before;
  }

  if (options.triggerReason !== undefined) {
    conditions.push('trigger_reason = $trigger_reason');
    params.$trigger_reason = options.triggerReason;
  }

  if (options.minSentiment !== undefined) {
    conditions.push('overall_sentiment >= $min_sentiment');
    params.$min_sentiment = options.minSentiment;
  }

  if (options.maxSentiment !== undefined) {
    conditions.push('overall_sentiment <= $max_sentiment');
    params.$max_sentiment = options.maxSentiment;
  }

  // Build ORDER BY
  const orderColumn = options.orderBy === 'overallSentiment' ? 'overall_sentiment' : 'created_at';
  const orderDir = options.order === 'asc' ? 'ASC' : 'DESC';

  // Build query
  let sql = 'SELECT * FROM qualitative_reviews';
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ` ORDER BY ${orderColumn} ${orderDir}`;

  if (options.limit !== undefined) {
    sql += ` LIMIT ${options.limit}`;
  }

  const rows = queryAll<ReviewRow>(db, sql, params);
  return rows.map(rowToSummary);
}

/**
 * Get a single indexed review by ID.
 *
 * @param db - Database connection
 * @param id - Review UUID
 * @returns Review summary or null if not found
 */
export function getIndexedReviewById(db: Database, id: string): ReviewSummary | null {
  const row = queryOne<ReviewRow>(db, 'SELECT * FROM qualitative_reviews WHERE id = $id', {
    $id: id,
  });
  if (!row) {
    return null;
  }
  return rowToSummary(row);
}

/**
 * Get reviews for a specific baseline.
 *
 * @param db - Database connection
 * @param baselineId - Baseline UUID
 * @returns Array of review summaries
 */
export function getReviewsByBaseline(db: Database, baselineId: string): ReviewSummary[] {
  return queryReviews(db, { baselineId, orderBy: 'createdAt', order: 'desc' });
}

/**
 * Count reviews matching criteria.
 *
 * @param db - Database connection
 * @param options - Query options (limit is ignored)
 * @returns Count of matching reviews
 */
export function countReviews(
  db: Database,
  options: Omit<ReviewQueryOptions, 'limit'> = {}
): number {
  const conditions: string[] = [];
  const params: Record<string, string | number | null> = {};

  if (options.baselineId !== undefined) {
    conditions.push('baseline_id = $baseline_id');
    params.$baseline_id = options.baselineId;
  }

  if (options.after !== undefined) {
    conditions.push('created_at >= $after');
    params.$after = options.after;
  }

  if (options.before !== undefined) {
    conditions.push('created_at <= $before');
    params.$before = options.before;
  }

  let sql = 'SELECT COUNT(*) as count FROM qualitative_reviews';
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  const result = queryOne<{ count: number }>(db, sql, params);
  return result?.count ?? 0;
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Convert a database row to a ReviewSummary.
 */
function rowToSummary(row: ReviewRow): ReviewSummary {
  const summary: ReviewSummary = {
    id: row.id,
    baselineId: row.baseline_id,
    createdAt: row.created_at,
    overallSentiment: row.overall_sentiment,
    themes: row.themes ? (JSON.parse(row.themes) as string[]) : [],
    filePath: row.file_path,
  };

  if (row.trigger_reason) {
    summary.triggerReason = row.trigger_reason;
  }

  return summary;
}
