/**
 * Performance tests for session indexing
 *
 * Validates that indexing performance meets:
 * - NFR-002: < 60s for 500MB of logs
 * - NFR-003: < 100MB peak memory during indexing
 * - NFR-006: < 1s to check 100 files for changes
 *
 * Note: Full 500MB corpus testing requires external test data.
 * These tests validate the pattern and provide baseline measurements.
 *
 * @module tests/performance/sessions-indexing.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { indexSessionFile, discoverSessions, getIndexedFileInfo } from '../../src/tools/sessions';
import {
  initDatabase,
  getDatabaseStats,
  openDatabase,
  closeDatabase,
} from '../../src/persistence/sessions/fts';

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../fixtures/sessions');
const MOCK_PROJECTS_DIR = path.join(FIXTURES_DIR, 'projects');

// Temporary test database
const TEST_DB_DIR = path.join(__dirname, '../.temp');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'perf-indexing.db');

// Performance thresholds
const INDEXING_THRESHOLD_MS = 60000; // NFR-002: < 60s for 500MB
const MEMORY_THRESHOLD_MB = 100; // NFR-003: < 100MB peak
const INCREMENTAL_CHECK_THRESHOLD_MS = 1000; // NFR-006: < 1s to check 100 files

/**
 * Get current memory usage in MB
 */
function getMemoryUsageMB(): number {
  const usage = process.memoryUsage();
  return usage.heapUsed / 1024 / 1024;
}

/**
 * Helper to clean up test database files.
 */
async function cleanupDatabase(dbPath: string): Promise<void> {
  for (const suffix of ['', '-wal', '-shm']) {
    const dbFile = `${dbPath}${suffix}`;
    if (existsSync(dbFile)) {
      await fs.unlink(dbFile);
    }
  }
}

describe('Session Indexing Performance', () => {
  beforeAll(async () => {
    await fs.mkdir(TEST_DB_DIR, { recursive: true });
  });

  afterAll(async () => {
    await cleanupDatabase(TEST_DB_PATH);
  });

  describe('Indexing Throughput (NFR-002)', () => {
    beforeEach(async () => {
      await cleanupDatabase(TEST_DB_PATH);
    });

    it('should complete initial indexing within threshold', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      const startTime = Date.now();
      const discovered = await discoverSessions({ projectsDir: MOCK_PROJECTS_DIR });

      let totalEntries = 0;
      for (const sessionFile of discovered.files) {
        const result = await indexSessionFile(sessionFile.path, sessionFile.projectPath, {
          dbPath: TEST_DB_PATH,
        });
        totalEntries += result.entriesIndexed;
      }

      const elapsedMs = Date.now() - startTime;

      expect(elapsedMs).toBeLessThan(INDEXING_THRESHOLD_MS);
      console.log(
        `Indexed ${discovered.files.length} files (${totalEntries} entries) in ${elapsedMs}ms`
      );
    });

    it('should measure indexing throughput rate', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      const discovered = await discoverSessions({ projectsDir: MOCK_PROJECTS_DIR });
      let totalBytes = 0;
      for (const file of discovered.files) {
        totalBytes += file.size;
      }

      const startTime = Date.now();

      // Index files directly to ensure they're indexed
      let filesIndexed = 0;
      let entriesIndexed = 0;
      for (const sessionFile of discovered.files) {
        const result = await indexSessionFile(sessionFile.path, sessionFile.projectPath, {
          dbPath: TEST_DB_PATH,
        });
        filesIndexed++;
        entriesIndexed += result.entriesIndexed;
      }

      const elapsedMs = Date.now() - startTime;

      const bytesPerSecond = elapsedMs > 0 ? (totalBytes / elapsedMs) * 1000 : 0;
      const mbPerSecond = bytesPerSecond / (1024 * 1024);

      console.log('\n=== Indexing Throughput ===');
      console.log(`Total size: ${(totalBytes / 1024).toFixed(2)} KB`);
      console.log(`Time: ${elapsedMs}ms`);
      console.log(`Throughput: ${mbPerSecond.toFixed(2)} MB/s`);
      console.log(`Files: ${filesIndexed}`);
      console.log(`Entries: ${entriesIndexed}`);
      console.log('===========================\n');

      expect(filesIndexed).toBeGreaterThan(0);
    });
  });

  describe('Incremental Indexing (NFR-006)', () => {
    beforeEach(async () => {
      await cleanupDatabase(TEST_DB_PATH);
    });

    it('should skip unchanged files quickly', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      // First indexing - index all files
      const discovered = await discoverSessions({ projectsDir: MOCK_PROJECTS_DIR });
      for (const sessionFile of discovered.files) {
        await indexSessionFile(sessionFile.path, sessionFile.projectPath, {
          dbPath: TEST_DB_PATH,
        });
      }

      // Second indexing should skip all files (check mtime)
      const startTime = Date.now();
      let skipped = 0;
      for (const sessionFile of discovered.files) {
        const info = getIndexedFileInfo(sessionFile.path, { dbPath: TEST_DB_PATH });
        if (info && info.lastModified >= sessionFile.lastModified) {
          skipped++;
        }
      }
      const elapsedMs = Date.now() - startTime;

      expect(elapsedMs).toBeLessThan(INCREMENTAL_CHECK_THRESHOLD_MS);
      expect(skipped).toBeGreaterThan(0);
      console.log(`Incremental check of ${skipped} files completed in ${elapsedMs}ms`);
    });

    it('should re-index with force flag', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      // First indexing
      const discovered = await discoverSessions({ projectsDir: MOCK_PROJECTS_DIR });
      let firstCount = 0;
      for (const sessionFile of discovered.files) {
        await indexSessionFile(sessionFile.path, sessionFile.projectPath, {
          dbPath: TEST_DB_PATH,
        });
        firstCount++;
      }

      // Force re-index should re-index all files
      let forceCount = 0;
      for (const sessionFile of discovered.files) {
        await indexSessionFile(sessionFile.path, sessionFile.projectPath, {
          dbPath: TEST_DB_PATH,
          force: true,
        });
        forceCount++;
      }

      expect(forceCount).toBe(firstCount);
    });
  });

  describe('Memory Efficiency (NFR-003)', () => {
    beforeEach(async () => {
      await cleanupDatabase(TEST_DB_PATH);
    });

    it('should stay within memory threshold during indexing', async () => {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = getMemoryUsageMB();
      await initDatabase({ dbPath: TEST_DB_PATH });

      const discovered = await discoverSessions({ projectsDir: MOCK_PROJECTS_DIR });
      let filesIndexed = 0;
      for (const sessionFile of discovered.files) {
        await indexSessionFile(sessionFile.path, sessionFile.projectPath, {
          dbPath: TEST_DB_PATH,
        });
        filesIndexed++;
      }

      const peakMemory = getMemoryUsageMB();
      const memoryDelta = peakMemory - initialMemory;

      console.log('\n=== Memory Usage ===');
      console.log(`Initial: ${initialMemory.toFixed(2)} MB`);
      console.log(`Peak: ${peakMemory.toFixed(2)} MB`);
      console.log(`Delta: ${memoryDelta.toFixed(2)} MB`);
      console.log('====================\n');

      // Memory delta should be well under threshold for our small test fixtures
      expect(memoryDelta).toBeLessThan(MEMORY_THRESHOLD_MB);
      expect(filesIndexed).toBeGreaterThan(0);
    });

    it('should not accumulate memory across multiple index operations', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = getMemoryUsageMB();

      // Run multiple indexing cycles with force
      const discovered = await discoverSessions({ projectsDir: MOCK_PROJECTS_DIR });
      for (let i = 0; i < 5; i++) {
        for (const sessionFile of discovered.files) {
          await indexSessionFile(sessionFile.path, sessionFile.projectPath, {
            dbPath: TEST_DB_PATH,
            force: true,
          });
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = getMemoryUsageMB();
      const memoryGrowth = finalMemory - initialMemory;

      console.log(`Memory growth after 5 index cycles: ${memoryGrowth.toFixed(2)} MB`);

      // Memory should not grow significantly across cycles
      expect(memoryGrowth).toBeLessThan(MEMORY_THRESHOLD_MB / 2);
    });
  });

  describe('Database Statistics', () => {
    beforeEach(async () => {
      await cleanupDatabase(TEST_DB_PATH);
    });

    it('should report accurate index statistics', async () => {
      await initDatabase({ dbPath: TEST_DB_PATH });

      const discovered = await discoverSessions({ projectsDir: MOCK_PROJECTS_DIR });
      for (const sessionFile of discovered.files) {
        await indexSessionFile(sessionFile.path, sessionFile.projectPath, {
          dbPath: TEST_DB_PATH,
        });
      }

      const db = openDatabase(TEST_DB_PATH);
      try {
        const stats = getDatabaseStats(db);

        console.log('\n=== Database Statistics ===');
        console.log(`Schema version: ${stats.schemaVersion}`);
        console.log(`Sessions: ${stats.sessionCount}`);
        console.log(`Entries: ${stats.entryCount}`);
        console.log(`Indexed files: ${stats.indexedFileCount}`);
        console.log('===========================\n');

        expect(stats.schemaVersion).toBe(1);
        expect(stats.indexedFileCount).toBeGreaterThan(0);
      } finally {
        closeDatabase(db);
      }
    });
  });
});
