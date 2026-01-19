/**
 * EP09 Temporal Analysis - Recommendation Tracking API
 *
 * Public API for managing recommendation tracking status.
 * Wraps persistence layer with domain-specific semantics.
 *
 * @module temporal/tracking/api
 */

import type { RecommendationTracking, RecommendationStatus } from '../types';
import {
  loadTracking,
  loadTrackingOrThrow,
  updateStatus,
  loadTrackingByStatus,
  loadTrackingByRecommendation,
  listTrackingIds,
  type TrackingStorageOptions,
  type TrackingUpdateFields,
} from '../../persistence/tracking';

// =============================================================================
// Types
// =============================================================================

/**
 * Filter options for listing recommendations.
 */
export interface RecommendationListFilter {
  /** Filter by status */
  status?: RecommendationStatus;
  /** Filter by recommendation ID */
  recommendationId?: string;
  /** Only include records with pre-baseline */
  hasPreBaseline?: boolean;
  /** Only include records with post-baseline */
  hasPostBaseline?: boolean;
  /** Only include records with effectiveness score */
  hasEffectivenessScore?: boolean;
}

/**
 * Options for recommendation API operations.
 */
export interface RecommendationApiOptions extends TrackingStorageOptions {
  /** Maximum results to return (default: no limit) */
  limit?: number;
  /** Sort by field */
  sortBy?: 'detectedAt' | 'confirmedAt' | 'effectivenessScore';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get a recommendation tracking record by ID.
 *
 * @param id - The tracking UUID
 * @param options - API options
 * @returns The tracking record, or null if not found
 */
export async function getRecommendation(
  id: string,
  options: RecommendationApiOptions = {}
): Promise<RecommendationTracking | null> {
  return loadTracking(id, options);
}

/**
 * Get a recommendation tracking record by ID, throwing if not found.
 *
 * @param id - The tracking UUID
 * @param options - API options
 * @returns The tracking record
 * @throws {Error} If tracking not found
 */
export async function getRecommendationOrThrow(
  id: string,
  options: RecommendationApiOptions = {}
): Promise<RecommendationTracking> {
  return loadTrackingOrThrow(id, options);
}

/**
 * Update the status and other fields of a recommendation tracking record.
 *
 * @param id - The tracking UUID
 * @param updates - Fields to update
 * @param options - API options
 * @returns The updated tracking record
 * @throws {Error} If tracking not found
 */
export async function updateRecommendationStatus(
  id: string,
  updates: TrackingUpdateFields,
  options: RecommendationApiOptions = {}
): Promise<RecommendationTracking> {
  return updateStatus(id, updates, options);
}

/**
 * List recommendation tracking records with optional filters.
 *
 * @param filter - Filter criteria
 * @param options - API options
 * @returns Array of matching tracking records
 */
export async function listRecommendations(
  filter: RecommendationListFilter = {},
  options: RecommendationApiOptions = {}
): Promise<RecommendationTracking[]> {
  let results: RecommendationTracking[];

  // Get base results based on primary filter
  if (filter.status) {
    results = await loadTrackingByStatus(filter.status, options);
  } else if (filter.recommendationId) {
    results = await loadTrackingByRecommendation(filter.recommendationId, options);
  } else {
    // Load all
    const ids = listTrackingIds(options);
    const loaded: RecommendationTracking[] = [];
    for (const id of ids) {
      const tracking = await loadTracking(id, options);
      if (tracking) {
        loaded.push(tracking);
      }
    }
    results = loaded;
  }

  // Apply additional filters
  if (filter.hasPreBaseline !== undefined) {
    results = results.filter((r) =>
      filter.hasPreBaseline ? r.preBaselineId !== undefined : r.preBaselineId === undefined
    );
  }

  if (filter.hasPostBaseline !== undefined) {
    results = results.filter((r) =>
      filter.hasPostBaseline ? r.postBaselineId !== undefined : r.postBaselineId === undefined
    );
  }

  if (filter.hasEffectivenessScore !== undefined) {
    results = results.filter((r) =>
      filter.hasEffectivenessScore
        ? r.effectivenessScore !== undefined
        : r.effectivenessScore === undefined
    );
  }

  // Apply secondary filter if both were provided
  if (filter.status && filter.recommendationId) {
    results = results.filter((r) => r.recommendationId === filter.recommendationId);
  }

  // Sort results
  if (options.sortBy) {
    const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
    results = results.sort((a, b) => {
      let aVal: string | number | undefined;
      let bVal: string | number | undefined;

      switch (options.sortBy) {
        case 'detectedAt':
          aVal = a.detectedAt ?? '';
          bVal = b.detectedAt ?? '';
          break;
        case 'confirmedAt':
          aVal = a.confirmedAt ?? '';
          bVal = b.confirmedAt ?? '';
          break;
        case 'effectivenessScore':
          aVal = a.effectivenessScore ?? -1;
          bVal = b.effectivenessScore ?? -1;
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * sortOrder;
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * sortOrder;
      }
      return 0;
    });
  }

  // Apply limit
  if (options.limit !== undefined && options.limit > 0) {
    results = results.slice(0, options.limit);
  }

  return results;
}

/**
 * Get the count of recommendations matching a filter.
 *
 * @param filter - Filter criteria
 * @param options - API options
 * @returns Number of matching records
 */
export async function countRecommendations(
  filter: RecommendationListFilter = {},
  options: Omit<RecommendationApiOptions, 'limit' | 'sortBy' | 'sortOrder'> = {}
): Promise<number> {
  const results = await listRecommendations(filter, options);
  return results.length;
}

/**
 * Get recommendations pending confirmation.
 *
 * @param options - API options
 * @returns Array of recommendations with 'detected_pending_confirm' status
 */
export async function getPendingConfirmations(
  options: RecommendationApiOptions = {}
): Promise<RecommendationTracking[]> {
  return listRecommendations({ status: 'detected_pending_confirm' }, options);
}

/**
 * Get implemented recommendations with effectiveness scores.
 *
 * @param options - API options
 * @returns Array of implemented recommendations with scores
 */
export async function getImplementedWithScores(
  options: RecommendationApiOptions = {}
): Promise<RecommendationTracking[]> {
  return listRecommendations(
    { status: 'implemented', hasEffectivenessScore: true },
    { ...options, sortBy: 'effectivenessScore', sortOrder: 'desc' }
  );
}
