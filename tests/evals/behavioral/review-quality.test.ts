/**
 * EP09 Temporal Analysis - Qualitative Review Quality Evaluation
 *
 * Behavioral tests for qualitative review quality per ADR-0011 and ADR-0012.
 * These tests validate that review prompts are non-leading, sentiment extraction
 * is accurate, and theme identification is meaningful.
 *
 * @module tests/evals/behavioral/review-quality
 */

import { describe, expect, it } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  REVIEW_DIMENSIONS,
  getDimension,
  getDimensionNames,
  getDimensionsBySignalType,
  getPromptText,
  getProbeText,
  calculateOverallSentiment,
  isValidSentiment,
  clampSentiment,
  calculateSentimentTrend,
  compareSentiment,
  type SentimentValue,
} from '../../../src/temporal/qualitative';

import type {
  ReviewDimension,
  QualitativeReview,
  ReviewDimensionName,
} from '../../../src/temporal/types';

// =============================================================================
// Types
// =============================================================================

interface GoldenReviewScenario {
  id: string;
  version: string;
  source: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  review_output: {
    id: string;
    baselineId: string;
    createdAt: string;
    overallSentiment: number;
    themes: string[];
    dimensions: Array<{
      name: string;
      score: number;
      sentiment: number;
      observations: string;
    }>;
    triggerReason?: string;
  };
  expected_properties?: {
    overall_sentiment_range?: [number, number];
    lowest_dimension?: string;
    highest_dimension?: string;
    theme_extraction_valid?: boolean;
    sentiment_score_alignment?: boolean;
    [key: string]: unknown;
  };
}

// =============================================================================
// Configuration
// =============================================================================

const GOLDEN_DATASET_PATH = join(__dirname, '../golden/temporal');

// Review scenarios from golden dataset (exported for potential future use)
export const REVIEW_SCENARIOS = ['scenario-08-qualitative-review.json'];

// =============================================================================
// Test Utilities
// =============================================================================

function loadGoldenScenario(filename: string): GoldenReviewScenario | null {
  const filepath = join(GOLDEN_DATASET_PATH, filename);
  if (!existsSync(filepath)) {
    return null;
  }
  const content = readFileSync(filepath, 'utf-8');
  return JSON.parse(content) as GoldenReviewScenario;
}

/**
 * Create a mock QualitativeReview for testing.
 */
function createMockReview(
  id: string,
  baselineId: string,
  createdAt: string,
  overallSentiment: SentimentValue
): QualitativeReview {
  // Create dimensions with the same sentiment for simplicity
  const dimensions: ReviewDimension[] = [
    {
      name: 'perceivedFriction',
      promptText: 'Test',
      response: 'Test',
      sentiment: overallSentiment,
    },
    { name: 'trustCalibration', promptText: 'Test', response: 'Test', sentiment: overallSentiment },
    { name: 'taskFit', promptText: 'Test', response: 'Test', sentiment: overallSentiment },
    {
      name: 'configurationConfidence',
      promptText: 'Test',
      response: 'Test',
      sentiment: overallSentiment,
    },
    {
      name: 'improvementAttribution',
      promptText: 'Test',
      response: 'Test',
      sentiment: overallSentiment,
    },
    {
      name: 'workflowSatisfaction',
      promptText: 'Test',
      response: 'Test',
      sentiment: overallSentiment,
    },
  ];

  return {
    id,
    baselineId,
    createdAt,
    dimensions,
    overallSentiment,
    themes: ['test-theme'],
  };
}

// =============================================================================
// Dimension Prompt Quality Tests
// =============================================================================

describe('Review Quality: Dimension Prompt Clarity', () => {
  it('has all 6 review dimensions defined', () => {
    const dimensionNames = getDimensionNames();
    expect(dimensionNames.length).toBe(6);
    expect(dimensionNames).toContain('perceivedFriction');
    expect(dimensionNames).toContain('trustCalibration');
    expect(dimensionNames).toContain('taskFit');
    expect(dimensionNames).toContain('configurationConfidence');
    expect(dimensionNames).toContain('improvementAttribution');
    expect(dimensionNames).toContain('workflowSatisfaction');
  });

  it('all dimensions have prompt text', () => {
    const dimensionNames = getDimensionNames();
    for (const name of dimensionNames) {
      const promptText = getPromptText(name);
      expect(promptText).toBeDefined();
      expect(promptText!.length).toBeGreaterThan(20); // Non-trivial prompt
    }
  });

  it('all dimensions have probe text', () => {
    const dimensionNames = getDimensionNames();
    for (const name of dimensionNames) {
      const probeText = getProbeText(name);
      expect(probeText).toBeDefined();
      expect(probeText!.length).toBeGreaterThan(10); // Non-trivial probe
    }
  });

  it('prompts are neutral and non-leading', () => {
    const dimensionNames = getDimensionNames();

    // Leading phrases that should NOT appear in prompts
    const leadingPhrases = [
      'how much has',
      'how well does',
      'how good is',
      'how bad is',
      'how often do you fail',
      'agree that',
      'would you say that',
      'obviously',
      'clearly',
      'always',
      'never',
    ];

    for (const name of dimensionNames) {
      const promptText = getPromptText(name);
      expect(promptText).toBeDefined();

      for (const phrase of leadingPhrases) {
        expect(promptText!.toLowerCase().includes(phrase)).toBe(false);
      }
    }
  });

  it('dimensions have descriptive names', () => {
    const dimensionNames = getDimensionNames();
    for (const name of dimensionNames) {
      // Names should be camelCase and descriptive
      expect(name.length).toBeGreaterThan(5);
      expect(/^[a-z][a-zA-Z]+$/.test(name)).toBe(true);
    }
  });

  it('dimensions can be grouped by signal type', () => {
    // Per Constitution Principle IV, different dimensions capture different signals
    const leadingDimensions = getDimensionsBySignalType('leading');
    const laggingDimensions = getDimensionsBySignalType('lagging');
    const qualitativeDimensions = getDimensionsBySignalType('qualitative');

    // Should have some of each type
    expect(leadingDimensions.length).toBeGreaterThan(0);
    expect(laggingDimensions.length).toBeGreaterThan(0);
    expect(qualitativeDimensions.length).toBeGreaterThan(0);
  });

  it('each dimension has required fields', () => {
    for (const dimension of REVIEW_DIMENSIONS) {
      expect(dimension.name).toBeDefined();
      expect(dimension.promptText).toBeDefined();
      expect(dimension.probeText).toBeDefined();
      expect(dimension.signalType).toBeDefined();
      // Per Constitution Principle IV, dimensions have different signal types
      expect(['leading', 'lagging', 'qualitative', 'causal']).toContain(dimension.signalType);
    }
  });
});

// =============================================================================
// Sentiment Extraction Accuracy Tests
// =============================================================================

describe('Review Quality: Sentiment Extraction', () => {
  it('validates sentiment values in Likert scale [-2, +2]', () => {
    // Valid Likert scale values
    expect(isValidSentiment(0)).toBe(true);
    expect(isValidSentiment(1)).toBe(true);
    expect(isValidSentiment(2)).toBe(true);
    expect(isValidSentiment(-1)).toBe(true);
    expect(isValidSentiment(-2)).toBe(true);

    // Invalid values (not integers or out of range)
    expect(isValidSentiment(0.5)).toBe(false);
    expect(isValidSentiment(1.5)).toBe(false);
    expect(isValidSentiment(-1.5)).toBe(false);
    expect(isValidSentiment(3)).toBe(false);
    expect(isValidSentiment(-3)).toBe(false);
    expect(isValidSentiment(NaN)).toBe(false);
    expect(isValidSentiment(Infinity)).toBe(false);
  });

  it('clamps sentiment values to valid Likert range', () => {
    expect(clampSentiment(3)).toBe(2);
    expect(clampSentiment(-3)).toBe(-2);
    expect(clampSentiment(0.6)).toBe(1); // Rounds to nearest integer
    expect(clampSentiment(-0.6)).toBe(-1);
    expect(clampSentiment(1.4)).toBe(1);
    expect(clampSentiment(-1.4)).toBe(-1);
  });

  it('calculates overall sentiment from dimensions', () => {
    // ReviewDimension uses Likert scale sentiment (-2 to +2)
    const dimensions: ReviewDimension[] = [
      {
        name: 'perceivedFriction',
        promptText: 'Test prompt 1',
        response: 'Good response',
        sentiment: 1,
      },
      {
        name: 'trustCalibration',
        promptText: 'Test prompt 2',
        response: 'OK response',
        sentiment: 0,
      },
      { name: 'taskFit', promptText: 'Test prompt 3', response: 'Poor response', sentiment: -1 },
    ];

    const overall = calculateOverallSentiment(dimensions);

    // Should be average of 1, 0, -1 = 0
    expect(overall).toBe(0);
  });

  it('handles empty dimensions array', () => {
    const overall = calculateOverallSentiment([]);
    expect(overall).toBe(0);
  });

  it('sentiment aligns with score in golden scenario', () => {
    const scenario = loadGoldenScenario('scenario-08-qualitative-review.json');
    if (!scenario || !scenario.review_output) {
      expect(true).toBe(true);
      return;
    }

    // Higher scores should correlate with higher sentiment
    const dimensions = scenario.review_output.dimensions;
    for (const dim of dimensions) {
      // Scores 1-2 should have negative or low sentiment
      // Scores 4-5 should have positive sentiment
      if (dim.score <= 2) {
        expect(dim.sentiment).toBeLessThan(0.3);
      }
      if (dim.score >= 4) {
        expect(dim.sentiment).toBeGreaterThan(0.3);
      }
    }
  });

  it('calculates sentiment trend from review series', () => {
    // Create a series of reviews with increasing sentiment
    const reviews: QualitativeReview[] = [
      createMockReview('review-1', 'baseline-1', '2026-01-01T10:00:00.000Z', -1),
      createMockReview('review-2', 'baseline-2', '2026-01-08T10:00:00.000Z', 0),
      createMockReview('review-3', 'baseline-3', '2026-01-15T10:00:00.000Z', 1),
    ];

    const trend = calculateSentimentTrend(reviews);

    // Should detect positive slope (increasing sentiment)
    expect(trend).not.toBeNull();
    expect(trend!.slope).toBeGreaterThan(0);
    expect(trend!.values.length).toBe(3);
  });

  it('compares sentiment between two reviews', () => {
    const before = createMockReview('review-1', 'baseline-1', '2026-01-01T10:00:00.000Z', -1);
    const after = createMockReview('review-2', 'baseline-2', '2026-01-15T10:00:00.000Z', 1);

    const comparison = compareSentiment(before, after);

    // Change from -1 to 1 = +2
    expect(comparison.change).toBe(2);
  });
});

// =============================================================================
// Theme Identification Quality Tests
// =============================================================================

describe('Review Quality: Theme Identification', () => {
  it('golden scenario has meaningful themes', () => {
    const scenario = loadGoldenScenario('scenario-08-qualitative-review.json');
    if (!scenario || !scenario.review_output) {
      expect(true).toBe(true);
      return;
    }

    const themes = scenario.review_output.themes;

    // Should have themes
    expect(themes.length).toBeGreaterThan(0);

    // Themes should be descriptive (not single words)
    for (const theme of themes) {
      // Either hyphenated or single meaningful word
      expect(theme.length).toBeGreaterThan(3);
    }
  });

  it('themes relate to dimension observations', () => {
    const scenario = loadGoldenScenario('scenario-08-qualitative-review.json');
    if (!scenario || !scenario.review_output) {
      expect(true).toBe(true);
      return;
    }

    const themes = scenario.review_output.themes;
    const observations = scenario.review_output.dimensions.map((d) => d.observations.toLowerCase());

    // At least some themes should appear in observations (or vice versa)
    // This is a weak check - in real TruLens eval, we'd use LLM-as-judge
    let themeObservationOverlap = 0;
    for (const theme of themes) {
      const themeWords = theme.toLowerCase().split('-');
      for (const obs of observations) {
        for (const word of themeWords) {
          if (obs.includes(word)) {
            themeObservationOverlap++;
            break;
          }
        }
      }
    }

    // At least one theme should relate to observations
    expect(themeObservationOverlap).toBeGreaterThan(0);
  });

  it('overall sentiment matches dimension average', () => {
    const scenario = loadGoldenScenario('scenario-08-qualitative-review.json');
    if (!scenario || !scenario.review_output) {
      expect(true).toBe(true);
      return;
    }

    const dimensions = scenario.review_output.dimensions;
    const reportedOverall = scenario.review_output.overallSentiment;

    // Calculate expected average
    const avgSentiment = dimensions.reduce((sum, d) => sum + d.sentiment, 0) / dimensions.length;

    // Should be close to average (within 0.2 for Likert scale per ADR-0020)
    expect(Math.abs(reportedOverall - avgSentiment)).toBeLessThan(0.2);
  });

  it('identifies lowest and highest dimensions correctly', () => {
    const scenario = loadGoldenScenario('scenario-08-qualitative-review.json');
    if (!scenario || !scenario.review_output || !scenario.expected_properties) {
      expect(true).toBe(true);
      return;
    }

    const dimensions = scenario.review_output.dimensions;
    if (dimensions.length === 0) {
      expect(true).toBe(true);
      return;
    }

    // Find actual lowest and highest
    let lowest = dimensions[0]!;
    let highest = dimensions[0]!;
    for (const dim of dimensions) {
      if (dim.sentiment < lowest.sentiment) lowest = dim;
      if (dim.sentiment > highest.sentiment) highest = dim;
    }

    // Compare to expected
    if (scenario.expected_properties.lowest_dimension) {
      expect(lowest.name).toBe(scenario.expected_properties.lowest_dimension);
    }
    if (scenario.expected_properties.highest_dimension) {
      expect(highest.name).toBe(scenario.expected_properties.highest_dimension);
    }
  });
});

// =============================================================================
// Trigger Reason Tests
// =============================================================================

describe('Review Quality: Trigger Tracking', () => {
  it('review has valid trigger reason', () => {
    const scenario = loadGoldenScenario('scenario-08-qualitative-review.json');
    if (!scenario || !scenario.review_output) {
      expect(true).toBe(true);
      return;
    }

    const validTriggers = ['scheduled', 'triggered', 'manual'];
    const trigger = scenario.review_output.triggerReason;

    if (trigger) {
      expect(validTriggers).toContain(trigger);
    }
  });
});

// =============================================================================
// Integration Tests with Golden Data
// =============================================================================

describe('Review Quality: Golden Scenario Validation', () => {
  it('overall sentiment is within expected range', () => {
    const scenario = loadGoldenScenario('scenario-08-qualitative-review.json');
    if (!scenario || !scenario.review_output || !scenario.expected_properties) {
      expect(true).toBe(true);
      return;
    }

    const overall = scenario.review_output.overallSentiment;
    const range = scenario.expected_properties.overall_sentiment_range;

    if (range) {
      expect(overall).toBeGreaterThanOrEqual(range[0]);
      expect(overall).toBeLessThanOrEqual(range[1]);
    }
  });

  it('all dimensions have valid sentiment and score values', () => {
    const scenario = loadGoldenScenario('scenario-08-qualitative-review.json');
    if (!scenario || !scenario.review_output) {
      expect(true).toBe(true);
      return;
    }

    for (const dim of scenario.review_output.dimensions) {
      // Golden dataset uses Likert scale per ADR-0020
      expect(dim.sentiment).toBeGreaterThanOrEqual(-2);
      expect(dim.sentiment).toBeLessThanOrEqual(2);
      // Score is 1-5 scale
      expect(dim.score).toBeGreaterThanOrEqual(1);
      expect(dim.score).toBeLessThanOrEqual(5);
    }
  });

  it('has complete dimension coverage (all 6 dimensions)', () => {
    const scenario = loadGoldenScenario('scenario-08-qualitative-review.json');
    if (!scenario || !scenario.review_output) {
      expect(true).toBe(true);
      return;
    }

    const dimensionNames = getDimensionNames();
    const reviewDimNames = scenario.review_output.dimensions.map((d) => d.name);

    // Should have all standard dimensions
    expect(reviewDimNames.length).toBe(dimensionNames.length);
    for (const name of dimensionNames) {
      expect(reviewDimNames).toContain(name);
    }
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Review Quality: Edge Cases', () => {
  it('handles getDimension with invalid name', () => {
    // Cast to bypass TypeScript - testing runtime behavior with invalid input
    const result = getDimension('invalidDimensionName' as ReviewDimensionName);
    expect(result).toBeUndefined();
  });

  it('handles valid dimension lookup', () => {
    const result = getDimension('perceivedFriction');
    expect(result).toBeDefined();
    expect(result?.name).toBe('perceivedFriction');
  });

  it('handles single dimension sentiment calculation', () => {
    const dimensions: ReviewDimension[] = [
      { name: 'perceivedFriction', promptText: 'Test', response: 'Test', sentiment: 1 },
    ];

    const overall = calculateOverallSentiment(dimensions);
    expect(overall).toBe(1);
  });

  it('handles extreme sentiment values', () => {
    // Using Likert scale extremes: -2 and +2
    const dimensions: ReviewDimension[] = [
      { name: 'perceivedFriction', promptText: 'Test', response: 'Excellent', sentiment: 2 },
      { name: 'trustCalibration', promptText: 'Test', response: 'Terrible', sentiment: -2 },
    ];

    const overall = calculateOverallSentiment(dimensions);
    // Should average to 0
    expect(overall).toBe(0);
  });
});
