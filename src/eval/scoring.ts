/**
 * EP11 Quality & Security - Score Calculation
 *
 * Evaluation score calculation utilities for the LLM-as-judge framework.
 * Handles weighted scoring, threshold checks, and result aggregation.
 *
 * @module eval/scoring
 */

import type {
  EvaluationGrades,
  EvaluationResult,
  EvaluationSummary,
  RubricWeights,
  LLMJudgeGrade,
} from './types';
import { EVAL_THRESHOLDS } from './types';

// =============================================================================
// Overall Score Calculation
// =============================================================================

/**
 * Calculate overall score from evaluation grades.
 *
 * The scoring algorithm is:
 * 1. Code-based checks are a pass/fail gate - if they fail, score is 0
 * 2. LLM judge scores are weighted by the rubric weights
 * 3. Final score is the weighted sum of LLM judge metrics
 *
 * @param grades - The evaluation grades (code-based + LLM judge)
 * @param weights - The rubric weights for each metric
 * @returns Overall score between 0 and 1
 *
 * @example
 * const score = calculateOverallScore(grades, {
 *   actionability: 0.4,
 *   causalAccuracy: 0.3,
 *   relevance: 0.3,
 * });
 */
export function calculateOverallScore(
  grades: EvaluationGrades,
  weights: RubricWeights = EVAL_THRESHOLDS.DEFAULT_WEIGHTS
): number {
  // Code-based is a pass/fail gate
  if (!grades.codeBased.passed) {
    return 0;
  }

  // LLM judge scores weighted by rubric
  if (!grades.llmJudge) {
    return 0;
  }

  return (
    grades.llmJudge.actionability * weights.actionability +
    grades.llmJudge.causalAccuracy * weights.causalAccuracy +
    grades.llmJudge.relevance * weights.relevance
  );
}

// =============================================================================
// Threshold Checks
// =============================================================================

/**
 * Check if a score passes the minimum threshold.
 *
 * @param score - The score to check (0-1)
 * @param threshold - The minimum threshold (default: PASS_THRESHOLD)
 * @returns true if the score meets or exceeds the threshold
 */
export function passesThreshold(
  score: number,
  threshold: number = EVAL_THRESHOLDS.PASS_THRESHOLD
): boolean {
  return score >= threshold;
}

/**
 * Check if a score meets the dogfood target.
 *
 * @param score - The score to check (0-1)
 * @returns true if the score meets the dogfood target
 */
export function meetsDogfoodTarget(score: number): boolean {
  return score >= EVAL_THRESHOLDS.DOGFOOD_TARGET;
}

/**
 * Check if evaluation passes the release gate.
 *
 * @param summary - The evaluation summary
 * @returns true if pass rate meets the threshold
 */
export function passesReleaseGate(summary: EvaluationSummary): boolean {
  return summary.passRate >= EVAL_THRESHOLDS.PASS_THRESHOLD;
}

// =============================================================================
// Score Aggregation
// =============================================================================

/**
 * Calculate average scores from multiple evaluation results.
 *
 * @param results - Array of evaluation results
 * @returns Average scores by metric
 */
export function calculateAverageScores(results: EvaluationResult[]): {
  actionability: number;
  causalAccuracy: number;
  relevance: number;
  overall: number;
} {
  if (results.length === 0) {
    return {
      actionability: 0,
      causalAccuracy: 0,
      relevance: 0,
      overall: 0,
    };
  }

  // Filter to results with LLM judge scores
  const withScores = results.filter((r) => r.grades.llmJudge);

  if (withScores.length === 0) {
    return {
      actionability: 0,
      causalAccuracy: 0,
      relevance: 0,
      overall: results.reduce((sum, r) => sum + r.overallScore, 0) / results.length,
    };
  }

  const sum = withScores.reduce(
    (acc, r) => {
      const llm = r.grades.llmJudge!;
      return {
        actionability: acc.actionability + llm.actionability,
        causalAccuracy: acc.causalAccuracy + llm.causalAccuracy,
        relevance: acc.relevance + llm.relevance,
      };
    },
    { actionability: 0, causalAccuracy: 0, relevance: 0 }
  );

  return {
    actionability: sum.actionability / withScores.length,
    causalAccuracy: sum.causalAccuracy / withScores.length,
    relevance: sum.relevance / withScores.length,
    overall: results.reduce((s, r) => s + r.overallScore, 0) / results.length,
  };
}

/**
 * Calculate pass rate from evaluation results.
 *
 * @param results - Array of evaluation results
 * @returns Pass rate between 0 and 1
 */
export function calculatePassRate(results: EvaluationResult[]): number {
  if (results.length === 0) {
    return 0;
  }

  const passed = results.filter((r) => r.passed).length;
  return passed / results.length;
}

// =============================================================================
// Score Formatting
// =============================================================================

/**
 * Format a score as a percentage string.
 *
 * @param score - The score to format (0-1)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 *
 * @example
 * formatScoreAsPercent(0.875) // '87.5%'
 * formatScoreAsPercent(0.7, 0) // '70%'
 */
export function formatScoreAsPercent(score: number, decimals: number = 1): string {
  return `${(score * 100).toFixed(decimals)}%`;
}

/**
 * Format evaluation grades as a summary string.
 *
 * @param grades - The evaluation grades
 * @returns Human-readable summary
 */
export function formatGradesSummary(grades: EvaluationGrades): string {
  const lines: string[] = [];

  // Code-based checks
  const cb = grades.codeBased;
  lines.push(`Code-based: ${cb.passed ? 'PASS' : 'FAIL'}`);
  if (!cb.passed) {
    const failed = Object.entries(cb.checks)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    lines.push(`  Failed: ${failed.join(', ')}`);
  }

  // LLM judge scores
  if (grades.llmJudge) {
    const llm = grades.llmJudge;
    lines.push(`LLM Judge:`);
    lines.push(`  Actionability: ${formatScoreAsPercent(llm.actionability)}`);
    lines.push(`  Causal Accuracy: ${formatScoreAsPercent(llm.causalAccuracy)}`);
    lines.push(`  Relevance: ${formatScoreAsPercent(llm.relevance)}`);
  }

  return lines.join('\n');
}

// =============================================================================
// Score Analysis
// =============================================================================

/**
 * Identify the weakest metric from LLM judge scores.
 *
 * @param grades - The LLM judge grades
 * @returns The metric name with lowest score, or null if no grades
 */
export function identifyWeakestMetric(
  grades: LLMJudgeGrade | undefined
): 'actionability' | 'causalAccuracy' | 'relevance' | null {
  if (!grades) {
    return null;
  }

  const metrics = [
    { name: 'actionability' as const, score: grades.actionability },
    { name: 'causalAccuracy' as const, score: grades.causalAccuracy },
    { name: 'relevance' as const, score: grades.relevance },
  ];

  return metrics.reduce((min, curr) => (curr.score < min.score ? curr : min)).name;
}

/**
 * Calculate score delta from a baseline.
 *
 * @param current - Current score
 * @param baseline - Baseline score to compare against
 * @returns Delta (positive = improvement, negative = regression)
 */
export function calculateScoreDelta(current: number, baseline: number): number {
  return current - baseline;
}

/**
 * Determine score trend based on delta.
 *
 * @param delta - Score delta
 * @param threshold - Minimum change to be considered significant (default: 0.05)
 * @returns Trend indicator
 */
export function determineScoreTrend(
  delta: number,
  threshold: number = 0.05
): 'improving' | 'regressing' | 'stable' {
  if (delta >= threshold) {
    return 'improving';
  }
  if (delta <= -threshold) {
    return 'regressing';
  }
  return 'stable';
}

// =============================================================================
// Weight Validation
// =============================================================================

/**
 * Validate that rubric weights sum to 1.0.
 *
 * @param weights - The weights to validate
 * @returns true if weights sum to approximately 1.0
 */
export function validateWeights(weights: RubricWeights): boolean {
  const sum = weights.actionability + weights.causalAccuracy + weights.relevance;
  // Allow small floating point error
  return Math.abs(sum - 1.0) < 0.001;
}

/**
 * Normalize weights to sum to 1.0.
 *
 * @param weights - The weights to normalize
 * @returns Normalized weights
 */
export function normalizeWeights(weights: RubricWeights): RubricWeights {
  const sum = weights.actionability + weights.causalAccuracy + weights.relevance;
  if (sum === 0) {
    return EVAL_THRESHOLDS.DEFAULT_WEIGHTS;
  }

  return {
    actionability: weights.actionability / sum,
    causalAccuracy: weights.causalAccuracy / sum,
    relevance: weights.relevance / sum,
  };
}
