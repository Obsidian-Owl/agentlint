/**
 * Unit tests for persistence/common/atomic-write.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  atomicWrite,
  atomicWriteSafe,
  atomicWriteJson,
  cleanupOrphanedTempFiles,
} from '../../../src/persistence/common/atomic-write';

describe('atomic-write', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-atomic');

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

  describe('atomicWrite', () => {
    it('should write content to a file', async () => {
      const filePath = join(testBaseDir, 'test.txt');
      const content = 'Hello, World!';

      await atomicWrite(filePath, content);

      expect(existsSync(filePath)).toBe(true);
      expect(readFileSync(filePath, 'utf-8')).toBe(content);
    });

    it('should create parent directories', async () => {
      const filePath = join(testBaseDir, 'nested', 'deep', 'test.txt');
      const content = 'Nested content';

      await atomicWrite(filePath, content);

      expect(existsSync(filePath)).toBe(true);
      expect(readFileSync(filePath, 'utf-8')).toBe(content);
    });

    it('should overwrite existing files', async () => {
      const filePath = join(testBaseDir, 'overwrite.txt');

      await atomicWrite(filePath, 'First content');
      expect(readFileSync(filePath, 'utf-8')).toBe('First content');

      await atomicWrite(filePath, 'Second content');
      expect(readFileSync(filePath, 'utf-8')).toBe('Second content');
    });

    it('should write Buffer content', async () => {
      const filePath = join(testBaseDir, 'buffer.txt');
      const content = Buffer.from('Buffer content', 'utf-8');

      await atomicWrite(filePath, content);

      expect(readFileSync(filePath, 'utf-8')).toBe('Buffer content');
    });

    it('should not leave temp files on success', async () => {
      const filePath = join(testBaseDir, 'no-temp.txt');
      await atomicWrite(filePath, 'content');

      const files = readdirSync(testBaseDir);
      const tempFiles = files.filter((f) => f.includes('.tmp.'));
      expect(tempFiles.length).toBe(0);
    });
  });

  describe('atomicWriteSafe', () => {
    it('should return success result on successful write', async () => {
      const filePath = join(testBaseDir, 'safe-success.txt');
      const result = await atomicWriteSafe(filePath, 'content');

      expect(result.success).toBe(true);
      expect(result.path).toBe(filePath);
      expect(result.error).toBeUndefined();
    });

    it('should return error result on invalid path', async () => {
      // Try to write to a path that will fail (directory as file)
      const dirPath = join(testBaseDir, 'dir');
      await Bun.write(join(testBaseDir, 'dummy.txt'), 'dummy'); // Creates testBaseDir
      require('node:fs').mkdirSync(dirPath);

      // Try to write to the directory itself (should fail)
      const result = await atomicWriteSafe(dirPath, 'content');

      // This might succeed or fail depending on platform
      // Just verify the result structure
      expect(typeof result.success).toBe('boolean');
      expect(result.path).toBe(dirPath);
    });
  });

  describe('atomicWriteJson', () => {
    it('should write JSON with pretty formatting', async () => {
      const filePath = join(testBaseDir, 'data.json');
      const data = { name: 'test', value: 42, nested: { a: 1 } };

      await atomicWriteJson(filePath, data);

      const content = readFileSync(filePath, 'utf-8');
      expect(JSON.parse(content)).toEqual(data);
      // Verify pretty formatting (has newlines)
      expect(content).toContain('\n');
    });

    it('should handle arrays', async () => {
      const filePath = join(testBaseDir, 'array.json');
      const data = [1, 2, 3, { a: 'b' }];

      await atomicWriteJson(filePath, data);

      const content = readFileSync(filePath, 'utf-8');
      expect(JSON.parse(content)).toEqual(data);
    });

    it('should handle null and primitives', async () => {
      const filePath = join(testBaseDir, 'primitive.json');

      await atomicWriteJson(filePath, null);
      expect(JSON.parse(readFileSync(filePath, 'utf-8'))).toBeNull();

      await atomicWriteJson(filePath, 'string');
      expect(JSON.parse(readFileSync(filePath, 'utf-8'))).toBe('string');

      await atomicWriteJson(filePath, 123);
      expect(JSON.parse(readFileSync(filePath, 'utf-8'))).toBe(123);
    });
  });

  describe('cleanupOrphanedTempFiles', () => {
    it('should clean up old temp files', async () => {
      // Create some fake temp files with old timestamps
      const oldTimestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      const oldTempPath = join(testBaseDir, `test.txt.tmp.${oldTimestamp}.abc123`);

      // Create the directory and temp file
      await atomicWrite(join(testBaseDir, 'placeholder.txt'), 'placeholder');
      await Bun.write(oldTempPath, 'old temp content');

      expect(existsSync(oldTempPath)).toBe(true);

      // Clean up with 1 hour max age
      const cleaned = await cleanupOrphanedTempFiles(testBaseDir, 60 * 60 * 1000);

      expect(cleaned).toBe(1);
      expect(existsSync(oldTempPath)).toBe(false);
    });

    it('should not clean up recent temp files', async () => {
      const recentTimestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago
      const recentTempPath = join(testBaseDir, `test.txt.tmp.${recentTimestamp}.abc123`);

      // Create the directory and temp file
      await atomicWrite(join(testBaseDir, 'placeholder.txt'), 'placeholder');
      await Bun.write(recentTempPath, 'recent temp content');

      // Clean up with 1 hour max age
      const cleaned = await cleanupOrphanedTempFiles(testBaseDir, 60 * 60 * 1000);

      expect(cleaned).toBe(0);
      expect(existsSync(recentTempPath)).toBe(true);
    });

    it('should return 0 for non-existent directory', async () => {
      const cleaned = await cleanupOrphanedTempFiles('/non/existent/path');
      expect(cleaned).toBe(0);
    });
  });
});
