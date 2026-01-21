/**
 * Unit tests for sessions FTS5 search
 *
 * Tests the full-text search functionality for session logs.
 *
 * @module tests/unit/persistence/sessions/fts.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Database } from 'bun:sqlite';
import {
  initDatabase,
  openDatabase,
  closeDatabase,
  tableExists,
  getDatabaseStats,
  SCHEMA_VERSION,
  insertSessionEntry,
  insertSessionEntries,
  deleteSessionEntries,
  upsertSession,
  getSession,
  listSessions,
  deleteSession,
  upsertToolUsage,
  getToolUsage,
  searchSessions,
  findSessionsWithContent,
  getSessionEntries,
  countSearchResults,
  recordIndexedFile,
  needsReindex,
  getIndexedFiles,
  removeIndexedFile,
  type SessionEntry,
  type SessionMetadata,
  type SessionToolUsage,
} from '../../../../src/persistence/sessions/fts';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestEntry(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    sessionId: 'test-session-' + Math.random().toString(36).slice(2),
    projectPath: '/test/project',
    timestamp: new Date().toISOString(),
    role: 'assistant',
    content: 'Test content for FTS5 search',
    ...overrides,
  };
}

function createTestMetadata(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
  return {
    sessionId: 'test-session-' + Math.random().toString(36).slice(2),
    projectPath: '/test/project',
    entryCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheTokens: 0,
    compressionCount: 0,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('sessions/fts', () => {
  let testDir: string;
  let dbPath: string;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `agentlint-fts-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(testDir, { recursive: true });
    dbPath = join(testDir, 'sessions.db');
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('initDatabase', () => {
    it('should create database with all tables', async () => {
      const result = await initDatabase({ dbPath });

      expect(result.success).toBe(true);
      expect(result.dbPath).toBe(dbPath);
      expect(result.schemaVersion).toBe(SCHEMA_VERSION);
      expect(result.migrated).toBe(false);
      expect(existsSync(dbPath)).toBe(true);
    });

    it('should create parent directories if needed', async () => {
      const nestedPath = join(testDir, 'nested', 'dir', 'sessions.db');
      const result = await initDatabase({ dbPath: nestedPath });

      expect(result.success).toBe(true);
      expect(existsSync(nestedPath)).toBe(true);
    });

    it('should drop tables when force=true', async () => {
      // First init
      await initDatabase({ dbPath });

      // Add some data
      const db = openDatabase(dbPath);
      insertSessionEntry(db, createTestEntry({ sessionId: 'session-1' }));
      closeDatabase(db);

      // Force reinit
      await initDatabase({ dbPath, force: true });

      // Verify data was cleared
      const db2 = openDatabase(dbPath);
      const stats = getDatabaseStats(db2);
      expect(stats.entryCount).toBe(0);
      closeDatabase(db2);
    });
  });

  describe('openDatabase', () => {
    it('should open existing database', async () => {
      await initDatabase({ dbPath });
      const db = openDatabase(dbPath);

      expect(db).toBeInstanceOf(Database);
      closeDatabase(db);
    });

    it('should throw on schema version mismatch', async () => {
      // Create database manually with wrong version
      const db = new Database(dbPath);
      db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
      db.run('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [999, new Date().toISOString()]);
      db.close();

      expect(() => openDatabase(dbPath)).toThrow('schema version mismatch');
    });
  });

  describe('tableExists', () => {
    it('should return true for existing tables', async () => {
      await initDatabase({ dbPath });
      const db = openDatabase(dbPath);

      expect(tableExists(db, 'sessions')).toBe(true);
      expect(tableExists(db, 'session_entries')).toBe(true);
      expect(tableExists(db, 'session_tools')).toBe(true);
      expect(tableExists(db, 'indexed_files')).toBe(true);

      closeDatabase(db);
    });

    it('should return false for non-existent tables', async () => {
      await initDatabase({ dbPath });
      const db = openDatabase(dbPath);

      expect(tableExists(db, 'nonexistent')).toBe(false);

      closeDatabase(db);
    });
  });

  describe('getDatabaseStats', () => {
    it('should return correct stats for empty database', async () => {
      await initDatabase({ dbPath });
      const db = openDatabase(dbPath);

      const stats = getDatabaseStats(db);

      expect(stats.schemaVersion).toBe(SCHEMA_VERSION);
      expect(stats.sessionCount).toBe(0);
      expect(stats.entryCount).toBe(0);
      expect(stats.indexedFileCount).toBe(0);

      closeDatabase(db);
    });

    it('should return correct stats after inserts', async () => {
      await initDatabase({ dbPath });
      const db = openDatabase(dbPath);

      // Add session and entries
      upsertSession(db, createTestMetadata({ sessionId: 'session-1', entryCount: 3 }));
      insertSessionEntry(db, createTestEntry({ sessionId: 'session-1' }));
      insertSessionEntry(db, createTestEntry({ sessionId: 'session-1' }));
      recordIndexedFile(db, '/path/to/file.jsonl', '/test/project', Date.now(), 10);

      const stats = getDatabaseStats(db);

      expect(stats.sessionCount).toBe(1);
      expect(stats.entryCount).toBe(2);
      expect(stats.indexedFileCount).toBe(1);

      closeDatabase(db);
    });
  });

  describe('Session Entry Operations', () => {
    let db: Database;

    beforeEach(async () => {
      await initDatabase({ dbPath });
      db = openDatabase(dbPath);
    });

    afterEach(() => {
      closeDatabase(db);
    });

    describe('insertSessionEntry', () => {
      it('should insert a session entry', () => {
        const entry = createTestEntry();
        insertSessionEntry(db, entry);

        const stats = getDatabaseStats(db);
        expect(stats.entryCount).toBe(1);
      });

      it('should insert entry with tool fields', () => {
        const entry = createTestEntry({
          role: 'tool',
          toolName: 'Read',
          toolInput: '{"file_path": "/test.ts"}',
          toolResult: 'file content',
        });
        insertSessionEntry(db, entry);

        const entries = getSessionEntries(db, entry.sessionId);
        expect(entries[0]?.toolName).toBe('Read');
        expect(entries[0]?.toolInput).toBe('{"file_path": "/test.ts"}');
      });
    });

    describe('insertSessionEntries', () => {
      it('should insert multiple entries in transaction', () => {
        const sessionId = 'batch-session';
        const entries = [
          createTestEntry({ sessionId, content: 'First message' }),
          createTestEntry({ sessionId, content: 'Second message' }),
          createTestEntry({ sessionId, content: 'Third message' }),
        ];

        insertSessionEntries(db, entries);

        const stats = getDatabaseStats(db);
        expect(stats.entryCount).toBe(3);
      });
    });

    describe('deleteSessionEntries', () => {
      it('should delete entries for a session', () => {
        const sessionId = 'to-delete';
        insertSessionEntries(db, [
          createTestEntry({ sessionId }),
          createTestEntry({ sessionId }),
        ]);

        // Verify entries were inserted
        const entriesBefore = getSessionEntries(db, sessionId);
        expect(entriesBefore.length).toBe(2);

        const deleted = deleteSessionEntries(db, sessionId);

        // Verify entries were deleted
        expect(deleted).toBeGreaterThan(0);
        const entriesAfter = getSessionEntries(db, sessionId);
        expect(entriesAfter.length).toBe(0);
      });

      it('should return 0 for non-existent session', () => {
        const deleted = deleteSessionEntries(db, 'nonexistent');
        expect(deleted).toBe(0);
      });
    });
  });

  describe('Session Metadata Operations', () => {
    let db: Database;

    beforeEach(async () => {
      await initDatabase({ dbPath });
      db = openDatabase(dbPath);
    });

    afterEach(() => {
      closeDatabase(db);
    });

    describe('upsertSession', () => {
      it('should insert new session', () => {
        const metadata = createTestMetadata({
          sessionId: 'new-session',
          inputTokens: 1000,
          outputTokens: 500,
        });

        upsertSession(db, metadata);

        const session = getSession(db, 'new-session');
        expect(session).not.toBeNull();
        expect(session?.inputTokens).toBe(1000);
        expect(session?.outputTokens).toBe(500);
      });

      it('should update existing session', () => {
        const sessionId = 'update-session';
        upsertSession(db, createTestMetadata({ sessionId, entryCount: 5 }));
        upsertSession(db, createTestMetadata({ sessionId, entryCount: 10 }));

        const session = getSession(db, sessionId);
        expect(session?.entryCount).toBe(10);
      });
    });

    describe('getSession', () => {
      it('should return null for non-existent session', () => {
        const session = getSession(db, 'nonexistent');
        expect(session).toBeNull();
      });

      it('should return session with all fields', () => {
        const metadata = createTestMetadata({
          sessionId: 'full-session',
          projectPath: '/my/project',
          firstTimestamp: '2024-01-01T00:00:00Z',
          lastTimestamp: '2024-01-01T01:00:00Z',
          entryCount: 50,
          inputTokens: 10000,
          outputTokens: 5000,
          cacheTokens: 2000,
          compressionCount: 2,
          model: 'claude-sonnet-4-20250514',
          cliVersion: '1.0.0',
        });

        upsertSession(db, metadata);
        const session = getSession(db, 'full-session');

        expect(session).toEqual(metadata);
      });
    });

    describe('listSessions', () => {
      it('should list all sessions', () => {
        upsertSession(db, createTestMetadata({ sessionId: 'session-1' }));
        upsertSession(db, createTestMetadata({ sessionId: 'session-2' }));
        upsertSession(db, createTestMetadata({ sessionId: 'session-3' }));

        const sessions = listSessions(db);
        expect(sessions.length).toBe(3);
      });

      it('should filter by project path', () => {
        upsertSession(db, createTestMetadata({ sessionId: 'session-1', projectPath: '/project/a' }));
        upsertSession(db, createTestMetadata({ sessionId: 'session-2', projectPath: '/project/b' }));
        upsertSession(db, createTestMetadata({ sessionId: 'session-3', projectPath: '/project/a' }));

        const sessions = listSessions(db, { projectPath: '/project/a' });
        expect(sessions.length).toBe(2);
      });

      it('should apply limit and offset', () => {
        for (let i = 1; i <= 5; i++) {
          upsertSession(db, createTestMetadata({ sessionId: `session-${i}` }));
        }

        const sessions = listSessions(db, { limit: 2, offset: 1 });
        expect(sessions.length).toBe(2);
      });
    });

    describe('deleteSession', () => {
      it('should delete session and related data', () => {
        const sessionId = 'to-delete-full';

        // Create session with entries and tool usage
        upsertSession(db, createTestMetadata({ sessionId }));
        insertSessionEntry(db, createTestEntry({ sessionId }));
        upsertToolUsage(db, { sessionId, toolName: 'Read', category: 'file', callCount: 1, errorCount: 0 });

        const deleted = deleteSession(db, sessionId);

        expect(deleted).toBe(true);
        expect(getSession(db, sessionId)).toBeNull();
        expect(getSessionEntries(db, sessionId).length).toBe(0);
        expect(getToolUsage(db, sessionId).length).toBe(0);
      });

      it('should return false for non-existent session', () => {
        const deleted = deleteSession(db, 'nonexistent');
        expect(deleted).toBe(false);
      });
    });
  });

  describe('Tool Usage Operations', () => {
    let db: Database;

    beforeEach(async () => {
      await initDatabase({ dbPath });
      db = openDatabase(dbPath);
      // Create parent session first (FK constraint)
      upsertSession(db, createTestMetadata({ sessionId: 'tool-session' }));
    });

    afterEach(() => {
      closeDatabase(db);
    });

    describe('upsertToolUsage', () => {
      it('should insert tool usage', () => {
        const usage: SessionToolUsage = {
          sessionId: 'tool-session',
          toolName: 'Read',
          category: 'file',
          callCount: 5,
          errorCount: 1,
        };

        upsertToolUsage(db, usage);

        const tools = getToolUsage(db, 'tool-session');
        expect(tools.length).toBe(1);
        expect(tools[0]?.callCount).toBe(5);
        expect(tools[0]?.errorCount).toBe(1);
      });

      it('should accumulate counts on update', () => {
        const usage: SessionToolUsage = {
          sessionId: 'tool-session',
          toolName: 'Read',
          category: 'file',
          callCount: 3,
          errorCount: 0,
        };

        upsertToolUsage(db, usage);
        upsertToolUsage(db, { ...usage, callCount: 2, errorCount: 1 });

        const tools = getToolUsage(db, 'tool-session');
        expect(tools[0]?.callCount).toBe(5); // 3 + 2
        expect(tools[0]?.errorCount).toBe(1); // 0 + 1
      });
    });

    describe('getToolUsage', () => {
      it('should return empty array for no usage', () => {
        const tools = getToolUsage(db, 'tool-session');
        expect(tools).toEqual([]);
      });

      it('should order by call count descending', () => {
        upsertToolUsage(db, { sessionId: 'tool-session', toolName: 'Read', category: 'file', callCount: 10, errorCount: 0 });
        upsertToolUsage(db, { sessionId: 'tool-session', toolName: 'Write', category: 'file', callCount: 50, errorCount: 0 });
        upsertToolUsage(db, { sessionId: 'tool-session', toolName: 'Bash', category: 'shell', callCount: 5, errorCount: 0 });

        const tools = getToolUsage(db, 'tool-session');

        expect(tools[0]?.toolName).toBe('Write');
        expect(tools[1]?.toolName).toBe('Read');
        expect(tools[2]?.toolName).toBe('Bash');
      });
    });
  });

  describe('FTS5 Search Operations', () => {
    let db: Database;

    beforeEach(async () => {
      await initDatabase({ dbPath });
      db = openDatabase(dbPath);

      // Populate test data
      const sessionId = 'search-session';
      upsertSession(db, createTestMetadata({ sessionId, projectPath: '/test/project' }));

      insertSessionEntries(db, [
        createTestEntry({
          sessionId,
          timestamp: '2024-01-01T10:00:00Z',
          role: 'user',
          content: 'How do I implement error handling in TypeScript?',
        }),
        createTestEntry({
          sessionId,
          timestamp: '2024-01-01T10:01:00Z',
          role: 'assistant',
          content: 'You can use try-catch blocks for error handling. Here is an example with async/await.',
        }),
        createTestEntry({
          sessionId,
          timestamp: '2024-01-01T10:02:00Z',
          role: 'tool',
          toolName: 'Read',
          content: 'Reading file content for context',
          filePath: '/src/errors.ts',
        }),
        createTestEntry({
          sessionId,
          timestamp: '2024-01-01T10:03:00Z',
          role: 'assistant',
          content: 'Based on the error handling code in the file, you should use custom error classes.',
        }),
      ]);

      // Add another session for cross-session search
      const otherSession = 'other-session';
      upsertSession(db, createTestMetadata({ sessionId: otherSession, projectPath: '/other/project' }));
      insertSessionEntry(db, createTestEntry({
        sessionId: otherSession,
        projectPath: '/other/project',  // Must match session metadata for filtering
        role: 'user',
        content: 'What is the best database for storing errors?',
      }));
    });

    afterEach(() => {
      closeDatabase(db);
    });

    describe('searchSessions', () => {
      it('should find entries matching query', () => {
        const results = searchSessions(db, 'error handling');

        expect(results.length).toBeGreaterThan(0);
        expect(results.some((r) => r.content.includes('error handling'))).toBe(true);
      });

      it('should return results sorted by relevance (BM25)', () => {
        const results = searchSessions(db, 'error');

        // Results should be sorted by rank (lower is more relevant)
        for (let i = 1; i < results.length; i++) {
          expect(results[i]!.rank).toBeGreaterThanOrEqual(results[i - 1]!.rank);
        }
      });

      it('should filter by project path', () => {
        const results = searchSessions(db, 'error', { projectPath: '/test/project' });

        expect(results.every((r) => r.projectPath === '/test/project')).toBe(true);
      });

      it('should filter by session ID', () => {
        const results = searchSessions(db, 'error', { sessionId: 'search-session' });

        expect(results.every((r) => r.sessionId === 'search-session')).toBe(true);
      });

      it('should filter by role', () => {
        const results = searchSessions(db, 'error', { role: 'assistant' });

        expect(results.every((r) => r.role === 'assistant')).toBe(true);
      });

      it('should apply limit and offset', () => {
        const allResults = searchSessions(db, 'error');
        const limitedResults = searchSessions(db, 'error', { limit: 2 });
        const offsetResults = searchSessions(db, 'error', { limit: 2, offset: 1 });

        expect(limitedResults.length).toBeLessThanOrEqual(2);
        if (allResults.length >= 2) {
          expect(offsetResults[0]?.timestamp).toBe(allResults[1]?.timestamp);
        }
      });

      it('should include snippets when requested', () => {
        const results = searchSessions(db, 'error handling', { includeSnippets: true });

        expect(results.some((r) => r.snippet !== undefined)).toBe(true);
        // Snippets should contain mark tags
        const withSnippet = results.find((r) => r.snippet);
        if (withSnippet?.snippet) {
          expect(withSnippet.snippet).toContain('<mark>');
        }
      });

      it('should handle FTS5 operators (AND)', () => {
        const results = searchSessions(db, 'error AND handling');

        expect(results.length).toBeGreaterThan(0);
        results.forEach((r) => {
          const lower = r.content.toLowerCase();
          expect(lower.includes('error') && lower.includes('handling')).toBe(true);
        });
      });

      it('should handle phrase search', () => {
        const results = searchSessions(db, '"error handling"');

        expect(results.length).toBeGreaterThan(0);
      });

      it('should return empty array for no matches', () => {
        const results = searchSessions(db, 'xyzzyznonexistent');

        expect(results).toEqual([]);
      });
    });

    describe('findSessionsWithContent', () => {
      it('should find sessions containing content', () => {
        const results = findSessionsWithContent(db, 'error');

        expect(results.length).toBe(2); // Both sessions have "error"
        expect(results.some((r) => r.sessionId === 'search-session')).toBe(true);
        expect(results.some((r) => r.sessionId === 'other-session')).toBe(true);
      });

      it('should return match counts', () => {
        const results = findSessionsWithContent(db, 'error');

        // search-session has more matches
        const searchSession = results.find((r) => r.sessionId === 'search-session');
        const otherSession = results.find((r) => r.sessionId === 'other-session');

        expect(searchSession?.matchCount).toBeGreaterThan(otherSession?.matchCount ?? 0);
      });

      it('should filter by project path', () => {
        const results = findSessionsWithContent(db, 'error', { projectPath: '/test/project' });

        expect(results.length).toBe(1);
        expect(results[0]?.sessionId).toBe('search-session');
      });
    });

    describe('getSessionEntries', () => {
      it('should return entries for session', () => {
        const entries = getSessionEntries(db, 'search-session');

        expect(entries.length).toBe(4);
      });

      it('should order by timestamp ascending', () => {
        const entries = getSessionEntries(db, 'search-session');

        for (let i = 1; i < entries.length; i++) {
          expect(entries[i]!.timestamp >= entries[i - 1]!.timestamp).toBe(true);
        }
      });

      it('should apply pagination', () => {
        const entries = getSessionEntries(db, 'search-session', { limit: 2 });

        expect(entries.length).toBe(2);
      });
    });

    describe('countSearchResults', () => {
      it('should count matching entries', () => {
        const count = countSearchResults(db, 'error');

        expect(count).toBeGreaterThan(0);
      });

      it('should apply filters', () => {
        const totalCount = countSearchResults(db, 'error');
        const filteredCount = countSearchResults(db, 'error', { sessionId: 'search-session' });

        expect(filteredCount).toBeLessThanOrEqual(totalCount);
      });
    });
  });

  describe('Indexed Files Tracking', () => {
    let db: Database;

    beforeEach(async () => {
      await initDatabase({ dbPath });
      db = openDatabase(dbPath);
    });

    afterEach(() => {
      closeDatabase(db);
    });

    describe('recordIndexedFile', () => {
      it('should record indexed file', () => {
        recordIndexedFile(db, '/path/to/session.jsonl', '/test/project', 1704067200000, 100);

        const files = getIndexedFiles(db, '/test/project');
        expect(files.length).toBe(1);
        expect(files[0]?.filePath).toBe('/path/to/session.jsonl');
        expect(files[0]?.entryCount).toBe(100);
      });

      it('should update existing record', () => {
        recordIndexedFile(db, '/path/to/session.jsonl', '/test/project', 1704067200000, 100);
        recordIndexedFile(db, '/path/to/session.jsonl', '/test/project', 1704153600000, 150);

        const files = getIndexedFiles(db, '/test/project');
        expect(files.length).toBe(1);
        expect(files[0]?.entryCount).toBe(150);
        expect(files[0]?.lastModified).toBe(1704153600000);
      });
    });

    describe('needsReindex', () => {
      it('should return true for new files', () => {
        const needs = needsReindex(db, '/new/file.jsonl', Date.now());
        expect(needs).toBe(true);
      });

      it('should return false for unchanged files', () => {
        const mtime = 1704067200000;
        recordIndexedFile(db, '/path/to/file.jsonl', '/test/project', mtime, 10);

        const needs = needsReindex(db, '/path/to/file.jsonl', mtime);
        expect(needs).toBe(false);
      });

      it('should return true for modified files', () => {
        const mtime = 1704067200000;
        recordIndexedFile(db, '/path/to/file.jsonl', '/test/project', mtime, 10);

        const needs = needsReindex(db, '/path/to/file.jsonl', mtime + 1000);
        expect(needs).toBe(true);
      });
    });

    describe('getIndexedFiles', () => {
      it('should return empty array for project with no files', () => {
        const files = getIndexedFiles(db, '/empty/project');
        expect(files).toEqual([]);
      });

      it('should return files for specific project', () => {
        recordIndexedFile(db, '/project-a/file1.jsonl', '/project/a', Date.now(), 10);
        recordIndexedFile(db, '/project-a/file2.jsonl', '/project/a', Date.now(), 20);
        recordIndexedFile(db, '/project-b/file1.jsonl', '/project/b', Date.now(), 30);

        const filesA = getIndexedFiles(db, '/project/a');
        const filesB = getIndexedFiles(db, '/project/b');

        expect(filesA.length).toBe(2);
        expect(filesB.length).toBe(1);
      });
    });

    describe('removeIndexedFile', () => {
      it('should remove indexed file record', () => {
        recordIndexedFile(db, '/path/to/file.jsonl', '/test/project', Date.now(), 10);

        const removed = removeIndexedFile(db, '/path/to/file.jsonl');

        expect(removed).toBe(true);
        expect(getIndexedFiles(db, '/test/project').length).toBe(0);
      });

      it('should return false for non-existent file', () => {
        const removed = removeIndexedFile(db, '/nonexistent.jsonl');
        expect(removed).toBe(false);
      });
    });
  });

  describe('Edge Cases', () => {
    let db: Database;

    beforeEach(async () => {
      await initDatabase({ dbPath });
      db = openDatabase(dbPath);
    });

    afterEach(() => {
      closeDatabase(db);
    });

    it('should handle special characters in search query', () => {
      upsertSession(db, createTestMetadata({ sessionId: 'special-session' }));
      insertSessionEntry(db, createTestEntry({
        sessionId: 'special-session',
        content: 'Error: Cannot find module "lodash"',
      }));

      // Should not throw
      const results = searchSessions(db, 'Cannot find module');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle empty content', () => {
      upsertSession(db, createTestMetadata({ sessionId: 'empty-session' }));
      insertSessionEntry(db, createTestEntry({
        sessionId: 'empty-session',
        content: '',
      }));

      const entries = getSessionEntries(db, 'empty-session');
      expect(entries.length).toBe(1);
      expect(entries[0]?.content).toBe('');
    });

    it('should handle very long content', () => {
      const longContent = 'word '.repeat(10000);
      upsertSession(db, createTestMetadata({ sessionId: 'long-session' }));
      insertSessionEntry(db, createTestEntry({
        sessionId: 'long-session',
        content: longContent,
      }));

      const results = searchSessions(db, 'word');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle unicode content', () => {
      upsertSession(db, createTestMetadata({ sessionId: 'unicode-session' }));
      insertSessionEntry(db, createTestEntry({
        sessionId: 'unicode-session',
        content: 'Testing unicode: 你好世界 🚀 αβγ',
      }));

      const entries = getSessionEntries(db, 'unicode-session');
      expect(entries[0]?.content).toContain('你好世界');
    });
  });
});
