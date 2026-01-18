/**
 * VCR Integration Test for Qualitative Review Flow
 *
 * Tests the complete qualitative review workflow using VCR recordings
 * for deterministic integration testing per ADR-0011.
 *
 * @module tests/integration/temporal/review-flow.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  REVIEW_DIMENSIONS,
  getDimension,
  getDimensionNames,
  getDimensionsBySignalType,
  getPromptText,
  getProbeText,
} from '../../../src/temporal/qualitative/dimensions';
import {
  calculateOverallSentiment,
  isValidSentiment,
  clampSentiment,
  getSentimentLabel,
  getSentimentEmoji,
  analyzeSentimentIndicators,
  calculateSentimentTrend,
  compareSentiment,
  aggregateSentimentStats,
} from '../../../src/temporal/qualitative/sentiment';
import {
  saveReview,
  loadReview,
  deleteReview,
  reviewExists,
} from '../../../src/persistence/reviews/storage';
import {
  getReviewIndexDb,
  indexReview,
  queryReviews,
  countReviews,
} from '../../../src/persistence/reviews/indexer';
import type { QualitativeReview, ReviewDimension } from '../../../src/temporal/types';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a test review dimension with the given name and sentiment.
 */
function createTestDimension(
  name: string,
  sentiment: -2 | -1 | 0 | 1 | 2,
  response = 'Test response'
): ReviewDimension {
  const dim = getDimension(name as ReviewDimension['name']);
  return {
    name: name as ReviewDimension['name'],
    promptText: dim?.promptText ?? 'Test prompt',
    response,
    sentiment,
  };
}

/**
 * Create a full test review.
 */
function createTestReview(
  id: string,
  baselineId: string,
  overrides: Partial<QualitativeReview> = {}
): QualitativeReview {
  const now = new Date().toISOString();
  return {
    id,
    createdAt: now,
    baselineId,
    dimensions: [
      createTestDimension('perceivedFriction', 1, 'Minimal friction in daily workflow'),
      createTestDimension('trustCalibration', 2, 'High trust in AI outputs'),
      createTestDimension('taskFit', 1, 'Good fit for most tasks'),
      createTestDimension('configurationConfidence', 1, 'Confident in current config'),
      createTestDimension('improvementAttribution', 0, 'Neutral on attribution'),
      createTestDimension('workflowSatisfaction', 2, 'Very satisfied overall'),
    ],
    overallSentiment: 1.17,
    themes: ['positive experience', 'good workflow'],
    ...overrides,
  };
}

// =============================================================================
// Test Setup
// =============================================================================

let testDir: string;
let reviewsDir: string;

beforeEach(async () => {
  // Create isolated test directory
  testDir = await mkdtemp(join(tmpdir(), 'agentlint-review-flow-'));
  reviewsDir = join(testDir, '.agentlint', 'reviews');
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

// =============================================================================
// Tests
// =============================================================================

describe('Qualitative Review Flow Integration', () => {
  describe('Review Dimensions', () => {
    it('should have all 6 required dimensions', () => {
      expect(REVIEW_DIMENSIONS.length).toBe(6);

      const names = getDimensionNames();
      expect(names).toContain('perceivedFriction');
      expect(names).toContain('trustCalibration');
      expect(names).toContain('taskFit');
      expect(names).toContain('configurationConfidence');
      expect(names).toContain('improvementAttribution');
      expect(names).toContain('workflowSatisfaction');
    });

    it('should provide dimension lookup by name', () => {
      const friction = getDimension('perceivedFriction');

      expect(friction).toBeDefined();
      expect(friction?.displayName).toBe('Perceived Friction');
      expect(friction?.promptText).toBeDefined();
      expect(friction?.probeText).toBeDefined();
    });

    it('should filter dimensions by signal type', () => {
      const leading = getDimensionsBySignalType('leading');
      const lagging = getDimensionsBySignalType('lagging');

      expect(leading.length).toBeGreaterThan(0);
      expect(lagging.length).toBeGreaterThan(0);

      // perceivedFriction should be leading (predicts issues)
      expect(leading.some((d) => d.name === 'perceivedFriction')).toBe(true);
    });

    it('should provide prompt and probe text helpers', () => {
      const prompt = getPromptText('perceivedFriction');
      const probe = getProbeText('perceivedFriction');

      expect(prompt).toContain('friction');
      expect(probe).toContain('example');
    });
  });

  describe('Sentiment Calculation', () => {
    it('should calculate overall sentiment from dimensions', () => {
      const dimensions = [
        createTestDimension('perceivedFriction', 1),
        createTestDimension('trustCalibration', 2),
        createTestDimension('taskFit', 0),
        createTestDimension('configurationConfidence', 1),
        createTestDimension('improvementAttribution', 1),
        createTestDimension('workflowSatisfaction', 2),
      ];

      const overall = calculateOverallSentiment(dimensions);

      // Average of 1, 2, 0, 1, 1, 2 = 7/6 ≈ 1.17
      expect(overall).toBeCloseTo(1.17, 1);
    });

    it('should support weighted sentiment calculation', () => {
      const dimensions = [
        createTestDimension('perceivedFriction', -2),
        createTestDimension('workflowSatisfaction', 2),
      ];

      // Equal weights
      const unweighted = calculateOverallSentiment(dimensions);
      expect(unweighted).toBeCloseTo(0, 1);

      // Higher weight on satisfaction
      const weighted = calculateOverallSentiment(dimensions, {
        weights: { workflowSatisfaction: 2 },
      });
      expect(weighted).toBeGreaterThan(0);
    });

    it('should validate and clamp sentiment values', () => {
      expect(isValidSentiment(-2)).toBe(true);
      expect(isValidSentiment(0)).toBe(true);
      expect(isValidSentiment(2)).toBe(true);
      expect(isValidSentiment(-3)).toBe(false);
      expect(isValidSentiment(3)).toBe(false);

      expect(clampSentiment(-5)).toBe(-2);
      expect(clampSentiment(5)).toBe(2);
      expect(clampSentiment(1)).toBe(1);
    });

    it('should provide sentiment labels and emojis', () => {
      expect(getSentimentLabel(-2)).toBe('Very Negative');
      expect(getSentimentLabel(-1)).toBe('Negative');
      expect(getSentimentLabel(0)).toBe('Neutral');
      expect(getSentimentLabel(1)).toBe('Positive');
      expect(getSentimentLabel(2)).toBe('Very Positive');

      expect(getSentimentEmoji(-2)).toBe('😢');
      expect(getSentimentEmoji(0)).toBe('😐');
      expect(getSentimentEmoji(2)).toBe('😊');
    });

    it('should analyze sentiment indicators in text', () => {
      const positiveText = 'The workflow is smooth and intuitive, really seamless experience';
      const negativeText = 'Very frustrating and confusing, lots of friction';

      const positiveAnalysis = analyzeSentimentIndicators(positiveText);
      const negativeAnalysis = analyzeSentimentIndicators(negativeText);

      expect(positiveAnalysis.positiveMatches.length).toBeGreaterThan(0);
      expect(negativeAnalysis.negativeMatches.length).toBeGreaterThan(0);
    });
  });

  describe('Review Storage', () => {
    it('should store and retrieve a review', async () => {
      const review = createTestReview('review-001', 'baseline-001');

      await saveReview(review, { baseDir: reviewsDir });

      const loaded = await loadReview('review-001', { baseDir: reviewsDir });

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe('review-001');
      expect(loaded?.baselineId).toBe('baseline-001');
      expect(loaded?.dimensions.length).toBe(6);
    });

    it('should check review existence', async () => {
      const review = createTestReview('review-exists', 'baseline-001');

      expect(await reviewExists('review-exists', { baseDir: reviewsDir })).toBe(false);

      await saveReview(review, { baseDir: reviewsDir });

      expect(await reviewExists('review-exists', { baseDir: reviewsDir })).toBe(true);
    });

    it('should delete a review', async () => {
      const review = createTestReview('review-delete', 'baseline-001');

      await saveReview(review, { baseDir: reviewsDir });
      expect(await reviewExists('review-delete', { baseDir: reviewsDir })).toBe(true);

      await deleteReview('review-delete', { baseDir: reviewsDir });
      expect(await reviewExists('review-delete', { baseDir: reviewsDir })).toBe(false);
    });

    it('should return null for non-existent review', async () => {
      const loaded = await loadReview('nonexistent', { baseDir: reviewsDir });
      expect(loaded).toBeNull();
    });
  });

  describe('Review Indexing', () => {
    it('should index and query reviews', async () => {
      // Store multiple reviews and get their file paths
      const review1 = createTestReview('review-idx-1', 'baseline-001', {
        createdAt: '2026-01-15T10:00:00.000Z',
        overallSentiment: 1.5,
        themes: ['positive'],
      });
      const review2 = createTestReview('review-idx-2', 'baseline-002', {
        createdAt: '2026-01-16T10:00:00.000Z',
        overallSentiment: -1.0,
        themes: ['negative'],
      });

      const filePath1 = await saveReview(review1, { baseDir: reviewsDir });
      const filePath2 = await saveReview(review2, { baseDir: reviewsDir });

      // Open index database
      const db = await getReviewIndexDb({ baseDir: reviewsDir });

      // Index reviews with their file paths
      indexReview(db, review1, filePath1);
      indexReview(db, review2, filePath2);

      // Query all
      const allReviews = queryReviews(db, { limit: 10 });
      expect(allReviews.length).toBe(2);

      // Query by baseline
      const baselineReviews = queryReviews(db, { baselineId: 'baseline-001' });
      expect(baselineReviews.length).toBe(1);
      expect(baselineReviews[0]?.id).toBe('review-idx-1');

      // Count reviews
      const total = countReviews(db);
      expect(total).toBe(2);

      db.close();
    });

    it('should filter reviews by date range', async () => {
      const review1 = createTestReview('review-date-1', 'baseline-001', {
        createdAt: '2026-01-10T10:00:00.000Z',
      });
      const review2 = createTestReview('review-date-2', 'baseline-001', {
        createdAt: '2026-01-15T10:00:00.000Z',
      });
      const review3 = createTestReview('review-date-3', 'baseline-001', {
        createdAt: '2026-01-20T10:00:00.000Z',
      });

      const filePath1 = await saveReview(review1, { baseDir: reviewsDir });
      const filePath2 = await saveReview(review2, { baseDir: reviewsDir });
      const filePath3 = await saveReview(review3, { baseDir: reviewsDir });

      const db = await getReviewIndexDb({ baseDir: reviewsDir });
      indexReview(db, review1, filePath1);
      indexReview(db, review2, filePath2);
      indexReview(db, review3, filePath3);

      // Query with date filter
      const filtered = queryReviews(db, {
        after: '2026-01-12T00:00:00.000Z',
        before: '2026-01-18T00:00:00.000Z',
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0]?.id).toBe('review-date-2');

      db.close();
    });
  });

  describe('Sentiment Trends', () => {
    it('should calculate sentiment trend across reviews', () => {
      // Create reviews with properly calculated overall sentiment
      const dims1 = [
        createTestDimension('perceivedFriction', -1),
        createTestDimension('workflowSatisfaction', 0),
      ];
      const dims2 = [
        createTestDimension('perceivedFriction', 0),
        createTestDimension('workflowSatisfaction', 1),
      ];
      const dims3 = [
        createTestDimension('perceivedFriction', 1),
        createTestDimension('workflowSatisfaction', 2),
      ];

      const reviews: QualitativeReview[] = [
        createTestReview('r1', 'b1', {
          createdAt: '2026-01-01T10:00:00.000Z',
          dimensions: dims1,
          overallSentiment: calculateOverallSentiment(dims1),
        }),
        createTestReview('r2', 'b2', {
          createdAt: '2026-01-05T10:00:00.000Z',
          dimensions: dims2,
          overallSentiment: calculateOverallSentiment(dims2),
        }),
        createTestReview('r3', 'b3', {
          createdAt: '2026-01-10T10:00:00.000Z',
          dimensions: dims3,
          overallSentiment: calculateOverallSentiment(dims3),
        }),
      ];

      // Should show improving trend
      const trend = calculateSentimentTrend(reviews);

      expect(trend).not.toBeNull();
      expect(trend?.direction).toBe('improving');
      expect(trend?.values.length).toBe(3);
    });

    it('should compare sentiment between two reviews', () => {
      const beforeDimensions = [
        createTestDimension('perceivedFriction', -1),
        createTestDimension('workflowSatisfaction', 0),
      ];
      const afterDimensions = [
        createTestDimension('perceivedFriction', 1),
        createTestDimension('workflowSatisfaction', 2),
      ];

      const before = createTestReview('before', 'b1', {
        dimensions: beforeDimensions,
        overallSentiment: calculateOverallSentiment(beforeDimensions),
      });
      const after = createTestReview('after', 'b2', {
        dimensions: afterDimensions,
        overallSentiment: calculateOverallSentiment(afterDimensions),
      });

      const comparison = compareSentiment(before, after);

      expect(comparison.change).toBeGreaterThan(0);
      expect(comparison.direction).toBe('improved');
    });

    it('should aggregate sentiment statistics', () => {
      const reviews: QualitativeReview[] = [
        createTestReview('r1', 'b1', { overallSentiment: 1.5 }),
        createTestReview('r2', 'b2', { overallSentiment: -0.5 }),
        createTestReview('r3', 'b3', { overallSentiment: 1.0 }),
      ];

      const stats = aggregateSentimentStats(reviews);

      expect(stats.count).toBe(3);
      expect(stats.averageSentiment).toBeCloseTo(0.67, 1);
      expect(stats.sentimentRange.min).toBe(-0.5);
      expect(stats.sentimentRange.max).toBe(1.5);
    });
  });

  describe('Full Review Workflow', () => {
    it('should support complete initiate → respond → store → query workflow', async () => {
      const baselineId = 'test-baseline-001';

      // Step 1: Initiate - get dimension prompts
      const dimensionNames = getDimensionNames();
      expect(dimensionNames.length).toBe(6);

      const prompts = dimensionNames.map((name) => ({
        name,
        prompt: getPromptText(name),
        probe: getProbeText(name),
      }));
      expect(prompts.length).toBe(6);

      // Step 2: Collect responses (simulated)
      const dimensions: ReviewDimension[] = [
        createTestDimension('perceivedFriction', 1, 'Smooth workflow after config updates'),
        createTestDimension('trustCalibration', 2, 'High trust in AI suggestions'),
        createTestDimension('taskFit', 1, 'Good fit for daily tasks'),
        createTestDimension('configurationConfidence', 2, 'Very confident in setup'),
        createTestDimension('improvementAttribution', 1, 'Clear causality for improvements'),
        createTestDimension('workflowSatisfaction', 2, 'Excellent overall experience'),
      ];

      // Step 3: Calculate sentiment
      const overallSentiment = calculateOverallSentiment(dimensions);
      expect(overallSentiment).toBeGreaterThan(1);

      // Step 4: Create and store review
      const reviewId = crypto.randomUUID();
      const review: QualitativeReview = {
        id: reviewId,
        createdAt: new Date().toISOString(),
        baselineId,
        dimensions,
        overallSentiment,
        themes: ['positive experience', 'high trust'],
        triggerReason: 'manual',
      };

      const filePath = await saveReview(review, { baseDir: reviewsDir });

      // Step 5: Verify storage
      const loaded = await loadReview(reviewId, { baseDir: reviewsDir });
      expect(loaded).not.toBeNull();
      expect(loaded?.baselineId).toBe(baselineId);
      expect(loaded?.overallSentiment).toBeCloseTo(overallSentiment, 2);

      // Step 6: Index for queries
      const db = await getReviewIndexDb({ baseDir: reviewsDir });
      indexReview(db, review, filePath);

      // Step 7: Query history
      const history = queryReviews(db, { baselineId });
      expect(history.length).toBe(1);
      expect(history[0]?.id).toBe(reviewId);

      db.close();
    });

    it('should support partial dimension review', async () => {
      // Only review 2 dimensions
      const dimensions: ReviewDimension[] = [
        createTestDimension('perceivedFriction', -1, 'Some friction with new tools'),
        createTestDimension('workflowSatisfaction', 0, 'Neutral satisfaction'),
      ];

      const overallSentiment = calculateOverallSentiment(dimensions);
      expect(overallSentiment).toBe(-0.5);

      const review: QualitativeReview = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        baselineId: 'partial-baseline',
        dimensions,
        overallSentiment,
        themes: ['partial review'],
      };

      await saveReview(review, { baseDir: reviewsDir });

      const loaded = await loadReview(review.id, { baseDir: reviewsDir });
      expect(loaded).not.toBeNull();
      expect(loaded?.dimensions.length).toBe(2);
    });

    it('should track sentiment changes over multiple reviews', async () => {
      // Create a series of reviews showing improvement
      const reviews: QualitativeReview[] = [];

      const sentimentSequence: (-2 | -1 | 0 | 1 | 2)[] = [-1, 0, 1, 2];
      for (let i = 0; i < 4; i++) {
        const sentiment = sentimentSequence[i]!;
        const review = createTestReview(`review-series-${i}`, `baseline-${i}`, {
          createdAt: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString(),
          dimensions: [
            createTestDimension('perceivedFriction', sentiment),
            createTestDimension('workflowSatisfaction', sentiment),
          ],
          overallSentiment: sentiment,
        });

        await saveReview(review, { baseDir: reviewsDir });
        reviews.push(review);
      }

      // Calculate trend
      const trend = calculateSentimentTrend(reviews);

      expect(trend).not.toBeNull();
      expect(trend?.direction).toBe('improving');
      expect(trend?.slope).toBeGreaterThan(0);
    });
  });
});
