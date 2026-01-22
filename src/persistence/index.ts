/**
 * EP03 Persistence Layer - Public Exports
 *
 * This module provides local storage for baselines, learnings, and session state.
 * All data is stored locally (Constitution Principle I: Local-First).
 *
 * @module persistence
 */

// =============================================================================
// Types (re-exported from types.ts)
// =============================================================================

export type {
  // Baseline types
  Baseline,
  BaselineMetrics,
  BaselineFile,
  BaselineQueryOptions,
  BaselineSummary,
  // Learning types
  Learning,
  LearningCategory,
  LearningScope,
  LearningOrigin,
  CreateLearningInput,
  LearningQueryOptions,
  LearningSummary,
  // Session types
  SaveStateOptions,
  LoadStateOptions,
  IncompleteSessionInfo,
  // Storage interfaces
  BaselineStorage,
  LearningStorage,
  SessionStorage,
  // Utility types
  AtomicWriteResult,
  PersistenceConfig,
} from './types';

export { DEFAULT_PERSISTENCE_CONFIG } from './types';

// =============================================================================
// Baseline Storage
// =============================================================================

export {
  // Storage operations
  saveBaseline,
  loadBaseline,
  getLatestBaseline,
  updateBaseline,
  deleteBaseline,
  listBaselineIds,
  isVersionSupported,
  getCurrentVersion,
  // Indexing
  initBaselineSchema,
  indexBaseline,
  removeIndex,
  getIndexedBaselines,
  getIndexedBaselineById,
  getBaselineDbPath,
  // Query API
  queryBaselines,
  getBaselineById,
  getLatest,
  compareBaselines,
  getBaselineHistory,
} from './baselines';

export type {
  BaselineStorageOptions,
  BaselineIndexerOptions,
  QueryOptions as BaselineQueryOpts,
  BaselineComparison,
} from './baselines';

// =============================================================================
// Session Storage
// =============================================================================

export {
  saveSessionState,
  loadSessionState,
  listSessionIds,
  deleteSessionState,
  findIncomplete,
  cleanup as cleanupSessions,
  getSessionsDir,
  SESSION_STATE_VERSION,
} from './sessions/storage';

// =============================================================================
// Learning Storage
// =============================================================================

export {
  // Storage operations
  saveLearning,
  loadLearning,
  listLearnings,
  deleteLearning,
  getLearningsDir,
  LEARNING_VERSION,
  // Indexing
  initLearningsIndex,
  closeLearningsIndex,
  indexLearning,
  getLearningById,
  queryLearnings,
  removeLearningFromIndex,
  listAllLearnings,
} from './learnings';

// =============================================================================
// Common Utilities
// =============================================================================

export {
  // Directory utilities
  ensureDir,
  ensureDirSync,
  getProjectDir,
  getGlobalDir,
  getBaselinesDir,
  getBaselinesDbPath,
  getProjectLearningsDir,
  getProjectLearningsDbPath,
  getGlobalLearningsDir,
  getGlobalLearningsDbPath,
  expandTilde,
  // Database utilities
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
  // Atomic write utilities
  atomicWrite,
  atomicWriteSafe,
  atomicWriteJson,
  cleanupOrphanedTempFiles,
} from './common';

export type { OpenDatabaseOptions, SQLParams, AtomicWriteOptions } from './common';

// =============================================================================
// Recommendation Tracking Storage
// =============================================================================

export {
  saveTracking,
  loadTracking,
  loadTrackingOrThrow,
  updateStatus,
  deleteTracking,
  listTrackingIds,
  loadTrackingByRecommendation,
  loadTrackingByStatus,
  trackingExists,
  getTrackingDir,
  getCurrentVersion as getTrackingVersion,
} from './tracking';

export type { TrackingStorageOptions, TrackingUpdateFields } from './tracking';

// =============================================================================
// Review Storage
// =============================================================================

export {
  saveReview,
  loadReview,
  loadReviewOrThrow,
  deleteReview,
  listReviewIds,
  loadReviewsByBaseline,
  reviewExists,
  getReviewsDir,
  getCurrentVersion as getReviewVersion,
} from './reviews/storage';

export type { ReviewStorageOptions } from './reviews/storage';

// =============================================================================
// Database Initialization
// =============================================================================

export { initializeDatabases, areDatabasesInitialized } from './init';

export type { InitDatabasesOptions, InitDatabasesResult } from './init';
