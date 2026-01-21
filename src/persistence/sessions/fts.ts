/**
 * EP06 Session Analysis - FTS5 Database Operations
 *
 * SQLite FTS5 database for full-text search of session logs.
 * Implements ADR-0006 schema for session log processing.
 *
 * @module persistence/sessions/fts
 */

import { Database } from 'bun:sqlite';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// =============================================================================
// Schema Version
// =============================================================================

/**
 * Current schema version.
 * Increment when schema changes require migration.
 */
export const SCHEMA_VERSION = 1;

// =============================================================================
// SQL Schema Definitions
// =============================================================================

/**
 * SQL to create the FTS5 virtual table for session entries.
 * Uses porter stemmer and unicode61 tokenizer.
 */
const CREATE_SESSION_ENTRIES_SQL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS session_entries USING fts5(
    session_id,
    project_path,
    timestamp,
    role,
    content,
    tool_name,
    tool_input,
    tool_result,
    file_path,
    line_number,
    tokenize = 'porter unicode61'
  );
`;

/**
 * SQL to create the indexed files metadata table.
 * Tracks which files have been indexed and when.
 */
const CREATE_INDEXED_FILES_SQL = `
  CREATE TABLE IF NOT EXISTS indexed_files (
    file_path TEXT PRIMARY KEY,
    project_path TEXT NOT NULL,
    last_modified INTEGER NOT NULL,
    entry_count INTEGER NOT NULL,
    indexed_at TEXT NOT NULL
  );
`;

/**
 * SQL to create the sessions summary table.
 * Provides quick lookups without full-text search.
 */
const CREATE_SESSIONS_SQL = `
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    project_path TEXT NOT NULL,
    first_timestamp TEXT,
    last_timestamp TEXT,
    entry_count INTEGER DEFAULT 0,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cache_tokens INTEGER DEFAULT 0,
    compression_count INTEGER DEFAULT 0,
    model TEXT,
    cli_version TEXT
  );
`;

/**
 * SQL to create the session tools table.
 * Tracks tool usage per session.
 */
const CREATE_SESSION_TOOLS_SQL = `
  CREATE TABLE IF NOT EXISTS session_tools (
    session_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    category TEXT NOT NULL,
    call_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    PRIMARY KEY (session_id, tool_name),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
  );
`;

/**
 * SQL to create the schema version table.
 * Used for migration tracking.
 */
const CREATE_SCHEMA_VERSION_SQL = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`;

/**
 * Index for faster project path lookups on sessions.
 */
const CREATE_SESSIONS_PROJECT_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path);
`;

/**
 * Index for faster timestamp range queries on sessions.
 */
const CREATE_SESSIONS_TIMESTAMP_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_sessions_timestamp ON sessions(first_timestamp);
`;

/**
 * Index for faster file path lookups on indexed_files.
 */
const CREATE_INDEXED_FILES_PROJECT_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_indexed_files_project ON indexed_files(project_path);
`;

// =============================================================================
// Database Initialization
// =============================================================================

/**
 * Options for initializing the FTS5 database.
 */
export interface InitDatabaseOptions {
  /** Path to the database file */
  dbPath: string;
  /** Force recreation of tables (drops existing data) */
  force?: boolean;
}

/**
 * Result of database initialization.
 */
export interface InitDatabaseResult {
  /** Whether initialization succeeded */
  success: boolean;
  /** Path to the database file */
  dbPath: string;
  /** Schema version */
  schemaVersion: number;
  /** Whether migration was performed */
  migrated: boolean;
  /** Previous schema version (if migrated) */
  previousVersion?: number;
}

/**
 * Initialize the FTS5 database for session search.
 *
 * Creates the database file and all required tables if they don't exist.
 * Handles schema migrations if the database exists with an older schema.
 *
 * @param options - Initialization options
 * @returns Result of initialization
 */
export async function initDatabase(options: InitDatabaseOptions): Promise<InitDatabaseResult> {
  const { dbPath, force = false } = options;

  // Ensure parent directory exists
  await mkdir(dirname(dbPath), { recursive: true });

  // Open database with WAL mode for better concurrency
  const db = new Database(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  try {
    if (force) {
      // Drop existing tables if force is true
      dropAllTables(db);
    }

    // Check current schema version
    const currentVersion = getSchemaVersion(db);

    // Apply migrations if needed
    if (currentVersion < SCHEMA_VERSION) {
      migrateSchema(db, currentVersion, SCHEMA_VERSION);
    } else if (currentVersion === 0) {
      // Fresh database - create all tables
      createAllTables(db);
      setSchemaVersion(db, SCHEMA_VERSION);
    }

    const migrated = currentVersion > 0 && currentVersion < SCHEMA_VERSION;
    const result: InitDatabaseResult = {
      success: true,
      dbPath,
      schemaVersion: SCHEMA_VERSION,
      migrated,
    };
    if (currentVersion > 0) {
      result.previousVersion = currentVersion;
    }
    return result;
  } finally {
    db.close();
  }
}

/**
 * Open an existing FTS5 database.
 *
 * @param dbPath - Path to the database file
 * @returns Database instance
 * @throws Error if database doesn't exist or has invalid schema
 */
export function openDatabase(dbPath: string): Database {
  const db = new Database(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Verify schema version
  const version = getSchemaVersion(db);
  if (version !== SCHEMA_VERSION) {
    db.close();
    throw new Error(
      `Database schema version mismatch: expected ${SCHEMA_VERSION}, got ${version}. ` +
        `Run initDatabase with force=true to recreate.`
    );
  }

  return db;
}

/**
 * Close a database connection safely.
 *
 * @param db - Database instance to close
 */
export function closeDatabase(db: Database): void {
  db.close();
}

// =============================================================================
// Schema Management
// =============================================================================

/**
 * Get the current schema version from the database.
 *
 * @param db - Database instance
 * @returns Current schema version (0 if no version table exists)
 */
export function getSchemaVersion(db: Database): number {
  try {
    const result = db
      .query<{ version: number }, []>('SELECT MAX(version) as version FROM schema_version')
      .get();
    return result?.version ?? 0;
  } catch {
    // Table doesn't exist
    return 0;
  }
}

/**
 * Set the schema version in the database.
 *
 * @param db - Database instance
 * @param version - Version to set
 */
function setSchemaVersion(db: Database, version: number): void {
  db.run('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [
    version,
    new Date().toISOString(),
  ]);
}

/**
 * Create all tables for a fresh database.
 *
 * @param db - Database instance
 */
function createAllTables(db: Database): void {
  db.exec(CREATE_SCHEMA_VERSION_SQL);
  db.exec(CREATE_SESSION_ENTRIES_SQL);
  db.exec(CREATE_INDEXED_FILES_SQL);
  db.exec(CREATE_SESSIONS_SQL);
  db.exec(CREATE_SESSION_TOOLS_SQL);
  db.exec(CREATE_SESSIONS_PROJECT_INDEX_SQL);
  db.exec(CREATE_SESSIONS_TIMESTAMP_INDEX_SQL);
  db.exec(CREATE_INDEXED_FILES_PROJECT_INDEX_SQL);
}

/**
 * Drop all tables (used for force recreation).
 *
 * @param db - Database instance
 */
function dropAllTables(db: Database): void {
  // Must drop FTS5 table first
  db.exec('DROP TABLE IF EXISTS session_entries;');
  db.exec('DROP TABLE IF EXISTS session_tools;');
  db.exec('DROP TABLE IF EXISTS sessions;');
  db.exec('DROP TABLE IF EXISTS indexed_files;');
  db.exec('DROP TABLE IF EXISTS schema_version;');
}

// =============================================================================
// Schema Migrations
// =============================================================================

/**
 * Migration function type.
 */
type MigrationFn = (db: Database) => void;

/**
 * Migration registry - maps version to migration function.
 * Each migration upgrades from (version - 1) to version.
 */
const migrations: Record<number, MigrationFn> = {
  // Version 1 is the initial schema - no migration needed
  // Future migrations would be added here:
  // 2: (db) => { db.exec('ALTER TABLE sessions ADD COLUMN new_field TEXT;'); },
};

/**
 * Migrate the database schema from one version to another.
 *
 * @param db - Database instance
 * @param fromVersion - Current version
 * @param toVersion - Target version
 */
function migrateSchema(db: Database, fromVersion: number, toVersion: number): void {
  if (fromVersion === 0) {
    // Fresh database - create all tables
    createAllTables(db);
    setSchemaVersion(db, toVersion);
    return;
  }

  // Apply migrations sequentially
  for (let version = fromVersion + 1; version <= toVersion; version++) {
    const migration = migrations[version];
    if (migration) {
      db.transaction(() => {
        migration(db);
        setSchemaVersion(db, version);
      })();
    } else {
      // No migration function - just update version
      // This can happen if only adding new optional columns
      setSchemaVersion(db, version);
    }
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a table exists in the database.
 *
 * @param db - Database instance
 * @param tableName - Name of the table to check
 * @returns True if table exists
 */
export function tableExists(db: Database, tableName: string): boolean {
  const result = db
    .query<
      { count: number },
      [string]
    >("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?")
    .get(tableName);
  return (result?.count ?? 0) > 0;
}

/**
 * Get database statistics.
 *
 * @param db - Database instance
 * @returns Statistics about the database
 */
export function getDatabaseStats(db: Database): {
  schemaVersion: number;
  sessionCount: number;
  entryCount: number;
  indexedFileCount: number;
} {
  const schemaVersion = getSchemaVersion(db);

  const sessionCount =
    db.query<{ count: number }, []>('SELECT COUNT(*) as count FROM sessions').get()?.count ?? 0;

  // FTS5 tables need special handling for row count
  const entryCount =
    db.query<{ count: number }, []>('SELECT COUNT(*) as count FROM session_entries').get()?.count ??
    0;

  const indexedFileCount =
    db.query<{ count: number }, []>('SELECT COUNT(*) as count FROM indexed_files').get()?.count ??
    0;

  return {
    schemaVersion,
    sessionCount,
    entryCount,
    indexedFileCount,
  };
}

// =============================================================================
// Types for Search Operations
// =============================================================================

/**
 * A session entry for indexing in FTS5.
 */
export interface SessionEntry {
  /** Unique session identifier */
  sessionId: string;
  /** Path to the project */
  projectPath: string;
  /** ISO timestamp of the entry */
  timestamp: string;
  /** Role: 'user', 'assistant', or 'tool' */
  role: 'user' | 'assistant' | 'tool';
  /** Content of the message */
  content: string;
  /** Tool name if role is 'tool' */
  toolName?: string;
  /** Tool input JSON if role is 'tool' */
  toolInput?: string;
  /** Tool result if role is 'tool' */
  toolResult?: string;
  /** File path if relevant */
  filePath?: string;
  /** Line number if relevant */
  lineNumber?: number;
}

/**
 * Session metadata.
 */
export interface SessionMetadata {
  /** Unique session identifier */
  sessionId: string;
  /** Path to the project */
  projectPath: string;
  /** First entry timestamp */
  firstTimestamp?: string;
  /** Last entry timestamp */
  lastTimestamp?: string;
  /** Number of entries */
  entryCount: number;
  /** Total input tokens */
  inputTokens: number;
  /** Total output tokens */
  outputTokens: number;
  /** Cache tokens used */
  cacheTokens: number;
  /** Number of context compressions */
  compressionCount: number;
  /** Model used */
  model?: string;
  /** CLI version */
  cliVersion?: string;
}

/**
 * Tool usage statistics for a session.
 */
export interface SessionToolUsage {
  /** Session identifier */
  sessionId: string;
  /** Tool name */
  toolName: string;
  /** Tool category */
  category: string;
  /** Number of calls */
  callCount: number;
  /** Number of errors */
  errorCount: number;
}

/**
 * Search result from FTS5 query.
 */
export interface SearchResult {
  /** Session identifier */
  sessionId: string;
  /** Project path */
  projectPath: string;
  /** Entry timestamp */
  timestamp: string;
  /** Role of the entry */
  role: string;
  /** Content of the entry */
  content: string;
  /** Tool name if applicable */
  toolName?: string;
  /** File path if applicable */
  filePath?: string;
  /** BM25 relevance rank (lower is better) */
  rank: number;
  /** Highlighted snippet with match markers */
  snippet?: string;
}

/**
 * Options for searching sessions.
 */
export interface SearchOptions {
  /** Project path to filter by */
  projectPath?: string;
  /** Session ID to filter by */
  sessionId?: string;
  /** Role to filter by */
  role?: 'user' | 'assistant' | 'tool';
  /** Start timestamp (inclusive) */
  startTime?: string;
  /** End timestamp (inclusive) */
  endTime?: string;
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Include highlighted snippets */
  includeSnippets?: boolean;
}

// =============================================================================
// Session Entry Operations
// =============================================================================

/**
 * Insert a session entry into the FTS5 index.
 *
 * @param db - Database instance
 * @param entry - Session entry to index
 */
export function insertSessionEntry(db: Database, entry: SessionEntry): void {
  const stmt = db.prepare(`
    INSERT INTO session_entries (
      session_id, project_path, timestamp, role, content,
      tool_name, tool_input, tool_result, file_path, line_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    entry.sessionId,
    entry.projectPath,
    entry.timestamp,
    entry.role,
    entry.content,
    entry.toolName ?? '',
    entry.toolInput ?? '',
    entry.toolResult ?? '',
    entry.filePath ?? '',
    entry.lineNumber ?? 0
  );
}

/**
 * Insert multiple session entries in a transaction.
 *
 * @param db - Database instance
 * @param entries - Session entries to index
 */
export function insertSessionEntries(db: Database, entries: SessionEntry[]): void {
  const stmt = db.prepare(`
    INSERT INTO session_entries (
      session_id, project_path, timestamp, role, content,
      tool_name, tool_input, tool_result, file_path, line_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const entry of entries) {
      stmt.run(
        entry.sessionId,
        entry.projectPath,
        entry.timestamp,
        entry.role,
        entry.content,
        entry.toolName ?? '',
        entry.toolInput ?? '',
        entry.toolResult ?? '',
        entry.filePath ?? '',
        entry.lineNumber ?? 0
      );
    }
  })();
}

/**
 * Delete all entries for a session from the FTS5 index.
 *
 * @param db - Database instance
 * @param sessionId - Session identifier
 * @returns Number of entries deleted
 */
export function deleteSessionEntries(db: Database, sessionId: string): number {
  const result = db.run('DELETE FROM session_entries WHERE session_id = ?', [sessionId]);
  return result.changes;
}

// =============================================================================
// Session Metadata Operations
// =============================================================================

/**
 * Create or update session metadata.
 *
 * @param db - Database instance
 * @param metadata - Session metadata
 */
export function upsertSession(db: Database, metadata: SessionMetadata): void {
  const stmt = db.prepare(`
    INSERT INTO sessions (
      session_id, project_path, first_timestamp, last_timestamp,
      entry_count, input_tokens, output_tokens, cache_tokens,
      compression_count, model, cli_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      first_timestamp = COALESCE(excluded.first_timestamp, first_timestamp),
      last_timestamp = excluded.last_timestamp,
      entry_count = excluded.entry_count,
      input_tokens = excluded.input_tokens,
      output_tokens = excluded.output_tokens,
      cache_tokens = excluded.cache_tokens,
      compression_count = excluded.compression_count,
      model = COALESCE(excluded.model, model),
      cli_version = COALESCE(excluded.cli_version, cli_version)
  `);

  stmt.run(
    metadata.sessionId,
    metadata.projectPath,
    metadata.firstTimestamp ?? null,
    metadata.lastTimestamp ?? null,
    metadata.entryCount,
    metadata.inputTokens,
    metadata.outputTokens,
    metadata.cacheTokens,
    metadata.compressionCount,
    metadata.model ?? null,
    metadata.cliVersion ?? null
  );
}

/**
 * Get session metadata by ID.
 *
 * @param db - Database instance
 * @param sessionId - Session identifier
 * @returns Session metadata or null if not found
 */
export function getSession(db: Database, sessionId: string): SessionMetadata | null {
  const row = db
    .query<SessionRow, [string]>(
      `SELECT session_id, project_path, first_timestamp, last_timestamp,
              entry_count, input_tokens, output_tokens, cache_tokens,
              compression_count, model, cli_version
       FROM sessions WHERE session_id = ?`
    )
    .get(sessionId);

  return row ? sessionRowToMetadata(row) : null;
}

/**
 * List sessions with optional filtering.
 *
 * @param db - Database instance
 * @param options - Filter options
 * @returns Array of session metadata
 */
export function listSessions(
  db: Database,
  options: {
    projectPath?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'first_timestamp' | 'last_timestamp' | 'entry_count';
    order?: 'asc' | 'desc';
  } = {}
): SessionMetadata[] {
  let sql = `
    SELECT session_id, project_path, first_timestamp, last_timestamp,
           entry_count, input_tokens, output_tokens, cache_tokens,
           compression_count, model, cli_version
    FROM sessions WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (options.projectPath) {
    sql += ' AND project_path = ?';
    params.push(options.projectPath);
  }

  const orderBy = options.orderBy ?? 'last_timestamp';
  const order = options.order === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${orderBy} ${order}`;

  if (options.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  if (options.offset) {
    sql += ' OFFSET ?';
    params.push(options.offset);
  }

  const rows = db.query<SessionRow, (string | number)[]>(sql).all(...params);
  return rows.map(sessionRowToMetadata);
}

/**
 * Delete a session and all its entries.
 *
 * @param db - Database instance
 * @param sessionId - Session identifier
 * @returns True if session was deleted
 */
export function deleteSession(db: Database, sessionId: string): boolean {
  return db.transaction(() => {
    // Delete FTS5 entries first
    db.run('DELETE FROM session_entries WHERE session_id = ?', [sessionId]);
    // Delete tool usage
    db.run('DELETE FROM session_tools WHERE session_id = ?', [sessionId]);
    // Delete session metadata
    const result = db.run('DELETE FROM sessions WHERE session_id = ?', [sessionId]);
    return result.changes > 0;
  })();
}

// =============================================================================
// Tool Usage Operations
// =============================================================================

/**
 * Record tool usage for a session.
 *
 * @param db - Database instance
 * @param usage - Tool usage data
 */
export function upsertToolUsage(db: Database, usage: SessionToolUsage): void {
  const stmt = db.prepare(`
    INSERT INTO session_tools (session_id, tool_name, category, call_count, error_count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(session_id, tool_name) DO UPDATE SET
      call_count = call_count + excluded.call_count,
      error_count = error_count + excluded.error_count
  `);

  stmt.run(usage.sessionId, usage.toolName, usage.category, usage.callCount, usage.errorCount);
}

/**
 * Get tool usage for a session.
 *
 * @param db - Database instance
 * @param sessionId - Session identifier
 * @returns Array of tool usage data
 */
export function getToolUsage(db: Database, sessionId: string): SessionToolUsage[] {
  const rows = db
    .query<ToolUsageRow, [string]>(
      `SELECT session_id, tool_name, category, call_count, error_count
       FROM session_tools WHERE session_id = ?
       ORDER BY call_count DESC`
    )
    .all(sessionId);

  return rows.map((row) => ({
    sessionId: row.session_id,
    toolName: row.tool_name,
    category: row.category,
    callCount: row.call_count,
    errorCount: row.error_count,
  }));
}

// =============================================================================
// FTS5 Search Operations
// =============================================================================

/**
 * Search session entries using FTS5 full-text search.
 *
 * Uses BM25 ranking for relevance sorting.
 *
 * @param db - Database instance
 * @param query - FTS5 search query (supports AND, OR, NOT, phrases, etc.)
 * @param options - Search options
 * @returns Array of search results
 */
export function searchSessions(
  db: Database,
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  // Escape the query for FTS5 (double quotes for exact phrase if needed)
  const ftsQuery = escapeForFts5(query);

  // Build the WHERE clause with optional filters
  const whereClauses = ['session_entries MATCH ?'];
  const params: (string | number)[] = [ftsQuery];

  if (options.projectPath) {
    whereClauses.push('project_path = ?');
    params.push(options.projectPath);
  }

  if (options.sessionId) {
    whereClauses.push('session_id = ?');
    params.push(options.sessionId);
  }

  if (options.role) {
    whereClauses.push('role = ?');
    params.push(options.role);
  }

  if (options.startTime) {
    whereClauses.push('timestamp >= ?');
    params.push(options.startTime);
  }

  if (options.endTime) {
    whereClauses.push('timestamp <= ?');
    params.push(options.endTime);
  }

  const whereClause = whereClauses.join(' AND ');

  // Build SELECT with optional snippet
  const snippetSelect = options.includeSnippets
    ? ", snippet(session_entries, 4, '<mark>', '</mark>', '...', 64) as snippet"
    : '';

  let sql = `
    SELECT session_id, project_path, timestamp, role, content,
           tool_name, file_path, bm25(session_entries) as rank
           ${snippetSelect}
    FROM session_entries
    WHERE ${whereClause}
    ORDER BY rank
  `;

  if (options.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  if (options.offset) {
    sql += ' OFFSET ?';
    params.push(options.offset);
  }

  const rows = db.query<SearchResultRow, (string | number)[]>(sql).all(...params);

  return rows.map((row) => ({
    sessionId: row.session_id,
    projectPath: row.project_path,
    timestamp: row.timestamp,
    role: row.role,
    content: row.content,
    ...(row.tool_name && { toolName: row.tool_name }),
    ...(row.file_path && { filePath: row.file_path }),
    rank: row.rank,
    ...(row.snippet && { snippet: row.snippet }),
  }));
}

/**
 * Search for sessions containing specific content and return matching session IDs.
 *
 * @param db - Database instance
 * @param query - FTS5 search query
 * @param options - Search options
 * @returns Array of session IDs with match counts
 */
export function findSessionsWithContent(
  db: Database,
  query: string,
  options: {
    projectPath?: string;
    limit?: number;
  } = {}
): Array<{ sessionId: string; matchCount: number }> {
  const ftsQuery = escapeForFts5(query);

  const whereClauses = ['session_entries MATCH ?'];
  const params: (string | number)[] = [ftsQuery];

  if (options.projectPath) {
    whereClauses.push('project_path = ?');
    params.push(options.projectPath);
  }

  const whereClause = whereClauses.join(' AND ');

  let sql = `
    SELECT session_id, COUNT(*) as match_count
    FROM session_entries
    WHERE ${whereClause}
    GROUP BY session_id
    ORDER BY match_count DESC
  `;

  if (options.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  const rows = db
    .query<{ session_id: string; match_count: number }, (string | number)[]>(sql)
    .all(...params);

  return rows.map((row) => ({
    sessionId: row.session_id,
    matchCount: row.match_count,
  }));
}

/**
 * Get entries for a specific session.
 *
 * @param db - Database instance
 * @param sessionId - Session identifier
 * @param options - Pagination options
 * @returns Array of session entries
 */
export function getSessionEntries(
  db: Database,
  sessionId: string,
  options: { limit?: number; offset?: number } = {}
): SessionEntry[] {
  let sql = `
    SELECT session_id, project_path, timestamp, role, content,
           tool_name, tool_input, tool_result, file_path, line_number
    FROM session_entries
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `;
  const params: (string | number)[] = [sessionId];

  if (options.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  if (options.offset) {
    sql += ' OFFSET ?';
    params.push(options.offset);
  }

  const rows = db.query<EntryRow, (string | number)[]>(sql).all(...params);

  return rows.map((row) => ({
    sessionId: row.session_id,
    projectPath: row.project_path,
    timestamp: row.timestamp,
    role: row.role as SessionEntry['role'],
    content: row.content,
    ...(row.tool_name && { toolName: row.tool_name }),
    ...(row.tool_input && { toolInput: row.tool_input }),
    ...(row.tool_result && { toolResult: row.tool_result }),
    ...(row.file_path && { filePath: row.file_path }),
    ...(row.line_number && { lineNumber: row.line_number }),
  }));
}

/**
 * Count total entries matching a search query.
 *
 * @param db - Database instance
 * @param query - FTS5 search query
 * @param options - Filter options
 * @returns Total count of matching entries
 */
export function countSearchResults(
  db: Database,
  query: string,
  options: Pick<SearchOptions, 'projectPath' | 'sessionId' | 'role'> = {}
): number {
  const ftsQuery = escapeForFts5(query);

  const whereClauses = ['session_entries MATCH ?'];
  const params: (string | number)[] = [ftsQuery];

  if (options.projectPath) {
    whereClauses.push('project_path = ?');
    params.push(options.projectPath);
  }

  if (options.sessionId) {
    whereClauses.push('session_id = ?');
    params.push(options.sessionId);
  }

  if (options.role) {
    whereClauses.push('role = ?');
    params.push(options.role);
  }

  const whereClause = whereClauses.join(' AND ');

  const result = db
    .query<{ count: number }, (string | number)[]>(
      `SELECT COUNT(*) as count FROM session_entries WHERE ${whereClause}`
    )
    .get(...params);

  return result?.count ?? 0;
}

// =============================================================================
// Indexed Files Tracking
// =============================================================================

/**
 * Record a file as indexed.
 *
 * @param db - Database instance
 * @param filePath - Path to the indexed file
 * @param projectPath - Project path
 * @param lastModified - Last modified timestamp (ms since epoch)
 * @param entryCount - Number of entries indexed from this file
 */
export function recordIndexedFile(
  db: Database,
  filePath: string,
  projectPath: string,
  lastModified: number,
  entryCount: number
): void {
  const stmt = db.prepare(`
    INSERT INTO indexed_files (file_path, project_path, last_modified, entry_count, indexed_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(file_path) DO UPDATE SET
      last_modified = excluded.last_modified,
      entry_count = excluded.entry_count,
      indexed_at = excluded.indexed_at
  `);

  stmt.run(filePath, projectPath, lastModified, entryCount, new Date().toISOString());
}

/**
 * Check if a file needs reindexing.
 *
 * @param db - Database instance
 * @param filePath - Path to the file
 * @param lastModified - Current last modified timestamp
 * @returns True if file needs reindexing
 */
export function needsReindex(db: Database, filePath: string, lastModified: number): boolean {
  const row = db
    .query<{ last_modified: number }, [string]>(
      'SELECT last_modified FROM indexed_files WHERE file_path = ?'
    )
    .get(filePath);

  return !row || row.last_modified < lastModified;
}

/**
 * Get list of indexed files for a project.
 *
 * @param db - Database instance
 * @param projectPath - Project path
 * @returns Array of indexed file info
 */
export function getIndexedFiles(
  db: Database,
  projectPath: string
): Array<{
  filePath: string;
  lastModified: number;
  entryCount: number;
  indexedAt: string;
}> {
  const rows = db
    .query<
      { file_path: string; last_modified: number; entry_count: number; indexed_at: string },
      [string]
    >('SELECT file_path, last_modified, entry_count, indexed_at FROM indexed_files WHERE project_path = ?')
    .all(projectPath);

  return rows.map((row) => ({
    filePath: row.file_path,
    lastModified: row.last_modified,
    entryCount: row.entry_count,
    indexedAt: row.indexed_at,
  }));
}

/**
 * Remove indexed file record.
 *
 * @param db - Database instance
 * @param filePath - Path to the file
 * @returns True if record was removed
 */
export function removeIndexedFile(db: Database, filePath: string): boolean {
  const result = db.run('DELETE FROM indexed_files WHERE file_path = ?', [filePath]);
  return result.changes > 0;
}

// =============================================================================
// Internal Row Types
// =============================================================================

interface SessionRow {
  session_id: string;
  project_path: string;
  first_timestamp: string | null;
  last_timestamp: string | null;
  entry_count: number;
  input_tokens: number;
  output_tokens: number;
  cache_tokens: number;
  compression_count: number;
  model: string | null;
  cli_version: string | null;
}

interface ToolUsageRow {
  session_id: string;
  tool_name: string;
  category: string;
  call_count: number;
  error_count: number;
}

interface SearchResultRow {
  session_id: string;
  project_path: string;
  timestamp: string;
  role: string;
  content: string;
  tool_name: string | null;
  file_path: string | null;
  rank: number;
  snippet?: string;
}

interface EntryRow {
  session_id: string;
  project_path: string;
  timestamp: string;
  role: string;
  content: string;
  tool_name: string | null;
  tool_input: string | null;
  tool_result: string | null;
  file_path: string | null;
  line_number: number | null;
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Convert a database row to session metadata.
 */
function sessionRowToMetadata(row: SessionRow): SessionMetadata {
  return {
    sessionId: row.session_id,
    projectPath: row.project_path,
    ...(row.first_timestamp && { firstTimestamp: row.first_timestamp }),
    ...(row.last_timestamp && { lastTimestamp: row.last_timestamp }),
    entryCount: row.entry_count,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheTokens: row.cache_tokens,
    compressionCount: row.compression_count,
    ...(row.model && { model: row.model }),
    ...(row.cli_version && { cliVersion: row.cli_version }),
  };
}

/**
 * Escape a query string for FTS5 MATCH syntax.
 *
 * Handles special characters and provides safe query construction.
 * Users can use FTS5 operators like AND, OR, NOT, phrases ("..."), etc.
 *
 * @param query - User query string
 * @returns Escaped query safe for FTS5
 */
function escapeForFts5(query: string): string {
  // If query contains FTS5 operators, pass through as-is
  if (/\bAND\b|\bOR\b|\bNOT\b|".*"|[()]|\*/i.test(query)) {
    return query;
  }

  // For simple queries, escape special characters
  // FTS5 special chars: " * ( ) : ^
  return query
    .replace(/"/g, '""')
    .replace(/[*():^]/g, ' ')
    .trim();
}
