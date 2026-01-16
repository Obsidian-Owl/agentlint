/**
 * EP03 Persistence Layer - SQLite Database Utilities
 *
 * Provides SQLite database helpers with WAL mode initialization.
 * Uses Bun's built-in SQLite support for optimal performance.
 *
 * @module persistence/common/database
 */

import { Database } from 'bun:sqlite';
import { dirname } from 'node:path';

import { DatabaseError } from '../../errors/persistence';
import { ensureDir } from './directories';

// =============================================================================
// Database Initialization
// =============================================================================

/**
 * Options for opening a database.
 */
export interface OpenDatabaseOptions {
  /** Enable WAL mode (default: true) */
  walMode?: boolean;
  /** Create parent directories if needed (default: true) */
  ensureDir?: boolean;
  /** Open in read-only mode (default: false) */
  readonly?: boolean;
}

/**
 * Open a SQLite database with WAL mode enabled.
 * Creates the parent directory if it doesn't exist.
 *
 * @param path - Path to the database file
 * @param options - Database options
 * @returns The opened database instance
 * @throws {DatabaseError} If database initialization fails
 */
export async function openDatabase(
  path: string,
  options: OpenDatabaseOptions = {}
): Promise<Database> {
  const { walMode = true, ensureDir: createDir = true, readonly = false } = options;

  try {
    // Ensure parent directory exists
    if (createDir && !readonly) {
      await ensureDir(dirname(path));
    }

    // Open database
    const db = new Database(path, {
      readonly,
      create: !readonly,
    });

    // Enable WAL mode for better crash safety and concurrency
    if (walMode && !readonly) {
      db.exec('PRAGMA journal_mode = WAL;');
    }

    // Set synchronous mode for durability
    if (!readonly) {
      db.exec('PRAGMA synchronous = NORMAL;');
    }

    return db;
  } catch (error) {
    const cause = error instanceof Error ? error : undefined;
    throw new DatabaseError('init', `Failed to open database: ${path}`, { filePath: path, cause });
  }
}

/**
 * Open a SQLite database synchronously with WAL mode enabled.
 * Use this only when async is not possible.
 *
 * @param path - Path to the database file
 * @param options - Database options
 * @returns The opened database instance
 * @throws {DatabaseError} If database initialization fails
 */
export function openDatabaseSync(
  path: string,
  options: Omit<OpenDatabaseOptions, 'ensureDir'> & { ensureDirSync?: boolean } = {}
): Database {
  const { walMode = true, ensureDirSync: createDir = true, readonly = false } = options;

  try {
    // Ensure parent directory exists (sync)
    if (createDir && !readonly) {
      const { ensureDirSync } = require('./directories');
      ensureDirSync(dirname(path));
    }

    // Open database
    const db = new Database(path, {
      readonly,
      create: !readonly,
    });

    // Enable WAL mode
    if (walMode && !readonly) {
      db.exec('PRAGMA journal_mode = WAL;');
    }

    // Set synchronous mode
    if (!readonly) {
      db.exec('PRAGMA synchronous = NORMAL;');
    }

    return db;
  } catch (error) {
    const cause = error instanceof Error ? error : undefined;
    throw new DatabaseError('init', `Failed to open database: ${path}`, { filePath: path, cause });
  }
}

// =============================================================================
// Query Helpers
// =============================================================================

/**
 * SQL parameter bindings type for Bun SQLite.
 * Supports named parameters with $ prefix.
 */
export type SQLParams = Record<string, string | number | bigint | boolean | null | Uint8Array>;

/**
 * Execute a query and return all results.
 *
 * @param db - Database instance
 * @param sql - SQL query string
 * @param params - Query parameters (use $name format for named params)
 * @returns Array of result rows
 * @throws {DatabaseError} If query fails
 */
export function queryAll<T>(db: Database, sql: string, params?: SQLParams): T[] {
  try {
    const stmt = db.prepare(sql);
    return (params ? stmt.all(params) : stmt.all()) as T[];
  } catch (error) {
    const cause = error instanceof Error ? error : undefined;
    throw new DatabaseError('query', `Query failed: ${sql.slice(0, 100)}...`, { cause });
  }
}

/**
 * Execute a query and return the first result.
 *
 * @param db - Database instance
 * @param sql - SQL query string
 * @param params - Query parameters
 * @returns First result row or null
 * @throws {DatabaseError} If query fails
 */
export function queryOne<T>(db: Database, sql: string, params?: SQLParams): T | null {
  try {
    const stmt = db.prepare(sql);
    const result = params ? stmt.get(params) : stmt.get();
    return (result as T) ?? null;
  } catch (error) {
    const cause = error instanceof Error ? error : undefined;
    throw new DatabaseError('query', `Query failed: ${sql.slice(0, 100)}...`, { cause });
  }
}

/**
 * Execute a statement (INSERT, UPDATE, DELETE).
 *
 * @param db - Database instance
 * @param sql - SQL statement
 * @param params - Statement parameters
 * @returns Number of rows affected
 * @throws {DatabaseError} If statement fails
 */
export function execute(db: Database, sql: string, params?: SQLParams): number {
  try {
    const stmt = db.prepare(sql);
    const result = params ? stmt.run(params) : stmt.run();
    return result.changes;
  } catch (error) {
    const operation = sql.trim().toLowerCase().startsWith('insert')
      ? 'insert'
      : sql.trim().toLowerCase().startsWith('update')
        ? 'update'
        : sql.trim().toLowerCase().startsWith('delete')
          ? 'delete'
          : 'unknown';

    const cause = error instanceof Error ? error : undefined;
    throw new DatabaseError(operation, `Statement failed: ${sql.slice(0, 100)}...`, { cause });
  }
}

/**
 * Execute multiple statements in a transaction.
 *
 * @param db - Database instance
 * @param fn - Function that performs database operations
 * @returns Result of the transaction function
 * @throws {DatabaseError} If transaction fails
 */
export function transaction<T>(db: Database, fn: () => T): T {
  try {
    db.exec('BEGIN TRANSACTION');
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Ignore rollback errors
    }
    const cause = error instanceof Error ? error : undefined;
    throw new DatabaseError('transaction', 'Transaction failed', { cause });
  }
}

/**
 * Execute an async function in a transaction.
 * Note: SQLite transactions are synchronous, so this wraps async work
 * between BEGIN and COMMIT. Use with caution - async operations between
 * BEGIN and COMMIT may cause issues with concurrent connections.
 *
 * @param db - Database instance
 * @param fn - Async function that performs database operations
 * @returns Result of the transaction function
 * @throws {DatabaseError} If transaction fails
 */
export async function transactionAsync<T>(db: Database, fn: () => Promise<T>): Promise<T> {
  try {
    db.exec('BEGIN TRANSACTION');
    const result = await fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Ignore rollback errors
    }
    const cause = error instanceof Error ? error : undefined;
    throw new DatabaseError('transaction', 'Async transaction failed', { cause });
  }
}

/**
 * Execute a function with automatic savepoint management.
 * Savepoints allow nested transactions within a larger transaction.
 *
 * @param db - Database instance
 * @param name - Savepoint name
 * @param fn - Function that performs database operations
 * @returns Result of the function
 * @throws {DatabaseError} If savepoint operations fail
 */
export function withSavepoint<T>(db: Database, name: string, fn: () => T): T {
  const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_');
  try {
    db.exec(`SAVEPOINT ${safeName}`);
    const result = fn();
    db.exec(`RELEASE SAVEPOINT ${safeName}`);
    return result;
  } catch (error) {
    try {
      db.exec(`ROLLBACK TO SAVEPOINT ${safeName}`);
    } catch {
      // Ignore rollback errors
    }
    const cause = error instanceof Error ? error : undefined;
    throw new DatabaseError('transaction', `Savepoint '${name}' failed`, { cause });
  }
}

// =============================================================================
// Schema Helpers
// =============================================================================

/**
 * Check if a table exists in the database.
 *
 * @param db - Database instance
 * @param tableName - Name of the table to check
 * @returns True if table exists
 */
export function tableExists(db: Database, tableName: string): boolean {
  const result = queryOne<{ count: number }>(
    db,
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=$name",
    { $name: tableName }
  );
  return result?.count === 1;
}

/**
 * Get the version of a schema from a metadata table.
 *
 * @param db - Database instance
 * @param metaTable - Name of metadata table (default: '_meta')
 * @returns Schema version or null if not set
 */
export function getSchemaVersion(db: Database, metaTable: string = '_meta'): string | null {
  if (!tableExists(db, metaTable)) {
    return null;
  }

  const result = queryOne<{ value: string }>(
    db,
    `SELECT value FROM ${metaTable} WHERE key = 'schema_version'`
  );
  return result?.value ?? null;
}

/**
 * Set the schema version in a metadata table.
 *
 * @param db - Database instance
 * @param version - Schema version string
 * @param metaTable - Name of metadata table (default: '_meta')
 */
export function setSchemaVersion(db: Database, version: string, metaTable: string = '_meta'): void {
  // Create meta table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${metaTable} (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Upsert version
  execute(
    db,
    `INSERT INTO ${metaTable} (key, value) VALUES ('schema_version', $version)
     ON CONFLICT(key) DO UPDATE SET value = $version`,
    { $version: version }
  );
}
