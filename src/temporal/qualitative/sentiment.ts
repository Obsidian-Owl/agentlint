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
import { REVIEW_DIMENSIONS, type DimensionDefinition } from './dimensions';

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

/**
 * Result of analyzing sentiment indicators in text.
 */
export interface SentimentIndicatorAnalysis {
  /** Positive indicators found in text */
  positiveMatches: string[];
  /** Negative indicators found in text */
  negativeMatches: string[];
  /** Net score based on indicator counts */
  indicatorScore: number;
  /** Suggested sentiment based on indicators */
  suggestedSentiment: SentimentValue;
}

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

/**
 * Get sentiment label for a numeric value.
 *
 * @param sentiment - Sentiment value (-2 to +2)
 * @returns Human-readable label
 */
export function getSentimentLabel(sentiment: number): string {
  if (sentiment <= -1.5) return 'Very Negative';
  if (sentiment <= -0.5) return 'Negative';
  if (sentiment < 0.5) return 'Neutral';
  if (sentiment < 1.5) return 'Positive';
  return 'Very Positive';
}

/**
 * Get sentiment emoji for display.
 *
 * @param sentiment - Sentiment value (-2 to +2)
 * @returns Emoji representing the sentiment
 */
export function getSentimentEmoji(sentiment: number): string {
  if (sentiment <= -1.5) return '😢';
  if (sentiment <= -0.5) return '😕';
  if (sentiment < 0.5) return '😐';
  if (sentiment < 1.5) return '🙂';
  return '😊';
}

/**
 * Analyze text for sentiment indicators from dimension definitions.
 *
 * Searches for positive and negative indicator words defined in dimensions.ts
 * to provide a hint about the sentiment of a response.
 *
 * @param text - Text to analyze
 * @param dimension - Optional specific dimension to use indicators from
 * @returns Analysis result with matched indicators and suggested sentiment
 */
export function analyzeSentimentIndicators(
  text: string,
  dimension?: DimensionDefinition
): SentimentIndicatorAnalysis {
  const lowerText = text.toLowerCase();
  const positiveMatches: string[] = [];
  const negativeMatches: string[] = [];

  // Get indicators from specific dimension or all dimensions
  const dimensions = dimension ? [dimension] : REVIEW_DIMENSIONS;

  for (const dim of dimensions) {
    for (const indicator of dim.positiveIndicators) {
      if (lowerText.includes(indicator.toLowerCase())) {
        if (!positiveMatches.includes(indicator)) {
          positiveMatches.push(indicator);
        }
      }
    }
    for (const indicator of dim.negativeIndicators) {
      if (lowerText.includes(indicator.toLowerCase())) {
        if (!negativeMatches.includes(indicator)) {
          negativeMatches.push(indicator);
        }
      }
    }
  }

  // Calculate net score
  const indicatorScore = positiveMatches.length - negativeMatches.length;

  // Suggest sentiment based on balance
  let suggestedSentiment: SentimentValue;
  if (indicatorScore >= 3) {
    suggestedSentiment = 2;
  } else if (indicatorScore >= 1) {
    suggestedSentiment = 1;
  } else if (indicatorScore <= -3) {
    suggestedSentiment = -2;
  } else if (indicatorScore <= -1) {
    suggestedSentiment = -1;
  } else {
    suggestedSentiment = 0;
  }

  return {
    positiveMatches,
    negativeMatches,
    indicatorScore,
    suggestedSentiment,
  };
}

/**
 * Calculate sentiment trend from a series of reviews.
 *
 * Uses simple linear regression to determine if sentiment is improving,
 * degrading, or stable over time.
 *
 * @param reviews - Array of reviews sorted by createdAt
 * @param dimensionName - Optional dimension to analyze (default: overall)
 * @returns Trend analysis for the dimension
 */
export function calculateSentimentTrend(
  reviews: QualitativeReview[],
  dimensionName?: ReviewDimensionName
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

  // Classify trend direction
  // A slope of 0.01 per day would be significant over a month
  const slopeThreshold = 0.005;
  let direction: 'improving' | 'degrading' | 'stable';

  if (slope > slopeThreshold) {
    direction = 'improving';
  } else if (slope < -slopeThreshold) {
    direction = 'degrading';
  } else {
    direction = 'stable';
  }

  return {
    dimension: dimensionName ?? 'workflowSatisfaction',
    direction,
    values,
    slope: Math.round(slope * 1000) / 1000, // Round to 3 decimal places
  };
}

/**
 * Compare sentiment between two reviews.
 *
 * @param before - Earlier review
 * @param after - Later review
 * @returns Change in overall sentiment
 */
export function compareSentiment(
  before: QualitativeReview,
  after: QualitativeReview
): {
  change: number;
  direction: 'improved' | 'degraded' | 'unchanged';
  dimensionChanges: Array<{
    dimension: ReviewDimensionName;
    change: number;
  }>;
} {
  const change = after.overallSentiment - before.overallSentiment;

  let direction: 'improved' | 'degraded' | 'unchanged';
  if (change > 0.1) {
    direction = 'improved';
  } else if (change < -0.1) {
    direction = 'degraded';
  } else {
    direction = 'unchanged';
  }

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

  return { change, direction, dimensionChanges };
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
