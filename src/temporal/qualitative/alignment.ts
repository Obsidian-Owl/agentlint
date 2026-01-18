/**
 * EP09 Temporal Analysis - Quantitative/Qualitative Alignment
 *
 * Calculates divergence metrics between quantitative trends (metrics) and
 * qualitative trends (sentiment). Per ADR-0019, returns raw statistical data;
 * the agent determines significance and interprets meaning.
 *
 * @module temporal/qualitative/alignment
 */

import type { MetricTrend, QualitativeTrend, TimeSeriesPoint, SentimentPoint } from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * Divergence metrics between quantitative and qualitative trends.
 *
 * Per ADR-0019: Tools return DATA; agent interprets.
 * - Positive correlation means trends move together
 * - Negative correlation means trends move opposite
 * - Low correlation means trends are unrelated
 * Agent interprets what these values mean for the project.
 */
export interface DivergenceMetrics {
  /** Pearson correlation coefficient (-1 to 1) */
  correlation: number;
  /** Difference in normalized slopes (quantitative - qualitative) */
  slopeDifference: number;
  /** Number of data points used for calculation */
  dataPointCount: number;
  /** Whether trends have opposite signs */
  slopesOpposite: boolean;
  /** Quantitative slope (for reference) */
  quantitativeSlope: number;
  /** Qualitative slope (for reference) */
  qualitativeSlope: number;
  /** Time range overlap in milliseconds */
  overlapMs: number;
  /** R² of quantitative trend */
  quantitativeRSquared: number;
  /** R² of qualitative trend (if available) */
  qualitativeRSquared?: number;
}

/**
 * Options for divergence calculation.
 */
export interface DivergenceOptions {
  /** Minimum overlap in days for meaningful comparison (default: 7) */
  minOverlapDays?: number;
  /** Normalize slopes before comparison (default: true) */
  normalizeSlopes?: boolean;
  /** Round values to this many decimal places (default: 3) */
  precision?: number;
}

/**
 * Multi-metric divergence analysis result.
 */
export interface DivergenceAnalysis {
  /** Divergence for each metric-dimension pair */
  pairs: DivergencePair[];
  /** Average correlation across all pairs */
  averageCorrelation: number;
  /** Count of pairs with negative correlation */
  negativeCorrelationCount: number;
  /** Count of pairs with opposite slopes */
  oppositeSlopeCount: number;
}

/**
 * Single metric-dimension divergence pair.
 */
export interface DivergencePair {
  /** Metric name from quantitative data */
  metricName: string;
  /** Dimension name from qualitative data */
  dimensionName: string;
  /** Divergence metrics for this pair */
  metrics: DivergenceMetrics;
}

// =============================================================================
// Constants
// =============================================================================

/** Default minimum overlap in days */
const DEFAULT_MIN_OVERLAP_DAYS = 7;

/** Default precision for rounding */
const DEFAULT_PRECISION = 3;

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Calculate divergence metrics between a quantitative trend and qualitative trend.
 *
 * Per ADR-0019: Returns raw statistical data. The agent interprets whether
 * divergence is significant and what it means.
 *
 * @param quantitative - Metric trend from baseline analysis
 * @param qualitative - Sentiment trend from reviews
 * @param options - Calculation options
 * @returns Divergence metrics or null if insufficient overlap
 *
 * @example
 * ```typescript
 * const metrics = calculateDivergenceMetrics(metricTrend, sentimentTrend);
 * // Agent interprets: correlation < 0 means metrics improving but sentiment declining
 * // Agent interprets: slopesOpposite means trends are moving in opposite directions
 * ```
 */
export function calculateDivergenceMetrics(
  quantitative: MetricTrend,
  qualitative: QualitativeTrend,
  options: DivergenceOptions = {}
): DivergenceMetrics | null {
  const {
    minOverlapDays = DEFAULT_MIN_OVERLAP_DAYS,
    normalizeSlopes = true,
    precision = DEFAULT_PRECISION,
  } = options;

  // Find time range overlap
  const quantRange = getTimeRange(quantitative.values);
  const qualRange = getTimeRange(qualitative.values);

  if (!quantRange || !qualRange) {
    return null;
  }

  const overlapStart = Math.max(quantRange.start, qualRange.start);
  const overlapEnd = Math.min(quantRange.end, qualRange.end);
  const overlapMs = overlapEnd - overlapStart;

  // Check minimum overlap
  const minOverlapMs = minOverlapDays * 24 * 60 * 60 * 1000;
  if (overlapMs < minOverlapMs) {
    return null;
  }

  // Get aligned data points
  const aligned = alignDataPoints(
    quantitative.values,
    qualitative.values,
    overlapStart,
    overlapEnd
  );

  if (aligned.length < 2) {
    return null;
  }

  // Calculate correlation coefficient
  const quantValues = aligned.map((p) => p.quantValue);
  const qualValues = aligned.map((p) => p.qualValue);
  const correlation = pearsonCorrelation(quantValues, qualValues);

  // Calculate slope difference
  let slopeDifference: number;
  if (normalizeSlopes) {
    // Normalize slopes to comparable scale
    const quantNormSlope = normalizeSlope(quantitative.slope, quantValues);
    const qualNormSlope = normalizeSlope(qualitative.slope, qualValues);
    slopeDifference = quantNormSlope - qualNormSlope;
  } else {
    slopeDifference = quantitative.slope - qualitative.slope;
  }

  // Check if slopes have opposite signs
  const slopesOpposite =
    (quantitative.slope > 0 && qualitative.slope < 0) ||
    (quantitative.slope < 0 && qualitative.slope > 0);

  // Get R² values
  const quantitativeRSquared = quantitative.rSquared;
  const qualitativeRSquared =
    'rSquared' in qualitative ? (qualitative as { rSquared: number }).rSquared : undefined;

  const roundTo = (val: number): number => {
    const multiplier = Math.pow(10, precision);
    return Math.round(val * multiplier) / multiplier;
  };

  const result: DivergenceMetrics = {
    correlation: roundTo(correlation),
    slopeDifference: roundTo(slopeDifference),
    dataPointCount: aligned.length,
    slopesOpposite,
    quantitativeSlope: roundTo(quantitative.slope),
    qualitativeSlope: roundTo(qualitative.slope),
    overlapMs,
    quantitativeRSquared: roundTo(quantitativeRSquared),
  };

  if (qualitativeRSquared !== undefined) {
    result.qualitativeRSquared = roundTo(qualitativeRSquared);
  }

  return result;
}

/**
 * Analyze divergence across multiple metric-dimension pairs.
 *
 * @param metricTrends - Array of quantitative metric trends
 * @param qualitativeTrends - Array of qualitative sentiment trends
 * @param options - Calculation options
 * @returns Divergence analysis with all pairs and summary
 */
export function analyzeDivergence(
  metricTrends: MetricTrend[],
  qualitativeTrends: QualitativeTrend[],
  options: DivergenceOptions = {}
): DivergenceAnalysis {
  const pairs: DivergencePair[] = [];

  // Compare each metric with each dimension
  for (const metric of metricTrends) {
    for (const qualitative of qualitativeTrends) {
      const metrics = calculateDivergenceMetrics(metric, qualitative, options);
      if (metrics) {
        pairs.push({
          metricName: metric.metricName,
          dimensionName: qualitative.dimension,
          metrics,
        });
      }
    }
  }

  if (pairs.length === 0) {
    return {
      pairs: [],
      averageCorrelation: 0,
      negativeCorrelationCount: 0,
      oppositeSlopeCount: 0,
    };
  }

  // Calculate summary statistics
  const correlations = pairs.map((p) => p.metrics.correlation);
  const averageCorrelation = correlations.reduce((sum, c) => sum + c, 0) / correlations.length;
  const negativeCorrelationCount = correlations.filter((c) => c < 0).length;
  const oppositeSlopeCount = pairs.filter((p) => p.metrics.slopesOpposite).length;

  return {
    pairs,
    averageCorrelation: Math.round(averageCorrelation * 1000) / 1000,
    negativeCorrelationCount,
    oppositeSlopeCount,
  };
}

/**
 * Find the metric-dimension pair with highest divergence.
 *
 * Divergence is measured by absolute correlation (lower = more divergent)
 * and opposite slopes.
 *
 * @param analysis - Divergence analysis result
 * @returns Most divergent pair or null if none
 */
export function findMostDivergentPair(analysis: DivergenceAnalysis): DivergencePair | null {
  if (analysis.pairs.length === 0) {
    return null;
  }

  // Sort by divergence score (opposite slopes + low correlation)
  const scored = analysis.pairs.map((pair) => ({
    pair,
    score: calculateDivergenceScore(pair.metrics),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored[0]?.pair ?? null;
}

/**
 * Calculate a divergence score for ranking pairs.
 *
 * Higher score = more divergent (potentially problematic).
 * Score combines correlation inversion and slope opposition.
 *
 * @param metrics - Divergence metrics
 * @returns Score from 0 (aligned) to 2 (highly divergent)
 */
export function calculateDivergenceScore(metrics: DivergenceMetrics): number {
  // Score from correlation: -1 correlation = 1 point, +1 correlation = 0 points
  const correlationScore = (1 - metrics.correlation) / 2;

  // Score from slope opposition: opposite = 1 point
  const slopeScore = metrics.slopesOpposite ? 1 : 0;

  return correlationScore + slopeScore;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get time range from time series or sentiment points.
 */
function getTimeRange(
  points: TimeSeriesPoint[] | SentimentPoint[]
): { start: number; end: number } | null {
  if (points.length === 0) {
    return null;
  }

  const timestamps = points.map((p) => new Date(p.timestamp).getTime());
  return {
    start: Math.min(...timestamps),
    end: Math.max(...timestamps),
  };
}

/**
 * Align quantitative and qualitative data points by time.
 *
 * Uses interpolation to estimate values at common time points.
 */
function alignDataPoints(
  quantPoints: TimeSeriesPoint[],
  qualPoints: SentimentPoint[],
  overlapStart: number,
  overlapEnd: number
): Array<{ timestamp: number; quantValue: number; qualValue: number }> {
  // Filter to overlap range
  const quantFiltered = quantPoints.filter((p) => {
    const t = new Date(p.timestamp).getTime();
    return t >= overlapStart && t <= overlapEnd;
  });

  const qualFiltered = qualPoints.filter((p) => {
    const t = new Date(p.timestamp).getTime();
    return t >= overlapStart && t <= overlapEnd;
  });

  // If either has too few points, return empty
  if (quantFiltered.length < 2 || qualFiltered.length < 2) {
    return [];
  }

  // Use the timestamps from the series with fewer points
  const useQuantTimestamps = quantFiltered.length <= qualFiltered.length;
  const basePoints = useQuantTimestamps ? quantFiltered : qualFiltered;
  const otherPoints = useQuantTimestamps ? qualFiltered : quantFiltered;

  const aligned: Array<{ timestamp: number; quantValue: number; qualValue: number }> = [];

  for (const basePoint of basePoints) {
    const timestamp = new Date(basePoint.timestamp).getTime();

    // Interpolate from other series
    const interpolatedValue = interpolateValue(otherPoints, timestamp);

    if (interpolatedValue !== null) {
      if (useQuantTimestamps) {
        aligned.push({
          timestamp,
          quantValue: (basePoint as TimeSeriesPoint).value,
          qualValue: interpolatedValue,
        });
      } else {
        aligned.push({
          timestamp,
          quantValue: interpolatedValue,
          qualValue: (basePoint as SentimentPoint).sentiment,
        });
      }
    }
  }

  return aligned;
}

/**
 * Interpolate a value at a given timestamp from a time series.
 */
function interpolateValue(
  points: Array<{ timestamp: string; value?: number; sentiment?: number }>,
  targetTimestamp: number
): number | null {
  if (points.length === 0) {
    return null;
  }

  const timestamps = points.map((p) => new Date(p.timestamp).getTime());
  const values = points.map((p) => p.value ?? p.sentiment ?? 0);

  // Find surrounding points
  let beforeIdx = -1;
  let afterIdx = -1;

  for (let i = 0; i < timestamps.length; i++) {
    if (timestamps[i]! <= targetTimestamp) {
      beforeIdx = i;
    }
    if (timestamps[i]! >= targetTimestamp && afterIdx === -1) {
      afterIdx = i;
    }
  }

  // Exact match
  if (beforeIdx === afterIdx && beforeIdx >= 0) {
    return values[beforeIdx]!;
  }

  // Linear interpolation
  if (beforeIdx >= 0 && afterIdx >= 0 && beforeIdx !== afterIdx) {
    const t1 = timestamps[beforeIdx]!;
    const t2 = timestamps[afterIdx]!;
    const v1 = values[beforeIdx]!;
    const v2 = values[afterIdx]!;

    const ratio = (targetTimestamp - t1) / (t2 - t1);
    return v1 + ratio * (v2 - v1);
  }

  // Use nearest point if interpolation not possible
  if (beforeIdx >= 0) {
    return values[beforeIdx]!;
  }
  if (afterIdx >= 0) {
    return values[afterIdx]!;
  }

  return null;
}

/**
 * Calculate Pearson correlation coefficient.
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) {
    return 0;
  }

  const xMean = x.slice(0, n).reduce((sum, v) => sum + v, 0) / n;
  const yMean = y.slice(0, n).reduce((sum, v) => sum + v, 0) / n;

  let sumXYDiff = 0;
  let sumX2Diff = 0;
  let sumY2Diff = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = x[i]! - xMean;
    const yDiff = y[i]! - yMean;
    sumXYDiff += xDiff * yDiff;
    sumX2Diff += xDiff * xDiff;
    sumY2Diff += yDiff * yDiff;
  }

  const denominator = Math.sqrt(sumX2Diff * sumY2Diff);
  if (denominator === 0) {
    return 0;
  }

  return sumXYDiff / denominator;
}

/**
 * Normalize a slope to a comparable scale.
 *
 * Uses the range of values to normalize.
 */
function normalizeSlope(slope: number, values: number[]): number {
  if (values.length < 2) {
    return slope;
  }

  const range = Math.max(...values) - Math.min(...values);
  if (range === 0) {
    return slope;
  }

  // Normalize slope relative to value range
  return slope / range;
}
