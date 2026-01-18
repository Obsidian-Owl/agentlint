/**
 * Unit tests for temporal/delta/calculator.ts
 *
 * Tests the delta calculation functions for baseline comparison.
 */

import { describe, it, expect } from 'bun:test';
import type { Delta } from 'jsondiffpatch';

import {
  getDiffPatcher,
  calculateDelta,
  calculateMetricsDelta,
  applyDelta,
  reverseDelta,
} from '../calculator';
import type { Baseline, BaselineMetrics } from '../../../persistence/types';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a test baseline with default values.
 */
function createTestBaseline(overrides: Partial<Baseline> = {}): Baseline {
  return {
    id: 'test-baseline-id',
    version: '1.0.0',
    createdAt: '2026-01-15T12:00:00.000Z',
    projectPath: '/test/project',
    actType: 'claude-code',
    configPath: null,
    gitCommit: null,
    metrics: {
      findingsCount: 10,
      criticalCount: 1,
      highCount: 2,
      mediumCount: 3,
      lowCount: 4,
      infoCount: 0,
    },
    findings: [],
    label: null,
    notes: null,
    ...overrides,
  };
}

/**
 * Create test metrics with default values.
 */
function createTestMetrics(overrides: Partial<BaselineMetrics> = {}): BaselineMetrics {
  return {
    findingsCount: 10,
    criticalCount: 1,
    highCount: 2,
    mediumCount: 3,
    lowCount: 4,
    infoCount: 0,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('temporal/delta/calculator', () => {
  describe('getDiffPatcher', () => {
    it('should return a DiffPatcher instance', () => {
      const patcher = getDiffPatcher();

      expect(patcher).toBeDefined();
      expect(typeof patcher.diff).toBe('function');
      expect(typeof patcher.patch).toBe('function');
    });

    it('should return the same instance when called multiple times', () => {
      const patcher1 = getDiffPatcher();
      const patcher2 = getDiffPatcher();

      // They should be the same singleton instance
      expect(patcher1).toBe(patcher2);
    });

    it('should create a new instance when objectHash option is specified', () => {
      // Force a new instance with different options
      const patcher = getDiffPatcher({ objectHash: false });

      // With different options, it creates a new instance
      expect(patcher).toBeDefined();
    });
  });

  describe('calculateDelta', () => {
    it('should detect no changes for identical baselines', () => {
      const baseline = createTestBaseline();
      const result = calculateDelta(baseline, baseline);

      expect(result.hasChanges).toBe(false);
      expect(result.delta).toBeUndefined();
      expect(result.metricsDelta).toBeNull();
    });

    it('should detect changes when baselines differ', () => {
      const from = createTestBaseline({
        metrics: createTestMetrics({ findingsCount: 10 }),
      });
      const to = createTestBaseline({
        id: 'other-id',
        metrics: createTestMetrics({ findingsCount: 5 }),
      });

      const result = calculateDelta(from, to);

      expect(result.hasChanges).toBe(true);
      expect(result.delta).toBeDefined();
      expect(result.metricsDelta).not.toBeNull();
    });

    it('should track metric changes correctly', () => {
      const from = createTestBaseline({
        metrics: createTestMetrics({
          findingsCount: 10,
          criticalCount: 2,
          highCount: 3,
        }),
      });
      const to = createTestBaseline({
        id: 'other-id',
        metrics: createTestMetrics({
          findingsCount: 5, // Decreased
          criticalCount: 1, // Decreased
          highCount: 5, // Increased
        }),
      });

      const result = calculateDelta(from, to);

      expect(result.metricsDelta).not.toBeNull();
      expect(result.metricsDelta!.changed.length).toBeGreaterThan(0);

      // Check specific changes
      const findingsChange = result.metricsDelta!.changed.find((c) => c.name === 'findingsCount');
      expect(findingsChange).toBeDefined();
      expect(findingsChange!.from).toBe(10);
      expect(findingsChange!.to).toBe(5);

      const criticalChange = result.metricsDelta!.changed.find((c) => c.name === 'criticalCount');
      expect(criticalChange).toBeDefined();
      expect(criticalChange!.from).toBe(2);
      expect(criticalChange!.to).toBe(1);

      const highChange = result.metricsDelta!.changed.find((c) => c.name === 'highCount');
      expect(highChange).toBeDefined();
      expect(highChange!.from).toBe(3);
      expect(highChange!.to).toBe(5);
    });

    it('should handle label changes', () => {
      const from = createTestBaseline({ label: 'before' });
      const to = createTestBaseline({ id: 'other-id', label: 'after' });

      const result = calculateDelta(from, to);

      expect(result.hasChanges).toBe(true);
    });

    it('should handle git commit changes', () => {
      const from = createTestBaseline({ gitCommit: 'abc1234' });
      const to = createTestBaseline({ id: 'other-id', gitCommit: 'def5678' });

      const result = calculateDelta(from, to);

      expect(result.hasChanges).toBe(true);
    });
  });

  describe('calculateMetricsDelta', () => {
    it('should return null when metrics are identical', () => {
      const metrics = createTestMetrics();
      const result = calculateMetricsDelta(metrics, metrics);

      expect(result).toBeNull();
    });

    it('should detect changed metrics', () => {
      const from = createTestMetrics({ findingsCount: 10 });
      const to = createTestMetrics({ findingsCount: 5 });

      const result = calculateMetricsDelta(from, to);

      expect(result).not.toBeNull();
      if (result && result.changed[0]) {
        expect(result.changed.length).toBe(1);
        expect(result.changed[0].name).toBe('findingsCount');
        expect(result.changed[0].from).toBe(10);
        expect(result.changed[0].to).toBe(5);
      }
    });

    it('should detect added metrics', () => {
      const from = createTestMetrics();
      const to: BaselineMetrics = {
        ...createTestMetrics(),
        warningCount: 5,
      };

      const result = calculateMetricsDelta(from, to);

      expect(result).not.toBeNull();
      if (result && result.added[0]) {
        expect(result.added.length).toBe(1);
        expect(result.added[0].name).toBe('warningCount');
        expect(result.added[0].value).toBe(5);
      }
    });

    it('should detect removed metrics', () => {
      const from: BaselineMetrics = {
        ...createTestMetrics(),
        warningCount: 5,
      };
      const to = createTestMetrics();

      const result = calculateMetricsDelta(from, to);

      expect(result).not.toBeNull();
      if (result && result.removed[0]) {
        expect(result.removed.length).toBe(1);
        expect(result.removed[0].name).toBe('warningCount');
        expect(result.removed[0].value).toBe(5);
      }
    });

    it('should handle multiple changes at once', () => {
      const from: BaselineMetrics = {
        findingsCount: 10,
        criticalCount: 1,
        highCount: 2,
        mediumCount: 3,
        lowCount: 4,
        infoCount: 0,
        warningCount: 5,
      };
      const to: BaselineMetrics = {
        findingsCount: 5, // Changed
        criticalCount: 1, // Same
        highCount: 3, // Changed
        mediumCount: 3, // Same
        lowCount: 4, // Same
        infoCount: 1, // Changed
        // warningCount removed
        avgTokensPerSession: 1000, // Added
      };

      const result = calculateMetricsDelta(from, to);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.changed.length).toBe(3); // findingsCount, highCount, infoCount
        expect(result.added.length).toBe(1); // avgTokensPerSession
        expect(result.removed.length).toBe(1); // warningCount
      }
    });
  });

  describe('applyDelta', () => {
    it('should return the original baseline when delta is undefined', () => {
      const baseline = createTestBaseline();
      const result = applyDelta(baseline, undefined);

      expect(result).toEqual(baseline);
    });

    it('should apply a delta to reconstruct the target baseline', () => {
      const from = createTestBaseline({
        id: 'from-id',
        metrics: createTestMetrics({ findingsCount: 10 }),
      });
      const to = createTestBaseline({
        id: 'to-id',
        metrics: createTestMetrics({ findingsCount: 5 }),
      });

      const { delta } = calculateDelta(from, to);
      const result = applyDelta(from, delta as Delta);

      expect(result.id).toBe('to-id');
      expect(result.metrics.findingsCount).toBe(5);
    });

    it('should not modify the original baseline', () => {
      const from = createTestBaseline({
        metrics: createTestMetrics({ findingsCount: 10 }),
      });
      const to = createTestBaseline({
        id: 'other-id',
        metrics: createTestMetrics({ findingsCount: 5 }),
      });

      const { delta } = calculateDelta(from, to);
      applyDelta(from, delta as Delta);

      // Original should be unchanged
      expect(from.metrics.findingsCount).toBe(10);
    });
  });

  describe('reverseDelta', () => {
    it('should return undefined when delta is undefined', () => {
      const result = reverseDelta(undefined);

      expect(result).toBeUndefined();
    });

    it('should create a reversed delta that undoes the original', () => {
      const from = createTestBaseline({
        id: 'from-id',
        metrics: createTestMetrics({ findingsCount: 10 }),
      });
      const to = createTestBaseline({
        id: 'to-id',
        metrics: createTestMetrics({ findingsCount: 5 }),
      });

      const { delta } = calculateDelta(from, to);
      const reversed = reverseDelta(delta as Delta);

      // Applying reversed delta to 'to' should give us something like 'from'
      const result = applyDelta(to, reversed);

      expect(result.id).toBe('from-id');
      expect(result.metrics.findingsCount).toBe(10);
    });
  });
});
