/**
 * EP09 Temporal Analysis - Qualitative Trend Calculation
 *
 * Calculates sentiment trends from qualitative reviews with statistical measures.
 * Per ADR-0019, returns raw data (slope, rSquared, volatility); agent interprets.
 *
 * @module temporal/qualitative/trend
 */

import type {
  QualitativeReview,
  QualitativeTrend,
  ReviewDimensionName,
  SentimentPoint,
} from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for trend calculation.
 */
export interface TrendCalculationOptions {
  /** Threshold for slope significance (default: 0.005 per day) */
  slopeThreshold?: number;
  /** Minimum reviews required for calculation (default: 2) */
  minReviews?: number;
  /** Round statistics to this many decimal places (default: 3) */
  precision?: number;
}

/**
 * Extended trend with additional statistical measures.
 * Per ADR-0019, includes raw statistical data without interpretation.
 */
export interface ExtendedQualitativeTrend extends QualitativeTrend {
  /** R² coefficient of determination (0-1, higher = more linear) */
  rSquared: number;
  /** Coefficient of variation (stdDev/|mean|, higher = more volatile) */
  volatility: number;
  /** Number of reviews in the trend */
  reviewCount: number;
  /** Date range covered */
  dateRange: {
    start: string;
    end: string;
  };
  /** Statistical summary */
  stats: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
  };
}

// =============================================================================
// Constants
// =============================================================================

/** Default threshold for slope significance (per day) */
const DEFAULT_SLOPE_THRESHOLD = 0.005;

/** Default minimum reviews for trend calculation */
const DEFAULT_MIN_REVIEWS = 2;

/** Default precision for rounding */
const DEFAULT_PRECISION = 3;

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Calculate sentiment trend from a series of qualitative reviews.
 *
 * Uses linear regression to calculate slope and R². Per ADR-0019, returns
 * raw statistical data; the agent interprets whether the trend represents
 * improvement or degradation.
 *
 * @param reviews - Array of qualitative reviews
 * @param dimensionName - Optional dimension to analyze (default: overall sentiment)
 * @param options - Calculation options
 * @returns Extended trend with statistical measures, or null if insufficient data
 *
 * @example
 * ```typescript
 * const trend = calculateSentimentTrend(reviews);
 * // Agent interprets: slope > 0 means increasing sentiment
 * // Agent interprets: high rSquared means reliable trend
 * // Agent interprets: high volatility means noisy data
 * ```
 */
export function calculateSentimentTrend(
  reviews: QualitativeReview[],
  dimensionName?: ReviewDimensionName,
  options: TrendCalculationOptions = {}
): ExtendedQualitativeTrend | null {
  const {
    slopeThreshold = DEFAULT_SLOPE_THRESHOLD,
    minReviews = DEFAULT_MIN_REVIEWS,
    precision = DEFAULT_PRECISION,
  } = options;

  if (reviews.length < minReviews) {
    return null;
  }

  // Sort by date (oldest first)
  const sortedReviews = [...reviews].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Extract sentiment values
  const values: SentimentPoint[] = sortedReviews.map((review) => {
    let sentiment: number;

    if (dimensionName) {
      const dimension = review.dimensions.find((d) => d.name === dimensionName);
      sentiment = dimension?.sentiment ?? 0;
    } else {
      sentiment = review.overallSentiment;
    }

    return {
      timestamp: review.createdAt,
      sentiment,
      reviewId: review.id,
    };
  });

  // Convert timestamps to days from start
  const firstPoint = values[0];
  const lastPoint = values[values.length - 1];
  if (!firstPoint || !lastPoint) {
    return null;
  }

  const startTime = new Date(firstPoint.timestamp).getTime();
  const xValues: number[] = values.map(
    (point) => (new Date(point.timestamp).getTime() - startTime) / (1000 * 60 * 60 * 24)
  );
  const yValues: number[] = values.map((point) => point.sentiment);

  // Calculate linear regression and statistics
  const { slope, rSquared } = linearRegression(xValues, yValues);
  const { mean, stdDev, min, max } = calculateStats(yValues);

  // Calculate volatility (coefficient of variation)
  // Use absolute mean to avoid division issues with near-zero means
  const volatility = mean !== 0 ? stdDev / Math.abs(mean) : stdDev > 0 ? Infinity : 0;

  // Determine slope significance
  const slopeSignificant = Math.abs(slope) > slopeThreshold;

  // Round values for cleaner output
  const roundTo = (val: number): number => {
    const multiplier = Math.pow(10, precision);
    return Math.round(val * multiplier) / multiplier;
  };

  return {
    dimension: dimensionName ?? 'workflowSatisfaction',
    values,
    slope: roundTo(slope),
    slopeSignificant,
    rSquared: roundTo(rSquared),
    volatility: roundTo(volatility === Infinity ? 999 : volatility),
    reviewCount: reviews.length,
    dateRange: {
      start: firstPoint.timestamp,
      end: lastPoint.timestamp,
    },
    stats: {
      mean: roundTo(mean),
      stdDev: roundTo(stdDev),
      min,
      max,
    },
  };
}

/**
 * Calculate trends for all dimensions in a set of reviews.
 *
 * @param reviews - Array of qualitative reviews
 * @param options - Calculation options
 * @returns Map of dimension name to trend, or null for insufficient data
 */
export function calculateAllDimensionTrends(
  reviews: QualitativeReview[],
  options: TrendCalculationOptions = {}
): Map<ReviewDimensionName, ExtendedQualitativeTrend> {
  const dimensions: ReviewDimensionName[] = [
    'perceivedFriction',
    'trustCalibration',
    'taskFit',
    'configurationConfidence',
    'improvementAttribution',
    'workflowSatisfaction',
  ];

  const trends = new Map<ReviewDimensionName, ExtendedQualitativeTrend>();

  for (const dimension of dimensions) {
    const trend = calculateSentimentTrend(reviews, dimension, options);
    if (trend) {
      trends.set(dimension, trend);
    }
  }

  return trends;
}

/**
 * Calculate overall sentiment trend (not per-dimension).
 *
 * @param reviews - Array of qualitative reviews
 * @param options - Calculation options
 * @returns Overall sentiment trend
 */
export function calculateOverallTrend(
  reviews: QualitativeReview[],
  options: TrendCalculationOptions = {}
): ExtendedQualitativeTrend | null {
  return calculateSentimentTrend(reviews, undefined, options);
}

/**
 * Summarize trends across all dimensions.
 *
 * Per ADR-0019, returns raw counts and averages; agent interprets meaning.
 *
 * @param trends - Map of dimension trends
 * @returns Summary statistics
 */
export function summarizeTrends(
  trends: Map<ReviewDimensionName, ExtendedQualitativeTrend>
): {
  totalDimensions: number;
  withSignificantSlope: number;
  averageSlope: number;
  averageRSquared: number;
  averageVolatility: number;
  slopesByDimension: Array<{ dimension: ReviewDimensionName; slope: number }>;
} {
  if (trends.size === 0) {
    return {
      totalDimensions: 0,
      withSignificantSlope: 0,
      averageSlope: 0,
      averageRSquared: 0,
      averageVolatility: 0,
      slopesByDimension: [],
    };
  }

  let sumSlope = 0;
  let sumRSquared = 0;
  let sumVolatility = 0;
  let significantCount = 0;
  const slopesByDimension: Array<{ dimension: ReviewDimensionName; slope: number }> = [];

  for (const [dimension, trend] of trends) {
    sumSlope += trend.slope;
    sumRSquared += trend.rSquared;
    sumVolatility += trend.volatility;
    if (trend.slopeSignificant) {
      significantCount++;
    }
    slopesByDimension.push({ dimension, slope: trend.slope });
  }

  const count = trends.size;

  return {
    totalDimensions: count,
    withSignificantSlope: significantCount,
    averageSlope: Math.round((sumSlope / count) * 1000) / 1000,
    averageRSquared: Math.round((sumRSquared / count) * 1000) / 1000,
    averageVolatility: Math.round((sumVolatility / count) * 1000) / 1000,
    slopesByDimension: slopesByDimension.sort((a, b) => b.slope - a.slope),
  };
}

// =============================================================================
// Statistical Helpers
// =============================================================================

/**
 * Calculate linear regression statistics.
 *
 * @param xValues - Independent variable values (e.g., days)
 * @param yValues - Dependent variable values (e.g., sentiment)
 * @returns Slope and R² coefficient
 */
function linearRegression(
  xValues: number[],
  yValues: number[]
): { slope: number; rSquared: number } {
  const n = xValues.length;
  if (n === 0) {
    return { slope: 0, rSquared: 0 };
  }

  // Calculate means
  const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
  const yMean = yValues.reduce((sum, y) => sum + y, 0) / n;

  // Calculate slope and R²
  let sumXYDiff = 0;
  let sumX2Diff = 0;
  let sumY2Diff = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = xValues[i]! - xMean;
    const yDiff = yValues[i]! - yMean;
    sumXYDiff += xDiff * yDiff;
    sumX2Diff += xDiff * xDiff;
    sumY2Diff += yDiff * yDiff;
  }

  const slope = sumX2Diff !== 0 ? sumXYDiff / sumX2Diff : 0;

  // R² = (correlation coefficient)²
  const ssTotal = sumY2Diff;
  const ssResidual =
    sumY2Diff - (sumX2Diff !== 0 ? (sumXYDiff * sumXYDiff) / sumX2Diff : 0);
  const rSquared = ssTotal !== 0 ? 1 - ssResidual / ssTotal : 0;

  return { slope, rSquared: Math.max(0, Math.min(1, rSquared)) };
}

/**
 * Calculate basic statistics for a set of values.
 *
 * @param values - Array of numbers
 * @returns Mean, standard deviation, min, max
 */
function calculateStats(values: number[]): {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
} {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0 };
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    stdDev,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}
