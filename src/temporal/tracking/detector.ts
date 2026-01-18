/**
 * EP09 Temporal Analysis - Recommendation Implementation Detector
 *
 * Detects potential implementation of recommendations by analyzing
 * configuration diffs and matching against known recommendation patterns.
 *
 * @module temporal/tracking/detector
 */

import type { RecommendationStatus } from '../types';

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

/**
 * Result of detecting a potential implementation.
 */
export interface DetectionResult {
  /** Was a potential implementation detected? */
  detected: boolean;
  /** Confidence level (0-100) */
  confidence: number;
  /** Status to assign if detected */
  suggestedStatus: RecommendationStatus;
  /** Evidence for the detection */
  evidence: DetectionEvidence[];
  /** Explanation of the detection */
  explanation: string;
}

/**
 * Evidence supporting a detection.
 */
export interface DetectionEvidence {
  /** Type of evidence */
  type: 'keyword' | 'file' | 'pattern';
  /** What was matched */
  match: string;
  /** Where it was found */
  location: string;
  /** How strong is this evidence (0-100) */
  weight: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Minimum confidence for a detection to be considered valid */
const MIN_CONFIDENCE_THRESHOLD = 30;

/** Weight for keyword matches */
const KEYWORD_WEIGHT = 20;

/** Weight for file pattern matches */
const FILE_WEIGHT = 30;

/** Weight for regex pattern matches */
const PATTERN_WEIGHT = 40;

/** Maximum confidence score */
const MAX_CONFIDENCE = 100;

// =============================================================================
// Public API
// =============================================================================

/**
 * Detect if a recommendation has been implemented based on config diff.
 *
 * Uses multiple signals to determine if a recommendation was likely implemented:
 * - Keyword matches in added lines
 * - Target file modifications
 * - Regex pattern matches
 *
 * @param recommendation - The recommendation to check
 * @param configDiff - The diff between config states
 * @returns Detection result with confidence and evidence
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
 * const result = detectImplementation(recommendation, diff);
 * if (result.detected) {
 *   console.log(`Detected with ${result.confidence}% confidence`);
 * }
 * ```
 */
export function detectImplementation(
  recommendation: Recommendation,
  configDiff: ConfigDiff
): DetectionResult {
  const evidence: DetectionEvidence[] = [];
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

  // Calculate confidence (capped at 100)
  const confidence = Math.min(totalWeight, MAX_CONFIDENCE);

  // Determine if detected
  const detected = confidence >= MIN_CONFIDENCE_THRESHOLD;

  // Determine suggested status
  const suggestedStatus = getSuggestedStatus(confidence);

  // Generate explanation
  const explanation = generateExplanation(recommendation, evidence, confidence);

  return {
    detected,
    confidence,
    suggestedStatus,
    evidence,
    explanation,
  };
}

/**
 * Check if any recommendations from a list were implemented.
 *
 * @param recommendations - List of recommendations to check
 * @param configDiff - The diff between config states
 * @returns Map of recommendation ID to detection result (only detected ones)
 */
export function detectImplementations(
  recommendations: Recommendation[],
  configDiff: ConfigDiff
): Map<string, DetectionResult> {
  const results = new Map<string, DetectionResult>();

  for (const recommendation of recommendations) {
    const result = detectImplementation(recommendation, configDiff);
    if (result.detected) {
      results.set(recommendation.id, result);
    }
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

/**
 * Get suggested status based on confidence level.
 */
function getSuggestedStatus(confidence: number): RecommendationStatus {
  if (confidence >= 80) {
    return 'detected_pending_confirm';
  } else if (confidence >= 50) {
    return 'partial';
  } else if (confidence >= MIN_CONFIDENCE_THRESHOLD) {
    return 'detected_pending_confirm';
  }
  return 'pending';
}

/**
 * Generate human-readable explanation of detection.
 */
function generateExplanation(
  recommendation: Recommendation,
  evidence: DetectionEvidence[],
  confidence: number
): string {
  if (evidence.length === 0) {
    return `No evidence found for implementation of "${recommendation.summary}"`;
  }

  const evidenceTypes = evidence.map((e) => e.type);
  const hasKeyword = evidenceTypes.includes('keyword');
  const hasFile = evidenceTypes.includes('file');
  const hasPattern = evidenceTypes.includes('pattern');

  const parts: string[] = [];

  if (hasKeyword) {
    const keywords = evidence.filter((e) => e.type === 'keyword').map((e) => e.match);
    parts.push(`found keywords: ${keywords.join(', ')}`);
  }

  if (hasFile) {
    const files = evidence.filter((e) => e.type === 'file').map((e) => e.location);
    parts.push(`modified files: ${files.join(', ')}`);
  }

  if (hasPattern) {
    parts.push(`matched ${evidence.filter((e) => e.type === 'pattern').length} pattern(s)`);
  }

  const confidenceLevel = confidence >= 80 ? 'high' : confidence >= 50 ? 'moderate' : 'low';

  return `Detected potential implementation of "${recommendation.summary}" with ${confidenceLevel} confidence (${confidence}%): ${parts.join('; ')}`;
}

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
