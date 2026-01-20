/**
 * EP11 Score Calculation Unit Tests
 *
 * Tests for the evaluation score calculation utilities.
 * Covers weighted scoring, threshold checks, aggregation, and formatting.
 *
 * @module tests/unit/eval/scoring
 */

import { describe, test, expect } from 'bun:test';
import {
  calculateOverallScore,
  passesThreshold,
  meetsDogfoodTarget,
  passesReleaseGate,
  calculateAverageScores,
  calculatePassRate,
  formatScoreAsPercent,
  formatGradesSummary,
  identifyWeakestMetric,
  calculateScoreDelta,
  determineScoreTrend,
  validateWeights,
  normalizeWeights,
} from '../../../src/eval/scoring';
import type {
  EvaluationGrades,
  EvaluationResult,
  EvaluationSummary,
  RubricWeights,
  LLMJudgeGrade,
  CodeBasedGrade,
} from '../../../src/eval/types';
import { EVAL_THRESHOLDS } from '../../../src/eval/types';

// =============================================================================
// Test Fixtures
// =============================================================================

function createCodeBasedGrade(passed: boolean): CodeBasedGrade {
  return {
    passed,
    checks: {
      outputFormatValid: passed,
      requiredFieldsPresent: passed,
      noHallucinatedFiles: passed,
      causalChainComplete: passed,
    },
  };
}

function createLLMJudgeGrade(overrides: Partial<LLMJudgeGrade> = {}): LLMJudgeGrade {
  return {
    actionability: 0.8,
    causalAccuracy: 0.7,
    relevance: 0.9,
    reasoning: {
      actionability: 'Good actionability',
      causalAccuracy: 'Good causal accuracy',
      relevance: 'Good relevance',
    },
    ...overrides,
  };
}

function createGrades(
  codeBasedPassed: boolean,
  llmJudge?: LLMJudgeGrade
): EvaluationGrades {
  const grades: EvaluationGrades = {
    codeBased: createCodeBasedGrade(codeBasedPassed),
  };
  if (llmJudge !== undefined) {
    grades.llmJudge = llmJudge;
  }
  return grades;
}

function createEvaluationResult(
  overallScore: number,
  passed: boolean,
  llmJudge?: LLMJudgeGrade
): EvaluationResult {
  return {
    id: `result-${Math.random().toString(36).slice(2, 8)}`,
    scenarioId: 'test-scenario',
    timestamp: new Date().toISOString(),
    grades: createGrades(true, llmJudge),
    overallScore,
    passed,
  };
}

// =============================================================================
// Overall Score Calculation
// =============================================================================

describe('calculateOverallScore', () => {
  test('returns 0 when code-based checks fail', () => {
    const grades = createGrades(false, createLLMJudgeGrade());

    const score = calculateOverallScore(grades);

    expect(score).toBe(0);
  });

  test('returns 0 when no LLM judge grades', () => {
    const grades = createGrades(true, undefined);

    const score = calculateOverallScore(grades);

    expect(score).toBe(0);
  });

  test('calculates weighted score with default weights', () => {
    const llmGrade = createLLMJudgeGrade({
      actionability: 0.8,
      causalAccuracy: 0.7,
      relevance: 0.9,
    });
    const grades = createGrades(true, llmGrade);

    const score = calculateOverallScore(grades);

    // Default weights: actionability=0.4, causalAccuracy=0.3, relevance=0.3
    // Expected: 0.8*0.4 + 0.7*0.3 + 0.9*0.3 = 0.32 + 0.21 + 0.27 = 0.80
    expect(score).toBeCloseTo(0.8, 2);
  });

  test('calculates weighted score with custom weights', () => {
    const llmGrade = createLLMJudgeGrade({
      actionability: 1.0,
      causalAccuracy: 0.5,
      relevance: 0.5,
    });
    const grades = createGrades(true, llmGrade);
    const weights: RubricWeights = {
      actionability: 0.5,
      causalAccuracy: 0.25,
      relevance: 0.25,
    };

    const score = calculateOverallScore(grades, weights);

    // Expected: 1.0*0.5 + 0.5*0.25 + 0.5*0.25 = 0.5 + 0.125 + 0.125 = 0.75
    expect(score).toBeCloseTo(0.75, 2);
  });

  test('returns 1.0 for perfect scores', () => {
    const llmGrade = createLLMJudgeGrade({
      actionability: 1.0,
      causalAccuracy: 1.0,
      relevance: 1.0,
    });
    const grades = createGrades(true, llmGrade);

    const score = calculateOverallScore(grades);

    expect(score).toBe(1.0);
  });
});

// =============================================================================
// Threshold Checks
// =============================================================================

describe('passesThreshold', () => {
  test('returns true for score at threshold', () => {
    expect(passesThreshold(0.7)).toBe(true);
  });

  test('returns true for score above threshold', () => {
    expect(passesThreshold(0.85)).toBe(true);
  });

  test('returns false for score below threshold', () => {
    expect(passesThreshold(0.69)).toBe(false);
  });

  test('accepts custom threshold', () => {
    expect(passesThreshold(0.8, 0.9)).toBe(false);
    expect(passesThreshold(0.9, 0.9)).toBe(true);
  });
});

describe('meetsDogfoodTarget', () => {
  test('returns true for score at dogfood target', () => {
    expect(meetsDogfoodTarget(EVAL_THRESHOLDS.DOGFOOD_TARGET)).toBe(true);
  });

  test('returns false for score below dogfood target', () => {
    expect(meetsDogfoodTarget(0.94)).toBe(false);
  });

  test('returns true for perfect score', () => {
    expect(meetsDogfoodTarget(1.0)).toBe(true);
  });
});

describe('passesReleaseGate', () => {
  test('returns true for pass rate at threshold', () => {
    const summary: EvaluationSummary = {
      totalScenarios: 10,
      passedScenarios: 7,
      passRate: 0.7,
      averageScores: { actionability: 0.8, causalAccuracy: 0.7, relevance: 0.9, overall: 0.8 },
      results: [],
      timestamp: new Date().toISOString(),
    };

    expect(passesReleaseGate(summary)).toBe(true);
  });

  test('returns false for pass rate below threshold', () => {
    const summary: EvaluationSummary = {
      totalScenarios: 10,
      passedScenarios: 6,
      passRate: 0.6,
      averageScores: { actionability: 0.8, causalAccuracy: 0.7, relevance: 0.9, overall: 0.8 },
      results: [],
      timestamp: new Date().toISOString(),
    };

    expect(passesReleaseGate(summary)).toBe(false);
  });
});

// =============================================================================
// Score Aggregation
// =============================================================================

describe('calculateAverageScores', () => {
  test('returns zeros for empty results', () => {
    const scores = calculateAverageScores([]);

    expect(scores).toEqual({
      actionability: 0,
      causalAccuracy: 0,
      relevance: 0,
      overall: 0,
    });
  });

  test('calculates averages from multiple results', () => {
    const results = [
      createEvaluationResult(0.8, true, createLLMJudgeGrade({
        actionability: 0.8, causalAccuracy: 0.7, relevance: 0.9,
        reasoning: { actionability: '', causalAccuracy: '', relevance: '' },
      })),
      createEvaluationResult(0.7, true, createLLMJudgeGrade({
        actionability: 0.6, causalAccuracy: 0.8, relevance: 0.7,
        reasoning: { actionability: '', causalAccuracy: '', relevance: '' },
      })),
    ];

    const scores = calculateAverageScores(results);

    expect(scores.actionability).toBeCloseTo(0.7, 2);
    expect(scores.causalAccuracy).toBeCloseTo(0.75, 2);
    expect(scores.relevance).toBeCloseTo(0.8, 2);
    expect(scores.overall).toBeCloseTo(0.75, 2);
  });

  test('handles results without LLM judge grades', () => {
    const results = [
      createEvaluationResult(0.5, false, undefined),
      createEvaluationResult(0.6, false, undefined),
    ];

    const scores = calculateAverageScores(results);

    expect(scores.actionability).toBe(0);
    expect(scores.causalAccuracy).toBe(0);
    expect(scores.relevance).toBe(0);
    expect(scores.overall).toBeCloseTo(0.55, 2);
  });
});

describe('calculatePassRate', () => {
  test('returns 0 for empty results', () => {
    expect(calculatePassRate([])).toBe(0);
  });

  test('returns 1 when all pass', () => {
    const results = [
      createEvaluationResult(0.8, true),
      createEvaluationResult(0.9, true),
    ];

    expect(calculatePassRate(results)).toBe(1);
  });

  test('returns 0 when all fail', () => {
    const results = [
      createEvaluationResult(0.5, false),
      createEvaluationResult(0.4, false),
    ];

    expect(calculatePassRate(results)).toBe(0);
  });

  test('calculates correct rate for mixed results', () => {
    const results = [
      createEvaluationResult(0.8, true),
      createEvaluationResult(0.5, false),
      createEvaluationResult(0.9, true),
      createEvaluationResult(0.6, false),
    ];

    expect(calculatePassRate(results)).toBe(0.5);
  });
});

// =============================================================================
// Score Formatting
// =============================================================================

describe('formatScoreAsPercent', () => {
  test('formats score as percentage with default decimals', () => {
    expect(formatScoreAsPercent(0.875)).toBe('87.5%');
  });

  test('formats score with custom decimals', () => {
    expect(formatScoreAsPercent(0.875, 0)).toBe('88%');
    expect(formatScoreAsPercent(0.875, 2)).toBe('87.50%');
  });

  test('formats 0 and 1 correctly', () => {
    expect(formatScoreAsPercent(0)).toBe('0.0%');
    expect(formatScoreAsPercent(1)).toBe('100.0%');
  });
});

describe('formatGradesSummary', () => {
  test('formats passing code-based checks', () => {
    const grades = createGrades(true, createLLMJudgeGrade());

    const summary = formatGradesSummary(grades);

    expect(summary).toContain('Code-based: PASS');
    expect(summary).toContain('LLM Judge:');
    expect(summary).toContain('Actionability:');
  });

  test('formats failing code-based checks', () => {
    const grades: EvaluationGrades = {
      codeBased: {
        passed: false,
        checks: {
          outputFormatValid: true,
          requiredFieldsPresent: false,
          noHallucinatedFiles: true,
          causalChainComplete: false,
        },
      },
    };

    const summary = formatGradesSummary(grades);

    expect(summary).toContain('Code-based: FAIL');
    expect(summary).toContain('Failed:');
    expect(summary).toContain('requiredFieldsPresent');
    expect(summary).toContain('causalChainComplete');
  });

  test('handles missing LLM judge grades', () => {
    const grades = createGrades(true, undefined);

    const summary = formatGradesSummary(grades);

    expect(summary).toContain('Code-based: PASS');
    expect(summary).not.toContain('LLM Judge:');
  });
});

// =============================================================================
// Score Analysis
// =============================================================================

describe('identifyWeakestMetric', () => {
  test('returns null for undefined grades', () => {
    expect(identifyWeakestMetric(undefined)).toBeNull();
  });

  test('identifies actionability as weakest', () => {
    const grades = createLLMJudgeGrade({
      actionability: 0.5,
      causalAccuracy: 0.8,
      relevance: 0.9,
    });

    expect(identifyWeakestMetric(grades)).toBe('actionability');
  });

  test('identifies causalAccuracy as weakest', () => {
    const grades = createLLMJudgeGrade({
      actionability: 0.9,
      causalAccuracy: 0.4,
      relevance: 0.8,
    });

    expect(identifyWeakestMetric(grades)).toBe('causalAccuracy');
  });

  test('identifies relevance as weakest', () => {
    const grades = createLLMJudgeGrade({
      actionability: 0.9,
      causalAccuracy: 0.8,
      relevance: 0.3,
    });

    expect(identifyWeakestMetric(grades)).toBe('relevance');
  });
});

describe('calculateScoreDelta', () => {
  test('calculates positive delta (improvement)', () => {
    expect(calculateScoreDelta(0.85, 0.75)).toBeCloseTo(0.1, 5);
  });

  test('calculates negative delta (regression)', () => {
    expect(calculateScoreDelta(0.65, 0.75)).toBeCloseTo(-0.1, 5);
  });

  test('calculates zero delta', () => {
    expect(calculateScoreDelta(0.75, 0.75)).toBe(0);
  });
});

describe('determineScoreTrend', () => {
  test('returns improving for positive delta above threshold', () => {
    expect(determineScoreTrend(0.1)).toBe('improving');
  });

  test('returns regressing for negative delta below threshold', () => {
    expect(determineScoreTrend(-0.1)).toBe('regressing');
  });

  test('returns stable for delta within threshold', () => {
    expect(determineScoreTrend(0.03)).toBe('stable');
    expect(determineScoreTrend(-0.03)).toBe('stable');
  });

  test('accepts custom threshold', () => {
    expect(determineScoreTrend(0.03, 0.01)).toBe('improving');
    expect(determineScoreTrend(-0.03, 0.01)).toBe('regressing');
  });
});

// =============================================================================
// Weight Validation
// =============================================================================

describe('validateWeights', () => {
  test('returns true for weights summing to 1.0', () => {
    expect(validateWeights({ actionability: 0.4, causalAccuracy: 0.3, relevance: 0.3 })).toBe(true);
  });

  test('returns true for weights summing close to 1.0 (floating point)', () => {
    expect(validateWeights({ actionability: 0.33, causalAccuracy: 0.33, relevance: 0.34 })).toBe(true);
  });

  test('returns false for weights not summing to 1.0', () => {
    expect(validateWeights({ actionability: 0.5, causalAccuracy: 0.5, relevance: 0.5 })).toBe(false);
  });

  test('validates default weights', () => {
    expect(validateWeights(EVAL_THRESHOLDS.DEFAULT_WEIGHTS)).toBe(true);
  });
});

describe('normalizeWeights', () => {
  test('normalizes weights to sum to 1.0', () => {
    const weights = normalizeWeights({ actionability: 2, causalAccuracy: 1, relevance: 1 });

    expect(weights.actionability).toBeCloseTo(0.5, 2);
    expect(weights.causalAccuracy).toBeCloseTo(0.25, 2);
    expect(weights.relevance).toBeCloseTo(0.25, 2);
  });

  test('returns default weights for zero sum', () => {
    const weights = normalizeWeights({ actionability: 0, causalAccuracy: 0, relevance: 0 });

    expect(weights).toEqual(EVAL_THRESHOLDS.DEFAULT_WEIGHTS);
  });

  test('preserves already normalized weights', () => {
    const input = { actionability: 0.4, causalAccuracy: 0.3, relevance: 0.3 };
    const weights = normalizeWeights(input);

    expect(weights.actionability).toBeCloseTo(0.4, 2);
    expect(weights.causalAccuracy).toBeCloseTo(0.3, 2);
    expect(weights.relevance).toBeCloseTo(0.3, 2);
  });
});
