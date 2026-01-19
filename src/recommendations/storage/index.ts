/**
 * EP10 Recommendation Storage Module
 *
 * Provides CRUD operations for recommendation persistence.
 *
 * @module recommendations/storage
 */

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
