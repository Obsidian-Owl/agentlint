/**
 * Unit tests for persistence/causal/schema.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  CAUSAL_SCHEMA_VERSION,
  causalTablesExist,
  getCausalSchemaVersion,
  createCausalTables,
  dropCausalTables,
  initCausalSchema,
} from '../../../../src/persistence/causal/schema';

describe('causal/schema', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-causal-schema');
  let db: Database;
  let dbPath: string;

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
    mkdirSync(testBaseDir, { recursive: true });

    // Create a fresh database
    dbPath = join(testBaseDir, 'test.db');
    db = new Database(dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
  });

  afterEach(() => {
    db.close();
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  describe('CAUSAL_SCHEMA_VERSION', () => {
    it('should be a positive integer', () => {
      expect(CAUSAL_SCHEMA_VERSION).toBeGreaterThan(0);
      expect(Number.isInteger(CAUSAL_SCHEMA_VERSION)).toBe(true);
    });
  });

  describe('causalTablesExist', () => {
    it('should return false when no causal tables exist', () => {
      expect(causalTablesExist(db)).toBe(false);
    });

    it('should return true after creating causal tables', () => {
      createCausalTables(db);
      expect(causalTablesExist(db)).toBe(true);
    });

    it('should return false after dropping causal tables', () => {
      createCausalTables(db);
      dropCausalTables(db);
      expect(causalTablesExist(db)).toBe(false);
    });
  });

  describe('getCausalSchemaVersion', () => {
    it('should return 0 when no schema version table exists', () => {
      expect(getCausalSchemaVersion(db)).toBe(0);
    });

    it('should return the schema version after creating tables', () => {
      createCausalTables(db);
      expect(getCausalSchemaVersion(db)).toBe(CAUSAL_SCHEMA_VERSION);
    });
  });

  describe('createCausalTables', () => {
    it('should create all required tables', () => {
      createCausalTables(db);

      // Check all tables exist
      const tables = db
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        .all()
        .map((r) => r.name);

      expect(tables).toContain('causal_chains');
      expect(tables).toContain('evidence_items');
      expect(tables).toContain('issue_patterns');
      expect(tables).toContain('chain_patterns');
      expect(tables).toContain('causal_schema_version');
    });

    it('should create indexes', () => {
      createCausalTables(db);

      const indexes = db
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name"
        )
        .all()
        .map((r) => r.name);

      expect(indexes).toContain('idx_causal_chains_project');
      expect(indexes).toContain('idx_causal_chains_created');
      expect(indexes).toContain('idx_evidence_items_chain');
      expect(indexes).toContain('idx_issue_patterns_category');
      expect(indexes).toContain('idx_causal_chains_pattern');
    });

    it('should set schema version', () => {
      createCausalTables(db);
      expect(getCausalSchemaVersion(db)).toBe(CAUSAL_SCHEMA_VERSION);
    });

    it('should be idempotent (IF NOT EXISTS)', () => {
      createCausalTables(db);
      // Should not throw
      expect(() => createCausalTables(db)).not.toThrow();
    });
  });

  describe('dropCausalTables', () => {
    it('should remove all causal tables', () => {
      createCausalTables(db);
      dropCausalTables(db);

      const tables = db
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'causal%' OR name LIKE 'evidence%' OR name LIKE 'issue_patterns' OR name LIKE 'chain_patterns'"
        )
        .all();

      expect(tables.length).toBe(0);
    });

    it('should be safe to call when no tables exist', () => {
      expect(() => dropCausalTables(db)).not.toThrow();
    });
  });

  describe('initCausalSchema', () => {
    it('should create tables on fresh database', () => {
      const result = initCausalSchema(db);

      expect(result.created).toBe(true);
      expect(result.migrated).toBe(false);
      expect(result.version).toBe(CAUSAL_SCHEMA_VERSION);
      expect(causalTablesExist(db)).toBe(true);
    });

    it('should return created=false when tables already exist', () => {
      createCausalTables(db);

      const result = initCausalSchema(db);

      expect(result.created).toBe(false);
      expect(result.migrated).toBe(false);
      expect(result.version).toBe(CAUSAL_SCHEMA_VERSION);
    });

    it('should be idempotent', () => {
      initCausalSchema(db);
      const result = initCausalSchema(db);

      expect(result.created).toBe(false);
      expect(result.version).toBe(CAUSAL_SCHEMA_VERSION);
    });
  });

  describe('causal_chains table schema', () => {
    beforeEach(() => {
      createCausalTables(db);
    });

    it('should have correct columns', () => {
      const columns = db
        .query<{ name: string; type: string }, []>(
          "PRAGMA table_info(causal_chains)"
        )
        .all()
        .map((r) => r.name);

      expect(columns).toContain('id');
      expect(columns).toContain('issue_id');
      expect(columns).toContain('trigger_summary');
      expect(columns).toContain('gap_type');
      expect(columns).toContain('mechanism');
      expect(columns).toContain('effect');
      expect(columns).toContain('confidence_overall');
      expect(columns).toContain('depth');
      expect(columns).toContain('depth_limit_reached');
      expect(columns).toContain('project_path');
      expect(columns).toContain('created_at');
    });

    it('should enforce depth constraint (0-5)', () => {
      const insertValid = () =>
        db.run(
          `INSERT INTO causal_chains (id, issue_id, mechanism, effect, project_path, created_at, depth)
           VALUES ('test-id', 'issue-1', 'mechanism', 'effect', '/path', '2026-01-01T00:00:00Z', 3)`
        );

      expect(insertValid).not.toThrow();

      const insertInvalid = () =>
        db.run(
          `INSERT INTO causal_chains (id, issue_id, mechanism, effect, project_path, created_at, depth)
           VALUES ('test-id-2', 'issue-2', 'mechanism', 'effect', '/path', '2026-01-01T00:00:00Z', 10)`
        );

      expect(insertInvalid).toThrow();
    });

    it('should enforce confidence_overall constraint', () => {
      const insertValid = () =>
        db.run(
          `INSERT INTO causal_chains (id, issue_id, mechanism, effect, project_path, created_at, confidence_overall)
           VALUES ('test-conf', 'issue-1', 'mechanism', 'effect', '/path', '2026-01-01T00:00:00Z', 'high')`
        );

      expect(insertValid).not.toThrow();

      const insertInvalid = () =>
        db.run(
          `INSERT INTO causal_chains (id, issue_id, mechanism, effect, project_path, created_at, confidence_overall)
           VALUES ('test-conf-2', 'issue-2', 'mechanism', 'effect', '/path', '2026-01-01T00:00:00Z', 'invalid')`
        );

      expect(insertInvalid).toThrow();
    });
  });

  describe('evidence_items table schema', () => {
    beforeEach(() => {
      createCausalTables(db);
      // Insert a parent chain first
      db.run(
        `INSERT INTO causal_chains (id, issue_id, mechanism, effect, project_path, created_at)
         VALUES ('parent-chain', 'issue-1', 'mechanism', 'effect', '/path', '2026-01-01T00:00:00Z')`
      );
    });

    it('should have correct columns', () => {
      const columns = db
        .query<{ name: string }, []>("PRAGMA table_info(evidence_items)")
        .all()
        .map((r) => r.name);

      expect(columns).toContain('id');
      expect(columns).toContain('chain_id');
      expect(columns).toContain('type');
      expect(columns).toContain('source');
      expect(columns).toContain('timestamp');
      expect(columns).toContain('content');
      expect(columns).toContain('file_path');
      expect(columns).toContain('sequence');
    });

    it('should enforce type constraint', () => {
      const insertValid = () =>
        db.run(
          `INSERT INTO evidence_items (id, chain_id, type, source, sequence)
           VALUES ('ev-1', 'parent-chain', 'SessionMatch', 'session-123', 0)`
        );

      expect(insertValid).not.toThrow();

      const insertInvalid = () =>
        db.run(
          `INSERT INTO evidence_items (id, chain_id, type, source, sequence)
           VALUES ('ev-2', 'parent-chain', 'InvalidType', 'session-123', 1)`
        );

      expect(insertInvalid).toThrow();
    });

    it('should cascade delete when parent chain is deleted', () => {
      db.run(
        `INSERT INTO evidence_items (id, chain_id, type, source, sequence)
         VALUES ('ev-cascade', 'parent-chain', 'SessionMatch', 'session-123', 0)`
      );

      // Verify evidence exists
      const before = db
        .query<{ count: number }, []>(
          "SELECT COUNT(*) as count FROM evidence_items WHERE id = 'ev-cascade'"
        )
        .get();
      expect(before?.count).toBe(1);

      // Delete parent chain
      db.run("DELETE FROM causal_chains WHERE id = 'parent-chain'");

      // Evidence should be cascade deleted
      const after = db
        .query<{ count: number }, []>(
          "SELECT COUNT(*) as count FROM evidence_items WHERE id = 'ev-cascade'"
        )
        .get();
      expect(after?.count).toBe(0);
    });
  });

  describe('issue_patterns table schema', () => {
    beforeEach(() => {
      createCausalTables(db);
    });

    it('should have correct columns', () => {
      const columns = db
        .query<{ name: string }, []>("PRAGMA table_info(issue_patterns)")
        .all()
        .map((r) => r.name);

      expect(columns).toContain('id');
      expect(columns).toContain('category');
      expect(columns).toContain('frequency');
      expect(columns).toContain('is_systemic');
      expect(columns).toContain('first_occurrence');
      expect(columns).toContain('last_occurrence');
      expect(columns).toContain('project_path');
      expect(columns).toContain('summary');
    });

    it('should enforce category constraint', () => {
      const insertValid = () =>
        db.run(
          `INSERT INTO issue_patterns (id, category, first_occurrence, last_occurrence, summary)
           VALUES ('pat-1', 'missing_config', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'Missing config')`
        );

      expect(insertValid).not.toThrow();

      const insertInvalid = () =>
        db.run(
          `INSERT INTO issue_patterns (id, category, first_occurrence, last_occurrence, summary)
           VALUES ('pat-2', 'invalid_category', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'Invalid')`
        );

      expect(insertInvalid).toThrow();
    });
  });
});
