/**
 * Unit tests for persistence/tracking/indexer.ts
 *
 * Tests SQLite indexing for recommendation tracking queries.
 *
 * @module persistence/tracking/__tests__/indexer.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Database } from 'bun:sqlite';

import {
  getTrackingIndexDb,
  indexTracking,
  removeTrackingIndex,
  queryTrackings,
  getIndexedTrackingById,
  getTrackingsByRecommendation,
  getTrackingsByStatus,
  countTrackings,
} from '../indexer';
import type { RecommendationTracking } from '../../../temporal/types';

// =============================================================================
// Test Setup
// =============================================================================

let testDir: string;
let db: Database;

function createTestTracking(
  overrides: Partial<RecommendationTracking> = {}
): RecommendationTracking {
  return {
    id: crypto.randomUUID(),
    recommendationId: 'REC-001',
    recommendationText: 'Add better error handling',
    status: 'pending',
    detectedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(async () => {
  testDir = join(tmpdir(), `agentlint-tracking-indexer-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  db = await getTrackingIndexDb({ baseDir: testDir });
});

afterEach(() => {
  try {
    db.close();
  } catch {
    // Ignore if already closed
  }
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

// =============================================================================
// Tests
// =============================================================================

describe('persistence/tracking/indexer', () => {
  describe('getTrackingIndexDb', () => {
    it('should create database with tracking table', () => {
      // Table should exist after opening
      const tables = db
        .query(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='recommendation_tracking'"
        )
        .all();
      expect(tables.length).toBe(1);
    });

    it('should create required indexes', () => {
      const indexes = db
        .query("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_tracking_%'")
        .all() as { name: string }[];

      const indexNames = indexes.map((i) => i.name);
      expect(indexNames).toContain('idx_tracking_recommendation_id');
      expect(indexNames).toContain('idx_tracking_status');
      expect(indexNames).toContain('idx_tracking_detected_at');
    });
  });

  describe('indexTracking', () => {
    it('should add tracking to index', () => {
      const tracking = createTestTracking();
      const filePath = `/path/to/${tracking.id}.json`;

      indexTracking(db, tracking, filePath);

      const result = getIndexedTrackingById(db, tracking.id);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(tracking.id);
      expect(result?.recommendationId).toBe(tracking.recommendationId);
      expect(result?.filePath).toBe(filePath);
    });

    it('should update existing tracking on conflict', () => {
      const tracking = createTestTracking();
      const filePath = `/path/to/${tracking.id}.json`;

      // Index first time
      indexTracking(db, tracking, filePath);

      // Update and re-index
      tracking.status = 'implemented';
      tracking.effectivenessScore = 90;
      indexTracking(db, tracking, filePath);

      const result = getIndexedTrackingById(db, tracking.id);
      expect(result?.status).toBe('implemented');
      expect(result?.effectivenessScore).toBe(90);
    });

    it('should handle optional fields as null', () => {
      // Create tracking without optional fields
      const tracking: RecommendationTracking = {
        id: crypto.randomUUID(),
        recommendationId: 'REC-001',
        recommendationText: 'Test recommendation',
        status: 'pending',
      };

      indexTracking(db, tracking, '/path/to/file.json');

      const result = getIndexedTrackingById(db, tracking.id);
      expect(result).not.toBeNull();
      expect(result?.detectedAt).toBeUndefined();
      expect(result?.confirmedAt).toBeUndefined();
      expect(result?.effectivenessScore).toBeUndefined();
    });
  });

  describe('removeTrackingIndex', () => {
    it('should remove tracking from index', () => {
      const tracking = createTestTracking();
      indexTracking(db, tracking, '/path/to/file.json');

      const removed = removeTrackingIndex(db, tracking.id);

      expect(removed).toBe(true);
      expect(getIndexedTrackingById(db, tracking.id)).toBeNull();
    });

    it('should return false for non-existent tracking', () => {
      const removed = removeTrackingIndex(db, 'non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('queryTrackings', () => {
    it('should return all trackings when no filters', () => {
      const tracking1 = createTestTracking();
      const tracking2 = createTestTracking();
      indexTracking(db, tracking1, '/path/1.json');
      indexTracking(db, tracking2, '/path/2.json');

      const results = queryTrackings(db);
      expect(results.length).toBe(2);
    });

    it('should filter by recommendation ID', () => {
      const tracking1 = createTestTracking({ recommendationId: 'REC-001' });
      const tracking2 = createTestTracking({ recommendationId: 'REC-002' });
      indexTracking(db, tracking1, '/path/1.json');
      indexTracking(db, tracking2, '/path/2.json');

      const results = queryTrackings(db, { recommendationId: 'REC-001' });
      expect(results.length).toBe(1);
      expect(results[0]?.recommendationId).toBe('REC-001');
    });

    it('should filter by status', () => {
      const tracking1 = createTestTracking({ status: 'pending' });
      const tracking2 = createTestTracking({ status: 'implemented' });
      indexTracking(db, tracking1, '/path/1.json');
      indexTracking(db, tracking2, '/path/2.json');

      const results = queryTrackings(db, { status: 'implemented' });
      expect(results.length).toBe(1);
      expect(results[0]?.status).toBe('implemented');
    });

    it('should filter by baseline ID (pre or post)', () => {
      const baselineId = 'baseline-123';
      const tracking1 = createTestTracking({ preBaselineId: baselineId });
      const tracking2 = createTestTracking({ postBaselineId: baselineId });
      const tracking3 = createTestTracking();
      indexTracking(db, tracking1, '/path/1.json');
      indexTracking(db, tracking2, '/path/2.json');
      indexTracking(db, tracking3, '/path/3.json');

      const results = queryTrackings(db, { baselineId });
      expect(results.length).toBe(2);
    });

    it('should filter by date range', () => {
      const tracking1 = createTestTracking({ detectedAt: '2026-01-15T10:00:00Z' });
      const tracking2 = createTestTracking({ detectedAt: '2026-01-17T10:00:00Z' });
      const tracking3 = createTestTracking({ detectedAt: '2026-01-19T10:00:00Z' });
      indexTracking(db, tracking1, '/path/1.json');
      indexTracking(db, tracking2, '/path/2.json');
      indexTracking(db, tracking3, '/path/3.json');

      const results = queryTrackings(db, {
        after: '2026-01-16T00:00:00Z',
        before: '2026-01-18T00:00:00Z',
      });
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe(tracking2.id);
    });

    it('should filter by effectiveness range', () => {
      const tracking1 = createTestTracking({ effectivenessScore: 30 });
      const tracking2 = createTestTracking({ effectivenessScore: 60 });
      const tracking3 = createTestTracking({ effectivenessScore: 90 });
      indexTracking(db, tracking1, '/path/1.json');
      indexTracking(db, tracking2, '/path/2.json');
      indexTracking(db, tracking3, '/path/3.json');

      const results = queryTrackings(db, {
        minEffectiveness: 50,
        maxEffectiveness: 80,
      });
      expect(results.length).toBe(1);
      expect(results[0]?.effectivenessScore).toBe(60);
    });

    it('should respect limit', () => {
      for (let i = 0; i < 10; i++) {
        const tracking = createTestTracking();
        indexTracking(db, tracking, `/path/${i}.json`);
      }

      const results = queryTrackings(db, { limit: 5 });
      expect(results.length).toBe(5);
    });

    it('should order by detected date descending by default', () => {
      const tracking1 = createTestTracking({ detectedAt: '2026-01-15T10:00:00Z' });
      const tracking2 = createTestTracking({ detectedAt: '2026-01-17T10:00:00Z' });
      indexTracking(db, tracking1, '/path/1.json');
      indexTracking(db, tracking2, '/path/2.json');

      const results = queryTrackings(db);
      expect(results[0]?.id).toBe(tracking2.id); // More recent first
      expect(results[1]?.id).toBe(tracking1.id);
    });

    it('should order by effectiveness score', () => {
      const tracking1 = createTestTracking({ effectivenessScore: 30 });
      const tracking2 = createTestTracking({ effectivenessScore: 90 });
      const tracking3 = createTestTracking({ effectivenessScore: 60 });
      indexTracking(db, tracking1, '/path/1.json');
      indexTracking(db, tracking2, '/path/2.json');
      indexTracking(db, tracking3, '/path/3.json');

      const resultsDesc = queryTrackings(db, { orderBy: 'effectivenessScore', order: 'desc' });
      expect(resultsDesc[0]?.effectivenessScore).toBe(90);
      expect(resultsDesc[1]?.effectivenessScore).toBe(60);
      expect(resultsDesc[2]?.effectivenessScore).toBe(30);

      const resultsAsc = queryTrackings(db, { orderBy: 'effectivenessScore', order: 'asc' });
      expect(resultsAsc[0]?.effectivenessScore).toBe(30);
    });
  });

  describe('getTrackingsByRecommendation', () => {
    it('should get trackings for specific recommendation', () => {
      const tracking1 = createTestTracking({ recommendationId: 'REC-001' });
      const tracking2 = createTestTracking({ recommendationId: 'REC-001' });
      const tracking3 = createTestTracking({ recommendationId: 'REC-002' });
      indexTracking(db, tracking1, '/path/1.json');
      indexTracking(db, tracking2, '/path/2.json');
      indexTracking(db, tracking3, '/path/3.json');

      const results = getTrackingsByRecommendation(db, 'REC-001');
      expect(results.length).toBe(2);
    });
  });

  describe('getTrackingsByStatus', () => {
    it('should get trackings by status', () => {
      const tracking1 = createTestTracking({ status: 'pending' });
      const tracking2 = createTestTracking({ status: 'implemented' });
      const tracking3 = createTestTracking({ status: 'pending' });
      indexTracking(db, tracking1, '/path/1.json');
      indexTracking(db, tracking2, '/path/2.json');
      indexTracking(db, tracking3, '/path/3.json');

      expect(getTrackingsByStatus(db, 'pending').length).toBe(2);
      expect(getTrackingsByStatus(db, 'implemented').length).toBe(1);
      expect(getTrackingsByStatus(db, 'rejected').length).toBe(0);
    });
  });

  describe('countTrackings', () => {
    it('should count all trackings', () => {
      for (let i = 0; i < 5; i++) {
        const tracking = createTestTracking();
        indexTracking(db, tracking, `/path/${i}.json`);
      }

      expect(countTrackings(db)).toBe(5);
    });

    it('should count filtered trackings', () => {
      const tracking1 = createTestTracking({ status: 'pending' });
      const tracking2 = createTestTracking({ status: 'implemented' });
      const tracking3 = createTestTracking({ status: 'pending' });
      indexTracking(db, tracking1, '/path/1.json');
      indexTracking(db, tracking2, '/path/2.json');
      indexTracking(db, tracking3, '/path/3.json');

      expect(countTrackings(db, { status: 'pending' })).toBe(2);
      expect(countTrackings(db, { status: 'implemented' })).toBe(1);
    });
  });
});
