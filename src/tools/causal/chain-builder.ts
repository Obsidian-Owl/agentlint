/**
 * EP07 Causal Tracing Engine - Chain Builder
 *
 * Constructs causal chains from evidence with trigger → gap → mechanism → effect structure.
 * Handles depth limiting and confidence computation.
 *
 * @module src/tools/causal/chain-builder
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  CausalChain,
  EvidenceItem,
  Gap,
  ConfidenceScore,
} from './types';
import { computeConfidenceLevel } from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for building a causal chain.
 */
export interface ChainBuilderOptions {
  /** Unique identifier for the issue */
  issueId: string;
  /** Description of the issue (effect) */
  issueDescription: string;
  /** Collected evidence items */
  evidence: EvidenceItem[];
  /** Project path where issue was detected */
  projectPath: string;
  /** Maximum trace depth (default: 5) */
  maxDepth?: number;
  /** Configuration gap that enabled the issue */
  gap?: Gap;
}

/**
 * Result of building a causal chain.
 */
export interface ChainBuilderResult {
  /** The constructed causal chain */
  chain: CausalChain;
  /** Whether trace is complete or partial */
  traceCompleteness: 'full' | 'partial';
  /** Any warnings during construction */
  warnings?: string[];
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default maximum trace depth.
 */
export const DEFAULT_MAX_DEPTH = 5;

/**
 * Minimum content length for quality evidence.
 */
const MIN_CONTENT_LENGTH = 50;

// =============================================================================
// Chain Builder Class
// =============================================================================

/**
 * Builds causal chains from evidence.
 *
 * The ChainBuilder constructs structured causal chains with:
 * - Trigger: The originating evidence (earliest timestamp)
 * - Gap: Configuration gap that enabled the issue (optional)
 * - Mechanism: How the gap led to the issue
 * - Effect: The detected issue description
 *
 * It also handles:
 * - Depth limiting (max 5 steps by default)
 * - Confidence computation based on 6-factor checklist
 * - Counterfactual generation from gap analysis
 *
 * @example
 * ```typescript
 * const builder = new ChainBuilder();
 * const result = builder.build({
 *   issueId: 'issue-123',
 *   issueDescription: 'TypeError: undefined is not a function',
 *   evidence: collectedEvidence,
 *   projectPath: '/my/project',
 *   gap: identifiedGap,
 * });
 *
 * console.log(result.chain.trigger.source);
 * console.log(result.chain.mechanism);
 * ```
 */
export class ChainBuilder {
  /**
   * Build a causal chain from evidence.
   *
   * @param options - Build options
   * @returns The constructed chain and metadata
   */
  build(options: ChainBuilderOptions): ChainBuilderResult {
    const {
      issueId,
      issueDescription,
      evidence,
      projectPath,
      gap,
    } = options;
    const maxDepth = Math.min(options.maxDepth ?? DEFAULT_MAX_DEPTH, DEFAULT_MAX_DEPTH);
    const warnings: string[] = [];
    const now = new Date().toISOString();

    // Sort evidence by timestamp to find trigger
    const sortedEvidence = this.sortEvidenceByTime(evidence);

    // Identify trigger (earliest evidence)
    const trigger = this.identifyTrigger(sortedEvidence);

    // Compute depth and limit flag
    const depth = Math.min(evidence.length, maxDepth);
    const depthLimitReached = evidence.length > maxDepth;

    if (depthLimitReached) {
      warnings.push(`Trace depth limited to ${maxDepth} steps (${evidence.length} total evidence items)`);
    }

    // Generate mechanism from evidence
    const mechanism = this.generateMechanism(trigger, gap);

    // Compute confidence based on evidence quality
    const confidence = this.computeConfidence(evidence);

    // Generate counterfactual from gap
    const counterfactual = gap?.counterfactual;

    // Build the chain
    const chain: CausalChain = {
      id: uuidv4(),
      issueId,
      trigger,
      gap,
      mechanism,
      effect: issueDescription,
      confidence,
      evidence: sortedEvidence.length > 0 ? sortedEvidence : [trigger],
      depth,
      depthLimitReached,
      projectPath,
      createdAt: now,
      counterfactual,
      patternId: undefined,
    };

    const result: ChainBuilderResult = {
      chain,
      traceCompleteness: depthLimitReached ? 'partial' : 'full',
    };
    if (warnings.length > 0) {
      result.warnings = warnings;
    }
    return result;
  }

  /**
   * Sort evidence by timestamp (earliest first).
   *
   * @param evidence - Evidence items to sort
   * @returns Sorted evidence array
   */
  sortEvidenceByTime(evidence: EvidenceItem[]): EvidenceItem[] {
    return [...evidence].sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });
  }

  /**
   * Identify the trigger (earliest evidence or fallback).
   *
   * @param sortedEvidence - Evidence sorted by timestamp
   * @returns The trigger evidence item
   */
  identifyTrigger(sortedEvidence: EvidenceItem[]): EvidenceItem {
    if (sortedEvidence.length > 0) {
      return sortedEvidence[0]!;
    }

    // Fallback trigger when no evidence
    return {
      id: uuidv4(),
      type: 'TemporalMarker',
      source: 'unknown',
      content: 'Origin could not be determined',
    };
  }

  /**
   * Generate mechanism description from trigger and gap.
   *
   * @param trigger - The trigger evidence
   * @param gap - The configuration gap (if any)
   * @returns Mechanism description
   */
  generateMechanism(trigger: EvidenceItem, gap?: Gap): string {
    if (trigger.source === 'unknown') {
      return 'Unable to determine causal mechanism from available evidence.';
    }

    const triggerContent = trigger.content?.substring(0, 100) ?? 'unknown';

    if (gap) {
      return `Issue originated from session activity due to ${gap.type.replace(/_/g, ' ')}. First evidence: ${triggerContent}`;
    }

    return `Issue originated from session activity. First evidence: ${triggerContent}`;
  }

  /**
   * Compute confidence score based on evidence quality.
   *
   * @param evidence - Evidence items to assess
   * @returns Confidence score with all factors
   */
  computeConfidence(evidence: EvidenceItem[]): ConfidenceScore {
    const hasMultiple = evidence.length >= 2;
    const hasTimestamps = evidence.some((e) => e.timestamp);
    const hasPositions = evidence.some((e) => e.position);
    const hasContent = evidence.some(
      (e) => e.content && e.content.length > MIN_CONTENT_LENGTH
    );

    const factors = {
      specificity: hasPositions && hasContent,
      temporal: hasTimestamps && hasMultiple,
      mechanistic: evidence.length >= 1,
      evidenceQuality: hasContent,
      reproducibility: false, // Requires pattern matching
      alternatives: hasMultiple,
    };

    return {
      ...factors,
      overall: computeConfidenceLevel(factors),
    };
  }

  /**
   * Check if evidence supports high confidence.
   *
   * @param evidence - Evidence items to check
   * @returns True if evidence supports high confidence
   */
  hasHighQualityEvidence(evidence: EvidenceItem[]): boolean {
    const confidence = this.computeConfidence(evidence);
    return confidence.overall === 'high';
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new ChainBuilder instance.
 *
 * @returns ChainBuilder instance
 */
export function createChainBuilder(): ChainBuilder {
  return new ChainBuilder();
}

// =============================================================================
// Standalone Function (for backwards compatibility)
// =============================================================================

/**
 * Build a causal chain from evidence.
 *
 * Standalone function for use in trace-issue-tool.ts.
 * Delegates to ChainBuilder class.
 *
 * @param issueId - Issue identifier
 * @param issueDescription - Description of the issue
 * @param evidence - Collected evidence
 * @param projectPath - Project path
 * @param maxDepth - Maximum trace depth
 * @param gap - Configuration gap (optional)
 * @returns The constructed causal chain
 */
export function buildCausalChain(
  issueId: string,
  issueDescription: string,
  evidence: EvidenceItem[],
  projectPath: string,
  maxDepth: number,
  gap?: Gap
): CausalChain {
  const builder = new ChainBuilder();
  const options: ChainBuilderOptions = {
    issueId,
    issueDescription,
    evidence,
    projectPath,
    maxDepth,
  };
  if (gap) options.gap = gap;
  const result = builder.build(options);
  return result.chain;
}
