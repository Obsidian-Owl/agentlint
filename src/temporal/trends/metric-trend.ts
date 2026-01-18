/**
 * EP09 Temporal Analysis - Metric Trend Calculation
 *
 * Calculates MetricTrend objects from time series data using
 * linear regression and statistical analysis.
 *
 * @module temporal/trends/metric-trend
 */

import type { MetricTrend, TimeSeriesPoint, InflectionPoint } from '../types';
import { DEFAULT_THRESHOLD_CONFIG } from '../config';
import { linearRegression, timeSeriestoPoints, classifyTrend, calculateStats } from './regression';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for metric trend calculation.
 */
export interface MetricTrendOptions {
  /** Minimum slope to consider significant (default from config) */
  slopeThreshold?: number;
  /** Minimum R² for trend classification (default: 0.5) */
  rSquaredThreshold?: number;
  /** Whether lower values are better (e.g., findingsCount) */
  lowerIsBetter?: boolean;
  /** Window size for inflection detection (default: 3) */
  inflectionWindow?: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Metrics where lower values indicate improvement */
const LOWER_IS_BETTER_METRICS = new Set([
  'findingsCount',
  'criticalCount',
  'highCount',
  'mediumCount',
  'lowCount',
  'infoCount',
  'warningCount',
  'errorRate',
  'avgTokensPerSession',
  'avgIterationsPerSession',
]);

// =============================================================================
// Public API
// =============================================================================

/**
 * Calculate a MetricTrend from time series data.
 *
 * @param metricName - Name of the metric
 * @param values - Time series data points
 * @param options - Calculation options
 * @returns MetricTrend with direction, slope, statistics
 *
 * @example
 * ```typescript
 * const trend = getMetricTrend('findingsCount', [
 *   { timestamp: '2026-01-01', value: 20, baselineId: 'a' },
 *   { timestamp: '2026-01-02', value: 15, baselineId: 'b' },
 *   { timestamp: '2026-01-03', value: 10, baselineId: 'c' },
 * ]);
 * // trend.direction === 'improving' (findings decreasing)
 * // trend.slope < 0
 * ```
 */
export function getMetricTrend(
  metricName: string,
  values: TimeSeriesPoint[],
  options: MetricTrendOptions = {}
): MetricTrend {
  if (values.length < 2) {
    // Return stable trend for insufficient data
    return createStableTrend(metricName, values);
  }

  // Get thresholds
  const slopeThreshold = options.slopeThreshold ?? DEFAULT_THRESHOLD_CONFIG.default;
  const rSquaredThreshold = options.rSquaredThreshold ?? 0.5;
  const lowerIsBetter = options.lowerIsBetter ?? isLowerBetterMetric(metricName);

  // Convert to regression points and calculate
  const points = timeSeriestoPoints(values);
  const regression = linearRegression(points);

  // Calculate statistics
  const numericValues = values.map((v) => v.value);
  const stats = calculateStats(numericValues);

  // Classify trend
  let direction = classifyTrend(
    regression.slope,
    regression.rSquared,
    slopeThreshold,
    rSquaredThreshold
  );

  // Adjust direction interpretation based on metric semantics
  if (lowerIsBetter) {
    if (direction === 'improving') {
      direction = 'degrading'; // For findings, increasing is degrading
    } else if (direction === 'degrading') {
      direction = 'improving'; // For findings, decreasing is improving
    }
    // Recalculate based on actual slope direction
    if (regression.rSquared >= rSquaredThreshold) {
      if (regression.slope < -slopeThreshold) {
        direction = 'improving';
      } else if (regression.slope > slopeThreshold) {
        direction = 'degrading';
      } else {
        direction = 'stable';
      }
    }
  }

  // Get first and last values
  const firstValue = values[0]?.value ?? 0;
  const lastValue = values[values.length - 1]?.value ?? 0;
  const percentChange = firstValue === 0 ? 0 : ((lastValue - firstValue) / firstValue) * 100;

  return {
    metricName,
    direction,
    values,
    slope: regression.slope,
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

/**
 * Check if a metric is one where lower values are better.
 *
 * @param metricName - Name of the metric
 * @returns True if lower values indicate improvement
 */
export function isLowerBetterMetric(metricName: string): boolean {
  return LOWER_IS_BETTER_METRICS.has(metricName);
}

/**
 * Calculate trend summary across multiple metrics.
 *
 * @param trends - Array of MetricTrend objects
 * @returns Summary with counts per direction
 */
export function summarizeTrends(trends: MetricTrend[]): {
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

  for (const trend of trends) {
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

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Create a stable trend for insufficient data.
 */
function createStableTrend(metricName: string, values: TimeSeriesPoint[]): MetricTrend {
  const firstValue = values[0]?.value ?? 0;
  const lastValue = values[values.length - 1]?.value ?? firstValue;

  return {
    metricName,
    direction: 'stable',
    values,
    slope: 0,
    meanValue: values.length > 0 ? values.reduce((sum, v) => sum + v.value, 0) / values.length : 0,
    standardDeviation: 0,
    firstValue,
    lastValue,
    percentChange: 0,
  };
}
