/**
 * EP03 Persistence Layer - Baseline Queries
 *
 * High-level query functions that combine storage and indexing.
 * Provides the public API for querying baselines.
 *
 * @module persistence/baselines/queries
 */

import { Database } from 'bun:sqlite';
import { existsSync } from 'node:fs';

import type { Baseline, BaselineMetrics, BaselineQueryOptions, BaselineSummary } from '../types';
import { getBaselinesDir } from '../common';
import { loadBaseline, getLatestBaseline, listBaselineIds } from './storage';
import { initBaselineSchema, getIndexedBaselines, getIndexedBaselineById } from './indexer';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for query operations.
 */
export interface QueryOptions {
  /** Base directory for baselines */
  baseDir?: string;
}

/**
 * Result of comparing two baselines.
 */
export interface BaselineComparison {
  /** The older baseline */
  from: BaselineSummary;
  /** The newer baseline */
  to: BaselineSummary;
  /** Delta in metrics (to - from) */
  delta: BaselineMetrics;
  /** Overall trend classification */
  trend: 'improved' | 'regressed' | 'unchanged';
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Query baselines with filtering and sorting.
 *
 * Uses SQLite index for fast queries, returns summaries without full findings.
 *
 * @param options - Query options
 * @param queryOptions - Filtering and sorting options
 * @returns Array of baseline summaries
 */
export async function queryBaselines(
  options: QueryOptions = {},
  queryOptions: BaselineQueryOptions = {}
): Promise<BaselineSummary[]> {
  const baseDir = options.baseDir ?? getBaselinesDir();

  // If no baselines exist, return empty
  if (!existsSync(baseDir)) {
    return [];
  }

  // Ensure index is up to date
  const db = await ensureIndexUpToDate(baseDir);

  try {
    const results = getIndexedBaselines(db, queryOptions);
    return results;
  } finally {
    db.close();
  }
}

/**
 * Get a baseline by ID with full findings.
 *
 * @param id - Baseline UUID
 * @param options - Query options
 * @returns Full baseline or null if not found
 */
export async function getBaselineById(
  id: string,
  options: QueryOptions = {}
): Promise<Baseline | null> {
  const baseDir = options.baseDir ?? getBaselinesDir();
  return loadBaseline(id, { baseDir });
}

/**
 * Get the latest baseline with full findings.
 *
 * @param options - Query options
 * @returns Latest baseline or null if none exists
 */
export async function getLatest(options: QueryOptions = {}): Promise<Baseline | null> {
  const baseDir = options.baseDir ?? getBaselinesDir();
  return getLatestBaseline({ baseDir });
}

/**
 * Compare two baselines and calculate delta metrics.
 *
 * @param fromId - ID of the older baseline
 * @param toId - ID of the newer baseline
 * @param options - Query options
 * @returns Comparison result or null if either baseline not found
 */
export async function compareBaselines(
  fromId: string,
  toId: string,
  options: QueryOptions = {}
): Promise<BaselineComparison | null> {
  const baseDir = options.baseDir ?? getBaselinesDir();

  // Ensure index is up to date
  const db = await ensureIndexUpToDate(baseDir);

  try {
    const from = getIndexedBaselineById(db, fromId);
    const to = getIndexedBaselineById(db, toId);

    if (!from || !to) {
      return null;
    }

    // Calculate delta
    const delta: BaselineMetrics = {
      findingsCount: to.metrics.findingsCount - from.metrics.findingsCount,
      criticalCount: to.metrics.criticalCount - from.metrics.criticalCount,
      highCount: to.metrics.highCount - from.metrics.highCount,
      mediumCount: to.metrics.mediumCount - from.metrics.mediumCount,
      lowCount: to.metrics.lowCount - from.metrics.lowCount,
      infoCount: to.metrics.infoCount - from.metrics.infoCount,
    };

    // Determine trend based on total findings and severity-weighted score
    const trend = determineTrend(delta);

    return {
      from,
      to,
      delta,
      trend,
    };
  } finally {
    db.close();
  }
}

/**
 * Get baseline history in chronological order.
 *
 * @param options - Query options
 * @param limit - Maximum number of baselines to return
 * @param filter - Optional filter criteria
 * @returns Array of baseline summaries in chronological order (oldest first)
 */
export async function getBaselineHistory(
  options: QueryOptions = {},
  limit?: number,
  filter?: BaselineQueryOptions
): Promise<BaselineSummary[]> {
  const baseDir = options.baseDir ?? getBaselinesDir();

  if (!existsSync(baseDir)) {
    return [];
  }

  const db = await ensureIndexUpToDate(baseDir);

  try {
    const queryOpts: BaselineQueryOptions = {
      ...filter,
      orderBy: 'createdAt',
      order: 'asc',
    };

    if (limit !== undefined) {
      queryOpts.limit = limit;
    }

    return getIndexedBaselines(db, queryOpts);
  } finally {
    db.close();
  }
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Ensure the SQLite index is up to date with the JSON files.
 *
 * Rebuilds the index if needed by scanning all baseline files.
 */
async function ensureIndexUpToDate(baseDir: string): Promise<Database> {
  const db = await initBaselineSchema({ baseDir });

  // Get all baseline IDs from filesystem
  const fileIds = listBaselineIds({ baseDir });

  // Index any that are missing
  for (const id of fileIds) {
    const exists = getIndexedBaselineById(db, id);
    if (!exists) {
      const baseline = await loadBaseline(id, { baseDir });
      if (baseline) {
        const { indexBaseline } = await import('./indexer');
        indexBaseline(db, baseline, `${baseDir}/${id}.json`);
      }
    }
  }

  return db;
}

/**
 * Determine the trend based on delta metrics.
 *
 * Uses a weighted scoring system:
 * - Critical: 10 points
 * - High: 5 points
 * - Medium: 2 points
 * - Low: 1 point
 * - Info: 0 points
 *
 * Falls back to total findingsCount if severity-weighted score is 0.
 */
function determineTrend(delta: BaselineMetrics): 'improved' | 'regressed' | 'unchanged' {
  // Severity-weighted score (higher severity = more impact)
  const severityScore =
    delta.criticalCount * 10 +
    delta.highCount * 5 +
    delta.mediumCount * 2 +
    delta.lowCount * 1 +
    delta.infoCount * 0;

  // Use severity score if non-zero, otherwise fall back to total count
  const score = severityScore !== 0 ? severityScore : delta.findingsCount;

  if (score < 0) {
    return 'improved';
  } else if (score > 0) {
    return 'regressed';
  } else {
    return 'unchanged';
  }
}
