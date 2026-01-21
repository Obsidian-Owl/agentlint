/**
 * Unit tests for reviews storage
 *
 * Tests the qualitative review persistence: save, load, delete, list operations.
 *
 * @module tests/unit/persistence/reviews/storage.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  saveReview,
  loadReview,
  loadReviewOrThrow,
  deleteReview,
  listReviewIds,
  loadReviewsByBaseline,
  reviewExists,
  getLastReview,
  getReviewsDir,
  getCurrentVersion,
} from '../../../../src/persistence/reviews/storage';
import type { QualitativeReview } from '../../../../src/temporal/types';
import { ReviewNotFoundError } from '../../../../src/temporal/errors';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockReview(overrides: Partial<QualitativeReview> = {}): QualitativeReview {
  return {
    id: 'test-review-' + Math.random().toString(36).slice(2),
    baselineId: 'baseline-' + Math.random().toString(36).slice(2),
    createdAt: new Date().toISOString(),
    dimensions: [
      {
        name: 'taskFit',
        promptText: 'How well did the recommendations fit your tasks?',
        response: 'Very well',
        sentiment: 1,
      },
    ],
    overallSentiment: 1,
    themes: ['performance', 'quality'],
    freeformNotes: 'Test notes',
    triggerReason: 'manual',
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('reviews/storage', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `agentlint-reviews-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getCurrentVersion', () => {
    it('should return a semantic version string', () => {
      const version = getCurrentVersion();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('getReviewsDir', () => {
    it('should return path ending with reviews', () => {
      const dir = getReviewsDir('/some/project');
      expect(dir).toContain('reviews');
    });
  });

  describe('saveReview', () => {
    it('should save a review to disk', async () => {
      const review = createMockReview();
      const filePath = await saveReview(review, { baseDir: testDir });

      expect(existsSync(filePath)).toBe(true);
      expect(filePath).toContain(review.id);
    });

    it('should create directory if it does not exist', async () => {
      const newDir = join(testDir, 'nested', 'dir');
      const review = createMockReview();

      const filePath = await saveReview(review, { baseDir: newDir });
      expect(existsSync(filePath)).toBe(true);
    });

    it('should throw on missing required fields', async () => {
      const invalidReview = { overallSentiment: 0, dimensions: [], themes: [] } as unknown as QualitativeReview;

      await expect(saveReview(invalidReview, { baseDir: testDir })).rejects.toThrow(
        'missing required fields'
      );
    });

    it('should throw on invalid sentiment range (too low)', async () => {
      const review = createMockReview({ overallSentiment: -3 });

      await expect(saveReview(review, { baseDir: testDir })).rejects.toThrow(
        'overallSentiment must be between -2 and +2'
      );
    });

    it('should throw on invalid sentiment range (too high)', async () => {
      const review = createMockReview({ overallSentiment: 3 });

      await expect(saveReview(review, { baseDir: testDir })).rejects.toThrow(
        'overallSentiment must be between -2 and +2'
      );
    });

    it('should accept valid sentiment at boundaries', async () => {
      const reviewLow = createMockReview({ overallSentiment: -2 });
      const reviewHigh = createMockReview({ overallSentiment: 2 });

      const pathLow = await saveReview(reviewLow, { baseDir: testDir });
      const pathHigh = await saveReview(reviewHigh, { baseDir: testDir });

      expect(existsSync(pathLow)).toBe(true);
      expect(existsSync(pathHigh)).toBe(true);
    });
  });

  describe('loadReview', () => {
    it('should load a saved review', async () => {
      const review = createMockReview();
      await saveReview(review, { baseDir: testDir });

      const loaded = await loadReview(review.id, { baseDir: testDir });

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(review.id);
      expect(loaded!.baselineId).toBe(review.baselineId);
      expect(loaded!.overallSentiment).toBe(review.overallSentiment);
    });

    it('should return null for non-existent review', async () => {
      const loaded = await loadReview('non-existent-id', { baseDir: testDir });
      expect(loaded).toBeNull();
    });

    it('should return null for invalid JSON file', async () => {
      const invalidPath = join(testDir, 'invalid.json');
      writeFileSync(invalidPath, 'not valid json {{{');

      const loaded = await loadReview('invalid', { baseDir: testDir });
      expect(loaded).toBeNull();
    });

    it('should return null for file missing version field', async () => {
      const filePath = join(testDir, 'no-version.json');
      writeFileSync(filePath, JSON.stringify({ review: { id: 'test' } }));

      const loaded = await loadReview('no-version', { baseDir: testDir });
      expect(loaded).toBeNull();
    });

    it('should return null for file missing review field', async () => {
      const filePath = join(testDir, 'no-review.json');
      writeFileSync(filePath, JSON.stringify({ version: '1.0.0' }));

      const loaded = await loadReview('no-review', { baseDir: testDir });
      expect(loaded).toBeNull();
    });
  });

  describe('loadReviewOrThrow', () => {
    it('should load existing review', async () => {
      const review = createMockReview();
      await saveReview(review, { baseDir: testDir });

      const loaded = await loadReviewOrThrow(review.id, { baseDir: testDir });
      expect(loaded.id).toBe(review.id);
    });

    it('should throw ReviewNotFoundError for non-existent review', async () => {
      await expect(
        loadReviewOrThrow('non-existent-id', { baseDir: testDir })
      ).rejects.toBeInstanceOf(ReviewNotFoundError);
    });
  });

  describe('deleteReview', () => {
    it('should delete an existing review', async () => {
      const review = createMockReview();
      await saveReview(review, { baseDir: testDir });

      const deleted = deleteReview(review.id, { baseDir: testDir });

      expect(deleted).toBe(true);
      expect(existsSync(join(testDir, `${review.id}.json`))).toBe(false);
    });

    it('should return false for non-existent review', () => {
      const deleted = deleteReview('non-existent-id', { baseDir: testDir });
      expect(deleted).toBe(false);
    });
  });

  describe('listReviewIds', () => {
    it('should list all review IDs', async () => {
      const review1 = createMockReview({ id: 'review-1' });
      const review2 = createMockReview({ id: 'review-2' });
      const review3 = createMockReview({ id: 'review-3' });

      await saveReview(review1, { baseDir: testDir });
      await saveReview(review2, { baseDir: testDir });
      await saveReview(review3, { baseDir: testDir });

      const ids = listReviewIds({ baseDir: testDir });

      expect(ids.length).toBe(3);
      expect(ids).toContain('review-1');
      expect(ids).toContain('review-2');
      expect(ids).toContain('review-3');
    });

    it('should return empty array for empty directory', () => {
      const ids = listReviewIds({ baseDir: testDir });
      expect(ids).toEqual([]);
    });

    it('should return empty array for non-existent directory', () => {
      const ids = listReviewIds({ baseDir: '/non/existent/path' });
      expect(ids).toEqual([]);
    });

    it('should only include .json files', async () => {
      const review = createMockReview({ id: 'review-1' });
      await saveReview(review, { baseDir: testDir });

      // Create a non-JSON file
      writeFileSync(join(testDir, 'not-json.txt'), 'content');

      const ids = listReviewIds({ baseDir: testDir });
      expect(ids.length).toBe(1);
      expect(ids).toContain('review-1');
    });
  });

  describe('loadReviewsByBaseline', () => {
    it('should load all reviews for a specific baseline', async () => {
      const baselineId = 'target-baseline';
      const review1 = createMockReview({ id: 'review-1', baselineId });
      const review2 = createMockReview({ id: 'review-2', baselineId });
      const review3 = createMockReview({ id: 'review-3', baselineId: 'other-baseline' });

      await saveReview(review1, { baseDir: testDir });
      await saveReview(review2, { baseDir: testDir });
      await saveReview(review3, { baseDir: testDir });

      const reviews = await loadReviewsByBaseline(baselineId, { baseDir: testDir });

      expect(reviews.length).toBe(2);
      expect(reviews.every((r) => r.baselineId === baselineId)).toBe(true);
    });

    it('should return empty array if no reviews for baseline', async () => {
      const review = createMockReview({ baselineId: 'other-baseline' });
      await saveReview(review, { baseDir: testDir });

      const reviews = await loadReviewsByBaseline('non-existent', { baseDir: testDir });
      expect(reviews).toEqual([]);
    });

    it('should sort reviews by createdAt descending', async () => {
      const baselineId = 'target-baseline';
      const review1 = createMockReview({
        id: 'review-1',
        baselineId,
        createdAt: '2024-01-01T00:00:00Z',
      });
      const review2 = createMockReview({
        id: 'review-2',
        baselineId,
        createdAt: '2024-03-01T00:00:00Z',
      });
      const review3 = createMockReview({
        id: 'review-3',
        baselineId,
        createdAt: '2024-02-01T00:00:00Z',
      });

      await saveReview(review1, { baseDir: testDir });
      await saveReview(review2, { baseDir: testDir });
      await saveReview(review3, { baseDir: testDir });

      const reviews = await loadReviewsByBaseline(baselineId, { baseDir: testDir });

      expect(reviews[0]!.id).toBe('review-2'); // Most recent
      expect(reviews[1]!.id).toBe('review-3');
      expect(reviews[2]!.id).toBe('review-1'); // Oldest
    });
  });

  describe('reviewExists', () => {
    it('should return true for existing review', async () => {
      const review = createMockReview();
      await saveReview(review, { baseDir: testDir });

      expect(reviewExists(review.id, { baseDir: testDir })).toBe(true);
    });

    it('should return false for non-existent review', () => {
      expect(reviewExists('non-existent', { baseDir: testDir })).toBe(false);
    });
  });

  describe('getLastReview', () => {
    it('should return the most recent review', async () => {
      // Create mock project structure
      const projectDir = join(testDir, 'project');
      const reviewsDir = join(projectDir, '.agentlint', 'reviews');
      mkdirSync(reviewsDir, { recursive: true });

      const review1 = createMockReview({
        id: 'review-1',
        createdAt: '2024-01-01T00:00:00Z',
      });
      const review2 = createMockReview({
        id: 'review-2',
        createdAt: '2024-03-01T00:00:00Z',
      });

      await saveReview(review1, { baseDir: reviewsDir });
      await saveReview(review2, { baseDir: reviewsDir });

      const lastReview = await getLastReview(projectDir);

      expect(lastReview).not.toBeNull();
      expect(lastReview!.id).toBe('review-2');
    });

    it('should return null when no reviews exist', async () => {
      const emptyProject = join(testDir, 'empty-project');
      mkdirSync(emptyProject, { recursive: true });

      const lastReview = await getLastReview(emptyProject);
      expect(lastReview).toBeNull();
    });

    it('should return null when reviews directory is empty', async () => {
      const projectDir = join(testDir, 'project');
      const reviewsDir = join(projectDir, '.agentlint', 'reviews');
      mkdirSync(reviewsDir, { recursive: true });

      const lastReview = await getLastReview(projectDir);
      expect(lastReview).toBeNull();
    });

    it('should handle reviews with invalid JSON gracefully', async () => {
      const projectDir = join(testDir, 'project');
      const reviewsDir = join(projectDir, '.agentlint', 'reviews');
      mkdirSync(reviewsDir, { recursive: true });

      // Create one valid and one invalid review
      const validReview = createMockReview({ id: 'valid-review' });
      await saveReview(validReview, { baseDir: reviewsDir });
      writeFileSync(join(reviewsDir, 'invalid.json'), 'not valid json');

      const lastReview = await getLastReview(projectDir);
      expect(lastReview).not.toBeNull();
      expect(lastReview!.id).toBe('valid-review');
    });
  });
});
