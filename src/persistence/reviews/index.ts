/**
 * EP09 Temporal Analysis - Reviews Persistence
 *
 * Provides storage and indexing for qualitative reviews.
 *
 * @module persistence/reviews
 */

// Storage
export {
  getReviewsDir,
  getCurrentVersion,
  saveReview,
  loadReview,
  loadReviewOrThrow,
  deleteReview,
  listReviewIds,
  loadReviewsByBaseline,
  reviewExists,
} from './storage';

export type { ReviewStorageOptions } from './storage';

// Indexer
export {
  getReviewIndexDb,
  indexReview,
  removeReviewIndex,
  queryReviews,
  getIndexedReviewById,
  getReviewsByBaseline,
  countReviews,
} from './indexer';

export type { ReviewIndexerOptions, ReviewQueryOptions, ReviewSummary } from './indexer';
