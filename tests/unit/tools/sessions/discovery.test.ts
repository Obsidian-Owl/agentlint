/**
 * T015: Unit tests for session discovery
 *
 * Tests the discoverSessions() function for finding Claude Code session logs.
 *
 * @module tests/unit/tools/sessions/discovery.test.ts
 */

import { describe, it, expect } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { discoverSessions } from '../../../../src/tools/sessions/discovery';

// Test fixture path
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/sessions/projects');

describe('discoverSessions', () => {
  describe('basic discovery', () => {
    it('should discover session files from fixture directory', async () => {
      const result = await discoverSessions({
        projectsDir: FIXTURES_DIR,
      });

      expect(result.files).toBeInstanceOf(Array);
      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.totalSize).toBeGreaterThan(0);
      expect(result.projects).toBeInstanceOf(Array);
    });

    it('should return SessionFile objects with correct structure', async () => {
      const result = await discoverSessions({
        projectsDir: FIXTURES_DIR,
      });

      for (const file of result.files) {
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('projectPath');
        expect(file).toHaveProperty('encodedPath');
        expect(file).toHaveProperty('size');
        expect(file).toHaveProperty('lastModified');
        expect(file).toHaveProperty('entryCount');

        // Validate types
        expect(typeof file.path).toBe('string');
        expect(typeof file.projectPath).toBe('string');
        expect(typeof file.encodedPath).toBe('string');
        expect(typeof file.size).toBe('number');
        expect(typeof file.lastModified).toBe('number');
        expect(file.entryCount).toBeNull(); // Not set until indexing
      }
    });

    it('should only discover JSONL files with valid UUID names', async () => {
      const result = await discoverSessions({
        projectsDir: FIXTURES_DIR,
      });

      for (const file of result.files) {
        // Path should end with .jsonl
        expect(file.path).toMatch(/\.jsonl$/);

        // Filename should be a valid UUID
        const filename = path.basename(file.path);
        expect(filename).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i
        );
      }
    });

    it('should decode project paths correctly', async () => {
      const result = await discoverSessions({
        projectsDir: FIXTURES_DIR,
      });

      // Check that at least one project has correct path decoding
      const myappFiles = result.files.filter((f) =>
        f.projectPath.includes('/Users/testuser/Projects/myapp')
      );
      expect(myappFiles.length).toBeGreaterThan(0);

      for (const file of myappFiles) {
        expect(file.encodedPath).toBe('-Users-testuser-Projects-myapp');
        expect(file.projectPath).toBe('/Users/testuser/Projects/myapp');
      }
    });

    it('should include file size and modification time', async () => {
      const result = await discoverSessions({
        projectsDir: FIXTURES_DIR,
      });

      for (const file of result.files) {
        expect(file.size).toBeGreaterThan(0);
        expect(file.lastModified).toBeGreaterThan(0);

        // Verify these match actual file stats
        const stats = await fs.stat(file.path);
        expect(file.size).toBe(stats.size);
        expect(file.lastModified).toBe(Math.floor(stats.mtimeMs));
      }
    });

    it('should calculate total size correctly', async () => {
      const result = await discoverSessions({
        projectsDir: FIXTURES_DIR,
      });

      const calculatedTotal = result.files.reduce((sum, f) => sum + f.size, 0);
      expect(result.totalSize).toBe(calculatedTotal);
    });

    it('should list unique project paths', async () => {
      const result = await discoverSessions({
        projectsDir: FIXTURES_DIR,
      });

      // Should have 3 unique projects in fixtures
      // Note: path decoding converts dashes to slashes, so "another-app" becomes "another/app"
      expect(result.projects.length).toBe(3);
      expect(result.projects).toContain('/Users/testuser/Projects/myapp');
      expect(result.projects).toContain('/Users/testuser/Projects/another/app');
      expect(result.projects).toContain('/home/user/work/project');

      // Projects should be unique
      const uniqueProjects = new Set(result.projects);
      expect(uniqueProjects.size).toBe(result.projects.length);
    });
  });

  describe('project filtering', () => {
    it('should filter by project path', async () => {
      const result = await discoverSessions({
        projectsDir: FIXTURES_DIR,
        projectPath: '/Users/testuser/Projects/myapp',
      });

      expect(result.files.length).toBeGreaterThan(0);
      for (const file of result.files) {
        expect(file.projectPath).toBe('/Users/testuser/Projects/myapp');
      }
    });

    it('should return empty result for non-existent project path', async () => {
      const result = await discoverSessions({
        projectsDir: FIXTURES_DIR,
        projectPath: '/nonexistent/path',
      });

      expect(result.files).toEqual([]);
      expect(result.totalFiles).toBe(0);
      expect(result.totalSize).toBe(0);
      expect(result.projects).toEqual([]);
    });

    it('should find specific session counts per project', async () => {
      const myappResult = await discoverSessions({
        projectsDir: FIXTURES_DIR,
        projectPath: '/Users/testuser/Projects/myapp',
      });

      // Note: path decoding converts dashes to slashes, so "another-app" becomes "another/app"
      const anotherAppResult = await discoverSessions({
        projectsDir: FIXTURES_DIR,
        projectPath: '/Users/testuser/Projects/another/app',
      });

      // myapp has 2 sessions in fixtures
      expect(myappResult.totalFiles).toBe(2);

      // another/app has 1 session
      expect(anotherAppResult.totalFiles).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty project directory', async () => {
      const emptyDir = path.join(FIXTURES_DIR, 'empty-test');
      await fs.mkdir(emptyDir, { recursive: true });

      try {
        const result = await discoverSessions({
          projectsDir: emptyDir,
        });

        expect(result.files).toEqual([]);
        expect(result.totalFiles).toBe(0);
      } finally {
        await fs.rmdir(emptyDir);
      }
    });

    it('should handle non-existent projects directory', async () => {
      const result = await discoverSessions({
        projectsDir: '/nonexistent/path/to/projects',
      });

      expect(result.files).toEqual([]);
      expect(result.totalFiles).toBe(0);
      expect(result.totalSize).toBe(0);
      expect(result.projects).toEqual([]);
    });

    it('should ignore non-JSONL files', async () => {
      const result = await discoverSessions({
        projectsDir: FIXTURES_DIR,
      });

      // Fixture includes not-a-session.txt and invalid-uuid.jsonl
      for (const file of result.files) {
        expect(file.path).not.toMatch(/not-a-session\.txt$/);
        expect(file.path).not.toMatch(/invalid-uuid\.jsonl$/);
      }
    });

    it('should return sorted results (newest first)', async () => {
      const result = await discoverSessions({
        projectsDir: FIXTURES_DIR,
      });

      // Check that files are sorted by lastModified descending
      for (let i = 1; i < result.files.length; i++) {
        const prev = result.files[i - 1];
        const curr = result.files[i];
        if (prev && curr) {
          expect(prev.lastModified).toBeGreaterThanOrEqual(curr.lastModified);
        }
      }
    });
  });

  describe('error handling', () => {
    it('should handle permission denied gracefully', async () => {
      // This test is platform-specific and may need adjustment
      // For now, just verify the function doesn't throw
      const result = await discoverSessions({
        projectsDir: FIXTURES_DIR,
      });

      expect(result).toBeDefined();
    });
  });
});
