/**
 * Unit tests for sessions/storage/schema.ts
 *
 * Tests schema initialization, version tracking, and migration logic
 * for session intelligence tables.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  SESSION_INTELLIGENCE_SCHEMA_VERSION,
  SESSION_INTELLIGENCE_DATA_TABLES,
  SESSION_INTELLIGENCE_TABLES,
  initializeSessionIntelligenceSchema,
  initSessionIntelligenceSchema,
  getSessionIntelligenceSchemaVersion,
  migrateSessionIntelligenceSchema,
  sessionIntelligenceSchemaExists,
  tableExists,
  getMissingTables,
  dropSessionIntelligenceSchema,
  getTableRowCount,
  getAllTableRowCounts,
  deleteSessionIntelligenceData,
} from '../../../../src/sessions/storage/schema';

describe('sessions/storage/schema', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-session-intelligence-schema');
  let db: Database;
  let dbPath: string;

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
    mkdirSync(testBaseDir, { recursive: true });

    // Create a fresh database with sessions table (simulating sessions.db)
    dbPath = join(testBaseDir, 'sessions.db');
    db = new Database(dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');

    // Create the base sessions table that EP15 tables reference
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        project_path TEXT NOT NULL,
        first_timestamp TEXT,
        last_timestamp TEXT
      );
    `);
  });

  afterEach(() => {
    db.close();
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  describe('SESSION_INTELLIGENCE_SCHEMA_VERSION', () => {
    it('should be a positive integer', () => {
      expect(SESSION_INTELLIGENCE_SCHEMA_VERSION).toBeGreaterThan(0);
      expect(Number.isInteger(SESSION_INTELLIGENCE_SCHEMA_VERSION)).toBe(true);
    });
  });

  describe('SESSION_INTELLIGENCE_DATA_TABLES', () => {
    it('should contain 6 data tables', () => {
      expect(SESSION_INTELLIGENCE_DATA_TABLES.length).toBe(6);
    });

    it('should contain expected table names', () => {
      expect(SESSION_INTELLIGENCE_DATA_TABLES).toContain('tool_call_sequences');
      expect(SESSION_INTELLIGENCE_DATA_TABLES).toContain('file_accesses');
      expect(SESSION_INTELLIGENCE_DATA_TABLES).toContain('compression_events');
      expect(SESSION_INTELLIGENCE_DATA_TABLES).toContain('delegation_events');
      expect(SESSION_INTELLIGENCE_DATA_TABLES).toContain('mcp_tool_calls');
      expect(SESSION_INTELLIGENCE_DATA_TABLES).toContain('quality_signals');
    });
  });

  describe('SESSION_INTELLIGENCE_TABLES', () => {
    it('should contain data tables plus version table', () => {
      expect(SESSION_INTELLIGENCE_TABLES.length).toBe(7);
      expect(SESSION_INTELLIGENCE_TABLES).toContain('session_intelligence_version');
    });
  });

  describe('tableExists', () => {
    it('should return false for non-existent table', () => {
      expect(tableExists(db, 'tool_call_sequences')).toBe(false);
    });

    it('should return true after creating table', () => {
      initializeSessionIntelligenceSchema(db);
      expect(tableExists(db, 'tool_call_sequences')).toBe(true);
    });
  });

  describe('sessionIntelligenceSchemaExists', () => {
    it('should return false when no tables exist', () => {
      expect(sessionIntelligenceSchemaExists(db)).toBe(false);
    });

    it('should return true after initialization', () => {
      initializeSessionIntelligenceSchema(db);
      expect(sessionIntelligenceSchemaExists(db)).toBe(true);
    });

    it('should return false after dropping tables', () => {
      initializeSessionIntelligenceSchema(db);
      dropSessionIntelligenceSchema(db);
      expect(sessionIntelligenceSchemaExists(db)).toBe(false);
    });
  });

  describe('getMissingTables', () => {
    it('should return all tables when none exist', () => {
      const missing = getMissingTables(db);
      expect(missing.length).toBe(7);
    });

    it('should return empty array when all tables exist', () => {
      initializeSessionIntelligenceSchema(db);
      const missing = getMissingTables(db);
      expect(missing.length).toBe(0);
    });
  });

  describe('getSessionIntelligenceSchemaVersion', () => {
    it('should return 0 when no version table exists', () => {
      expect(getSessionIntelligenceSchemaVersion(db)).toBe(0);
    });

    it('should return version after initialization', () => {
      initSessionIntelligenceSchema(db);
      expect(getSessionIntelligenceSchemaVersion(db)).toBe(SESSION_INTELLIGENCE_SCHEMA_VERSION);
    });
  });

  describe('initializeSessionIntelligenceSchema', () => {
    it('should create all required tables', () => {
      initializeSessionIntelligenceSchema(db);

      const tables = db
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        .all()
        .map((r) => r.name);

      expect(tables).toContain('tool_call_sequences');
      expect(tables).toContain('file_accesses');
      expect(tables).toContain('compression_events');
      expect(tables).toContain('delegation_events');
      expect(tables).toContain('mcp_tool_calls');
      expect(tables).toContain('quality_signals');
      expect(tables).toContain('session_intelligence_version');
    });

    it('should create indexes', () => {
      initializeSessionIntelligenceSchema(db);

      const indexes = db
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name"
        )
        .all()
        .map((r) => r.name);

      // Check key indexes exist
      expect(indexes).toContain('idx_tool_sequences_session');
      expect(indexes).toContain('idx_tool_sequences_hash');
      expect(indexes).toContain('idx_file_accesses_session');
      expect(indexes).toContain('idx_compression_events_session');
      expect(indexes).toContain('idx_delegation_events_session');
      expect(indexes).toContain('idx_mcp_tool_calls_session');
      expect(indexes).toContain('idx_quality_signals_session');
    });

    it('should be idempotent (IF NOT EXISTS)', () => {
      initializeSessionIntelligenceSchema(db);
      // Should not throw
      expect(() => initializeSessionIntelligenceSchema(db)).not.toThrow();
    });
  });

  describe('initSessionIntelligenceSchema', () => {
    it('should create tables on fresh database', () => {
      const result = initSessionIntelligenceSchema(db);

      expect(result.created).toBe(true);
      expect(result.migrated).toBe(false);
      expect(result.version).toBe(SESSION_INTELLIGENCE_SCHEMA_VERSION);
      expect(sessionIntelligenceSchemaExists(db)).toBe(true);
    });

    it('should return created=false when tables already exist', () => {
      initSessionIntelligenceSchema(db);
      const result = initSessionIntelligenceSchema(db);

      expect(result.created).toBe(false);
      expect(result.migrated).toBe(false);
      expect(result.version).toBe(SESSION_INTELLIGENCE_SCHEMA_VERSION);
    });

    it('should be idempotent', () => {
      initSessionIntelligenceSchema(db);
      const result = initSessionIntelligenceSchema(db);

      expect(result.created).toBe(false);
      expect(result.version).toBe(SESSION_INTELLIGENCE_SCHEMA_VERSION);
    });
  });

  describe('migrateSessionIntelligenceSchema', () => {
    it('should create tables when fromVersion is 0', () => {
      migrateSessionIntelligenceSchema(db, 0, SESSION_INTELLIGENCE_SCHEMA_VERSION);

      expect(sessionIntelligenceSchemaExists(db)).toBe(true);
      expect(getSessionIntelligenceSchemaVersion(db)).toBe(SESSION_INTELLIGENCE_SCHEMA_VERSION);
    });
  });

  describe('dropSessionIntelligenceSchema', () => {
    it('should remove all session intelligence tables', () => {
      initializeSessionIntelligenceSchema(db);
      dropSessionIntelligenceSchema(db);

      for (const tableName of SESSION_INTELLIGENCE_TABLES) {
        expect(tableExists(db, tableName)).toBe(false);
      }
    });

    it('should be safe to call when no tables exist', () => {
      expect(() => dropSessionIntelligenceSchema(db)).not.toThrow();
    });
  });

  describe('tool_call_sequences table schema', () => {
    beforeEach(() => {
      initializeSessionIntelligenceSchema(db);
      // Insert a parent session
      db.run(`INSERT INTO sessions (session_id, project_path) VALUES ('test-session', '/path')`);
    });

    it('should have correct columns', () => {
      const columns = db
        .query<{ name: string }, []>('PRAGMA table_info(tool_call_sequences)')
        .all()
        .map((r) => r.name);

      expect(columns).toContain('id');
      expect(columns).toContain('session_id');
      expect(columns).toContain('tool_name');
      expect(columns).toContain('input_hash');
      expect(columns).toContain('timestamp');
      expect(columns).toContain('sequence_index');
      expect(columns).toContain('is_error');
      expect(columns).toContain('error_message');
      expect(columns).toContain('file_path');
      expect(columns).toContain('line_number');
    });

    it('should allow inserting valid data', () => {
      const insert = () =>
        db.run(
          `INSERT INTO tool_call_sequences (session_id, tool_name, input_hash, timestamp, sequence_index)
           VALUES ('test-session', 'Read', 'abc123def456', '2026-01-24T00:00:00Z', 0)`
        );

      expect(insert).not.toThrow();
    });

    it('should cascade delete when parent session is deleted', () => {
      db.run(
        `INSERT INTO tool_call_sequences (session_id, tool_name, input_hash, timestamp, sequence_index)
         VALUES ('test-session', 'Read', 'abc123', '2026-01-24T00:00:00Z', 0)`
      );

      const before = db
        .query<
          { count: number },
          []
        >("SELECT COUNT(*) as count FROM tool_call_sequences WHERE session_id = 'test-session'")
        .get();
      expect(before?.count).toBe(1);

      db.run("DELETE FROM sessions WHERE session_id = 'test-session'");

      const after = db
        .query<
          { count: number },
          []
        >("SELECT COUNT(*) as count FROM tool_call_sequences WHERE session_id = 'test-session'")
        .get();
      expect(after?.count).toBe(0);
    });
  });

  describe('file_accesses table schema', () => {
    beforeEach(() => {
      initializeSessionIntelligenceSchema(db);
      db.run(`INSERT INTO sessions (session_id, project_path) VALUES ('test-session', '/path')`);
    });

    it('should have correct columns', () => {
      const columns = db
        .query<{ name: string }, []>('PRAGMA table_info(file_accesses)')
        .all()
        .map((r) => r.name);

      expect(columns).toContain('id');
      expect(columns).toContain('session_id');
      expect(columns).toContain('file_path');
      expect(columns).toContain('operation');
      expect(columns).toContain('timestamp');
      expect(columns).toContain('access_sequence');
    });

    it('should allow inserting valid data', () => {
      const insert = () =>
        db.run(
          `INSERT INTO file_accesses (session_id, file_path, operation, timestamp, access_sequence)
           VALUES ('test-session', '/src/index.ts', 'read', '2026-01-24T00:00:00Z', 0)`
        );

      expect(insert).not.toThrow();
    });
  });

  describe('compression_events table schema', () => {
    beforeEach(() => {
      initializeSessionIntelligenceSchema(db);
      db.run(`INSERT INTO sessions (session_id, project_path) VALUES ('test-session', '/path')`);
    });

    it('should have correct columns', () => {
      const columns = db
        .query<{ name: string }, []>('PRAGMA table_info(compression_events)')
        .all()
        .map((r) => r.name);

      expect(columns).toContain('id');
      expect(columns).toContain('session_id');
      expect(columns).toContain('timestamp');
      expect(columns).toContain('compression_type');
      expect(columns).toContain('pre_tokens');
      expect(columns).toContain('tokens_saved');
      expect(columns).toContain('summary_preserved');
    });

    it('should allow inserting valid data', () => {
      const insert = () =>
        db.run(
          `INSERT INTO compression_events (session_id, timestamp, compression_type, pre_tokens, tokens_saved)
           VALUES ('test-session', '2026-01-24T00:00:00Z', 'compact', 150000, 50000)`
        );

      expect(insert).not.toThrow();
    });
  });

  describe('delegation_events table schema', () => {
    beforeEach(() => {
      initializeSessionIntelligenceSchema(db);
      db.run(`INSERT INTO sessions (session_id, project_path) VALUES ('test-session', '/path')`);
    });

    it('should have correct columns', () => {
      const columns = db
        .query<{ name: string }, []>('PRAGMA table_info(delegation_events)')
        .all()
        .map((r) => r.name);

      expect(columns).toContain('id');
      expect(columns).toContain('session_id');
      expect(columns).toContain('subagent_type');
      expect(columns).toContain('task_prompt');
      expect(columns).toContain('timestamp');
      expect(columns).toContain('turn_index');
      expect(columns).toContain('success');
      expect(columns).toContain('subagent_session_id');
    });

    it('should allow inserting valid data', () => {
      const insert = () =>
        db.run(
          `INSERT INTO delegation_events (session_id, subagent_type, task_prompt, timestamp, turn_index)
           VALUES ('test-session', 'Explore', 'Find all test files', '2026-01-24T00:00:00Z', 5)`
        );

      expect(insert).not.toThrow();
    });
  });

  describe('mcp_tool_calls table schema', () => {
    beforeEach(() => {
      initializeSessionIntelligenceSchema(db);
      db.run(`INSERT INTO sessions (session_id, project_path) VALUES ('test-session', '/path')`);
    });

    it('should have correct columns', () => {
      const columns = db
        .query<{ name: string }, []>('PRAGMA table_info(mcp_tool_calls)')
        .all()
        .map((r) => r.name);

      expect(columns).toContain('id');
      expect(columns).toContain('session_id');
      expect(columns).toContain('server_name');
      expect(columns).toContain('tool_name');
      expect(columns).toContain('timestamp');
      expect(columns).toContain('is_error');
      expect(columns).toContain('error_message');
    });

    it('should allow inserting valid data', () => {
      const insert = () =>
        db.run(
          `INSERT INTO mcp_tool_calls (session_id, server_name, tool_name, timestamp)
           VALUES ('test-session', 'linear', 'list_issues', '2026-01-24T00:00:00Z')`
        );

      expect(insert).not.toThrow();
    });
  });

  describe('quality_signals table schema', () => {
    beforeEach(() => {
      initializeSessionIntelligenceSchema(db);
      db.run(`INSERT INTO sessions (session_id, project_path) VALUES ('test-session', '/path')`);
    });

    it('should have correct columns', () => {
      const columns = db
        .query<{ name: string }, []>('PRAGMA table_info(quality_signals)')
        .all()
        .map((r) => r.name);

      expect(columns).toContain('id');
      expect(columns).toContain('session_id');
      expect(columns).toContain('signal_type');
      expect(columns).toContain('timestamp');
      expect(columns).toContain('passed');
      expect(columns).toContain('raw_output');
    });

    it('should allow inserting valid data with null passed (indeterminate)', () => {
      const insert = () =>
        db.run(
          `INSERT INTO quality_signals (session_id, signal_type, timestamp, passed, raw_output)
           VALUES ('test-session', 'test', '2026-01-24T00:00:00Z', NULL, 'Test output...')`
        );

      expect(insert).not.toThrow();
    });

    it('should allow inserting valid data with boolean passed', () => {
      const insert = () =>
        db.run(
          `INSERT INTO quality_signals (session_id, signal_type, timestamp, passed)
           VALUES ('test-session', 'build', '2026-01-24T00:00:00Z', 1)`
        );

      expect(insert).not.toThrow();
    });
  });

  describe('getTableRowCount', () => {
    beforeEach(() => {
      initializeSessionIntelligenceSchema(db);
      db.run(`INSERT INTO sessions (session_id, project_path) VALUES ('test-session', '/path')`);
    });

    it('should return 0 for empty table', () => {
      expect(getTableRowCount(db, 'tool_call_sequences')).toBe(0);
    });

    it('should return correct count after inserts', () => {
      db.run(
        `INSERT INTO tool_call_sequences (session_id, tool_name, input_hash, timestamp, sequence_index)
         VALUES ('test-session', 'Read', 'hash1', '2026-01-24T00:00:00Z', 0)`
      );
      db.run(
        `INSERT INTO tool_call_sequences (session_id, tool_name, input_hash, timestamp, sequence_index)
         VALUES ('test-session', 'Write', 'hash2', '2026-01-24T00:00:01Z', 1)`
      );

      expect(getTableRowCount(db, 'tool_call_sequences')).toBe(2);
    });

    it('should return 0 for non-existent table', () => {
      dropSessionIntelligenceSchema(db);
      expect(getTableRowCount(db, 'tool_call_sequences')).toBe(0);
    });
  });

  describe('getAllTableRowCounts', () => {
    beforeEach(() => {
      initializeSessionIntelligenceSchema(db);
    });

    it('should return counts for all tables', () => {
      const counts = getAllTableRowCounts(db);

      expect(counts).toHaveProperty('tool_call_sequences');
      expect(counts).toHaveProperty('file_accesses');
      expect(counts).toHaveProperty('compression_events');
      expect(counts).toHaveProperty('delegation_events');
      expect(counts).toHaveProperty('mcp_tool_calls');
      expect(counts).toHaveProperty('quality_signals');
      expect(counts).toHaveProperty('session_intelligence_version');
    });

    it('should return 0 for all empty tables except version', () => {
      const counts = getAllTableRowCounts(db);

      expect(counts.tool_call_sequences).toBe(0);
      expect(counts.file_accesses).toBe(0);
      expect(counts.compression_events).toBe(0);
      expect(counts.delegation_events).toBe(0);
      expect(counts.mcp_tool_calls).toBe(0);
      expect(counts.quality_signals).toBe(0);
    });
  });

  describe('deleteSessionIntelligenceData', () => {
    beforeEach(() => {
      initializeSessionIntelligenceSchema(db);
      db.run(`INSERT INTO sessions (session_id, project_path) VALUES ('session-1', '/path')`);
      db.run(`INSERT INTO sessions (session_id, project_path) VALUES ('session-2', '/path')`);

      // Insert data for both sessions
      db.run(
        `INSERT INTO tool_call_sequences (session_id, tool_name, input_hash, timestamp, sequence_index)
         VALUES ('session-1', 'Read', 'hash1', '2026-01-24T00:00:00Z', 0)`
      );
      db.run(
        `INSERT INTO tool_call_sequences (session_id, tool_name, input_hash, timestamp, sequence_index)
         VALUES ('session-2', 'Write', 'hash2', '2026-01-24T00:00:01Z', 0)`
      );
      db.run(
        `INSERT INTO file_accesses (session_id, file_path, operation, timestamp, access_sequence)
         VALUES ('session-1', '/src/a.ts', 'read', '2026-01-24T00:00:00Z', 0)`
      );
    });

    it('should delete data only for specified session', () => {
      deleteSessionIntelligenceData(db, 'session-1');

      // Session 1 data should be deleted
      const count1 = db
        .query<
          { count: number },
          []
        >("SELECT COUNT(*) as count FROM tool_call_sequences WHERE session_id = 'session-1'")
        .get();
      expect(count1?.count).toBe(0);

      const fileCount1 = db
        .query<
          { count: number },
          []
        >("SELECT COUNT(*) as count FROM file_accesses WHERE session_id = 'session-1'")
        .get();
      expect(fileCount1?.count).toBe(0);

      // Session 2 data should remain
      const count2 = db
        .query<
          { count: number },
          []
        >("SELECT COUNT(*) as count FROM tool_call_sequences WHERE session_id = 'session-2'")
        .get();
      expect(count2?.count).toBe(1);
    });

    it('should be safe to call for non-existent session', () => {
      expect(() => deleteSessionIntelligenceData(db, 'non-existent')).not.toThrow();
    });
  });
});
