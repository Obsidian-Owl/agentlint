/**
 * EP03 Persistence Layer - Sessions Module
 *
 * Public exports for session storage operations.
 *
 * @module persistence/sessions
 */

export {
  saveSessionState,
  loadSessionState,
  listSessionIds,
  deleteSessionState,
  findIncomplete,
  cleanup,
  getSessionsDir,
  SESSION_STATE_VERSION,
} from './storage';

// FTS5 full-text search exports
export {
  // Database management
  initDatabase,
  openDatabase,
  closeDatabase,
  getSchemaVersion,
  tableExists,
  getDatabaseStats,
  SCHEMA_VERSION,
  // Types
  type InitDatabaseOptions,
  type InitDatabaseResult,
  type SessionEntry,
  type SessionMetadata,
  type SessionToolUsage,
  type SearchResult,
  type SearchOptions,
  // Session entry operations
  insertSessionEntry,
  insertSessionEntries,
  deleteSessionEntries,
  // Session metadata operations
  upsertSession,
  getSession,
  listSessions,
  deleteSession,
  // Tool usage operations
  upsertToolUsage,
  getToolUsage,
  // FTS5 search operations
  searchSessions,
  findSessionsWithContent,
  getSessionEntries,
  countSearchResults,
  // Indexed files tracking
  recordIndexedFile,
  needsReindex,
  getIndexedFiles,
  removeIndexedFile,
} from './fts';
