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
 *
 * Note: slopeThreshold and rSquaredThreshold were removed per ADR-0019.
 * The agent interprets trend direction based on raw slope and rSquared values.
 */
export interface TrendAnalysisOptions {
  /** Minimum coverage required for metrics (0-1, default: 0.5) */
  minCoverage?: number;
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
 * Per ADR-0019, returns raw statistics. The agent interprets
 * whether the overall trend is positive or negative.
 *
 * @param analysis - TrendAnalysis to summarize
 * @returns Summary with slope statistics and volatility counts
 */
export function getTrendSummary(analysis: TrendAnalysis): {
  slopePositiveCount: number;
  slopeNegativeCount: number;
  slopeNearZeroCount: number;
  highVolatilityCount: number;
  averageRSquared: number;
} {
  const SLOPE_THRESHOLD = 0.01;
  const VOLATILITY_THRESHOLD = 0.5;

  let slopePositiveCount = 0;
  let slopeNegativeCount = 0;
  let slopeNearZeroCount = 0;
  let highVolatilityCount = 0;
  let totalRSquared = 0;

  for (const trend of analysis.metricTrends) {
    if (trend.volatility > VOLATILITY_THRESHOLD) {
      highVolatilityCount++;
    }

    if (Math.abs(trend.slope) < SLOPE_THRESHOLD) {
      slopeNearZeroCount++;
    } else if (trend.slope > 0) {
      slopePositiveCount++;
    } else {
      slopeNegativeCount++;
    }

    totalRSquared += trend.rSquared;
  }

  const averageRSquared =
    analysis.metricTrends.length > 0 ? totalRSquared / analysis.metricTrends.length : 0;

  return {
    slopePositiveCount,
    slopeNegativeCount,
    slopeNearZeroCount,
    highVolatilityCount,
    averageRSquared,
  };
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
 * Get trends by slope direction.
 *
 * Per ADR-0019, filters by raw slope direction. The agent
 * interprets whether positive/negative slope is good or bad.
 *
 * @param analysis - TrendAnalysis to filter
 * @param slopeDirection - Slope direction to filter for
 * @param slopeThreshold - Minimum slope magnitude (default: 0.01)
 * @returns Trends matching the slope direction
 */
export function getTrendsByDirection(
  analysis: TrendAnalysis,
  slopeDirection: 'positive' | 'negative' | 'near_zero',
  slopeThreshold: number = 0.01
): MetricTrend[] {
  return analysis.metricTrends.filter((trend) => {
    if (slopeDirection === 'positive') {
      return trend.slope > slopeThreshold;
    } else if (slopeDirection === 'negative') {
      return trend.slope < -slopeThreshold;
    } else {
      return Math.abs(trend.slope) <= slopeThreshold;
    }
  });
}
