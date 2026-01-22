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
import { getTargetDirectory } from '../../orchestration/execution-context';
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
  // AGE-683: Use execution context's target directory as fallback instead of process.cwd()
  const dir = options.baseDir ?? getDir(getTargetDirectory());
  return join(dir, `${id}.json`);
}

// =============================================================================
// ID Resolution (AGE-673)
// =============================================================================

/**
 * Result of resolving a recommendation ID prefix.
 */
export interface ResolveIdResult {
  /** The resolved full ID if exactly one match */
  id?: string;
  /** Error message if resolution failed */
  error?: string;
  /** All matching IDs (for ambiguous prefix case) */
  matches?: string[];
}

/**
 * Resolve a short ID prefix to a full recommendation ID.
 *
 * Supports both full UUIDs and short prefixes (like git short hashes).
 * Returns an error if the prefix is ambiguous (matches multiple IDs).
 *
 * @param idOrPrefix - Full ID or prefix to resolve
 * @param options - Storage options
 * @returns Resolved ID or error
 *
 * @example
 * ```typescript
 * // Full ID passes through
 * resolveRecommendationId('d9a63822-adf8-4b50-97de-80d51c87ba39')
 * // => { id: 'd9a63822-adf8-4b50-97de-80d51c87ba39' }
 *
 * // Short prefix resolves to full ID
 * resolveRecommendationId('d9a63822')
 * // => { id: 'd9a63822-adf8-4b50-97de-80d51c87ba39' }
 *
 * // Ambiguous prefix returns error
 * resolveRecommendationId('d9a')
 * // => { error: "Ambiguous prefix 'd9a' matches 3 recommendations", matches: [...] }
 * ```
 */
export function resolveRecommendationId(
  idOrPrefix: string,
  options: StorageOptions = {}
): ResolveIdResult {
  // Fast path: if it's a full UUID (36 chars with hyphens), use directly
  if (idOrPrefix.length === 36 && idOrPrefix.includes('-')) {
    return { id: idOrPrefix };
  }

  // List all IDs and find matches
  const allIds = listRecommendationIds(options);

  // Check for exact match first
  if (allIds.includes(idOrPrefix)) {
    return { id: idOrPrefix };
  }

  // Find prefix matches
  const matches = allIds.filter((id) => id.startsWith(idOrPrefix));

  if (matches.length === 0) {
    return { error: `Recommendation not found: '${idOrPrefix}'` };
  }

  if (matches.length === 1 && matches[0] !== undefined) {
    return { id: matches[0] };
  }

  // Multiple matches - ambiguous prefix
  return {
    error: `Ambiguous prefix '${idOrPrefix}' matches ${matches.length} recommendations. Use more characters to narrow down.`,
    matches: matches.slice(0, 5), // Return first 5 matches for context
  };
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
  // Use recommendation.projectPath to derive storage location if baseDir not specified
  // This ensures recommendations are stored in the target project, not process.cwd()
  const dir = options.baseDir ?? getDir(recommendation.projectPath);
  await ensureDir(dir);

  // Validate with Zod schema
  const result = RecommendationSchema.safeParse(recommendation);
  if (!result.success) {
    const message = result.error.errors.map((e) => e.message).join(', ');
    throw new Error(`Invalid recommendation: ${message}`);
  }

  // Pass the computed baseDir to getFilePath for consistency
  const effectiveOptions = { ...options, baseDir: dir };
  const filePath = getFilePath(recommendation.id, effectiveOptions);
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
 * Supports both full UUIDs and short ID prefixes (AGE-673).
 *
 * @param idOrPrefix - Full recommendation ID or prefix
 * @param options - Storage options
 * @returns The recommendation or null if not found/ambiguous
 */
export async function loadRecommendation(
  idOrPrefix: string,
  options: StorageOptions = {}
): Promise<Recommendation | null> {
  // Resolve prefix to full ID
  const resolved = resolveRecommendationId(idOrPrefix, options);
  if (!resolved.id) {
    // Not found or ambiguous - return null (caller can use resolveRecommendationId for details)
    return null;
  }

  const filePath = getFilePath(resolved.id, options);

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
 * Supports both full UUIDs and short ID prefixes (AGE-673).
 *
 * @param idOrPrefix - Full recommendation ID or prefix
 * @param options - Storage options
 * @returns The recommendation
 * @throws If not found or ambiguous
 */
export async function loadRecommendationOrThrow(
  idOrPrefix: string,
  options: StorageOptions = {}
): Promise<Recommendation> {
  // Resolve first to get better error messages
  const resolved = resolveRecommendationId(idOrPrefix, options);
  if (!resolved.id) {
    throw new Error(resolved.error ?? `Recommendation not found: ${idOrPrefix}`);
  }

  const recommendation = await loadRecommendation(resolved.id, options);
  if (!recommendation) {
    throw new Error(`Recommendation not found: ${idOrPrefix}`);
  }
  return recommendation;
}

/**
 * Delete a recommendation from storage.
 *
 * Supports both full UUIDs and short ID prefixes (AGE-673).
 *
 * @param idOrPrefix - Full recommendation ID or prefix
 * @param options - Storage options
 * @returns true if deleted, false if not found/ambiguous
 */
export function deleteRecommendation(idOrPrefix: string, options: StorageOptions = {}): boolean {
  // Resolve prefix to full ID
  const resolved = resolveRecommendationId(idOrPrefix, options);
  if (!resolved.id) {
    return false;
  }

  const filePath = getFilePath(resolved.id, options);

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
  // AGE-683: Use execution context's target directory as fallback instead of process.cwd()
  const dir = options.baseDir ?? getDir(getTargetDirectory());

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
 * Supports both full UUIDs and short ID prefixes (AGE-673).
 *
 * @param idOrPrefix - Full recommendation ID or prefix
 * @param options - Storage options
 * @returns true if exists (exactly one match)
 */
export function recommendationExists(idOrPrefix: string, options: StorageOptions = {}): boolean {
  const resolved = resolveRecommendationId(idOrPrefix, options);
  if (!resolved.id) {
    return false;
  }
  const filePath = getFilePath(resolved.id, options);
  return existsSync(filePath);
}

/**
 * Clear all recommendations from storage.
 *
 * @param baseDir - Optional base directory (defaults to project .agentlint/recommendations)
 * @returns Number of recommendations deleted
 */
export function clearRecommendations(baseDir?: string): number {
  // AGE-683: Use execution context's target directory as fallback instead of process.cwd()
  const dir = baseDir ?? getDir(getTargetDirectory());
  const ids = listRecommendationIds({ baseDir: dir });

  for (const id of ids) {
    deleteRecommendation(id, { baseDir: dir });
  }

  return ids.length;
}
