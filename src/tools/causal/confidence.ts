/**
 * EP07 Causal Tracing Engine - Confidence Assessor
 *
 * 6-factor confidence scoring for causal chains:
 * - specificity: Issue clearly links to specific trigger
 * - temporal: Timing supports causal relationship
 * - mechanistic: Plausible mechanism explains causation
 * - evidenceQuality: Evidence is direct, not inferred
 * - reproducibility: Pattern seen multiple times
 * - alternatives: Alternative causes considered
 *
 * Confidence levels:
 * - high: 5-6 factors true
 * - medium: 3-4 factors true
 * - low: 0-2 factors true
 *
 * @module src/tools/causal/confidence
 */

import type {
  EvidenceItem,
  Gap,
  ConfidenceScore,
  ConfidenceLevel,
} from './types';
import { computeConfidenceLevel } from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Input for confidence assessment.
 */
export interface AssessConfidenceInput {
  /** Collected evidence items */
  evidence: EvidenceItem[];
  /** Description of the issue being traced */
  issueDescription: string;
  /** Identified configuration gap (if any) */
  gap?: Gap;
  /** Causal mechanism explanation (if any) */
  mechanism?: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Threshold values for confidence levels.
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Minimum factors for high confidence */
  HIGH: 5,
  /** Minimum factors for medium confidence */
  MEDIUM: 3,
} as const;

/**
 * Minimum evidence items for reproducibility.
 */
const REPRODUCIBILITY_THRESHOLD = 3;

/**
 * Maximum age in milliseconds for temporal relevance (30 days).
 */
const TEMPORAL_RELEVANCE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// =============================================================================
// ConfidenceAssessor Class
// =============================================================================

/**
 * Assesses confidence in causal chains using 6-factor checklist.
 *
 * @example
 * ```typescript
 * const assessor = new ConfidenceAssessor();
 *
 * const score = assessor.assess({
 *   evidence: [...],
 *   issueDescription: 'API endpoint missing error handling',
 *   gap: { type: 'missing_guidance', ... },
 *   mechanism: 'Missing guidance led to incomplete implementation',
 * });
 *
 * console.log(`Confidence: ${score.overall}`); // 'high', 'medium', or 'low'
 * ```
 */
export class ConfidenceAssessor {
  /**
   * Assess confidence for a traced issue.
   *
   * @param input - Assessment input
   * @returns Complete confidence score with all 6 factors and overall level
   */
  assess(input: AssessConfidenceInput): ConfidenceScore {
    const { evidence, issueDescription, gap, mechanism } = input;

    const factors = {
      specificity: this.assessSpecificity(evidence, issueDescription),
      temporal: this.assessTemporal(evidence),
      mechanistic: this.assessMechanistic(gap, mechanism),
      evidenceQuality: this.assessEvidenceQuality(evidence),
      reproducibility: this.assessReproducibility(evidence),
      alternatives: this.assessAlternatives(gap, mechanism),
    };

    const overall = computeConfidenceLevel(factors);

    return {
      ...factors,
      overall,
    };
  }

  /**
   * Count how many factors are true.
   *
   * @param score - Confidence score (without overall)
   * @returns Number of true factors
   */
  countFactors(score: Omit<ConfidenceScore, 'overall'>): number {
    return [
      score.specificity,
      score.temporal,
      score.mechanistic,
      score.evidenceQuality,
      score.reproducibility,
      score.alternatives,
    ].filter(Boolean).length;
  }

  /**
   * Compute overall confidence level from factor count.
   *
   * @param factorCount - Number of true factors
   * @returns Confidence level
   */
  computeLevel(factorCount: number): ConfidenceLevel {
    if (factorCount >= CONFIDENCE_THRESHOLDS.HIGH) {
      return 'high';
    }
    if (factorCount >= CONFIDENCE_THRESHOLDS.MEDIUM) {
      return 'medium';
    }
    return 'low';
  }

  // ===========================================================================
  // Factor Assessment Methods
  // ===========================================================================

  /**
   * Assess specificity: Issue clearly links to specific trigger.
   *
   * True if evidence has specific file/line locations that match the issue.
   */
  private assessSpecificity(
    evidence: EvidenceItem[],
    issueDescription: string
  ): boolean {
    if (evidence.length === 0) {
      return false;
    }

    // Check if any evidence has position data
    const hasPosition = evidence.some((e) => e.position?.filePath);

    // Check if evidence content relates to issue description
    const lowerIssue = issueDescription.toLowerCase();
    const hasMatch = evidence.some(
      (e) =>
        e.content?.toLowerCase().includes(lowerIssue.slice(0, 20)) ||
        (e.position?.filePath && lowerIssue.includes(e.position.filePath.toLowerCase()))
    );

    return hasPosition || hasMatch;
  }

  /**
   * Assess temporal: Timing supports causal relationship.
   *
   * True if evidence has timestamps and they're recent enough.
   */
  private assessTemporal(evidence: EvidenceItem[]): boolean {
    if (evidence.length === 0) {
      return false;
    }

    // Check if evidence has timestamps
    const withTimestamps = evidence.filter((e) => e.timestamp);
    if (withTimestamps.length === 0) {
      return false;
    }

    // Check if timestamps are reasonably recent
    const now = Date.now();
    const hasRecent = withTimestamps.some((e) => {
      const timestamp = new Date(e.timestamp!).getTime();
      return now - timestamp < TEMPORAL_RELEVANCE_MAX_AGE_MS;
    });

    return hasRecent;
  }

  /**
   * Assess mechanistic: Plausible mechanism explains causation.
   *
   * True if gap and mechanism are provided, explaining the causal path.
   */
  private assessMechanistic(gap?: Gap, mechanism?: string): boolean {
    // Need both gap and mechanism for full mechanistic understanding
    if (gap && mechanism && mechanism.length > 10) {
      return true;
    }

    // Gap alone suggests some mechanistic understanding
    if (gap?.expectedGuidance) {
      return true;
    }

    return false;
  }

  /**
   * Assess evidence quality: Evidence is direct, not inferred.
   *
   * True if evidence is SessionMatch or ToolTrace (direct) vs inferred.
   */
  private assessEvidenceQuality(evidence: EvidenceItem[]): boolean {
    if (evidence.length === 0) {
      return false;
    }

    // Direct evidence types
    const directTypes = ['SessionMatch', 'ToolTrace', 'GitCorrelation'];

    const directCount = evidence.filter((e) =>
      directTypes.includes(e.type)
    ).length;

    // More than half should be direct
    return directCount > evidence.length / 2;
  }

  /**
   * Assess reproducibility: Pattern seen multiple times.
   *
   * True if we have multiple pieces of evidence suggesting pattern.
   */
  private assessReproducibility(evidence: EvidenceItem[]): boolean {
    return evidence.length >= REPRODUCIBILITY_THRESHOLD;
  }

  /**
   * Assess alternatives: Alternative causes considered.
   *
   * True if gap and mechanism suggest alternatives were ruled out.
   */
  private assessAlternatives(gap?: Gap, mechanism?: string): boolean {
    // When we have a specific gap and mechanism, we've considered
    // what could have prevented the issue (counterfactual reasoning)
    if (gap && mechanism) {
      return true;
    }

    // Gap counterfactual suggests alternative scenario was considered
    if (gap?.counterfactual && gap.counterfactual.length > 0) {
      return true;
    }

    return false;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new ConfidenceAssessor instance.
 *
 * @returns ConfidenceAssessor instance
 */
export function createConfidenceAssessor(): ConfidenceAssessor {
  return new ConfidenceAssessor();
}

// =============================================================================
// Standalone Function
// =============================================================================

/**
 * Assess confidence for a traced issue.
 *
 * This is a convenience function for one-off assessment.
 * For multiple assessments, use `createConfidenceAssessor()` to reuse the instance.
 *
 * @param input - Assessment input
 * @returns Complete confidence score
 */
export function assessConfidence(input: AssessConfidenceInput): ConfidenceScore {
  const assessor = new ConfidenceAssessor();
  return assessor.assess(input);
}
