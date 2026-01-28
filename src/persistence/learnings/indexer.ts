/**
 * EP03 Persistence Layer - Learnings Indexer
 *
 * Provides SQLite indexing for learnings metadata.
 * Enables fast querying by category, tags, and scope.
 *
 * @module persistence/learnings/indexer
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';

import type { Learning, LearningSummary, LearningQueryOptions } from '../types';
import { ensureDir } from '../common';

// =============================================================================
// Types
// =============================================================================

interface IndexOptions {
  /** Base directory for learnings database */
  baseDir: string;
}

interface ListAllDirs {
  /** Project learnings directory */
  projectDir: string;
  /** Global learnings directory */
  globalDir?: string;
}

// =============================================================================
// Database Management
// =============================================================================

/** Cache of open database connections */
const dbCache = new Map<string, Database>();

/**
 * Get or create a database connection for a directory.
 */
function getDb(baseDir: string): Database {
  const dbPath = join(baseDir, 'learnings.db');

  if (dbCache.has(dbPath)) {
    return dbCache.get(dbPath)!;
  }

  const db = new Database(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  dbCache.set(dbPath, db);
  return db;
}

/**
 * Initialize the learnings index database.
 *
 * @param options - Index options
 */
export async function initLearningsIndex(options: IndexOptions): Promise<void> {
  await ensureDir(options.baseDir);
  const db = getDb(options.baseDir);

  db.exec(`
    CREATE TABLE IF NOT EXISTS learnings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      scope TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_learnings_category ON learnings(category);
    CREATE INDEX IF NOT EXISTS idx_learnings_scope ON learnings(scope);
    CREATE INDEX IF NOT EXISTS idx_learnings_created ON learnings(created_at);
    CREATE INDEX IF NOT EXISTS idx_learnings_updated ON learnings(updated_at);
  `);
}

/**
 * Close the learnings index database connection.
 *
 * @param options - Index options
 */
export function closeLearningsIndex(options: IndexOptions): void {
  const dbPath = join(options.baseDir, 'learnings.db');
  const db = dbCache.get(dbPath);
  if (db) {
    db.close();
    dbCache.delete(dbPath);
  }
}

// =============================================================================
// Index Operations
// =============================================================================

/**
 * Index a learning in the database.
 *
 * @param learning - The learning to index
 * @param options - Index options
 */
export function indexLearning(learning: Learning, options: IndexOptions): void {
  const db = getDb(options.baseDir);

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO learnings (id, title, category, scope, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    learning.id,
    learning.title,
    learning.category,
    learning.scope,
    JSON.stringify(learning.tags),
    learning.createdAt,
    learning.updatedAt
  );
}

/**
 * Get a learning by ID from the index.
 *
 * @param id - Learning ID
 * @param options - Index options
 * @returns Learning summary, or null if not found
 */
export function getLearningById(id: string, options: IndexOptions): LearningSummary | null {
  const dbPath = join(options.baseDir, 'learnings.db');
  if (!existsSync(dbPath)) {
    return null;
  }

  const db = getDb(options.baseDir);
  const stmt = db.prepare(`
    SELECT id, title, category, scope, tags, created_at, updated_at
    FROM learnings
    WHERE id = ?
  `);

  const row = stmt.get(id) as DbRow | null;
  if (!row) {
    return null;
  }

  return rowToSummary(row);
}

/**
 * Query learnings from the index.
 *
 * @param queryOptions - Query options
 * @param options - Index options
 * @returns Array of learning summaries
 */
export function queryLearnings(
  queryOptions: LearningQueryOptions,
  options: IndexOptions
): LearningSummary[] {
  const dbPath = join(options.baseDir, 'learnings.db');
  if (!existsSync(dbPath)) {
    return [];
  }

  const db = getDb(options.baseDir);

  // Build query
  let sql =
    'SELECT id, title, category, scope, tags, created_at, updated_at FROM learnings WHERE 1=1';
  const params: (string | number)[] = [];

  if (queryOptions.category) {
    sql += ' AND category = ?';
    params.push(queryOptions.category);
  }

  if (queryOptions.scope) {
    sql += ' AND scope = ?';
    params.push(queryOptions.scope);
  }

  if (queryOptions.tag) {
    sql += ' AND tags LIKE ?';
    params.push(`%"${queryOptions.tag}"%`);
  }

  // Order by
  const orderBy = queryOptions.orderBy === 'updatedAt' ? 'updated_at' : 'created_at';
  const order = queryOptions.order === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${orderBy} ${order}`;

  // Limit
  if (queryOptions.limit) {
    sql += ' LIMIT ?';
    params.push(queryOptions.limit);
  }

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as DbRow[];

  return rows.map(rowToSummary);
}

/**
 * Remove a learning from the index.
 *
 * @param id - Learning ID
 * @param options - Index options
 * @returns True if removed, false if not found
 */
export function removeLearningFromIndex(id: string, options: IndexOptions): boolean {
  const dbPath = join(options.baseDir, 'learnings.db');
  if (!existsSync(dbPath)) {
    return false;
  }

  const db = getDb(options.baseDir);
  const stmt = db.prepare('DELETE FROM learnings WHERE id = ?');
  const result = stmt.run(id);

  return result.changes > 0;
}

/**
 * List all learnings from both project and global directories.
 *
 * Per FR-020: Query both project and global learnings.db when listing learnings, merge results.
 *
 * @param dirs - Project and global directories
 * @param queryOptions - Query options to apply
 * @returns Merged array of learning summaries
 */
export function listAllLearnings(
  dirs: ListAllDirs,
  queryOptions: LearningQueryOptions
): LearningSummary[] {
  const results: LearningSummary[] = [];

  // Query project learnings
  const projectDbPath = join(dirs.projectDir, 'learnings.db');
  if (existsSync(projectDbPath)) {
    const projectResults = queryLearnings(queryOptions, { baseDir: dirs.projectDir });
    results.push(...projectResults);
  }

  // Query global learnings
  if (dirs.globalDir) {
    const globalDbPath = join(dirs.globalDir, 'learnings.db');
    if (existsSync(globalDbPath)) {
      const globalResults = queryLearnings(queryOptions, { baseDir: dirs.globalDir });
      results.push(...globalResults);
    }
  }

  // Sort merged results
  const orderBy = queryOptions.orderBy === 'updatedAt' ? 'updatedAt' : 'createdAt';
  const ascending = queryOptions.order === 'asc';

  results.sort((a, b) => {
    const aTime = new Date(a[orderBy]).getTime();
    const bTime = new Date(b[orderBy]).getTime();
    return ascending ? aTime - bTime : bTime - aTime;
  });

  // Apply limit to merged results
  if (queryOptions.limit && results.length > queryOptions.limit) {
    return results.slice(0, queryOptions.limit);
  }

  return results;
}

// =============================================================================
// Internal Helpers
// =============================================================================

interface DbRow {
  id: string;
  title: string;
  category: string;
  scope: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

/**
 * Safely parse a JSON string array, returning empty array on parse failure.
 */
function safeParseStringArray(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.every((item): item is string => typeof item === 'string')) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

function rowToSummary(row: DbRow): LearningSummary {
  return {
    id: row.id,
    title: row.title,
    category: row.category as LearningSummary['category'],
    scope: row.scope as LearningSummary['scope'],
    tags: safeParseStringArray(row.tags),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
