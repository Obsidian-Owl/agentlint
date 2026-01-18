/**
 * Unit tests for temporal/tracking/api.ts
 *
 * Tests the recommendation tracking API functions:
 * - getRecommendation()
 * - updateRecommendationStatus()
 * - listRecommendations() with filters
 *
 * @module temporal/tracking/__tests__/api.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  getRecommendation,
  getRecommendationOrThrow,
  updateRecommendationStatus,
  listRecommendations,
  countRecommendations,
  getPendingConfirmations,
  getImplementedWithScores,
} from '../api';
import { saveTracking } from '../../../persistence/tracking';
import type { RecommendationTracking } from '../../types';

// =============================================================================
// Test Setup
// =============================================================================

let testDir: string;
let trackingDir: string;

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

beforeEach(() => {
  testDir = join(tmpdir(), `agentlint-api-test-${Date.now()}`);
  trackingDir = join(testDir, '.agentlint', 'tracking');
  mkdirSync(trackingDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

// =============================================================================
// Tests
// =============================================================================

describe('temporal/tracking/api', () => {
  describe('getRecommendation', () => {
    it('should return tracking by ID', async () => {
      const tracking = createTestTracking();
      await saveTracking(tracking, { baseDir: trackingDir });

      const result = await getRecommendation(tracking.id, { baseDir: trackingDir });

      expect(result).not.toBeNull();
      expect(result?.id).toBe(tracking.id);
      expect(result?.recommendationText).toBe(tracking.recommendationText);
    });

    it('should return null for non-existent ID', async () => {
      const result = await getRecommendation('non-existent', { baseDir: trackingDir });
      expect(result).toBeNull();
    });
  });

  describe('getRecommendationOrThrow', () => {
    it('should return tracking by ID', async () => {
      const tracking = createTestTracking();
      await saveTracking(tracking, { baseDir: trackingDir });

      const result = await getRecommendationOrThrow(tracking.id, { baseDir: trackingDir });

      expect(result.id).toBe(tracking.id);
    });

    it('should throw for non-existent ID', async () => {
      let error: Error | undefined;
      try {
        await getRecommendationOrThrow('non-existent', { baseDir: trackingDir });
      } catch (e) {
        error = e as Error;
      }
      expect(error?.message).toContain('Tracking record not found');
    });
  });

  describe('updateRecommendationStatus', () => {
    it('should update tracking status', async () => {
      const tracking = createTestTracking({ status: 'pending' });
      await saveTracking(tracking, { baseDir: trackingDir });

      const updated = await updateRecommendationStatus(
        tracking.id,
        { status: 'implemented' },
        { baseDir: trackingDir }
      );

      expect(updated.status).toBe('implemented');
    });

    it('should update multiple fields', async () => {
      const tracking = createTestTracking();
      await saveTracking(tracking, { baseDir: trackingDir });

      const updated = await updateRecommendationStatus(
        tracking.id,
        {
          status: 'implemented',
          confirmedAt: '2026-01-18T12:00:00Z',
          effectivenessScore: 90,
          notes: 'Great improvement!',
        },
        { baseDir: trackingDir }
      );

      expect(updated.status).toBe('implemented');
      expect(updated.confirmedAt).toBe('2026-01-18T12:00:00Z');
      expect(updated.effectivenessScore).toBe(90);
      expect(updated.notes).toBe('Great improvement!');
    });

    it('should throw for non-existent tracking', async () => {
      let error: Error | undefined;
      try {
        await updateRecommendationStatus(
          'non-existent',
          { status: 'implemented' },
          { baseDir: trackingDir }
        );
      } catch (e) {
        error = e as Error;
      }
      expect(error?.message).toContain('Tracking record not found');
    });
  });

  describe('listRecommendations', () => {
    it('should list all recommendations when no filter provided', async () => {
      const tracking1 = createTestTracking({ status: 'pending' });
      const tracking2 = createTestTracking({ status: 'implemented' });
      await saveTracking(tracking1, { baseDir: trackingDir });
      await saveTracking(tracking2, { baseDir: trackingDir });

      const results = await listRecommendations({}, { baseDir: trackingDir });

      expect(results.length).toBe(2);
    });

    it('should filter by status', async () => {
      const pending1 = createTestTracking({ status: 'pending' });
      const pending2 = createTestTracking({ status: 'pending' });
      const implemented = createTestTracking({ status: 'implemented' });
      await saveTracking(pending1, { baseDir: trackingDir });
      await saveTracking(pending2, { baseDir: trackingDir });
      await saveTracking(implemented, { baseDir: trackingDir });

      const pendingResults = await listRecommendations(
        { status: 'pending' },
        { baseDir: trackingDir }
      );
      const implementedResults = await listRecommendations(
        { status: 'implemented' },
        { baseDir: trackingDir }
      );

      expect(pendingResults.length).toBe(2);
      expect(implementedResults.length).toBe(1);
    });

    it('should filter by recommendationId', async () => {
      const rec1a = createTestTracking({ recommendationId: 'REC-001' });
      const rec1b = createTestTracking({ recommendationId: 'REC-001' });
      const rec2 = createTestTracking({ recommendationId: 'REC-002' });
      await saveTracking(rec1a, { baseDir: trackingDir });
      await saveTracking(rec1b, { baseDir: trackingDir });
      await saveTracking(rec2, { baseDir: trackingDir });

      const results = await listRecommendations(
        { recommendationId: 'REC-001' },
        { baseDir: trackingDir }
      );

      expect(results.length).toBe(2);
      expect(results.every((r) => r.recommendationId === 'REC-001')).toBe(true);
    });

    it('should filter by hasPreBaseline', async () => {
      const withPre = createTestTracking({ preBaselineId: 'baseline-1' });
      const withoutPre = createTestTracking();
      await saveTracking(withPre, { baseDir: trackingDir });
      await saveTracking(withoutPre, { baseDir: trackingDir });

      const withPreResults = await listRecommendations(
        { hasPreBaseline: true },
        { baseDir: trackingDir }
      );
      const withoutPreResults = await listRecommendations(
        { hasPreBaseline: false },
        { baseDir: trackingDir }
      );

      expect(withPreResults.length).toBe(1);
      expect(withPreResults[0]?.preBaselineId).toBe('baseline-1');
      expect(withoutPreResults.length).toBe(1);
      expect(withoutPreResults[0]?.preBaselineId).toBeUndefined();
    });

    it('should filter by hasPostBaseline', async () => {
      const withPost = createTestTracking({ postBaselineId: 'baseline-2' });
      const withoutPost = createTestTracking();
      await saveTracking(withPost, { baseDir: trackingDir });
      await saveTracking(withoutPost, { baseDir: trackingDir });

      const withPostResults = await listRecommendations(
        { hasPostBaseline: true },
        { baseDir: trackingDir }
      );

      expect(withPostResults.length).toBe(1);
      expect(withPostResults[0]?.postBaselineId).toBe('baseline-2');
    });

    it('should filter by hasEffectivenessScore', async () => {
      const withScore = createTestTracking({ effectivenessScore: 85 });
      const withoutScore = createTestTracking();
      await saveTracking(withScore, { baseDir: trackingDir });
      await saveTracking(withoutScore, { baseDir: trackingDir });

      const withScoreResults = await listRecommendations(
        { hasEffectivenessScore: true },
        { baseDir: trackingDir }
      );

      expect(withScoreResults.length).toBe(1);
      expect(withScoreResults[0]?.effectivenessScore).toBe(85);
    });

    it('should apply multiple filters', async () => {
      const match = createTestTracking({ status: 'implemented', recommendationId: 'REC-001' });
      const noMatchStatus = createTestTracking({ status: 'pending', recommendationId: 'REC-001' });
      const noMatchRec = createTestTracking({ status: 'implemented', recommendationId: 'REC-002' });
      await saveTracking(match, { baseDir: trackingDir });
      await saveTracking(noMatchStatus, { baseDir: trackingDir });
      await saveTracking(noMatchRec, { baseDir: trackingDir });

      const results = await listRecommendations(
        { status: 'implemented', recommendationId: 'REC-001' },
        { baseDir: trackingDir }
      );

      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe(match.id);
    });

    it('should sort by detectedAt', async () => {
      const older = createTestTracking({ detectedAt: '2026-01-01T10:00:00Z' });
      const newer = createTestTracking({ detectedAt: '2026-01-15T10:00:00Z' });
      await saveTracking(older, { baseDir: trackingDir });
      await saveTracking(newer, { baseDir: trackingDir });

      const ascResults = await listRecommendations(
        {},
        { baseDir: trackingDir, sortBy: 'detectedAt', sortOrder: 'asc' }
      );
      const descResults = await listRecommendations(
        {},
        { baseDir: trackingDir, sortBy: 'detectedAt', sortOrder: 'desc' }
      );

      expect(ascResults[0]?.detectedAt).toBe('2026-01-01T10:00:00Z');
      expect(descResults[0]?.detectedAt).toBe('2026-01-15T10:00:00Z');
    });

    it('should sort by effectivenessScore', async () => {
      const low = createTestTracking({ effectivenessScore: 30 });
      const high = createTestTracking({ effectivenessScore: 95 });
      await saveTracking(low, { baseDir: trackingDir });
      await saveTracking(high, { baseDir: trackingDir });

      const descResults = await listRecommendations(
        {},
        { baseDir: trackingDir, sortBy: 'effectivenessScore', sortOrder: 'desc' }
      );

      expect(descResults[0]?.effectivenessScore).toBe(95);
    });

    it('should apply limit', async () => {
      await saveTracking(createTestTracking(), { baseDir: trackingDir });
      await saveTracking(createTestTracking(), { baseDir: trackingDir });
      await saveTracking(createTestTracking(), { baseDir: trackingDir });

      const results = await listRecommendations({}, { baseDir: trackingDir, limit: 2 });

      expect(results.length).toBe(2);
    });
  });

  describe('countRecommendations', () => {
    it('should count all recommendations', async () => {
      await saveTracking(createTestTracking(), { baseDir: trackingDir });
      await saveTracking(createTestTracking(), { baseDir: trackingDir });
      await saveTracking(createTestTracking(), { baseDir: trackingDir });

      const count = await countRecommendations({}, { baseDir: trackingDir });

      expect(count).toBe(3);
    });

    it('should count with filter', async () => {
      await saveTracking(createTestTracking({ status: 'pending' }), { baseDir: trackingDir });
      await saveTracking(createTestTracking({ status: 'pending' }), { baseDir: trackingDir });
      await saveTracking(createTestTracking({ status: 'implemented' }), { baseDir: trackingDir });

      const pendingCount = await countRecommendations(
        { status: 'pending' },
        { baseDir: trackingDir }
      );
      const implementedCount = await countRecommendations(
        { status: 'implemented' },
        { baseDir: trackingDir }
      );

      expect(pendingCount).toBe(2);
      expect(implementedCount).toBe(1);
    });
  });

  describe('getPendingConfirmations', () => {
    it('should return only detected_pending_confirm status', async () => {
      await saveTracking(createTestTracking({ status: 'pending' }), { baseDir: trackingDir });
      await saveTracking(createTestTracking({ status: 'detected_pending_confirm' }), {
        baseDir: trackingDir,
      });
      await saveTracking(createTestTracking({ status: 'detected_pending_confirm' }), {
        baseDir: trackingDir,
      });
      await saveTracking(createTestTracking({ status: 'implemented' }), { baseDir: trackingDir });

      const results = await getPendingConfirmations({ baseDir: trackingDir });

      expect(results.length).toBe(2);
      expect(results.every((r) => r.status === 'detected_pending_confirm')).toBe(true);
    });
  });

  describe('getImplementedWithScores', () => {
    it('should return implemented recommendations with scores sorted by score desc', async () => {
      await saveTracking(createTestTracking({ status: 'implemented', effectivenessScore: 70 }), {
        baseDir: trackingDir,
      });
      await saveTracking(createTestTracking({ status: 'implemented', effectivenessScore: 95 }), {
        baseDir: trackingDir,
      });
      await saveTracking(
        createTestTracking({ status: 'implemented' }), // No score
        { baseDir: trackingDir }
      );
      await saveTracking(createTestTracking({ status: 'pending', effectivenessScore: 80 }), {
        baseDir: trackingDir,
      });

      const results = await getImplementedWithScores({ baseDir: trackingDir });

      expect(results.length).toBe(2);
      expect(results[0]?.effectivenessScore).toBe(95);
      expect(results[1]?.effectivenessScore).toBe(70);
    });
  });
});
