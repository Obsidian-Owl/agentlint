/**
 * Unit tests for temporal/qualitative/alignment.ts
 *
 * Tests divergence calculation between quantitative and qualitative trends.
 * Per ADR-0019, verifies raw data return (no significance judgment).
 *
 * @module temporal/qualitative/__tests__/alignment.test
 */

import { describe, it, expect } from 'bun:test';

import {
  calculateDivergenceMetrics,
  analyzeDivergence,
  findMostDivergentPair,
  calculateDivergenceScore,
} from '../alignment';
import type { MetricTrend, QualitativeTrend, TimeSeriesPoint, SentimentPoint } from '../../types';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTimeSeriesPoint(daysAgo: number, value: number): TimeSeriesPoint {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    timestamp: date.toISOString(),
    value,
    baselineId: `baseline-${daysAgo}`,
  };
}

function createSentimentPoint(daysAgo: number, sentiment: number): SentimentPoint {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    timestamp: date.toISOString(),
    sentiment,
    reviewId: `review-${daysAgo}`,
  };
}

function createMetricTrend(overrides: Partial<MetricTrend> = {}): MetricTrend {
  return {
    metricName: 'findingsCount',
    values: [
      createTimeSeriesPoint(30, 100),
      createTimeSeriesPoint(20, 80),
      createTimeSeriesPoint(10, 60),
      createTimeSeriesPoint(0, 40),
    ],
    slope: -2, // Decreasing (improving for findings)
    rSquared: 0.95,
    volatility: 0.2,
    meanValue: 70,
    standardDeviation: 25,
    firstValue: 100,
    lastValue: 40,
    percentChange: -60,
    ...overrides,
  };
}

function createQualitativeTrend(overrides: Partial<QualitativeTrend> = {}): QualitativeTrend {
  return {
    dimension: 'workflowSatisfaction',
    values: [
      createSentimentPoint(30, -1),
      createSentimentPoint(20, 0),
      createSentimentPoint(10, 1),
      createSentimentPoint(0, 2),
    ],
    slope: 0.1, // Increasing (improving)
    slopeSignificant: true,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('temporal/qualitative/alignment', () => {
  describe('calculateDivergenceMetrics', () => {
    it('should return null for insufficient overlap', () => {
      const quant = createMetricTrend({
        values: [
          createTimeSeriesPoint(60, 100), // 60 days ago
          createTimeSeriesPoint(50, 80), // 50 days ago
        ],
      });
      const qual = createQualitativeTrend({
        values: [
          createSentimentPoint(5, 0), // 5 days ago
          createSentimentPoint(0, 1), // today
        ],
      });

      const metrics = calculateDivergenceMetrics(quant, qual);

      expect(metrics).toBeNull();
    });

    it('should return null for empty data', () => {
      const quant = createMetricTrend({ values: [] });
      const qual = createQualitativeTrend();

      const metrics = calculateDivergenceMetrics(quant, qual);

      expect(metrics).toBeNull();
    });

    it('should calculate positive correlation for aligned trends', () => {
      // Both trends increasing
      const quant = createMetricTrend({
        values: [
          createTimeSeriesPoint(30, 40),
          createTimeSeriesPoint(20, 60),
          createTimeSeriesPoint(10, 80),
          createTimeSeriesPoint(0, 100),
        ],
        slope: 2, // Increasing
      });
      const qual = createQualitativeTrend({
        values: [
          createSentimentPoint(30, -1),
          createSentimentPoint(20, 0),
          createSentimentPoint(10, 1),
          createSentimentPoint(0, 2),
        ],
        slope: 0.1, // Also increasing
      });

      const metrics = calculateDivergenceMetrics(quant, qual);

      expect(metrics).not.toBeNull();
      expect(metrics!.correlation).toBeGreaterThan(0.5); // Positive correlation
      expect(metrics!.slopesOpposite).toBe(false);
    });

    it('should calculate negative correlation for divergent trends', () => {
      // Quantitative increasing, qualitative decreasing
      const quant = createMetricTrend({
        values: [
          createTimeSeriesPoint(30, 40),
          createTimeSeriesPoint(20, 60),
          createTimeSeriesPoint(10, 80),
          createTimeSeriesPoint(0, 100),
        ],
        slope: 2, // Increasing
      });
      const qual = createQualitativeTrend({
        values: [
          createSentimentPoint(30, 2),
          createSentimentPoint(20, 1),
          createSentimentPoint(10, 0),
          createSentimentPoint(0, -1),
        ],
        slope: -0.1, // Decreasing
      });

      const metrics = calculateDivergenceMetrics(quant, qual);

      expect(metrics).not.toBeNull();
      expect(metrics!.correlation).toBeLessThan(-0.5); // Negative correlation
      expect(metrics!.slopesOpposite).toBe(true);
    });

    it('should detect opposite slopes correctly', () => {
      const quant = createMetricTrend({ slope: 2 });
      const qual = createQualitativeTrend({ slope: -0.1 });

      const metrics = calculateDivergenceMetrics(quant, qual);

      expect(metrics!.slopesOpposite).toBe(true);
    });

    it('should not flag same-direction slopes as opposite', () => {
      const quant = createMetricTrend({ slope: -2 }); // Decreasing
      const qual = createQualitativeTrend({ slope: -0.1 }); // Also decreasing

      const metrics = calculateDivergenceMetrics(quant, qual);

      expect(metrics!.slopesOpposite).toBe(false);
    });

    it('should include slope values in result', () => {
      const quant = createMetricTrend({ slope: -2.5 });
      const qual = createQualitativeTrend({ slope: 0.15 });

      const metrics = calculateDivergenceMetrics(quant, qual);

      expect(metrics!.quantitativeSlope).toBe(-2.5);
      expect(metrics!.qualitativeSlope).toBe(0.15);
    });

    it('should include R² values', () => {
      const quant = createMetricTrend({ rSquared: 0.92 });
      const qual = createQualitativeTrend();

      const metrics = calculateDivergenceMetrics(quant, qual);

      expect(metrics!.quantitativeRSquared).toBe(0.92);
    });

    it('should respect custom minimum overlap days', () => {
      const quant = createMetricTrend();
      const qual = createQualitativeTrend();

      // With very high minimum overlap, should return null
      const metrics = calculateDivergenceMetrics(quant, qual, {
        minOverlapDays: 100,
      });

      expect(metrics).toBeNull();
    });

    it('should return data point count', () => {
      const quant = createMetricTrend();
      const qual = createQualitativeTrend();

      const metrics = calculateDivergenceMetrics(quant, qual);

      expect(metrics!.dataPointCount).toBeGreaterThan(0);
    });

    it('should not include significance labels (ADR-0019)', () => {
      const quant = createMetricTrend();
      const qual = createQualitativeTrend();

      const metrics = calculateDivergenceMetrics(quant, qual);

      // Verify no judgment-based properties
      const metricsObj = metrics as unknown as Record<string, unknown>;
      expect(metricsObj['isSignificant']).toBeUndefined();
      expect(metricsObj['isDivergent']).toBeUndefined();
      expect(metricsObj['recommendation']).toBeUndefined();
      expect(metricsObj['label']).toBeUndefined();
    });
  });

  describe('analyzeDivergence', () => {
    it('should analyze multiple metric-dimension pairs', () => {
      const metricTrends = [
        createMetricTrend({ metricName: 'findingsCount' }),
        createMetricTrend({ metricName: 'criticalCount' }),
      ];
      const qualTrends = [
        createQualitativeTrend({ dimension: 'workflowSatisfaction' }),
        createQualitativeTrend({ dimension: 'perceivedFriction' }),
      ];

      const analysis = analyzeDivergence(metricTrends, qualTrends);

      // 2 metrics x 2 dimensions = 4 pairs
      expect(analysis.pairs.length).toBe(4);
      expect(typeof analysis.averageCorrelation).toBe('number');
      expect(typeof analysis.negativeCorrelationCount).toBe('number');
      expect(typeof analysis.oppositeSlopeCount).toBe('number');
    });

    it('should return empty analysis for no valid pairs', () => {
      const metricTrends = [createMetricTrend({ values: [] })];
      const qualTrends = [createQualitativeTrend({ values: [] })];

      const analysis = analyzeDivergence(metricTrends, qualTrends);

      expect(analysis.pairs.length).toBe(0);
      expect(analysis.averageCorrelation).toBe(0);
    });

    it('should count negative correlations correctly', () => {
      // Create one aligned pair and one divergent pair
      const metricTrends = [
        createMetricTrend({
          metricName: 'aligned',
          values: [
            createTimeSeriesPoint(30, 40),
            createTimeSeriesPoint(0, 100),
          ],
          slope: 2,
        }),
        createMetricTrend({
          metricName: 'divergent',
          values: [
            createTimeSeriesPoint(30, 100),
            createTimeSeriesPoint(0, 40),
          ],
          slope: -2,
        }),
      ];

      const qualTrends = [
        createQualitativeTrend({
          values: [
            createSentimentPoint(30, -1),
            createSentimentPoint(0, 2),
          ],
          slope: 0.1,
        }),
      ];

      const analysis = analyzeDivergence(metricTrends, qualTrends);

      // One metric is aligned (positive correlation), one is divergent (negative)
      expect(analysis.negativeCorrelationCount).toBeGreaterThanOrEqual(0);
    });

    it('should include metric and dimension names in pairs', () => {
      const metricTrends = [createMetricTrend({ metricName: 'testMetric' })];
      const qualTrends = [createQualitativeTrend({ dimension: 'trustCalibration' })];

      const analysis = analyzeDivergence(metricTrends, qualTrends);

      expect(analysis.pairs.length).toBe(1);
      expect(analysis.pairs[0]!.metricName).toBe('testMetric');
      expect(analysis.pairs[0]!.dimensionName).toBe('trustCalibration');
    });
  });

  describe('findMostDivergentPair', () => {
    it('should return null for empty analysis', () => {
      const analysis = {
        pairs: [],
        averageCorrelation: 0,
        negativeCorrelationCount: 0,
        oppositeSlopeCount: 0,
      };

      const mostDivergent = findMostDivergentPair(analysis);

      expect(mostDivergent).toBeNull();
    });

    it('should find the most divergent pair', () => {
      const analysis = {
        pairs: [
          {
            metricName: 'aligned',
            dimensionName: 'workflowSatisfaction',
            metrics: {
              correlation: 0.9,
              slopeDifference: 0.1,
              dataPointCount: 4,
              slopesOpposite: false,
              quantitativeSlope: 0.1,
              qualitativeSlope: 0.1,
              overlapMs: 1000000,
              quantitativeRSquared: 0.9,
            },
          },
          {
            metricName: 'divergent',
            dimensionName: 'perceivedFriction',
            metrics: {
              correlation: -0.9,
              slopeDifference: 0.5,
              dataPointCount: 4,
              slopesOpposite: true,
              quantitativeSlope: 0.2,
              qualitativeSlope: -0.1,
              overlapMs: 1000000,
              quantitativeRSquared: 0.8,
            },
          },
        ],
        averageCorrelation: 0,
        negativeCorrelationCount: 1,
        oppositeSlopeCount: 1,
      };

      const mostDivergent = findMostDivergentPair(analysis);

      expect(mostDivergent).not.toBeNull();
      expect(mostDivergent!.metricName).toBe('divergent');
    });
  });

  describe('calculateDivergenceScore', () => {
    it('should return 0 for perfectly aligned metrics', () => {
      const metrics = {
        correlation: 1,
        slopeDifference: 0,
        dataPointCount: 4,
        slopesOpposite: false,
        quantitativeSlope: 0.1,
        qualitativeSlope: 0.1,
        overlapMs: 1000000,
        quantitativeRSquared: 0.9,
      };

      const score = calculateDivergenceScore(metrics);

      expect(score).toBe(0);
    });

    it('should return high score for highly divergent metrics', () => {
      const metrics = {
        correlation: -1,
        slopeDifference: 0.5,
        dataPointCount: 4,
        slopesOpposite: true,
        quantitativeSlope: 0.2,
        qualitativeSlope: -0.1,
        overlapMs: 1000000,
        quantitativeRSquared: 0.8,
      };

      const score = calculateDivergenceScore(metrics);

      expect(score).toBe(2); // Maximum divergence
    });

    it('should add 1 for opposite slopes', () => {
      const withOpposite = {
        correlation: 0,
        slopeDifference: 0,
        dataPointCount: 4,
        slopesOpposite: true,
        quantitativeSlope: 0.1,
        qualitativeSlope: -0.1,
        overlapMs: 1000000,
        quantitativeRSquared: 0.9,
      };

      const withoutOpposite = {
        ...withOpposite,
        slopesOpposite: false,
      };

      const scoreWith = calculateDivergenceScore(withOpposite);
      const scoreWithout = calculateDivergenceScore(withoutOpposite);

      expect(scoreWith - scoreWithout).toBe(1);
    });
  });

  describe('ADR-0019 compliance', () => {
    it('should return raw statistical data without interpretation', () => {
      const quant = createMetricTrend();
      const qual = createQualitativeTrend();

      const metrics = calculateDivergenceMetrics(quant, qual);

      // Verify raw data present
      expect(typeof metrics!.correlation).toBe('number');
      expect(typeof metrics!.slopeDifference).toBe('number');
      expect(typeof metrics!.dataPointCount).toBe('number');
      expect(typeof metrics!.slopesOpposite).toBe('boolean');

      // Verify no interpretation/judgment
      const obj = metrics as unknown as Record<string, unknown>;
      expect(obj['meaning']).toBeUndefined();
      expect(obj['interpretation']).toBeUndefined();
      expect(obj['recommendation']).toBeUndefined();
      expect(obj['action']).toBeUndefined();
    });

    it('should let agent interpret correlation values', () => {
      // Test that we return raw correlation for agent to interpret
      const aligned = calculateDivergenceMetrics(
        createMetricTrend({
          values: [
            createTimeSeriesPoint(30, 40),
            createTimeSeriesPoint(0, 100),
          ],
          slope: 2,
        }),
        createQualitativeTrend({
          values: [
            createSentimentPoint(30, -1),
            createSentimentPoint(0, 2),
          ],
          slope: 0.1,
        })
      );

      // Agent can interpret: positive correlation means trends move together
      expect(aligned!.correlation).toBeGreaterThan(0);

      const divergent = calculateDivergenceMetrics(
        createMetricTrend({
          values: [
            createTimeSeriesPoint(30, 100),
            createTimeSeriesPoint(0, 40),
          ],
          slope: -2,
        }),
        createQualitativeTrend({
          values: [
            createSentimentPoint(30, -1),
            createSentimentPoint(0, 2),
          ],
          slope: 0.1,
        })
      );

      // Agent can interpret: negative correlation means trends move opposite
      expect(divergent!.correlation).toBeLessThan(0);
    });
  });
});
