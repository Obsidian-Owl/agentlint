/**
 * Unit tests for persistence/baselines/index.ts
 *
 * Tests SQLite baseline indexing: initSchema(), indexBaseline(), removeIndex(), getIndexedBaselines()
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { Baseline } from '../../../../src/persistence/types';

// Will be implemented in T019
import {
  initBaselineSchema,
  indexBaseline,
  removeIndex,
  getIndexedBaselines,
  getIndexedBaselineById,
  getBaselineDbPath,
} from '../../../../src/persistence/baselines/indexer';

describe('baselines/indexer', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-baseline-index');

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
      findings: [],
      label: null,
      notes: null,
      ...overrides,
    };
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

  describe('initBaselineSchema', () => {
    it('should create the baselines database', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });

      expect(db).toBeDefined();
      const dbPath = getBaselineDbPath(testBaseDir);
      expect(existsSync(dbPath)).toBe(true);

      db.close();
    });

    it('should create the baselines table', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });

      const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='baselines'").get();
      expect(result).toBeTruthy();

      db.close();
    });

    it('should enable WAL mode', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });

      const result = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
      expect(result.journal_mode).toBe('wal');

      db.close();
    });

    it('should create indexes on common query columns', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });

      // Check for createdAt index
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='baselines'")
        .all() as { name: string }[];
      const indexNames = indexes.map((i) => i.name);

      expect(indexNames.some((n) => n.includes('created_at'))).toBe(true);
      expect(indexNames.some((n) => n.includes('label'))).toBe(true);
      expect(indexNames.some((n) => n.includes('git_commit'))).toBe(true);

      db.close();
    });

    it('should set schema version in metadata', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });

      const meta = db.prepare("SELECT value FROM _meta WHERE key = 'schema_version'").get() as { value: string } | null;
      expect(meta?.value).toBe('1.0.0');

      db.close();
    });

    it('should be idempotent (safe to call multiple times)', async () => {
      const db1 = await initBaselineSchema({ baseDir: testBaseDir });
      db1.close();

      // Call again - should not throw
      const db2 = await initBaselineSchema({ baseDir: testBaseDir });
      expect(db2).toBeDefined();

      db2.close();
    });
  });

  describe('indexBaseline', () => {
    it('should add a baseline to the index', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      const baseline = createTestBaseline();

      await indexBaseline(db, baseline);

      const count = db.prepare('SELECT COUNT(*) as count FROM baselines').get() as { count: number };
      expect(count.count).toBe(1);

      db.close();
    });

    it('should store metrics for querying', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      const baseline = createTestBaseline({
        metrics: {
          findingsCount: 10,
          criticalCount: 2,
          highCount: 3,
          mediumCount: 3,
          lowCount: 1,
          infoCount: 1,
        },
      });

      await indexBaseline(db, baseline);

      const row = db.prepare('SELECT findings_count, critical_count, high_count FROM baselines WHERE id = ?').get(baseline.id) as {
        findings_count: number;
        critical_count: number;
        high_count: number;
      };

      expect(row.findings_count).toBe(10);
      expect(row.critical_count).toBe(2);
      expect(row.high_count).toBe(3);

      db.close();
    });

    it('should store label for filtering', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      const baseline = createTestBaseline({ label: 'before-refactor' });

      await indexBaseline(db, baseline);

      const row = db.prepare('SELECT label FROM baselines WHERE id = ?').get(baseline.id) as { label: string };
      expect(row.label).toBe('before-refactor');

      db.close();
    });

    it('should store git commit for filtering', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      const baseline = createTestBaseline({ gitCommit: 'abc123' });

      await indexBaseline(db, baseline);

      const row = db.prepare('SELECT git_commit FROM baselines WHERE id = ?').get(baseline.id) as { git_commit: string };
      expect(row.git_commit).toBe('abc123');

      db.close();
    });

    it('should handle null git commit', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      const baseline = createTestBaseline({ gitCommit: null });

      await indexBaseline(db, baseline);

      const row = db.prepare('SELECT git_commit FROM baselines WHERE id = ?').get(baseline.id) as { git_commit: string | null };
      expect(row.git_commit).toBeNull();

      db.close();
    });

    it('should update existing baseline on re-index', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      const baseline = createTestBaseline({ label: 'original' });

      await indexBaseline(db, baseline);

      // Update label and re-index
      baseline.label = 'updated';
      await indexBaseline(db, baseline);

      const count = db.prepare('SELECT COUNT(*) as count FROM baselines').get() as { count: number };
      expect(count.count).toBe(1);

      const row = db.prepare('SELECT label FROM baselines WHERE id = ?').get(baseline.id) as { label: string };
      expect(row.label).toBe('updated');

      db.close();
    });

    it('should store file path reference', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      const baseline = createTestBaseline();
      const filePath = `/baselines/${baseline.id}.json`;

      await indexBaseline(db, baseline, filePath);

      const row = db.prepare('SELECT file_path FROM baselines WHERE id = ?').get(baseline.id) as { file_path: string };
      expect(row.file_path).toBe(filePath);

      db.close();
    });
  });

  describe('removeIndex', () => {
    it('should remove a baseline from the index', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      const baseline = createTestBaseline();
      await indexBaseline(db, baseline);

      const removed = await removeIndex(db, baseline.id);

      expect(removed).toBe(true);
      const count = db.prepare('SELECT COUNT(*) as count FROM baselines').get() as { count: number };
      expect(count.count).toBe(0);

      db.close();
    });

    it('should return false for non-existent baseline', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });

      const removed = await removeIndex(db, 'non-existent-id');

      expect(removed).toBe(false);

      db.close();
    });
  });

  describe('getIndexedBaselines', () => {
    it('should return all baselines when no options specified', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      const baselines = [
        createTestBaseline({ createdAt: '2026-01-01T00:00:00.000Z' }),
        createTestBaseline({ createdAt: '2026-01-02T00:00:00.000Z' }),
        createTestBaseline({ createdAt: '2026-01-03T00:00:00.000Z' }),
      ];
      for (const b of baselines) {
        await indexBaseline(db, b);
      }

      const results = await getIndexedBaselines(db);

      expect(results.length).toBe(3);

      db.close();
    });

    it('should order by createdAt desc by default', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      const baselines = [
        createTestBaseline({ createdAt: '2026-01-01T00:00:00.000Z' }),
        createTestBaseline({ createdAt: '2026-01-03T00:00:00.000Z' }),
        createTestBaseline({ createdAt: '2026-01-02T00:00:00.000Z' }),
      ];
      for (const b of baselines) {
        await indexBaseline(db, b);
      }

      const results = await getIndexedBaselines(db);

      expect(results[0]?.createdAt).toBe('2026-01-03T00:00:00.000Z');
      expect(results[1]?.createdAt).toBe('2026-01-02T00:00:00.000Z');
      expect(results[2]?.createdAt).toBe('2026-01-01T00:00:00.000Z');

      db.close();
    });

    it('should limit results', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      for (let i = 0; i < 10; i++) {
        await indexBaseline(db, createTestBaseline());
      }

      const results = await getIndexedBaselines(db, { limit: 5 });

      expect(results.length).toBe(5);

      db.close();
    });

    it('should filter by label', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      await indexBaseline(db, createTestBaseline({ label: 'release-1.0' }));
      await indexBaseline(db, createTestBaseline({ label: 'release-2.0' }));
      await indexBaseline(db, createTestBaseline({ label: null }));

      const results = await getIndexedBaselines(db, { label: 'release-1.0' });

      expect(results.length).toBe(1);
      expect(results[0]?.label).toBe('release-1.0');

      db.close();
    });

    it('should filter by date range (after)', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      await indexBaseline(db, createTestBaseline({ createdAt: '2026-01-01T00:00:00.000Z' }));
      await indexBaseline(db, createTestBaseline({ createdAt: '2026-01-15T00:00:00.000Z' }));
      await indexBaseline(db, createTestBaseline({ createdAt: '2026-01-20T00:00:00.000Z' }));

      const results = await getIndexedBaselines(db, { after: '2026-01-10T00:00:00.000Z' });

      expect(results.length).toBe(2);

      db.close();
    });

    it('should filter by date range (before)', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      await indexBaseline(db, createTestBaseline({ createdAt: '2026-01-01T00:00:00.000Z' }));
      await indexBaseline(db, createTestBaseline({ createdAt: '2026-01-15T00:00:00.000Z' }));
      await indexBaseline(db, createTestBaseline({ createdAt: '2026-01-20T00:00:00.000Z' }));

      const results = await getIndexedBaselines(db, { before: '2026-01-16T00:00:00.000Z' });

      expect(results.length).toBe(2);

      db.close();
    });

    it('should filter by git commit', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      await indexBaseline(db, createTestBaseline({ gitCommit: 'abc123' }));
      await indexBaseline(db, createTestBaseline({ gitCommit: 'def456' }));
      await indexBaseline(db, createTestBaseline({ gitCommit: null }));

      const results = await getIndexedBaselines(db, { gitCommit: 'abc123' });

      expect(results.length).toBe(1);
      expect(results[0]?.gitCommit).toBe('abc123');

      db.close();
    });

    it('should order by findingsCount', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      await indexBaseline(
        db,
        createTestBaseline({
          metrics: { findingsCount: 5, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, infoCount: 0 },
        })
      );
      await indexBaseline(
        db,
        createTestBaseline({
          metrics: { findingsCount: 10, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, infoCount: 0 },
        })
      );
      await indexBaseline(
        db,
        createTestBaseline({
          metrics: { findingsCount: 3, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, infoCount: 0 },
        })
      );

      const results = await getIndexedBaselines(db, { orderBy: 'findingsCount', order: 'desc' });

      expect(results[0]?.metrics.findingsCount).toBe(10);
      expect(results[1]?.metrics.findingsCount).toBe(5);
      expect(results[2]?.metrics.findingsCount).toBe(3);

      db.close();
    });

    it('should support ascending order', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      await indexBaseline(db, createTestBaseline({ createdAt: '2026-01-03T00:00:00.000Z' }));
      await indexBaseline(db, createTestBaseline({ createdAt: '2026-01-01T00:00:00.000Z' }));
      await indexBaseline(db, createTestBaseline({ createdAt: '2026-01-02T00:00:00.000Z' }));

      const results = await getIndexedBaselines(db, { orderBy: 'createdAt', order: 'asc' });

      expect(results[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(results[2]?.createdAt).toBe('2026-01-03T00:00:00.000Z');

      db.close();
    });

    it('should return BaselineSummary without findings', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      await indexBaseline(db, createTestBaseline());

      const results = await getIndexedBaselines(db);

      expect(results[0]).toBeDefined();
      expect(results[0]?.id).toBeDefined();
      expect(results[0]?.metrics).toBeDefined();
      // BaselineSummary does not have findings
      expect((results[0] as unknown as { findings: unknown[] }).findings).toBeUndefined();

      db.close();
    });
  });

  describe('getIndexedBaselineById', () => {
    it('should return a single baseline summary', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      const baseline = createTestBaseline();
      await indexBaseline(db, baseline);

      const result = await getIndexedBaselineById(db, baseline.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(baseline.id);
      expect(result?.metrics).toEqual(baseline.metrics);

      db.close();
    });

    it('should return null for non-existent baseline', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });

      const result = await getIndexedBaselineById(db, 'non-existent-id');

      expect(result).toBeNull();

      db.close();
    });

    it('should include file path if stored', async () => {
      const db = await initBaselineSchema({ baseDir: testBaseDir });
      const baseline = createTestBaseline();
      const filePath = `/baselines/${baseline.id}.json`;
      await indexBaseline(db, baseline, filePath);

      const result = await getIndexedBaselineById(db, baseline.id);

      expect((result as unknown as { filePath: string }).filePath).toBe(filePath);

      db.close();
    });
  });
});
