/**
 * Unit tests for recommendations/storage/storage.ts
 *
 * Tests recommendation storage operations: save, load, list, delete.
 *
 * @module recommendations/__tests__/storage.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  saveRecommendation,
  loadRecommendation,
  loadRecommendationOrThrow,
  deleteRecommendation,
  listRecommendationIds,
  recommendationExists,
  getRecommendationsDir,
  getCurrentVersion,
} from '../storage';
import type { Recommendation, RecommendationEvent } from '../types';

// =============================================================================
// Test Setup
// =============================================================================

let testDir: string;
let recommendationsDir: string;

function createTestEvent(overrides: Partial<RecommendationEvent> = {}): RecommendationEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'created',
    content: 'Initial recommendation created',
    ...overrides,
  };
}

function createTestRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: crypto.randomUUID(),
    projectPath: '/test/project',
    createdAt: new Date().toISOString(),
    type: 'preventive',
    action: 'Add error handling guidance to CLAUDE.md',
    target: 'CLAUDE.md',
    rationale: 'Session logs show repeated errors. Adding guidance prevents recurrence.',
    priority: 'high',
    tracedOrigin: {
      sessionId: 'session-123',
      configGap: 'Missing error handling instructions',
    },
    status: 'open',
    events: [createTestEvent()],
    ...overrides,
  };
}

beforeEach(() => {
  testDir = join(tmpdir(), `agentlint-recommendations-test-${Date.now()}`);
  recommendationsDir = join(testDir, '.agentlint', 'recommendations');
  mkdirSync(recommendationsDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

// =============================================================================
// Tests
// =============================================================================

describe('recommendations/storage', () => {
  describe('getCurrentVersion', () => {
    it('should return a valid version string', () => {
      const version = getCurrentVersion();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('getRecommendationsDir', () => {
    it('should return path with recommendations subdirectory', () => {
      const dir = getRecommendationsDir(testDir);
      expect(dir).toContain('.agentlint');
      expect(dir).toContain('recommendations');
    });
  });

  describe('saveRecommendation', () => {
    it('should save recommendation to JSON file', async () => {
      const recommendation = createTestRecommendation();

      const filePath = await saveRecommendation(recommendation, { baseDir: recommendationsDir });

      expect(existsSync(filePath)).toBe(true);
      expect(filePath).toContain(`${recommendation.id}.json`);
    });

    it('should include version in file', async () => {
      const recommendation = createTestRecommendation();

      const filePath = await saveRecommendation(recommendation, { baseDir: recommendationsDir });
      const content = JSON.parse(await Bun.file(filePath).text()) as {
        version: string;
        recommendation: { id: string };
      };

      expect(content.version).toBe(getCurrentVersion());
      expect(content.recommendation.id).toBe(recommendation.id);
    });

    it('should throw for missing required fields', async () => {
      const invalid = { id: 'test' } as unknown as Recommendation;

      let error: Error | undefined;
      try {
        await saveRecommendation(invalid, { baseDir: recommendationsDir });
      } catch (e) {
        error = e as Error;
      }
      expect(error).toBeDefined();
    });

    it('should throw for invalid tracedOrigin (no fields)', async () => {
      const recommendation = createTestRecommendation({
        tracedOrigin: {} as Recommendation['tracedOrigin'],
      });

      let error: Error | undefined;
      try {
        await saveRecommendation(recommendation, { baseDir: recommendationsDir });
      } catch (e) {
        error = e as Error;
      }
      expect(error?.message).toContain('traced origin');
    });

    it('should throw for event content exceeding 200 chars', async () => {
      const recommendation = createTestRecommendation({
        events: [createTestEvent({ content: 'x'.repeat(201) })],
      });

      let error: Error | undefined;
      try {
        await saveRecommendation(recommendation, { baseDir: recommendationsDir });
      } catch (e) {
        error = e as Error;
      }
      expect(error?.message).toContain('200');
    });

    it('should throw for empty events array', async () => {
      const recommendation = createTestRecommendation({ events: [] });

      let error: Error | undefined;
      try {
        await saveRecommendation(recommendation, { baseDir: recommendationsDir });
      } catch (e) {
        error = e as Error;
      }
      expect(error).toBeDefined();
    });
  });

  describe('loadRecommendation', () => {
    it('should load saved recommendation', async () => {
      const recommendation = createTestRecommendation();
      await saveRecommendation(recommendation, { baseDir: recommendationsDir });

      const loaded = await loadRecommendation(recommendation.id, { baseDir: recommendationsDir });

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(recommendation.id);
      expect(loaded?.action).toBe(recommendation.action);
      expect(loaded?.status).toBe(recommendation.status);
      expect(loaded?.events.length).toBe(1);
    });

    it('should return null for non-existent ID', async () => {
      const loaded = await loadRecommendation('non-existent-id', { baseDir: recommendationsDir });
      expect(loaded).toBeNull();
    });

    it('should preserve all fields', async () => {
      const recommendation = createTestRecommendation({
        completedAt: new Date().toISOString(),
        completionReason: 'implemented',
        supersededBy: crypto.randomUUID(),
      });
      await saveRecommendation(recommendation, { baseDir: recommendationsDir });

      const loaded = await loadRecommendation(recommendation.id, { baseDir: recommendationsDir });

      expect(loaded?.completedAt).toBe(recommendation.completedAt);
      expect(loaded?.completionReason).toBe(recommendation.completionReason);
      expect(loaded?.supersededBy).toBe(recommendation.supersededBy);
    });
  });

  describe('loadRecommendationOrThrow', () => {
    it('should load existing recommendation', async () => {
      const recommendation = createTestRecommendation();
      await saveRecommendation(recommendation, { baseDir: recommendationsDir });

      const loaded = await loadRecommendationOrThrow(recommendation.id, {
        baseDir: recommendationsDir,
      });

      expect(loaded.id).toBe(recommendation.id);
    });

    it('should throw for non-existent ID', async () => {
      let error: Error | undefined;
      try {
        await loadRecommendationOrThrow('non-existent', { baseDir: recommendationsDir });
      } catch (e) {
        error = e as Error;
      }
      expect(error?.message).toContain('not found');
    });
  });

  describe('deleteRecommendation', () => {
    it('should delete existing recommendation', async () => {
      const recommendation = createTestRecommendation();
      await saveRecommendation(recommendation, { baseDir: recommendationsDir });

      const deleted = deleteRecommendation(recommendation.id, { baseDir: recommendationsDir });

      expect(deleted).toBe(true);
      expect(await loadRecommendation(recommendation.id, { baseDir: recommendationsDir })).toBeNull();
    });

    it('should return false for non-existent recommendation', () => {
      const deleted = deleteRecommendation('non-existent', { baseDir: recommendationsDir });
      expect(deleted).toBe(false);
    });
  });

  describe('listRecommendationIds', () => {
    it('should list all recommendation IDs', async () => {
      const rec1 = createTestRecommendation();
      const rec2 = createTestRecommendation();
      await saveRecommendation(rec1, { baseDir: recommendationsDir });
      await saveRecommendation(rec2, { baseDir: recommendationsDir });

      const ids = listRecommendationIds({ baseDir: recommendationsDir });

      expect(ids.length).toBe(2);
      expect(ids).toContain(rec1.id);
      expect(ids).toContain(rec2.id);
    });

    it('should return empty array for empty directory', () => {
      const emptyDir = join(testDir, 'empty');
      mkdirSync(emptyDir, { recursive: true });

      const ids = listRecommendationIds({ baseDir: emptyDir });
      expect(ids).toEqual([]);
    });

    it('should return empty array for non-existent directory', () => {
      const ids = listRecommendationIds({ baseDir: join(testDir, 'nonexistent') });
      expect(ids).toEqual([]);
    });
  });

  describe('recommendationExists', () => {
    it('should return true for existing recommendation', async () => {
      const recommendation = createTestRecommendation();
      await saveRecommendation(recommendation, { baseDir: recommendationsDir });

      expect(recommendationExists(recommendation.id, { baseDir: recommendationsDir })).toBe(true);
    });

    it('should return false for non-existent recommendation', () => {
      expect(recommendationExists('non-existent', { baseDir: recommendationsDir })).toBe(false);
    });
  });

  describe('atomic write behavior', () => {
    it('should overwrite existing file on update', async () => {
      const recommendation = createTestRecommendation();
      await saveRecommendation(recommendation, { baseDir: recommendationsDir });

      // Update the recommendation
      const updated = { ...recommendation, status: 'implemented' as const };
      await saveRecommendation(updated, { baseDir: recommendationsDir });

      const loaded = await loadRecommendation(recommendation.id, { baseDir: recommendationsDir });
      expect(loaded?.status).toBe('implemented');

      // Should only have one file
      const ids = listRecommendationIds({ baseDir: recommendationsDir });
      expect(ids.length).toBe(1);
    });

    it('should add events to existing recommendation', async () => {
      const recommendation = createTestRecommendation();
      await saveRecommendation(recommendation, { baseDir: recommendationsDir });

      // Add a new event
      const newEvent = createTestEvent({ type: 'observation', content: 'New observation' });
      const updated = { ...recommendation, events: [...recommendation.events, newEvent] };
      await saveRecommendation(updated, { baseDir: recommendationsDir });

      const loaded = await loadRecommendation(recommendation.id, { baseDir: recommendationsDir });
      expect(loaded).not.toBeNull();
      expect(loaded!.events.length).toBe(2);
      expect(loaded!.events[1]?.type).toBe('observation');
    });
  });
});
