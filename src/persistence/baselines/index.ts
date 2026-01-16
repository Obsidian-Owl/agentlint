/**
 * EP03 Persistence Layer - Baselines Module
 *
 * Re-exports all baseline functionality for the persistence layer.
 *
 * @module persistence/baselines
 */

// Storage operations
export {
  saveBaseline,
  loadBaseline,
  getLatestBaseline,
  updateBaseline,
  deleteBaseline,
  listBaselineIds,
  isVersionSupported,
  getCurrentVersion,
} from './storage';
export type { BaselineStorageOptions } from './storage';

// Index operations
export {
  initBaselineSchema,
  indexBaseline,
  removeIndex,
  getIndexedBaselines,
  getIndexedBaselineById,
  getBaselineDbPath,
} from './indexer';
export type { BaselineIndexerOptions } from './indexer';

// Query operations
export {
  queryBaselines,
  getBaselineById,
  getLatest,
  compareBaselines,
  getBaselineHistory,
} from './queries';
export type { QueryOptions, BaselineComparison } from './queries';
