/**
 * Performance tests for temporal delta calculations
 *
 * Tests that delta and trend analysis meets performance targets:
 * - Delta calculation between baselines < 100ms
 * - Trend analysis on 100 baselines < 2s
 *
 * @module tests/performance/temporal-trends
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  calculateDelta,
  calculateMetricsDelta,
  getTrendIndicator,
  createTrendIndicator,
  countChangesByDirection,
} from '../../src/temporal/delta';
import { saveBaseline } from '../../src/persistence/baselines/storage';
import { initBaselineSchema, indexBaseline } from '../../src/persistence/baselines/indexer';
import type { Baseline, MetricChange } from '../../src/persistence/types';
import type { Database } from 'bun:sqlite';

// =============================================================================
// Test Fixtures
// =============================================================================

const TEST_PROJECT = '/test/temporal-perf';

/**
 * Create a test baseline with realistic metrics that show trends over time.
 */
function createTestBaseline(
  index: number,
  trend: 'improving' | 'degrading' | 'stable' = 'stable'
): Baseline {
  // Create timestamps spanning 100 days
  const daysAgo = 100 - index;
  const timestamp = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

  // Simulate metrics based on trend
  let findingsBase = 50;
  let criticalBase = 5;

  if (trend === 'improving') {
    findingsBase = Math.max(10, 100 - index); // Decreasing
    criticalBase = Math.max(0, 10 - Math.floor(index / 10));
  } else if (trend === 'degrading') {
    findingsBase = 10 + index; // Increasing
    criticalBase = Math.floor(index / 20);
  }

  // Add some noise
  const noise = (Math.random() - 0.5) * 10;

  return {
    id: crypto.randomUUID(),
    version: '1.0.0',
    createdAt: timestamp.toISOString(),
    projectPath: TEST_PROJECT,
    actType: 'claudeConfig',
    configPath: `${TEST_PROJECT}/.claude.json`,
    gitCommit: `commit-${index.toString().padStart(4, '0')}`,
    metrics: {
      findingsCount: Math.max(0, Math.round(findingsBase + noise)),
      criticalCount: Math.max(0, criticalBase),
      highCount: Math.round(findingsBase * 0.2),
      mediumCount: Math.round(findingsBase * 0.3),
      lowCount: Math.round(findingsBase * 0.3),
      infoCount: Math.round(findingsBase * 0.2),
    },
    findings: [],
    label: `baseline-${index.toString().padStart(3, '0')}`,
    notes: `Performance test baseline ${index}`,
  };
}

/**
 * Generate metric changes for trend testing.
 */
function generateMetricChanges(count: number): MetricChange[] {
  const changes: MetricChange[] = [];
  const metricNames = [
    'findingsCount',
    'criticalCount',
    'highCount',
    'mediumCount',
    'lowCount',
    'infoCount',
    'configScore',
    'complexity',
    'coverage',
  ];

  for (let i = 0; i < count; i++) {
    const previousValue = 50 + (Math.random() - 0.5) * 20;
    const currentValue = previousValue + (Math.random() - 0.5) * 30;
    const absoluteChange = currentValue - previousValue;

    changes.push({
      metricName: metricNames[i % metricNames.length]!,
      previousValue,
      currentValue,
      absoluteChange,
      percentChange: (absoluteChange / previousValue) * 100,
    });
  }

  return changes;
}

// =============================================================================
// Performance Tests
// =============================================================================

describe('Temporal Delta Performance', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-temporal-perf');
  const baselinesDir = join(testBaseDir, 'baselines');
  let db: Database;
  const baselines: Baseline[] = [];

  beforeAll(async () => {
    // Setup
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
    mkdirSync(testBaseDir, { recursive: true });

    db = await initBaselineSchema({ baseDir: baselinesDir });

    // Create 100 baselines with improving trend
    console.log('Creating 100 test baselines...');
    for (let i = 0; i < 100; i++) {
      const baseline = createTestBaseline(i, 'improving');
      baselines.push(baseline);
      const filePath = await saveBaseline(baseline, { baseDir: baselinesDir });
      await indexBaseline(db, baseline, filePath);
    }
  });

  afterAll(() => {
    if (db) {
      db.close();
    }
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  describe('Delta calculation', () => {
    it('should calculate delta between two baselines in < 50ms', () => {
      const before = baselines[0]!;
      const after = baselines[99]!;

      const startTime = performance.now();
      const delta = calculateDelta(before, after);
      const elapsed = performance.now() - startTime;

      expect(delta).toBeDefined();
      expect(elapsed).toBeLessThan(50);
      console.log(`Delta calculation: ${elapsed.toFixed(2)}ms`);
    });

    it('should calculate metrics delta in < 10ms', () => {
      const before = baselines[0]!;
      const after = baselines[99]!;

      const startTime = performance.now();
      const delta = calculateMetricsDelta(before.metrics, after.metrics);
      const elapsed = performance.now() - startTime;

      expect(delta).toBeDefined();
      // MetricsDelta has { changed, added, removed } arrays
      expect(delta).toHaveProperty('changed');
      expect(delta).toHaveProperty('added');
      expect(delta).toHaveProperty('removed');
      expect(elapsed).toBeLessThan(10);
      console.log(`Metrics delta calculation: ${elapsed.toFixed(2)}ms`);
    });

    it('should calculate 100 deltas in < 500ms', () => {
      const deltas: unknown[] = [];

      const startTime = performance.now();

      for (let i = 1; i < baselines.length; i++) {
        const delta = calculateDelta(baselines[i - 1]!, baselines[i]!);
        deltas.push(delta);
      }

      const elapsed = performance.now() - startTime;

      expect(deltas.length).toBe(99);
      expect(elapsed).toBeLessThan(500);
      console.log(`100 delta calculations: ${elapsed.toFixed(2)}ms`);
    });

    it('should calculate 100 metrics deltas in < 100ms', () => {
      const deltas: unknown[] = [];

      const startTime = performance.now();

      for (let i = 1; i < baselines.length; i++) {
        const delta = calculateMetricsDelta(baselines[i - 1]!.metrics, baselines[i]!.metrics);
        deltas.push(delta);
      }

      const elapsed = performance.now() - startTime;

      expect(deltas.length).toBe(99);
      expect(elapsed).toBeLessThan(100);
      console.log(`100 metrics delta calculations: ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('Trend analysis', () => {
    it('should get trend indicator in < 1ms', () => {
      const fromValue = 50;
      const toValue = 60;
      const metricName = 'findingsCount';

      const startTime = performance.now();
      // getTrendIndicator(from, to, metricName)
      const trend = getTrendIndicator(fromValue, toValue, metricName);
      const elapsed = performance.now() - startTime;

      expect(trend).toBeDefined();
      expect(elapsed).toBeLessThan(1);
      console.log(`Trend indicator: ${elapsed.toFixed(3)}ms`);
    });

    it('should create trend indicator from baselines in < 10ms', () => {
      const before = baselines[0]!;
      const after = baselines[99]!;
      const metricName = 'findingsCount';

      const startTime = performance.now();
      // createTrendIndicator(metricName, change, previousValue)
      const trend = createTrendIndicator(
        metricName,
        after.metrics[metricName] - before.metrics[metricName],
        before.metrics[metricName]
      );
      const elapsed = performance.now() - startTime;

      expect(trend).toBeDefined();
      expect(elapsed).toBeLessThan(10);
      console.log(`Create trend indicator: ${elapsed.toFixed(2)}ms`);
    });

    it('should count changes by direction for 100 changes in < 10ms', () => {
      const changes = generateMetricChanges(100);

      const startTime = performance.now();
      // countChangesByDirection returns { increased, decreased, unchanged }
      const counts = countChangesByDirection(changes);
      const elapsed = performance.now() - startTime;

      expect(counts).toBeDefined();
      expect(counts.increased + counts.decreased + counts.unchanged).toBe(100);
      expect(elapsed).toBeLessThan(10);
      console.log(`Count 100 changes: ${elapsed.toFixed(2)}ms`);
    });

    it('should count changes by direction for 1000 changes in < 50ms', () => {
      const changes = generateMetricChanges(1000);

      const startTime = performance.now();
      const counts = countChangesByDirection(changes);
      const elapsed = performance.now() - startTime;

      expect(counts).toBeDefined();
      expect(counts.increased + counts.decreased + counts.unchanged).toBe(1000);
      expect(elapsed).toBeLessThan(50);
      console.log(`Count 1000 changes: ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('Full trend analysis workflow', () => {
    it('should analyze 100 baselines in < 2s', () => {
      const startTime = performance.now();

      // Calculate all deltas and trends
      const results: Array<{ delta: unknown; trends: unknown }> = [];

      for (let i = 1; i < baselines.length; i++) {
        const before = baselines[i - 1]!;
        const after = baselines[i]!;

        const delta = calculateDelta(before, after);
        const metricsDelta = calculateMetricsDelta(before.metrics, after.metrics);

        // Get trend for each metric
        const trends: Record<string, unknown> = {};
        if (metricsDelta) {
          for (const [key, value] of Object.entries(metricsDelta)) {
            if (
              typeof value === 'number' &&
              before.metrics[key as keyof typeof before.metrics] !== undefined
            ) {
              // getTrendIndicator(from, to, metricName)
              trends[key] = getTrendIndicator(
                before.metrics[key as keyof typeof before.metrics] as number,
                before.metrics[key as keyof typeof before.metrics] as number + value,
                key
              );
            }
          }
        }

        results.push({ delta, trends });
      }

      const elapsed = performance.now() - startTime;

      expect(results.length).toBe(99);
      expect(elapsed).toBeLessThan(2000);
      console.log(`Full analysis on 100 baselines: ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('Large dataset handling', () => {
    it('should calculate deltas for 500 baselines in < 3s', () => {
      const largeBaselines: Baseline[] = [];
      for (let i = 0; i < 500; i++) {
        largeBaselines.push(createTestBaseline(i, 'stable'));
      }

      const startTime = performance.now();

      const deltas: unknown[] = [];
      for (let i = 1; i < largeBaselines.length; i++) {
        const delta = calculateDelta(largeBaselines[i - 1]!, largeBaselines[i]!);
        deltas.push(delta);
      }

      const elapsed = performance.now() - startTime;

      expect(deltas.length).toBe(499);
      expect(elapsed).toBeLessThan(3000);
      console.log(`500 baseline deltas: ${elapsed.toFixed(2)}ms`);
    });

    it('should handle 10000 metric changes in < 500ms', () => {
      const changes = generateMetricChanges(10000);

      const startTime = performance.now();
      const counts = countChangesByDirection(changes);
      const elapsed = performance.now() - startTime;

      expect(counts.increased + counts.decreased + counts.unchanged).toBe(10000);
      expect(elapsed).toBeLessThan(500);
      console.log(`10000 changes counted: ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('Edge cases', () => {
    it('should handle identical baselines quickly', () => {
      const baseline = baselines[0]!;

      const startTime = performance.now();
      const delta = calculateDelta(baseline, baseline);
      const elapsed = performance.now() - startTime;

      expect(delta).toBeDefined();
      expect(elapsed).toBeLessThan(10);
    });

    it('should handle zero previous value in trend indicator', () => {
      const startTime = performance.now();
      // getTrendIndicator(from, to, metricName)
      const trend = getTrendIndicator(0, 10, 'findingsCount');
      const elapsed = performance.now() - startTime;

      expect(trend).toBeDefined();
      expect(elapsed).toBeLessThan(1);
    });

    it('should handle empty changes array', () => {
      const startTime = performance.now();
      const counts = countChangesByDirection([]);
      const elapsed = performance.now() - startTime;

      expect(counts.increased).toBe(0);
      expect(counts.decreased).toBe(0);
      expect(counts.unchanged).toBe(0);
      expect(elapsed).toBeLessThan(1);
    });
  });

  describe('Repeated calculations efficiency', () => {
    it('should maintain consistent performance over 100 iterations', () => {
      const before = baselines[0]!;
      const after = baselines[50]!;
      const times: number[] = [];

      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        calculateDelta(before, after);
        calculateMetricsDelta(before.metrics, after.metrics);
        times.push(performance.now() - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(avgTime).toBeLessThan(10);
      expect(maxTime).toBeLessThan(50);

      console.log(`100 iterations: avg=${avgTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
    });
  });
});
