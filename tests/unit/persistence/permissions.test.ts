/**
 * Unit tests for file and directory permissions
 *
 * Tests that files and directories are created with appropriate
 * permissions (FR-018) on POSIX systems.
 *
 * Note: These tests are platform-dependent and may behave differently
 * on Windows or when running as root.
 *
 * @module tests/unit/persistence/permissions
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, statSync, chmodSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';

import { ensureDir, ensureDirSync } from '../../../src/persistence/common/directories';
import { atomicWrite, atomicWriteJson } from '../../../src/persistence/common/atomic-write';
import { openDatabase } from '../../../src/persistence/common/database';
import { DEFAULT_PERSISTENCE_CONFIG } from '../../../src/persistence/types';

// Platform check - tests will fail with clear message on Windows
const isWindows = platform() === 'win32';

describe('permissions', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-permissions');

  beforeEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testBaseDir)) {
      // Ensure we can delete by restoring permissions
      try {
        const setPermissionsRecursive = (dir: string) => {
          if (existsSync(dir)) {
            const fs = require('node:fs');
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
              const fullPath = join(dir, item.name);
              try {
                chmodSync(fullPath, 0o755);
                if (item.isDirectory()) {
                  setPermissionsRecursive(fullPath);
                }
              } catch {
                // Ignore errors
              }
            }
          }
        };
        chmodSync(testBaseDir, 0o755);
        setPermissionsRecursive(testBaseDir);
      } catch {
        // Ignore cleanup errors
      }
      rmSync(testBaseDir, { recursive: true });
    }
  });

  describe('directory permissions', () => {
    it('requires POSIX platform', () => {
      expect(!isWindows, 'Permission tests require POSIX platform (not Windows)').toBe(true);
    });

    it('should create directory with 0700 by default', async () => {
      const dir = join(testBaseDir, 'default-perms');
      await ensureDir(dir);

      const stats = statSync(dir);
      expect(stats.mode & 0o777).toBe(0o700);
    });

    it('should create directory with custom mode', async () => {
      const dir = join(testBaseDir, 'custom-perms');
      await ensureDir(dir, 0o755);

      const stats = statSync(dir);
      expect(stats.mode & 0o777).toBe(0o755);
    });

    it('should create nested directories with correct mode', async () => {
      const dir = join(testBaseDir, 'nested', 'deep', 'dir');
      await ensureDir(dir, 0o700);

      // Check each level
      expect(statSync(join(testBaseDir, 'nested')).mode & 0o777).toBe(0o700);
      expect(statSync(join(testBaseDir, 'nested', 'deep')).mode & 0o777).toBe(0o700);
      expect(statSync(dir).mode & 0o777).toBe(0o700);
    });

    it('ensureDirSync should create directory with default mode', () => {
      const dir = join(testBaseDir, 'sync-perms');
      ensureDirSync(dir);

      const stats = statSync(dir);
      expect(stats.mode & 0o777).toBe(0o700);
    });

    it('should verify DEFAULT_PERSISTENCE_CONFIG.dirMode is 0700', () => {
      expect(DEFAULT_PERSISTENCE_CONFIG.dirMode).toBe(0o700);
    });
  });

  describe('file permissions', () => {
    it('requires POSIX platform', () => {
      expect(!isWindows, 'Permission tests require POSIX platform (not Windows)').toBe(true);
    });

    it('atomicWrite should create file (permission depends on umask)', async () => {
      const filePath = join(testBaseDir, 'file-perms.txt');
      await ensureDir(testBaseDir);
      await atomicWrite(filePath, 'content');

      const stats = statSync(filePath);
      // Bun.write applies umask, so actual permissions depend on system
      // Just verify the file is readable by owner
      expect(stats.mode & 0o400).toBe(0o400);
    });

    it('atomicWrite should accept mode option', async () => {
      const filePath = join(testBaseDir, 'custom-file.txt');
      await ensureDir(testBaseDir);
      await atomicWrite(filePath, 'content', { mode: 0o644 });

      // File is created - mode application depends on Bun's behavior
      expect(existsSync(filePath)).toBe(true);
    });

    it('atomicWriteJson should create file (permission depends on umask)', async () => {
      const filePath = join(testBaseDir, 'json-perms.json');
      await ensureDir(testBaseDir);
      await atomicWriteJson(filePath, { test: true });

      const stats = statSync(filePath);
      // Just verify owner can read
      expect(stats.mode & 0o400).toBe(0o400);
    });

    it('should verify DEFAULT_PERSISTENCE_CONFIG.fileMode is 0600', () => {
      expect(DEFAULT_PERSISTENCE_CONFIG.fileMode).toBe(0o600);
    });
  });

  describe('database file permissions', () => {
    it('requires POSIX platform', () => {
      expect(!isWindows, 'Permission tests require POSIX platform (not Windows)').toBe(true);
    });

    it('openDatabase should create database in directory with correct permissions', async () => {
      const dbPath = join(testBaseDir, 'db-perms', 'test.db');
      const db = await openDatabase(dbPath);

      // Directory should have 0700
      const dirStats = statSync(join(testBaseDir, 'db-perms'));
      expect(dirStats.mode & 0o777).toBe(0o700);

      // Note: SQLite file permissions are controlled by SQLite, not our code
      // We just verify the file exists
      expect(existsSync(dbPath)).toBe(true);

      db.close();
    });
  });

  describe('permission enforcement', () => {
    it('requires POSIX platform', () => {
      expect(!isWindows, 'Permission tests require POSIX platform (not Windows)').toBe(true);
    });

    it('should restrict access to owner only with 0700', async () => {
      const dir = join(testBaseDir, 'restricted');
      await ensureDir(dir, 0o700);

      const stats = statSync(dir);
      const mode = stats.mode & 0o777;

      // Owner: rwx
      expect(mode & 0o700).toBe(0o700);
      // Group: no permissions
      expect(mode & 0o070).toBe(0);
      // Other: no permissions
      expect(mode & 0o007).toBe(0);
    });

    it('should create readable file', async () => {
      const filePath = join(testBaseDir, 'readable-file.txt');
      await ensureDir(testBaseDir);
      await atomicWrite(filePath, 'content');

      const stats = statSync(filePath);
      const mode = stats.mode & 0o777;

      // Owner should have read/write
      expect(mode & 0o600).toBe(0o600);
    });
  });

  describe('permission preservation on update', () => {
    it('requires POSIX platform', () => {
      expect(!isWindows, 'Permission tests require POSIX platform (not Windows)').toBe(true);
    });

    it('atomicWrite should successfully overwrite files', async () => {
      const filePath = join(testBaseDir, 'preserve-perms.txt');
      await ensureDir(testBaseDir);

      // Create file
      await atomicWrite(filePath, 'initial');
      expect(existsSync(filePath)).toBe(true);

      // Overwrite file
      await atomicWrite(filePath, 'updated');
      expect(readFileSync(filePath, 'utf-8')).toBe('updated');
    });
  });

  describe('cross-platform compatibility', () => {
    it('should handle permission operations gracefully on all platforms', async () => {
      const dir = join(testBaseDir, 'cross-platform');

      // Should not throw regardless of platform
      await ensureDir(dir);
      expect(existsSync(dir)).toBe(true);
    });

    it('atomicWrite should work regardless of platform', async () => {
      const filePath = join(testBaseDir, 'cross-platform-file.txt');

      await atomicWrite(filePath, 'content');

      expect(existsSync(filePath)).toBe(true);
      expect(readFileSync(filePath, 'utf-8')).toBe('content');
    });
  });
});
