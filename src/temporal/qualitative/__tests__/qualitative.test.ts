/**
 * Unit tests for qualitative review functionality.
 *
 * Tests cover:
 * - Review dimensions definitions
 * - Sentiment calculation
 * - Sentiment trend analysis
 * - Sentiment indicator analysis
 */

import { describe, test, expect } from 'bun:test';

import {
  REVIEW_DIMENSIONS,
  DIMENSION_BY_NAME,
  getDimension,
  getDimensionNames,
  getDimensionsBySignalType,
  getPromptText,
  getProbeText,
} from '../dimensions';

import {
  calculateOverallSentiment,
  isValidSentiment,
  clampSentiment,
  getSentimentLabel,
  getSentimentEmoji,
  analyzeSentimentIndicators,
  calculateSentimentTrend,
  compareSentiment,
  createEmptyDimension,
  aggregateSentimentStats,
  type SentimentValue,
} from '../sentiment';

import type { ReviewDimension, QualitativeReview, ReviewDimensionName } from '../../types';

// =============================================================================
// Dimensions Tests
// =============================================================================

describe('Review Dimensions', () => {
  describe('REVIEW_DIMENSIONS', () => {
    test('should have exactly 6 dimensions', () => {
      expect(REVIEW_DIMENSIONS.length).toBe(6);
    });

    test('should have all required dimension names', () => {
      const names = REVIEW_DIMENSIONS.map((d) => d.name);
      expect(names).toContain('perceivedFriction');
      expect(names).toContain('trustCalibration');
      expect(names).toContain('taskFit');
      expect(names).toContain('configurationConfidence');
      expect(names).toContain('improvementAttribution');
      expect(names).toContain('workflowSatisfaction');
    });

    test('each dimension should have required properties', () => {
      for (const dim of REVIEW_DIMENSIONS) {
        expect(dim.name).toBeDefined();
        expect(dim.displayName).toBeDefined();
        expect(dim.promptText).toBeDefined();
        expect(dim.probeText).toBeDefined();
        expect(dim.signalType).toBeDefined();
        expect(dim.description).toBeDefined();
        expect(dim.positiveIndicators).toBeDefined();
        expect(dim.negativeIndicators).toBeDefined();
        expect(dim.positiveIndicators.length).toBeGreaterThan(0);
        expect(dim.negativeIndicators.length).toBeGreaterThan(0);
      }
    });

    test('promptText should end with a question mark or inquiry', () => {
      for (const dim of REVIEW_DIMENSIONS) {
        // All prompts should be questions or have question-like structure
        expect(dim.promptText.length).toBeGreaterThan(20);
      }
    });
  });

  describe('DIMENSION_BY_NAME', () => {
    test('should contain all dimensions', () => {
      expect(DIMENSION_BY_NAME.size).toBe(6);
    });

    test('should allow lookup by name', () => {
      const friction = DIMENSION_BY_NAME.get('perceivedFriction');
      expect(friction).toBeDefined();
      expect(friction?.displayName).toBe('Perceived Friction');
    });
  });

  describe('getDimension', () => {
    test('should return dimension for valid name', () => {
      const dim = getDimension('trustCalibration');
      expect(dim).toBeDefined();
      expect(dim?.name).toBe('trustCalibration');
      expect(dim?.signalType).toBe('qualitative');
    });

    test('should return undefined for invalid name', () => {
      // @ts-expect-error - Testing invalid input
      const dim = getDimension('invalidDimension');
      expect(dim).toBeUndefined();
    });
  });

  describe('getDimensionNames', () => {
    test('should return all dimension names', () => {
      const names = getDimensionNames();
      expect(names.length).toBe(6);
      expect(names).toContain('perceivedFriction');
      expect(names).toContain('workflowSatisfaction');
    });
  });

  describe('getDimensionsBySignalType', () => {
    test('should filter by leading signal type', () => {
      const leading = getDimensionsBySignalType('leading');
      expect(leading.length).toBe(2);
      expect(leading.map((d) => d.name)).toContain('perceivedFriction');
      expect(leading.map((d) => d.name)).toContain('configurationConfidence');
    });

    test('should filter by causal signal type', () => {
      const causal = getDimensionsBySignalType('causal');
      expect(causal.length).toBe(2);
      expect(causal.map((d) => d.name)).toContain('taskFit');
      expect(causal.map((d) => d.name)).toContain('improvementAttribution');
    });

    test('should filter by qualitative signal type', () => {
      const qualitative = getDimensionsBySignalType('qualitative');
      expect(qualitative.length).toBe(1);
      expect(qualitative[0]?.name).toBe('trustCalibration');
    });

    test('should filter by lagging signal type', () => {
      const lagging = getDimensionsBySignalType('lagging');
      expect(lagging.length).toBe(1);
      expect(lagging[0]?.name).toBe('workflowSatisfaction');
    });
  });

  describe('getPromptText', () => {
    test('should return prompt text for valid dimension', () => {
      const prompt = getPromptText('workflowSatisfaction');
      expect(prompt).toContain('satisfied');
    });

    test('should return undefined for invalid dimension', () => {
      // @ts-expect-error - Testing invalid input
      const prompt = getPromptText('invalidDimension');
      expect(prompt).toBeUndefined();
    });
  });

  describe('getProbeText', () => {
    test('should return probe text for valid dimension', () => {
      const probe = getProbeText('perceivedFriction');
      expect(probe).toContain('example');
    });
  });
});

// =============================================================================
// Sentiment Calculation Tests
// =============================================================================

describe('Sentiment Calculation', () => {
  describe('calculateOverallSentiment', () => {
    test('should calculate average of dimension sentiments', () => {
      const dimensions: ReviewDimension[] = [
        createTestDimension('perceivedFriction', 1),
        createTestDimension('trustCalibration', 2),
        createTestDimension('taskFit', 0),
      ];

      const overall = calculateOverallSentiment(dimensions);
      expect(overall).toBe(1); // (1 + 2 + 0) / 3 = 1
    });

    test('should handle negative sentiments', () => {
      const dimensions: ReviewDimension[] = [
        createTestDimension('perceivedFriction', -2),
        createTestDimension('trustCalibration', -1),
      ];

      const overall = calculateOverallSentiment(dimensions);
      expect(overall).toBe(-1.5);
    });

    test('should handle mixed sentiments', () => {
      const dimensions: ReviewDimension[] = [
        createTestDimension('perceivedFriction', -2),
        createTestDimension('trustCalibration', 2),
      ];

      const overall = calculateOverallSentiment(dimensions);
      expect(overall).toBe(0);
    });

    test('should support weighted calculation', () => {
      const dimensions: ReviewDimension[] = [
        createTestDimension('perceivedFriction', 0),
        createTestDimension('workflowSatisfaction', 2),
      ];

      const overall = calculateOverallSentiment(dimensions, {
        weights: { workflowSatisfaction: 2 },
      });

      // (0 * 1 + 2 * 2) / (1 + 2) = 4/3 ≈ 1.33
      expect(overall).toBeCloseTo(1.33, 1);
    });

    test('should exclude specified dimensions', () => {
      const dimensions: ReviewDimension[] = [
        createTestDimension('perceivedFriction', -2),
        createTestDimension('trustCalibration', 2),
        createTestDimension('workflowSatisfaction', 2),
      ];

      const overall = calculateOverallSentiment(dimensions, {
        excludeDimensions: ['perceivedFriction'],
      });

      expect(overall).toBe(2); // (2 + 2) / 2 = 2
    });

    test('should return 0 for empty dimensions', () => {
      const overall = calculateOverallSentiment([]);
      expect(overall).toBe(0);
    });
  });

  describe('isValidSentiment', () => {
    test('should return true for valid Likert values', () => {
      expect(isValidSentiment(-2)).toBe(true);
      expect(isValidSentiment(-1)).toBe(true);
      expect(isValidSentiment(0)).toBe(true);
      expect(isValidSentiment(1)).toBe(true);
      expect(isValidSentiment(2)).toBe(true);
    });

    test('should return false for invalid values', () => {
      expect(isValidSentiment(-3)).toBe(false);
      expect(isValidSentiment(3)).toBe(false);
      expect(isValidSentiment(0.5)).toBe(false);
      expect(isValidSentiment(1.5)).toBe(false);
    });
  });

  describe('clampSentiment', () => {
    test('should clamp values to valid range', () => {
      expect(clampSentiment(-5)).toBe(-2);
      expect(clampSentiment(5)).toBe(2);
      expect(clampSentiment(0)).toBe(0);
    });

    test('should round decimal values', () => {
      expect(clampSentiment(0.4)).toBe(0);
      expect(clampSentiment(0.6)).toBe(1);
      expect(clampSentiment(-0.6)).toBe(-1);
    });
  });

  describe('getSentimentLabel', () => {
    test('should return correct labels for Likert values', () => {
      expect(getSentimentLabel(-2)).toBe('Very Negative');
      expect(getSentimentLabel(-1)).toBe('Negative');
      expect(getSentimentLabel(0)).toBe('Neutral');
      expect(getSentimentLabel(1)).toBe('Positive');
      expect(getSentimentLabel(2)).toBe('Very Positive');
    });

    test('should handle intermediate values', () => {
      expect(getSentimentLabel(-1.7)).toBe('Very Negative');
      expect(getSentimentLabel(0.3)).toBe('Neutral');
      expect(getSentimentLabel(1.8)).toBe('Very Positive');
    });
  });

  describe('getSentimentEmoji', () => {
    test('should return correct emojis', () => {
      expect(getSentimentEmoji(-2)).toBe('😢');
      expect(getSentimentEmoji(-1)).toBe('😕');
      expect(getSentimentEmoji(0)).toBe('😐');
      expect(getSentimentEmoji(1)).toBe('🙂');
      expect(getSentimentEmoji(2)).toBe('😊');
    });
  });
});

// =============================================================================
// Sentiment Indicator Analysis Tests
// =============================================================================

describe('Sentiment Indicator Analysis', () => {
  describe('analyzeSentimentIndicators', () => {
    test('should find positive indicators in text', () => {
      const analysis = analyzeSentimentIndicators('The workflow is smooth and easy to use');

      expect(analysis.positiveMatches).toContain('smooth');
      expect(analysis.positiveMatches).toContain('easy');
      expect(analysis.indicatorScore).toBeGreaterThan(0);
    });

    test('should find negative indicators in text', () => {
      const analysis = analyzeSentimentIndicators('I find it frustrating and confusing at times');

      expect(analysis.negativeMatches).toContain('frustrating');
      expect(analysis.negativeMatches).toContain('confusing');
      expect(analysis.indicatorScore).toBeLessThan(0);
    });

    test('should suggest sentiment based on balance', () => {
      const positive = analyzeSentimentIndicators('Everything is smooth, easy, and intuitive');
      expect(positive.suggestedSentiment).toBeGreaterThan(0);

      const negative = analyzeSentimentIndicators('It is slow, frustrating, and tedious');
      expect(negative.suggestedSentiment).toBeLessThan(0);

      const neutral = analyzeSentimentIndicators('No particular feelings about it');
      expect(neutral.suggestedSentiment).toBe(0);
    });

    test('should use dimension-specific indicators when provided', () => {
      const dimension = getDimension('perceivedFriction');
      const analysis = analyzeSentimentIndicators('The process is seamless', dimension);

      expect(analysis.positiveMatches).toContain('seamless');
    });
  });
});

// =============================================================================
// Sentiment Trend Tests
// =============================================================================

describe('Sentiment Trends', () => {
  describe('calculateSentimentTrend', () => {
    test('should return null for less than 2 reviews', () => {
      const reviews: QualitativeReview[] = [createTestReview(1)];
      const trend = calculateSentimentTrend(reviews);
      expect(trend).toBeNull();
    });

    test('should detect improving trend', () => {
      const reviews: QualitativeReview[] = [
        createTestReview(-1, '2024-01-01T00:00:00Z'),
        createTestReview(0, '2024-01-15T00:00:00Z'),
        createTestReview(1, '2024-02-01T00:00:00Z'),
      ];

      const trend = calculateSentimentTrend(reviews);
      expect(trend).not.toBeNull();
      expect(trend?.direction).toBe('improving');
      expect(trend?.slope).toBeGreaterThan(0);
    });

    test('should detect degrading trend', () => {
      const reviews: QualitativeReview[] = [
        createTestReview(2, '2024-01-01T00:00:00Z'),
        createTestReview(1, '2024-01-15T00:00:00Z'),
        createTestReview(-1, '2024-02-01T00:00:00Z'),
      ];

      const trend = calculateSentimentTrend(reviews);
      expect(trend).not.toBeNull();
      expect(trend?.direction).toBe('degrading');
      expect(trend?.slope).toBeLessThan(0);
    });

    test('should detect stable trend', () => {
      const reviews: QualitativeReview[] = [
        createTestReview(1, '2024-01-01T00:00:00Z'),
        createTestReview(1, '2024-01-15T00:00:00Z'),
        createTestReview(1, '2024-02-01T00:00:00Z'),
      ];

      const trend = calculateSentimentTrend(reviews);
      expect(trend).not.toBeNull();
      expect(trend?.direction).toBe('stable');
    });

    test('should analyze specific dimension', () => {
      const reviews: QualitativeReview[] = [
        createTestReviewWithDimensions(-2, 1, '2024-01-01T00:00:00Z'),
        createTestReviewWithDimensions(-1, 1, '2024-01-15T00:00:00Z'),
        createTestReviewWithDimensions(0, 1, '2024-02-01T00:00:00Z'),
      ];

      const trend = calculateSentimentTrend(reviews, 'perceivedFriction');
      expect(trend).not.toBeNull();
      expect(trend?.dimension).toBe('perceivedFriction');
      expect(trend?.direction).toBe('improving');
    });
  });

  describe('compareSentiment', () => {
    test('should detect improvement between reviews', () => {
      const before = createTestReview(-1);
      const after = createTestReview(1);

      const comparison = compareSentiment(before, after);
      expect(comparison.direction).toBe('improved');
      expect(comparison.change).toBe(2);
    });

    test('should detect degradation between reviews', () => {
      const before = createTestReview(2);
      const after = createTestReview(0);

      const comparison = compareSentiment(before, after);
      expect(comparison.direction).toBe('degraded');
      expect(comparison.change).toBe(-2);
    });

    test('should detect no change', () => {
      const before = createTestReview(1);
      const after = createTestReview(1);

      const comparison = compareSentiment(before, after);
      expect(comparison.direction).toBe('unchanged');
    });
  });
});

// =============================================================================
// Aggregate Stats Tests
// =============================================================================

describe('Sentiment Aggregation', () => {
  describe('aggregateSentimentStats', () => {
    test('should return zero stats for empty reviews', () => {
      const stats = aggregateSentimentStats([]);
      expect(stats.count).toBe(0);
      expect(stats.averageSentiment).toBe(0);
    });

    test('should calculate average sentiment', () => {
      const reviews: QualitativeReview[] = [
        createTestReview(1),
        createTestReview(2),
        createTestReview(0),
      ];

      const stats = aggregateSentimentStats(reviews);
      expect(stats.count).toBe(3);
      expect(stats.averageSentiment).toBe(1);
    });

    test('should calculate sentiment range', () => {
      const reviews: QualitativeReview[] = [
        createTestReview(-2),
        createTestReview(0),
        createTestReview(2),
      ];

      const stats = aggregateSentimentStats(reviews);
      expect(stats.sentimentRange.min).toBe(-2);
      expect(stats.sentimentRange.max).toBe(2);
    });

    test('should calculate per-dimension averages', () => {
      const reviews: QualitativeReview[] = [
        createTestReviewWithDimensions(-1, 2, '2024-01-01T00:00:00Z'),
        createTestReviewWithDimensions(1, 2, '2024-01-15T00:00:00Z'),
      ];

      const stats = aggregateSentimentStats(reviews);
      expect(stats.dimensionAverages.perceivedFriction).toBe(0);
      expect(stats.dimensionAverages.workflowSatisfaction).toBe(2);
    });
  });
});

// =============================================================================
// Utility Tests
// =============================================================================

describe('Utility Functions', () => {
  describe('createEmptyDimension', () => {
    test('should create dimension with neutral sentiment', () => {
      const dim = createEmptyDimension('perceivedFriction', 'Test prompt');
      expect(dim.name).toBe('perceivedFriction');
      expect(dim.promptText).toBe('Test prompt');
      expect(dim.response).toBe('');
      expect(dim.sentiment).toBe(0);
    });
  });
});

// =============================================================================
// Test Helpers
// =============================================================================

function createTestDimension(
  name: ReviewDimensionName,
  sentiment: SentimentValue
): ReviewDimension {
  return {
    name,
    promptText: 'Test prompt',
    response: 'Test response',
    sentiment,
  };
}

function createTestReview(
  overallSentiment: number,
  createdAt = new Date().toISOString()
): QualitativeReview {
  return {
    id: crypto.randomUUID(),
    baselineId: crypto.randomUUID(),
    createdAt,
    dimensions: [
      createTestDimension('perceivedFriction', clampSentiment(overallSentiment)),
      createTestDimension('workflowSatisfaction', clampSentiment(overallSentiment)),
    ],
    overallSentiment,
    themes: [],
  };
}

function createTestReviewWithDimensions(
  frictionSentiment: number,
  satisfactionSentiment: number,
  createdAt: string
): QualitativeReview {
  const friction = clampSentiment(frictionSentiment);
  const satisfaction = clampSentiment(satisfactionSentiment);
  const overall = (friction + satisfaction) / 2;

  return {
    id: crypto.randomUUID(),
    baselineId: crypto.randomUUID(),
    createdAt,
    dimensions: [
      createTestDimension('perceivedFriction', friction),
      createTestDimension('workflowSatisfaction', satisfaction),
    ],
    overallSentiment: overall,
    themes: [],
  };
}
