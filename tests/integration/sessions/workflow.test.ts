/**
 * T053: Integration test for full session analysis workflow
 *
 * Tests the complete flow: discover → parse → index → search
 *
 * @module tests/integration/sessions/workflow.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { discoverSessions } from '../../../src/tools/sessions/discovery';
import { parseSessionFile } from '../../../src/tools/sessions/parser';
import { extractMetrics } from '../../../src/tools/sessions/metrics';
import { indexSessionFile, clearIndex } from '../../../src/tools/sessions/indexer';
import { searchSessions } from '../../../src/tools/sessions/search';
import { getSessionStats } from '../../../src/tools/sessions/stats';
import { initDatabase } from '../../../src/persistence/sessions/fts';

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../fixtures/sessions');
const MOCK_PROJECTS_DIR = path.join(FIXTURES_DIR, 'projects');

// Temporary test database
const TEST_DB_DIR = path.join(__dirname, '../../.temp');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'integration-workflow.db');

describe('Session Analysis Workflow Integration', () => {
  beforeAll(async () => {
    // Ensure temp directory exists
    await fs.mkdir(TEST_DB_DIR, { recursive: true });

    // Clean up old test database
    for (const suffix of ['', '-wal', '-shm']) {
      const dbFile = `${TEST_DB_PATH}${suffix}`;
      if (existsSync(dbFile)) {
        await fs.unlink(dbFile);
      }
    }

    // Initialize fresh database
    await initDatabase({ dbPath: TEST_DB_PATH });
  });

  afterAll(async () => {
    // Clean up test database
    for (const suffix of ['', '-wal', '-shm']) {
      const dbFile = `${TEST_DB_PATH}${suffix}`;
      if (existsSync(dbFile)) {
        await fs.unlink(dbFile);
      }
    }
  });

  describe('Full Workflow: Discover → Parse → Index → Search', () => {
    it('should discover sessions from mock projects directory', async () => {
      const result = await discoverSessions({ projectsDir: MOCK_PROJECTS_DIR });

      expect(result.files.length).toBeGreaterThan(0);
      expect(result.totalFiles).toBeGreaterThan(0);
    });

    it('should parse discovered session files', async () => {
      const discovered = await discoverSessions({ projectsDir: MOCK_PROJECTS_DIR });
      const sessionFile = discovered.files[0];

      expect(sessionFile).toBeDefined();
      if (!sessionFile) return;

      const parsed = await parseSessionFile(sessionFile.path);

      expect(parsed.entries.length).toBeGreaterThan(0);
      expect(parsed.errorCount).toBe(0);
    });

    it('should extract metrics from parsed sessions', async () => {
      const discovered = await discoverSessions({ projectsDir: MOCK_PROJECTS_DIR });
      const sessionFile = discovered.files[0];

      expect(sessionFile).toBeDefined();
      if (!sessionFile) return;

      const parsed = await parseSessionFile(sessionFile.path);
      const sessionId = parsed.sessionId || 'test-session';
      const metrics = extractMetrics(parsed.entries, sessionId, sessionFile.projectPath);

      expect(metrics).toBeDefined();
      expect(typeof metrics.inputTokens).toBe('number');
      expect(typeof metrics.outputTokens).toBe('number');
    });

    it('should index sessions for search', async () => {
      const discovered = await discoverSessions({ projectsDir: MOCK_PROJECTS_DIR });

      // Index each discovered session
      for (const sessionFile of discovered.files) {
        const result = await indexSessionFile(sessionFile.path, sessionFile.projectPath, {
          dbPath: TEST_DB_PATH,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should search indexed sessions', () => {
      // Search for a term that should exist in test fixtures
      const result = searchSessions({ query: 'message' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.totalMatches).toBeGreaterThanOrEqual(0);
    });

    it('should get statistics from indexed sessions', () => {
      const result = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.stats.sessionCount).toBeGreaterThan(0);
    });
  });

  describe('Workflow with Filters', () => {
    it('should filter search by date range', () => {
      const result = searchSessions(
        {
          query: '*',
          since: '2026-01-01T00:00:00.000Z',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.filters.timeRange.since).toBe('2026-01-01T00:00:00.000Z');
    });

    it('should filter stats by project', async () => {
      const discovered = await discoverSessions({ projectsDir: MOCK_PROJECTS_DIR });
      const sessionFile = discovered.files[0];

      if (!sessionFile) return;

      const result = getSessionStats(
        { project: sessionFile.projectPath },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.stats.projectFilter).toBe(sessionFile.projectPath);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid search queries gracefully', () => {
      // FTS5 syntax errors should be caught
      const result = searchSessions({ query: 'unclosed"quote' }, { dbPath: TEST_DB_PATH });

      // Should return with error or empty results, not throw
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle non-existent project filter', () => {
      const result = getSessionStats(
        { project: '/nonexistent/project/path' },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.stats.sessionCount).toBe(0);
    });
  });

  describe('Index Management', () => {
    it('should support clearing the index', async () => {
      // Clear the index
      await clearIndex({ dbPath: TEST_DB_PATH });

      // Stats should show zero sessions after clear
      const stats = getSessionStats({}, { dbPath: TEST_DB_PATH });
      expect(stats.stats.sessionCount).toBe(0);
    });

    it('should support re-indexing after clear', async () => {
      const discovered = await discoverSessions({ projectsDir: MOCK_PROJECTS_DIR });

      // Re-index all sessions
      for (const sessionFile of discovered.files) {
        await indexSessionFile(sessionFile.path, sessionFile.projectPath, {
          dbPath: TEST_DB_PATH,
        });
      }

      // Stats should show sessions again
      const stats = getSessionStats({}, { dbPath: TEST_DB_PATH });
      expect(stats.stats.sessionCount).toBeGreaterThan(0);
    });
  });
});
