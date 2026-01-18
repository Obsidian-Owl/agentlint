/**
 * Sentiment Calculation for Qualitative Reviews
 *
 * Provides functions for calculating overall sentiment from individual
 * dimension ratings and analyzing sentiment patterns across reviews.
 *
 * Uses Likert scale (-2 to +2) per spec.md Q1 resolution:
 * - -2: Very Negative
 * - -1: Negative
 * -  0: Neutral
 * - +1: Positive
 * - +2: Very Positive
 *
 * @module temporal/qualitative/sentiment
 */

import type {
  ReviewDimension,
  QualitativeReview,
  QualitativeTrend,
  ReviewDimensionName,
  SentimentPoint,
} from '../types';

/**
 * Valid Likert scale sentiment values.
 */
export type SentimentValue = -2 | -1 | 0 | 1 | 2;

/**
 * Options for sentiment calculation.
 */
export interface SentimentOptions {
  /** Optional weights for each dimension (default: equal weight) */
  weights?: Partial<Record<ReviewDimensionName, number>>;
  /** Dimensions to exclude from calculation */
  excludeDimensions?: ReviewDimensionName[];
  /** Round result to this many decimal places (default: 2) */
  precision?: number;
}

// Note: SentimentIndicatorAnalysis was removed per ADR-0019.
// Sentiment analysis through keyword matching is a judgment call
// that should be made by the agent, not tool code.

/**
 * Calculate the overall sentiment from review dimensions.
 *
 * Uses weighted average of dimension sentiments. By default, all dimensions
 * are weighted equally. The workflowSatisfaction dimension can be given
 * higher weight as it's a direct satisfaction measure.
 *
 * @param dimensions - Array of review dimensions with sentiment values
 * @param options - Optional calculation options
 * @returns Overall sentiment value (-2 to +2)
 *
 * @example
 * ```typescript
 * const dimensions: ReviewDimension[] = [
 *   { name: 'perceivedFriction', sentiment: -1, ... },
 *   { name: 'workflowSatisfaction', sentiment: 1, ... },
 * ];
 * const overall = calculateOverallSentiment(dimensions);
 * // Returns 0 (average of -1 and 1)
 * ```
 */
export function calculateOverallSentiment(
  dimensions: ReviewDimension[],
  options: SentimentOptions = {}
): number {
  const { weights = {}, excludeDimensions = [], precision = 2 } = options;

  // Filter out excluded dimensions
  const includedDimensions = dimensions.filter((d) => !excludeDimensions.includes(d.name));

  if (includedDimensions.length === 0) {
    return 0;
  }

  // Calculate weighted sum
  let totalWeight = 0;
  let weightedSum = 0;

  for (const dimension of includedDimensions) {
    const weight = weights[dimension.name] ?? 1;
    weightedSum += dimension.sentiment * weight;
    totalWeight += weight;
  }

  const average = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Round to specified precision
  const multiplier = Math.pow(10, precision);
  return Math.round(average * multiplier) / multiplier;
}

/**
 * Validate that a sentiment value is within the valid Likert scale range.
 *
 * @param value - Value to validate
 * @returns True if value is a valid sentiment (-2, -1, 0, 1, or 2)
 */
export function isValidSentiment(value: number): value is SentimentValue {
  return [-2, -1, 0, 1, 2].includes(value);
}

/**
 * Clamp a sentiment value to the valid range [-2, 2].
 *
 * @param value - Value to clamp
 * @returns Clamped value as nearest valid sentiment
 */
export function clampSentiment(value: number): SentimentValue {
  if (value <= -2) return -2;
  if (value >= 2) return 2;
  return Math.round(value) as SentimentValue;
}

// =============================================================================
// Note: Judgment functions removed per ADR-0019
// =============================================================================
//
// The following functions were removed because they make judgment calls
// that should be made by the agent, not tool code:
//
// - getSentimentLabel(): Converts numeric sentiment to labels
// - getSentimentEmoji(): Converts numeric sentiment to emojis
// - analyzeSentimentIndicators(): Keyword-based sentiment analysis
//
// The agent interprets sentiment values based on:
// - Semantic understanding of responses
// - Project context
// - User preferences
//
// See ADR-0019: Tool/Agent Boundary for Temporal Analysis

/**
 * Calculate sentiment trend from a series of reviews.
 *
 * Uses simple linear regression to calculate slope. Per ADR-0019, the agent
 * interprets whether the trend represents improvement or degradation.
 *
 * @param reviews - Array of reviews sorted by createdAt
 * @param dimensionName - Optional dimension to analyze (default: overall)
 * @param slopeThreshold - Threshold for slope significance (default: 0.005)
 * @returns Trend analysis for the dimension with slope and significance
 */
export function calculateSentimentTrend(
  reviews: QualitativeReview[],
  dimensionName?: ReviewDimensionName,
  slopeThreshold: number = 0.005
): QualitativeTrend | null {
  if (reviews.length < 2) {
    return null;
  }

  // Sort by date
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

  // Calculate slope using simple linear regression
  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  const firstValue = values[0];
  if (!firstValue) {
    return null;
  }
  const startTime = new Date(firstValue.timestamp).getTime();

  for (const point of values) {
    const x = (new Date(point.timestamp).getTime() - startTime) / (1000 * 60 * 60 * 24); // Days from start
    const y = point.sentiment;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;

  // Determine if slope exceeds significance threshold
  // The agent interprets whether positive/negative slope means improvement
  const slopeSignificant = Math.abs(slope) > slopeThreshold;

  return {
    dimension: dimensionName ?? 'workflowSatisfaction',
    values,
    slope: Math.round(slope * 1000) / 1000, // Round to 3 decimal places
    slopeSignificant,
  };
}

/**
 * Compare sentiment between two reviews.
 *
 * Per ADR-0019, returns raw change values. The agent interprets
 * whether the change represents improvement or degradation.
 *
 * @param before - Earlier review
 * @param after - Later review
 * @returns Change in overall sentiment and per-dimension changes
 */
export function compareSentiment(
  before: QualitativeReview,
  after: QualitativeReview
): {
  /** Overall sentiment change (positive = increased, negative = decreased) */
  change: number;
  /** Changes per dimension */
  dimensionChanges: Array<{
    dimension: ReviewDimensionName;
    change: number;
  }>;
} {
  const change = after.overallSentiment - before.overallSentiment;

  // Calculate per-dimension changes
  const dimensionChanges: Array<{ dimension: ReviewDimensionName; change: number }> = [];

  for (const afterDim of after.dimensions) {
    const beforeDim = before.dimensions.find((d) => d.name === afterDim.name);
    if (beforeDim) {
      const dimChange = afterDim.sentiment - beforeDim.sentiment;
      if (Math.abs(dimChange) > 0) {
        dimensionChanges.push({
          dimension: afterDim.name,
          change: dimChange,
        });
      }
    }
  }

  return { change, dimensionChanges };
}

/**
 * Create an empty review dimension with neutral sentiment.
 *
 * @param name - Dimension name
 * @param promptText - The prompt that was shown
 * @returns Empty dimension ready for user input
 */
export function createEmptyDimension(
  name: ReviewDimensionName,
  promptText: string
): ReviewDimension {
  return {
    name,
    promptText,
    response: '',
    sentiment: 0,
  };
}

/**
 * Aggregate sentiment statistics across multiple reviews.
 *
 * @param reviews - Array of reviews to aggregate
 * @returns Aggregated statistics
 */
export function aggregateSentimentStats(reviews: QualitativeReview[]): {
  count: number;
  averageSentiment: number;
  sentimentRange: { min: number; max: number };
  dimensionAverages: Record<ReviewDimensionName, number>;
} {
  if (reviews.length === 0) {
    return {
      count: 0,
      averageSentiment: 0,
      sentimentRange: { min: 0, max: 0 },
      dimensionAverages: {} as Record<ReviewDimensionName, number>,
    };
  }

  const sentiments = reviews.map((r) => r.overallSentiment);
  const averageSentiment = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;

  // Calculate per-dimension averages
  const dimensionSums: Partial<Record<ReviewDimensionName, number>> = {};
  const dimensionCounts: Partial<Record<ReviewDimensionName, number>> = {};

  for (const review of reviews) {
    for (const dim of review.dimensions) {
      dimensionSums[dim.name] = (dimensionSums[dim.name] ?? 0) + dim.sentiment;
      dimensionCounts[dim.name] = (dimensionCounts[dim.name] ?? 0) + 1;
    }
  }

  const dimensionAverages: Partial<Record<ReviewDimensionName, number>> = {};
  for (const name of Object.keys(dimensionSums) as ReviewDimensionName[]) {
    const count = dimensionCounts[name] ?? 1;
    dimensionAverages[name] = (dimensionSums[name] ?? 0) / count;
  }

  return {
    count: reviews.length,
    averageSentiment: Math.round(averageSentiment * 100) / 100,
    sentimentRange: {
      min: Math.min(...sentiments),
      max: Math.max(...sentiments),
    },
    dimensionAverages: dimensionAverages as Record<ReviewDimensionName, number>,
  };
}
