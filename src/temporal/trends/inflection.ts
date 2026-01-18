/**
 * EP09 Temporal Analysis - Inflection Point Detection
 *
 * Provides statistical inflection point detection for metric time series.
 * Per ADR-0019 (Tool/Agent Boundary), returns raw slope statistics and
 * change points - does NOT label as "improving/degrading".
 *
 * @module temporal/trends/inflection
 */

import type { TimeSeriesPoint, MetricTrend } from '../types';
import { linearRegression, timeSeriestoPoints, type Point } from './regression';

// =============================================================================
// Types
// =============================================================================

/**
 * A detected inflection point in a metric time series.
 *
 * Per ADR-0019, provides raw statistical data for agent interpretation.
 * Agent determines whether inflection is "improvement" or "regression".
 */
export interface InflectionPointData {
  /** ISO-8601 timestamp of the inflection */
  timestamp: string;
  /** Baseline ID at the inflection point */
  baselineId: string;
  /** Index in the time series */
  index: number;
  /** Slope of linear regression BEFORE this point */
  slopeBefore: number;
  /** R² of regression before this point */
  rSquaredBefore: number;
  /** Slope of linear regression AFTER this point */
  slopeAfter: number;
  /** R² of regression after this point */
  rSquaredAfter: number;
  /** Absolute change in slope */
  slopeChange: number;
  /** Relative change in slope (percentage) */
  slopeChangePercent: number;
}

/**
 * Result of inflection point detection.
 */
export interface InflectionDetectionResult {
  /** Metric name */
  metric: string;
  /** Detected inflection points (may be empty) */
  inflectionPoints: InflectionPointData[];
  /** Overall slope across entire series */
  overallSlope: number;
  /** Overall R² across entire series */
  overallRSquared: number;
  /** Number of data points analyzed */
  dataPointCount: number;
}

/**
 * Options for inflection point detection.
 */
export interface InflectionDetectionOptions {
  /** Minimum number of points before/after to calculate slope (default: 3) */
  minWindowSize?: number;
  /** Minimum absolute slope change to count as inflection (default: 0) */
  minSlopeChange?: number;
  /** Minimum relative slope change percentage (default: 0.1 = 10%) */
  minSlopeChangePercent?: number;
  /** Whether to use time-weighted X values (default: false = sequential indices) */
  useTimeWeighted?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Default minimum window size for slope calculation */
const DEFAULT_MIN_WINDOW = 3;

/** Default minimum slope change to detect (0 = detect all changes) */
const DEFAULT_MIN_SLOPE_CHANGE = 0;

/** Default minimum percentage change (10%) */
const DEFAULT_MIN_SLOPE_CHANGE_PERCENT = 0.1;

// =============================================================================
// Public API
// =============================================================================

/**
 * Detect inflection points in a metric trend.
 *
 * Per ADR-0019, returns raw slope statistics for agent interpretation.
 * Does NOT classify as "improving" or "degrading" - agent decides that.
 *
 * @param trend - Metric trend containing time series data
 * @param options - Detection options
 * @returns Inflection detection result with raw statistical data
 *
 * @example
 * ```typescript
 * const result = detectInflectionPoints(metricTrend);
 * // Agent interprets: "Slope changed from -2.5 to +1.8 at 2026-01-15"
 * // Agent determines: "This appears to be an improvement point"
 * ```
 */
export function detectInflectionPoints(
  trend: MetricTrend,
  options: InflectionDetectionOptions = {}
): InflectionDetectionResult {
  const minWindow = options.minWindowSize ?? DEFAULT_MIN_WINDOW;
  const minSlopeChange = options.minSlopeChange ?? DEFAULT_MIN_SLOPE_CHANGE;
  const minSlopeChangePercent = options.minSlopeChangePercent ?? DEFAULT_MIN_SLOPE_CHANGE_PERCENT;

  const timeSeries = trend.values;

  // Need at least 2*minWindow points to detect any inflection
  if (timeSeries.length < minWindow * 2) {
    return {
      metric: trend.metricName,
      inflectionPoints: [],
      overallSlope: trend.slope,
      overallRSquared: trend.rSquared,
      dataPointCount: timeSeries.length,
    };
  }

  const points = timeSeriestoPoints(timeSeries);
  const inflectionPoints: InflectionPointData[] = [];

  // Slide through the series, looking for points where slope changes significantly
  for (let i = minWindow; i <= timeSeries.length - minWindow; i++) {
    const beforePoints = points.slice(i - minWindow, i);
    const afterPoints = points.slice(i, i + minWindow);

    // Re-index afterPoints to start from 0
    const afterPointsNormalized: Point[] = afterPoints.map((p, idx) => ({
      x: idx,
      y: p.y,
    }));

    const beforeRegression = linearRegression(beforePoints);
    const afterRegression = linearRegression(afterPointsNormalized);

    const slopeBefore = beforeRegression.slope;
    const slopeAfter = afterRegression.slope;
    const slopeChange = Math.abs(slopeAfter - slopeBefore);

    // Calculate relative change (handle division by zero)
    const slopeChangePercent =
      slopeBefore === 0
        ? slopeAfter === 0
          ? 0
          : 1 // If before is 0 and after isn't, that's 100% change
        : slopeChange / Math.abs(slopeBefore);

    // Check if this qualifies as an inflection point
    if (slopeChange >= minSlopeChange && slopeChangePercent >= minSlopeChangePercent) {
      const currentPoint = timeSeries[i];
      if (currentPoint) {
        inflectionPoints.push({
          timestamp: currentPoint.timestamp,
          baselineId: currentPoint.baselineId,
          index: i,
          slopeBefore,
          rSquaredBefore: beforeRegression.rSquared,
          slopeAfter,
          rSquaredAfter: afterRegression.rSquared,
          slopeChange,
          slopeChangePercent,
        });
      }
    }
  }

  return {
    metric: trend.metricName,
    inflectionPoints: deduplicateInflections(inflectionPoints, minWindow),
    overallSlope: trend.slope,
    overallRSquared: trend.rSquared,
    dataPointCount: timeSeries.length,
  };
}

/**
 * Detect inflection points directly from time series data.
 *
 * Use this when you have raw time series instead of a MetricTrend object.
 *
 * @param metric - Name of the metric
 * @param timeSeries - Array of time series points
 * @param options - Detection options
 * @returns Inflection detection result
 */
export function detectInflectionPointsFromSeries(
  metric: string,
  timeSeries: TimeSeriesPoint[],
  options: InflectionDetectionOptions = {}
): InflectionDetectionResult {
  if (timeSeries.length < 2) {
    return {
      metric,
      inflectionPoints: [],
      overallSlope: 0,
      overallRSquared: 0,
      dataPointCount: timeSeries.length,
    };
  }

  const points = timeSeriestoPoints(timeSeries);
  const overall = linearRegression(points);

  // Calculate first/last values
  const firstValue = timeSeries[0]?.value ?? 0;
  const lastValue = timeSeries[timeSeries.length - 1]?.value ?? 0;
  const percentChange = firstValue === 0 ? 0 : ((lastValue - firstValue) / firstValue) * 100;

  // Create a minimal MetricTrend for the main detection function
  const trend: MetricTrend = {
    metricName: metric,
    values: timeSeries,
    slope: overall.slope,
    rSquared: overall.rSquared,
    volatility: 0, // Not needed for inflection detection
    meanValue: overall.meanY,
    standardDeviation: 0, // Not needed for inflection detection
    firstValue,
    lastValue,
    percentChange,
  };

  return detectInflectionPoints(trend, options);
}

/**
 * Find the most significant inflection point.
 *
 * @param result - Inflection detection result
 * @returns The inflection with the largest slope change, or null if none
 */
export function findMostSignificantInflection(
  result: InflectionDetectionResult
): InflectionPointData | null {
  if (result.inflectionPoints.length === 0) {
    return null;
  }

  return result.inflectionPoints.reduce((max, current) =>
    current.slopeChange > max.slopeChange ? current : max
  );
}

/**
 * Filter inflection points by statistical significance.
 *
 * @param result - Inflection detection result
 * @param minRSquared - Minimum R² for both before and after segments
 * @returns Filtered inflection points with reliable linear fits
 */
export function filterBySignificance(
  result: InflectionDetectionResult,
  minRSquared: number
): InflectionPointData[] {
  return result.inflectionPoints.filter(
    (p) => p.rSquaredBefore >= minRSquared && p.rSquaredAfter >= minRSquared
  );
}

/**
 * Categorize inflection points by slope change direction.
 *
 * Per ADR-0019, this returns raw categories based on slope signs,
 * not value judgments like "improvement" or "regression".
 *
 * @param result - Inflection detection result
 * @returns Categorized inflection points
 */
export function categorizeInflections(result: InflectionDetectionResult): {
  /** Slope went from negative to positive */
  negativeToPositive: InflectionPointData[];
  /** Slope went from positive to negative */
  positiveToNegative: InflectionPointData[];
  /** Slope became more positive */
  increasingSlope: InflectionPointData[];
  /** Slope became more negative */
  decreasingSlope: InflectionPointData[];
} {
  const negativeToPositive: InflectionPointData[] = [];
  const positiveToNegative: InflectionPointData[] = [];
  const increasingSlope: InflectionPointData[] = [];
  const decreasingSlope: InflectionPointData[] = [];

  for (const point of result.inflectionPoints) {
    const slopeDiff = point.slopeAfter - point.slopeBefore;

    // Check for sign change
    if (point.slopeBefore < 0 && point.slopeAfter > 0) {
      negativeToPositive.push(point);
    } else if (point.slopeBefore > 0 && point.slopeAfter < 0) {
      positiveToNegative.push(point);
    }

    // Check for magnitude change
    if (slopeDiff > 0) {
      increasingSlope.push(point);
    } else if (slopeDiff < 0) {
      decreasingSlope.push(point);
    }
  }

  return {
    negativeToPositive,
    positiveToNegative,
    increasingSlope,
    decreasingSlope,
  };
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Remove duplicate inflection points that are too close together.
 *
 * Keeps the point with the largest slope change within each window.
 */
function deduplicateInflections(
  inflections: InflectionPointData[],
  windowSize: number
): InflectionPointData[] {
  if (inflections.length <= 1) {
    return inflections;
  }

  const result: InflectionPointData[] = [];
  let lastIndex = -windowSize;

  // Sort by index
  const sorted = [...inflections].sort((a, b) => a.index - b.index);

  for (const point of sorted) {
    if (point.index - lastIndex >= windowSize) {
      result.push(point);
      lastIndex = point.index;
    } else {
      // If within window, keep the one with larger slope change
      const lastPoint = result[result.length - 1];
      if (lastPoint && point.slopeChange > lastPoint.slopeChange) {
        result[result.length - 1] = point;
        lastIndex = point.index;
      }
    }
  }

  return result;
}
