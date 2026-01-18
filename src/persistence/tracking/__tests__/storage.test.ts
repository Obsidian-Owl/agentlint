/**
 * Unit tests for persistence/tracking/storage.ts
 *
 * Tests recommendation tracking storage operations: save, load, update, delete.
 *
 * @module persistence/tracking/__tests__/storage.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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
  getTrackingDir,
  getCurrentVersion,
} from '../storage';
import type { RecommendationTracking } from '../../../temporal/types';

// =============================================================================
// Test Setup
// =============================================================================

let testDir: string;
let trackingDir: string;

function createTestTracking(overrides: Partial<RecommendationTracking> = {}): RecommendationTracking {
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
  testDir = join(tmpdir(), `agentlint-tracking-test-${Date.now()}`);
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

describe('persistence/tracking/storage', () => {
  describe('getCurrentVersion', () => {
    it('should return a valid version string', () => {
      const version = getCurrentVersion();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('getTrackingDir', () => {
    it('should return path with tracking subdirectory', () => {
      const dir = getTrackingDir(testDir);
      expect(dir).toContain('.agentlint');
      expect(dir).toContain('tracking');
    });
  });

  describe('saveTracking', () => {
    it('should save tracking to JSON file', async () => {
      const tracking = createTestTracking();

      const filePath = await saveTracking(tracking, { baseDir: trackingDir });

      expect(existsSync(filePath)).toBe(true);
      expect(filePath).toContain(`${tracking.id}.json`);
    });

    it('should include version in file', async () => {
      const tracking = createTestTracking();

      const filePath = await saveTracking(tracking, { baseDir: trackingDir });
      const content = JSON.parse(await Bun.file(filePath).text()) as {
        version: string;
        tracking: { id: string };
      };

      expect(content.version).toBe(getCurrentVersion());
      expect(content.tracking.id).toBe(tracking.id);
    });

    it('should throw for missing required fields', async () => {
      const invalid = { id: 'test' } as unknown as RecommendationTracking;

      let error: Error | undefined;
      try {
        await saveTracking(invalid, { baseDir: trackingDir });
      } catch (e) {
        error = e as Error;
      }
      expect(error?.message).toContain('missing required fields');
    });

    it('should throw for invalid effectiveness score', async () => {
      const tracking = createTestTracking({ effectivenessScore: 150 });

      let error: Error | undefined;
      try {
        await saveTracking(tracking, { baseDir: trackingDir });
      } catch (e) {
        error = e as Error;
      }
      expect(error?.message).toContain('effectivenessScore must be between 0 and 100');
    });
  });

  describe('loadTracking', () => {
    it('should load saved tracking', async () => {
      const tracking = createTestTracking();
      await saveTracking(tracking, { baseDir: trackingDir });

      const loaded = await loadTracking(tracking.id, { baseDir: trackingDir });

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(tracking.id);
      expect(loaded?.recommendationId).toBe(tracking.recommendationId);
      expect(loaded?.status).toBe(tracking.status);
    });

    it('should return null for non-existent ID', async () => {
      const loaded = await loadTracking('non-existent-id', { baseDir: trackingDir });
      expect(loaded).toBeNull();
    });
  });

  describe('loadTrackingOrThrow', () => {
    it('should load existing tracking', async () => {
      const tracking = createTestTracking();
      await saveTracking(tracking, { baseDir: trackingDir });

      const loaded = await loadTrackingOrThrow(tracking.id, { baseDir: trackingDir });

      expect(loaded.id).toBe(tracking.id);
    });

    it('should throw for non-existent ID', async () => {
      let error: Error | undefined;
      try {
        await loadTrackingOrThrow('non-existent', { baseDir: trackingDir });
      } catch (e) {
        error = e as Error;
      }
      expect(error?.message).toContain('Tracking record not found');
    });
  });

  describe('updateStatus', () => {
    it('should update tracking status', async () => {
      const tracking = createTestTracking({ status: 'pending' });
      await saveTracking(tracking, { baseDir: trackingDir });

      const updated = await updateStatus(
        tracking.id,
        { status: 'implemented' },
        { baseDir: trackingDir }
      );

      expect(updated.status).toBe('implemented');

      // Verify persisted
      const reloaded = await loadTracking(tracking.id, { baseDir: trackingDir });
      expect(reloaded?.status).toBe('implemented');
    });

    it('should update multiple fields', async () => {
      const tracking = createTestTracking();
      await saveTracking(tracking, { baseDir: trackingDir });

      const updated = await updateStatus(
        tracking.id,
        {
          status: 'implemented',
          confirmedAt: '2026-01-18T12:00:00Z',
          effectivenessScore: 85,
          notes: 'Works great!',
        },
        { baseDir: trackingDir }
      );

      expect(updated.status).toBe('implemented');
      expect(updated.confirmedAt).toBe('2026-01-18T12:00:00Z');
      expect(updated.effectivenessScore).toBe(85);
      expect(updated.notes).toBe('Works great!');
    });

    it('should throw for non-existent tracking', async () => {
      let error: Error | undefined;
      try {
        await updateStatus('non-existent', { status: 'implemented' }, { baseDir: trackingDir });
      } catch (e) {
        error = e as Error;
      }
      expect(error?.message).toContain('Tracking record not found');
    });
  });

  describe('deleteTracking', () => {
    it('should delete existing tracking', async () => {
      const tracking = createTestTracking();
      await saveTracking(tracking, { baseDir: trackingDir });

      const deleted = deleteTracking(tracking.id, { baseDir: trackingDir });

      expect(deleted).toBe(true);
      expect(await loadTracking(tracking.id, { baseDir: trackingDir })).toBeNull();
    });

    it('should return false for non-existent tracking', () => {
      const deleted = deleteTracking('non-existent', { baseDir: trackingDir });
      expect(deleted).toBe(false);
    });
  });

  describe('listTrackingIds', () => {
    it('should list all tracking IDs', async () => {
      const tracking1 = createTestTracking();
      const tracking2 = createTestTracking();
      await saveTracking(tracking1, { baseDir: trackingDir });
      await saveTracking(tracking2, { baseDir: trackingDir });

      const ids = listTrackingIds({ baseDir: trackingDir });

      expect(ids.length).toBe(2);
      expect(ids).toContain(tracking1.id);
      expect(ids).toContain(tracking2.id);
    });

    it('should return empty array for empty directory', () => {
      const emptyDir = join(testDir, 'empty');
      mkdirSync(emptyDir, { recursive: true });

      const ids = listTrackingIds({ baseDir: emptyDir });
      expect(ids).toEqual([]);
    });

    it('should return empty array for non-existent directory', () => {
      const ids = listTrackingIds({ baseDir: join(testDir, 'nonexistent') });
      expect(ids).toEqual([]);
    });
  });

  describe('loadTrackingByRecommendation', () => {
    it('should filter by recommendation ID', async () => {
      const tracking1 = createTestTracking({ recommendationId: 'REC-001' });
      const tracking2 = createTestTracking({ recommendationId: 'REC-001' });
      const tracking3 = createTestTracking({ recommendationId: 'REC-002' });
      await saveTracking(tracking1, { baseDir: trackingDir });
      await saveTracking(tracking2, { baseDir: trackingDir });
      await saveTracking(tracking3, { baseDir: trackingDir });

      const results = await loadTrackingByRecommendation('REC-001', { baseDir: trackingDir });

      expect(results.length).toBe(2);
      expect(results.every((t) => t.recommendationId === 'REC-001')).toBe(true);
    });

    it('should return empty array for no matches', async () => {
      const tracking = createTestTracking({ recommendationId: 'REC-001' });
      await saveTracking(tracking, { baseDir: trackingDir });

      const results = await loadTrackingByRecommendation('REC-999', { baseDir: trackingDir });
      expect(results).toEqual([]);
    });
  });

  describe('loadTrackingByStatus', () => {
    it('should filter by status', async () => {
      const tracking1 = createTestTracking({ status: 'pending' });
      const tracking2 = createTestTracking({ status: 'implemented' });
      const tracking3 = createTestTracking({ status: 'pending' });
      await saveTracking(tracking1, { baseDir: trackingDir });
      await saveTracking(tracking2, { baseDir: trackingDir });
      await saveTracking(tracking3, { baseDir: trackingDir });

      const pendingResults = await loadTrackingByStatus('pending', { baseDir: trackingDir });
      const implementedResults = await loadTrackingByStatus('implemented', { baseDir: trackingDir });

      expect(pendingResults.length).toBe(2);
      expect(implementedResults.length).toBe(1);
    });
  });

  describe('trackingExists', () => {
    it('should return true for existing tracking', async () => {
      const tracking = createTestTracking();
      await saveTracking(tracking, { baseDir: trackingDir });

      expect(trackingExists(tracking.id, { baseDir: trackingDir })).toBe(true);
    });

    it('should return false for non-existent tracking', () => {
      expect(trackingExists('non-existent', { baseDir: trackingDir })).toBe(false);
    });
  });
});
