/**
 * Unit tests for temporal/tools/store-baseline.ts
 *
 * Tests the store_baseline tool for capturing baseline snapshots.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { storeBaselineTool } from '../store-baseline';
import { loadBaseline, listBaselineIds } from '../../../persistence/baselines/storage';

describe('temporal/tools/store-baseline', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-store-baseline');
  const testBaselinesDir = join(testBaseDir, 'baselines');

  // Store original cwd
  const originalCwd = process.cwd();

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
    // Restore cwd if changed
    if (process.cwd() !== originalCwd) {
      process.chdir(originalCwd);
    }
  });

  describe('storeBaselineTool', () => {
    it('should have correct tool name', () => {
      // Access the tool definition to check its name
      // The SDK tool() returns an object with the tool name
      const toolDef = storeBaselineTool as unknown as { name: string };
      expect(toolDef.name).toBe('store_baseline');
    });

    it('should have a description', () => {
      const toolDef = storeBaselineTool as unknown as { description: string };
      expect(toolDef.description).toBeTruthy();
      expect(toolDef.description.length).toBeGreaterThan(50);
    });
  });

  describe('tool handler', () => {
    // The tool handler is internal to the SDK tool definition
    // We need to test it through the exported functions or mock the infrastructure

    it('should be defined', () => {
      expect(storeBaselineTool).toBeDefined();
    });
  });

  describe('integration with persistence layer', () => {
    it('should create baselines directory on first save', async () => {
      // This test verifies the integration pattern works
      // The actual tool handler creates baselines via saveBaseline

      // Simulate what the tool does internally
      const { saveBaseline } = await import('../../../persistence/baselines/storage');
      const { initBaselineSchema, indexBaseline } =
        await import('../../../persistence/baselines/indexer');
      const { v4: uuidv4 } = await import('uuid');

      const baseline = {
        id: uuidv4(),
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        projectPath: process.cwd(),
        actType: 'claude-code',
        configPath: null,
        gitCommit: null,
        metrics: {
          findingsCount: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          infoCount: 0,
        },
        findings: [],
        label: 'test-baseline',
        notes: null,
      };

      const filePath = await saveBaseline(baseline, { baseDir: testBaselinesDir });

      expect(existsSync(filePath)).toBe(true);

      // Index it
      const db = await initBaselineSchema({ baseDir: testBaselinesDir });
      indexBaseline(db, baseline, filePath);
      db.close();

      // Verify it was saved correctly
      const loaded = await loadBaseline(baseline.id, { baseDir: testBaselinesDir });
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(baseline.id);
      expect(loaded?.label).toBe('test-baseline');
    });

    it('should save baseline with label', async () => {
      const { saveBaseline } = await import('../../../persistence/baselines/storage');
      const { v4: uuidv4 } = await import('uuid');

      const baseline = {
        id: uuidv4(),
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        projectPath: process.cwd(),
        actType: 'claude-code',
        configPath: null,
        gitCommit: null,
        metrics: {
          findingsCount: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          infoCount: 0,
        },
        findings: [],
        label: 'Post-CLAUDE.md rewrite',
        notes: 'Baseline after major config restructure',
      };

      await saveBaseline(baseline, { baseDir: testBaselinesDir });

      const loaded = await loadBaseline(baseline.id, { baseDir: testBaselinesDir });
      expect(loaded?.label).toBe('Post-CLAUDE.md rewrite');
      expect(loaded?.notes).toBe('Baseline after major config restructure');
    });

    it('should save baseline without label', async () => {
      const { saveBaseline } = await import('../../../persistence/baselines/storage');
      const { v4: uuidv4 } = await import('uuid');

      const baseline = {
        id: uuidv4(),
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        projectPath: process.cwd(),
        actType: 'claude-code',
        configPath: null,
        gitCommit: null,
        metrics: {
          findingsCount: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          infoCount: 0,
        },
        findings: [],
        label: null,
        notes: null,
      };

      await saveBaseline(baseline, { baseDir: testBaselinesDir });

      const loaded = await loadBaseline(baseline.id, { baseDir: testBaselinesDir });
      expect(loaded?.label).toBeNull();
    });

    it('should list saved baselines', async () => {
      const { saveBaseline } = await import('../../../persistence/baselines/storage');
      const { v4: uuidv4 } = await import('uuid');

      // Save two baselines
      const baseline1 = {
        id: uuidv4(),
        version: '1.0.0',
        createdAt: '2026-01-01T00:00:00.000Z',
        projectPath: process.cwd(),
        actType: 'claude-code',
        configPath: null,
        gitCommit: null,
        metrics: {
          findingsCount: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          infoCount: 0,
        },
        findings: [],
        label: 'first',
        notes: null,
      };

      const baseline2 = {
        id: uuidv4(),
        version: '1.0.0',
        createdAt: '2026-01-02T00:00:00.000Z',
        projectPath: process.cwd(),
        actType: 'claude-code',
        configPath: null,
        gitCommit: null,
        metrics: {
          findingsCount: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          infoCount: 0,
        },
        findings: [],
        label: 'second',
        notes: null,
      };

      await saveBaseline(baseline1, { baseDir: testBaselinesDir });
      await saveBaseline(baseline2, { baseDir: testBaselinesDir });

      const ids = listBaselineIds({ baseDir: testBaselinesDir });
      expect(ids.length).toBe(2);
      expect(ids).toContain(baseline1.id);
      expect(ids).toContain(baseline2.id);
    });
  });
});
