/**
 * Performance tests for baseline persistence
 *
 * Tests that baseline queries meet performance targets:
 * - Query 50 baselines in < 2 seconds
 *
 * @module tests/performance/baselines
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { saveBaseline } from '../../src/persistence/baselines/storage';
import { initBaselineSchema, indexBaseline } from '../../src/persistence/baselines/indexer';
import {
  queryBaselines,
  getBaselineById,
  getLatest,
} from '../../src/persistence/baselines/queries';
import type { Baseline } from '../../src/persistence/types';
import type { Database } from 'bun:sqlite';

describe('baseline performance', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-perf-baselines');
  const baselinesDir = join(testBaseDir, 'baselines');

  let db: Database;

  // Store created baseline IDs for queries
  const baselineIds: string[] = [];

  /**
   * Create a valid baseline object for testing.
   */
  function createTestBaseline(index: number): Baseline {
    const id = crypto.randomUUID();
    baselineIds.push(id);

    return {
      id,
      version: '1.0.0',
      createdAt: new Date(Date.now() - index * 60000).toISOString(), // Stagger timestamps
      projectPath: '/test/project',
      actType: 'claudeConfig',
      configPath: '/test/project/.claude.json',
      gitCommit: `commit-${index.toString().padStart(4, '0')}`,
      metrics: {
        findingsCount: index % 10,
        criticalCount: index % 3,
        highCount: index % 5,
        mediumCount: index % 7,
        lowCount: index % 4,
        infoCount: index % 2,
      },
      findings: [],
      label: `baseline-${index.toString().padStart(3, '0')}`,
      notes: `Performance test baseline ${index}`,
    };
  }

  beforeAll(async () => {
    // Clean up any existing test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
    mkdirSync(testBaseDir, { recursive: true });

    // Open database and init schema
    db = await initBaselineSchema({ baseDir: baselinesDir });

    // Create 50 baselines
    console.log('Creating 50 test baselines...');
    const startCreate = performance.now();

    for (let i = 0; i < 50; i++) {
      const baseline = createTestBaseline(i);
      const filePath = await saveBaseline(baseline, { baseDir: baselinesDir });
      await indexBaseline(db, baseline, filePath);
    }

    const createTime = performance.now() - startCreate;
    console.log(`Created 50 baselines in ${createTime.toFixed(2)}ms`);
  });

  afterAll(() => {
    if (db) {
      db.close();
    }
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  it('should query all 50 baselines in < 2 seconds', async () => {
    const startTime = performance.now();

    const results = await queryBaselines({ baseDir: baselinesDir }, {});

    const elapsed = performance.now() - startTime;

    expect(results.length).toBe(50);
    expect(elapsed).toBeLessThan(2000);

    console.log(`Queried 50 baselines in ${elapsed.toFixed(2)}ms`);
  });

  it('should query by exact label in < 500ms', async () => {
    const startTime = performance.now();

    // Query baselines with exact label match (index uses exact match, not LIKE)
    const results = await queryBaselines({ baseDir: baselinesDir }, { label: 'baseline-025' });

    const elapsed = performance.now() - startTime;

    expect(results.length).toBe(1);
    expect(elapsed).toBeLessThan(500);

    console.log(`Queried by exact label in ${elapsed.toFixed(2)}ms, found ${results.length} baseline`);
  });

  it('should get single baseline by ID in < 100ms', async () => {
    const targetId = baselineIds[25]!; // Middle baseline
    const startTime = performance.now();

    const result = await getBaselineById(targetId, { baseDir: baselinesDir });

    const elapsed = performance.now() - startTime;

    expect(result).not.toBeNull();
    expect(result?.id).toBe(targetId);
    expect(elapsed).toBeLessThan(100);

    console.log(`Got baseline by ID in ${elapsed.toFixed(2)}ms`);
  });

  it('should get latest baseline in < 100ms', async () => {
    const startTime = performance.now();

    const result = await getLatest({ baseDir: baselinesDir });

    const elapsed = performance.now() - startTime;

    expect(result).not.toBeNull();
    expect(elapsed).toBeLessThan(100);

    console.log(`Got latest baseline in ${elapsed.toFixed(2)}ms`);
  });

  it('should count baselines via query in < 100ms', async () => {
    const startTime = performance.now();

    // Use queryBaselines to count - could be optimized with COUNT(*) query
    const results = await queryBaselines({ baseDir: baselinesDir }, {});
    const count = results.length;

    const elapsed = performance.now() - startTime;

    expect(count).toBe(50);
    expect(elapsed).toBeLessThan(100);

    console.log(`Counted baselines via query in ${elapsed.toFixed(2)}ms`);
  });

  it('should handle date range queries in < 500ms', async () => {
    const startTime = performance.now();

    // Query baselines from the last hour (use 'after' field per BaselineQueryOptions)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const results = await queryBaselines({ baseDir: baselinesDir }, { after: oneHourAgo });

    const elapsed = performance.now() - startTime;

    expect(results.length).toBe(50); // All baselines were created recently
    expect(elapsed).toBeLessThan(500);

    console.log(`Queried by date range in ${elapsed.toFixed(2)}ms, found ${results.length} baselines`);
  });

  it('should handle pagination in < 200ms per page', async () => {
    const pageSize = 10;
    const pageTimes: number[] = [];

    for (let page = 0; page < 5; page++) {
      const startTime = performance.now();

      // BaselineQueryOptions only has 'limit', not 'offset' - test with limit only
      const results = await queryBaselines({ baseDir: baselinesDir }, { limit: pageSize });

      const elapsed = performance.now() - startTime;
      pageTimes.push(elapsed);

      expect(results.length).toBe(pageSize);
      expect(elapsed).toBeLessThan(200);
    }

    const avgTime = pageTimes.reduce((a, b) => a + b, 0) / pageTimes.length;
    console.log(`Paginated queries avg: ${avgTime.toFixed(2)}ms per page`);
  });

  it('should handle concurrent queries efficiently', async () => {
    const startTime = performance.now();

    // Run 10 concurrent queries with different limits
    const queries = Array.from({ length: 10 }, (_, i) =>
      queryBaselines({ baseDir: baselinesDir }, { limit: 10 + i })
    );

    const results = await Promise.all(queries);

    const elapsed = performance.now() - startTime;

    // All queries should return results
    for (const result of results) {
      expect(result.length).toBeGreaterThan(0);
    }

    // Total time for 10 concurrent queries should be < 1 second
    expect(elapsed).toBeLessThan(1000);

    console.log(`10 concurrent queries completed in ${elapsed.toFixed(2)}ms`);
  });
});
