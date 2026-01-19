/**
 * EP09 Temporal Analysis - Delta Calculator
 *
 * Wraps jsondiffpatch to calculate structured differences between baselines.
 * Provides semantic diff for baseline metrics and findings.
 *
 * @module temporal/delta/calculator
 */

import { create as createDiffPatcher, type DiffPatcher, type Delta } from 'jsondiffpatch';

import type { Baseline, BaselineMetrics } from '../../persistence/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for delta calculation.
 */
export interface DeltaCalculatorOptions {
  /** Include detailed array diffs for findings */
  includeArrayDiffs?: boolean;
  /** Treat findings as objects with id for matching */
  objectHash?: boolean;
}

/**
 * Raw delta result before summarization.
 */
export interface RawDelta {
  /** The jsondiffpatch delta object */
  delta: unknown;
  /** Whether any changes were detected */
  hasChanges: boolean;
  /** Metric-specific changes */
  metricsDelta: MetricsDelta | null;
}

/**
 * Changes to individual metrics.
 */
export interface MetricsDelta {
  /** Metrics that changed */
  changed: Array<{
    name: string;
    from: number;
    to: number;
  }>;
  /** Metrics that were added */
  added: Array<{
    name: string;
    value: number;
  }>;
  /** Metrics that were removed */
  removed: Array<{
    name: string;
    value: number;
  }>;
}

// =============================================================================
// Private State
// =============================================================================

/** Singleton diffpatcher instance */
let diffPatcher: DiffPatcher | null = null;

// =============================================================================
// Public API
// =============================================================================

/**
 * Get or create the jsondiffpatch instance.
 *
 * @param options - Configuration options
 * @returns Configured DiffPatcher instance
 */
export function getDiffPatcher(options: DeltaCalculatorOptions = {}): DiffPatcher {
  if (diffPatcher === null || options.objectHash !== undefined) {
    const config: Parameters<typeof createDiffPatcher>[0] = {};

    // Configure object matching for findings array
    if (options.objectHash !== false) {
      config.objectHash = (obj: unknown): string => {
        // Handle Finding objects with id
        if (obj && typeof obj === 'object' && 'id' in obj) {
          return (obj as { id: string }).id;
        }
        // Fallback to JSON stringification
        return JSON.stringify(obj);
      };
    }

    // Configure array handling
    if (options.includeArrayDiffs !== false) {
      config.arrays = {
        detectMove: true,
        includeValueOnMove: false,
      };
    }

    diffPatcher = createDiffPatcher(config);
  }

  return diffPatcher;
}

/**
 * Calculate the delta between two baselines.
 *
 * Uses jsondiffpatch to compute structural differences and extracts
 * semantic changes for metrics.
 *
 * @param from - The older baseline
 * @param to - The newer baseline
 * @param options - Calculation options
 * @returns Raw delta object
 *
 * @example
 * ```typescript
 * const from = await loadBaseline(fromId);
 * const to = await loadBaseline(toId);
 * const { delta, hasChanges, metricsDelta } = calculateDelta(from, to);
 * ```
 */
export function calculateDelta(
  from: Baseline,
  to: Baseline,
  options: DeltaCalculatorOptions = {}
): RawDelta {
  const patcher = getDiffPatcher(options);

  // Calculate full delta
  const delta = patcher.diff(from, to);

  // Check if any changes exist
  const hasChanges = delta !== undefined;

  // Extract metrics-specific delta
  const metricsDelta = hasChanges ? extractMetricsDelta(from.metrics, to.metrics) : null;

  return {
    delta,
    hasChanges,
    metricsDelta,
  };
}

/**
 * Calculate delta for metrics only.
 *
 * Lighter-weight comparison focused on numeric metrics.
 *
 * @param from - Previous metrics
 * @param to - Current metrics
 * @returns Metrics delta or null if unchanged
 */
export function calculateMetricsDelta(
  from: BaselineMetrics,
  to: BaselineMetrics
): MetricsDelta | null {
  return extractMetricsDelta(from, to);
}

/**
 * Apply a delta to reconstruct a target baseline.
 *
 * @param base - The source baseline
 * @param delta - Delta to apply
 * @returns Reconstructed baseline
 */
export function applyDelta(base: Baseline, delta: Delta | undefined): Baseline {
  if (delta === undefined) {
    return base;
  }
  const patcher = getDiffPatcher();
  return patcher.patch(structuredClone(base), delta) as Baseline;
}

/**
 * Reverse a delta to get the inverse transformation.
 *
 * @param delta - Original delta
 * @returns Reversed delta
 */
export function reverseDelta(delta: Delta | undefined): Delta | undefined {
  if (delta === undefined) {
    return undefined;
  }
  const patcher = getDiffPatcher();
  return patcher.reverse(delta);
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Extract semantic changes from two metrics objects.
 */
function extractMetricsDelta(from: BaselineMetrics, to: BaselineMetrics): MetricsDelta | null {
  const changed: MetricsDelta['changed'] = [];
  const added: MetricsDelta['added'] = [];
  const removed: MetricsDelta['removed'] = [];

  // Get all unique keys
  const fromKeys = new Set(Object.keys(from));
  const toKeys = new Set(Object.keys(to));
  const allKeys = new Set([...fromKeys, ...toKeys]);

  for (const key of allKeys) {
    const fromValue = (from as unknown as Record<string, number | undefined>)[key];
    const toValue = (to as unknown as Record<string, number | undefined>)[key];

    if (fromValue === undefined && toValue !== undefined) {
      // Added
      added.push({ name: key, value: toValue });
    } else if (fromValue !== undefined && toValue === undefined) {
      // Removed
      removed.push({ name: key, value: fromValue });
    } else if (fromValue !== toValue && fromValue !== undefined && toValue !== undefined) {
      // Changed
      changed.push({ name: key, from: fromValue, to: toValue });
    }
  }

  // Return null if no changes
  if (changed.length === 0 && added.length === 0 && removed.length === 0) {
    return null;
  }

  return { changed, added, removed };
}
