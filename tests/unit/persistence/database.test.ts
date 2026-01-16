/**
 * Unit tests for persistence/common/database.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  openDatabase,
  openDatabaseSync,
  queryAll,
  queryOne,
  execute,
  transaction,
  tableExists,
  getSchemaVersion,
  setSchemaVersion,
} from '../../../src/persistence/common/database';

describe('database', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-db');

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  describe('openDatabase', () => {
    it('should create a new database file', async () => {
      const dbPath = join(testBaseDir, 'test.db');
      expect(existsSync(dbPath)).toBe(false);

      const db = await openDatabase(dbPath);

      expect(existsSync(dbPath)).toBe(true);
      db.close();
    });

    it('should create parent directories', async () => {
      const dbPath = join(testBaseDir, 'nested', 'deep', 'test.db');

      const db = await openDatabase(dbPath);

      expect(existsSync(dbPath)).toBe(true);
      db.close();
    });

    it('should enable WAL mode by default', async () => {
      const dbPath = join(testBaseDir, 'wal.db');
      const db = await openDatabase(dbPath);

      const result = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
      expect(result.journal_mode).toBe('wal');

      db.close();
    });

    it('should allow disabling WAL mode', async () => {
      const dbPath = join(testBaseDir, 'no-wal.db');
      const db = await openDatabase(dbPath, { walMode: false });

      const result = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
      // Without WAL, it defaults to 'delete'
      expect(result.journal_mode).not.toBe('wal');

      db.close();
    });

    it('should open existing database', async () => {
      const dbPath = join(testBaseDir, 'existing.db');

      // Create database and add a table
      const db1 = await openDatabase(dbPath);
      db1.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
      db1.close();

      // Reopen and verify table exists
      const db2 = await openDatabase(dbPath);
      const result = db2.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test'").get();
      expect(result).toBeTruthy();
      db2.close();
    });
  });

  describe('openDatabaseSync', () => {
    it('should create a database synchronously', () => {
      const dbPath = join(testBaseDir, 'sync.db');

      const db = openDatabaseSync(dbPath);

      expect(existsSync(dbPath)).toBe(true);
      db.close();
    });

    it('should enable WAL mode', () => {
      const dbPath = join(testBaseDir, 'sync-wal.db');
      const db = openDatabaseSync(dbPath);

      const result = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
      expect(result.journal_mode).toBe('wal');

      db.close();
    });
  });

  describe('query helpers', () => {
    it('queryAll should return all rows', async () => {
      const dbPath = join(testBaseDir, 'query-all.db');
      const db = await openDatabase(dbPath);

      db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');
      db.exec("INSERT INTO items (name) VALUES ('a'), ('b'), ('c')");

      const results = queryAll<{ id: number; name: string }>(db, 'SELECT * FROM items ORDER BY id');

      expect(results.length).toBe(3);
      expect(results[0]?.name).toBe('a');
      expect(results[1]?.name).toBe('b');
      expect(results[2]?.name).toBe('c');

      db.close();
    });

    it('queryAll should handle empty results', async () => {
      const dbPath = join(testBaseDir, 'query-empty.db');
      const db = await openDatabase(dbPath);

      db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY)');

      const results = queryAll<{ id: number }>(db, 'SELECT * FROM items');

      expect(results).toEqual([]);

      db.close();
    });

    it('queryAll should support named parameters', async () => {
      const dbPath = join(testBaseDir, 'query-params.db');
      const db = await openDatabase(dbPath);

      db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');
      db.exec("INSERT INTO items (name) VALUES ('a'), ('b'), ('c')");

      const results = queryAll<{ id: number; name: string }>(db, 'SELECT * FROM items WHERE name = $name', {
        $name: 'b',
      });

      expect(results.length).toBe(1);
      expect(results[0]?.name).toBe('b');

      db.close();
    });

    it('queryOne should return first row', async () => {
      const dbPath = join(testBaseDir, 'query-one.db');
      const db = await openDatabase(dbPath);

      db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');
      db.exec("INSERT INTO items (name) VALUES ('first'), ('second')");

      const result = queryOne<{ id: number; name: string }>(db, 'SELECT * FROM items ORDER BY id LIMIT 1');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('first');

      db.close();
    });

    it('queryOne should return null for no results', async () => {
      const dbPath = join(testBaseDir, 'query-one-null.db');
      const db = await openDatabase(dbPath);

      db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY)');

      const result = queryOne<{ id: number }>(db, 'SELECT * FROM items');

      expect(result).toBeNull();

      db.close();
    });

    it('execute should return changes count', async () => {
      const dbPath = join(testBaseDir, 'execute.db');
      const db = await openDatabase(dbPath);

      db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');
      db.exec("INSERT INTO items (name) VALUES ('a'), ('b'), ('c')");

      const deleted = execute(db, 'DELETE FROM items WHERE name IN ($a, $b)', { $a: 'a', $b: 'b' });

      expect(deleted).toBe(2);

      db.close();
    });
  });

  describe('transaction', () => {
    it('should commit on success', async () => {
      const dbPath = join(testBaseDir, 'tx-commit.db');
      const db = await openDatabase(dbPath);

      db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');

      transaction(db, () => {
        execute(db, "INSERT INTO items (name) VALUES ($name)", { $name: 'a' });
        execute(db, "INSERT INTO items (name) VALUES ($name)", { $name: 'b' });
      });

      const count = queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM items');
      expect(count?.count).toBe(2);

      db.close();
    });

    it('should rollback on error', async () => {
      const dbPath = join(testBaseDir, 'tx-rollback.db');
      const db = await openDatabase(dbPath);

      db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT UNIQUE)');

      try {
        transaction(db, () => {
          execute(db, "INSERT INTO items (name) VALUES ($name)", { $name: 'a' });
          // This should fail due to UNIQUE constraint
          execute(db, "INSERT INTO items (name) VALUES ($name)", { $name: 'a' });
        });
      } catch {
        // Expected to throw
      }

      const count = queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM items');
      expect(count?.count).toBe(0); // Rolled back

      db.close();
    });

    it('should return value from transaction function', async () => {
      const dbPath = join(testBaseDir, 'tx-return.db');
      const db = await openDatabase(dbPath);

      db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');

      const result = transaction(db, () => {
        execute(db, "INSERT INTO items (name) VALUES ($name)", { $name: 'test' });
        return 'success';
      });

      expect(result).toBe('success');

      db.close();
    });
  });

  describe('schema helpers', () => {
    it('tableExists should return true for existing table', async () => {
      const dbPath = join(testBaseDir, 'table-exists.db');
      const db = await openDatabase(dbPath);

      db.exec('CREATE TABLE my_table (id INTEGER PRIMARY KEY)');

      expect(tableExists(db, 'my_table')).toBe(true);
      expect(tableExists(db, 'other_table')).toBe(false);

      db.close();
    });

    it('getSchemaVersion should return null for new database', async () => {
      const dbPath = join(testBaseDir, 'version-new.db');
      const db = await openDatabase(dbPath);

      expect(getSchemaVersion(db)).toBeNull();

      db.close();
    });

    it('setSchemaVersion should create meta table and set version', async () => {
      const dbPath = join(testBaseDir, 'version-set.db');
      const db = await openDatabase(dbPath);

      setSchemaVersion(db, '1.0.0');

      expect(tableExists(db, '_meta')).toBe(true);
      expect(getSchemaVersion(db)).toBe('1.0.0');

      db.close();
    });

    it('setSchemaVersion should update existing version', async () => {
      const dbPath = join(testBaseDir, 'version-update.db');
      const db = await openDatabase(dbPath);

      setSchemaVersion(db, '1.0.0');
      expect(getSchemaVersion(db)).toBe('1.0.0');

      setSchemaVersion(db, '2.0.0');
      expect(getSchemaVersion(db)).toBe('2.0.0');

      db.close();
    });

    it('should support custom meta table name', async () => {
      const dbPath = join(testBaseDir, 'version-custom.db');
      const db = await openDatabase(dbPath);

      setSchemaVersion(db, '1.0.0', 'schema_info');

      expect(tableExists(db, 'schema_info')).toBe(true);
      expect(getSchemaVersion(db, 'schema_info')).toBe('1.0.0');
      expect(getSchemaVersion(db, '_meta')).toBeNull();

      db.close();
    });
  });
});
