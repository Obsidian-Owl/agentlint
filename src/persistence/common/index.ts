/**
 * EP03 Persistence Layer - Common Utilities
 *
 * Re-exports all common utilities for the persistence layer.
 *
 * @module persistence/common
 */

// Directory utilities
export {
  ensureDir,
  ensureDirSync,
  getProjectDir,
  getGlobalDir,
  getBaselinesDir,
  getBaselinesDbPath,
  getSessionsDir,
  getProjectLearningsDir,
  getProjectLearningsDbPath,
  getGlobalLearningsDir,
  getGlobalLearningsDbPath,
  expandTilde,
} from './directories';

// Database utilities
export {
  openDatabase,
  openDatabaseSync,
  queryAll,
  queryOne,
  execute,
  transaction,
  transactionAsync,
  withSavepoint,
  tableExists,
  getSchemaVersion,
  setSchemaVersion,
} from './database';
export type { OpenDatabaseOptions, SQLParams } from './database';

// Atomic write utilities
export {
  atomicWrite,
  atomicWriteSafe,
  atomicWriteJson,
  cleanupOrphanedTempFiles,
} from './atomic-write';
export type { AtomicWriteOptions } from './atomic-write';
