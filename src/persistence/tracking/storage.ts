/**
 * EP09 Temporal Analysis - Recommendation Tracking Storage
 *
 * Provides file operations for recommendation tracking persistence: save, load, update, delete.
 * Uses atomic writes for crash safety. Trackings are stored as JSON files in
 * .agentlint/tracking/{id}.json.
 *
 * @module persistence/tracking/storage
 */

import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import type {
  RecommendationTracking,
  RecommendationTrackingFile,
  RecommendationStatus,
} from '../../temporal/types';
import { ensureDir, atomicWriteJson, getProjectDir } from '../common';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for tracking storage operations.
 */
export interface TrackingStorageOptions {
  /** Base directory for tracking (default: .agentlint/tracking) */
  baseDir?: string;
}

/**
 * Fields that can be updated on a tracking record.
 */
export interface TrackingUpdateFields {
  /** New status */
  status?: RecommendationStatus;
  /** When user confirmed implementation */
  confirmedAt?: string;
  /** Baseline after implementation */
  postBaselineId?: string;
  /** Measured effectiveness (0-100) */
  effectivenessScore?: number;
  /** User notes about implementation */
  notes?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Current tracking file format version */
const TRACKING_FILE_VERSION = '1.0.0';

/** Tracking subdirectory name */
const TRACKING_SUBDIR = 'tracking';

// =============================================================================
// Path Helpers
// =============================================================================

/**
 * Get the tracking directory path.
 *
 * @param projectPath - Project root path (default: process.cwd())
 * @returns Path to .agentlint/tracking directory
 */
export function getTrackingDir(projectPath: string = process.cwd()): string {
  return join(getProjectDir(projectPath), TRACKING_SUBDIR);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the current schema version.
 *
 * @returns The current tracking file format version
 */
export function getCurrentVersion(): string {
  return TRACKING_FILE_VERSION;
}

/**
 * Save a recommendation tracking record to disk with atomic write.
 *
 * @param tracking - The tracking record to save
 * @param options - Storage options
 * @returns Path to the saved tracking file
 */
export async function saveTracking(
  tracking: RecommendationTracking,
  options: TrackingStorageOptions = {}
): Promise<string> {
  const baseDir = options.baseDir ?? getTrackingDir();

  // Validate tracking has required fields
  if (!tracking.id || !tracking.recommendationId || !tracking.status) {
    throw new Error('Invalid tracking: missing required fields (id, recommendationId, status)');
  }

  // Validate effectiveness score range if provided
  if (
    tracking.effectivenessScore !== undefined &&
    (tracking.effectivenessScore < 0 || tracking.effectivenessScore > 100)
  ) {
    throw new Error('Invalid tracking: effectivenessScore must be between 0 and 100');
  }

  // Ensure directory exists
  await ensureDir(baseDir);

  // Create file format wrapper
  const fileContent: RecommendationTrackingFile = {
    version: TRACKING_FILE_VERSION,
    tracking,
  };

  // Write tracking file
  const filePath = join(baseDir, `${tracking.id}.json`);
  await atomicWriteJson(filePath, fileContent);

  return filePath;
}

/**
 * Load a recommendation tracking record by ID.
 *
 * @param id - The tracking UUID
 * @param options - Storage options
 * @returns The tracking record, or null if not found
 */
export async function loadTracking(
  id: string,
  options: TrackingStorageOptions = {}
): Promise<RecommendationTracking | null> {
  const baseDir = options.baseDir ?? getTrackingDir();
  const filePath = join(baseDir, `${id}.json`);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = await Bun.file(filePath).text();
    const data = JSON.parse(content) as RecommendationTrackingFile;

    // Basic validation
    if (!data.version || !data.tracking) {
      return null;
    }

    return data.tracking;
  } catch {
    // Invalid JSON or parse error
    return null;
  }
}

/**
 * Load a tracking record by ID, throwing if not found.
 *
 * @param id - The tracking UUID
 * @param options - Storage options
 * @returns The tracking record
 * @throws {Error} If tracking not found
 */
export async function loadTrackingOrThrow(
  id: string,
  options: TrackingStorageOptions = {}
): Promise<RecommendationTracking> {
  const tracking = await loadTracking(id, options);
  if (!tracking) {
    throw new Error(`Tracking record not found: ${id}`);
  }
  return tracking;
}

/**
 * Update status and other fields on a tracking record.
 *
 * @param id - The tracking UUID
 * @param updates - Fields to update
 * @param options - Storage options
 * @returns The updated tracking record
 * @throws {Error} If tracking not found
 */
export async function updateStatus(
  id: string,
  updates: TrackingUpdateFields,
  options: TrackingStorageOptions = {}
): Promise<RecommendationTracking> {
  const tracking = await loadTrackingOrThrow(id, options);

  // Apply updates
  const updated: RecommendationTracking = {
    ...tracking,
    ...updates,
  };

  // Save updated tracking
  await saveTracking(updated, options);

  return updated;
}

/**
 * Delete a tracking record.
 *
 * @param id - The tracking UUID
 * @param options - Storage options
 * @returns True if deleted, false if not found
 */
export function deleteTracking(id: string, options: TrackingStorageOptions = {}): boolean {
  const baseDir = options.baseDir ?? getTrackingDir();
  const filePath = join(baseDir, `${id}.json`);

  if (!existsSync(filePath)) {
    return false;
  }

  // Delete the file
  unlinkSync(filePath);

  return true;
}

/**
 * List all tracking IDs in the storage directory.
 *
 * @param options - Storage options
 * @returns Array of tracking UUIDs
 */
export function listTrackingIds(options: TrackingStorageOptions = {}): string[] {
  const baseDir = options.baseDir ?? getTrackingDir();

  if (!existsSync(baseDir)) {
    return [];
  }

  const files = readdirSync(baseDir);
  return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
}

/**
 * Load all tracking records for a specific recommendation.
 *
 * @param recommendationId - The recommendation ID
 * @param options - Storage options
 * @returns Array of tracking records for the recommendation
 */
export async function loadTrackingByRecommendation(
  recommendationId: string,
  options: TrackingStorageOptions = {}
): Promise<RecommendationTracking[]> {
  const ids = listTrackingIds(options);
  const trackings: RecommendationTracking[] = [];

  for (const id of ids) {
    const tracking = await loadTracking(id, options);
    if (tracking && tracking.recommendationId === recommendationId) {
      trackings.push(tracking);
    }
  }

  // Sort by detectedAt descending (most recent first)
  return trackings.sort((a, b) => {
    const aDate = a.detectedAt ?? '';
    const bDate = b.detectedAt ?? '';
    return bDate.localeCompare(aDate);
  });
}

/**
 * Load all tracking records with a specific status.
 *
 * @param status - The status to filter by
 * @param options - Storage options
 * @returns Array of tracking records with the given status
 */
export async function loadTrackingByStatus(
  status: RecommendationStatus,
  options: TrackingStorageOptions = {}
): Promise<RecommendationTracking[]> {
  const ids = listTrackingIds(options);
  const trackings: RecommendationTracking[] = [];

  for (const id of ids) {
    const tracking = await loadTracking(id, options);
    if (tracking && tracking.status === status) {
      trackings.push(tracking);
    }
  }

  return trackings;
}

/**
 * Check if a tracking record exists.
 *
 * @param id - The tracking UUID
 * @param options - Storage options
 * @returns True if tracking record exists
 */
export function trackingExists(id: string, options: TrackingStorageOptions = {}): boolean {
  const baseDir = options.baseDir ?? getTrackingDir();
  const filePath = join(baseDir, `${id}.json`);
  return existsSync(filePath);
}
