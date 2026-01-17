/**
 * EP07 Causal Tracing Engine - SQLite Schema
 *
 * Schema definitions for causal chain persistence.
 * Extends the EP06 sessions database with causal tracing tables.
 *
 * @module persistence/causal/schema
 */

import type { Database } from 'bun:sqlite';

// =============================================================================
// Schema Version
// =============================================================================

/**
 * Current causal schema version.
 * Increment when schema changes require migration.
 */
export const CAUSAL_SCHEMA_VERSION = 1;

// =============================================================================
// SQL Schema Definitions
// =============================================================================

/**
 * SQL to create the causal chains table.
 * Main table for storing traced causal chains.
 */
const CREATE_CAUSAL_CHAINS_SQL = `
  CREATE TABLE IF NOT EXISTS causal_chains (
    id TEXT PRIMARY KEY,
    issue_id TEXT NOT NULL,
    trigger_summary TEXT,
    gap_type TEXT,
    gap_location TEXT,
    gap_expected_guidance TEXT,
    gap_counterfactual TEXT,
    mechanism TEXT NOT NULL,
    effect TEXT NOT NULL,
    confidence_overall TEXT CHECK (confidence_overall IN ('high', 'medium', 'low')),
    confidence_specificity INTEGER DEFAULT 0,
    confidence_temporal INTEGER DEFAULT 0,
    confidence_mechanistic INTEGER DEFAULT 0,
    confidence_evidence_quality INTEGER DEFAULT 0,
    confidence_reproducibility INTEGER DEFAULT 0,
    confidence_alternatives INTEGER DEFAULT 0,
    depth INTEGER DEFAULT 0 CHECK (depth >= 0 AND depth <= 5),
    depth_limit_reached INTEGER DEFAULT 0,
    project_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    counterfactual TEXT,
    pattern_id TEXT
  );
`;

/**
 * SQL to create the evidence items table.
 * Individual pieces of evidence supporting causal chains.
 */
const CREATE_EVIDENCE_ITEMS_SQL = `
  CREATE TABLE IF NOT EXISTS evidence_items (
    id TEXT PRIMARY KEY,
    chain_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('SessionMatch', 'GitCorrelation', 'ConfigGap', 'TemporalMarker', 'ToolTrace')),
    source TEXT NOT NULL,
    timestamp TEXT,
    content TEXT,
    file_path TEXT,
    line_number INTEGER,
    column_number INTEGER,
    snippet TEXT,
    metadata TEXT,
    sequence INTEGER NOT NULL,
    FOREIGN KEY (chain_id) REFERENCES causal_chains(id) ON DELETE CASCADE
  );
`;

/**
 * SQL to create the issue patterns table.
 * Aggregates recurring issue patterns across sessions.
 */
const CREATE_ISSUE_PATTERNS_SQL = `
  CREATE TABLE IF NOT EXISTS issue_patterns (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('missing_config', 'missing_example', 'missing_guidance', 'terminology_gap', 'context_loss', 'other')),
    frequency INTEGER DEFAULT 1,
    is_systemic INTEGER DEFAULT 0,
    first_occurrence TEXT NOT NULL,
    last_occurrence TEXT NOT NULL,
    project_path TEXT,
    summary TEXT NOT NULL
  );
`;

/**
 * SQL to create the chain-pattern junction table.
 * Many-to-many relationship between chains and patterns.
 */
const CREATE_CHAIN_PATTERNS_SQL = `
  CREATE TABLE IF NOT EXISTS chain_patterns (
    chain_id TEXT NOT NULL,
    pattern_id TEXT NOT NULL,
    PRIMARY KEY (chain_id, pattern_id),
    FOREIGN KEY (chain_id) REFERENCES causal_chains(id) ON DELETE CASCADE,
    FOREIGN KEY (pattern_id) REFERENCES issue_patterns(id) ON DELETE CASCADE
  );
`;

/**
 * SQL to create the causal schema version table.
 * Separate from session schema version for independent migration.
 */
const CREATE_CAUSAL_SCHEMA_VERSION_SQL = `
  CREATE TABLE IF NOT EXISTS causal_schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`;

// =============================================================================
// Indexes
// =============================================================================

/**
 * Index for faster project path lookups on chains.
 */
const CREATE_CHAINS_PROJECT_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_causal_chains_project ON causal_chains(project_path);
`;

/**
 * Index for faster timestamp queries on chains.
 */
const CREATE_CHAINS_CREATED_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_causal_chains_created ON causal_chains(created_at);
`;

/**
 * Index for faster chain lookups on evidence items.
 */
const CREATE_EVIDENCE_CHAIN_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_evidence_items_chain ON evidence_items(chain_id);
`;

/**
 * Index for faster category lookups on patterns.
 */
const CREATE_PATTERNS_CATEGORY_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_issue_patterns_category ON issue_patterns(category);
`;

/**
 * Index for faster pattern_id lookups on chains.
 */
const CREATE_CHAINS_PATTERN_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_causal_chains_pattern ON causal_chains(pattern_id);
`;

// =============================================================================
// Schema Management
// =============================================================================

/**
 * Check if causal tables exist in the database.
 *
 * @param db - Database instance
 * @returns True if causal_chains table exists
 */
export function causalTablesExist(db: Database): boolean {
  const result = db
    .query<
      { count: number },
      [string]
    >("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?")
    .get('causal_chains');
  return (result?.count ?? 0) > 0;
}

/**
 * Get the current causal schema version from the database.
 *
 * @param db - Database instance
 * @returns Current schema version (0 if no version table exists)
 */
export function getCausalSchemaVersion(db: Database): number {
  try {
    const result = db
      .query<{ version: number }, []>('SELECT MAX(version) as version FROM causal_schema_version')
      .get();
    return result?.version ?? 0;
  } catch {
    // Table doesn't exist
    return 0;
  }
}

/**
 * Set the causal schema version in the database.
 *
 * @param db - Database instance
 * @param version - Version to set
 */
function setCausalSchemaVersion(db: Database, version: number): void {
  db.run('INSERT OR IGNORE INTO causal_schema_version (version, applied_at) VALUES (?, ?)', [
    version,
    new Date().toISOString(),
  ]);
}

/**
 * Create all causal tracing tables.
 *
 * @param db - Database instance
 */
export function createCausalTables(db: Database): void {
  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON;');

  // Create tables
  db.exec(CREATE_CAUSAL_SCHEMA_VERSION_SQL);
  db.exec(CREATE_CAUSAL_CHAINS_SQL);
  db.exec(CREATE_EVIDENCE_ITEMS_SQL);
  db.exec(CREATE_ISSUE_PATTERNS_SQL);
  db.exec(CREATE_CHAIN_PATTERNS_SQL);

  // Create indexes
  db.exec(CREATE_CHAINS_PROJECT_INDEX_SQL);
  db.exec(CREATE_CHAINS_CREATED_INDEX_SQL);
  db.exec(CREATE_EVIDENCE_CHAIN_INDEX_SQL);
  db.exec(CREATE_PATTERNS_CATEGORY_INDEX_SQL);
  db.exec(CREATE_CHAINS_PATTERN_INDEX_SQL);

  // Set version
  setCausalSchemaVersion(db, CAUSAL_SCHEMA_VERSION);
}

/**
 * Drop all causal tracing tables.
 * Use with caution - this deletes all causal chain data.
 *
 * @param db - Database instance
 */
export function dropCausalTables(db: Database): void {
  db.exec('DROP TABLE IF EXISTS chain_patterns;');
  db.exec('DROP TABLE IF EXISTS evidence_items;');
  db.exec('DROP TABLE IF EXISTS issue_patterns;');
  db.exec('DROP TABLE IF EXISTS causal_chains;');
  db.exec('DROP TABLE IF EXISTS causal_schema_version;');
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
  // 2: (db) => { db.exec('ALTER TABLE causal_chains ADD COLUMN new_field TEXT;'); },
};

/**
 * Migrate the causal schema from one version to another.
 *
 * @param db - Database instance
 * @param fromVersion - Current version
 * @param toVersion - Target version
 */
export function migrateCausalSchema(db: Database, fromVersion: number, toVersion: number): void {
  if (fromVersion === 0) {
    // Fresh database - create all tables
    createCausalTables(db);
    return;
  }

  // Apply migrations sequentially
  for (let version = fromVersion + 1; version <= toVersion; version++) {
    const migration = migrations[version];
    if (migration) {
      db.transaction(() => {
        migration(db);
        setCausalSchemaVersion(db, version);
      })();
    } else {
      // No migration function - just update version
      setCausalSchemaVersion(db, version);
    }
  }
}

/**
 * Initialize causal tables in an existing database.
 * Creates tables if they don't exist, migrates if outdated.
 *
 * @param db - Database instance
 * @returns Object with initialization details
 */
export function initCausalSchema(db: Database): {
  created: boolean;
  migrated: boolean;
  version: number;
  previousVersion?: number;
} {
  const currentVersion = getCausalSchemaVersion(db);

  if (currentVersion === 0) {
    // Fresh - create all tables
    createCausalTables(db);
    return { created: true, migrated: false, version: CAUSAL_SCHEMA_VERSION };
  }

  if (currentVersion < CAUSAL_SCHEMA_VERSION) {
    // Migrate
    migrateCausalSchema(db, currentVersion, CAUSAL_SCHEMA_VERSION);
    return {
      created: false,
      migrated: true,
      version: CAUSAL_SCHEMA_VERSION,
      previousVersion: currentVersion,
    };
  }

  // Already at current version
  return { created: false, migrated: false, version: currentVersion };
}
