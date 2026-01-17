/**
 * T033-T034: Unit tests for session indexing
 *
 * Tests FTS5 indexing and incremental index updates.
 *
 * @module tests/unit/tools/sessions/indexer.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
  indexSessions,
  indexSessionFile,
  getIndexedFileInfo,
  clearIndex,
} from '../../../../src/tools/sessions/indexer';
import {
  initDatabase,
  openDatabase,
  closeDatabase,
} from '../../../../src/persistence/sessions/fts';

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/sessions');
const VALID_FILE = path.join(FIXTURES_DIR, 'sample-valid.jsonl');
const WITH_TOOLS_FILE = path.join(FIXTURES_DIR, 'sample-with-tools.jsonl');
const WITH_SUMMARY_FILE = path.join(FIXTURES_DIR, 'sample-with-summary.jsonl');

// Temporary test database path
const TEST_DB_DIR = path.join(__dirname, '../../../.temp');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test-sessions.db');

describe('Session Indexing', () => {
  beforeEach(async () => {
    // Ensure temp directory exists and clean up old test database
    await fs.mkdir(TEST_DB_DIR, { recursive: true });
    if (existsSync(TEST_DB_PATH)) {
      await fs.unlink(TEST_DB_PATH);
    }
    // Also clean up WAL files
    if (existsSync(`${TEST_DB_PATH}-wal`)) {
      await fs.unlink(`${TEST_DB_PATH}-wal`);
    }
    if (existsSync(`${TEST_DB_PATH}-shm`)) {
      await fs.unlink(`${TEST_DB_PATH}-shm`);
    }
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

  describe('indexSessionFile', () => {
    it('should index a valid session file', async () => {
      // Initialize database
      await initDatabase({ dbPath: TEST_DB_PATH });

      const result = await indexSessionFile(VALID_FILE, '/test/project', {
        dbPath: TEST_DB_PATH,
      });

      expect(result.success).toBe(true);
      expect(result.entriesIndexed).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should populate session_entries FTS table', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      await indexSessionFile(VALID_FILE, '/test/project', {
        dbPath: TEST_DB_PATH,
      });

      // Query the FTS table directly
      const db = openDatabase(TEST_DB_PATH);
      try {
        const count = db
          .query<{ count: number }, []>('SELECT COUNT(*) as count FROM session_entries')
          .get();
        expect(count?.count).toBeGreaterThan(0);
      } finally {
        closeDatabase(db);
      }
    });

    it('should record indexed file metadata', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      await indexSessionFile(VALID_FILE, '/test/project', {
        dbPath: TEST_DB_PATH,
      });

      const info = getIndexedFileInfo(VALID_FILE, { dbPath: TEST_DB_PATH });
      expect(info).not.toBeNull();
      expect(info?.filePath).toBe(VALID_FILE);
      expect(info?.projectPath).toBe('/test/project');
      expect(info?.entryCount).toBeGreaterThan(0);
    });

    it('should populate sessions summary table', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      await indexSessionFile(VALID_FILE, '/test/project', {
        dbPath: TEST_DB_PATH,
      });

      const db = openDatabase(TEST_DB_PATH);
      try {
        const session = db
          .query<
            { session_id: string; project_path: string },
            []
          >('SELECT session_id, project_path FROM sessions LIMIT 1')
          .get();
        expect(session).not.toBeNull();
        expect(session?.project_path).toBe('/test/project');
      } finally {
        closeDatabase(db);
      }
    });

    it('should track tool usage in session_tools table', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      await indexSessionFile(WITH_TOOLS_FILE, '/test/project', {
        dbPath: TEST_DB_PATH,
      });

      const db = openDatabase(TEST_DB_PATH);
      try {
        const tools = db
          .query<
            { tool_name: string; category: string; call_count: number },
            []
          >('SELECT tool_name, category, call_count FROM session_tools')
          .all();
        expect(tools.length).toBeGreaterThan(0);

        // Check that tools are categorized correctly
        const toolNames = tools.map((t) => t.tool_name);
        expect(toolNames).toContain('Glob');
        expect(toolNames).toContain('Bash');
      } finally {
        closeDatabase(db);
      }
    });

    it('should handle files with compression events', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      await indexSessionFile(WITH_SUMMARY_FILE, '/test/project', {
        dbPath: TEST_DB_PATH,
      });

      const db = openDatabase(TEST_DB_PATH);
      try {
        const session = db
          .query<
            { compression_count: number },
            []
          >('SELECT compression_count FROM sessions LIMIT 1')
          .get();
        expect(session?.compression_count).toBe(1);
      } finally {
        closeDatabase(db);
      }
    });

    it('should store searchable content', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      await indexSessionFile(VALID_FILE, '/test/project', {
        dbPath: TEST_DB_PATH,
      });

      const db = openDatabase(TEST_DB_PATH);
      try {
        // Search for content we know exists
        const results = db
          .query<
            { content: string },
            [string]
          >('SELECT content FROM session_entries WHERE session_entries MATCH ?')
          .all('user OR assistant');
        expect(results.length).toBeGreaterThan(0);
      } finally {
        closeDatabase(db);
      }
    });
  });

  describe('Incremental Indexing (T034)', () => {
    it('should skip already indexed files with same mtime', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      // First index
      const result1 = await indexSessionFile(VALID_FILE, '/test/project', {
        dbPath: TEST_DB_PATH,
      });
      expect(result1.entriesIndexed).toBeGreaterThan(0);

      // Second index - should skip
      const result2 = await indexSessionFile(VALID_FILE, '/test/project', {
        dbPath: TEST_DB_PATH,
      });
      expect(result2.skipped).toBe(true);
      expect(result2.entriesIndexed).toBe(0);
    });

    it('should re-index files when force option is true', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      // First index
      await indexSessionFile(VALID_FILE, '/test/project', {
        dbPath: TEST_DB_PATH,
      });

      // Force re-index
      const result = await indexSessionFile(VALID_FILE, '/test/project', {
        dbPath: TEST_DB_PATH,
        force: true,
      });
      expect(result.skipped).toBe(false);
      expect(result.entriesIndexed).toBeGreaterThan(0);
    });

    it('should update entries when file is modified', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      // Create a temp file for modification testing
      const tempFile = path.join(TEST_DB_DIR, 'temp-session.jsonl');
      await fs.copyFile(VALID_FILE, tempFile);

      try {
        // First index
        await indexSessionFile(tempFile, '/test/project', {
          dbPath: TEST_DB_PATH,
        });

        // Modify file (append a line)
        const newEntry = JSON.stringify({
          type: 'user',
          uuid: 'new-msg-001',
          timestamp: '2026-01-17T12:00:00.000Z',
          message: { role: 'user', content: [{ type: 'text', text: 'New message' }] },
        });
        await fs.appendFile(tempFile, '\n' + newEntry);

        // Touch file to update mtime
        const now = new Date();
        await fs.utimes(tempFile, now, now);

        // Re-index should detect modification
        const result = await indexSessionFile(tempFile, '/test/project', {
          dbPath: TEST_DB_PATH,
        });
        expect(result.skipped).toBe(false);
        expect(result.entriesIndexed).toBeGreaterThan(0);
      } finally {
        if (existsSync(tempFile)) {
          await fs.unlink(tempFile);
        }
      }
    });

    it('should preserve indexed file count in metadata', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      await indexSessionFile(VALID_FILE, '/test/project', {
        dbPath: TEST_DB_PATH,
      });

      const info1 = getIndexedFileInfo(VALID_FILE, { dbPath: TEST_DB_PATH });
      expect(info1?.entryCount).toBeGreaterThan(0);

      // Index again with force
      await indexSessionFile(VALID_FILE, '/test/project', {
        dbPath: TEST_DB_PATH,
        force: true,
      });

      const info2 = getIndexedFileInfo(VALID_FILE, { dbPath: TEST_DB_PATH });
      expect(info2?.entryCount).toBe(info1?.entryCount);
    });
  });

  describe('indexSessions batch', () => {
    it('should index multiple files', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      const files = [
        { path: VALID_FILE, projectPath: '/test/project1' },
        { path: WITH_TOOLS_FILE, projectPath: '/test/project2' },
      ];

      const result = await indexSessions(files, { dbPath: TEST_DB_PATH });

      expect(result.filesIndexed).toBe(2);
      expect(result.filesSkipped).toBe(0);
      expect(result.entriesIndexed).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should report progress via callback', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      const files = [
        { path: VALID_FILE, projectPath: '/test/project1' },
        { path: WITH_TOOLS_FILE, projectPath: '/test/project2' },
      ];

      const progressUpdates: Array<{ processed: number; total: number }> = [];

      await indexSessions(files, {
        dbPath: TEST_DB_PATH,
        onProgress: (processed, total) => {
          progressUpdates.push({ processed, total });
        },
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      const lastUpdate = progressUpdates[progressUpdates.length - 1];
      expect(lastUpdate?.processed).toBe(files.length);
    });

    it('should continue on file errors', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      const files = [
        { path: VALID_FILE, projectPath: '/test/project1' },
        { path: '/nonexistent/file.jsonl', projectPath: '/test/project2' },
        { path: WITH_TOOLS_FILE, projectPath: '/test/project3' },
      ];

      const result = await indexSessions(files, { dbPath: TEST_DB_PATH });

      expect(result.filesIndexed).toBe(2);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]?.filePath).toBe('/nonexistent/file.jsonl');
    });

    it('should skip already indexed files in batch', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      const files = [
        { path: VALID_FILE, projectPath: '/test/project1' },
        { path: WITH_TOOLS_FILE, projectPath: '/test/project2' },
      ];

      // First batch
      await indexSessions(files, { dbPath: TEST_DB_PATH });

      // Second batch - should skip all
      const result = await indexSessions(files, { dbPath: TEST_DB_PATH });

      expect(result.filesIndexed).toBe(0);
      expect(result.filesSkipped).toBe(2);
    });
  });

  describe('clearIndex', () => {
    it('should remove all indexed entries', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      await indexSessionFile(VALID_FILE, '/test/project', {
        dbPath: TEST_DB_PATH,
      });

      // Verify data exists
      const db1 = openDatabase(TEST_DB_PATH);
      const countBefore = db1
        .query<{ count: number }, []>('SELECT COUNT(*) as count FROM session_entries')
        .get();
      closeDatabase(db1);
      expect(countBefore?.count).toBeGreaterThan(0);

      // Clear index
      clearIndex({ dbPath: TEST_DB_PATH });

      // Verify data is gone
      const db2 = openDatabase(TEST_DB_PATH);
      const countAfter = db2
        .query<{ count: number }, []>('SELECT COUNT(*) as count FROM session_entries')
        .get();
      closeDatabase(db2);
      expect(countAfter?.count).toBe(0);
    });

    it('should clear indexed files metadata', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      await indexSessionFile(VALID_FILE, '/test/project', {
        dbPath: TEST_DB_PATH,
      });

      clearIndex({ dbPath: TEST_DB_PATH });

      const info = getIndexedFileInfo(VALID_FILE, { dbPath: TEST_DB_PATH });
      expect(info).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSONL gracefully', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      const malformedFile = path.join(FIXTURES_DIR, 'sample-malformed.jsonl');
      const result = await indexSessionFile(malformedFile, '/test/project', {
        dbPath: TEST_DB_PATH,
      });

      // Should still index valid entries
      expect(result.success).toBe(true);
      expect(result.entriesIndexed).toBeGreaterThan(0);
    });

    it('should handle non-existent file', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      const result = await indexSessionFile('/nonexistent/file.jsonl', '/test/project', {
        dbPath: TEST_DB_PATH,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle empty file', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      const emptyFile = path.join(TEST_DB_DIR, 'empty.jsonl');
      await fs.writeFile(emptyFile, '');

      try {
        const result = await indexSessionFile(emptyFile, '/test/project', {
          dbPath: TEST_DB_PATH,
        });

        expect(result.success).toBe(true);
        expect(result.entriesIndexed).toBe(0);
      } finally {
        if (existsSync(emptyFile)) {
          await fs.unlink(emptyFile);
        }
      }
    });
  });

  describe('Model/Version Extraction (T062)', () => {
    const WITH_MODEL_FILE = path.join(FIXTURES_DIR, 'sample-with-model.jsonl');

    it('should extract and store model from assistant messages', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      await indexSessionFile(WITH_MODEL_FILE, '/test/model-project', {
        dbPath: TEST_DB_PATH,
      });

      // Query sessions table to check model was stored
      const db = openDatabase(TEST_DB_PATH);
      try {
        const session = db
          .query<{ model: string | null }, []>('SELECT model FROM sessions LIMIT 1')
          .get();

        expect(session).toBeDefined();
        expect(session?.model).toBe('claude-opus-4-5-20251101');
      } finally {
        closeDatabase(db);
      }
    });

    it('should extract and store CLI version from entries', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      await indexSessionFile(WITH_MODEL_FILE, '/test/model-project', {
        dbPath: TEST_DB_PATH,
      });

      // Query sessions table to check CLI version was stored
      const db = openDatabase(TEST_DB_PATH);
      try {
        const session = db
          .query<{ cli_version: string | null }, []>('SELECT cli_version FROM sessions LIMIT 1')
          .get();

        expect(session).toBeDefined();
        expect(session?.cli_version).toBe('1.0.62');
      } finally {
        closeDatabase(db);
      }
    });

    it('should handle sessions without model data', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      // Use a fixture without model data
      await indexSessionFile(VALID_FILE, '/test/project', {
        dbPath: TEST_DB_PATH,
      });

      // Query sessions table
      const db = openDatabase(TEST_DB_PATH);
      try {
        const session = db
          .query<
            { model: string | null; cli_version: string | null },
            []
          >('SELECT model, cli_version FROM sessions LIMIT 1')
          .get();

        expect(session).toBeDefined();
        // Model should be null for fixtures without model data
        expect(session?.model).toBeNull();
      } finally {
        closeDatabase(db);
      }
    });
  });
});
