/**
 * EP09 Temporal Analysis - Tracking Indexer
 *
 * Provides SQLite indexing for fast recommendation tracking queries.
 * The index stores metadata for efficient filtering while full tracking
 * records are stored in JSON files.
 *
 * @module persistence/tracking/indexer
 */

import { Database } from 'bun:sqlite';

import type { RecommendationTracking, RecommendationStatus } from '../../temporal/types';
import { openDatabase, execute, queryAll, queryOne, setSchemaVersion } from '../common';
import { getBaselinesDbPath } from '../common/directories';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for tracking indexer operations.
 */
export interface TrackingIndexerOptions {
  /** Base directory for the database (default: .agentlint) */
  baseDir?: string;
}

/**
 * Query options for filtering tracking records.
 */
export interface TrackingQueryOptions {
  /** Filter by recommendation ID */
  recommendationId?: string;
  /** Filter by status */
  status?: RecommendationStatus;
  /** Filter by baseline ID (pre or post) */
  baselineId?: string;
  /** Filter by detected date range start (ISO-8601) */
  after?: string;
  /** Filter by detected date range end (ISO-8601) */
  before?: string;
  /** Filter by minimum effectiveness score */
  minEffectiveness?: number;
  /** Filter by maximum effectiveness score */
  maxEffectiveness?: number;
  /** Maximum results to return */
  limit?: number;
  /** Order by field */
  orderBy?: 'detectedAt' | 'effectivenessScore' | 'status';
  /** Sort direction */
  order?: 'asc' | 'desc';
}

/**
 * Summary of a tracking record from the index.
 */
export interface TrackingSummary {
  id: string;
  recommendationId: string;
  recommendationText: string;
  status: RecommendationStatus;
  detectedAt?: string;
  confirmedAt?: string;
  preBaselineId?: string;
  postBaselineId?: string;
  effectivenessScore?: number;
  filePath: string;
}

/**
 * Row from the recommendation_tracking table.
 */
interface TrackingRow {
  id: string;
  recommendation_id: string;
  recommendation_text: string;
  status: string;
  detected_at: string | null;
  confirmed_at: string | null;
  pre_baseline_id: string | null;
  post_baseline_id: string | null;
  effectiveness_score: number | null;
  file_path: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Current schema version for tracking */
const SCHEMA_VERSION = '1.0.0';

// =============================================================================
// Schema
// =============================================================================

const CREATE_TRACKING_TABLE = `
  CREATE TABLE IF NOT EXISTS recommendation_tracking (
    id TEXT PRIMARY KEY,
    recommendation_id TEXT NOT NULL,
    recommendation_text TEXT NOT NULL,
    status TEXT NOT NULL,
    detected_at TEXT,
    confirmed_at TEXT,
    pre_baseline_id TEXT,
    post_baseline_id TEXT,
    effectiveness_score REAL,
    file_path TEXT NOT NULL
  )
`;

const CREATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_tracking_recommendation_id ON recommendation_tracking(recommendation_id)',
  'CREATE INDEX IF NOT EXISTS idx_tracking_status ON recommendation_tracking(status)',
  'CREATE INDEX IF NOT EXISTS idx_tracking_detected_at ON recommendation_tracking(detected_at)',
  'CREATE INDEX IF NOT EXISTS idx_tracking_pre_baseline ON recommendation_tracking(pre_baseline_id)',
  'CREATE INDEX IF NOT EXISTS idx_tracking_post_baseline ON recommendation_tracking(post_baseline_id)',
  'CREATE INDEX IF NOT EXISTS idx_tracking_effectiveness ON recommendation_tracking(effectiveness_score)',
];

// =============================================================================
// Public API
// =============================================================================

/**
 * Get or open the tracking index database.
 * Uses the same baselines.db database file.
 *
 * @param options - Indexer options
 * @returns The opened database connection
 */
export async function getTrackingIndexDb(options: TrackingIndexerOptions = {}): Promise<Database> {
  const projectPath = options.baseDir ?? process.cwd();
  const dbPath = getBaselinesDbPath(projectPath);

  const db = await openDatabase(dbPath);

  // Create tables and indexes
  db.exec(CREATE_TRACKING_TABLE);
  for (const indexSql of CREATE_INDEXES) {
    db.exec(indexSql);
  }

  // Set schema version
  setSchemaVersion(db, SCHEMA_VERSION, '_meta_tracking');

  return db;
}

/**
 * Add or update a tracking record in the index.
 *
 * @param db - Database connection
 * @param tracking - The tracking record to index
 * @param filePath - Path to the tracking JSON file
 */
export function indexTracking(
  db: Database,
  tracking: RecommendationTracking,
  filePath: string
): void {
  const sql = `
    INSERT INTO recommendation_tracking (
      id, recommendation_id, recommendation_text, status,
      detected_at, confirmed_at, pre_baseline_id, post_baseline_id,
      effectiveness_score, file_path
    ) VALUES (
      $id, $recommendation_id, $recommendation_text, $status,
      $detected_at, $confirmed_at, $pre_baseline_id, $post_baseline_id,
      $effectiveness_score, $file_path
    )
    ON CONFLICT(id) DO UPDATE SET
      recommendation_id = excluded.recommendation_id,
      recommendation_text = excluded.recommendation_text,
      status = excluded.status,
      detected_at = excluded.detected_at,
      confirmed_at = excluded.confirmed_at,
      pre_baseline_id = excluded.pre_baseline_id,
      post_baseline_id = excluded.post_baseline_id,
      effectiveness_score = excluded.effectiveness_score,
      file_path = excluded.file_path
  `;

  execute(db, sql, {
    $id: tracking.id,
    $recommendation_id: tracking.recommendationId,
    $recommendation_text: tracking.recommendationText,
    $status: tracking.status,
    $detected_at: tracking.detectedAt ?? null,
    $confirmed_at: tracking.confirmedAt ?? null,
    $pre_baseline_id: tracking.preBaselineId ?? null,
    $post_baseline_id: tracking.postBaselineId ?? null,
    $effectiveness_score: tracking.effectivenessScore ?? null,
    $file_path: filePath,
  });
}

/**
 * Remove a tracking record from the index.
 *
 * @param db - Database connection
 * @param id - Tracking UUID
 * @returns True if removed, false if not found
 */
export function removeTrackingIndex(db: Database, id: string): boolean {
  const changes = execute(db, 'DELETE FROM recommendation_tracking WHERE id = $id', { $id: id });
  return changes > 0;
}

/**
 * Query indexed tracking records.
 *
 * @param db - Database connection
 * @param options - Query options
 * @returns Array of tracking summaries
 */
export function queryTrackings(db: Database, options: TrackingQueryOptions = {}): TrackingSummary[] {
  const conditions: string[] = [];
  const params: Record<string, string | number | null> = {};

  // Build WHERE conditions
  if (options.recommendationId !== undefined) {
    conditions.push('recommendation_id = $recommendation_id');
    params.$recommendation_id = options.recommendationId;
  }

  if (options.status !== undefined) {
    conditions.push('status = $status');
    params.$status = options.status;
  }

  if (options.baselineId !== undefined) {
    conditions.push('(pre_baseline_id = $baseline_id OR post_baseline_id = $baseline_id)');
    params.$baseline_id = options.baselineId;
  }

  if (options.after !== undefined) {
    conditions.push('detected_at >= $after');
    params.$after = options.after;
  }

  if (options.before !== undefined) {
    conditions.push('detected_at <= $before');
    params.$before = options.before;
  }

  if (options.minEffectiveness !== undefined) {
    conditions.push('effectiveness_score >= $min_effectiveness');
    params.$min_effectiveness = options.minEffectiveness;
  }

  if (options.maxEffectiveness !== undefined) {
    conditions.push('effectiveness_score <= $max_effectiveness');
    params.$max_effectiveness = options.maxEffectiveness;
  }

  // Build ORDER BY
  let orderColumn: string;
  switch (options.orderBy) {
    case 'effectivenessScore':
      orderColumn = 'effectiveness_score';
      break;
    case 'status':
      orderColumn = 'status';
      break;
    default:
      orderColumn = 'detected_at';
  }
  const orderDir = options.order === 'asc' ? 'ASC' : 'DESC';

  // Build query
  let sql = 'SELECT * FROM recommendation_tracking';
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ` ORDER BY ${orderColumn} ${orderDir}`;

  if (options.limit !== undefined) {
    sql += ` LIMIT ${options.limit}`;
  }

  const rows = queryAll<TrackingRow>(db, sql, params);
  return rows.map(rowToSummary);
}

/**
 * Get a single indexed tracking record by ID.
 *
 * @param db - Database connection
 * @param id - Tracking UUID
 * @returns Tracking summary or null if not found
 */
export function getIndexedTrackingById(db: Database, id: string): TrackingSummary | null {
  const row = queryOne<TrackingRow>(db, 'SELECT * FROM recommendation_tracking WHERE id = $id', {
    $id: id,
  });
  if (!row) {
    return null;
  }
  return rowToSummary(row);
}

/**
 * Get tracking records for a specific recommendation.
 *
 * @param db - Database connection
 * @param recommendationId - Recommendation ID
 * @returns Array of tracking summaries
 */
export function getTrackingsByRecommendation(
  db: Database,
  recommendationId: string
): TrackingSummary[] {
  return queryTrackings(db, { recommendationId, orderBy: 'detectedAt', order: 'desc' });
}

/**
 * Get tracking records by status.
 *
 * @param db - Database connection
 * @param status - Status to filter by
 * @returns Array of tracking summaries
 */
export function getTrackingsByStatus(db: Database, status: RecommendationStatus): TrackingSummary[] {
  return queryTrackings(db, { status, orderBy: 'detectedAt', order: 'desc' });
}

/**
 * Count tracking records matching criteria.
 *
 * @param db - Database connection
 * @param options - Query options (limit is ignored)
 * @returns Count of matching tracking records
 */
export function countTrackings(
  db: Database,
  options: Omit<TrackingQueryOptions, 'limit'> = {}
): number {
  const conditions: string[] = [];
  const params: Record<string, string | number | null> = {};

  if (options.recommendationId !== undefined) {
    conditions.push('recommendation_id = $recommendation_id');
    params.$recommendation_id = options.recommendationId;
  }

  if (options.status !== undefined) {
    conditions.push('status = $status');
    params.$status = options.status;
  }

  if (options.after !== undefined) {
    conditions.push('detected_at >= $after');
    params.$after = options.after;
  }

  if (options.before !== undefined) {
    conditions.push('detected_at <= $before');
    params.$before = options.before;
  }

  let sql = 'SELECT COUNT(*) as count FROM recommendation_tracking';
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
 * Convert a database row to a TrackingSummary.
 */
function rowToSummary(row: TrackingRow): TrackingSummary {
  const summary: TrackingSummary = {
    id: row.id,
    recommendationId: row.recommendation_id,
    recommendationText: row.recommendation_text,
    status: row.status as RecommendationStatus,
    filePath: row.file_path,
  };

  if (row.detected_at) {
    summary.detectedAt = row.detected_at;
  }
  if (row.confirmed_at) {
    summary.confirmedAt = row.confirmed_at;
  }
  if (row.pre_baseline_id) {
    summary.preBaselineId = row.pre_baseline_id;
  }
  if (row.post_baseline_id) {
    summary.postBaselineId = row.post_baseline_id;
  }
  if (row.effectiveness_score !== null) {
    summary.effectivenessScore = row.effectiveness_score;
  }

  return summary;
}
