/**
 * T048-T049: Unit tests for session statistics
 *
 * Tests stats aggregation and filtering.
 *
 * @module tests/unit/tools/sessions/stats.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getSessionStats } from '../../../../src/tools/sessions/stats';
import { indexSessionFile } from '../../../../src/tools/sessions/indexer';
import { initDatabase } from '../../../../src/persistence/sessions/fts';

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/sessions');
const VALID_FILE = path.join(FIXTURES_DIR, 'sample-valid.jsonl');
const WITH_TOOLS_FILE = path.join(FIXTURES_DIR, 'sample-with-tools.jsonl');
const WITH_SUMMARY_FILE = path.join(FIXTURES_DIR, 'sample-with-summary.jsonl');

// Temporary test database path
const TEST_DB_DIR = path.join(__dirname, '../../../.temp');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test-stats.db');

describe('Session Statistics', () => {
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

  describe('Stats Aggregation (T048)', () => {
    it('should return aggregated stats', () => {
      const result = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
    });

    it('should count sessions correctly', () => {
      const result = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.stats.sessionCount).toBe(3); // 3 indexed sessions
    });

    it('should aggregate token counts', () => {
      const result = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.stats.totalInputTokens).toBeGreaterThan(0);
      expect(result.stats.totalOutputTokens).toBeGreaterThan(0);
    });

    it('should aggregate cache tokens', () => {
      const result = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(typeof result.stats.totalCacheTokens).toBe('number');
    });

    it('should count compressions', () => {
      const result = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      // sample-with-summary.jsonl has 1 compression
      expect(result.stats.compressionCount).toBeGreaterThanOrEqual(1);
    });

    it('should include tool distribution', () => {
      const result = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.stats.toolDistribution).toBeDefined();
      expect(result.stats.toolDistribution.total).toBeGreaterThan(0);
    });

    it('should calculate total tool calls', () => {
      const result = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.stats.totalToolCalls).toBeGreaterThan(0);
    });

    it('should track query time', () => {
      const result = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(typeof result.queryTimeMs).toBe('number');
      expect(result.queryTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should return empty stats for no sessions', async () => {
      // Create a fresh database with no sessions
      const emptyDbPath = path.join(TEST_DB_DIR, 'empty-stats.db');
      await initDatabase({ dbPath: emptyDbPath });

      try {
        const result = getSessionStats({}, { dbPath: emptyDbPath });

        expect(result.success).toBe(true);
        expect(result.stats.sessionCount).toBe(0);
        expect(result.stats.totalInputTokens).toBe(0);
        expect(result.stats.totalOutputTokens).toBe(0);
      } finally {
        if (existsSync(emptyDbPath)) {
          await fs.unlink(emptyDbPath);
        }
      }
    });
  });

  describe('Project/Date Filtering (T049)', () => {
    it('should filter by project', () => {
      const result = getSessionStats({ project: '/test/project1' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.stats.sessionCount).toBe(1);
      expect(result.stats.projectFilter).toBe('/test/project1');
    });

    it('should return empty stats for non-existent project', () => {
      const result = getSessionStats({ project: '/nonexistent/project' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.stats.sessionCount).toBe(0);
    });

    it('should filter by since date', () => {
      const result = getSessionStats(
        { since: '2026-01-01T00:00:00.000Z' },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.stats.timeRange.since).toBe('2026-01-01T00:00:00.000Z');
    });

    it('should filter by until date', () => {
      const result = getSessionStats(
        { until: '2026-12-31T23:59:59.999Z' },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.stats.timeRange.until).toBe('2026-12-31T23:59:59.999Z');
    });

    it('should filter by date range', () => {
      const result = getSessionStats(
        {
          since: '2026-01-01T00:00:00.000Z',
          until: '2026-12-31T23:59:59.999Z',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.stats.timeRange.since).toBe('2026-01-01T00:00:00.000Z');
      expect(result.stats.timeRange.until).toBe('2026-12-31T23:59:59.999Z');
    });

    it('should return no results for future date range', () => {
      const result = getSessionStats(
        { since: '2099-01-01T00:00:00.000Z' },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.stats.sessionCount).toBe(0);
    });

    it('should return no results for past date range', () => {
      const result = getSessionStats(
        { until: '2000-01-01T00:00:00.000Z' },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.stats.sessionCount).toBe(0);
    });

    it('should combine project and date filters', () => {
      const result = getSessionStats(
        {
          project: '/test/project1',
          since: '2026-01-01T00:00:00.000Z',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.stats.projectFilter).toBe('/test/project1');
      expect(result.stats.timeRange.since).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('Calculated Metrics', () => {
    it('should calculate average turns per session', () => {
      const result = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(typeof result.stats.avgTurnsPerSession).toBe('number');
      expect(result.stats.avgTurnsPerSession).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average tokens per turn', () => {
      const result = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(typeof result.stats.avgTokensPerTurn).toBe('number');
    });

    it('should calculate tool error rate', () => {
      const result = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(typeof result.stats.toolErrorRate).toBe('number');
      expect(result.stats.toolErrorRate).toBeGreaterThanOrEqual(0);
      expect(result.stats.toolErrorRate).toBeLessThanOrEqual(1);
    });
  });

  describe('Model Distribution', () => {
    it('should include modelDistribution in stats', () => {
      const result = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.stats.modelDistribution).toBeDefined();
      expect(typeof result.stats.modelDistribution).toBe('object');
    });

    it('should return empty modelDistribution when no model data', () => {
      // The default fixtures don't have model data
      const result = getSessionStats({}, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      // Model distribution should still be an object (possibly with unknown key)
      expect(result.stats.modelDistribution).toBeDefined();
    });
  });

  describe('Timestamp Validation', () => {
    it('should return error for invalid since timestamp', () => {
      const result = getSessionStats({ since: 'not-a-valid-date' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Invalid since timestamp');
      expect(result.error?.message).toContain('not-a-valid-date');
      expect(result.error?.suggestion).toContain('ISO-8601');
    });

    it('should return error for invalid until timestamp', () => {
      const result = getSessionStats({ until: 'invalid-timestamp' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Invalid until timestamp');
      expect(result.error?.message).toContain('invalid-timestamp');
    });

    it('should skip empty since timestamp (treat as undefined)', () => {
      const result = getSessionStats({ since: '' }, { dbPath: TEST_DB_PATH });

      // Empty string is falsy, so filter is skipped - should succeed
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid ISO-8601 timestamps', () => {
      const result = getSessionStats(
        {
          since: '2026-01-01T00:00:00Z',
          until: '2026-12-31T23:59:59Z',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept date-only format', () => {
      const result = getSessionStats({ since: '2026-01-01' }, { dbPath: TEST_DB_PATH });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should include project and model filters in error response stats', () => {
      const result = getSessionStats(
        {
          since: 'invalid',
          project: '/test/project',
          model: 'claude-opus-4-5',
        },
        { dbPath: TEST_DB_PATH }
      );

      expect(result.success).toBe(false);
      expect(result.stats.projectFilter).toBe('/test/project');
      expect(result.stats.modelFilter).toBe('claude-opus-4-5');
    });
  });
});

// Separate describe block for model tracking tests with dedicated fixture
const WITH_MODEL_FILE = path.join(FIXTURES_DIR, 'sample-with-model.jsonl');
const TEST_DB_MODEL_PATH = path.join(TEST_DB_DIR, 'test-stats-model.db');

describe('Model/Version Tracking (T062)', () => {
  beforeEach(async () => {
    // Ensure temp directory exists and clean up old test database
    await fs.mkdir(TEST_DB_DIR, { recursive: true });
    if (existsSync(TEST_DB_MODEL_PATH)) {
      await fs.unlink(TEST_DB_MODEL_PATH);
    }
    if (existsSync(`${TEST_DB_MODEL_PATH}-wal`)) {
      await fs.unlink(`${TEST_DB_MODEL_PATH}-wal`);
    }
    if (existsSync(`${TEST_DB_MODEL_PATH}-shm`)) {
      await fs.unlink(`${TEST_DB_MODEL_PATH}-shm`);
    }

    // Initialize database and index test fixture with model data
    await initDatabase({ dbPath: TEST_DB_MODEL_PATH });
    await indexSessionFile(WITH_MODEL_FILE, '/test/model-project', { dbPath: TEST_DB_MODEL_PATH });
  });

  afterEach(async () => {
    // Clean up test database
    if (existsSync(TEST_DB_MODEL_PATH)) {
      await fs.unlink(TEST_DB_MODEL_PATH);
    }
    if (existsSync(`${TEST_DB_MODEL_PATH}-wal`)) {
      await fs.unlink(`${TEST_DB_MODEL_PATH}-wal`);
    }
    if (existsSync(`${TEST_DB_MODEL_PATH}-shm`)) {
      await fs.unlink(`${TEST_DB_MODEL_PATH}-shm`);
    }
  });

  describe('Model Extraction', () => {
    it('should extract model from session entries', () => {
      const result = getSessionStats({}, { dbPath: TEST_DB_MODEL_PATH });

      expect(result.success).toBe(true);
      expect(result.stats.modelDistribution).toBeDefined();
      // Should have claude-opus-4-5-20251101 from the fixture
      expect(Object.keys(result.stats.modelDistribution)).toContain('claude-opus-4-5-20251101');
    });

    it('should count sessions by model', () => {
      const result = getSessionStats({}, { dbPath: TEST_DB_MODEL_PATH });

      expect(result.success).toBe(true);
      const modelDist = result.stats.modelDistribution;
      expect(modelDist['claude-opus-4-5-20251101']).toBe(1);
    });
  });

  describe('CLI Version Extraction', () => {
    it('should extract top CLI version from sessions', () => {
      const result = getSessionStats({}, { dbPath: TEST_DB_MODEL_PATH });

      expect(result.success).toBe(true);
      expect(result.stats.topCliVersion).toBe('1.0.62');
    });
  });

  describe('Model Filtering', () => {
    it('should filter by model', () => {
      const result = getSessionStats(
        { model: 'claude-opus-4-5-20251101' },
        { dbPath: TEST_DB_MODEL_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.stats.modelFilter).toBe('claude-opus-4-5-20251101');
      expect(result.stats.sessionCount).toBe(1);
    });

    it('should return zero sessions for non-existent model', () => {
      const result = getSessionStats(
        { model: 'claude-sonnet-3-20250514' },
        { dbPath: TEST_DB_MODEL_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.stats.sessionCount).toBe(0);
    });

    it('should combine model filter with project filter', () => {
      const result = getSessionStats(
        {
          model: 'claude-opus-4-5-20251101',
          project: '/test/model-project',
        },
        { dbPath: TEST_DB_MODEL_PATH }
      );

      expect(result.success).toBe(true);
      expect(result.stats.modelFilter).toBe('claude-opus-4-5-20251101');
      expect(result.stats.projectFilter).toBe('/test/model-project');
      expect(result.stats.sessionCount).toBe(1);
    });
  });
});
