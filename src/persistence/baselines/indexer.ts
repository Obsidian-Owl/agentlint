/**
 * EP03 Persistence Layer - Baseline Indexer
 *
 * Provides SQLite indexing for fast baseline queries.
 * The index stores metadata for efficient filtering while full baselines
 * are stored in JSON files.
 *
 * @module persistence/baselines/indexer
 */

import { Database } from 'bun:sqlite';
import { join } from 'node:path';

import type { Baseline, BaselineQueryOptions, BaselineSummary } from '../types';
import { openDatabase, execute, queryAll, queryOne, setSchemaVersion } from '../common';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for baseline indexer operations.
 */
export interface BaselineIndexerOptions {
  /** Base directory for the database */
  baseDir?: string;
}

/**
 * Row from the baselines table.
 */
interface BaselineRow {
  id: string;
  created_at: string;
  project_path: string;
  act_type: string;
  git_commit: string | null;
  findings_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  info_count: number;
  label: string | null;
  file_path: string | null;
}

// =============================================================================
// Constants
// =============================================================================

/** Current schema version */
const SCHEMA_VERSION = '1.0.0';

/** Database filename */
const DB_FILENAME = 'baselines.db';

// =============================================================================
// Schema
// =============================================================================

const CREATE_BASELINES_TABLE = `
  CREATE TABLE IF NOT EXISTS baselines (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    project_path TEXT NOT NULL,
    act_type TEXT NOT NULL,
    git_commit TEXT,
    findings_count INTEGER NOT NULL DEFAULT 0,
    critical_count INTEGER NOT NULL DEFAULT 0,
    high_count INTEGER NOT NULL DEFAULT 0,
    medium_count INTEGER NOT NULL DEFAULT 0,
    low_count INTEGER NOT NULL DEFAULT 0,
    info_count INTEGER NOT NULL DEFAULT 0,
    label TEXT,
    file_path TEXT
  )
`;

const CREATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_baselines_created_at ON baselines(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_baselines_label ON baselines(label)',
  'CREATE INDEX IF NOT EXISTS idx_baselines_git_commit ON baselines(git_commit)',
  'CREATE INDEX IF NOT EXISTS idx_baselines_findings_count ON baselines(findings_count)',
];

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the path to the baselines database.
 *
 * @param baseDir - Base directory for persistence
 * @returns Path to the database file
 */
export function getBaselineDbPath(baseDir: string): string {
  return join(baseDir, DB_FILENAME);
}

/**
 * Initialize the baseline schema in the database.
 *
 * Creates tables and indexes if they don't exist.
 * Safe to call multiple times (idempotent).
 *
 * @param options - Indexer options
 * @returns The opened database connection
 */
export async function initBaselineSchema(options: BaselineIndexerOptions = {}): Promise<Database> {
  const baseDir = options.baseDir ?? '.agentlint/baselines';
  const dbPath = getBaselineDbPath(baseDir);

  const db = await openDatabase(dbPath);

  // Create tables
  db.exec(CREATE_BASELINES_TABLE);

  // Create indexes
  for (const indexSql of CREATE_INDEXES) {
    db.exec(indexSql);
  }

  // Set schema version
  setSchemaVersion(db, SCHEMA_VERSION);

  return db;
}

/**
 * Add or update a baseline in the index.
 *
 * @param db - Database connection
 * @param baseline - The baseline to index
 * @param filePath - Optional path to the baseline JSON file
 */
export function indexBaseline(db: Database, baseline: Baseline, filePath?: string): void {
  const sql = `
    INSERT INTO baselines (
      id, created_at, project_path, act_type, git_commit,
      findings_count, critical_count, high_count, medium_count, low_count, info_count,
      label, file_path
    ) VALUES (
      $id, $created_at, $project_path, $act_type, $git_commit,
      $findings_count, $critical_count, $high_count, $medium_count, $low_count, $info_count,
      $label, $file_path
    )
    ON CONFLICT(id) DO UPDATE SET
      created_at = excluded.created_at,
      project_path = excluded.project_path,
      act_type = excluded.act_type,
      git_commit = excluded.git_commit,
      findings_count = excluded.findings_count,
      critical_count = excluded.critical_count,
      high_count = excluded.high_count,
      medium_count = excluded.medium_count,
      low_count = excluded.low_count,
      info_count = excluded.info_count,
      label = excluded.label,
      file_path = excluded.file_path
  `;

  execute(db, sql, {
    $id: baseline.id,
    $created_at: baseline.createdAt,
    $project_path: baseline.projectPath,
    $act_type: baseline.actType,
    $git_commit: baseline.gitCommit,
    $findings_count: baseline.metrics.findingsCount,
    $critical_count: baseline.metrics.criticalCount,
    $high_count: baseline.metrics.highCount,
    $medium_count: baseline.metrics.mediumCount,
    $low_count: baseline.metrics.lowCount,
    $info_count: baseline.metrics.infoCount,
    $label: baseline.label,
    $file_path: filePath ?? null,
  });
}

/**
 * Remove a baseline from the index.
 *
 * @param db - Database connection
 * @param id - Baseline UUID
 * @returns True if removed, false if not found
 */
export function removeIndex(db: Database, id: string): boolean {
  const changes = execute(db, 'DELETE FROM baselines WHERE id = $id', { $id: id });
  return changes > 0;
}

/**
 * Query indexed baselines.
 *
 * @param db - Database connection
 * @param options - Query options
 * @returns Array of baseline summaries
 */
export function getIndexedBaselines(
  db: Database,
  options: BaselineQueryOptions = {}
): (BaselineSummary & { filePath?: string | undefined })[] {
  const conditions: string[] = [];
  const params: Record<string, string | number | null> = {};

  // Build WHERE conditions
  if (options.label !== undefined) {
    conditions.push('label = $label');
    params.$label = options.label;
  }

  if (options.after !== undefined) {
    conditions.push('created_at >= $after');
    params.$after = options.after;
  }

  if (options.before !== undefined) {
    conditions.push('created_at <= $before');
    params.$before = options.before;
  }

  if (options.gitCommit !== undefined) {
    conditions.push('git_commit = $git_commit');
    params.$git_commit = options.gitCommit;
  }

  // Build ORDER BY
  const orderColumn = options.orderBy === 'findingsCount' ? 'findings_count' : 'created_at';
  const orderDir = options.order === 'asc' ? 'ASC' : 'DESC';

  // Build query
  let sql = 'SELECT * FROM baselines';
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ` ORDER BY ${orderColumn} ${orderDir}`;

  if (options.limit !== undefined) {
    sql += ` LIMIT ${options.limit}`;
  }

  const rows = queryAll<BaselineRow>(db, sql, params);
  return rows.map(rowToSummary);
}

/**
 * Get a single indexed baseline by ID.
 *
 * @param db - Database connection
 * @param id - Baseline UUID
 * @returns Baseline summary or null if not found
 */
export function getIndexedBaselineById(
  db: Database,
  id: string
): (BaselineSummary & { filePath?: string | undefined }) | null {
  const row = queryOne<BaselineRow>(db, 'SELECT * FROM baselines WHERE id = $id', { $id: id });
  if (!row) {
    return null;
  }
  return rowToSummary(row);
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Convert a database row to a BaselineSummary.
 */
function rowToSummary(row: BaselineRow): BaselineSummary & { filePath?: string | undefined } {
  const result: BaselineSummary & { filePath?: string | undefined } = {
    id: row.id,
    createdAt: row.created_at,
    projectPath: row.project_path,
    actType: row.act_type,
    gitCommit: row.git_commit,
    metrics: {
      findingsCount: row.findings_count,
      criticalCount: row.critical_count,
      highCount: row.high_count,
      mediumCount: row.medium_count,
      lowCount: row.low_count,
      infoCount: row.info_count,
    },
    label: row.label,
  };

  if (row.file_path !== null) {
    result.filePath = row.file_path;
  }

  return result;
}
