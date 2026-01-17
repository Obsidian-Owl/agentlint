/**
 * T055: Performance validation tests for session search
 *
 * Validates that search performance meets NFR-001: < 2s on 500MB corpus.
 * These tests use available fixture data and measure actual query times.
 *
 * Note: Full 500MB corpus testing requires external test data.
 * These tests validate the pattern works and provide baseline measurements.
 *
 * @module tests/performance/sessions-search.test.ts
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
} from '../../src/tools/sessions';
import { initDatabase } from '../../src/persistence/sessions/fts';

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../fixtures/sessions');
const MOCK_PROJECTS_DIR = path.join(FIXTURES_DIR, 'projects');

// Temporary test database
const TEST_DB_DIR = path.join(__dirname, '../.temp');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'perf-test.db');

// Performance thresholds (in milliseconds)
const SEARCH_THRESHOLD_MS = 2000; // NFR-001: < 2s
const STATS_THRESHOLD_MS = 1000; // Stats should be even faster

describe('Session Search Performance', () => {
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

    // Index test fixtures
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

  describe('Search Performance (NFR-001)', () => {
    it('should complete basic search within threshold', () => {
      const result = searchSessions({ query: 'message' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.queryTimeMs).toBeLessThan(SEARCH_THRESHOLD_MS);
      console.log(`Basic search completed in ${result.queryTimeMs}ms`);
    });

    it('should complete phrase search within threshold', () => {
      const result = searchSessions({ query: '"test message"' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.queryTimeMs).toBeLessThan(SEARCH_THRESHOLD_MS);
      console.log(`Phrase search completed in ${result.queryTimeMs}ms`);
    });

    it('should complete prefix search within threshold', () => {
      const result = searchSessions({ query: 'test*' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.queryTimeMs).toBeLessThan(SEARCH_THRESHOLD_MS);
      console.log(`Prefix search completed in ${result.queryTimeMs}ms`);
    });

    it('should complete wildcard search within threshold', () => {
      const result = searchSessions({ query: '*' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.queryTimeMs).toBeLessThan(SEARCH_THRESHOLD_MS);
      console.log(`Wildcard search completed in ${result.queryTimeMs}ms`);
    });

    it('should complete filtered search within threshold', () => {
      const result = searchSessions(
        {
          query: 'message',
          since: '2026-01-01',
          until: '2026-12-31',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.queryTimeMs).toBeLessThan(SEARCH_THRESHOLD_MS);
      console.log(`Filtered search completed in ${result.queryTimeMs}ms`);
    });

    it('should handle multiple consecutive searches efficiently', () => {
      const queries = ['message', 'error', 'test*', '"hello world"', '*'];
      const times: number[] = [];

      for (const query of queries) {
        const result = searchSessions({ query }, { dbPath: TEST_DB_PATH });
        expect(result.success).toBe(true);
        times.push(result.queryTimeMs);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avgTime).toBeLessThan(SEARCH_THRESHOLD_MS);
      console.log(`Average query time: ${avgTime.toFixed(2)}ms`);
    });
  });

  describe('Stats Performance', () => {
    it('should complete stats query within threshold', () => {
      const result = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.queryTimeMs).toBeLessThan(STATS_THRESHOLD_MS);
      console.log(`Stats query completed in ${result.queryTimeMs}ms`);
    });

    it('should complete filtered stats within threshold', () => {
      const result = getSessionStats({ since: '2026-01-01' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.queryTimeMs).toBeLessThan(STATS_THRESHOLD_MS);
      console.log(`Filtered stats completed in ${result.queryTimeMs}ms`);
    });
  });

  describe('Baseline Measurements', () => {
    it('should report baseline performance metrics', () => {
      // Run several queries and collect metrics
      const searchResult = searchSessions({ query: '*' }, { dbPath: TEST_DB_PATH });
      const statsResult = getSessionStats({}, { dbPath: TEST_DB_PATH });

      console.log('\n=== Performance Baseline ===');
      console.log(`Index contains ${statsResult.stats.sessionCount} sessions`);
      console.log(`Search query time: ${searchResult.queryTimeMs}ms`);
      console.log(`Stats query time: ${statsResult.queryTimeMs}ms`);
      console.log(`Total matches available: ${searchResult.totalMatches}`);
      console.log('============================\n');

      // Just ensure they run successfully
      expect(searchResult.success).toBe(true);
      expect(statsResult.success).toBe(true);
    });
  });
});
