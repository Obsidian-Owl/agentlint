/**
 * EP03 Persistence Layer - Baseline Storage
 *
 * Provides file operations for baseline persistence: save, load, update, delete.
 * Uses atomic writes for crash safety and manages the latest.json pointer.
 *
 * @module persistence/baselines/storage
 */

import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import type { Baseline, BaselineFile } from '../types';
import { ensureDir, atomicWriteJson, getBaselinesDir } from '../common';
import { parseBaselineFile, validateBaseline } from '../schemas';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for baseline storage operations.
 */
export interface BaselineStorageOptions {
  /** Base directory for baselines (default: .agentlint/baselines) */
  baseDir?: string;
  /** Use atomic write (default: true) */
  atomic?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Current baseline file format version */
const BASELINE_FILE_VERSION = '1.0.0';

/** Name of the latest baseline pointer file */
const LATEST_FILENAME = 'latest.json';

/** Supported schema versions (for backward compatibility) */
const SUPPORTED_VERSIONS = ['1.0.0'];

// =============================================================================
// Public API
// =============================================================================

/**
 * Check if a schema version is supported.
 *
 * Per FR-019: Schema versioning enables best-effort parsing of older baselines.
 *
 * @param version - The version string to check
 * @returns True if the version is supported
 */
export function isVersionSupported(version: string): boolean {
  return SUPPORTED_VERSIONS.includes(version);
}

/**
 * Get the current schema version.
 *
 * @returns The current baseline file format version
 */
export function getCurrentVersion(): string {
  return BASELINE_FILE_VERSION;
}

/**
 * Save a baseline to disk with atomic write.
 *
 * Creates the baseline JSON file and updates the latest.json pointer.
 *
 * @param baseline - The baseline to save
 * @param options - Storage options
 * @returns Path to the saved baseline file
 * @throws {Error} If baseline validation fails
 */
export async function saveBaseline(
  baseline: Baseline,
  options: BaselineStorageOptions = {}
): Promise<string> {
  const baseDir = options.baseDir ?? getBaselinesDir();

  // Validate baseline before saving
  const validation = validateBaseline(baseline);
  if (!validation.success) {
    throw new Error(`Invalid baseline: ${validation.errors?.message ?? 'validation failed'}`);
  }

  // Ensure directory exists
  await ensureDir(baseDir);

  // Create file format wrapper
  const fileContent: BaselineFile = {
    version: BASELINE_FILE_VERSION,
    baseline,
  };

  // Write baseline file
  const filePath = join(baseDir, `${baseline.id}.json`);
  await atomicWriteJson(filePath, fileContent);

  // Update latest pointer
  await updateLatestPointer(baseDir, baseline.id, baseline.createdAt);

  return filePath;
}

/**
 * Load a baseline by ID.
 *
 * @param id - The baseline UUID
 * @param options - Storage options
 * @returns The baseline, or null if not found or invalid
 */
export async function loadBaseline(
  id: string,
  options: BaselineStorageOptions = {}
): Promise<Baseline | null> {
  const baseDir = options.baseDir ?? getBaselinesDir();
  const filePath = join(baseDir, `${id}.json`);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = await Bun.file(filePath).text();
    const data: unknown = JSON.parse(content);
    const parsed = parseBaselineFile(data);

    if (!parsed) {
      return null;
    }

    // Cast from Zod inferred type to our Baseline type
    // The schemas are compatible but TypeScript's exactOptionalPropertyTypes
    // makes the types technically incompatible
    return parsed.baseline as unknown as Baseline;
  } catch {
    // Invalid JSON or parse error
    return null;
  }
}

/**
 * Get the latest baseline.
 *
 * Reads the latest.json pointer to find the most recent baseline.
 *
 * @param options - Storage options
 * @returns The latest baseline, or null if none exists
 */
export async function getLatestBaseline(
  options: BaselineStorageOptions = {}
): Promise<Baseline | null> {
  const baseDir = options.baseDir ?? getBaselinesDir();
  const latestPath = join(baseDir, LATEST_FILENAME);

  if (!existsSync(latestPath)) {
    return null;
  }

  try {
    const content = await Bun.file(latestPath).text();
    const data: unknown = JSON.parse(content);
    const parsed = parseBaselineFile(data);

    if (!parsed) {
      return null;
    }

    // Cast from Zod inferred type to our Baseline type
    return parsed.baseline as unknown as Baseline;
  } catch {
    return null;
  }
}

/**
 * Update baseline label and/or notes.
 *
 * @param id - The baseline UUID
 * @param updates - Fields to update
 * @param options - Storage options
 * @returns True if updated, false if baseline not found
 */
export async function updateBaseline(
  id: string,
  updates: { label?: string; notes?: string },
  options: BaselineStorageOptions = {}
): Promise<boolean> {
  const baseDir = options.baseDir ?? getBaselinesDir();
  const baseline = await loadBaseline(id, { baseDir });

  if (!baseline) {
    return false;
  }

  // Apply updates
  if (updates.label !== undefined) {
    baseline.label = updates.label;
  }
  if (updates.notes !== undefined) {
    baseline.notes = updates.notes;
  }

  // Save updated baseline
  await saveBaseline(baseline, { baseDir });

  return true;
}

/**
 * Delete a baseline.
 *
 * @param id - The baseline UUID
 * @param options - Storage options
 * @returns True if deleted, false if not found
 */
export async function deleteBaseline(
  id: string,
  options: BaselineStorageOptions = {}
): Promise<boolean> {
  const baseDir = options.baseDir ?? getBaselinesDir();
  const filePath = join(baseDir, `${id}.json`);

  if (!existsSync(filePath)) {
    return false;
  }

  // Check if this is the latest baseline
  const latest = await getLatestBaseline({ baseDir });
  const wasLatest = latest?.id === id;

  // Delete the file
  unlinkSync(filePath);

  // Remove from index if database exists
  try {
    const { initBaselineSchema, removeIndex } = await import('./indexer');
    const db = await initBaselineSchema({ baseDir });
    removeIndex(db, id);
    db.close();
  } catch {
    // Index may not exist yet, that's ok
  }

  // Update latest pointer if needed
  if (wasLatest) {
    await rebuildLatestPointer(baseDir);
  }

  return true;
}

/**
 * List all baseline IDs in the storage directory.
 *
 * @param options - Storage options
 * @returns Array of baseline UUIDs
 */
export function listBaselineIds(options: BaselineStorageOptions = {}): string[] {
  const baseDir = options.baseDir ?? getBaselinesDir();

  if (!existsSync(baseDir)) {
    return [];
  }

  const files = readdirSync(baseDir);
  return files
    .filter((f) => f.endsWith('.json') && f !== LATEST_FILENAME)
    .map((f) => f.replace('.json', ''));
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Update the latest.json pointer to a new baseline.
 *
 * Only updates if the new baseline is actually newer than the current latest.
 */
async function updateLatestPointer(
  baseDir: string,
  baselineId: string,
  createdAt: string
): Promise<void> {
  const latestPath = join(baseDir, LATEST_FILENAME);

  // Check if we need to update
  if (existsSync(latestPath)) {
    try {
      const content = await Bun.file(latestPath).text();
      const data: unknown = JSON.parse(content);
      const parsed = parseBaselineFile(data);

      if (parsed && parsed.baseline.createdAt >= createdAt) {
        // Current latest is newer or same, don't update
        return;
      }
    } catch {
      // Invalid latest, will be replaced
    }
  }

  // Load the baseline and write to latest
  const baseline = await loadBaseline(baselineId, { baseDir });
  if (baseline) {
    const fileContent: BaselineFile = {
      version: BASELINE_FILE_VERSION,
      baseline,
    };
    await atomicWriteJson(latestPath, fileContent);
  }
}

/**
 * Rebuild the latest.json pointer by scanning all baselines.
 *
 * Used after deleting the current latest baseline.
 */
async function rebuildLatestPointer(baseDir: string): Promise<void> {
  const latestPath = join(baseDir, LATEST_FILENAME);

  // Get all baseline IDs
  const ids = listBaselineIds({ baseDir });

  if (ids.length === 0) {
    // No baselines left, remove latest pointer
    if (existsSync(latestPath)) {
      unlinkSync(latestPath);
    }
    return;
  }

  // Find the most recent baseline
  let latestBaseline: Baseline | null = null;

  for (const id of ids) {
    const baseline = await loadBaseline(id, { baseDir });
    if (baseline) {
      if (!latestBaseline || baseline.createdAt > latestBaseline.createdAt) {
        latestBaseline = baseline;
      }
    }
  }

  if (latestBaseline) {
    const fileContent: BaselineFile = {
      version: BASELINE_FILE_VERSION,
      baseline: latestBaseline,
    };
    await atomicWriteJson(latestPath, fileContent);
  }
}
