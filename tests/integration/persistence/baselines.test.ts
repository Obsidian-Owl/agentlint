/**
 * Integration tests for baseline persistence
 *
 * Tests the full flow: save → index → query → load → update → delete
 * Uses real filesystem and SQLite, not mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { Baseline } from '../../../src/persistence/types';
import type { Finding } from '../../../src/orchestration/types';

// Full public API
import {
  saveBaseline,
  loadBaseline,
  updateBaseline,
  deleteBaseline,
  getLatestBaseline,
} from '../../../src/persistence/baselines/storage';

import {
  queryBaselines,
  compareBaselines,
  getBaselineHistory,
} from '../../../src/persistence/baselines/queries';

describe('Baseline Persistence Integration', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-integration-baselines');

  // Helper to create a realistic baseline
  function createRealisticBaseline(overrides: Partial<Baseline> = {}): Baseline {
    return {
      id: crypto.randomUUID(),
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      projectPath: '/home/user/my-project',
      actType: 'claude-code',
      configPath: '/home/user/my-project/CLAUDE.md',
      gitCommit: crypto.randomUUID().slice(0, 7),
      metrics: {
        findingsCount: 5,
        criticalCount: 0,
        highCount: 2,
        mediumCount: 2,
        lowCount: 1,
        infoCount: 0,
      },
      findings: createRealisticFindings(),
      label: null,
      notes: null,
      ...overrides,
    };
  }

  function createRealisticFindings(): Finding[] {
    return [
      {
        id: crypto.randomUUID(),
        type: 'config_gap',
        severity: 'high',
        title: 'Missing permissions configuration',
        description:
          'The CLAUDE.md file does not specify file system permissions, which may lead to unexpected behavior when the agent attempts file operations.',
        location: {
          file: 'CLAUDE.md',
          line: 15,
          snippet: '## Project Structure\n\nThis is a TypeScript project...',
        },
        origin: {
          type: 'config',
          reference: 'CLAUDE.md',
          description: 'Configuration file analysis',
        },
        recommendations: [
          {
            type: 'preventive',
            action: 'Add a permissions section to CLAUDE.md specifying allowed file operations',
            rationale: 'Explicit permissions prevent accidental file modifications outside project scope.',
            priority: 'high',
          },
        ],
        detectedAt: new Date().toISOString(),
        detectedInPhase: 'config-analysis',
      },
      {
        id: crypto.randomUUID(),
        type: 'config_antipattern',
        severity: 'high',
        title: 'Overly permissive glob pattern',
        description: 'The allow_edit pattern "**/*" grants edit access to all files, including sensitive configurations.',
        location: {
          file: 'CLAUDE.md',
          line: 42,
          snippet: 'allow_edit: **/*',
        },
        origin: {
          type: 'config',
          reference: 'CLAUDE.md:42',
          description: 'Security configuration review',
        },
        recommendations: [
          {
            type: 'symptomatic',
            action: 'Restrict allow_edit to specific directories: src/**, tests/**',
            rationale: 'Limits potential damage from unintended edits.',
            priority: 'high',
          },
          {
            type: 'preventive',
            action: 'Add explicit deny patterns for sensitive files: !.env, !**/*.key',
            rationale: 'Defense in depth protects credentials even if allow pattern is too broad.',
            priority: 'medium',
          },
        ],
        detectedAt: new Date().toISOString(),
        detectedInPhase: 'config-analysis',
      },
      {
        id: crypto.randomUUID(),
        type: 'quality_issue',
        severity: 'medium',
        title: 'Incomplete project description',
        description: 'The project description lacks technical context about the architecture and dependencies.',
        location: {
          file: 'CLAUDE.md',
          line: 1,
        },
        origin: {
          type: 'config',
          reference: 'CLAUDE.md',
          description: 'Quality assessment',
        },
        recommendations: [
          {
            type: 'symptomatic',
            action: 'Expand project description with technology stack and architecture overview',
            rationale: 'Better context leads to more relevant code generation.',
            priority: 'medium',
            effort: 'small',
          },
        ],
        detectedAt: new Date().toISOString(),
        detectedInPhase: 'quality-analysis',
      },
      {
        id: crypto.randomUUID(),
        type: 'improvement',
        severity: 'medium',
        title: 'No coding standards defined',
        description: 'The configuration does not specify coding standards or style preferences.',
        location: null,
        origin: null,
        recommendations: [
          {
            type: 'systemic',
            action: 'Add a coding standards section referencing your ESLint/Prettier config',
            rationale: 'Consistent code style reduces review friction and improves maintainability.',
            priority: 'medium',
            effort: 'trivial',
          },
        ],
        detectedAt: new Date().toISOString(),
        detectedInPhase: 'quality-analysis',
      },
      {
        id: crypto.randomUUID(),
        type: 'improvement',
        severity: 'low',
        title: 'Consider adding example prompts',
        description: 'Example prompts can help users understand how to interact with the agent effectively.',
        location: null,
        origin: null,
        recommendations: [
          {
            type: 'systemic',
            action: 'Add 2-3 example prompts showing common workflows',
            rationale: 'Examples reduce learning curve for new team members.',
            priority: 'low',
            effort: 'small',
          },
        ],
        detectedAt: new Date().toISOString(),
        detectedInPhase: 'quality-analysis',
      },
    ];
  }

  beforeEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  describe('Full Baseline Lifecycle', () => {
    it('should save, query, load, update, and delete a baseline', async () => {
      // 1. Save a baseline
      const baseline = createRealisticBaseline({ label: 'v1.0.0' });
      const filePath = await saveBaseline(baseline, { baseDir: testBaseDir });

      expect(existsSync(filePath)).toBe(true);

      // 2. Query should find it
      const queryResults = await queryBaselines({ baseDir: testBaseDir });
      expect(queryResults.length).toBe(1);
      expect(queryResults[0]?.id).toBe(baseline.id);
      expect(queryResults[0]?.label).toBe('v1.0.0');

      // 3. Load full baseline by ID
      const loaded = await loadBaseline(baseline.id, { baseDir: testBaseDir });
      expect(loaded).not.toBeNull();
      expect(loaded?.findings.length).toBe(5);
      expect(loaded?.findings[0]?.recommendations.length).toBeGreaterThan(0);

      // 4. Update label and notes
      const updated = await updateBaseline(baseline.id, { label: 'v1.0.1', notes: 'Minor update' }, { baseDir: testBaseDir });
      expect(updated).toBe(true);

      const reloaded = await loadBaseline(baseline.id, { baseDir: testBaseDir });
      expect(reloaded?.label).toBe('v1.0.1');
      expect(reloaded?.notes).toBe('Minor update');

      // 5. Delete baseline
      const deleted = await deleteBaseline(baseline.id, { baseDir: testBaseDir });
      expect(deleted).toBe(true);

      const afterDelete = await loadBaseline(baseline.id, { baseDir: testBaseDir });
      expect(afterDelete).toBeNull();

      // Query should return empty
      const finalQuery = await queryBaselines({ baseDir: testBaseDir });
      expect(finalQuery.length).toBe(0);
    });

    it('should maintain latest.json across multiple saves', async () => {
      const baselines = [
        createRealisticBaseline({ createdAt: '2026-01-01T00:00:00.000Z' }),
        createRealisticBaseline({ createdAt: '2026-01-02T00:00:00.000Z' }),
        createRealisticBaseline({ createdAt: '2026-01-03T00:00:00.000Z' }),
      ];

      for (const b of baselines) {
        await saveBaseline(b, { baseDir: testBaseDir });
      }

      // Latest should be the most recent
      const latest = await getLatestBaseline({ baseDir: testBaseDir });
      expect(latest?.id).toBe(baselines[2]?.id);
      expect(latest?.createdAt).toBe('2026-01-03T00:00:00.000Z');
    });
  });

  describe('Query Functionality', () => {
    it('should filter by multiple criteria', async () => {
      await saveBaseline(
        createRealisticBaseline({
          createdAt: '2026-01-01T00:00:00.000Z',
          label: 'release',
          gitCommit: 'abc1234',
        }),
        { baseDir: testBaseDir }
      );
      await saveBaseline(
        createRealisticBaseline({
          createdAt: '2026-01-15T00:00:00.000Z',
          label: 'release',
          gitCommit: 'def5678',
        }),
        { baseDir: testBaseDir }
      );
      await saveBaseline(
        createRealisticBaseline({
          createdAt: '2026-01-20T00:00:00.000Z',
          label: 'dev',
          gitCommit: 'ghi9012',
        }),
        { baseDir: testBaseDir }
      );

      // Filter by label
      const releases = await queryBaselines({ baseDir: testBaseDir }, { label: 'release' });
      expect(releases.length).toBe(2);

      // Filter by date range
      const midMonth = await queryBaselines(
        { baseDir: testBaseDir },
        { after: '2026-01-10T00:00:00.000Z', before: '2026-01-18T00:00:00.000Z' }
      );
      expect(midMonth.length).toBe(1);
      expect(midMonth[0]?.createdAt).toBe('2026-01-15T00:00:00.000Z');

      // Filter by git commit
      const byCommit = await queryBaselines({ baseDir: testBaseDir }, { gitCommit: 'abc1234' });
      expect(byCommit.length).toBe(1);
    });

    it('should paginate results', async () => {
      // Create 25 baselines
      for (let i = 0; i < 25; i++) {
        await saveBaseline(
          createRealisticBaseline({
            createdAt: new Date(2026, 0, i + 1).toISOString(),
          }),
          { baseDir: testBaseDir }
        );
      }

      // Get first page
      const page1 = await queryBaselines({ baseDir: testBaseDir }, { limit: 10, orderBy: 'createdAt', order: 'asc' });
      expect(page1.length).toBe(10);

      // All baselines
      const all = await queryBaselines({ baseDir: testBaseDir });
      expect(all.length).toBe(25);
    });
  });

  describe('Baseline Comparison', () => {
    it('should compare two baselines and calculate delta', async () => {
      const before = createRealisticBaseline({
        metrics: {
          findingsCount: 10,
          criticalCount: 2,
          highCount: 3,
          mediumCount: 3,
          lowCount: 1,
          infoCount: 1,
        },
      });
      const after = createRealisticBaseline({
        metrics: {
          findingsCount: 6,
          criticalCount: 0,
          highCount: 2,
          mediumCount: 2,
          lowCount: 1,
          infoCount: 1,
        },
      });

      await saveBaseline(before, { baseDir: testBaseDir });
      await saveBaseline(after, { baseDir: testBaseDir });

      const comparison = await compareBaselines(before.id, after.id, { baseDir: testBaseDir });

      expect(comparison).not.toBeNull();
      expect(comparison?.delta.findingsCount).toBe(-4); // Improved by 4
      expect(comparison?.delta.criticalCount).toBe(-2); // Eliminated 2 critical
      expect(comparison?.trend).toBe('improved');
    });

    it('should detect regression', async () => {
      const baseline1 = createRealisticBaseline({
        metrics: { findingsCount: 5, criticalCount: 0, highCount: 1, mediumCount: 2, lowCount: 1, infoCount: 1 },
      });
      const baseline2 = createRealisticBaseline({
        metrics: { findingsCount: 12, criticalCount: 3, highCount: 4, mediumCount: 3, lowCount: 1, infoCount: 1 },
      });

      await saveBaseline(baseline1, { baseDir: testBaseDir });
      await saveBaseline(baseline2, { baseDir: testBaseDir });

      const comparison = await compareBaselines(baseline1.id, baseline2.id, { baseDir: testBaseDir });

      expect(comparison?.trend).toBe('regressed');
      expect(comparison?.delta.criticalCount).toBe(3); // Added 3 critical
    });
  });

  describe('History Tracking', () => {
    it('should retrieve baseline history in chronological order', async () => {
      const dates = ['2026-01-15', '2026-01-01', '2026-01-08', '2026-01-22'];
      for (const date of dates) {
        await saveBaseline(createRealisticBaseline({ createdAt: `${date}T00:00:00.000Z` }), { baseDir: testBaseDir });
      }

      const history = await getBaselineHistory({ baseDir: testBaseDir });

      expect(history.length).toBe(4);
      expect(history[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(history[1]?.createdAt).toBe('2026-01-08T00:00:00.000Z');
      expect(history[2]?.createdAt).toBe('2026-01-15T00:00:00.000Z');
      expect(history[3]?.createdAt).toBe('2026-01-22T00:00:00.000Z');
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted JSON gracefully', async () => {
      const baseline = createRealisticBaseline();
      await saveBaseline(baseline, { baseDir: testBaseDir });

      // Corrupt the file
      const corruptedPath = join(testBaseDir, `${baseline.id}.json`);
      await Bun.write(corruptedPath, 'not valid json {{{');

      // Load should return null, not throw
      const loaded = await loadBaseline(baseline.id, { baseDir: testBaseDir });
      expect(loaded).toBeNull();
    });

    it('should handle missing directory gracefully', async () => {
      const results = await queryBaselines({ baseDir: '/non/existent/path' });
      expect(results).toEqual([]);

      const latest = await getLatestBaseline({ baseDir: '/non/existent/path' });
      expect(latest).toBeNull();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent saves without data loss', async () => {
      const baselines = Array.from({ length: 10 }, () => createRealisticBaseline());

      // Save all concurrently
      await Promise.all(baselines.map((b) => saveBaseline(b, { baseDir: testBaseDir })));

      // All should be queryable
      const results = await queryBaselines({ baseDir: testBaseDir });
      expect(results.length).toBe(10);

      // All IDs should be present
      const savedIds = new Set(results.map((r) => r.id));
      for (const b of baselines) {
        expect(savedIds.has(b.id)).toBe(true);
      }
    });
  });

  describe('Data Integrity', () => {
    it('should preserve all finding details through save/load cycle', async () => {
      const baseline = createRealisticBaseline();
      await saveBaseline(baseline, { baseDir: testBaseDir });

      const loaded = await loadBaseline(baseline.id, { baseDir: testBaseDir });

      expect(loaded?.findings.length).toBe(baseline.findings.length);

      for (let i = 0; i < baseline.findings.length; i++) {
        const original = baseline.findings[i];
        const restored = loaded?.findings[i];

        expect(restored?.id).toBe(original?.id);
        expect(restored?.type).toBe(original?.type);
        expect(restored?.severity).toBe(original?.severity);
        expect(restored?.title).toBe(original?.title);
        expect(restored?.description).toBe(original?.description);
        expect(restored?.location).toEqual(original?.location);
        expect(restored?.origin).toEqual(original?.origin);
        expect(restored?.recommendations).toEqual(original?.recommendations);
      }
    });

    it('should preserve metrics accurately', async () => {
      const baseline = createRealisticBaseline({
        metrics: {
          findingsCount: 42,
          criticalCount: 5,
          highCount: 10,
          mediumCount: 15,
          lowCount: 8,
          infoCount: 4,
        },
      });
      await saveBaseline(baseline, { baseDir: testBaseDir });

      const loaded = await loadBaseline(baseline.id, { baseDir: testBaseDir });

      expect(loaded?.metrics).toEqual(baseline.metrics);
    });
  });
});
