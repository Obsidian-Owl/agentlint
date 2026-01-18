/**
 * EP09 Temporal Analysis - Review Storage
 *
 * Provides file operations for qualitative review persistence: save, load, delete.
 * Uses atomic writes for crash safety. Reviews are stored as JSON files in
 * .agentlint/reviews/{id}.json.
 *
 * @module persistence/reviews/storage
 */

import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import type { QualitativeReview, QualitativeReviewFile } from '../../temporal/types';
import { ensureDir, atomicWriteJson, getProjectDir } from '../common';
import { ReviewNotFoundError } from '../../temporal/errors';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for review storage operations.
 */
export interface ReviewStorageOptions {
  /** Base directory for reviews (default: .agentlint/reviews) */
  baseDir?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Current review file format version */
const REVIEW_FILE_VERSION = '1.0.0';

/** Reviews subdirectory name */
const REVIEWS_SUBDIR = 'reviews';

// =============================================================================
// Path Helpers
// =============================================================================

/**
 * Get the reviews directory path.
 *
 * @param projectPath - Project root path (default: process.cwd())
 * @returns Path to .agentlint/reviews directory
 */
export function getReviewsDir(projectPath: string = process.cwd()): string {
  return join(getProjectDir(projectPath), REVIEWS_SUBDIR);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the current schema version.
 *
 * @returns The current review file format version
 */
export function getCurrentVersion(): string {
  return REVIEW_FILE_VERSION;
}

/**
 * Save a qualitative review to disk with atomic write.
 *
 * @param review - The review to save
 * @param options - Storage options
 * @returns Path to the saved review file
 */
export async function saveReview(
  review: QualitativeReview,
  options: ReviewStorageOptions = {}
): Promise<string> {
  const baseDir = options.baseDir ?? getReviewsDir();

  // Validate review has required fields
  if (!review.id || !review.baselineId || !review.createdAt) {
    throw new Error('Invalid review: missing required fields (id, baselineId, createdAt)');
  }

  // Validate sentiment range
  if (review.overallSentiment < -2 || review.overallSentiment > 2) {
    throw new Error('Invalid review: overallSentiment must be between -2 and +2');
  }

  // Ensure directory exists
  await ensureDir(baseDir);

  // Create file format wrapper
  const fileContent: QualitativeReviewFile = {
    version: REVIEW_FILE_VERSION,
    review,
  };

  // Write review file
  const filePath = join(baseDir, `${review.id}.json`);
  await atomicWriteJson(filePath, fileContent);

  return filePath;
}

/**
 * Load a qualitative review by ID.
 *
 * @param id - The review UUID
 * @param options - Storage options
 * @returns The review, or null if not found
 */
export async function loadReview(
  id: string,
  options: ReviewStorageOptions = {}
): Promise<QualitativeReview | null> {
  const baseDir = options.baseDir ?? getReviewsDir();
  const filePath = join(baseDir, `${id}.json`);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = await Bun.file(filePath).text();
    const data = JSON.parse(content) as QualitativeReviewFile;

    // Basic validation
    if (!data.version || !data.review) {
      return null;
    }

    return data.review;
  } catch {
    // Invalid JSON or parse error
    return null;
  }
}

/**
 * Load a qualitative review by ID, throwing if not found.
 *
 * @param id - The review UUID
 * @param options - Storage options
 * @returns The review
 * @throws {ReviewNotFoundError} If review not found
 */
export async function loadReviewOrThrow(
  id: string,
  options: ReviewStorageOptions = {}
): Promise<QualitativeReview> {
  const review = await loadReview(id, options);
  if (!review) {
    throw new ReviewNotFoundError(id);
  }
  return review;
}

/**
 * Delete a qualitative review.
 *
 * @param id - The review UUID
 * @param options - Storage options
 * @returns True if deleted, false if not found
 */
export function deleteReview(id: string, options: ReviewStorageOptions = {}): boolean {
  const baseDir = options.baseDir ?? getReviewsDir();
  const filePath = join(baseDir, `${id}.json`);

  if (!existsSync(filePath)) {
    return false;
  }

  // Delete the file
  unlinkSync(filePath);

  // Note: Index removal is handled by the indexer module (T010)
  // The indexer should be called separately when deleting reviews

  return true;
}

/**
 * List all review IDs in the storage directory.
 *
 * @param options - Storage options
 * @returns Array of review UUIDs
 */
export function listReviewIds(options: ReviewStorageOptions = {}): string[] {
  const baseDir = options.baseDir ?? getReviewsDir();

  if (!existsSync(baseDir)) {
    return [];
  }

  const files = readdirSync(baseDir);
  return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
}

/**
 * Load all reviews for a specific baseline.
 *
 * @param baselineId - The baseline UUID
 * @param options - Storage options
 * @returns Array of reviews for the baseline
 */
export async function loadReviewsByBaseline(
  baselineId: string,
  options: ReviewStorageOptions = {}
): Promise<QualitativeReview[]> {
  const ids = listReviewIds(options);
  const reviews: QualitativeReview[] = [];

  for (const id of ids) {
    const review = await loadReview(id, options);
    if (review && review.baselineId === baselineId) {
      reviews.push(review);
    }
  }

  // Sort by createdAt descending (most recent first)
  return reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Check if a review exists.
 *
 * @param id - The review UUID
 * @param options - Storage options
 * @returns True if review exists
 */
export function reviewExists(id: string, options: ReviewStorageOptions = {}): boolean {
  const baseDir = options.baseDir ?? getReviewsDir();
  const filePath = join(baseDir, `${id}.json`);
  return existsSync(filePath);
}
