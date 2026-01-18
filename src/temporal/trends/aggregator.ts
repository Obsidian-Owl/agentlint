/**
 * EP09 Temporal Analysis - Metric Aggregator
 *
 * Aggregates metrics from multiple baselines into time series data
 * for trend analysis. Handles missing metrics gracefully and aligns
 * data points by timestamp.
 *
 * @module temporal/trends/aggregator
 */

import type { Baseline, BaselineMetrics } from '../../persistence/types';
import type { TimeSeriesPoint, DateRange } from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * Aggregated metrics for a single metric across baselines.
 */
export interface AggregatedMetric {
  /** Metric name */
  name: string;
  /** Time series data points */
  points: TimeSeriesPoint[];
  /** Number of baselines containing this metric */
  coverage: number;
  /** Total number of baselines analyzed */
  totalBaselines: number;
}

/**
 * Result of aggregating metrics across baselines.
 */
export interface AggregationResult {
  /** Aggregated metrics by name */
  metrics: Map<string, AggregatedMetric>;
  /** Date range covered */
  dateRange: DateRange;
  /** Number of baselines processed */
  baselineCount: number;
  /** Baseline IDs included */
  baselineIds: string[];
}

/**
 * Options for metric aggregation.
 */
export interface AggregationOptions {
  /** Minimum coverage required (0-1, default: 0.5) */
  minCoverage?: number;
  /** Metrics to include (default: all) */
  includeMetrics?: string[];
  /** Metrics to exclude */
  excludeMetrics?: string[];
}

// =============================================================================
// Constants
// =============================================================================

/** Default minimum coverage threshold */
const DEFAULT_MIN_COVERAGE = 0.5;

/** Core metrics always included if present */
const CORE_METRICS = [
  'findingsCount',
  'criticalCount',
  'highCount',
  'mediumCount',
  'lowCount',
  'infoCount',
];

// =============================================================================
// Public API
// =============================================================================

/**
 * Aggregate metrics from multiple baselines into time series data.
 *
 * @param baselines - Array of baselines to aggregate (must be 2+)
 * @param options - Aggregation options
 * @returns Aggregation result with metrics and metadata
 * @throws {Error} If fewer than 2 baselines provided
 *
 * @example
 * ```typescript
 * const baselines = await getBaselineHistory('/my/project', { limit: 10 });
 * const result = aggregateMetrics(baselines);
 *
 * for (const [name, metric] of result.metrics) {
 *   console.log(`${name}: ${metric.points.length} data points`);
 * }
 * ```
 */
export function aggregateMetrics(
  baselines: Baseline[],
  options: AggregationOptions = {}
): AggregationResult {
  if (baselines.length < 2) {
    throw new Error('At least 2 baselines are required for trend analysis');
  }

  const minCoverage = options.minCoverage ?? DEFAULT_MIN_COVERAGE;

  // Sort baselines by timestamp (oldest first)
  const sorted = [...baselines].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Extract all unique metric names
  const allMetricNames = extractMetricNames(sorted, options);

  // Build time series for each metric
  const metrics = new Map<string, AggregatedMetric>();

  for (const name of allMetricNames) {
    const points = extractTimeSeriesPoints(sorted, name);
    const coverage = points.length / sorted.length;

    // Skip metrics below coverage threshold
    if (coverage < minCoverage) {
      continue;
    }

    metrics.set(name, {
      name,
      points,
      coverage,
      totalBaselines: sorted.length,
    });
  }

  // Calculate date range
  const firstBaseline = sorted[0];
  const lastBaseline = sorted[sorted.length - 1];
  const dateRange: DateRange = {
    start: firstBaseline ? firstBaseline.createdAt : new Date().toISOString(),
    end: lastBaseline ? lastBaseline.createdAt : new Date().toISOString(),
  };

  return {
    metrics,
    dateRange,
    baselineCount: sorted.length,
    baselineIds: sorted.map((b) => b.id),
  };
}

/**
 * Get the list of available metrics from baselines.
 *
 * @param baselines - Baselines to analyze
 * @returns Array of metric names present in at least one baseline
 */
export function getAvailableMetrics(baselines: Baseline[]): string[] {
  const metricSet = new Set<string>();

  for (const baseline of baselines) {
    for (const key of Object.keys(baseline.metrics)) {
      metricSet.add(key);
    }
  }

  return Array.from(metricSet).sort();
}

/**
 * Calculate coverage for each metric across baselines.
 *
 * @param baselines - Baselines to analyze
 * @returns Map of metric name to coverage ratio (0-1)
 */
export function calculateMetricCoverage(baselines: Baseline[]): Map<string, number> {
  if (baselines.length === 0) {
    return new Map();
  }

  const counts = new Map<string, number>();

  for (const baseline of baselines) {
    for (const key of Object.keys(baseline.metrics)) {
      const current = counts.get(key) ?? 0;
      counts.set(key, current + 1);
    }
  }

  const coverage = new Map<string, number>();
  for (const [name, count] of counts) {
    coverage.set(name, count / baselines.length);
  }

  return coverage;
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Extract unique metric names respecting include/exclude options.
 */
function extractMetricNames(baselines: Baseline[], options: AggregationOptions): Set<string> {
  const names = new Set<string>();

  // Collect all metric names
  for (const baseline of baselines) {
    for (const key of Object.keys(baseline.metrics)) {
      names.add(key);
    }
  }

  // Apply include filter
  if (options.includeMetrics && options.includeMetrics.length > 0) {
    const includeSet = new Set(options.includeMetrics);
    for (const name of names) {
      if (!includeSet.has(name)) {
        names.delete(name);
      }
    }
  }

  // Apply exclude filter
  if (options.excludeMetrics && options.excludeMetrics.length > 0) {
    for (const exclude of options.excludeMetrics) {
      names.delete(exclude);
    }
  }

  return names;
}

/**
 * Extract time series points for a specific metric.
 */
function extractTimeSeriesPoints(baselines: Baseline[], metricName: string): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = [];

  for (const baseline of baselines) {
    const value = getMetricValue(baseline.metrics, metricName);

    if (value !== undefined) {
      points.push({
        timestamp: baseline.createdAt,
        value,
        baselineId: baseline.id,
      });
    }
  }

  return points;
}

/**
 * Get a metric value from BaselineMetrics.
 */
function getMetricValue(metrics: BaselineMetrics, name: string): number | undefined {
  // Type-safe access to metrics using unknown cast
  const value = (metrics as unknown as Record<string, unknown>)[name];

  if (typeof value === 'number') {
    return value;
  }

  return undefined;
}

/**
 * Check if a metric is a core metric.
 */
export function isCoreMetric(name: string): boolean {
  return CORE_METRICS.includes(name);
}
