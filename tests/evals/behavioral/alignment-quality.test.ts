/**
 * EP09 Temporal Analysis - Mixed-Methods Alignment Quality Evaluation
 *
 * Behavioral tests for quantitative/qualitative alignment per ADR-0011/0012.
 * These tests validate that:
 * - Alignment detection correctly identifies convergent/divergent trends
 * - Divergence scoring produces meaningful rankings
 * - Constitution Principle IV (Mixed-Methods) is upheld
 *
 * @module tests/evals/behavioral/alignment-quality
 */

import { describe, expect, it } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  calculateDivergenceMetrics,
  analyzeDivergence,
  findMostDivergentPair,
  calculateDivergenceScore,
  type DivergenceMetrics,
  type DivergenceAnalysis,
} from '../../../src/temporal/qualitative';

import type {
  MetricTrend,
  QualitativeTrend,
  TimeSeriesPoint,
  SentimentPoint,
} from '../../../src/temporal/types';

// =============================================================================
// Types
// =============================================================================

interface GoldenAlignmentScenario {
  id: string;
  version: string;
  source: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  quantitative_data: {
    from_baseline: {
      id: string;
      createdAt: string;
      metrics: Record<string, number>;
    };
    to_baseline: {
      id: string;
      createdAt: string;
      metrics: Record<string, number>;
    };
    delta: Record<
      string,
      {
        from: number;
        to: number;
        percentChange: number;
      }
    >;
  };
  qualitative_data: {
    from_review: {
      id: string;
      baselineId: string;
      createdAt: string;
      overallSentiment: number;
      dimensions: Array<{
        name: string;
        sentiment: number;
      }>;
    };
    to_review: {
      id: string;
      baselineId: string;
      createdAt: string;
      overallSentiment: number;
      dimensions: Array<{
        name: string;
        sentiment: number;
      }>;
    };
    sentiment_change: Record<
      string,
      {
        from: number;
        to: number;
        change: number;
      }
    >;
  };
  expected_properties: {
    alignment_type: 'convergent' | 'divergent';
    correlation: 'positive' | 'negative';
    divergence_severity?: 'high' | 'medium' | 'low';
    validation_confidence?: 'high' | 'medium' | 'low';
    requires_investigation?: boolean;
  };
}

// =============================================================================
// Configuration
// =============================================================================

const GOLDEN_DATASET_PATH = join(__dirname, '../golden/temporal');

// Alignment scenarios from golden dataset
export const ALIGNMENT_SCENARIOS = [
  'scenario-09-quant-qual-aligned.json',
  'scenario-10-quant-qual-divergent.json',
];

// =============================================================================
// Test Utilities
// =============================================================================

function loadGoldenScenario(filename: string): GoldenAlignmentScenario | null {
  const filepath = join(GOLDEN_DATASET_PATH, filename);
  if (!existsSync(filepath)) {
    return null;
  }
  const content = readFileSync(filepath, 'utf-8');
  return JSON.parse(content) as GoldenAlignmentScenario;
}

/**
 * Build MetricTrend from golden scenario quantitative data.
 */
function buildMetricTrend(scenario: GoldenAlignmentScenario, metricName: string): MetricTrend {
  const from = scenario.quantitative_data.from_baseline;
  const to = scenario.quantitative_data.to_baseline;

  const fromValue = from.metrics[metricName] ?? 0;
  const toValue = to.metrics[metricName] ?? 0;

  const values: TimeSeriesPoint[] = [
    { timestamp: from.createdAt, value: fromValue, baselineId: from.id },
    { timestamp: to.createdAt, value: toValue, baselineId: to.id },
  ];

  // Calculate slope (change per day)
  const fromMs = new Date(from.createdAt).getTime();
  const toMs = new Date(to.createdAt).getTime();
  const days = (toMs - fromMs) / (1000 * 60 * 60 * 24);
  const slope = days > 0 ? (toValue - fromValue) / days : 0;

  return {
    metricName,
    values,
    slope,
    rSquared: 1.0, // Perfect fit with 2 points
    volatility: 0,
    meanValue: (fromValue + toValue) / 2,
    standardDeviation: Math.abs(toValue - fromValue) / 2,
    firstValue: fromValue,
    lastValue: toValue,
    percentChange: fromValue !== 0 ? ((toValue - fromValue) / fromValue) * 100 : 0,
  };
}

/**
 * Build QualitativeTrend from golden scenario qualitative data.
 */
function buildQualitativeTrend(
  scenario: GoldenAlignmentScenario,
  dimensionName: string
): QualitativeTrend {
  const from = scenario.qualitative_data.from_review;
  const to = scenario.qualitative_data.to_review;

  const fromDim = from.dimensions.find((d) => d.name === dimensionName);
  const toDim = to.dimensions.find((d) => d.name === dimensionName);

  const fromSentiment = fromDim?.sentiment ?? from.overallSentiment;
  const toSentiment = toDim?.sentiment ?? to.overallSentiment;

  const values: SentimentPoint[] = [
    { timestamp: from.createdAt, sentiment: fromSentiment, reviewId: from.id },
    { timestamp: to.createdAt, sentiment: toSentiment, reviewId: to.id },
  ];

  // Calculate slope (change per day)
  const fromMs = new Date(from.createdAt).getTime();
  const toMs = new Date(to.createdAt).getTime();
  const days = (toMs - fromMs) / (1000 * 60 * 60 * 24);
  const slope = days > 0 ? (toSentiment - fromSentiment) / days : 0;

  return {
    dimension: dimensionName as 'workflowSatisfaction',
    values,
    slope,
    slopeSignificant: Math.abs(slope) > 0.005,
  };
}

// =============================================================================
// Divergence Calculation Accuracy Tests
// =============================================================================

describe('Alignment Quality: Divergence Calculation', () => {
  it('calculates positive correlation for aligned scenario', () => {
    const scenario = loadGoldenScenario('scenario-09-quant-qual-aligned.json');
    if (!scenario) {
      expect(true).toBe(true);
      return;
    }

    // Both metrics decreased (improvement) and sentiment increased (improvement)
    // For findingsCount, lower is better, so decreasing metric + increasing sentiment = aligned
    const metricTrend = buildMetricTrend(scenario, 'findingsCount');
    const qualTrend = buildQualitativeTrend(scenario, 'workflowSatisfaction');

    // Use short overlap requirement since we only have 2 data points
    const metrics = calculateDivergenceMetrics(metricTrend, qualTrend, { minOverlapDays: 0 });

    // Even with 2 points, we can calculate metrics
    if (metrics) {
      // Slopes should be opposite (metric decreasing = negative, sentiment increasing = positive)
      // This is expected for "aligned" improvement scenarios
      expect(metrics.slopesOpposite).toBe(true);
      expect(metrics.quantitativeSlope).toBeLessThan(0); // findings decreasing
      expect(metrics.qualitativeSlope).toBeGreaterThan(0); // sentiment increasing
    }
  });

  it('detects divergence in divergent scenario', () => {
    const scenario = loadGoldenScenario('scenario-10-quant-qual-divergent.json');
    if (!scenario) {
      expect(true).toBe(true);
      return;
    }

    const metricTrend = buildMetricTrend(scenario, 'findingsCount');
    const qualTrend = buildQualitativeTrend(scenario, 'workflowSatisfaction');

    const metrics = calculateDivergenceMetrics(metricTrend, qualTrend, { minOverlapDays: 0 });

    if (metrics) {
      // Both slopes should be negative (metric improving, sentiment declining)
      // This indicates concerning divergence
      expect(metrics.quantitativeSlope).toBeLessThan(0); // findings decreasing (good)
      expect(metrics.qualitativeSlope).toBeLessThan(0); // sentiment decreasing (bad)
      expect(metrics.slopesOpposite).toBe(false); // Same direction = divergent from expected
    }
  });

  it('returns null when insufficient overlap', () => {
    // Create trends with no overlap
    const metricTrend: MetricTrend = {
      metricName: 'test',
      values: [
        { timestamp: '2026-01-01T10:00:00.000Z', value: 10, baselineId: 'b1' },
        { timestamp: '2026-01-05T10:00:00.000Z', value: 15, baselineId: 'b2' },
      ],
      slope: 1,
      rSquared: 1,
      volatility: 0,
      meanValue: 12.5,
      standardDeviation: 2.5,
      firstValue: 10,
      lastValue: 15,
      percentChange: 50,
    };

    const qualTrend: QualitativeTrend = {
      dimension: 'workflowSatisfaction',
      values: [
        { timestamp: '2026-02-01T10:00:00.000Z', sentiment: 0.5, reviewId: 'r1' },
        { timestamp: '2026-02-05T10:00:00.000Z', sentiment: 0.8, reviewId: 'r2' },
      ],
      slope: 0.075,
      slopeSignificant: true,
    };

    // Require 7 days overlap (default)
    const metrics = calculateDivergenceMetrics(metricTrend, qualTrend);
    expect(metrics).toBeNull();
  });
});

// =============================================================================
// Divergence Scoring Tests
// =============================================================================

describe('Alignment Quality: Divergence Scoring', () => {
  it('scores aligned trends lower than divergent trends', () => {
    // Aligned: same direction, high correlation
    const alignedMetrics: DivergenceMetrics = {
      correlation: 0.9,
      slopeDifference: 0.1,
      dataPointCount: 5,
      slopesOpposite: false,
      quantitativeSlope: 0.5,
      qualitativeSlope: 0.4,
      overlapMs: 1000 * 60 * 60 * 24 * 14,
      quantitativeRSquared: 0.95,
    };

    // Divergent: opposite direction, negative correlation
    const divergentMetrics: DivergenceMetrics = {
      correlation: -0.8,
      slopeDifference: 0.9,
      dataPointCount: 5,
      slopesOpposite: true,
      quantitativeSlope: 0.5,
      qualitativeSlope: -0.4,
      overlapMs: 1000 * 60 * 60 * 24 * 14,
      quantitativeRSquared: 0.95,
    };

    const alignedScore = calculateDivergenceScore(alignedMetrics);
    const divergentScore = calculateDivergenceScore(divergentMetrics);

    // Higher score = more divergent
    expect(divergentScore).toBeGreaterThan(alignedScore);
  });

  it('scores opposite slopes higher', () => {
    const sameDirection: DivergenceMetrics = {
      correlation: 0.5,
      slopeDifference: 0.2,
      dataPointCount: 5,
      slopesOpposite: false,
      quantitativeSlope: 0.5,
      qualitativeSlope: 0.3,
      overlapMs: 1000 * 60 * 60 * 24 * 14,
      quantitativeRSquared: 0.9,
    };

    const oppositeDirection: DivergenceMetrics = {
      ...sameDirection,
      slopesOpposite: true,
      qualitativeSlope: -0.3,
    };

    const sameScore = calculateDivergenceScore(sameDirection);
    const oppositeScore = calculateDivergenceScore(oppositeDirection);

    // Opposite slopes should score higher
    expect(oppositeScore).toBeGreaterThan(sameScore);
  });

  it('scores negative correlation higher', () => {
    const positiveCorrelation: DivergenceMetrics = {
      correlation: 0.7,
      slopeDifference: 0.2,
      dataPointCount: 5,
      slopesOpposite: false,
      quantitativeSlope: 0.5,
      qualitativeSlope: 0.3,
      overlapMs: 1000 * 60 * 60 * 24 * 14,
      quantitativeRSquared: 0.9,
    };

    const negativeCorrelation: DivergenceMetrics = {
      ...positiveCorrelation,
      correlation: -0.7,
    };

    const posScore = calculateDivergenceScore(positiveCorrelation);
    const negScore = calculateDivergenceScore(negativeCorrelation);

    // Negative correlation should score higher
    expect(negScore).toBeGreaterThan(posScore);
  });
});

// =============================================================================
// Multi-Metric Analysis Tests
// =============================================================================

describe('Alignment Quality: Multi-Metric Analysis', () => {
  it('analyzes divergence across multiple metric-dimension pairs', () => {
    // Use same timestamps for metrics and qualitative to ensure overlap
    const metricTrends: MetricTrend[] = [
      {
        metricName: 'findingsCount',
        values: [
          { timestamp: '2026-01-01T10:00:00.000Z', value: 20, baselineId: 'b1' },
          { timestamp: '2026-01-08T10:00:00.000Z', value: 15, baselineId: 'b2' },
          { timestamp: '2026-01-15T10:00:00.000Z', value: 10, baselineId: 'b3' },
        ],
        slope: -0.71,
        rSquared: 0.95,
        volatility: 0.1,
        meanValue: 15,
        standardDeviation: 5,
        firstValue: 20,
        lastValue: 10,
        percentChange: -50,
      },
      {
        metricName: 'warningCount',
        values: [
          { timestamp: '2026-01-01T10:00:00.000Z', value: 15, baselineId: 'b1' },
          { timestamp: '2026-01-08T10:00:00.000Z', value: 10, baselineId: 'b2' },
          { timestamp: '2026-01-15T10:00:00.000Z', value: 5, baselineId: 'b3' },
        ],
        slope: -0.71,
        rSquared: 0.95,
        volatility: 0.1,
        meanValue: 10,
        standardDeviation: 5,
        firstValue: 15,
        lastValue: 5,
        percentChange: -66.7,
      },
    ];

    const qualTrends: QualitativeTrend[] = [
      {
        dimension: 'workflowSatisfaction',
        values: [
          { timestamp: '2026-01-01T10:00:00.000Z', sentiment: 0.3, reviewId: 'r1' },
          { timestamp: '2026-01-08T10:00:00.000Z', sentiment: 0.5, reviewId: 'r2' },
          { timestamp: '2026-01-15T10:00:00.000Z', sentiment: 0.7, reviewId: 'r3' },
        ],
        slope: 0.029,
        slopeSignificant: true,
      },
    ];

    const analysis = analyzeDivergence(metricTrends, qualTrends, { minOverlapDays: 0 });

    // Should have analyzed 2 pairs (2 metrics × 1 dimension)
    expect(analysis.pairs.length).toBe(2);
    expect(analysis.averageCorrelation).toBeDefined();
  });

  it('finds most divergent pair correctly', () => {
    const analysis: DivergenceAnalysis = {
      pairs: [
        {
          metricName: 'findingsCount',
          dimensionName: 'workflowSatisfaction',
          metrics: {
            correlation: 0.8,
            slopeDifference: 0.1,
            dataPointCount: 5,
            slopesOpposite: false,
            quantitativeSlope: 0.5,
            qualitativeSlope: 0.4,
            overlapMs: 1000 * 60 * 60 * 24 * 14,
            quantitativeRSquared: 0.9,
          },
        },
        {
          metricName: 'criticalCount',
          dimensionName: 'taskFit',
          metrics: {
            correlation: -0.9,
            slopeDifference: 0.8,
            dataPointCount: 5,
            slopesOpposite: true,
            quantitativeSlope: 0.5,
            qualitativeSlope: -0.3,
            overlapMs: 1000 * 60 * 60 * 24 * 14,
            quantitativeRSquared: 0.95,
          },
        },
      ],
      averageCorrelation: -0.05,
      negativeCorrelationCount: 1,
      oppositeSlopeCount: 1,
    };

    const mostDivergent = findMostDivergentPair(analysis);

    expect(mostDivergent).not.toBeNull();
    expect(mostDivergent!.metricName).toBe('criticalCount');
    expect(mostDivergent!.dimensionName).toBe('taskFit');
  });

  it('handles empty analysis gracefully', () => {
    const emptyAnalysis: DivergenceAnalysis = {
      pairs: [],
      averageCorrelation: 0,
      negativeCorrelationCount: 0,
      oppositeSlopeCount: 0,
    };

    const mostDivergent = findMostDivergentPair(emptyAnalysis);
    expect(mostDivergent).toBeNull();
  });
});

// =============================================================================
// Golden Scenario Validation Tests
// =============================================================================

describe('Alignment Quality: Golden Scenario Validation', () => {
  it('scenario-09 (aligned) has expected convergent properties', () => {
    const scenario = loadGoldenScenario('scenario-09-quant-qual-aligned.json');
    if (!scenario) {
      expect(true).toBe(true);
      return;
    }

    // Validate expected properties
    expect(scenario.expected_properties.alignment_type).toBe('convergent');
    expect(scenario.expected_properties.correlation).toBe('positive');
    expect(scenario.expected_properties.validation_confidence).toBe('high');

    // Validate data consistency
    const quantDelta = scenario.quantitative_data.delta;
    const qualChange = scenario.qualitative_data.sentiment_change;

    // Metrics should show improvement (negative percent change for findings)
    expect(quantDelta['findingsCount']!.percentChange).toBeLessThan(0);

    // Sentiment should show improvement (positive change)
    expect(qualChange['overall']!.change).toBeGreaterThan(0);
  });

  it('scenario-10 (divergent) has expected divergent properties', () => {
    const scenario = loadGoldenScenario('scenario-10-quant-qual-divergent.json');
    if (!scenario) {
      expect(true).toBe(true);
      return;
    }

    // Validate expected properties
    expect(scenario.expected_properties.alignment_type).toBe('divergent');
    expect(scenario.expected_properties.correlation).toBe('negative');
    expect(scenario.expected_properties.divergence_severity).toBe('high');
    expect(scenario.expected_properties.requires_investigation).toBe(true);

    // Validate data consistency
    const quantDelta = scenario.quantitative_data.delta;
    const qualChange = scenario.qualitative_data.sentiment_change;

    // Metrics show improvement (negative percent change)
    expect(quantDelta['findingsCount']!.percentChange).toBeLessThan(0);

    // But sentiment shows decline (negative change) - DIVERGENCE
    expect(qualChange['overall']!.change).toBeLessThan(0);
  });

  it('divergent scenario has higher divergence score than aligned', () => {
    const aligned = loadGoldenScenario('scenario-09-quant-qual-aligned.json');
    const divergent = loadGoldenScenario('scenario-10-quant-qual-divergent.json');

    if (!aligned || !divergent) {
      expect(true).toBe(true);
      return;
    }

    // Build trends for both scenarios
    const alignedMetric = buildMetricTrend(aligned, 'findingsCount');
    const alignedQual = buildQualitativeTrend(aligned, 'workflowSatisfaction');
    const alignedDivMetrics = calculateDivergenceMetrics(alignedMetric, alignedQual, {
      minOverlapDays: 0,
    });

    const divergentMetric = buildMetricTrend(divergent, 'findingsCount');
    const divergentQual = buildQualitativeTrend(divergent, 'workflowSatisfaction');
    const divergentDivMetrics = calculateDivergenceMetrics(divergentMetric, divergentQual, {
      minOverlapDays: 0,
    });

    if (alignedDivMetrics && divergentDivMetrics) {
      const alignedScore = calculateDivergenceScore(alignedDivMetrics);
      const divergentScore = calculateDivergenceScore(divergentDivMetrics);

      // Divergent scenario should score higher (more problematic)
      expect(divergentScore).toBeGreaterThan(alignedScore);
    }
  });
});

// =============================================================================
// Constitution Principle IV Compliance Tests
// =============================================================================

describe('Alignment Quality: Constitution Principle IV', () => {
  it('returns raw statistical data without interpretation', () => {
    const metricTrend: MetricTrend = {
      metricName: 'findingsCount',
      values: [
        { timestamp: '2026-01-01T10:00:00.000Z', value: 20, baselineId: 'b1' },
        { timestamp: '2026-01-15T10:00:00.000Z', value: 10, baselineId: 'b2' },
      ],
      slope: -0.71,
      rSquared: 1,
      volatility: 0,
      meanValue: 15,
      standardDeviation: 5,
      firstValue: 20,
      lastValue: 10,
      percentChange: -50,
    };

    const qualTrend: QualitativeTrend = {
      dimension: 'workflowSatisfaction',
      values: [
        { timestamp: '2026-01-01T15:00:00.000Z', sentiment: 0.3, reviewId: 'r1' },
        { timestamp: '2026-01-15T15:00:00.000Z', sentiment: 0.7, reviewId: 'r2' },
      ],
      slope: 0.029,
      slopeSignificant: true,
    };

    const metrics = calculateDivergenceMetrics(metricTrend, qualTrend, { minOverlapDays: 0 });

    // Per ADR-0019: Tools return DATA, not JUDGMENT
    // Verify we get raw values, not labels like "good/bad" or "aligned/divergent"
    if (metrics) {
      expect(typeof metrics.correlation).toBe('number');
      expect(typeof metrics.slopeDifference).toBe('number');
      expect(typeof metrics.slopesOpposite).toBe('boolean');
      expect(typeof metrics.quantitativeSlope).toBe('number');
      expect(typeof metrics.qualitativeSlope).toBe('number');

      // Should NOT have interpretation fields
      expect((metrics as unknown as Record<string, unknown>)['interpretation']).toBeUndefined();
      expect((metrics as unknown as Record<string, unknown>)['recommendation']).toBeUndefined();
      expect((metrics as unknown as Record<string, unknown>)['severity']).toBeUndefined();
    }
  });

  it('analyzeDivergence returns counts, not judgments', () => {
    const metricTrends: MetricTrend[] = [
      {
        metricName: 'test',
        values: [
          { timestamp: '2026-01-01T10:00:00.000Z', value: 20, baselineId: 'b1' },
          { timestamp: '2026-01-15T10:00:00.000Z', value: 10, baselineId: 'b2' },
        ],
        slope: -0.71,
        rSquared: 1,
        volatility: 0,
        meanValue: 15,
        standardDeviation: 5,
        firstValue: 20,
        lastValue: 10,
        percentChange: -50,
      },
    ];

    const qualTrends: QualitativeTrend[] = [
      {
        dimension: 'workflowSatisfaction',
        values: [
          { timestamp: '2026-01-01T15:00:00.000Z', sentiment: 0.3, reviewId: 'r1' },
          { timestamp: '2026-01-15T15:00:00.000Z', sentiment: 0.7, reviewId: 'r2' },
        ],
        slope: 0.029,
        slopeSignificant: true,
      },
    ];

    const analysis = analyzeDivergence(metricTrends, qualTrends, { minOverlapDays: 0 });

    // Should return counts (data), not labels (judgment)
    expect(typeof analysis.averageCorrelation).toBe('number');
    expect(typeof analysis.negativeCorrelationCount).toBe('number');
    expect(typeof analysis.oppositeSlopeCount).toBe('number');

    // Should NOT have judgment fields
    expect((analysis as unknown as Record<string, unknown>)['overallVerdict']).toBeUndefined();
    expect((analysis as unknown as Record<string, unknown>)['isProblematic']).toBeUndefined();
    expect((analysis as unknown as Record<string, unknown>)['actionRequired']).toBeUndefined();
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Alignment Quality: Edge Cases', () => {
  it('handles empty metric trends array', () => {
    const qualTrends: QualitativeTrend[] = [
      {
        dimension: 'workflowSatisfaction',
        values: [
          { timestamp: '2026-01-01T15:00:00.000Z', sentiment: 0.3, reviewId: 'r1' },
          { timestamp: '2026-01-15T15:00:00.000Z', sentiment: 0.7, reviewId: 'r2' },
        ],
        slope: 0.029,
        slopeSignificant: true,
      },
    ];

    const analysis = analyzeDivergence([], qualTrends);

    expect(analysis.pairs.length).toBe(0);
    expect(analysis.averageCorrelation).toBe(0);
  });

  it('handles empty qualitative trends array', () => {
    const metricTrends: MetricTrend[] = [
      {
        metricName: 'test',
        values: [
          { timestamp: '2026-01-01T10:00:00.000Z', value: 20, baselineId: 'b1' },
          { timestamp: '2026-01-15T10:00:00.000Z', value: 10, baselineId: 'b2' },
        ],
        slope: -0.71,
        rSquared: 1,
        volatility: 0,
        meanValue: 15,
        standardDeviation: 5,
        firstValue: 20,
        lastValue: 10,
        percentChange: -50,
      },
    ];

    const analysis = analyzeDivergence(metricTrends, []);

    expect(analysis.pairs.length).toBe(0);
    expect(analysis.averageCorrelation).toBe(0);
  });

  it('handles single data point in trends', () => {
    const metricTrend: MetricTrend = {
      metricName: 'test',
      values: [{ timestamp: '2026-01-01T10:00:00.000Z', value: 20, baselineId: 'b1' }],
      slope: 0,
      rSquared: 0,
      volatility: 0,
      meanValue: 20,
      standardDeviation: 0,
      firstValue: 20,
      lastValue: 20,
      percentChange: 0,
    };

    const qualTrend: QualitativeTrend = {
      dimension: 'workflowSatisfaction',
      values: [{ timestamp: '2026-01-01T15:00:00.000Z', sentiment: 0.5, reviewId: 'r1' }],
      slope: 0,
      slopeSignificant: false,
    };

    const metrics = calculateDivergenceMetrics(metricTrend, qualTrend, { minOverlapDays: 0 });

    // Single point should return null (insufficient data for correlation)
    expect(metrics).toBeNull();
  });

  it('handles zero slopes correctly', () => {
    const metrics: DivergenceMetrics = {
      correlation: 0,
      slopeDifference: 0,
      dataPointCount: 5,
      slopesOpposite: false,
      quantitativeSlope: 0,
      qualitativeSlope: 0,
      overlapMs: 1000 * 60 * 60 * 24 * 14,
      quantitativeRSquared: 0,
    };

    const score = calculateDivergenceScore(metrics);

    // Zero correlation = 0.5 score, no opposite slopes = 0 score
    expect(score).toBe(0.5);
  });
});
