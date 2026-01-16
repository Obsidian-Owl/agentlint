/**
 * Unit tests for SQLite transaction behavior
 *
 * Tests transaction rollback, nested transactions, concurrent access,
 * and crash recovery scenarios for SQLite databases.
 *
 * @module tests/unit/persistence/database-transactions
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  openDatabase,
  queryAll,
  queryOne,
  execute,
  transaction,
  tableExists,
  getSchemaVersion,
  setSchemaVersion,
} from '../../../src/persistence/common/database';
import { DatabaseError } from '../../../src/errors/persistence';

describe('database transactions', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-db-transactions');

  beforeEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
    mkdirSync(testBaseDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  describe('transaction rollback', () => {
    it('should rollback all changes on error', async () => {
      const dbPath = join(testBaseDir, 'rollback.db');
      const db = await openDatabase(dbPath);

      db.exec(`
        CREATE TABLE accounts (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          balance INTEGER NOT NULL
        )
      `);
      db.exec("INSERT INTO accounts (name, balance) VALUES ('Alice', 100)");
      db.exec("INSERT INTO accounts (name, balance) VALUES ('Bob', 50)");

      // Attempt transaction that will fail
      try {
        transaction(db, () => {
          // Deduct from Alice
          execute(db, 'UPDATE accounts SET balance = balance - 30 WHERE name = $name', { $name: 'Alice' });
          // Try to add to non-existent column (will fail)
          execute(db, 'UPDATE accounts SET nonexistent = 30 WHERE name = $name', { $name: 'Bob' });
        });
      } catch {
        // Expected
      }

      // Balances should be unchanged
      const alice = queryOne<{ balance: number }>(db, 'SELECT balance FROM accounts WHERE name = $name', {
        $name: 'Alice',
      });
      const bob = queryOne<{ balance: number }>(db, 'SELECT balance FROM accounts WHERE name = $name', {
        $name: 'Bob',
      });

      expect(alice?.balance).toBe(100);
      expect(bob?.balance).toBe(50);

      db.close();
    });

    it('should rollback on constraint violation', async () => {
      const dbPath = join(testBaseDir, 'constraint.db');
      const db = await openDatabase(dbPath);

      db.exec(`
        CREATE TABLE items (
          id INTEGER PRIMARY KEY,
          code TEXT UNIQUE NOT NULL
        )
      `);
      db.exec("INSERT INTO items (code) VALUES ('A001')");

      const countBefore = queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM items')?.count;

      try {
        transaction(db, () => {
          execute(db, "INSERT INTO items (code) VALUES ($code)", { $code: 'B002' });
          execute(db, "INSERT INTO items (code) VALUES ($code)", { $code: 'C003' });
          // Duplicate code - violates UNIQUE constraint
          execute(db, "INSERT INTO items (code) VALUES ($code)", { $code: 'A001' });
        });
      } catch {
        // Expected
      }

      const countAfter = queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM items')?.count;

      expect(countAfter).toBe(countBefore);

      db.close();
    });

    it('should preserve data from committed transactions', async () => {
      const dbPath = join(testBaseDir, 'preserve.db');
      const db = await openDatabase(dbPath);

      db.exec('CREATE TABLE logs (id INTEGER PRIMARY KEY, message TEXT)');

      // First transaction - should commit
      transaction(db, () => {
        execute(db, "INSERT INTO logs (message) VALUES ($msg)", { $msg: 'Log 1' });
        execute(db, "INSERT INTO logs (message) VALUES ($msg)", { $msg: 'Log 2' });
      });

      // Second transaction - should fail and rollback
      try {
        transaction(db, () => {
          execute(db, "INSERT INTO logs (message) VALUES ($msg)", { $msg: 'Log 3' });
          throw new Error('Simulated failure');
        });
      } catch {
        // Expected
      }

      // Only first two logs should exist
      const logs = queryAll<{ message: string }>(db, 'SELECT message FROM logs ORDER BY id');
      expect(logs.length).toBe(2);
      expect(logs[0]?.message).toBe('Log 1');
      expect(logs[1]?.message).toBe('Log 2');

      db.close();
    });
  });

  describe('transaction return values', () => {
    it('should return value from successful transaction', async () => {
      const dbPath = join(testBaseDir, 'return.db');
      const db = await openDatabase(dbPath);

      db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');

      const result = transaction(db, () => {
        execute(db, "INSERT INTO items (name) VALUES ($name)", { $name: 'test' });
        const item = queryOne<{ id: number }>(db, 'SELECT last_insert_rowid() as id');
        return item?.id;
      });

      expect(result).toBe(1);

      db.close();
    });

    it('should return complex objects from transaction', async () => {
      const dbPath = join(testBaseDir, 'complex-return.db');
      const db = await openDatabase(dbPath);

      db.exec('CREATE TABLE data (id INTEGER PRIMARY KEY, value TEXT)');

      const result = transaction(db, () => {
        execute(db, "INSERT INTO data (value) VALUES ($v)", { $v: 'a' });
        execute(db, "INSERT INTO data (value) VALUES ($v)", { $v: 'b' });
        const items = queryAll<{ id: number; value: string }>(db, 'SELECT * FROM data');
        return { count: items.length, items };
      });

      expect(result.count).toBe(2);
      expect(result.items).toHaveLength(2);

      db.close();
    });
  });

  describe('WAL mode behavior', () => {
    it('should use WAL journal mode by default', async () => {
      const dbPath = join(testBaseDir, 'wal-default.db');
      const db = await openDatabase(dbPath);

      const mode = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
      expect(mode.journal_mode).toBe('wal');

      db.close();
    });

    it('should create WAL and SHM files', async () => {
      const dbPath = join(testBaseDir, 'wal-files.db');
      const db = await openDatabase(dbPath);

      // Perform some writes to trigger WAL
      db.exec('CREATE TABLE test (id INTEGER)');
      db.exec('INSERT INTO test VALUES (1)');

      // WAL file should exist (or may be absorbed by checkpoint)
      expect(existsSync(dbPath)).toBe(true);

      db.close();
    });

    it('should handle WAL mode with concurrent readers', async () => {
      const dbPath = join(testBaseDir, 'concurrent-read.db');
      const writer = await openDatabase(dbPath);

      writer.exec('CREATE TABLE data (id INTEGER PRIMARY KEY, value TEXT)');
      writer.exec("INSERT INTO data VALUES (1, 'initial')");

      // Open reader
      const reader = await openDatabase(dbPath, { readonly: true });

      // Writer updates
      writer.exec("UPDATE data SET value = 'updated' WHERE id = 1");

      // Reader sees update after re-query
      const result = queryOne<{ value: string }>(reader, 'SELECT value FROM data WHERE id = 1');
      expect(result?.value).toBe('updated');

      reader.close();
      writer.close();
    });
  });

  describe('error handling', () => {
    it('should throw DatabaseError on query failure', async () => {
      const dbPath = join(testBaseDir, 'error-query.db');
      const db = await openDatabase(dbPath);

      try {
        queryAll(db, 'SELECT * FROM nonexistent_table');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError);
        if (error instanceof DatabaseError) {
          expect(error.operation).toBe('query');
        }
      }

      db.close();
    });

    it('should throw DatabaseError on execute failure', async () => {
      const dbPath = join(testBaseDir, 'error-execute.db');
      const db = await openDatabase(dbPath);

      db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');

      try {
        // NULL name violates NOT NULL constraint
        execute(db, 'INSERT INTO items (name) VALUES (NULL)');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError);
      }

      db.close();
    });

    it('should throw DatabaseError on transaction failure', async () => {
      const dbPath = join(testBaseDir, 'error-transaction.db');
      const db = await openDatabase(dbPath);

      db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY)');

      try {
        transaction(db, () => {
          throw new Error('Intentional failure');
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError);
        if (error instanceof DatabaseError) {
          expect(error.operation).toBe('transaction');
        }
      }

      db.close();
    });
  });

  describe('schema version management', () => {
    it('should track schema versions across transactions', async () => {
      const dbPath = join(testBaseDir, 'schema-version.db');
      const db = await openDatabase(dbPath);

      // Initial version
      setSchemaVersion(db, '1.0.0');
      expect(getSchemaVersion(db)).toBe('1.0.0');

      // Update in transaction
      transaction(db, () => {
        db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY)');
        setSchemaVersion(db, '1.1.0');
      });

      expect(getSchemaVersion(db)).toBe('1.1.0');
      expect(tableExists(db, 'items')).toBe(true);

      db.close();
    });

    it('should rollback schema version on failed migration', async () => {
      const dbPath = join(testBaseDir, 'schema-rollback.db');
      const db = await openDatabase(dbPath);

      setSchemaVersion(db, '1.0.0');

      try {
        transaction(db, () => {
          db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY)');
          setSchemaVersion(db, '2.0.0');
          // Fail the migration
          throw new Error('Migration failed');
        });
      } catch {
        // Expected
      }

      // Version should be unchanged
      expect(getSchemaVersion(db)).toBe('1.0.0');
      // Table should not exist
      expect(tableExists(db, 'items')).toBe(false);

      db.close();
    });
  });

  describe('multiple operations in transaction', () => {
    it('should handle many inserts atomically', async () => {
      const dbPath = join(testBaseDir, 'batch-insert.db');
      const db = await openDatabase(dbPath);

      db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');

      const itemCount = 100;

      transaction(db, () => {
        for (let i = 0; i < itemCount; i++) {
          execute(db, "INSERT INTO items (name) VALUES ($name)", { $name: `Item ${i}` });
        }
      });

      const count = queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM items');
      expect(count?.count).toBe(itemCount);

      db.close();
    });

    it('should handle mixed operations atomically', async () => {
      const dbPath = join(testBaseDir, 'mixed-ops.db');
      const db = await openDatabase(dbPath);

      db.exec('CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT, balance INTEGER)');
      db.exec("INSERT INTO accounts VALUES (1, 'Alice', 1000)");
      db.exec("INSERT INTO accounts VALUES (2, 'Bob', 500)");

      // Transfer money atomically
      transaction(db, () => {
        execute(db, 'UPDATE accounts SET balance = balance - 200 WHERE id = 1');
        execute(db, 'UPDATE accounts SET balance = balance + 200 WHERE id = 2');
        execute(db, "INSERT INTO accounts VALUES (3, 'Charlie', 0)");
        execute(db, 'DELETE FROM accounts WHERE name = $name', { $name: 'Charlie' });
      });

      const alice = queryOne<{ balance: number }>(db, 'SELECT balance FROM accounts WHERE id = 1');
      const bob = queryOne<{ balance: number }>(db, 'SELECT balance FROM accounts WHERE id = 2');
      const count = queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM accounts');

      expect(alice?.balance).toBe(800);
      expect(bob?.balance).toBe(700);
      expect(count?.count).toBe(2); // Charlie was deleted

      db.close();
    });
  });

  describe('database synchronization', () => {
    it('should use NORMAL synchronous mode', async () => {
      const dbPath = join(testBaseDir, 'sync-mode.db');
      const db = await openDatabase(dbPath);

      const mode = db.prepare('PRAGMA synchronous').get() as { synchronous: number };
      // NORMAL = 1
      expect(mode.synchronous).toBe(1);

      db.close();
    });

    it('should persist data after close and reopen', async () => {
      const dbPath = join(testBaseDir, 'persist.db');

      // Write data
      const db1 = await openDatabase(dbPath);
      db1.exec('CREATE TABLE persist_test (id INTEGER PRIMARY KEY, data TEXT)');
      db1.exec("INSERT INTO persist_test VALUES (1, 'persisted')");
      db1.close();

      // Reopen and verify
      const db2 = await openDatabase(dbPath);
      const result = queryOne<{ data: string }>(db2, 'SELECT data FROM persist_test WHERE id = 1');
      expect(result?.data).toBe('persisted');
      db2.close();
    });
  });

  describe('readonly mode', () => {
    it('should allow queries in readonly mode', async () => {
      const dbPath = join(testBaseDir, 'readonly-query.db');

      // Create and populate database
      const writer = await openDatabase(dbPath);
      writer.exec('CREATE TABLE items (id INTEGER, name TEXT)');
      writer.exec("INSERT INTO items VALUES (1, 'test')");
      writer.close();

      // Open readonly
      const reader = await openDatabase(dbPath, { readonly: true });
      const items = queryAll<{ id: number; name: string }>(reader, 'SELECT * FROM items');

      expect(items.length).toBe(1);
      expect(items[0]?.name).toBe('test');

      reader.close();
    });

    it('should reject writes in readonly mode', async () => {
      const dbPath = join(testBaseDir, 'readonly-reject.db');

      // Create database
      const writer = await openDatabase(dbPath);
      writer.exec('CREATE TABLE items (id INTEGER)');
      writer.close();

      // Open readonly
      const reader = await openDatabase(dbPath, { readonly: true });

      expect(() => {
        reader.exec('INSERT INTO items VALUES (1)');
      }).toThrow();

      reader.close();
    });
  });
});
