/**
 * EP09 Temporal Analysis - Linear Regression
 *
 * Provides linear regression utilities for calculating trend slopes
 * and R² confidence values from time series data.
 *
 * @module temporal/trends/regression
 */

import type { TimeSeriesPoint } from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of linear regression calculation.
 */
export interface RegressionResult {
  /** Slope of the regression line (rate of change) */
  slope: number;
  /** Y-intercept of the regression line */
  intercept: number;
  /** R² coefficient (0-1, higher = better fit) */
  rSquared: number;
  /** Number of data points used */
  n: number;
  /** Mean X value */
  meanX: number;
  /** Mean Y value */
  meanY: number;
}

/**
 * A simple (x, y) point for regression.
 */
export interface Point {
  x: number;
  y: number;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Calculate the slope using simple linear regression.
 *
 * Uses the least squares method to find the best-fit line.
 *
 * @param points - Array of (x, y) points
 * @returns The slope of the best-fit line, or 0 if insufficient data
 *
 * @example
 * ```typescript
 * const slope = calculateSlope([
 *   { x: 0, y: 10 },
 *   { x: 1, y: 12 },
 *   { x: 2, y: 15 },
 * ]);
 * console.log(slope); // ~2.5 (values increasing over time)
 * ```
 */
export function calculateSlope(points: Point[]): number {
  if (points.length < 2) {
    return 0;
  }

  const result = linearRegression(points);
  return result.slope;
}

/**
 * Perform full linear regression analysis.
 *
 * Calculates slope, intercept, and R² coefficient of determination.
 *
 * @param points - Array of (x, y) points
 * @returns Full regression result
 * @throws {Error} If fewer than 2 points provided
 *
 * @example
 * ```typescript
 * const result = linearRegression([
 *   { x: 1, y: 2 },
 *   { x: 2, y: 4 },
 *   { x: 3, y: 6 },
 * ]);
 * // result.slope ≈ 2
 * // result.rSquared ≈ 1 (perfect linear fit)
 * ```
 */
export function linearRegression(points: Point[]): RegressionResult {
  const n = points.length;

  if (n < 2) {
    throw new Error('At least 2 points are required for linear regression');
  }

  // Calculate means
  let sumX = 0;
  let sumY = 0;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  // Calculate slope and intercept using least squares
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    const xDiff = point.x - meanX;
    const yDiff = point.y - meanY;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
  }

  // Handle edge case where all x values are the same
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = meanY - slope * meanX;

  // Calculate R² (coefficient of determination)
  let ssTotal = 0;
  let ssResidual = 0;
  for (const point of points) {
    const yPredicted = slope * point.x + intercept;
    ssTotal += (point.y - meanY) ** 2;
    ssResidual += (point.y - yPredicted) ** 2;
  }

  // R² = 1 - (SS_res / SS_tot)
  // Handle edge case where all y values are the same
  const rSquared = ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal;

  return {
    slope,
    intercept,
    rSquared: Math.max(0, Math.min(1, rSquared)), // Clamp to [0, 1]
    n,
    meanX,
    meanY,
  };
}

/**
 * Convert time series points to regression points.
 *
 * Normalizes timestamps to sequential indices (0, 1, 2, ...) for
 * easier interpretation of slope as "change per baseline".
 *
 * @param timeSeries - Array of time series points
 * @returns Array of (x, y) points for regression
 *
 * @example
 * ```typescript
 * const timePoints = [
 *   { timestamp: '2026-01-01', value: 10, baselineId: 'a' },
 *   { timestamp: '2026-01-02', value: 12, baselineId: 'b' },
 * ];
 * const points = timeSeriestoPoints(timePoints);
 * // [{ x: 0, y: 10 }, { x: 1, y: 12 }]
 * ```
 */
export function timeSeriestoPoints(timeSeries: TimeSeriesPoint[]): Point[] {
  return timeSeries.map((point, index) => ({
    x: index,
    y: point.value,
  }));
}

/**
 * Convert time series points to regression points using actual time.
 *
 * Uses milliseconds since first timestamp as X values.
 * Useful for time-weighted trend analysis.
 *
 * @param timeSeries - Array of time series points
 * @returns Array of (x, y) points for regression
 */
export function timeSeriestoTimeWeightedPoints(timeSeries: TimeSeriesPoint[]): Point[] {
  if (timeSeries.length === 0) {
    return [];
  }

  const firstTimestamp = new Date(timeSeries[0]?.timestamp ?? 0).getTime();

  return timeSeries.map((point) => ({
    x: new Date(point.timestamp).getTime() - firstTimestamp,
    y: point.value,
  }));
}

/**
 * Calculate the predicted Y value for a given X.
 *
 * @param x - X value to predict Y for
 * @param result - Regression result containing slope and intercept
 * @returns Predicted Y value
 */
export function predict(x: number, result: RegressionResult): number {
  return result.slope * x + result.intercept;
}

// =============================================================================
// Note: classifyTrend() was removed per ADR-0019
// =============================================================================
//
// The classifyTrend() function was removed because trend classification
// is a JUDGMENT call that should be made by the agent, not tool code.
//
// The agent interprets trend direction based on:
// - slope: Positive slope = values increasing over time
// - rSquared: Higher R² = more reliable linear fit
// - Metric semantics: For some metrics, decreasing is good
// - Project context: What matters for this specific project
//
// Tools should return raw statistics (slope, rSquared) and let the
// agent determine whether the trend is "improving" or "degrading".
//
// See ADR-0019: Tool/Agent Boundary for Temporal Analysis

/**
 * Calculate statistics for a set of values.
 *
 * @param values - Array of numeric values
 * @returns Statistics including mean, std deviation, min, max
 */
export function calculateStats(values: number[]): {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  n: number;
} {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0, n: 0 };
  }

  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;

  let min = values[0] ?? 0;
  let max = values[0] ?? 0;
  let sumSquaredDiffs = 0;

  for (const value of values) {
    sumSquaredDiffs += (value - mean) ** 2;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  const stdDev = Math.sqrt(sumSquaredDiffs / n);

  return { mean, stdDev, min, max, n };
}
