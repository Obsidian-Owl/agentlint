/**
 * EP10 Recommendation Storage - CRUD Operations
 *
 * Implements atomic JSON storage for recommendation cases.
 * Uses existing patterns from persistence/common/atomic-write.ts.
 *
 * @module recommendations/storage/storage
 */

import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import { getRecommendationsDir as getDir } from '../../persistence/common/directories';
import { ensureDir } from '../../persistence/common/directories';
import { atomicWriteJson } from '../../persistence/common/atomic-write';
import { RecommendationSchema } from '../schemas';
import type { Recommendation, RecommendationFile } from '../types';

// =============================================================================
// Constants
// =============================================================================

const CURRENT_VERSION = '1.0.0';

// =============================================================================
// Types
// =============================================================================

export interface StorageOptions {
  /** Base directory for recommendations (defaults to project .agentlint/recommendations) */
  baseDir?: string;
}

// =============================================================================
// Path Helpers
// =============================================================================

/**
 * Get current schema version.
 */
export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}

/**
 * Get the recommendations directory path.
 */
export function getRecommendationsDir(projectPath?: string): string {
  return getDir(projectPath);
}

function getFilePath(id: string, options: StorageOptions): string {
  const dir = options.baseDir ?? getDir();
  return join(dir, `${id}.json`);
}

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * Save a recommendation to storage.
 *
 * @param recommendation - The recommendation to save
 * @param options - Storage options
 * @returns Path to the saved file
 * @throws If validation fails
 */
export async function saveRecommendation(
  recommendation: Recommendation,
  options: StorageOptions = {}
): Promise<string> {
  const dir = options.baseDir ?? getDir();
  await ensureDir(dir);

  // Validate with Zod schema
  const result = RecommendationSchema.safeParse(recommendation);
  if (!result.success) {
    const message = result.error.errors.map((e) => e.message).join(', ');
    throw new Error(`Invalid recommendation: ${message}`);
  }

  const filePath = getFilePath(recommendation.id, options);
  const fileContent: RecommendationFile = {
    version: CURRENT_VERSION,
    recommendation,
  };

  await atomicWriteJson(filePath, fileContent);
  return filePath;
}

/**
 * Load a recommendation from storage.
 *
 * @param id - Recommendation ID
 * @param options - Storage options
 * @returns The recommendation or null if not found
 */
export async function loadRecommendation(
  id: string,
  options: StorageOptions = {}
): Promise<Recommendation | null> {
  const filePath = getFilePath(id, options);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = await Bun.file(filePath).text();
    const parsed = JSON.parse(content) as RecommendationFile;
    return parsed.recommendation;
  } catch {
    return null;
  }
}

/**
 * Load a recommendation or throw if not found.
 *
 * @param id - Recommendation ID
 * @param options - Storage options
 * @returns The recommendation
 * @throws If not found
 */
export async function loadRecommendationOrThrow(
  id: string,
  options: StorageOptions = {}
): Promise<Recommendation> {
  const recommendation = await loadRecommendation(id, options);
  if (!recommendation) {
    throw new Error(`Recommendation not found: ${id}`);
  }
  return recommendation;
}

/**
 * Delete a recommendation from storage.
 *
 * @param id - Recommendation ID
 * @param options - Storage options
 * @returns true if deleted, false if not found
 */
export function deleteRecommendation(id: string, options: StorageOptions = {}): boolean {
  const filePath = getFilePath(id, options);

  if (!existsSync(filePath)) {
    return false;
  }

  try {
    unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * List all recommendation IDs in storage.
 *
 * @param options - Storage options
 * @returns Array of recommendation IDs
 */
export function listRecommendationIds(options: StorageOptions = {}): string[] {
  const dir = options.baseDir ?? getDir();

  if (!existsSync(dir)) {
    return [];
  }

  try {
    const files = readdirSync(dir);
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
  } catch {
    return [];
  }
}

/**
 * Check if a recommendation exists in storage.
 *
 * @param id - Recommendation ID
 * @param options - Storage options
 * @returns true if exists
 */
export function recommendationExists(id: string, options: StorageOptions = {}): boolean {
  const filePath = getFilePath(id, options);
  return existsSync(filePath);
}
