/**
 * Unit tests for persistence/baselines/queries.ts
 *
 * Tests high-level baseline query functions that combine storage and indexing
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { Baseline } from '../../../../src/persistence/types';
import type { Finding } from '../../../../src/orchestration/types';

// Will be implemented in T020
import {
  queryBaselines,
  getBaselineById,
  getLatest,
  compareBaselines,
  getBaselineHistory,
} from '../../../../src/persistence/baselines/queries';

// Needed for setup
import { saveBaseline } from '../../../../src/persistence/baselines/storage';

describe('baselines/queries', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-baseline-queries');

  // Helper to create a test baseline
  function createTestBaseline(overrides: Partial<Baseline> = {}): Baseline {
    return {
      id: crypto.randomUUID(),
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      projectPath: '/test/project',
      actType: 'claude-code',
      configPath: '/test/project/CLAUDE.md',
      gitCommit: 'abc123def456',
      metrics: {
        findingsCount: 3,
        criticalCount: 0,
        highCount: 1,
        mediumCount: 1,
        lowCount: 1,
        infoCount: 0,
      },
      findings: createTestFindings(),
      label: null,
      notes: null,
      ...overrides,
    };
  }

  // Helper to create test findings
  function createTestFindings(): Finding[] {
    return [
      {
        id: crypto.randomUUID(),
        type: 'config_gap',
        severity: 'high',
        title: 'Test finding',
        description: 'A test finding for unit tests.',
        location: null,
        origin: null,
        recommendations: [],
        detectedAt: new Date().toISOString(),
        detectedInPhase: 'test',
      },
    ];
  }

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  describe('queryBaselines', () => {
    it('should return summaries of all baselines', async () => {
      // Setup: save baselines first
      await saveBaseline(createTestBaseline(), { baseDir: testBaseDir });
      await saveBaseline(createTestBaseline(), { baseDir: testBaseDir });
      await saveBaseline(createTestBaseline(), { baseDir: testBaseDir });

      const results = await queryBaselines({ baseDir: testBaseDir });

      expect(results.length).toBe(3);
      // Summaries should have id, metrics, etc. but no findings
      expect(results[0]?.id).toBeDefined();
      expect(results[0]?.metrics).toBeDefined();
    });

    it('should filter by label', async () => {
      await saveBaseline(createTestBaseline({ label: 'v1.0' }), { baseDir: testBaseDir });
      await saveBaseline(createTestBaseline({ label: 'v2.0' }), { baseDir: testBaseDir });
      await saveBaseline(createTestBaseline({ label: null }), { baseDir: testBaseDir });

      const results = await queryBaselines({ baseDir: testBaseDir }, { label: 'v1.0' });

      expect(results.length).toBe(1);
      expect(results[0]?.label).toBe('v1.0');
    });

    it('should filter by date range', async () => {
      await saveBaseline(createTestBaseline({ createdAt: '2026-01-01T00:00:00.000Z' }), {
        baseDir: testBaseDir,
      });
      await saveBaseline(createTestBaseline({ createdAt: '2026-01-15T00:00:00.000Z' }), {
        baseDir: testBaseDir,
      });
      await saveBaseline(createTestBaseline({ createdAt: '2026-01-30T00:00:00.000Z' }), {
        baseDir: testBaseDir,
      });

      const results = await queryBaselines(
        { baseDir: testBaseDir },
        {
          after: '2026-01-10T00:00:00.000Z',
          before: '2026-01-20T00:00:00.000Z',
        }
      );

      expect(results.length).toBe(1);
      expect(results[0]?.createdAt).toBe('2026-01-15T00:00:00.000Z');
    });

    it('should filter by git commit', async () => {
      await saveBaseline(createTestBaseline({ gitCommit: 'abc123' }), { baseDir: testBaseDir });
      await saveBaseline(createTestBaseline({ gitCommit: 'def456' }), { baseDir: testBaseDir });

      const results = await queryBaselines({ baseDir: testBaseDir }, { gitCommit: 'abc123' });

      expect(results.length).toBe(1);
      expect(results[0]?.gitCommit).toBe('abc123');
    });

    it('should limit results', async () => {
      for (let i = 0; i < 10; i++) {
        await saveBaseline(createTestBaseline(), { baseDir: testBaseDir });
      }

      const results = await queryBaselines({ baseDir: testBaseDir }, { limit: 3 });

      expect(results.length).toBe(3);
    });

    it('should order by createdAt desc by default', async () => {
      await saveBaseline(createTestBaseline({ createdAt: '2026-01-01T00:00:00.000Z' }), {
        baseDir: testBaseDir,
      });
      await saveBaseline(createTestBaseline({ createdAt: '2026-01-03T00:00:00.000Z' }), {
        baseDir: testBaseDir,
      });
      await saveBaseline(createTestBaseline({ createdAt: '2026-01-02T00:00:00.000Z' }), {
        baseDir: testBaseDir,
      });

      const results = await queryBaselines({ baseDir: testBaseDir });

      expect(results[0]?.createdAt).toBe('2026-01-03T00:00:00.000Z');
      expect(results[1]?.createdAt).toBe('2026-01-02T00:00:00.000Z');
      expect(results[2]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('should order by findingsCount when specified', async () => {
      await saveBaseline(
        createTestBaseline({
          metrics: {
            findingsCount: 5,
            criticalCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0,
            infoCount: 0,
          },
        }),
        { baseDir: testBaseDir }
      );
      await saveBaseline(
        createTestBaseline({
          metrics: {
            findingsCount: 10,
            criticalCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0,
            infoCount: 0,
          },
        }),
        { baseDir: testBaseDir }
      );
      await saveBaseline(
        createTestBaseline({
          metrics: {
            findingsCount: 1,
            criticalCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0,
            infoCount: 0,
          },
        }),
        { baseDir: testBaseDir }
      );

      const results = await queryBaselines(
        { baseDir: testBaseDir },
        { orderBy: 'findingsCount', order: 'desc' }
      );

      expect(results[0]?.metrics.findingsCount).toBe(10);
      expect(results[1]?.metrics.findingsCount).toBe(5);
      expect(results[2]?.metrics.findingsCount).toBe(1);
    });

    it('should return empty array when no baselines exist', async () => {
      const results = await queryBaselines({ baseDir: testBaseDir });

      expect(results).toEqual([]);
    });
  });

  describe('getBaselineById', () => {
    it('should return full baseline with findings', async () => {
      const baseline = createTestBaseline();
      await saveBaseline(baseline, { baseDir: testBaseDir });

      const result = await getBaselineById(baseline.id, { baseDir: testBaseDir });

      expect(result).not.toBeNull();
      expect(result?.id).toBe(baseline.id);
      expect(result?.findings).toBeDefined();
      expect(result?.findings.length).toBeGreaterThan(0);
    });

    it('should return null for non-existent baseline', async () => {
      const result = await getBaselineById('non-existent-id', { baseDir: testBaseDir });

      expect(result).toBeNull();
    });
  });

  describe('getLatest', () => {
    it('should return the most recently created baseline', async () => {
      await saveBaseline(createTestBaseline({ createdAt: '2026-01-01T00:00:00.000Z' }), {
        baseDir: testBaseDir,
      });
      const latest = createTestBaseline({ createdAt: '2026-01-03T00:00:00.000Z' });
      await saveBaseline(latest, { baseDir: testBaseDir });
      await saveBaseline(createTestBaseline({ createdAt: '2026-01-02T00:00:00.000Z' }), {
        baseDir: testBaseDir,
      });

      const result = await getLatest({ baseDir: testBaseDir });

      expect(result).not.toBeNull();
      expect(result?.id).toBe(latest.id);
    });

    it('should return null when no baselines exist', async () => {
      const result = await getLatest({ baseDir: testBaseDir });

      expect(result).toBeNull();
    });

    it('should include full findings', async () => {
      const baseline = createTestBaseline();
      await saveBaseline(baseline, { baseDir: testBaseDir });

      const result = await getLatest({ baseDir: testBaseDir });

      expect(result?.findings).toBeDefined();
      expect(result?.findings.length).toBe(baseline.findings.length);
    });
  });

  describe('compareBaselines', () => {
    it('should return diff between two baselines', async () => {
      const baseline1 = createTestBaseline({
        createdAt: '2026-01-01T00:00:00.000Z',
        metrics: {
          findingsCount: 10,
          criticalCount: 2,
          highCount: 3,
          mediumCount: 3,
          lowCount: 1,
          infoCount: 1,
        },
      });
      const baseline2 = createTestBaseline({
        createdAt: '2026-01-02T00:00:00.000Z',
        metrics: {
          findingsCount: 7,
          criticalCount: 1,
          highCount: 2,
          mediumCount: 2,
          lowCount: 1,
          infoCount: 1,
        },
      });
      await saveBaseline(baseline1, { baseDir: testBaseDir });
      await saveBaseline(baseline2, { baseDir: testBaseDir });

      const diff = await compareBaselines(baseline1.id, baseline2.id, { baseDir: testBaseDir });

      expect(diff).not.toBeNull();
      expect(diff?.from.id).toBe(baseline1.id);
      expect(diff?.to.id).toBe(baseline2.id);
      expect(diff?.delta.findingsCount).toBe(-3); // 7 - 10
      expect(diff?.delta.criticalCount).toBe(-1);
      expect(diff?.delta.highCount).toBe(-1);
    });

    it('should return null if either baseline does not exist', async () => {
      const baseline = createTestBaseline();
      await saveBaseline(baseline, { baseDir: testBaseDir });

      const diff = await compareBaselines(baseline.id, 'non-existent', { baseDir: testBaseDir });

      expect(diff).toBeNull();
    });

    it('should include improvement/regression classification', async () => {
      const worse = createTestBaseline({
        metrics: {
          findingsCount: 5,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          infoCount: 0,
        },
      });
      const better = createTestBaseline({
        metrics: {
          findingsCount: 3,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          infoCount: 0,
        },
      });
      await saveBaseline(worse, { baseDir: testBaseDir });
      await saveBaseline(better, { baseDir: testBaseDir });

      const diff = await compareBaselines(worse.id, better.id, { baseDir: testBaseDir });

      expect(diff?.trend).toBe('improved'); // fewer findings = improvement
    });

    it('should detect regression', async () => {
      const better = createTestBaseline({
        metrics: {
          findingsCount: 3,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          infoCount: 0,
        },
      });
      const worse = createTestBaseline({
        metrics: {
          findingsCount: 8,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          infoCount: 0,
        },
      });
      await saveBaseline(better, { baseDir: testBaseDir });
      await saveBaseline(worse, { baseDir: testBaseDir });

      const diff = await compareBaselines(better.id, worse.id, { baseDir: testBaseDir });

      expect(diff?.trend).toBe('regressed'); // more findings = regression
    });

    it('should detect no change', async () => {
      const baseline1 = createTestBaseline({
        metrics: {
          findingsCount: 5,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          infoCount: 0,
        },
      });
      const baseline2 = createTestBaseline({
        metrics: {
          findingsCount: 5,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          infoCount: 0,
        },
      });
      await saveBaseline(baseline1, { baseDir: testBaseDir });
      await saveBaseline(baseline2, { baseDir: testBaseDir });

      const diff = await compareBaselines(baseline1.id, baseline2.id, { baseDir: testBaseDir });

      expect(diff?.trend).toBe('unchanged');
    });
  });

  describe('getBaselineHistory', () => {
    it('should return baselines in chronological order', async () => {
      await saveBaseline(createTestBaseline({ createdAt: '2026-01-03T00:00:00.000Z' }), {
        baseDir: testBaseDir,
      });
      await saveBaseline(createTestBaseline({ createdAt: '2026-01-01T00:00:00.000Z' }), {
        baseDir: testBaseDir,
      });
      await saveBaseline(createTestBaseline({ createdAt: '2026-01-02T00:00:00.000Z' }), {
        baseDir: testBaseDir,
      });

      const history = await getBaselineHistory({ baseDir: testBaseDir });

      expect(history.length).toBe(3);
      expect(history[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(history[1]?.createdAt).toBe('2026-01-02T00:00:00.000Z');
      expect(history[2]?.createdAt).toBe('2026-01-03T00:00:00.000Z');
    });

    it('should limit history results', async () => {
      for (let i = 0; i < 20; i++) {
        await saveBaseline(createTestBaseline(), { baseDir: testBaseDir });
      }

      const history = await getBaselineHistory({ baseDir: testBaseDir }, 10);

      expect(history.length).toBe(10);
    });

    it('should return empty array when no baselines exist', async () => {
      const history = await getBaselineHistory({ baseDir: testBaseDir });

      expect(history).toEqual([]);
    });

    it('should filter by label', async () => {
      await saveBaseline(
        createTestBaseline({ label: 'release', createdAt: '2026-01-01T00:00:00.000Z' }),
        {
          baseDir: testBaseDir,
        }
      );
      await saveBaseline(
        createTestBaseline({ label: 'release', createdAt: '2026-01-02T00:00:00.000Z' }),
        {
          baseDir: testBaseDir,
        }
      );
      await saveBaseline(
        createTestBaseline({ label: 'dev', createdAt: '2026-01-03T00:00:00.000Z' }),
        {
          baseDir: testBaseDir,
        }
      );

      const history = await getBaselineHistory({ baseDir: testBaseDir }, undefined, {
        label: 'release',
      });

      expect(history.length).toBe(2);
      expect(history.every((b) => b.label === 'release')).toBe(true);
    });
  });
});
