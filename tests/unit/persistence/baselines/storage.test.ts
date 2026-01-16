/**
 * Unit tests for persistence/baselines/storage.ts
 *
 * Tests baseline file operations: saveBaseline(), loadBaseline(), updateBaseline(), deleteBaseline()
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { Baseline, BaselineFile } from '../../../../src/persistence/types';
import type { Finding } from '../../../../src/orchestration/types';

// Will be implemented in T018
import {
  saveBaseline,
  loadBaseline,
  updateBaseline,
  deleteBaseline,
  getLatestBaseline,
} from '../../../../src/persistence/baselines/storage';

describe('baselines/storage', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-baselines');

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
        title: 'Missing memory_enabled setting',
        description: 'The CLAUDE.md file does not have memory_enabled explicitly set.',
        location: { file: 'CLAUDE.md', line: 10 },
        origin: { type: 'config', reference: 'CLAUDE.md', description: 'Configuration file' },
        recommendations: [
          {
            type: 'preventive',
            action: 'Add memory_enabled: true to CLAUDE.md',
            rationale: 'Enables persistent memory for better context retention.',
            priority: 'high',
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
        description: 'The project description is brief and lacks technical detail.',
        location: { file: 'CLAUDE.md', line: 1 },
        origin: { type: 'config', reference: 'CLAUDE.md', description: 'Configuration file' },
        recommendations: [
          {
            type: 'symptomatic',
            action: 'Expand project description with architecture overview.',
            rationale: 'Better context helps the AI make more informed decisions.',
            priority: 'medium',
          },
        ],
        detectedAt: new Date().toISOString(),
        detectedInPhase: 'config-analysis',
      },
      {
        id: crypto.randomUUID(),
        type: 'improvement',
        severity: 'low',
        title: 'Consider adding coding standards section',
        description: 'Adding explicit coding standards would improve consistency.',
        location: null,
        origin: null,
        recommendations: [
          {
            type: 'systemic',
            action: 'Add a coding standards section to CLAUDE.md',
            rationale: 'Explicit standards reduce variance in generated code.',
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

  describe('saveBaseline', () => {
    it('should save a baseline to a JSON file', async () => {
      const baseline = createTestBaseline();

      const filePath = await saveBaseline(baseline, { baseDir: testBaseDir });

      expect(existsSync(filePath)).toBe(true);
      expect(filePath).toContain(baseline.id);
      expect(filePath).toEndWith('.json');
    });

    it('should create parent directories if they do not exist', async () => {
      const baseline = createTestBaseline();
      const nestedDir = join(testBaseDir, 'nested', 'deep', 'baselines');

      const filePath = await saveBaseline(baseline, { baseDir: nestedDir });

      expect(existsSync(filePath)).toBe(true);
    });

    it('should save baseline with correct file format', async () => {
      const baseline = createTestBaseline();

      const filePath = await saveBaseline(baseline, { baseDir: testBaseDir });

      const content = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content) as BaselineFile;

      expect(parsed.version).toBe('1.0.0');
      expect(parsed.baseline).toEqual(baseline);
    });

    it('should use atomic write by default', async () => {
      const baseline = createTestBaseline();

      await saveBaseline(baseline, { baseDir: testBaseDir });

      // No temp files should remain after successful write
      const files = readdirSync(testBaseDir);
      const tempFiles = files.filter((f) => f.includes('.tmp.'));
      expect(tempFiles.length).toBe(0);
    });

    it('should update latest.json symlink on save', async () => {
      const baseline = createTestBaseline();

      await saveBaseline(baseline, { baseDir: testBaseDir });

      const latestPath = join(testBaseDir, 'latest.json');
      expect(existsSync(latestPath)).toBe(true);

      // Verify the file exists and contains the baseline
      const content = readFileSync(latestPath, 'utf-8');
      const parsed = JSON.parse(content) as BaselineFile;
      expect(parsed.baseline.id).toBe(baseline.id);
    });

    it('should update latest.json when saving a newer baseline', async () => {
      const baseline1 = createTestBaseline({ createdAt: '2026-01-01T00:00:00.000Z' });
      const baseline2 = createTestBaseline({ createdAt: '2026-01-02T00:00:00.000Z' });

      await saveBaseline(baseline1, { baseDir: testBaseDir });
      await saveBaseline(baseline2, { baseDir: testBaseDir });

      const latestPath = join(testBaseDir, 'latest.json');
      const content = readFileSync(latestPath, 'utf-8');
      const parsed = JSON.parse(content) as BaselineFile;
      expect(parsed.baseline.id).toBe(baseline2.id);
    });

    it('should preserve label and notes', async () => {
      const baseline = createTestBaseline({
        label: 'before-refactor',
        notes: 'Baseline taken before major refactoring work.',
      });

      const filePath = await saveBaseline(baseline, { baseDir: testBaseDir });

      const content = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content) as BaselineFile;
      expect(parsed.baseline.label).toBe('before-refactor');
      expect(parsed.baseline.notes).toBe('Baseline taken before major refactoring work.');
    });

    it('should throw on invalid baseline (missing id)', async () => {
      const baseline = createTestBaseline();
      // @ts-expect-error - intentionally invalid
      delete baseline.id;

      await expect(saveBaseline(baseline, { baseDir: testBaseDir })).rejects.toThrow();
    });
  });

  describe('loadBaseline', () => {
    it('should load a baseline by ID', async () => {
      const baseline = createTestBaseline();
      await saveBaseline(baseline, { baseDir: testBaseDir });

      const loaded = await loadBaseline(baseline.id, { baseDir: testBaseDir });

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(baseline.id);
      expect(loaded?.metrics).toEqual(baseline.metrics);
      expect(loaded?.findings.length).toBe(baseline.findings.length);
    });

    it('should return null for non-existent baseline', async () => {
      const loaded = await loadBaseline('non-existent-id', { baseDir: testBaseDir });

      expect(loaded).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      // Create a file with invalid JSON
      const id = crypto.randomUUID();
      const filePath = join(testBaseDir, `${id}.json`);
      await Bun.write(filePath, 'not valid json');

      const loaded = await loadBaseline(id, { baseDir: testBaseDir });

      expect(loaded).toBeNull();
    });

    it('should return null for invalid baseline schema', async () => {
      // Create a file with valid JSON but invalid schema
      const id = crypto.randomUUID();
      const filePath = join(testBaseDir, `${id}.json`);
      await Bun.write(filePath, JSON.stringify({ version: '1.0.0', baseline: { invalid: true } }));

      const loaded = await loadBaseline(id, { baseDir: testBaseDir });

      expect(loaded).toBeNull();
    });

    it('should load baseline with all finding details', async () => {
      const baseline = createTestBaseline();
      await saveBaseline(baseline, { baseDir: testBaseDir });

      const loaded = await loadBaseline(baseline.id, { baseDir: testBaseDir });

      expect(loaded?.findings[0]?.type).toBe('config_gap');
      expect(loaded?.findings[0]?.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('getLatestBaseline', () => {
    it('should return the most recent baseline', async () => {
      const baseline1 = createTestBaseline({ createdAt: '2026-01-01T00:00:00.000Z' });
      const baseline2 = createTestBaseline({ createdAt: '2026-01-02T00:00:00.000Z' });

      await saveBaseline(baseline1, { baseDir: testBaseDir });
      await saveBaseline(baseline2, { baseDir: testBaseDir });

      const latest = await getLatestBaseline({ baseDir: testBaseDir });

      expect(latest).not.toBeNull();
      expect(latest?.id).toBe(baseline2.id);
    });

    it('should return null when no baselines exist', async () => {
      const latest = await getLatestBaseline({ baseDir: testBaseDir });

      expect(latest).toBeNull();
    });

    it('should return null when directory does not exist', async () => {
      const latest = await getLatestBaseline({ baseDir: '/non/existent/path' });

      expect(latest).toBeNull();
    });
  });

  describe('updateBaseline', () => {
    it('should update baseline label', async () => {
      const baseline = createTestBaseline();
      await saveBaseline(baseline, { baseDir: testBaseDir });

      const updated = await updateBaseline(baseline.id, { label: 'new-label' }, { baseDir: testBaseDir });

      expect(updated).toBe(true);

      const loaded = await loadBaseline(baseline.id, { baseDir: testBaseDir });
      expect(loaded?.label).toBe('new-label');
    });

    it('should update baseline notes', async () => {
      const baseline = createTestBaseline();
      await saveBaseline(baseline, { baseDir: testBaseDir });

      const updated = await updateBaseline(baseline.id, { notes: 'Updated notes.' }, { baseDir: testBaseDir });

      expect(updated).toBe(true);

      const loaded = await loadBaseline(baseline.id, { baseDir: testBaseDir });
      expect(loaded?.notes).toBe('Updated notes.');
    });

    it('should update both label and notes', async () => {
      const baseline = createTestBaseline();
      await saveBaseline(baseline, { baseDir: testBaseDir });

      const updated = await updateBaseline(
        baseline.id,
        { label: 'updated-label', notes: 'Updated notes.' },
        { baseDir: testBaseDir }
      );

      expect(updated).toBe(true);

      const loaded = await loadBaseline(baseline.id, { baseDir: testBaseDir });
      expect(loaded?.label).toBe('updated-label');
      expect(loaded?.notes).toBe('Updated notes.');
    });

    it('should return false for non-existent baseline', async () => {
      const updated = await updateBaseline('non-existent-id', { label: 'test' }, { baseDir: testBaseDir });

      expect(updated).toBe(false);
    });

    it('should not modify other baseline properties', async () => {
      const baseline = createTestBaseline();
      const originalMetrics = { ...baseline.metrics };
      await saveBaseline(baseline, { baseDir: testBaseDir });

      await updateBaseline(baseline.id, { label: 'test' }, { baseDir: testBaseDir });

      const loaded = await loadBaseline(baseline.id, { baseDir: testBaseDir });
      expect(loaded?.metrics).toEqual(originalMetrics);
      expect(loaded?.findings.length).toBe(baseline.findings.length);
    });
  });

  describe('deleteBaseline', () => {
    it('should delete a baseline file', async () => {
      const baseline = createTestBaseline();
      const filePath = await saveBaseline(baseline, { baseDir: testBaseDir });

      const deleted = await deleteBaseline(baseline.id, { baseDir: testBaseDir });

      expect(deleted).toBe(true);
      expect(existsSync(filePath)).toBe(false);
    });

    it('should return false for non-existent baseline', async () => {
      const deleted = await deleteBaseline('non-existent-id', { baseDir: testBaseDir });

      expect(deleted).toBe(false);
    });

    it('should update latest.json when deleting the latest baseline', async () => {
      const baseline1 = createTestBaseline({ createdAt: '2026-01-01T00:00:00.000Z' });
      const baseline2 = createTestBaseline({ createdAt: '2026-01-02T00:00:00.000Z' });

      await saveBaseline(baseline1, { baseDir: testBaseDir });
      await saveBaseline(baseline2, { baseDir: testBaseDir });

      // Delete the latest
      await deleteBaseline(baseline2.id, { baseDir: testBaseDir });

      // latest.json should now point to baseline1
      const latest = await getLatestBaseline({ baseDir: testBaseDir });
      expect(latest?.id).toBe(baseline1.id);
    });

    it('should not affect latest.json when deleting non-latest baseline', async () => {
      const baseline1 = createTestBaseline({ createdAt: '2026-01-01T00:00:00.000Z' });
      const baseline2 = createTestBaseline({ createdAt: '2026-01-02T00:00:00.000Z' });

      await saveBaseline(baseline1, { baseDir: testBaseDir });
      await saveBaseline(baseline2, { baseDir: testBaseDir });

      // Delete the older one
      await deleteBaseline(baseline1.id, { baseDir: testBaseDir });

      // latest.json should still point to baseline2
      const latest = await getLatestBaseline({ baseDir: testBaseDir });
      expect(latest?.id).toBe(baseline2.id);
    });
  });
});
