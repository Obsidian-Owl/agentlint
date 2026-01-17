/**
 * T054: Quickstart validation tests
 *
 * Validates that the examples in specs/ep06-session-analysis/quickstart.md work correctly.
 * These tests ensure the documented API patterns function as expected.
 *
 * @module tests/integration/sessions/quickstart.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
  indexSessionFile,
  searchSessions,
  getSessionStats,
  discoverSessions,
} from '../../../src/tools/sessions';
import { initDatabase } from '../../../src/persistence/sessions/fts';

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../fixtures/sessions');
const MOCK_PROJECTS_DIR = path.join(FIXTURES_DIR, 'projects');

// Temporary test database
const TEST_DB_DIR = path.join(__dirname, '../../.temp');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'quickstart-test.db');

describe('Quickstart Examples Validation', () => {
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

    // Index test fixtures to populate the database
    const discovered = await discoverSessions({ projectsDir: MOCK_PROJECTS_DIR });
    for (const sessionFile of discovered.files) {
      await indexSessionFile(sessionFile.path, sessionFile.projectPath, {
        dbPath: TEST_DB_PATH,
      });
    }
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

  describe('Basic Usage (from quickstart.md)', () => {
    it('should support basic search (query: "message")', () => {
      // From quickstart: const results = await searchSessions({ query: 'permission denied' });
      const results = searchSessions({ query: 'message' }, { dbPath: TEST_DB_PATH });

      expect(results.success).toBe(true);
      expect(Array.isArray(results.results)).toBe(true);
    });

    it('should support phrase search (query: "exact phrase")', () => {
      // From quickstart: const results = await searchSessions({ query: '"API key error"' });
      const results = searchSessions({ query: '"test message"' }, { dbPath: TEST_DB_PATH });

      expect(results.success).toBe(true);
      expect(typeof results.totalMatches).toBe('number');
    });

    it('should support date filtering', () => {
      // From quickstart: const results = await searchSessions({ query: 'error', since: '2026-01-01', until: '2026-01-15' });
      const results = searchSessions(
        {
          query: '*',
          since: '2026-01-01',
          until: '2026-12-31',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(results.success).toBe(true);
      expect(results.filters.timeRange.since).toBe('2026-01-01');
      expect(results.filters.timeRange.until).toBe('2026-12-31');
    });

    it('should support getSessionStats()', () => {
      // From quickstart: const stats = await getSessionStats();
      const stats = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(stats.success).toBe(true);
      expect(typeof stats.stats.sessionCount).toBe('number');
      expect(typeof stats.stats.totalInputTokens).toBe('number');
      expect(typeof stats.stats.totalOutputTokens).toBe('number');
    });

    it('should support stats with date filter', () => {
      // From quickstart: const stats = await getSessionStats({ since: '2026-01-01' });
      const stats = getSessionStats({ since: '2026-01-01' }, { dbPath: TEST_DB_PATH });

      expect(stats.success).toBe(true);
      expect(stats.stats.timeRange.since).toBe('2026-01-01');
    });

    it('should support stats with project filter', () => {
      // From quickstart: const stats = await getSessionStats({ project: '/Users/me/my-project' });
      const stats = getSessionStats({ project: '/test/project' }, { dbPath: TEST_DB_PATH });

      expect(stats.success).toBe(true);
      // projectFilter is only set if a project was specified
      expect(stats.stats.projectFilter).toBe('/test/project');
    });
  });

  describe('Common Patterns (from quickstart.md)', () => {
    it('should find results with file:line for causal reference', () => {
      // From quickstart: Results include file:line for causal reference
      const results = searchSessions({ query: '*' }, { dbPath: TEST_DB_PATH });

      expect(results.success).toBe(true);
      if (results.results.length > 0) {
        const firstResult = results.results[0];
        expect(typeof firstResult?.filePath).toBe('string');
        expect(typeof firstResult?.lineNumber).toBe('number');
      }
    });

    it('should support tool distribution in stats', () => {
      // From quickstart: console.log(stats.stats.toolDistribution);
      const stats = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(stats.success).toBe(true);
      expect(stats.stats.toolDistribution).toBeDefined();
      expect(typeof stats.stats.toolDistribution.read).toBe('number');
      expect(typeof stats.stats.toolDistribution.write).toBe('number');
      expect(typeof stats.stats.toolDistribution.bash).toBe('number');
      expect(typeof stats.stats.toolDistribution.search).toBe('number');
      expect(typeof stats.stats.toolDistribution.other).toBe('number');
      expect(typeof stats.stats.toolDistribution.total).toBe('number');
    });

    it('should include token usage in stats', () => {
      // From quickstart: console.log(`Total tokens: ${stats.stats.totalInputTokens + stats.stats.totalOutputTokens}`);
      const stats = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(stats.success).toBe(true);
      expect(typeof stats.stats.totalInputTokens).toBe('number');
      expect(typeof stats.stats.totalOutputTokens).toBe('number');
      expect(typeof stats.stats.avgTokensPerTurn).toBe('number');
      expect(typeof stats.stats.totalCacheTokens).toBe('number');
    });

    it('should include compression count in stats', () => {
      // From quickstart: console.log(`Total compressions: ${stats.stats.compressionCount}`);
      const stats = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(stats.success).toBe(true);
      expect(typeof stats.stats.compressionCount).toBe('number');
    });
  });

  describe('Result Structure (from Tool Reference)', () => {
    it('search_sessions should return correct output structure', () => {
      // From quickstart Tool Reference:
      // - results: Array of SearchResult with relevance scores
      // - totalMatches: Total matches found
      // - queryTimeMs: Query execution time
      const result = searchSessions({ query: '*' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.results)).toBe(true);
      expect(typeof result.totalMatches).toBe('number');
      expect(typeof result.queryTimeMs).toBe('number');
    });

    it('get_session_stats should return correct output structure', () => {
      // From quickstart Tool Reference:
      // - stats: SessionStats object with metrics
      // - queryTimeMs: Query execution time
      const result = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(typeof result.stats).toBe('object');
      expect(typeof result.queryTimeMs).toBe('number');
    });
  });

  describe('Search Parameters (from Tool Reference)', () => {
    it('should support limit parameter', () => {
      // From quickstart: limit: Max results (default: 50)
      const result = searchSessions({ query: '*', limit: 5 }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.results.length).toBeLessThanOrEqual(5);
    });

    it('should support offset parameter for pagination', () => {
      // From quickstart: offset: Pagination offset
      // Then get with offset
      const offsetResults = searchSessions(
        { query: '*', offset: 1, limit: 10 },
        { dbPath: TEST_DB_PATH }
      );

      expect(offsetResults.success).toBe(true);
      // With offset, we should get different (fewer or different) results
      // unless there are very few total results
      expect(Array.isArray(offsetResults.results)).toBe(true);
    });
  });
});
