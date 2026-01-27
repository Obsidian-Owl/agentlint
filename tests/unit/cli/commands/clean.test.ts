/**
 * Unit tests for clean command
 *
 * Tests the preview and clean functionality for .agentlint state removal.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { previewClean, executeClean } from '../../../../src/cli/commands/clean';

describe('clean command', () => {
  let testDir: string;
  let agentlintDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'agentlint-clean-test-'));
    agentlintDir = join(testDir, '.agentlint');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('previewClean', () => {
    test('returns nothing-to-clean when .agentlint does not exist', () => {
      const preview = previewClean({ directory: testDir });

      expect(preview.targets.length).toBe(1);
      expect(preview.targets[0]?.exists).toBe(false);
      expect(preview.totalSize).toBe(0);
      expect(preview.totalFiles).toBe(0);
      expect(preview.wouldBackup).toBe(false);
    });

    test('detects existing .agentlint directory', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      const preview = previewClean({ directory: testDir });

      expect(preview.targets.length).toBe(1);
      expect(preview.targets[0]?.exists).toBe(true);
      expect(preview.targets[0]?.type).toBe('project');
      expect(preview.totalFiles).toBe(1);
      expect(preview.totalSize).toBeGreaterThan(0);
      expect(preview.wouldBackup).toBe(true);
    });

    test('includes backup path when wouldBackup is true', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      const preview = previewClean({ directory: testDir });
      const globalBackupsDir = join(homedir(), '.agentlint', 'backups');

      expect(preview.wouldBackup).toBe(true);
      expect(preview.backupPath).toBeDefined();
      expect(preview.backupPath).toMatch(
        new RegExp(
          `^${globalBackupsDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/backup-.*\\.tar\\.gz$`
        )
      );
    });

    test('respects noBackup option', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      const preview = previewClean({ directory: testDir, noBackup: true });

      expect(preview.wouldBackup).toBe(false);
      expect(preview.backupPath).toBeUndefined();
    });

    test('counts files in subdirectories', async () => {
      await mkdir(join(agentlintDir, 'baselines'), { recursive: true });
      await mkdir(join(agentlintDir, 'recommendations'), { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test');
      await writeFile(join(agentlintDir, 'baselines', 'b1.json'), '{}');
      await writeFile(join(agentlintDir, 'recommendations', 'r1.json'), '{}');

      const preview = previewClean({ directory: testDir });

      expect(preview.totalFiles).toBe(3);
      expect(preview.targets[0]?.directories.length).toBe(2);
    });

    test('includes global directory when --global is set', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test');

      const preview = previewClean({ directory: testDir, global: true });

      expect(preview.targets.length).toBe(2);
      expect(preview.targets[0]?.type).toBe('project');
      expect(preview.targets[1]?.type).toBe('global');
    });
  });

  describe('executeClean', () => {
    test('returns nothing-to-clean when directory does not exist', async () => {
      const result = await executeClean({ directory: testDir, force: true, noBackup: true });

      expect(result.status).toBe('nothing-to-clean');
    });

    test('removes .agentlint directory', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      expect(existsSync(agentlintDir)).toBe(true);

      const result = await executeClean({ directory: testDir, force: true, noBackup: true });

      expect(result.status).toBe('success');
      expect(existsSync(agentlintDir)).toBe(false);
      expect(result.cleaned?.length).toBe(1);
      expect(result.cleaned?.[0]?.type).toBe('project');
    });

    test('creates backup before removing when noBackup is false', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await mkdir(join(agentlintDir, 'baselines'), { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      const result = await executeClean({ directory: testDir, force: true });
      const globalBackupsDir = join(homedir(), '.agentlint', 'backups');

      expect(result.status).toBe('success');
      expect(result.backupPath).toBeDefined();
      expect(result.backupPath).toMatch(
        new RegExp(
          `^${globalBackupsDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/backup-.*\\.tar\\.gz$`
        )
      );
      expect(existsSync(agentlintDir)).toBe(false);

      if (result.backupPath && existsSync(result.backupPath)) {
        await rm(result.backupPath, { force: true });
      }
    });

    test('skips backup when noBackup is true', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      const result = await executeClean({ directory: testDir, force: true, noBackup: true });

      expect(result.status).toBe('success');
      expect(result.backupPath).toBeUndefined();
      expect(existsSync(agentlintDir)).toBe(false);
    });

    test('removes nested directories and files', async () => {
      await mkdir(join(agentlintDir, 'baselines'), { recursive: true });
      await mkdir(join(agentlintDir, 'recommendations'), { recursive: true });
      await mkdir(join(agentlintDir, 'sessions'), { recursive: true });
      await writeFile(join(agentlintDir, 'baselines.db'), 'db');
      await writeFile(join(agentlintDir, 'baselines', 'b1.json'), '{}');
      await writeFile(join(agentlintDir, 'recommendations', 'r1.json'), '{}');
      await writeFile(join(agentlintDir, 'sessions', 's1.json'), '{}');

      const result = await executeClean({ directory: testDir, force: true, noBackup: true });

      expect(result.status).toBe('success');
      expect(existsSync(agentlintDir)).toBe(false);
      expect(existsSync(join(agentlintDir, 'baselines'))).toBe(false);
    });
  });

  describe('CleanResult', () => {
    test('includes cleaned targets on success', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      const result = await executeClean({ directory: testDir, force: true, noBackup: true });

      expect(result.status).toBe('success');
      expect(result.cleaned).toBeDefined();
      expect(result.cleaned?.length).toBe(1);
      expect(result.cleaned?.[0]?.path).toBe(agentlintDir);
      expect(result.cleaned?.[0]?.fileCount).toBeGreaterThan(0);
    });

    test('includes preview in result', async () => {
      await mkdir(agentlintDir, { recursive: true });
      await writeFile(join(agentlintDir, 'test.db'), 'test data');

      const result = await executeClean({ directory: testDir, force: true, noBackup: true });

      expect(result.preview).toBeDefined();
      expect(result.preview?.totalFiles).toBeGreaterThan(0);
    });
  });
});
