/**
 * EP14: Skills Effectiveness Analysis - Database Schema
 *
 * SQLite schema for storing skill invocations indexed from session logs.
 * Extends the existing sessions.db per ADR-0006.
 *
 * @module src/skills/storage/schema
 */

import type { Database } from 'bun:sqlite';

// =============================================================================
// Schema Definitions
// =============================================================================

/**
 * SQL schema for the skill_invocations table.
 * This table stores skill invocations extracted from session logs.
 *
 * Note: This schema is designed to store FACTS only.
 * Per Constitution Principle VII, no judgment columns exist.
 * The agent reasons about effectiveness using this data.
 */
export const SKILL_INVOCATIONS_SCHEMA = `
  -- Skill invocations indexed from session logs
  CREATE TABLE IF NOT EXISTS skill_invocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    skill_name TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    user_prompt_snippet TEXT,
    file_path TEXT,
    line_number INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
  );

  -- Indexes for common query patterns
  CREATE INDEX IF NOT EXISTS idx_skill_invocations_skill
    ON skill_invocations(skill_name);

  CREATE INDEX IF NOT EXISTS idx_skill_invocations_session
    ON skill_invocations(session_id);

  CREATE INDEX IF NOT EXISTS idx_skill_invocations_timestamp
    ON skill_invocations(timestamp);

  -- Compound index for skill + date range queries
  CREATE INDEX IF NOT EXISTS idx_skill_invocations_skill_time
    ON skill_invocations(skill_name, timestamp);
`;

/**
 * Schema version for migrations.
 */
export const SKILL_INVOCATIONS_SCHEMA_VERSION = '1.0.0';

// =============================================================================
// Schema Initialization
// =============================================================================

/**
 * Initialize the skill_invocations schema in the database.
 * This function is idempotent - safe to call multiple times.
 *
 * @param db - The SQLite database instance (sessions.db)
 * @throws Error if schema initialization fails
 */
export function initializeSkillsSchema(db: Database): void {
  db.exec(SKILL_INVOCATIONS_SCHEMA);
}

/**
 * Check if the skill_invocations table exists.
 *
 * @param db - The SQLite database instance
 * @returns True if the table exists
 */
export function skillsSchemaExists(db: Database): boolean {
  const result = db
    .prepare(
      `SELECT COUNT(*) as count FROM sqlite_master
       WHERE type='table' AND name='skill_invocations'`
    )
    .get() as { count: number } | null;
  return result?.count === 1;
}

/**
 * Drop the skill_invocations table and all indexes.
 * Use with caution - this deletes all indexed invocation data.
 *
 * @param db - The SQLite database instance
 */
export function dropSkillsSchema(db: Database): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_skill_invocations_skill;
    DROP INDEX IF EXISTS idx_skill_invocations_session;
    DROP INDEX IF EXISTS idx_skill_invocations_timestamp;
    DROP INDEX IF EXISTS idx_skill_invocations_skill_time;
    DROP TABLE IF EXISTS skill_invocations;
  `);
}

/**
 * Get the count of indexed skill invocations.
 *
 * @param db - The SQLite database instance
 * @returns Total number of indexed invocations
 */
export function getSkillInvocationCount(db: Database): number {
  if (!skillsSchemaExists(db)) {
    return 0;
  }
  const result = db.prepare('SELECT COUNT(*) as count FROM skill_invocations').get() as {
    count: number;
  } | null;
  return result?.count ?? 0;
}
