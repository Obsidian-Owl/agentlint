/**
 * Unit tests for temporal/qualitative/trend.ts
 *
 * Tests sentiment trend calculation with statistical measures.
 * Per ADR-0019, verifies raw data return (no judgment labels).
 *
 * @module temporal/qualitative/__tests__/trend.test
 */

import { describe, it, expect } from 'bun:test';

import {
  calculateSentimentTrend,
  calculateAllDimensionTrends,
  calculateOverallTrend,
  summarizeTrends,
  type ExtendedQualitativeTrend,
} from '../trend';
import type { QualitativeReview, ReviewDimension, ReviewDimensionName } from '../../types';

// =============================================================================
// Test Fixtures
// =============================================================================

function createDimension(
  name: ReviewDimensionName,
  sentiment: -2 | -1 | 0 | 1 | 2
): ReviewDimension {
  return {
    name,
    promptText: `Test prompt for ${name}`,
    response: `Test response for ${name}`,
    sentiment,
  };
}

function createReview(
  daysAgo: number,
  overallSentiment: number,
  dimensions?: ReviewDimension[]
): QualitativeReview {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  return {
    id: crypto.randomUUID(),
    baselineId: 'baseline-1',
    createdAt: date.toISOString(),
    dimensions: dimensions ?? [
      createDimension('perceivedFriction', overallSentiment as -2 | -1 | 0 | 1 | 2),
      createDimension('workflowSatisfaction', overallSentiment as -2 | -1 | 0 | 1 | 2),
    ],
    overallSentiment,
    themes: [],
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('temporal/qualitative/trend', () => {
  describe('calculateSentimentTrend', () => {
    it('should return null for insufficient reviews', () => {
      const reviews = [createReview(0, 1)];

      const trend = calculateSentimentTrend(reviews);

      expect(trend).toBeNull();
    });

    it('should return null for empty array', () => {
      const trend = calculateSentimentTrend([]);

      expect(trend).toBeNull();
    });

    it('should calculate trend for overall sentiment', () => {
      const reviews = [
        createReview(30, -1), // 30 days ago, negative
        createReview(20, 0), // 20 days ago, neutral
        createReview(10, 1), // 10 days ago, positive
        createReview(0, 2), // today, very positive
      ];

      const trend = calculateSentimentTrend(reviews);

      expect(trend).not.toBeNull();
      expect(trend!.slope).toBeGreaterThan(0); // Increasing trend
      expect(trend!.slopeSignificant).toBe(true);
      expect(trend!.rSquared).toBeGreaterThan(0.9); // Very linear
      expect(trend!.values.length).toBe(4);
      expect(trend!.reviewCount).toBe(4);
    });

    it('should calculate trend for specific dimension', () => {
      const reviews = [
        createReview(20, 0, [
          createDimension('perceivedFriction', -2),
          createDimension('workflowSatisfaction', 1),
        ]),
        createReview(10, 0, [
          createDimension('perceivedFriction', -1),
          createDimension('workflowSatisfaction', 1),
        ]),
        createReview(0, 0, [
          createDimension('perceivedFriction', 0),
          createDimension('workflowSatisfaction', 1),
        ]),
      ];

      const trend = calculateSentimentTrend(reviews, 'perceivedFriction');

      expect(trend).not.toBeNull();
      expect(trend!.dimension).toBe('perceivedFriction');
      expect(trend!.slope).toBeGreaterThan(0); // Friction decreasing = positive slope
    });

    it('should return slope and rSquared without direction labels (ADR-0019)', () => {
      const reviews = [createReview(20, -1), createReview(10, 0), createReview(0, 1)];

      const trend = calculateSentimentTrend(reviews);

      expect(trend).not.toBeNull();
      // Verify no judgment labels
      expect(trend).not.toHaveProperty('direction');
      expect(trend).not.toHaveProperty('isImproving');
      expect(trend).not.toHaveProperty('label');
      // Verify raw data present
      expect(typeof trend!.slope).toBe('number');
      expect(typeof trend!.rSquared).toBe('number');
      expect(typeof trend!.volatility).toBe('number');
      expect(typeof trend!.slopeSignificant).toBe('boolean');
    });

    it('should calculate volatility correctly', () => {
      // High volatility: fluctuating sentiments
      const volatileReviews = [
        createReview(30, -2),
        createReview(20, 2),
        createReview(10, -2),
        createReview(0, 2),
      ];

      const volatileTrend = calculateSentimentTrend(volatileReviews);

      // Stable: consistent sentiments
      const stableReviews = [
        createReview(30, 1),
        createReview(20, 1),
        createReview(10, 1),
        createReview(0, 1),
      ];

      const stableTrend = calculateSentimentTrend(stableReviews);

      expect(volatileTrend!.volatility).toBeGreaterThan(stableTrend!.volatility);
    });

    it('should calculate rSquared correctly for linear data', () => {
      // Perfectly linear
      const linearReviews = [
        createReview(30, -2),
        createReview(20, -1),
        createReview(10, 0),
        createReview(0, 1),
      ];

      const trend = calculateSentimentTrend(linearReviews);

      expect(trend!.rSquared).toBeGreaterThan(0.95);
    });

    it('should calculate rSquared correctly for noisy data', () => {
      // Non-linear pattern
      const noisyReviews = [
        createReview(40, 1),
        createReview(30, -2),
        createReview(20, 2),
        createReview(10, -1),
        createReview(0, 0),
      ];

      const trend = calculateSentimentTrend(noisyReviews);

      expect(trend!.rSquared).toBeLessThan(0.5);
    });

    it('should include date range in result', () => {
      const reviews = [createReview(30, 0), createReview(0, 1)];

      const trend = calculateSentimentTrend(reviews);

      expect(trend!.dateRange.start).toBeDefined();
      expect(trend!.dateRange.end).toBeDefined();
      expect(new Date(trend!.dateRange.end).getTime()).toBeGreaterThan(
        new Date(trend!.dateRange.start).getTime()
      );
    });

    it('should include statistical summary', () => {
      const reviews = [createReview(20, -1), createReview(10, 0), createReview(0, 2)];

      const trend = calculateSentimentTrend(reviews);

      expect(trend!.stats).toBeDefined();
      expect(trend!.stats.mean).toBeCloseTo(0.33, 1);
      expect(trend!.stats.min).toBe(-1);
      expect(trend!.stats.max).toBe(2);
      expect(trend!.stats.stdDev).toBeGreaterThan(0);
    });

    it('should respect custom options', () => {
      const reviews = [createReview(10, 0), createReview(5, 0), createReview(0, 0)];

      // With very high threshold, slope should not be significant
      const trend = calculateSentimentTrend(reviews, undefined, {
        slopeThreshold: 10,
      });

      expect(trend!.slopeSignificant).toBe(false);
    });

    it('should handle reviews with missing dimension', () => {
      const reviews = [
        createReview(20, 0, [createDimension('workflowSatisfaction', 1)]),
        createReview(10, 0, [createDimension('workflowSatisfaction', 2)]),
        createReview(0, 0, []), // No dimensions
      ];

      const trend = calculateSentimentTrend(reviews, 'workflowSatisfaction');

      expect(trend).not.toBeNull();
      expect(trend!.values.length).toBe(3);
    });
  });

  describe('calculateAllDimensionTrends', () => {
    it('should calculate trends for all dimensions', () => {
      const reviews = [
        createReview(20, 0, [
          createDimension('perceivedFriction', -1),
          createDimension('trustCalibration', 0),
          createDimension('taskFit', 1),
          createDimension('configurationConfidence', 0),
          createDimension('improvementAttribution', 1),
          createDimension('workflowSatisfaction', 1),
        ]),
        createReview(10, 0, [
          createDimension('perceivedFriction', 0),
          createDimension('trustCalibration', 1),
          createDimension('taskFit', 1),
          createDimension('configurationConfidence', 1),
          createDimension('improvementAttribution', 1),
          createDimension('workflowSatisfaction', 2),
        ]),
        createReview(0, 0, [
          createDimension('perceivedFriction', 1),
          createDimension('trustCalibration', 2),
          createDimension('taskFit', 2),
          createDimension('configurationConfidence', 2),
          createDimension('improvementAttribution', 2),
          createDimension('workflowSatisfaction', 2),
        ]),
      ];

      const trends = calculateAllDimensionTrends(reviews);

      expect(trends.size).toBe(6);
      expect(trends.has('perceivedFriction')).toBe(true);
      expect(trends.has('workflowSatisfaction')).toBe(true);
    });

    it('should return empty map for insufficient reviews', () => {
      const reviews = [createReview(0, 1)];

      const trends = calculateAllDimensionTrends(reviews);

      expect(trends.size).toBe(0);
    });
  });

  describe('calculateOverallTrend', () => {
    it('should calculate overall sentiment trend', () => {
      const reviews = [createReview(20, -1), createReview(10, 0), createReview(0, 1)];

      const trend = calculateOverallTrend(reviews);

      expect(trend).not.toBeNull();
      expect(trend!.slope).toBeGreaterThan(0);
    });

    it('should use workflowSatisfaction as dimension name', () => {
      const reviews = [createReview(10, 0), createReview(0, 1)];

      const trend = calculateOverallTrend(reviews);

      expect(trend!.dimension).toBe('workflowSatisfaction');
    });
  });

  describe('summarizeTrends', () => {
    it('should summarize multiple dimension trends', () => {
      const reviews = [
        createReview(20, 0, [
          createDimension('perceivedFriction', -1),
          createDimension('workflowSatisfaction', 0),
        ]),
        createReview(10, 0, [
          createDimension('perceivedFriction', 0),
          createDimension('workflowSatisfaction', 1),
        ]),
        createReview(0, 0, [
          createDimension('perceivedFriction', 1),
          createDimension('workflowSatisfaction', 2),
        ]),
      ];

      const trends = calculateAllDimensionTrends(reviews);
      const summary = summarizeTrends(trends);

      // calculateAllDimensionTrends checks all 6 dimensions, returning 0 for missing ones
      expect(summary.totalDimensions).toBe(6);
      expect(summary.withSignificantSlope).toBeGreaterThanOrEqual(0);
      expect(typeof summary.averageSlope).toBe('number');
      expect(typeof summary.averageRSquared).toBe('number');
      expect(typeof summary.averageVolatility).toBe('number');
      expect(summary.slopesByDimension.length).toBe(6);
    });

    it('should sort slopes by dimension descending', () => {
      const trends = new Map<ReviewDimensionName, ExtendedQualitativeTrend>();

      // Create mock trends with known slopes
      trends.set('perceivedFriction', {
        dimension: 'perceivedFriction',
        values: [],
        slope: 0.1,
        slopeSignificant: true,
        rSquared: 0.9,
        volatility: 0.2,
        reviewCount: 3,
        dateRange: { start: '', end: '' },
        stats: { mean: 0, stdDev: 0, min: 0, max: 0 },
      });

      trends.set('workflowSatisfaction', {
        dimension: 'workflowSatisfaction',
        values: [],
        slope: 0.5, // Higher slope
        slopeSignificant: true,
        rSquared: 0.8,
        volatility: 0.3,
        reviewCount: 3,
        dateRange: { start: '', end: '' },
        stats: { mean: 0, stdDev: 0, min: 0, max: 0 },
      });

      const summary = summarizeTrends(trends);

      expect(summary.slopesByDimension[0]!.dimension).toBe('workflowSatisfaction');
      expect(summary.slopesByDimension[1]!.dimension).toBe('perceivedFriction');
    });

    it('should handle empty trends map', () => {
      const trends = new Map<ReviewDimensionName, ExtendedQualitativeTrend>();

      const summary = summarizeTrends(trends);

      expect(summary.totalDimensions).toBe(0);
      expect(summary.averageSlope).toBe(0);
      expect(summary.averageRSquared).toBe(0);
      expect(summary.slopesByDimension.length).toBe(0);
    });

    it('should count significant slopes correctly', () => {
      const trends = new Map<ReviewDimensionName, ExtendedQualitativeTrend>();

      trends.set('perceivedFriction', {
        dimension: 'perceivedFriction',
        values: [],
        slope: 0.001,
        slopeSignificant: false, // Not significant
        rSquared: 0.9,
        volatility: 0.2,
        reviewCount: 3,
        dateRange: { start: '', end: '' },
        stats: { mean: 0, stdDev: 0, min: 0, max: 0 },
      });

      trends.set('workflowSatisfaction', {
        dimension: 'workflowSatisfaction',
        values: [],
        slope: 0.1,
        slopeSignificant: true, // Significant
        rSquared: 0.8,
        volatility: 0.3,
        reviewCount: 3,
        dateRange: { start: '', end: '' },
        stats: { mean: 0, stdDev: 0, min: 0, max: 0 },
      });

      const summary = summarizeTrends(trends);

      expect(summary.withSignificantSlope).toBe(1);
    });
  });

  describe('ADR-0019 compliance', () => {
    it('should not include direction labels', () => {
      const reviews = [createReview(20, -2), createReview(0, 2)];

      const trend = calculateSentimentTrend(reviews);

      // Verify no judgment-based properties
      const trendObj = trend as unknown as Record<string, unknown>;
      expect(trendObj['direction']).toBeUndefined();
      expect(trendObj['trend']).toBeUndefined();
      expect(trendObj['isImproving']).toBeUndefined();
      expect(trendObj['isWorsening']).toBeUndefined();
      expect(trendObj['label']).toBeUndefined();
      expect(trendObj['status']).toBeUndefined();
    });

    it('should provide raw statistical data for agent interpretation', () => {
      const reviews = [
        createReview(30, -1),
        createReview(20, 0),
        createReview(10, 0),
        createReview(0, 1),
      ];

      const trend = calculateSentimentTrend(reviews);

      // Agent can interpret: slope > 0 means increasing
      expect(typeof trend!.slope).toBe('number');

      // Agent can interpret: high rSquared means reliable trend
      expect(typeof trend!.rSquared).toBe('number');
      expect(trend!.rSquared).toBeGreaterThanOrEqual(0);
      expect(trend!.rSquared).toBeLessThanOrEqual(1);

      // Agent can interpret: high volatility means noisy data
      expect(typeof trend!.volatility).toBe('number');

      // Agent can interpret: slopeSignificant helps threshold decisions
      expect(typeof trend!.slopeSignificant).toBe('boolean');
    });
  });
});
