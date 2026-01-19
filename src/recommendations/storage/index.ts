/**
 * EP10 Recommendation Storage Module
 *
 * Provides CRUD operations and compression utilities for recommendation persistence.
 *
 * @module recommendations/storage
 */

// CRUD operations
export {
  saveRecommendation,
  loadRecommendation,
  loadRecommendationOrThrow,
  deleteRecommendation,
  listRecommendationIds,
  recommendationExists,
  getRecommendationsDir,
  getCurrentVersion,
} from './storage';

export type { StorageOptions } from './storage';

// Compression utilities
export {
  estimateTokens,
  compressRecommendation,
  formatEventsVerbatim,
  loadRecommendationsForContext,
  TOKEN_BUDGET,
  CHARS_PER_TOKEN,
} from './compression';

export type { LoadContextOptions } from './compression';
