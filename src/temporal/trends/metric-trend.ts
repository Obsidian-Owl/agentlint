/**
 * EP09 Temporal Analysis - Metric Trend Calculation
 *
 * Calculates MetricTrend objects from time series data using
 * linear regression and statistical analysis.
 *
 * @module temporal/trends/metric-trend
 */

import type { MetricTrend, TimeSeriesPoint, InflectionPoint } from '../types';
import { linearRegression, timeSeriestoPoints, calculateStats } from './regression';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for metric trend calculation.
 *
 * Note: Per ADR-0019, lowerIsBetter was removed. The agent determines
 * whether a trend represents improvement based on metric semantics
 * and project context.
 */
export interface MetricTrendOptions {
  /** Window size for inflection detection (default: 3) */
  inflectionWindow?: number;
}

// Note: LOWER_IS_BETTER_METRICS was removed per ADR-0019.
// The agent determines metric semantics, not tool code.
// See INVERTED_METRICS in config.ts for optional context.

// =============================================================================
// Public API
// =============================================================================

/**
 * Calculate a MetricTrend from time series data.
 *
 * Per ADR-0019, returns statistical data (slope, rSquared, volatility).
 * The agent interprets whether the trend represents improvement or
 * degradation based on metric semantics and project context.
 *
 * @param metricName - Name of the metric
 * @param values - Time series data points
 * @param _options - Calculation options (reserved for future use)
 * @returns MetricTrend with slope, rSquared, volatility, and statistics
 *
 * @example
 * ```typescript
 * const trend = getMetricTrend('findingsCount', [
 *   { timestamp: '2026-01-01', value: 20, baselineId: 'a' },
 *   { timestamp: '2026-01-02', value: 15, baselineId: 'b' },
 *   { timestamp: '2026-01-03', value: 10, baselineId: 'c' },
 * ]);
 * // trend.slope < 0 (values decreasing)
 * // trend.rSquared close to 1 (linear pattern)
 * // Agent decides: "For findingsCount, decreasing is good"
 * ```
 */
export function getMetricTrend(
  metricName: string,
  values: TimeSeriesPoint[],
  _options: MetricTrendOptions = {}
): MetricTrend {
  if (values.length < 2) {
    // Return minimal trend for insufficient data
    return createMinimalTrend(metricName, values);
  }

  // Convert to regression points and calculate
  const points = timeSeriestoPoints(values);
  const regression = linearRegression(points);

  // Calculate statistics
  const numericValues = values.map((v) => v.value);
  const stats = calculateStats(numericValues);

  // Calculate volatility (coefficient of variation)
  // Higher volatility = more noise, less reliable trend
  const volatility = stats.mean !== 0 ? stats.stdDev / Math.abs(stats.mean) : 0;

  // Get first and last values
  const firstValue = values[0]?.value ?? 0;
  const lastValue = values[values.length - 1]?.value ?? 0;
  const percentChange = firstValue === 0 ? 0 : ((lastValue - firstValue) / firstValue) * 100;

  return {
    metricName,
    values,
    slope: regression.slope,
    rSquared: regression.rSquared,
    volatility,
    meanValue: stats.mean,
    standardDeviation: stats.stdDev,
    firstValue,
    lastValue,
    percentChange,
  };
}

/**
 * Detect inflection points where trends change direction.
 *
 * Uses a sliding window to detect sign changes in local slope.
 *
 * @param metricName - Name of the metric
 * @param values - Time series data points
 * @param windowSize - Size of sliding window (default: 3)
 * @returns Array of inflection points
 */
export function detectInflectionPoints(
  metricName: string,
  values: TimeSeriesPoint[],
  windowSize: number = 3
): InflectionPoint[] {
  if (values.length < windowSize * 2) {
    return []; // Not enough data to detect inflections
  }

  const inflections: InflectionPoint[] = [];

  // Calculate local slopes using sliding windows
  const slopes: number[] = [];
  for (let i = 0; i <= values.length - windowSize; i++) {
    const window = values.slice(i, i + windowSize);
    const points = timeSeriestoPoints(window);
    const regression = linearRegression(points);
    slopes.push(regression.slope);
  }

  // Detect sign changes in slopes
  for (let i = 1; i < slopes.length; i++) {
    const prevSlope = slopes[i - 1] ?? 0;
    const currSlope = slopes[i] ?? 0;

    // Sign change detection
    if ((prevSlope > 0 && currSlope < 0) || (prevSlope < 0 && currSlope > 0)) {
      // Find the baseline at the inflection point
      const inflectionIndex = i + Math.floor(windowSize / 2);
      const inflectionPoint = values[inflectionIndex];

      if (inflectionPoint) {
        inflections.push({
          timestamp: inflectionPoint.timestamp,
          metric: metricName,
          beforeDirection: prevSlope > 0 ? 'increasing' : 'decreasing',
          afterDirection: currSlope > 0 ? 'increasing' : 'decreasing',
          correlatedChanges: [], // Will be populated by git correlation
        });
      }
    }
  }

  return inflections;
}

// Note: isLowerBetterMetric() was removed per ADR-0019.
// The agent determines metric semantics based on context.
// See INVERTED_METRICS in config.ts for optional context.

/**
 * Calculate trend summary statistics across multiple metrics.
 *
 * Per ADR-0019, returns raw statistics. The agent interprets
 * whether the overall trend is "improving" or "degrading".
 *
 * @param trends - Array of MetricTrend objects
 * @returns Summary with slope statistics and volatility counts
 */
export function summarizeTrends(trends: MetricTrend[]): {
  /** Number of trends with slope > 0 (increasing values) */
  slopePositiveCount: number;
  /** Number of trends with slope < 0 (decreasing values) */
  slopeNegativeCount: number;
  /** Number of trends with slope ~= 0 (stable) */
  slopeNearZeroCount: number;
  /** Number of trends with high volatility (unreliable) */
  highVolatilityCount: number;
  /** Average R² across all trends (higher = more reliable) */
  averageRSquared: number;
} {
  const SLOPE_THRESHOLD = 0.01;
  const VOLATILITY_THRESHOLD = 0.5;

  let slopePositiveCount = 0;
  let slopeNegativeCount = 0;
  let slopeNearZeroCount = 0;
  let highVolatilityCount = 0;
  let totalRSquared = 0;

  for (const trend of trends) {
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

  const averageRSquared = trends.length > 0 ? totalRSquared / trends.length : 0;

  return {
    slopePositiveCount,
    slopeNegativeCount,
    slopeNearZeroCount,
    highVolatilityCount,
    averageRSquared,
  };
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Create a minimal trend for insufficient data (< 2 points).
 * Returns zero values for calculated statistics.
 */
function createMinimalTrend(metricName: string, values: TimeSeriesPoint[]): MetricTrend {
  const firstValue = values[0]?.value ?? 0;
  const lastValue = values[values.length - 1]?.value ?? firstValue;

  return {
    metricName,
    values,
    slope: 0,
    rSquared: 0,
    volatility: 0,
    meanValue: values.length > 0 ? values.reduce((sum, v) => sum + v.value, 0) / values.length : 0,
    standardDeviation: 0,
    firstValue,
    lastValue,
    percentChange: 0,
  };
}
