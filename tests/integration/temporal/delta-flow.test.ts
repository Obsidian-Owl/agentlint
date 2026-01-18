/**
 * VCR Integration Test for Temporal Delta Flow
 *
 * Tests the complete baseline → delta workflow using VCR recordings
 * for deterministic integration testing per ADR-0011.
 *
 * @module tests/integration/temporal/delta-flow.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createTestBaseline,
  createTestMetrics,
  SAMPLE_BASELINE_BEFORE,
  SAMPLE_BASELINE_AFTER,
  SAMPLE_BASELINE_REGRESSION,
  isValidBaseline,
  isValidDeltaSummary,
} from '../../lib/fixtures';
import { saveBaseline, loadBaseline, getLatestBaseline } from '../../../src/persistence/baselines';
import { calculateDelta, calculateMetricsDelta } from '../../../src/temporal/delta/calculator';
import { createDeltaSummary } from '../../../src/temporal/delta/summarizer';
import type { Baseline } from '../../../src/persistence/types';

// =============================================================================
// Test Setup
// =============================================================================

let testDir: string;
let baselinesDir: string;

beforeEach(async () => {
  // Create isolated test directory
  testDir = await mkdtemp(join(tmpdir(), 'agentlint-delta-flow-'));
  baselinesDir = join(testDir, '.agentlint', 'baselines');
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

// =============================================================================
// Tests
// =============================================================================

describe('Temporal Delta Flow Integration', () => {
  describe('Baseline Storage and Retrieval', () => {
    it('should store and retrieve a baseline', async () => {
      const baselineId = crypto.randomUUID();
      const baseline = createTestBaseline({
        id: baselineId,
        projectPath: testDir,
        label: 'test-baseline',
      });

      await saveBaseline(baseline, { baseDir: baselinesDir });
      const retrieved = await loadBaseline(baselineId, { baseDir: baselinesDir });

      expect(retrieved).not.toBeNull();
      expect(isValidBaseline(retrieved)).toBe(true);
      expect(retrieved?.id).toBe(baselineId);
      expect(retrieved?.label).toBe('test-baseline');
    });

    it('should retrieve the latest baseline', async () => {
      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();

      // Store baselines in order
      const baseline1 = createTestBaseline({
        id: id1,
        projectPath: testDir,
        createdAt: '2026-01-15T10:00:00.000Z',
        label: 'first',
      });
      const baseline2 = createTestBaseline({
        id: id2,
        projectPath: testDir,
        createdAt: '2026-01-16T10:00:00.000Z',
        label: 'second',
      });

      await saveBaseline(baseline1, { baseDir: baselinesDir });
      await saveBaseline(baseline2, { baseDir: baselinesDir });

      const latest = await getLatestBaseline({ baseDir: baselinesDir });

      expect(latest).not.toBeNull();
      expect(latest?.id).toBe(id2);
      expect(latest?.label).toBe('second');
    });

    it('should return null for non-existent baseline', async () => {
      const result = await loadBaseline(crypto.randomUUID(), { baseDir: baselinesDir });
      expect(result).toBeNull();
    });
  });

  describe('Delta Calculation', () => {
    it('should detect improvement when findings decrease', () => {
      const result = calculateDelta(SAMPLE_BASELINE_BEFORE, SAMPLE_BASELINE_AFTER);

      expect(result.hasChanges).toBe(true);
      expect(result.metricsDelta).not.toBeNull();

      if (result.metricsDelta) {
        // Findings decreased
        const findingsChange = result.metricsDelta.changed.find((c) => c.name === 'findingsCount');
        expect(findingsChange).toBeDefined();
        expect(findingsChange?.from).toBe(25);
        expect(findingsChange?.to).toBe(8);

        // Critical findings eliminated
        const criticalChange = result.metricsDelta.changed.find((c) => c.name === 'criticalCount');
        expect(criticalChange).toBeDefined();
        expect(criticalChange?.from).toBe(3);
        expect(criticalChange?.to).toBe(0);
      }
    });

    it('should detect regression when findings increase', () => {
      const result = calculateDelta(SAMPLE_BASELINE_AFTER, SAMPLE_BASELINE_REGRESSION);

      expect(result.hasChanges).toBe(true);
      expect(result.metricsDelta).not.toBeNull();

      if (result.metricsDelta) {
        // Findings increased
        const findingsChange = result.metricsDelta.changed.find((c) => c.name === 'findingsCount');
        expect(findingsChange).toBeDefined();
        expect(findingsChange?.from).toBe(8);
        expect(findingsChange?.to).toBe(15);

        // Critical findings reintroduced
        const criticalChange = result.metricsDelta.changed.find((c) => c.name === 'criticalCount');
        expect(criticalChange).toBeDefined();
        expect(criticalChange?.from).toBe(0);
        expect(criticalChange?.to).toBe(2);
      }
    });

    it('should detect no changes for identical baselines', () => {
      const baseline = createTestBaseline();
      const result = calculateDelta(baseline, baseline);

      expect(result.hasChanges).toBe(false);
      expect(result.delta).toBeUndefined();
      expect(result.metricsDelta).toBeNull();
    });
  });

  describe('Metrics Delta', () => {
    it('should correctly categorize added metrics', () => {
      const from = createTestMetrics({ findingsCount: 10 });
      const to = {
        ...createTestMetrics({ findingsCount: 10 }),
        sessionCount: 50,
      };

      const result = calculateMetricsDelta(from, to);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.added.length).toBe(1);
        expect(result.added[0]?.name).toBe('sessionCount');
        expect(result.added[0]?.value).toBe(50);
      }
    });

    it('should correctly categorize removed metrics', () => {
      const from = {
        ...createTestMetrics(),
        sessionCount: 50,
      };
      const to = createTestMetrics();

      const result = calculateMetricsDelta(from, to);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.removed.length).toBe(1);
        expect(result.removed[0]?.name).toBe('sessionCount');
        expect(result.removed[0]?.value).toBe(50);
      }
    });
  });

  describe('Delta Summary', () => {
    it('should create valid summary from metrics delta', () => {
      const { metricsDelta } = calculateDelta(SAMPLE_BASELINE_BEFORE, SAMPLE_BASELINE_AFTER);
      const summary = createDeltaSummary(
        metricsDelta,
        SAMPLE_BASELINE_BEFORE,
        SAMPLE_BASELINE_AFTER
      );

      expect(isValidDeltaSummary(summary)).toBe(true);
      // Per ADR-0019, use changeCounts instead of overallTrend
      expect(summary.changeCounts.decreased).toBeGreaterThan(0);
      expect(summary.metricsChanged.length).toBeGreaterThan(0);
    });

    it('should show increased counts when metrics worsen', () => {
      const { metricsDelta } = calculateDelta(SAMPLE_BASELINE_AFTER, SAMPLE_BASELINE_REGRESSION);
      const summary = createDeltaSummary(
        metricsDelta,
        SAMPLE_BASELINE_AFTER,
        SAMPLE_BASELINE_REGRESSION
      );

      // Per ADR-0019, use changeCounts instead of overallTrend
      expect(summary.changeCounts.increased).toBeGreaterThan(0);
    });

    it('should show zero change counts when comparing identical baselines', () => {
      const baseline = createTestBaseline();
      const { metricsDelta } = calculateDelta(baseline, baseline);
      const summary = createDeltaSummary(metricsDelta, baseline, baseline);

      // Per ADR-0019, use changeCounts instead of overallTrend
      // When comparing identical baselines, metricsDelta is null (no changes)
      // so all counts are zero
      expect(summary.changeCounts.increased).toBe(0);
      expect(summary.changeCounts.decreased).toBe(0);
      expect(summary.changeCounts.unchanged).toBe(0);
      expect(summary.metricsChanged.length).toBe(0);
    });
  });

  describe('Full Workflow', () => {
    it('should support complete store → query → compare workflow', async () => {
      const initialId = crypto.randomUUID();
      const improvedId = crypto.randomUUID();

      // Step 1: Store initial baseline
      const initial = createTestBaseline({
        id: initialId,
        projectPath: testDir,
        createdAt: '2026-01-15T10:00:00.000Z',
        metrics: createTestMetrics({ findingsCount: 20, criticalCount: 5 }),
        label: 'initial',
      });
      await saveBaseline(initial, { baseDir: baselinesDir });

      // Step 2: Store improved baseline
      const improved = createTestBaseline({
        id: improvedId,
        projectPath: testDir,
        createdAt: '2026-01-16T10:00:00.000Z',
        metrics: createTestMetrics({ findingsCount: 8, criticalCount: 0 }),
        label: 'improved',
      });
      await saveBaseline(improved, { baseDir: baselinesDir });

      // Step 3: Retrieve baselines
      const loadedInitial = await loadBaseline(initialId, { baseDir: baselinesDir });
      const loadedImproved = await loadBaseline(improvedId, { baseDir: baselinesDir });

      expect(loadedInitial).not.toBeNull();
      expect(loadedImproved).not.toBeNull();

      // Step 4: Calculate delta
      const { metricsDelta } = calculateDelta(
        loadedInitial as Baseline,
        loadedImproved as Baseline
      );

      expect(metricsDelta).not.toBeNull();

      // Step 5: Create summary
      const summary = createDeltaSummary(
        metricsDelta,
        loadedInitial as Baseline,
        loadedImproved as Baseline
      );

      // Per ADR-0019, use changeCounts instead of overallTrend
      expect(summary.changeCounts.decreased).toBeGreaterThan(0);

      // Verify specific changes (agent interprets whether improvement)
      const findingsChange = summary.metricsChanged.find((c) => c.name === 'findingsCount');
      expect(findingsChange?.from).toBe(20);
      expect(findingsChange?.to).toBe(8);
      expect(findingsChange?.direction).toBe('↓');

      const criticalChange = summary.metricsChanged.find((c) => c.name === 'criticalCount');
      expect(criticalChange?.from).toBe(5);
      expect(criticalChange?.to).toBe(0);
      expect(criticalChange?.direction).toBe('↓');
    });
  });
});
