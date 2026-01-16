/**
 * Unit tests for persistence/common/directories.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

import {
  ensureDir,
  ensureDirSync,
  getProjectDir,
  getGlobalDir,
  getBaselinesDir,
  getBaselinesDbPath,
  getSessionsDir,
  getProjectLearningsDir,
  getProjectLearningsDbPath,
  getGlobalLearningsDir,
  getGlobalLearningsDbPath,
  expandTilde,
} from '../../../src/persistence/common/directories';

describe('directories', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-dirs');

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

  describe('ensureDir', () => {
    it('should create a directory that does not exist', async () => {
      const testDir = join(testBaseDir, 'new-dir');
      expect(existsSync(testDir)).toBe(false);

      await ensureDir(testDir);

      expect(existsSync(testDir)).toBe(true);
    });

    it('should create nested directories recursively', async () => {
      const testDir = join(testBaseDir, 'a', 'b', 'c', 'd');
      expect(existsSync(testDir)).toBe(false);

      await ensureDir(testDir);

      expect(existsSync(testDir)).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      const testDir = join(testBaseDir, 'existing');
      await ensureDir(testDir);
      expect(existsSync(testDir)).toBe(true);

      // Should not throw
      await ensureDir(testDir);
      expect(existsSync(testDir)).toBe(true);
    });

    it('should create directory with default mode 0700', async () => {
      const testDir = join(testBaseDir, 'mode-test');
      await ensureDir(testDir);

      const stats = statSync(testDir);
      // Check that owner has rwx (0700 = 448 in decimal)
      // Note: mode includes file type bits, so we mask with 0o777
      expect(stats.mode & 0o777).toBe(0o700);
    });

    it('should create directory with custom mode', async () => {
      const testDir = join(testBaseDir, 'custom-mode');
      await ensureDir(testDir, 0o755);

      const stats = statSync(testDir);
      expect(stats.mode & 0o777).toBe(0o755);
    });
  });

  describe('ensureDirSync', () => {
    it('should create a directory synchronously', () => {
      const testDir = join(testBaseDir, 'sync-dir');
      expect(existsSync(testDir)).toBe(false);

      ensureDirSync(testDir);

      expect(existsSync(testDir)).toBe(true);
    });

    it('should create nested directories recursively', () => {
      const testDir = join(testBaseDir, 'sync', 'nested', 'dir');
      expect(existsSync(testDir)).toBe(false);

      ensureDirSync(testDir);

      expect(existsSync(testDir)).toBe(true);
    });

    it('should not fail if directory already exists', () => {
      const testDir = join(testBaseDir, 'sync-existing');
      ensureDirSync(testDir);
      expect(existsSync(testDir)).toBe(true);

      // Should not throw
      ensureDirSync(testDir);
      expect(existsSync(testDir)).toBe(true);
    });
  });

  describe('path helpers', () => {
    it('getProjectDir should return .agentlint in project path', () => {
      const projectPath = '/home/user/my-project';
      expect(getProjectDir(projectPath)).toBe('/home/user/my-project/.agentlint');
    });

    it('getProjectDir should use cwd by default', () => {
      const result = getProjectDir();
      expect(result).toBe(join(process.cwd(), '.agentlint'));
    });

    it('getGlobalDir should return ~/.agentlint', () => {
      expect(getGlobalDir()).toBe(join(homedir(), '.agentlint'));
    });

    it('getBaselinesDir should return baselines subdirectory', () => {
      const projectPath = '/home/user/project';
      expect(getBaselinesDir(projectPath)).toBe('/home/user/project/.agentlint/baselines');
    });

    it('getBaselinesDbPath should return baselines.db path', () => {
      const projectPath = '/home/user/project';
      expect(getBaselinesDbPath(projectPath)).toBe('/home/user/project/.agentlint/baselines.db');
    });

    it('getSessionsDir should return sessions subdirectory', () => {
      const projectPath = '/home/user/project';
      expect(getSessionsDir(projectPath)).toBe('/home/user/project/.agentlint/sessions');
    });

    it('getProjectLearningsDir should return project learnings path', () => {
      const projectPath = '/home/user/project';
      expect(getProjectLearningsDir(projectPath)).toBe('/home/user/project/.agentlint/learnings');
    });

    it('getProjectLearningsDbPath should return project learnings.db path', () => {
      const projectPath = '/home/user/project';
      expect(getProjectLearningsDbPath(projectPath)).toBe('/home/user/project/.agentlint/learnings.db');
    });

    it('getGlobalLearningsDir should return global learnings path', () => {
      expect(getGlobalLearningsDir()).toBe(join(homedir(), '.agentlint', 'learnings'));
    });

    it('getGlobalLearningsDbPath should return global learnings.db path', () => {
      expect(getGlobalLearningsDbPath()).toBe(join(homedir(), '.agentlint', 'learnings.db'));
    });
  });

  describe('expandTilde', () => {
    it('should expand ~ to home directory', () => {
      expect(expandTilde('~')).toBe(homedir());
    });

    it('should expand ~/ paths', () => {
      expect(expandTilde('~/some/path')).toBe(join(homedir(), 'some/path'));
    });

    it('should not modify paths without tilde', () => {
      expect(expandTilde('/absolute/path')).toBe('/absolute/path');
      expect(expandTilde('relative/path')).toBe('relative/path');
    });

    it('should not expand tilde in the middle of path', () => {
      expect(expandTilde('/path/with/~/tilde')).toBe('/path/with/~/tilde');
    });
  });
});
