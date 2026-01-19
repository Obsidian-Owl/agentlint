/**
 * EP09 Temporal Analysis - Recommendation Implementation Detector
 *
 * Extracts evidence of potential recommendation implementation by analyzing
 * configuration diffs and matching against known recommendation patterns.
 *
 * Per ADR-0019, this module returns raw evidence. The agent interprets
 * whether the evidence indicates implementation and what status to assign.
 *
 * @module temporal/tracking/detector
 */

import type { DetectionEvidence, MatchEvidence } from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * A recommendation to detect implementation of.
 */
export interface Recommendation {
  /** Unique identifier */
  id: string;
  /** Short summary of the recommendation */
  summary: string;
  /** Full description */
  description?: string;
  /** Keywords to look for in config changes */
  keywords: string[];
  /** Specific file patterns to watch */
  targetFiles?: string[];
  /** Regex patterns to match in diffs */
  patterns?: string[];
}

/**
 * Result of a diff between two config states.
 */
export interface ConfigDiff {
  /** Files that were added */
  filesAdded: string[];
  /** Files that were modified */
  filesModified: string[];
  /** Files that were deleted */
  filesDeleted: string[];
  /** Content changes (added lines) */
  linesAdded: string[];
  /** Content changes (removed lines) */
  linesRemoved: string[];
}

// =============================================================================
// Constants
// =============================================================================

/** Weight for keyword matches */
const KEYWORD_WEIGHT = 20;

/** Weight for file pattern matches */
const FILE_WEIGHT = 30;

/** Weight for regex pattern matches */
const PATTERN_WEIGHT = 40;

// Note: MIN_CONFIDENCE_THRESHOLD was removed per ADR-0019.
// The agent determines confidence significance, not tool code.

// =============================================================================
// Public API
// =============================================================================

/**
 * Extract evidence of a recommendation's potential implementation.
 *
 * Per ADR-0019, returns raw evidence for agent interpretation.
 * The agent determines:
 * - Whether evidence indicates implementation
 * - What status to assign (pending, implemented, partial)
 * - Whether to prompt for user confirmation
 *
 * @param recommendation - The recommendation to check
 * @param configDiff - The diff between config states
 * @returns Evidence with weights and matches
 *
 * @example
 * ```typescript
 * const recommendation = {
 *   id: 'rec-001',
 *   summary: 'Add credential guidance',
 *   keywords: ['credential', 'secret', 'API key'],
 *   targetFiles: ['CLAUDE.md'],
 * };
 *
 * const diff = {
 *   filesModified: ['CLAUDE.md'],
 *   linesAdded: ['Never include credentials in responses'],
 *   linesRemoved: [],
 *   filesAdded: [],
 *   filesDeleted: [],
 * };
 *
 * const evidence = extractMatchEvidence(recommendation, diff);
 * // Agent interprets: totalWeight=50, 1 keyword match, 1 file match
 * // Agent decides: "High confidence, recommend marking as implemented"
 * ```
 */
export function extractMatchEvidence(
  recommendation: Recommendation,
  configDiff: ConfigDiff
): MatchEvidence {
  const evidence: DetectionEvidence[] = [];
  const keywordMatches: string[] = [];
  const fileMatches: string[] = [];
  const patternMatches: string[] = [];
  let totalWeight = 0;

  // Check keyword matches in added lines
  for (const keyword of recommendation.keywords) {
    const keywordLower = keyword.toLowerCase();
    for (const line of configDiff.linesAdded) {
      if (line.toLowerCase().includes(keywordLower)) {
        evidence.push({
          type: 'keyword',
          match: keyword,
          location: truncateLine(line),
          weight: KEYWORD_WEIGHT,
        });
        keywordMatches.push(keyword);
        totalWeight += KEYWORD_WEIGHT;
        break; // Only count each keyword once
      }
    }
  }

  // Check target file modifications
  if (recommendation.targetFiles) {
    const modifiedFiles = [...configDiff.filesModified, ...configDiff.filesAdded];
    for (const targetFile of recommendation.targetFiles) {
      const targetLower = targetFile.toLowerCase();
      for (const modifiedFile of modifiedFiles) {
        if (modifiedFile.toLowerCase().includes(targetLower)) {
          evidence.push({
            type: 'file',
            match: targetFile,
            location: modifiedFile,
            weight: FILE_WEIGHT,
          });
          fileMatches.push(modifiedFile);
          totalWeight += FILE_WEIGHT;
          break; // Only count each target file once
        }
      }
    }
  }

  // Check regex patterns
  if (recommendation.patterns) {
    for (const patternStr of recommendation.patterns) {
      try {
        const pattern = new RegExp(patternStr, 'i');
        for (const line of configDiff.linesAdded) {
          if (pattern.test(line)) {
            evidence.push({
              type: 'pattern',
              match: patternStr,
              location: truncateLine(line),
              weight: PATTERN_WEIGHT,
            });
            patternMatches.push(patternStr);
            totalWeight += PATTERN_WEIGHT;
            break; // Only count each pattern once
          }
        }
      } catch {
        // Invalid regex, skip it
        continue;
      }
    }
  }

  return {
    evidence,
    totalWeight,
    keywordMatches,
    fileMatches,
    patternMatches,
  };
}

/**
 * Extract evidence for multiple recommendations.
 *
 * @param recommendations - List of recommendations to check
 * @param configDiff - The diff between config states
 * @returns Map of recommendation ID to match evidence
 */
export function extractAllMatchEvidence(
  recommendations: Recommendation[],
  configDiff: ConfigDiff
): Map<string, MatchEvidence> {
  const results = new Map<string, MatchEvidence>();

  for (const recommendation of recommendations) {
    const evidence = extractMatchEvidence(recommendation, configDiff);
    results.set(recommendation.id, evidence);
  }

  return results;
}

/**
 * Create a config diff from before/after content.
 *
 * @param beforeLines - Lines before the change
 * @param afterLines - Lines after the change
 * @param filePath - Path to the file
 * @returns A ConfigDiff object
 */
export function createConfigDiff(
  beforeLines: string[],
  afterLines: string[],
  filePath: string
): ConfigDiff {
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);

  const linesAdded = afterLines.filter((line) => !beforeSet.has(line));
  const linesRemoved = beforeLines.filter((line) => !afterSet.has(line));

  // Determine if file was added, modified, or unchanged
  const filesAdded: string[] = [];
  const filesModified: string[] = [];
  const filesDeleted: string[] = [];

  if (beforeLines.length === 0 && afterLines.length > 0) {
    filesAdded.push(filePath);
  } else if (beforeLines.length > 0 && afterLines.length === 0) {
    filesDeleted.push(filePath);
  } else if (linesAdded.length > 0 || linesRemoved.length > 0) {
    filesModified.push(filePath);
  }

  return {
    filesAdded,
    filesModified,
    filesDeleted,
    linesAdded,
    linesRemoved,
  };
}

/**
 * Merge multiple config diffs into one.
 *
 * @param diffs - Array of config diffs to merge
 * @returns Merged config diff
 */
export function mergeConfigDiffs(diffs: ConfigDiff[]): ConfigDiff {
  const merged: ConfigDiff = {
    filesAdded: [],
    filesModified: [],
    filesDeleted: [],
    linesAdded: [],
    linesRemoved: [],
  };

  for (const diff of diffs) {
    merged.filesAdded.push(...diff.filesAdded);
    merged.filesModified.push(...diff.filesModified);
    merged.filesDeleted.push(...diff.filesDeleted);
    merged.linesAdded.push(...diff.linesAdded);
    merged.linesRemoved.push(...diff.linesRemoved);
  }

  // Deduplicate file lists
  merged.filesAdded = [...new Set(merged.filesAdded)];
  merged.filesModified = [...new Set(merged.filesModified)];
  merged.filesDeleted = [...new Set(merged.filesDeleted)];

  return merged;
}

// =============================================================================
// Internal Helpers
// =============================================================================

// Note: getSuggestedStatus() and generateExplanation() were removed per ADR-0019.
// Status determination and explanation generation are judgment calls
// that should be made by the agent, not tool code.
//
// The agent interprets evidence based on:
// - totalWeight: Higher = stronger signal
// - evidence types: keyword, file, pattern matches
// - Project context and user preferences
//
// See ADR-0019: Tool/Agent Boundary for Temporal Analysis

/**
 * Truncate a line for display in evidence.
 */
function truncateLine(line: string, maxLength = 80): string {
  const trimmed = line.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return trimmed.substring(0, maxLength - 3) + '...';
}
