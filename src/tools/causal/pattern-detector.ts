/**
 * EP07 Causal Tracing Engine - Pattern Detector
 *
 * Detects recurring issue patterns across causal chains.
 * Groups chains by gap category and identifies systemic issues.
 *
 * @module src/tools/causal/pattern-detector
 */

import { v4 as uuidv4 } from 'uuid';

import type { CausalChain, GapType, IssuePattern } from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for pattern detection.
 */
export interface PatternDetectorOptions {
  /** Minimum frequency to report as pattern */
  minFrequency?: number;
  /** Filter by gap category */
  category?: GapType;
  /** Only return systemic patterns (frequency >= 3) */
  systemicOnly?: boolean;
}

/**
 * Result of pattern detection.
 */
export interface PatternDetectionResult {
  /** Detected patterns */
  patterns: IssuePattern[];
  /** Total chains analyzed */
  chainsAnalyzed: number;
  /** Chains grouped by category */
  groupedCounts: Map<GapType, number>;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Threshold for systemic classification.
 */
export const SYSTEMIC_THRESHOLD = 3;

// =============================================================================
// Pattern Detector Class
// =============================================================================

/**
 * Detects recurring issue patterns across causal chains.
 *
 * The PatternDetector:
 * - Groups chains by gap category (missing_guidance, missing_config, etc.)
 * - Identifies patterns with frequency >= minFrequency
 * - Marks patterns as systemic when frequency >= 3
 * - Tracks first and last occurrence timestamps
 *
 * @example
 * ```typescript
 * const detector = new PatternDetector();
 * const result = detector.detectPatterns(chains, { minFrequency: 2 });
 *
 * for (const pattern of result.patterns) {
 *   console.log(`${pattern.category}: ${pattern.frequency} occurrences`);
 *   if (pattern.isSystemic) {
 *     console.log('  ⚠️ Systemic issue detected');
 *   }
 * }
 * ```
 */
export class PatternDetector {
  /**
   * Detect patterns in a collection of causal chains.
   *
   * @param chains - Chains to analyze
   * @param options - Detection options
   * @returns Detection result with patterns and statistics
   */
  detectPatterns(
    chains: CausalChain[],
    options: PatternDetectorOptions = {}
  ): PatternDetectionResult {
    const { minFrequency = 1, category, systemicOnly = false } = options;

    // Filter chains with gaps
    const chainsWithGaps = chains.filter((c) => c.gap !== undefined);

    // Group chains by gap category
    const grouped = this.groupByCategory(chainsWithGaps);

    // Build patterns from groups
    const patterns: IssuePattern[] = [];

    for (const [gapType, groupChains] of grouped) {
      // Apply category filter
      if (category && gapType !== category) {
        continue;
      }

      // Apply frequency filter
      if (groupChains.length < minFrequency) {
        continue;
      }

      const pattern = this.buildPattern(gapType, groupChains);

      // Apply systemic filter
      if (systemicOnly && !pattern.isSystemic) {
        continue;
      }

      patterns.push(pattern);
    }

    // Sort by frequency descending
    patterns.sort((a, b) => b.frequency - a.frequency);

    // Build grouped counts
    const groupedCounts = new Map<GapType, number>();
    for (const [gapType, groupChains] of grouped) {
      groupedCounts.set(gapType, groupChains.length);
    }

    return {
      patterns,
      chainsAnalyzed: chains.length,
      groupedCounts,
    };
  }

  /**
   * Add a chain to an existing pattern or create a new one.
   *
   * @param chain - Chain to add
   * @param existingPatterns - Existing patterns to check
   * @param projectPath - Project path for the pattern
   * @returns Updated or new pattern
   */
  addChainToPattern(
    chain: CausalChain,
    existingPatterns: IssuePattern[],
    projectPath: string
  ): IssuePattern {
    if (!chain.gap) {
      throw new Error('Cannot add chain without gap to pattern');
    }

    const category = chain.gap.type;

    // Find existing pattern with same category
    const existing = existingPatterns.find(
      (p) => p.category === category && p.projectPath === projectPath
    );

    if (existing) {
      return this.updatePattern(existing, chain);
    }

    // Create new pattern
    return this.createPattern(chain, projectPath);
  }

  /**
   * Check if a chain matches an existing pattern.
   *
   * @param chain - Chain to check
   * @param pattern - Pattern to match against
   * @returns True if chain matches pattern category
   */
  matchesPattern(chain: CausalChain, pattern: IssuePattern): boolean {
    if (!chain.gap) {
      return false;
    }
    return chain.gap.type === pattern.category;
  }

  /**
   * Classify whether a pattern is systemic.
   *
   * @param frequency - Number of occurrences
   * @returns True if systemic (frequency >= 3)
   */
  isSystemic(frequency: number): boolean {
    return frequency >= SYSTEMIC_THRESHOLD;
  }

  /**
   * Generate a pattern summary.
   *
   * @param category - Gap category
   * @param chainCount - Number of chains
   * @param sampleGuidance - Sample expected guidance text
   * @returns Human-readable summary
   */
  generateSummary(
    category: GapType,
    chainCount: number,
    sampleGuidance?: string
  ): string {
    const categoryName = category.replace(/_/g, ' ');
    let summary = `Recurring ${categoryName} (${chainCount} occurrences)`;

    if (sampleGuidance) {
      summary += `: ${sampleGuidance.substring(0, 100)}`;
      if (sampleGuidance.length > 100) {
        summary += '...';
      }
    }

    return summary;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Group chains by gap category.
   */
  private groupByCategory(chains: CausalChain[]): Map<GapType, CausalChain[]> {
    const groups = new Map<GapType, CausalChain[]>();

    for (const chain of chains) {
      if (!chain.gap) continue;

      const category = chain.gap.type;
      const existing = groups.get(category) ?? [];
      existing.push(chain);
      groups.set(category, existing);
    }

    return groups;
  }

  /**
   * Build a pattern from a group of chains.
   */
  private buildPattern(
    category: GapType,
    chains: CausalChain[]
  ): IssuePattern {
    const chainIds = chains.map((c) => c.id);
    const timestamps = chains
      .map((c) => c.createdAt)
      .sort();
    const firstOccurrence = timestamps[0] ?? new Date().toISOString();
    const lastOccurrence = timestamps[timestamps.length - 1] ?? firstOccurrence;

    // Get sample guidance from first chain with gap
    const sampleGuidance = chains.find((c) => c.gap)?.gap?.expectedGuidance;

    // Get project path from first chain
    const projectPath = chains[0]?.projectPath;

    return {
      id: uuidv4(),
      category,
      chainIds,
      frequency: chainIds.length,
      isSystemic: this.isSystemic(chainIds.length),
      firstOccurrence,
      lastOccurrence,
      projectPath,
      summary: this.generateSummary(category, chainIds.length, sampleGuidance),
    };
  }

  /**
   * Create a new pattern from a single chain.
   */
  private createPattern(chain: CausalChain, projectPath: string): IssuePattern {
    const category = chain.gap!.type;
    const now = chain.createdAt;

    return {
      id: uuidv4(),
      category,
      chainIds: [chain.id],
      frequency: 1,
      isSystemic: false,
      firstOccurrence: now,
      lastOccurrence: now,
      projectPath,
      summary: this.generateSummary(category, 1, chain.gap!.expectedGuidance),
    };
  }

  /**
   * Update an existing pattern with a new chain.
   */
  private updatePattern(
    pattern: IssuePattern,
    chain: CausalChain
  ): IssuePattern {
    const chainIds = [...pattern.chainIds, chain.id];
    const frequency = chainIds.length;

    // Update lastOccurrence if chain is newer
    let lastOccurrence = pattern.lastOccurrence;
    if (chain.createdAt > pattern.lastOccurrence) {
      lastOccurrence = chain.createdAt;
    }

    // Update firstOccurrence if chain is older
    let firstOccurrence = pattern.firstOccurrence;
    if (chain.createdAt < pattern.firstOccurrence) {
      firstOccurrence = chain.createdAt;
    }

    return {
      ...pattern,
      chainIds,
      frequency,
      isSystemic: this.isSystemic(frequency),
      firstOccurrence,
      lastOccurrence,
      summary: this.generateSummary(
        pattern.category,
        frequency,
        chain.gap?.expectedGuidance
      ),
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new PatternDetector instance.
 *
 * @returns PatternDetector instance
 */
export function createPatternDetector(): PatternDetector {
  return new PatternDetector();
}
