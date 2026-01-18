/**
 * Unit tests for temporal/reminders/triggers.ts
 *
 * Tests review trigger conditions:
 * - Major inflection detected trigger
 * - Time-based trigger
 * - Threshold-based trigger
 *
 * @module temporal/reminders/__tests__/triggers.test
 */

import { describe, it, expect } from 'bun:test';

import {
  checkInflectionTrigger,
  checkTimeTrigger,
  checkThresholdTrigger,
  checkAllTriggers,
  getDefaultTriggerConfig,
  type TriggerConfig,
} from '../triggers';
import type { InflectionDetectionResult, InflectionPointData } from '../../trends/inflection';
import type { QualitativeReview, DeltaSummary, MetricChange } from '../../types';

// =============================================================================
// Test Fixtures
// =============================================================================

function createInflectionPoint(overrides: Partial<InflectionPointData> = {}): InflectionPointData {
  return {
    timestamp: '2026-01-15T10:00:00Z',
    baselineId: 'baseline-1',
    index: 5,
    slopeBefore: -0.5,
    slopeAfter: 0.5,
    rSquaredBefore: 0.85,
    rSquaredAfter: 0.9,
    slopeChange: 1.0,
    slopeChangePercent: 2.0, // 200%
    ...overrides,
  };
}

function createInflectionResult(
  metric: string,
  inflectionPoints: InflectionPointData[] = []
): InflectionDetectionResult {
  return {
    metric,
    inflectionPoints,
    overallSlope: 0.1,
    overallRSquared: 0.75,
    dataPointCount: 10,
  };
}

function createReview(daysAgo: number, overrides: Partial<QualitativeReview> = {}): QualitativeReview {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  return {
    id: crypto.randomUUID(),
    baselineId: 'baseline-1',
    createdAt: date.toISOString(),
    dimensions: [],
    overallSentiment: 1,
    themes: [],
    ...overrides,
  };
}

function createDeltaSummary(metricsChanged: MetricChange[] = []): DeltaSummary {
  return {
    metricsChanged,
    warningsAdded: [],
    warningsResolved: [],
    recommendationsAdded: [],
    recommendationsResolved: [],
    trendIndicators: [],
    changeCounts: {
      increased: metricsChanged.filter((m) => m.change > 0).length,
      decreased: metricsChanged.filter((m) => m.change < 0).length,
      unchanged: 0,
    },
  };
}

function createMetricChange(
  name: string,
  from: number,
  to: number
): MetricChange {
  const change = to - from;
  const percentChange = from !== 0 ? ((to - from) / from) * 100 : 100;
  return {
    name,
    from,
    to,
    change,
    percentChange,
    direction: change > 0 ? '↑' : change < 0 ? '↓' : '→',
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('temporal/reminders/triggers', () => {
  describe('checkInflectionTrigger', () => {
    it('should trigger on major inflection point', () => {
      const inflectionResult = createInflectionResult('findingsCount', [
        createInflectionPoint({ slopeChangePercent: 0.75 }),
      ]);

      const trigger = checkInflectionTrigger(inflectionResult);

      expect(trigger).not.toBeNull();
      expect(trigger?.type).toBe('inflection');
      expect(trigger?.severity).toBe('medium');
      expect(trigger?.description).toContain('findingsCount');
    });

    it('should return null for no inflection points', () => {
      const inflectionResult = createInflectionResult('findingsCount', []);

      const trigger = checkInflectionTrigger(inflectionResult);

      expect(trigger).toBeNull();
    });

    it('should return null for insignificant inflection points', () => {
      const inflectionResult = createInflectionResult('findingsCount', [
        createInflectionPoint({ slopeChangePercent: 0.1 }), // Only 10%
      ]);

      const trigger = checkInflectionTrigger(inflectionResult);

      expect(trigger).toBeNull();
    });

    it('should return null for low R² inflection points', () => {
      const inflectionResult = createInflectionResult('findingsCount', [
        createInflectionPoint({ rSquaredBefore: 0.3, rSquaredAfter: 0.4 }),
      ]);

      const trigger = checkInflectionTrigger(inflectionResult);

      expect(trigger).toBeNull();
    });

    it('should report high severity for large slope changes', () => {
      const inflectionResult = createInflectionResult('findingsCount', [
        createInflectionPoint({ slopeChangePercent: 1.5 }), // 150%
      ]);

      const trigger = checkInflectionTrigger(inflectionResult);

      expect(trigger?.severity).toBe('high');
    });

    it('should respect custom thresholds', () => {
      const inflectionResult = createInflectionResult('findingsCount', [
        createInflectionPoint({ slopeChangePercent: 0.3 }), // 30%
      ]);

      const config: TriggerConfig = {
        minInflectionSlopeChange: 0.2, // 20% threshold
      };

      const trigger = checkInflectionTrigger(inflectionResult, config);

      expect(trigger).not.toBeNull();
    });

    it('should select the most significant inflection', () => {
      const inflectionResult = createInflectionResult('findingsCount', [
        createInflectionPoint({ slopeChangePercent: 0.6, index: 3 }),
        createInflectionPoint({ slopeChangePercent: 1.2, index: 7 }),
        createInflectionPoint({ slopeChangePercent: 0.8, index: 5 }),
      ]);

      const trigger = checkInflectionTrigger(inflectionResult);

      expect(trigger).not.toBeNull();
      expect(trigger?.metadata?.slopeChangePercent).toBe(1.2);
    });
  });

  describe('checkTimeTrigger', () => {
    it('should trigger when never reviewed', () => {
      const trigger = checkTimeTrigger(null);

      expect(trigger).not.toBeNull();
      expect(trigger?.type).toBe('time');
      expect(trigger?.severity).toBe('medium');
      expect(trigger?.description).toContain('No previous qualitative review');
    });

    it('should trigger when review is overdue', () => {
      const oldReview = createReview(45); // 45 days ago

      const trigger = checkTimeTrigger(oldReview);

      expect(trigger).not.toBeNull();
      expect(trigger?.type).toBe('time');
      expect(trigger?.description).toContain('45 days');
    });

    it('should not trigger for recent review', () => {
      const recentReview = createReview(15); // 15 days ago

      const trigger = checkTimeTrigger(recentReview);

      expect(trigger).toBeNull();
    });

    it('should respect custom interval', () => {
      const review = createReview(10); // 10 days ago

      const config: TriggerConfig = {
        minDaysSinceReview: 7, // 7 day threshold
      };

      const trigger = checkTimeTrigger(review, config);

      expect(trigger).not.toBeNull();
    });

    it('should report high severity for very overdue reviews', () => {
      const oldReview = createReview(75); // 75 days ago (2.5x threshold)

      const trigger = checkTimeTrigger(oldReview);

      expect(trigger?.severity).toBe('high');
    });
  });

  describe('checkThresholdTrigger', () => {
    it('should trigger on significant metric change', () => {
      const deltaSummary = createDeltaSummary([
        createMetricChange('findingsCount', 100, 70), // -30%
      ]);

      const trigger = checkThresholdTrigger(deltaSummary);

      expect(trigger).not.toBeNull();
      expect(trigger?.type).toBe('threshold');
      expect(trigger?.description).toContain('findingsCount');
    });

    it('should not trigger for small changes', () => {
      const deltaSummary = createDeltaSummary([
        createMetricChange('findingsCount', 100, 95), // -5%
      ]);

      const trigger = checkThresholdTrigger(deltaSummary);

      expect(trigger).toBeNull();
    });

    it('should report high severity for multiple exceeded metrics', () => {
      const deltaSummary = createDeltaSummary([
        createMetricChange('findingsCount', 100, 70),
        createMetricChange('criticalCount', 10, 3),
        createMetricChange('highCount', 20, 8),
      ]);

      const trigger = checkThresholdTrigger(deltaSummary);

      expect(trigger?.severity).toBe('high');
    });

    it('should respect custom per-metric thresholds', () => {
      const deltaSummary = createDeltaSummary([
        createMetricChange('criticalCount', 10, 8), // -20%
      ]);

      const config: TriggerConfig = {
        metricThresholds: {
          criticalCount: 0.1, // 10% threshold for criticalCount
        },
      };

      const trigger = checkThresholdTrigger(deltaSummary, config);

      expect(trigger).not.toBeNull();
    });

    it('should handle empty metric changes', () => {
      const deltaSummary = createDeltaSummary([]);

      const trigger = checkThresholdTrigger(deltaSummary);

      expect(trigger).toBeNull();
    });
  });

  describe('checkAllTriggers', () => {
    it('should combine multiple triggers', () => {
      const inflectionResult = createInflectionResult('findingsCount', [
        createInflectionPoint({ slopeChangePercent: 0.8 }),
      ]);
      const deltaSummary = createDeltaSummary([
        createMetricChange('findingsCount', 100, 60), // -40%
      ]);

      const result = checkAllTriggers({
        inflectionResult,
        lastReview: null,
        deltaSummary,
      });

      expect(result.shouldTrigger).toBe(true);
      expect(result.reasons.length).toBe(3); // inflection, time, threshold
    });

    it('should not trigger when no conditions met', () => {
      const inflectionResult = createInflectionResult('findingsCount', []);
      const recentReview = createReview(5);
      const deltaSummary = createDeltaSummary([]);

      const result = checkAllTriggers({
        inflectionResult,
        lastReview: recentReview,
        deltaSummary,
      });

      expect(result.shouldTrigger).toBe(false);
      expect(result.reasons.length).toBe(0);
    });

    it('should provide meaningful summary for high-priority triggers', () => {
      const result = checkAllTriggers({
        inflectionResult: createInflectionResult('metric', [
          createInflectionPoint({ slopeChangePercent: 1.5 }),
        ]),
      });

      expect(result.summary).toContain('High-priority');
    });

    it('should handle partial parameters', () => {
      // Only provide deltaSummary
      const result = checkAllTriggers({
        deltaSummary: createDeltaSummary([
          createMetricChange('findingsCount', 100, 50),
        ]),
      });

      expect(result.shouldTrigger).toBe(true);
      expect(result.reasons.length).toBe(1);
      expect(result.reasons[0]?.type).toBe('threshold');
    });
  });

  describe('getDefaultTriggerConfig', () => {
    it('should return complete configuration', () => {
      const config = getDefaultTriggerConfig();

      expect(config.minDaysSinceReview).toBe(30);
      expect(config.minInflectionSlopeChange).toBe(0.5);
      expect(config.minInflectionRSquared).toBe(0.5);
      expect(config.defaultMetricThreshold).toBe(0.2);
      expect(config.metricThresholds).toEqual({});
    });
  });
});
