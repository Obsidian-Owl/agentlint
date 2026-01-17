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
