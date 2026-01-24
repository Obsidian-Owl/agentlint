/**
 * EP15: Session Intelligence - Database Schema
 *
 * SQLite schema for storing session intelligence data:
 * - Tool call sequences with input hashes
 * - File access patterns
 * - Compression events
 * - Delegation events (Task tool calls)
 * - MCP tool calls
 * - Quality signals (test/build/lint outcomes)
 *
 * Extends the existing sessions.db per ADR-0006.
 *
 * @module src/sessions/storage/schema
 */

import type { Database } from 'bun:sqlite';

// =============================================================================
// Schema Definitions
// =============================================================================

/**
 * SQL schema for tool_call_sequences table.
 * Stores tool invocations with input hashes for pattern detection.
 *
 * Note: Per Constitution Principle VII, no judgment columns exist.
 * The agent reasons about "stuck" patterns using input_hash repetition.
 */
export const TOOL_CALL_SEQUENCES_SCHEMA = `
  CREATE TABLE IF NOT EXISTS tool_call_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    input_hash TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    sequence_index INTEGER NOT NULL,
    is_error INTEGER DEFAULT 0,
    error_message TEXT,
    file_path TEXT,
    line_number INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tool_sequences_session
    ON tool_call_sequences(session_id);

  CREATE INDEX IF NOT EXISTS idx_tool_sequences_hash
    ON tool_call_sequences(input_hash);

  CREATE INDEX IF NOT EXISTS idx_tool_sequences_timestamp
    ON tool_call_sequences(timestamp);

  CREATE INDEX IF NOT EXISTS idx_tool_sequences_session_index
    ON tool_call_sequences(session_id, sequence_index);
`;

/**
 * SQL schema for file_accesses table.
 * Stores file operations (read/write/edit) for access pattern analysis.
 */
export const FILE_ACCESSES_SCHEMA = `
  CREATE TABLE IF NOT EXISTS file_accesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    operation TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    access_sequence INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_file_accesses_session
    ON file_accesses(session_id);

  CREATE INDEX IF NOT EXISTS idx_file_accesses_path
    ON file_accesses(file_path);

  CREATE INDEX IF NOT EXISTS idx_file_accesses_session_path
    ON file_accesses(session_id, file_path);
`;

/**
 * SQL schema for compression_events table.
 * Stores context compression occurrences with pre-tokens and saved tokens.
 */
export const COMPRESSION_EVENTS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS compression_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    compression_type TEXT NOT NULL,
    pre_tokens INTEGER,
    tokens_saved INTEGER,
    summary_preserved TEXT,
    file_path TEXT,
    line_number INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_compression_events_session
    ON compression_events(session_id);

  CREATE INDEX IF NOT EXISTS idx_compression_events_timestamp
    ON compression_events(timestamp);
`;

/**
 * SQL schema for delegation_events table.
 * Stores Task tool invocations (subagent spawning).
 */
export const DELEGATION_EVENTS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS delegation_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    subagent_type TEXT NOT NULL,
    task_prompt TEXT,
    timestamp TEXT NOT NULL,
    turn_index INTEGER NOT NULL,
    success INTEGER DEFAULT 1,
    subagent_session_id TEXT,
    file_path TEXT,
    line_number INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_delegation_events_session
    ON delegation_events(session_id);

  CREATE INDEX IF NOT EXISTS idx_delegation_events_subagent_type
    ON delegation_events(subagent_type);
`;

/**
 * SQL schema for mcp_tool_calls table.
 * Stores MCP server tool invocations with server name parsed from prefix.
 */
export const MCP_TOOL_CALLS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS mcp_tool_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    server_name TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    is_error INTEGER DEFAULT 0,
    error_message TEXT,
    file_path TEXT,
    line_number INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_session
    ON mcp_tool_calls(session_id);

  CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_server
    ON mcp_tool_calls(server_name);
`;

/**
 * SQL schema for quality_signals table.
 * Stores test/build/lint outcomes detected from Bash results.
 *
 * Note: passed can be NULL for indeterminate outcomes.
 * The agent interprets raw_output to determine actual pass/fail.
 */
export const QUALITY_SIGNALS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS quality_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    signal_type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    passed INTEGER,
    raw_output TEXT,
    file_path TEXT,
    line_number INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_quality_signals_session
    ON quality_signals(session_id);

  CREATE INDEX IF NOT EXISTS idx_quality_signals_type
    ON quality_signals(signal_type);
`;

/**
 * Numeric schema version for migrations.
 * Increment when adding or modifying EP15 tables.
 *
 * Version history:
 * - 1: Initial session intelligence schema (6 tables)
 */
export const SESSION_INTELLIGENCE_SCHEMA_VERSION = 1;

/**
 * SQL schema for session_intelligence_version table.
 * Tracks session intelligence schema version independently from other extensions.
 */
export const SESSION_INTELLIGENCE_VERSION_TABLE = `
  CREATE TABLE IF NOT EXISTS session_intelligence_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`;

/**
 * Combined schema for all session intelligence data tables (excluding version table).
 */
export const SESSION_INTELLIGENCE_DATA_SCHEMA = `
  ${TOOL_CALL_SEQUENCES_SCHEMA}
  ${FILE_ACCESSES_SCHEMA}
  ${COMPRESSION_EVENTS_SCHEMA}
  ${DELEGATION_EVENTS_SCHEMA}
  ${MCP_TOOL_CALLS_SCHEMA}
  ${QUALITY_SIGNALS_SCHEMA}
`;

/**
 * Full session intelligence schema including version table.
 */
export const SESSION_INTELLIGENCE_FULL_SCHEMA = `
  ${SESSION_INTELLIGENCE_VERSION_TABLE}
  ${SESSION_INTELLIGENCE_DATA_SCHEMA}
`;

/**
 * List of all EP15 data tables for existence checks.
 * Does not include session_intelligence_version which is internal.
 */
export const SESSION_INTELLIGENCE_DATA_TABLES = [
  'tool_call_sequences',
  'file_accesses',
  'compression_events',
  'delegation_events',
  'mcp_tool_calls',
  'quality_signals',
] as const;

export type SessionIntelligenceDataTableName = (typeof SESSION_INTELLIGENCE_DATA_TABLES)[number];

/**
 * List of all EP15 tables including version table.
 */
export const SESSION_INTELLIGENCE_TABLES = [
  ...SESSION_INTELLIGENCE_DATA_TABLES,
  'session_intelligence_version',
] as const;

export type SessionIntelligenceTableName = (typeof SESSION_INTELLIGENCE_TABLES)[number];

// =============================================================================
// Schema Initialization
// =============================================================================

/**
 * Initialize all EP15 session intelligence tables in the database.
 * This function is idempotent - safe to call multiple times.
 *
 * @param db - The SQLite database instance (sessions.db)
 * @throws Error if schema initialization fails
 */
export function initializeSessionIntelligenceSchema(db: Database): void {
  db.exec(SESSION_INTELLIGENCE_FULL_SCHEMA);
}

// =============================================================================
// Schema Version Management
// =============================================================================

/**
 * Get the current EP15 schema version from the database.
 *
 * @param db - The SQLite database instance
 * @returns Current schema version (0 if no version table exists)
 */
export function getSessionIntelligenceSchemaVersion(db: Database): number {
  try {
    const result = db
      .prepare('SELECT MAX(version) as version FROM session_intelligence_version')
      .get() as { version: number | null } | null;
    return result?.version ?? 0;
  } catch {
    // Table doesn't exist
    return 0;
  }
}

/**
 * Set the EP15 schema version in the database.
 *
 * @param db - The SQLite database instance
 * @param version - Version to set
 */
function setSessionIntelligenceSchemaVersion(db: Database, version: number): void {
  db.prepare(
    'INSERT OR IGNORE INTO session_intelligence_version (version, applied_at) VALUES (?, ?)'
  ).run(version, new Date().toISOString());
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
  // 2: (db) => { db.exec('ALTER TABLE tool_call_sequences ADD COLUMN new_field TEXT;'); },
};

/**
 * Migrate the EP15 schema from one version to another.
 *
 * @param db - The SQLite database instance
 * @param fromVersion - Current version
 * @param toVersion - Target version
 */
export function migrateSessionIntelligenceSchema(
  db: Database,
  fromVersion: number,
  toVersion: number
): void {
  if (fromVersion === 0) {
    // Fresh database - create all tables
    initializeSessionIntelligenceSchema(db);
    setSessionIntelligenceSchemaVersion(db, toVersion);
    return;
  }

  // Apply migrations sequentially
  for (let version = fromVersion + 1; version <= toVersion; version++) {
    const migration = migrations[version];
    if (migration) {
      db.transaction(() => {
        migration(db);
        setSessionIntelligenceSchemaVersion(db, version);
      })();
    } else {
      // No migration function - just update version
      setSessionIntelligenceSchemaVersion(db, version);
    }
  }
}

/**
 * Result of EP15 schema initialization.
 */
export interface SessionIntelligenceInitResult {
  /** Whether tables were newly created */
  created: boolean;
  /** Whether migration was performed */
  migrated: boolean;
  /** Current schema version after init */
  version: number;
  /** Previous schema version (if migrated) */
  previousVersion?: number;
}

/**
 * Initialize EP15 session intelligence tables in an existing database.
 * Creates tables if they don't exist, migrates if outdated.
 *
 * This is the primary entry point for EP15 schema setup.
 *
 * @param db - The SQLite database instance (sessions.db)
 * @returns Object with initialization details
 */
export function initSessionIntelligenceSchema(db: Database): SessionIntelligenceInitResult {
  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON;');

  const currentVersion = getSessionIntelligenceSchemaVersion(db);

  if (currentVersion === 0) {
    // Fresh - create all tables
    initializeSessionIntelligenceSchema(db);
    setSessionIntelligenceSchemaVersion(db, SESSION_INTELLIGENCE_SCHEMA_VERSION);
    return { created: true, migrated: false, version: SESSION_INTELLIGENCE_SCHEMA_VERSION };
  }

  if (currentVersion < SESSION_INTELLIGENCE_SCHEMA_VERSION) {
    // Migrate
    migrateSessionIntelligenceSchema(db, currentVersion, SESSION_INTELLIGENCE_SCHEMA_VERSION);
    return {
      created: false,
      migrated: true,
      version: SESSION_INTELLIGENCE_SCHEMA_VERSION,
      previousVersion: currentVersion,
    };
  }

  // Already at current version
  return { created: false, migrated: false, version: currentVersion };
}

/**
 * Check if a specific EP15 table exists.
 *
 * @param db - The SQLite database instance
 * @param tableName - Name of the table to check
 * @returns True if the table exists
 */
export function tableExists(db: Database, tableName: SessionIntelligenceTableName): boolean {
  const result = db
    .prepare(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`)
    .get(tableName) as { count: number } | null;
  return result?.count === 1;
}

/**
 * Check if all EP15 tables exist.
 *
 * @param db - The SQLite database instance
 * @returns True if all tables exist
 */
export function sessionIntelligenceSchemaExists(db: Database): boolean {
  return SESSION_INTELLIGENCE_TABLES.every((table) => tableExists(db, table));
}

/**
 * Get list of missing EP15 tables.
 *
 * @param db - The SQLite database instance
 * @returns Array of table names that are missing
 */
export function getMissingTables(db: Database): SessionIntelligenceTableName[] {
  return SESSION_INTELLIGENCE_TABLES.filter((table) => !tableExists(db, table));
}

/**
 * Drop all EP15 session intelligence tables and indexes.
 * Use with caution - this deletes all indexed session intelligence data.
 *
 * @param db - The SQLite database instance
 */
export function dropSessionIntelligenceSchema(db: Database): void {
  db.exec(`
    -- Drop indexes first
    DROP INDEX IF EXISTS idx_tool_sequences_session;
    DROP INDEX IF EXISTS idx_tool_sequences_hash;
    DROP INDEX IF EXISTS idx_tool_sequences_timestamp;
    DROP INDEX IF EXISTS idx_tool_sequences_session_index;

    DROP INDEX IF EXISTS idx_file_accesses_session;
    DROP INDEX IF EXISTS idx_file_accesses_path;
    DROP INDEX IF EXISTS idx_file_accesses_session_path;

    DROP INDEX IF EXISTS idx_compression_events_session;
    DROP INDEX IF EXISTS idx_compression_events_timestamp;

    DROP INDEX IF EXISTS idx_delegation_events_session;
    DROP INDEX IF EXISTS idx_delegation_events_subagent_type;

    DROP INDEX IF EXISTS idx_mcp_tool_calls_session;
    DROP INDEX IF EXISTS idx_mcp_tool_calls_server;

    DROP INDEX IF EXISTS idx_quality_signals_session;
    DROP INDEX IF EXISTS idx_quality_signals_type;

    -- Drop tables
    DROP TABLE IF EXISTS tool_call_sequences;
    DROP TABLE IF EXISTS file_accesses;
    DROP TABLE IF EXISTS compression_events;
    DROP TABLE IF EXISTS delegation_events;
    DROP TABLE IF EXISTS mcp_tool_calls;
    DROP TABLE IF EXISTS quality_signals;
    DROP TABLE IF EXISTS session_intelligence_version;
  `);
}

// =============================================================================
// Table Statistics
// =============================================================================

/**
 * Get row count for a specific EP15 table.
 *
 * @param db - The SQLite database instance
 * @param tableName - Name of the table
 * @returns Row count, or 0 if table doesn't exist
 */
export function getTableRowCount(db: Database, tableName: SessionIntelligenceTableName): number {
  if (!tableExists(db, tableName)) {
    return 0;
  }
  const result = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as {
    count: number;
  } | null;
  return result?.count ?? 0;
}

/**
 * Get row counts for all EP15 tables.
 *
 * @param db - The SQLite database instance
 * @returns Object with table names as keys and row counts as values
 */
export function getAllTableRowCounts(db: Database): Record<SessionIntelligenceTableName, number> {
  return SESSION_INTELLIGENCE_TABLES.reduce(
    (acc, table) => {
      acc[table] = getTableRowCount(db, table);
      return acc;
    },
    {} as Record<SessionIntelligenceTableName, number>
  );
}

/**
 * Delete all EP15 data for a specific session.
 * Used when re-indexing a session.
 *
 * @param db - The SQLite database instance
 * @param sessionId - Session UUID to delete data for
 */
export function deleteSessionIntelligenceData(db: Database, sessionId: string): void {
  for (const table of SESSION_INTELLIGENCE_TABLES) {
    if (tableExists(db, table)) {
      db.prepare(`DELETE FROM ${table} WHERE session_id = ?`).run(sessionId);
    }
  }
}
