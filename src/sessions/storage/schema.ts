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
 * Combined schema for all EP15 tables.
 */
export const EP15_SESSION_INTELLIGENCE_SCHEMA = `
  ${TOOL_CALL_SEQUENCES_SCHEMA}
  ${FILE_ACCESSES_SCHEMA}
  ${COMPRESSION_EVENTS_SCHEMA}
  ${DELEGATION_EVENTS_SCHEMA}
  ${MCP_TOOL_CALLS_SCHEMA}
  ${QUALITY_SIGNALS_SCHEMA}
`;

/**
 * Schema version for migrations.
 * Corresponds to SESSIONS_DB_SCHEMA_VERSION = 3 in persistence/schemas.ts
 */
export const EP15_SCHEMA_VERSION = '3.0.0';

/**
 * List of all EP15 tables for existence checks.
 */
export const EP15_TABLES = [
  'tool_call_sequences',
  'file_accesses',
  'compression_events',
  'delegation_events',
  'mcp_tool_calls',
  'quality_signals',
] as const;

export type EP15TableName = (typeof EP15_TABLES)[number];

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
  db.exec(EP15_SESSION_INTELLIGENCE_SCHEMA);
}

/**
 * Check if a specific EP15 table exists.
 *
 * @param db - The SQLite database instance
 * @param tableName - Name of the table to check
 * @returns True if the table exists
 */
export function tableExists(db: Database, tableName: EP15TableName): boolean {
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
  return EP15_TABLES.every((table) => tableExists(db, table));
}

/**
 * Get list of missing EP15 tables.
 *
 * @param db - The SQLite database instance
 * @returns Array of table names that are missing
 */
export function getMissingTables(db: Database): EP15TableName[] {
  return EP15_TABLES.filter((table) => !tableExists(db, table));
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
export function getTableRowCount(db: Database, tableName: EP15TableName): number {
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
export function getAllTableRowCounts(db: Database): Record<EP15TableName, number> {
  return EP15_TABLES.reduce(
    (acc, table) => {
      acc[table] = getTableRowCount(db, table);
      return acc;
    },
    {} as Record<EP15TableName, number>
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
  for (const table of EP15_TABLES) {
    if (tableExists(db, table)) {
      db.prepare(`DELETE FROM ${table} WHERE session_id = ?`).run(sessionId);
    }
  }
}
