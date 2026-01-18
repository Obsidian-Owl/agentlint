/**
 * Unit tests for temporal/trends/inflection.ts
 *
 * Tests inflection point detection per ADR-0019 (returns raw statistics,
 * not judgment labels).
 *
 * @module temporal/trends/__tests__/inflection.test
 */

import { describe, it, expect } from 'bun:test';

import {
  detectInflectionPoints,
  detectInflectionPointsFromSeries,
  findMostSignificantInflection,
  filterBySignificance,
  categorizeInflections,
  type InflectionPointData,
} from '../inflection';
import type { MetricTrend, TimeSeriesPoint } from '../../types';

// =============================================================================
// Test Helpers
// =============================================================================

function createTimeSeriesPoint(
  value: number,
  index: number,
  baseId: string = 'baseline'
): TimeSeriesPoint {
  return {
    timestamp: `2026-01-${String(index + 1).padStart(2, '0')}T10:00:00Z`,
    value,
    baselineId: `${baseId}-${index}`,
  };
}

function createMetricTrend(
  name: string,
  values: number[],
  overrides: Partial<MetricTrend> = {}
): MetricTrend {
  const points = values.map((v, i) => createTimeSeriesPoint(v, i));
  return {
    metricName: name,
    values: points,
    slope: 0,
    rSquared: 0.5,
    volatility: 0.1,
    meanValue: values.reduce((a, b) => a + b, 0) / values.length,
    standardDeviation: 0,
    firstValue: values[0] ?? 0,
    lastValue: values[values.length - 1] ?? 0,
    percentChange: 0,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('temporal/trends/inflection', () => {
  describe('detectInflectionPoints', () => {
    it('should return empty result for insufficient data', () => {
      const trend = createMetricTrend('test', [10, 15, 20]); // Only 3 points, need 6 for window=3

      const result = detectInflectionPoints(trend);

      expect(result.inflectionPoints.length).toBe(0);
      expect(result.metric).toBe('test');
      expect(result.dataPointCount).toBe(3);
    });

    it('should detect inflection when slope changes significantly', () => {
      // Decreasing then increasing pattern
      const values = [100, 90, 80, 70, 75, 85, 95, 105, 115];
      const trend = createMetricTrend('findingsCount', values, { slope: 1.5, rSquared: 0.8 });

      const result = detectInflectionPoints(trend, { minSlopeChangePercent: 0.1 });

      expect(result.inflectionPoints.length).toBeGreaterThan(0);

      // Check that inflection point has raw statistical data
      const inflection = result.inflectionPoints[0];
      expect(inflection).toBeDefined();
      expect(inflection?.slopeBefore).toBeDefined();
      expect(inflection?.slopeAfter).toBeDefined();
      expect(inflection?.rSquaredBefore).toBeDefined();
      expect(inflection?.rSquaredAfter).toBeDefined();

      // Slope should have changed sign (negative to positive)
      if (inflection) {
        expect(inflection.slopeBefore).toBeLessThan(0);
        expect(inflection.slopeAfter).toBeGreaterThan(0);
      }
    });

    it('should include statistical confidence (R²) for each segment', () => {
      // Linear segments for high R²
      const values = [10, 20, 30, 40, 30, 20, 10, 0, -10];
      const trend = createMetricTrend('metric', values, { slope: -2, rSquared: 0.6 });

      const result = detectInflectionPoints(trend);

      for (const point of result.inflectionPoints) {
        // R² should be between 0 and 1
        expect(point.rSquaredBefore).toBeGreaterThanOrEqual(0);
        expect(point.rSquaredBefore).toBeLessThanOrEqual(1);
        expect(point.rSquaredAfter).toBeGreaterThanOrEqual(0);
        expect(point.rSquaredAfter).toBeLessThanOrEqual(1);
      }
    });

    it('should NOT include judgment labels (per ADR-0019)', () => {
      const values = [100, 90, 80, 70, 75, 85, 95, 105, 115];
      const trend = createMetricTrend('metric', values, { slope: 1.5, rSquared: 0.8 });

      const result = detectInflectionPoints(trend);

      for (const point of result.inflectionPoints) {
        // Should NOT have judgment fields
        expect(point).not.toHaveProperty('direction');
        expect(point).not.toHaveProperty('isImprovement');
        expect(point).not.toHaveProperty('significance');
        expect(point).not.toHaveProperty('trend');
      }
    });

    it('should respect minWindowSize option', () => {
      const values = [10, 20, 30, 40, 30, 20, 10, 5, 2];
      const trend = createMetricTrend('metric', values);

      // With window=2, we only need 4 points total
      const smallWindow = detectInflectionPoints(trend, { minWindowSize: 2 });
      // With window=4, we need 8 points total
      const largeWindow = detectInflectionPoints(trend, { minWindowSize: 4 });

      // Larger window should detect fewer inflections due to smoothing
      expect(smallWindow.inflectionPoints.length).toBeGreaterThanOrEqual(
        largeWindow.inflectionPoints.length
      );
    });

    it('should respect minSlopeChangePercent threshold', () => {
      const values = [10, 11, 12, 13, 12.5, 12, 11.5, 11, 10.5];
      const trend = createMetricTrend('metric', values);

      // With low threshold, detect small changes
      const sensitive = detectInflectionPoints(trend, { minSlopeChangePercent: 0.01 });
      // With high threshold, only detect large changes
      const insensitive = detectInflectionPoints(trend, { minSlopeChangePercent: 0.9 });

      expect(sensitive.inflectionPoints.length).toBeGreaterThanOrEqual(
        insensitive.inflectionPoints.length
      );
    });
  });

  describe('detectInflectionPointsFromSeries', () => {
    it('should work with raw time series data', () => {
      const series: TimeSeriesPoint[] = [
        createTimeSeriesPoint(100, 0),
        createTimeSeriesPoint(90, 1),
        createTimeSeriesPoint(80, 2),
        createTimeSeriesPoint(70, 3),
        createTimeSeriesPoint(75, 4),
        createTimeSeriesPoint(85, 5),
        createTimeSeriesPoint(95, 6),
        createTimeSeriesPoint(105, 7),
      ];

      const result = detectInflectionPointsFromSeries('testMetric', series);

      expect(result.metric).toBe('testMetric');
      expect(result.dataPointCount).toBe(8);
      expect(result.overallSlope).toBeDefined();
      expect(result.overallRSquared).toBeDefined();
    });

    it('should handle empty series', () => {
      const result = detectInflectionPointsFromSeries('empty', []);

      expect(result.inflectionPoints.length).toBe(0);
      expect(result.dataPointCount).toBe(0);
    });

    it('should handle single point', () => {
      const result = detectInflectionPointsFromSeries('single', [createTimeSeriesPoint(50, 0)]);

      expect(result.inflectionPoints.length).toBe(0);
      expect(result.dataPointCount).toBe(1);
    });
  });

  describe('findMostSignificantInflection', () => {
    it('should return the inflection with largest slope change', () => {
      const inflections: InflectionPointData[] = [
        {
          timestamp: '2026-01-02',
          baselineId: 'b1',
          index: 1,
          slopeBefore: -5,
          slopeAfter: -3,
          rSquaredBefore: 0.9,
          rSquaredAfter: 0.8,
          slopeChange: 2,
          slopeChangePercent: 0.4,
        },
        {
          timestamp: '2026-01-05',
          baselineId: 'b4',
          index: 4,
          slopeBefore: -2,
          slopeAfter: 5,
          rSquaredBefore: 0.85,
          rSquaredAfter: 0.9,
          slopeChange: 7,
          slopeChangePercent: 3.5,
        },
        {
          timestamp: '2026-01-08',
          baselineId: 'b7',
          index: 7,
          slopeBefore: 4,
          slopeAfter: 3,
          rSquaredBefore: 0.7,
          rSquaredAfter: 0.75,
          slopeChange: 1,
          slopeChangePercent: 0.25,
        },
      ];

      const result = {
        metric: 'test',
        inflectionPoints: inflections,
        overallSlope: 0.5,
        overallRSquared: 0.8,
        dataPointCount: 10,
      };

      const mostSignificant = findMostSignificantInflection(result);

      expect(mostSignificant).not.toBeNull();
      expect(mostSignificant?.slopeChange).toBe(7);
      expect(mostSignificant?.index).toBe(4);
    });

    it('should return null for empty inflection list', () => {
      const result = {
        metric: 'test',
        inflectionPoints: [],
        overallSlope: 0,
        overallRSquared: 0,
        dataPointCount: 5,
      };

      expect(findMostSignificantInflection(result)).toBeNull();
    });
  });

  describe('filterBySignificance', () => {
    it('should filter by R² threshold', () => {
      const inflections: InflectionPointData[] = [
        {
          timestamp: '2026-01-02',
          baselineId: 'b1',
          index: 1,
          slopeBefore: -5,
          slopeAfter: 3,
          rSquaredBefore: 0.9,
          rSquaredAfter: 0.85,
          slopeChange: 8,
          slopeChangePercent: 1.6,
        },
        {
          timestamp: '2026-01-05',
          baselineId: 'b4',
          index: 4,
          slopeBefore: -2,
          slopeAfter: 5,
          rSquaredBefore: 0.5,
          rSquaredAfter: 0.6,
          slopeChange: 7,
          slopeChangePercent: 3.5,
        },
      ];

      const result = {
        metric: 'test',
        inflectionPoints: inflections,
        overallSlope: 0,
        overallRSquared: 0.7,
        dataPointCount: 8,
      };

      const filtered = filterBySignificance(result, 0.8);

      expect(filtered.length).toBe(1);
      expect(filtered[0]?.rSquaredBefore).toBeGreaterThanOrEqual(0.8);
      expect(filtered[0]?.rSquaredAfter).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('categorizeInflections', () => {
    it('should categorize by slope sign changes', () => {
      const inflections: InflectionPointData[] = [
        {
          timestamp: '2026-01-02',
          baselineId: 'b1',
          index: 1,
          slopeBefore: -5,
          slopeAfter: 3,
          rSquaredBefore: 0.9,
          rSquaredAfter: 0.85,
          slopeChange: 8,
          slopeChangePercent: 1.6,
        },
        {
          timestamp: '2026-01-05',
          baselineId: 'b4',
          index: 4,
          slopeBefore: 4,
          slopeAfter: -2,
          rSquaredBefore: 0.8,
          rSquaredAfter: 0.75,
          slopeChange: 6,
          slopeChangePercent: 1.5,
        },
        {
          timestamp: '2026-01-08',
          baselineId: 'b7',
          index: 7,
          slopeBefore: 2,
          slopeAfter: 5,
          rSquaredBefore: 0.85,
          rSquaredAfter: 0.9,
          slopeChange: 3,
          slopeChangePercent: 1.5,
        },
      ];

      const result = {
        metric: 'test',
        inflectionPoints: inflections,
        overallSlope: 0,
        overallRSquared: 0.8,
        dataPointCount: 10,
      };

      const categories = categorizeInflections(result);

      expect(categories.negativeToPositive.length).toBe(1);
      expect(categories.positiveToNegative.length).toBe(1);
      expect(categories.increasingSlope.length).toBe(2); // -5→3 and 2→5
      expect(categories.decreasingSlope.length).toBe(1); // 4→-2
    });
  });

  describe('ADR-0019 Compliance', () => {
    it('should return raw statistical data, not judgment labels', () => {
      const values = [100, 90, 80, 70, 75, 85, 95, 105, 115];
      const trend = createMetricTrend('metric', values);

      const result = detectInflectionPoints(trend);

      // Should have raw statistical fields
      expect(result).toHaveProperty('metric');
      expect(result).toHaveProperty('inflectionPoints');
      expect(result).toHaveProperty('overallSlope');
      expect(result).toHaveProperty('overallRSquared');
      expect(result).toHaveProperty('dataPointCount');

      // Should NOT have judgment fields
      expect(result).not.toHaveProperty('trend');
      expect(result).not.toHaveProperty('direction');
      expect(result).not.toHaveProperty('significance');
      expect(result).not.toHaveProperty('isImproving');
    });

    it('should provide R² for agent to assess reliability', () => {
      const values = [10, 20, 30, 40, 30, 20, 10, 0, -10];
      const trend = createMetricTrend('metric', values);

      const result = detectInflectionPoints(trend);

      // Agent uses R² to decide if the inflection is statistically reliable
      for (const point of result.inflectionPoints) {
        expect(typeof point.rSquaredBefore).toBe('number');
        expect(typeof point.rSquaredAfter).toBe('number');
      }
    });
  });
});
