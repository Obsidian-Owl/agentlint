/**
 * EP09 Temporal Analysis - TrendAnalysis Builder
 *
 * Builds complete TrendAnalysis objects from baseline data,
 * combining metric aggregation, trend calculation, and
 * optional inflection point detection.
 *
 * @module temporal/trends/analysis
 */

import type { Baseline } from '../../persistence/types';
import type { TrendAnalysis, MetricTrend, InflectionPoint, DateRange } from '../types';
import { aggregateMetrics, type AggregationOptions } from './aggregator';
import { getMetricTrend, detectInflectionPoints, type MetricTrendOptions } from './metric-trend';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for building a TrendAnalysis.
 */
export interface TrendAnalysisOptions {
  /** Minimum coverage required for metrics (0-1, default: 0.5) */
  minCoverage?: number;
  /** Minimum slope to consider significant (default from config) */
  slopeThreshold?: number;
  /** Minimum R² for trend classification (default: 0.5) */
  rSquaredThreshold?: number;
  /** Metrics to include (default: all) */
  includeMetrics?: string[];
  /** Metrics to exclude */
  excludeMetrics?: string[];
  /** Include inflection point detection (default: true) */
  detectInflections?: boolean;
  /** Window size for inflection detection (default: 3) */
  inflectionWindow?: number;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Build a complete TrendAnalysis from baselines.
 *
 * Combines metric aggregation, linear regression, and trend
 * classification into a comprehensive analysis object.
 *
 * @param baselines - Array of baselines to analyze (minimum 2)
 * @param options - Analysis options
 * @returns Complete TrendAnalysis object
 * @throws {Error} If fewer than 2 baselines provided
 *
 * @example
 * ```typescript
 * const baselines = await getBaselineHistory('/my/project', { limit: 10 });
 * const analysis = buildTrendAnalysis(baselines, {
 *   includeMetrics: ['findingsCount', 'criticalCount'],
 *   detectInflections: true,
 * });
 *
 * console.log(`Overall trend: ${analysis.metricTrends.length} metrics analyzed`);
 * for (const trend of analysis.metricTrends) {
 *   console.log(`${trend.metricName}: ${trend.direction}`);
 * }
 * ```
 */
export function buildTrendAnalysis(
  baselines: Baseline[],
  options: TrendAnalysisOptions = {}
): TrendAnalysis {
  if (baselines.length < 2) {
    throw new Error('At least 2 baselines are required for trend analysis');
  }

  // Extract project path from first baseline
  const projectPath = baselines[0]?.projectPath ?? '';

  // Build aggregation options - only include defined properties
  const aggregationOptions: AggregationOptions = {};
  if (options.minCoverage !== undefined) {
    aggregationOptions.minCoverage = options.minCoverage;
  }
  if (options.includeMetrics !== undefined) {
    aggregationOptions.includeMetrics = options.includeMetrics;
  }
  if (options.excludeMetrics !== undefined) {
    aggregationOptions.excludeMetrics = options.excludeMetrics;
  }

  // Aggregate metrics across baselines
  const aggregation = aggregateMetrics(baselines, aggregationOptions);

  // Build metric trend options - only include defined properties
  const trendOptions: MetricTrendOptions = {};
  if (options.slopeThreshold !== undefined) {
    trendOptions.slopeThreshold = options.slopeThreshold;
  }
  if (options.rSquaredThreshold !== undefined) {
    trendOptions.rSquaredThreshold = options.rSquaredThreshold;
  }
  if (options.inflectionWindow !== undefined) {
    trendOptions.inflectionWindow = options.inflectionWindow;
  }

  // Calculate trends for each metric
  const metricTrends: MetricTrend[] = [];
  const allInflections: InflectionPoint[] = [];
  const detectInflections = options.detectInflections ?? true;

  for (const [name, aggregatedMetric] of aggregation.metrics) {
    // Calculate trend
    const trend = getMetricTrend(name, aggregatedMetric.points, trendOptions);
    metricTrends.push(trend);

    // Detect inflection points if enabled
    if (detectInflections && aggregatedMetric.points.length >= 6) {
      const inflections = detectInflectionPoints(
        name,
        aggregatedMetric.points,
        options.inflectionWindow
      );
      allInflections.push(...inflections);
    }
  }

  // Sort trends by metric name for consistent output
  metricTrends.sort((a, b) => a.metricName.localeCompare(b.metricName));

  // Sort inflection points by timestamp
  allInflections.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Build date range
  const dateRange: DateRange = aggregation.dateRange;

  // Build result object - only include inflectionPoints if we have any
  const result: TrendAnalysis = {
    projectPath,
    dateRange,
    baselineCount: aggregation.baselineCount,
    baselineIds: aggregation.baselineIds,
    metricTrends,
  };

  if (allInflections.length > 0) {
    result.inflectionPoints = allInflections;
  }

  return result;
}

/**
 * Check if there are enough baselines for trend analysis.
 *
 * @param baselines - Array of baselines to check
 * @param minimum - Minimum required (default: 3)
 * @returns True if sufficient baselines available
 */
export function hasSufficientBaselines(baselines: Baseline[], minimum: number = 3): boolean {
  return baselines.length >= minimum;
}

/**
 * Get a summary of the trend analysis.
 *
 * @param analysis - TrendAnalysis to summarize
 * @returns Summary with counts per direction
 */
export function getTrendSummary(analysis: TrendAnalysis): {
  improving: number;
  degrading: number;
  stable: number;
  volatile: number;
  overall: 'improving' | 'degrading' | 'stable' | 'mixed';
} {
  let improving = 0;
  let degrading = 0;
  let stable = 0;
  let volatile = 0;

  for (const trend of analysis.metricTrends) {
    switch (trend.direction) {
      case 'improving':
        improving++;
        break;
      case 'degrading':
        degrading++;
        break;
      case 'stable':
        stable++;
        break;
      case 'volatile':
        volatile++;
        break;
    }
  }

  // Determine overall trend
  let overall: 'improving' | 'degrading' | 'stable' | 'mixed';
  if (improving > degrading && improving > stable) {
    overall = 'improving';
  } else if (degrading > improving && degrading > stable) {
    overall = 'degrading';
  } else if (stable > improving && stable > degrading) {
    overall = 'stable';
  } else {
    overall = 'mixed';
  }

  return { improving, degrading, stable, volatile, overall };
}

/**
 * Filter trends to only significant changes.
 *
 * @param analysis - TrendAnalysis to filter
 * @param minPercentChange - Minimum percent change to include (default: 5)
 * @returns Filtered list of metric trends
 */
export function getSignificantTrends(
  analysis: TrendAnalysis,
  minPercentChange: number = 5
): MetricTrend[] {
  return analysis.metricTrends.filter((trend) => Math.abs(trend.percentChange) >= minPercentChange);
}

/**
 * Get trends for specific direction.
 *
 * @param analysis - TrendAnalysis to filter
 * @param direction - Direction to filter for
 * @returns Trends matching the direction
 */
export function getTrendsByDirection(
  analysis: TrendAnalysis,
  direction: 'improving' | 'degrading' | 'volatile' | 'stable'
): MetricTrend[] {
  return analysis.metricTrends.filter((trend) => trend.direction === direction);
}
