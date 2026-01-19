/**
 * EP09 Temporal Analysis - Recommendation Tracking Persistence
 *
 * Exports tracking storage functions for recommendation implementation tracking.
 *
 * @module persistence/tracking
 */

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
  getCurrentVersion,
  type TrackingStorageOptions,
  type TrackingUpdateFields,
} from './storage';

export {
  getTrackingIndexDb,
  indexTracking,
  removeTrackingIndex,
  queryTrackings,
  getIndexedTrackingById,
  getTrackingsByRecommendation,
  getTrackingsByStatus,
  countTrackings,
  type TrackingIndexerOptions,
  type TrackingQueryOptions,
  type TrackingSummary,
} from './indexer';
