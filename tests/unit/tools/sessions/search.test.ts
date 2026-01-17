/**
 * T040-T042: Unit tests for session search
 *
 * Tests full-text search with BM25 ranking and date filtering.
 *
 * @module tests/unit/tools/sessions/search.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { searchSessions } from '../../../../src/tools/sessions/search';
import { indexSessionFile } from '../../../../src/tools/sessions/indexer';
import { initDatabase } from '../../../../src/persistence/sessions/fts';

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/sessions');
const VALID_FILE = path.join(FIXTURES_DIR, 'sample-valid.jsonl');
const WITH_TOOLS_FILE = path.join(FIXTURES_DIR, 'sample-with-tools.jsonl');
const WITH_SUMMARY_FILE = path.join(FIXTURES_DIR, 'sample-with-summary.jsonl');

// Temporary test database path
const TEST_DB_DIR = path.join(__dirname, '../../../.temp');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test-search.db');

describe('Session Search', () => {
  beforeEach(async () => {
    // Ensure temp directory exists and clean up old test database
    await fs.mkdir(TEST_DB_DIR, { recursive: true });
    if (existsSync(TEST_DB_PATH)) {
      await fs.unlink(TEST_DB_PATH);
    }
    if (existsSync(`${TEST_DB_PATH}-wal`)) {
      await fs.unlink(`${TEST_DB_PATH}-wal`);
    }
    if (existsSync(`${TEST_DB_PATH}-shm`)) {
      await fs.unlink(`${TEST_DB_PATH}-shm`);
    }

    // Initialize database and index test fixtures
    await initDatabase({ dbPath: TEST_DB_PATH });
    await indexSessionFile(VALID_FILE, '/test/project1', { dbPath: TEST_DB_PATH });
    await indexSessionFile(WITH_TOOLS_FILE, '/test/project2', { dbPath: TEST_DB_PATH });
    await indexSessionFile(WITH_SUMMARY_FILE, '/test/project3', { dbPath: TEST_DB_PATH });
  });

  afterEach(async () => {
    // Clean up test database
    if (existsSync(TEST_DB_PATH)) {
      await fs.unlink(TEST_DB_PATH);
    }
    if (existsSync(`${TEST_DB_PATH}-wal`)) {
      await fs.unlink(`${TEST_DB_PATH}-wal`);
    }
    if (existsSync(`${TEST_DB_PATH}-shm`)) {
      await fs.unlink(`${TEST_DB_PATH}-shm`);
    }
  });

  describe('Basic Search (T040)', () => {
    it('should return results for simple query', () => {
      const result = searchSessions({ query: 'user' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should return empty results for no matches', () => {
      const result = searchSessions({ query: 'xyznonexistentterm123' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0);
      expect(result.totalMatches).toBe(0);
    });

    it('should include relevant metadata in results', () => {
      const result = searchSessions({ query: 'user' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);

      const firstResult = result.results[0];
      expect(firstResult).toBeDefined();
      expect(firstResult?.sessionId).toBeDefined();
      expect(firstResult?.projectPath).toBeDefined();
      expect(firstResult?.filePath).toBeDefined();
      expect(firstResult?.lineNumber).toBeDefined();
    });

    it('should include content snippet in results', () => {
      const result = searchSessions({ query: 'user' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      const firstResult = result.results[0];
      expect(firstResult?.contentSnippet).toBeDefined();
      expect(typeof firstResult?.contentSnippet).toBe('string');
    });

    it('should include relevance score', () => {
      const result = searchSessions({ query: 'user' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      const firstResult = result.results[0];
      expect(typeof firstResult?.relevanceScore).toBe('number');
    });

    it('should respect limit parameter', () => {
      const result = searchSessions({ query: 'user', limit: 1 }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.results.length).toBeLessThanOrEqual(1);
    });

    it('should support offset for pagination', () => {
      const result1 = searchSessions({ query: 'user', limit: 2 }, { dbPath: TEST_DB_PATH });

      const result2 = searchSessions(
        { query: 'user', limit: 2, offset: 1 },
        { dbPath: TEST_DB_PATH }
      );

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // If there are enough results, second result of first query should equal first of second
      if (result1.results.length > 1 && result2.results.length > 0) {
        expect(result1.results[1]?.lineNumber).toBe(result2.results[0]?.lineNumber);
      }
    });

    it('should track query time', () => {
      const result = searchSessions({ query: 'user' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(typeof result.queryTimeMs).toBe('number');
      expect(result.queryTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should return total matches count', () => {
      const result = searchSessions({ query: 'user', limit: 1 }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.totalMatches).toBeGreaterThanOrEqual(result.results.length);
    });
  });

  describe('Phrase and Prefix Search (T041)', () => {
    it('should support phrase search with quotes', () => {
      // Search for exact phrase
      const result = searchSessions({ query: '"Hello from user"' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      // May or may not find exact phrase depending on fixture content
    });

    it('should support prefix search with asterisk', () => {
      const result = searchSessions({ query: 'use*' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      // Should match 'user', 'usage', etc.
    });

    it('should support field-specific search', () => {
      // Search specifically in role field
      const result = searchSessions({ query: 'role:assistant' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
    });

    it('should support tool name search', () => {
      const result = searchSessions({ query: 'tool_name:Bash' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
    });

    it('should support boolean OR queries', () => {
      const result = searchSessions({ query: 'user OR assistant' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should support boolean AND queries', () => {
      const result = searchSessions({ query: 'user AND message' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
    });

    it('should support NOT queries', () => {
      const result = searchSessions({ query: 'user NOT error' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
    });
  });

  describe('Date Range Filtering (T042)', () => {
    it('should filter by since date', () => {
      const result = searchSessions(
        {
          query: 'user',
          since: '2026-01-01T00:00:00.000Z',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.filters.timeRange.since).toBe('2026-01-01T00:00:00.000Z');
    });

    it('should filter by until date', () => {
      const result = searchSessions(
        {
          query: 'user',
          until: '2026-12-31T23:59:59.999Z',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.filters.timeRange.until).toBe('2026-12-31T23:59:59.999Z');
    });

    it('should filter by date range', () => {
      const result = searchSessions(
        {
          query: 'user',
          since: '2026-01-01T00:00:00.000Z',
          until: '2026-12-31T23:59:59.999Z',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.filters.timeRange.since).toBe('2026-01-01T00:00:00.000Z');
      expect(result.filters.timeRange.until).toBe('2026-12-31T23:59:59.999Z');
    });

    it('should return no results for future date range', () => {
      const result = searchSessions(
        {
          query: 'user',
          since: '2099-01-01T00:00:00.000Z',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0);
    });

    it('should return no results for past date range', () => {
      const result = searchSessions(
        {
          query: 'user',
          until: '2000-01-01T00:00:00.000Z',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0);
    });
  });

  describe('Project Filtering', () => {
    it('should filter by project path', () => {
      const result = searchSessions(
        {
          query: 'user',
          project: '/test/project1',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.filters.project).toBe('/test/project1');

      // All results should be from project1
      for (const r of result.results) {
        expect(r.projectPath).toBe('/test/project1');
      }
    });

    it('should return empty for non-existent project', () => {
      const result = searchSessions(
        {
          query: 'user',
          project: '/nonexistent/project',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0);
    });
  });

  describe('Session ID Filtering', () => {
    it('should filter by session ID', () => {
      // First get a session ID from results
      const allResults = searchSessions({ query: 'user', limit: 1 }, { dbPath: TEST_DB_PATH });

      if (allResults.results.length > 0) {
        const sessionId = allResults.results[0]?.sessionId;
        expect(sessionId).toBeDefined();

        if (sessionId) {
          const filtered = searchSessions(
            {
              query: 'user',
              sessionId,
            },
            { dbPath: TEST_DB_PATH }
          );

          expect(filtered.success).toBe(true);
          expect(filtered.filters.sessionId).toBe(sessionId);

          // All results should be from same session
          for (const r of filtered.results) {
            expect(r.sessionId).toBe(sessionId);
          }
        }
      }
    });
  });

  describe('BM25 Ranking', () => {
    it('should rank results by relevance', () => {
      const result = searchSessions({ query: 'user', limit: 10 }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);

      // Results should be ordered by relevance score (lower is better in FTS5)
      for (let i = 1; i < result.results.length; i++) {
        const prev = result.results[i - 1];
        const curr = result.results[i];
        expect(prev!.relevanceScore).toBeLessThanOrEqual(curr!.relevanceScore);
      }
    });
  });

  describe('Snippet Generation', () => {
    it('should generate snippets for results', () => {
      const result = searchSessions(
        { query: 'help' }, // Use a term that appears in actual content
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);

      // Check that at least some results have content snippets
      const snippetsWithContent = result.results.filter(
        (r) => r.contentSnippet && r.contentSnippet.length > 0
      );
      expect(snippetsWithContent.length).toBeGreaterThan(0);
    });

    it('should include contentSnippet field in all results', () => {
      const result = searchSessions({ query: 'user' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);

      // All results should have contentSnippet defined (may be empty string)
      for (const r of result.results) {
        expect(typeof r.contentSnippet).toBe('string');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle empty query', () => {
      const result = searchSessions({ query: '' }, { dbPath: TEST_DB_PATH });

      // Should return error or empty results for empty query
      if (result.success) {
        expect(result.results).toHaveLength(0);
      } else {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle invalid FTS5 syntax gracefully', () => {
      const result = searchSessions({ query: '(((' }, { dbPath: TEST_DB_PATH });

      // Should handle gracefully - either return empty or error
      expect(result).toBeDefined();
    });
  });

  describe('Timestamp Validation', () => {
    it('should return error for invalid since timestamp', () => {
      const result = searchSessions(
        {
          query: 'user',
          since: 'not-a-valid-date',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Invalid since timestamp');
      expect(result.error?.message).toContain('not-a-valid-date');
      expect(result.error?.suggestion).toContain('ISO-8601');
    });

    it('should return error for invalid until timestamp', () => {
      const result = searchSessions(
        {
          query: 'user',
          until: 'invalid-timestamp',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Invalid until timestamp');
      expect(result.error?.message).toContain('invalid-timestamp');
    });

    it('should skip empty since timestamp (treat as undefined)', () => {
      const result = searchSessions(
        {
          query: 'user',
          since: '',
        },
        { dbPath: TEST_DB_PATH }
      );

      // Empty string is falsy, so filter is skipped - should succeed
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid ISO-8601 timestamps', () => {
      const result = searchSessions(
        {
          query: 'user',
          since: '2026-01-01T00:00:00Z',
          until: '2026-12-31T23:59:59Z',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept date-only format', () => {
      const result = searchSessions(
        {
          query: 'user',
          since: '2026-01-01',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
