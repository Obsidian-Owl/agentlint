/**
 * Unit tests for effectiveness data provider.
 *
 * Per ADR-0019, tests verify that the function returns data,
 * not that it makes judgment calls about effectiveness.
 */

import { describe, test, expect } from 'bun:test';

import { getEffectivenessData, getEffectivenessStats } from '../effectiveness';
import type { Baseline } from '../../../persistence/types';

// =============================================================================
// Test Data
// =============================================================================

function createTestBaseline(overrides: Partial<Baseline> = {}): Baseline {
  return {
    id: crypto.randomUUID(),
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    projectPath: '/test/project',
    actType: 'claude-code',
    configPath: '/test/project/CLAUDE.md',
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

// =============================================================================
// Tests
// =============================================================================

describe('Effectiveness Data Provider', () => {
  describe('getEffectivenessData', () => {
    test('should extract basic effectiveness data', () => {
      const preBaseline = createTestBaseline({
        id: 'pre-baseline',
        createdAt: '2026-01-15T10:00:00.000Z',
        metrics: {
          findingsCount: 25,
          criticalCount: 3,
          highCount: 7,
          mediumCount: 10,
          lowCount: 5,
          infoCount: 0,
        },
      });

      const postBaseline = createTestBaseline({
        id: 'post-baseline',
        createdAt: '2026-01-16T10:00:00.000Z',
        metrics: {
          findingsCount: 10,
          criticalCount: 0,
          highCount: 3,
          mediumCount: 5,
          lowCount: 2,
          infoCount: 0,
        },
      });

      const data = getEffectivenessData(preBaseline, postBaseline);

      expect(data.preBaselineId).toBe('pre-baseline');
      expect(data.postBaselineId).toBe('post-baseline');
      expect(data.findingsCountBefore).toBe(25);
      expect(data.findingsCountAfter).toBe(10);
      expect(data.criticalCountBefore).toBe(3);
      expect(data.criticalCountAfter).toBe(0);
      expect(data.timeDelta).toBe(24 * 60 * 60 * 1000); // 1 day in ms
    });

    test('should extract metric changes', () => {
      const preBaseline = createTestBaseline({
        metrics: {
          findingsCount: 20,
          criticalCount: 5,
          highCount: 10,
          mediumCount: 5,
          lowCount: 0,
          infoCount: 0,
        },
      });

      const postBaseline = createTestBaseline({
        metrics: {
          findingsCount: 10,
          criticalCount: 0,
          highCount: 5,
          mediumCount: 5,
          lowCount: 0,
          infoCount: 0,
        },
      });

      const data = getEffectivenessData(preBaseline, postBaseline);

      expect(data.metricChanges.length).toBeGreaterThan(0);

      const findingsChange = data.metricChanges.find((c) => c.name === 'findingsCount');
      expect(findingsChange).toBeDefined();
      expect(findingsChange?.from).toBe(20);
      expect(findingsChange?.to).toBe(10);
      expect(findingsChange?.direction).toBe('↓');

      const criticalChange = data.metricChanges.find((c) => c.name === 'criticalCount');
      expect(criticalChange).toBeDefined();
      expect(criticalChange?.from).toBe(5);
      expect(criticalChange?.to).toBe(0);
      expect(criticalChange?.direction).toBe('↓');
    });

    test('should filter metrics with includeMetrics option', () => {
      const preBaseline = createTestBaseline();
      const postBaseline = createTestBaseline();

      const data = getEffectivenessData(preBaseline, postBaseline, {
        includeMetrics: ['findingsCount', 'criticalCount'],
      });

      expect(data.metricChanges.length).toBe(2);
      expect(data.metricChanges.map((c) => c.name)).toContain('findingsCount');
      expect(data.metricChanges.map((c) => c.name)).toContain('criticalCount');
    });

    test('should filter metrics with excludeMetrics option', () => {
      const preBaseline = createTestBaseline();
      const postBaseline = createTestBaseline();

      const data = getEffectivenessData(preBaseline, postBaseline, {
        excludeMetrics: ['infoCount'],
      });

      expect(data.metricChanges.map((c) => c.name)).not.toContain('infoCount');
    });

    test('should detect config path changes', () => {
      const preBaseline = createTestBaseline({
        configPath: '/project/CLAUDE.md',
      });

      const postBaseline = createTestBaseline({
        configPath: '/project/AGENTS.md',
      });

      const data = getEffectivenessData(preBaseline, postBaseline);

      expect(data.configChanged).toBe(true);
    });

    test('should detect no config change when paths match', () => {
      const preBaseline = createTestBaseline({
        configPath: '/project/CLAUDE.md',
      });

      const postBaseline = createTestBaseline({
        configPath: '/project/CLAUDE.md',
      });

      const data = getEffectivenessData(preBaseline, postBaseline);

      expect(data.configChanged).toBe(false);
    });

    test('should extract git commits when different', () => {
      const preBaseline = createTestBaseline({
        gitCommit: 'abc123',
      });

      const postBaseline = createTestBaseline({
        gitCommit: 'def456',
      });

      const data = getEffectivenessData(preBaseline, postBaseline);

      expect(data.gitCommitsBetween).toContain('abc123');
      expect(data.gitCommitsBetween).toContain('def456');
    });

    test('should return empty git commits when same', () => {
      const preBaseline = createTestBaseline({
        gitCommit: 'abc123',
      });

      const postBaseline = createTestBaseline({
        gitCommit: 'abc123',
      });

      const data = getEffectivenessData(preBaseline, postBaseline);

      expect(data.gitCommitsBetween).toEqual([]);
    });
  });

  describe('getEffectivenessStats', () => {
    test('should count metric directions correctly', () => {
      const preBaseline = createTestBaseline({
        metrics: {
          findingsCount: 20,
          criticalCount: 5,
          highCount: 5,
          mediumCount: 5,
          lowCount: 5,
          infoCount: 0,
        },
      });

      const postBaseline = createTestBaseline({
        metrics: {
          findingsCount: 10, // decreased
          criticalCount: 0, // decreased
          highCount: 10, // increased
          mediumCount: 5, // unchanged
          lowCount: 5, // unchanged
          infoCount: 0, // unchanged
        },
      });

      const data = getEffectivenessData(preBaseline, postBaseline);
      const stats = getEffectivenessStats(data);

      expect(stats.metricsImproved).toBe(2); // findings, critical decreased
      expect(stats.metricsRegressed).toBe(1); // high increased
      expect(stats.metricsUnchanged).toBe(3); // medium, low, info unchanged
    });

    test('should calculate findings delta', () => {
      const preBaseline = createTestBaseline({
        metrics: {
          findingsCount: 25,
          criticalCount: 5,
          highCount: 10,
          mediumCount: 5,
          lowCount: 5,
          infoCount: 0,
        },
      });

      const postBaseline = createTestBaseline({
        metrics: {
          findingsCount: 10,
          criticalCount: 0,
          highCount: 5,
          mediumCount: 3,
          lowCount: 2,
          infoCount: 0,
        },
      });

      const data = getEffectivenessData(preBaseline, postBaseline);
      const stats = getEffectivenessStats(data);

      expect(stats.findingsDelta).toBe(-15); // 10 - 25
      expect(stats.criticalDelta).toBe(-5); // 0 - 5
    });

    test('should handle identical baselines', () => {
      const baseline = createTestBaseline();

      const data = getEffectivenessData(baseline, baseline);
      const stats = getEffectivenessStats(data);

      expect(stats.metricsImproved).toBe(0);
      expect(stats.metricsRegressed).toBe(0);
      // All metrics should be unchanged
      expect(stats.metricsUnchanged).toBe(data.metricsCompared);
      expect(stats.findingsDelta).toBe(0);
      expect(stats.criticalDelta).toBe(0);
    });
  });
});
