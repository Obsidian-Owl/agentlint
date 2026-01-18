/**
 * Unit tests for recommendation tracking storage.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  saveTracking,
  loadTracking,
  loadTrackingOrThrow,
  updateStatus,
  deleteTracking,
  listTrackingIds,
  loadTrackingByRecommendation,
  loadTrackingByStatus,
  trackingExists,
} from '../../../../src/persistence/tracking/storage';
import type { RecommendationTracking } from '../../../../src/temporal/types';

// =============================================================================
// Test Setup
// =============================================================================

let testDir: string;
let trackingDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'agentlint-tracking-test-'));
  trackingDir = join(testDir, '.agentlint', 'tracking');
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

// =============================================================================
// Test Helpers
// =============================================================================

function createTestTracking(
  overrides: Partial<RecommendationTracking> = {}
): RecommendationTracking {
  return {
    id: crypto.randomUUID(),
    recommendationId: 'rec-001',
    recommendationText: 'Add credential guidance to CLAUDE.md',
    status: 'pending',
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Tracking Storage', () => {
  describe('saveTracking', () => {
    test('should save tracking record to disk', async () => {
      const tracking = createTestTracking();
      const filePath = await saveTracking(tracking, { baseDir: trackingDir });

      expect(filePath).toContain(tracking.id);
      expect(filePath).toEndWith('.json');
    });

    test('should throw on missing required fields', async () => {
      const invalid = { id: 'test' } as RecommendationTracking;

      await expect(saveTracking(invalid, { baseDir: trackingDir })).rejects.toThrow(
        'missing required fields'
      );
    });

    test('should throw on invalid effectiveness score', async () => {
      const tracking = createTestTracking({ effectivenessScore: 150 });

      await expect(saveTracking(tracking, { baseDir: trackingDir })).rejects.toThrow(
        'effectivenessScore must be between 0 and 100'
      );
    });

    test('should accept valid effectiveness score', async () => {
      const tracking = createTestTracking({ effectivenessScore: 85 });

      const filePath = await saveTracking(tracking, { baseDir: trackingDir });
      expect(filePath).toBeDefined();
    });
  });

  describe('loadTracking', () => {
    test('should load saved tracking record', async () => {
      const tracking = createTestTracking();
      await saveTracking(tracking, { baseDir: trackingDir });

      const loaded = await loadTracking(tracking.id, { baseDir: trackingDir });

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(tracking.id);
      expect(loaded?.recommendationId).toBe(tracking.recommendationId);
      expect(loaded?.status).toBe('pending');
    });

    test('should return null for non-existent tracking', async () => {
      const loaded = await loadTracking('nonexistent', { baseDir: trackingDir });
      expect(loaded).toBeNull();
    });
  });

  describe('loadTrackingOrThrow', () => {
    test('should return tracking when found', async () => {
      const tracking = createTestTracking();
      await saveTracking(tracking, { baseDir: trackingDir });

      const loaded = await loadTrackingOrThrow(tracking.id, { baseDir: trackingDir });
      expect(loaded.id).toBe(tracking.id);
    });

    test('should throw when not found', async () => {
      await expect(loadTrackingOrThrow('nonexistent', { baseDir: trackingDir })).rejects.toThrow(
        'Tracking record not found'
      );
    });
  });

  describe('updateStatus', () => {
    test('should update status field', async () => {
      const tracking = createTestTracking();
      await saveTracking(tracking, { baseDir: trackingDir });

      const updated = await updateStatus(
        tracking.id,
        { status: 'implemented' },
        { baseDir: trackingDir }
      );

      expect(updated.status).toBe('implemented');
      expect(updated.id).toBe(tracking.id);
    });

    test('should update multiple fields', async () => {
      const tracking = createTestTracking();
      await saveTracking(tracking, { baseDir: trackingDir });

      const now = new Date().toISOString();
      const updated = await updateStatus(
        tracking.id,
        {
          status: 'implemented',
          confirmedAt: now,
          effectivenessScore: 75,
          notes: 'Works great!',
        },
        { baseDir: trackingDir }
      );

      expect(updated.status).toBe('implemented');
      expect(updated.confirmedAt).toBe(now);
      expect(updated.effectivenessScore).toBe(75);
      expect(updated.notes).toBe('Works great!');
    });

    test('should persist updates to disk', async () => {
      const tracking = createTestTracking();
      await saveTracking(tracking, { baseDir: trackingDir });

      await updateStatus(tracking.id, { status: 'implemented' }, { baseDir: trackingDir });

      // Reload from disk
      const loaded = await loadTracking(tracking.id, { baseDir: trackingDir });
      expect(loaded?.status).toBe('implemented');
    });

    test('should throw when tracking not found', async () => {
      await expect(
        updateStatus('nonexistent', { status: 'implemented' }, { baseDir: trackingDir })
      ).rejects.toThrow('not found');
    });
  });

  describe('deleteTracking', () => {
    test('should delete existing tracking', async () => {
      const tracking = createTestTracking();
      await saveTracking(tracking, { baseDir: trackingDir });

      const deleted = deleteTracking(tracking.id, { baseDir: trackingDir });

      expect(deleted).toBe(true);
      expect(await loadTracking(tracking.id, { baseDir: trackingDir })).toBeNull();
    });

    test('should return false for non-existent tracking', () => {
      const deleted = deleteTracking('nonexistent', { baseDir: trackingDir });
      expect(deleted).toBe(false);
    });
  });

  describe('listTrackingIds', () => {
    test('should return empty array when no trackings', () => {
      const ids = listTrackingIds({ baseDir: trackingDir });
      expect(ids).toEqual([]);
    });

    test('should return all tracking IDs', async () => {
      const tracking1 = createTestTracking();
      const tracking2 = createTestTracking();
      const tracking3 = createTestTracking();

      await saveTracking(tracking1, { baseDir: trackingDir });
      await saveTracking(tracking2, { baseDir: trackingDir });
      await saveTracking(tracking3, { baseDir: trackingDir });

      const ids = listTrackingIds({ baseDir: trackingDir });

      expect(ids.length).toBe(3);
      expect(ids).toContain(tracking1.id);
      expect(ids).toContain(tracking2.id);
      expect(ids).toContain(tracking3.id);
    });
  });

  describe('loadTrackingByRecommendation', () => {
    test('should filter by recommendation ID', async () => {
      const tracking1 = createTestTracking({ recommendationId: 'rec-A' });
      const tracking2 = createTestTracking({ recommendationId: 'rec-A' });
      const tracking3 = createTestTracking({ recommendationId: 'rec-B' });

      await saveTracking(tracking1, { baseDir: trackingDir });
      await saveTracking(tracking2, { baseDir: trackingDir });
      await saveTracking(tracking3, { baseDir: trackingDir });

      const results = await loadTrackingByRecommendation('rec-A', { baseDir: trackingDir });

      expect(results.length).toBe(2);
      expect(results.every((t) => t.recommendationId === 'rec-A')).toBe(true);
    });

    test('should return empty array when no matches', async () => {
      const tracking = createTestTracking({ recommendationId: 'rec-A' });
      await saveTracking(tracking, { baseDir: trackingDir });

      const results = await loadTrackingByRecommendation('rec-B', { baseDir: trackingDir });
      expect(results).toEqual([]);
    });
  });

  describe('loadTrackingByStatus', () => {
    test('should filter by status', async () => {
      const pending = createTestTracking({ status: 'pending' });
      const implemented = createTestTracking({ status: 'implemented' });
      const partial = createTestTracking({ status: 'partial' });

      await saveTracking(pending, { baseDir: trackingDir });
      await saveTracking(implemented, { baseDir: trackingDir });
      await saveTracking(partial, { baseDir: trackingDir });

      const pendingResults = await loadTrackingByStatus('pending', { baseDir: trackingDir });
      expect(pendingResults.length).toBe(1);
      expect(pendingResults[0]?.id).toBe(pending.id);

      const implementedResults = await loadTrackingByStatus('implemented', {
        baseDir: trackingDir,
      });
      expect(implementedResults.length).toBe(1);
      expect(implementedResults[0]?.id).toBe(implemented.id);
    });
  });

  describe('trackingExists', () => {
    test('should return true for existing tracking', async () => {
      const tracking = createTestTracking();
      await saveTracking(tracking, { baseDir: trackingDir });

      expect(trackingExists(tracking.id, { baseDir: trackingDir })).toBe(true);
    });

    test('should return false for non-existent tracking', () => {
      expect(trackingExists('nonexistent', { baseDir: trackingDir })).toBe(false);
    });
  });
});
