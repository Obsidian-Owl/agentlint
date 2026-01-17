/**
 * T042-T045: Configuration metrics extraction
 *
 * Extracts quantitative metrics from parsed configurations including:
 * - Token estimation (char/4 ratio) - T043
 * - Section count, heading depth, code block metrics - T044
 * - Emphasis marker counting (MUST, IMPORTANT, CRITICAL, etc.) - T045
 *
 * @module tools/config/metrics
 */

import type { Root, RootContent } from 'mdast';
import type {
  ConfigMetrics,
  Section,
  CodeBlock,
  EmphasisCounts,
} from './types';

// =============================================================================
// Main Metrics Function (T042)
// =============================================================================

/**
 * Extract metrics from parsed configuration content.
 *
 * @param content - Raw content string
 * @param ast - Parsed AST (for markdown files)
 * @param headings - Extracted headings from parser
 * @param sections - Extracted sections
 * @param codeBlocks - Extracted code blocks
 * @returns ConfigMetrics object with all metrics
 */
export function extractMetrics(
  content: string,
  ast: Root,
  headings: Array<{ level: number }>,
  sections: Section[],
  codeBlocks: CodeBlock[]
): ConfigMetrics {
  const lines = content.split('\n');
  const words = content.split(/\s+/).filter((w) => w.length > 0);

  // T043: Token estimation using char/4 ratio
  const tokenEstimate = estimateTokens(content);

  // T045: Count emphasis markers
  const emphasisCounts = countEmphasisMarkers(content);

  // Count links in AST
  const linkCount = countLinks(ast);

  // T044: Get unique code block languages
  const languages = new Set<string>();
  for (const block of codeBlocks) {
    if (block.language) {
      languages.add(block.language);
    }
  }

  // T044: Calculate max heading depth
  let maxHeadingDepth = 0;
  for (const heading of headings) {
    if (heading.level > maxHeadingDepth) {
      maxHeadingDepth = heading.level;
    }
  }

  // T044: Count sections
  const sectionCount = countTopLevelSections(sections);

  return {
    lineCount: lines.length,
    tokenEstimate,
    sectionCount,
    maxHeadingDepth,
    codeBlockCount: codeBlocks.length,
    codeBlockLanguages: Array.from(languages),
    emphasisMarkerCount: emphasisCounts,
    linkCount,
    wordCount: words.length,
  };
}

// =============================================================================
// Token Estimation (T043)
// =============================================================================

/**
 * Estimate token count using character/4 ratio.
 *
 * This is a rough approximation based on the observation that
 * 1 token ≈ 4 characters for English text. Actual tokenization
 * varies by model and content type.
 *
 * @param content - Raw content string
 * @returns Estimated token count
 */
export function estimateTokens(content: string): number {
  // Simple char/4 ratio as per spec
  return Math.ceil(content.length / 4);
}

/**
 * Estimate tokens for a specific section of content.
 *
 * @param content - Content string
 * @param startLine - Start line (1-indexed)
 * @param endLine - End line (1-indexed)
 * @returns Estimated token count for the section
 */
export function estimateTokensForSection(
  content: string,
  startLine: number,
  endLine: number
): number {
  const lines = content.split('\n');
  const sectionLines = lines.slice(startLine - 1, endLine);
  const sectionContent = sectionLines.join('\n');
  return estimateTokens(sectionContent);
}

// =============================================================================
// Section and Depth Metrics (T044)
// =============================================================================

/**
 * Count top-level sections (level 1 and 2 headings at root).
 *
 * @param sections - Hierarchical section array
 * @returns Number of top-level sections
 */
export function countTopLevelSections(sections: Section[]): number {
  return sections.length;
}

/**
 * Count total sections including nested ones.
 *
 * @param sections - Hierarchical section array
 * @returns Total section count including all nested sections
 */
export function countTotalSections(sections: Section[]): number {
  let count = 0;

  function countRecursive(sectionList: Section[]): void {
    for (const section of sectionList) {
      count++;
      countRecursive(section.children);
    }
  }

  countRecursive(sections);
  return count;
}

/**
 * Calculate the maximum heading depth in sections.
 *
 * @param sections - Hierarchical section array
 * @returns Maximum heading depth (1-6)
 */
export function calculateMaxHeadingDepth(sections: Section[]): number {
  let maxDepth = 0;

  function findMaxDepth(sectionList: Section[]): void {
    for (const section of sectionList) {
      if (section.level > maxDepth) {
        maxDepth = section.level;
      }
      findMaxDepth(section.children);
    }
  }

  findMaxDepth(sections);
  return maxDepth;
}

/**
 * Get code block language distribution.
 *
 * @param codeBlocks - Array of code blocks
 * @returns Map of language to count
 */
export function getCodeBlockLanguageDistribution(
  codeBlocks: CodeBlock[]
): Map<string, number> {
  const distribution = new Map<string, number>();

  for (const block of codeBlocks) {
    const lang = block.language || 'plaintext';
    distribution.set(lang, (distribution.get(lang) || 0) + 1);
  }

  return distribution;
}

/**
 * Get unique code block languages.
 *
 * @param codeBlocks - Array of code blocks
 * @returns Array of unique language identifiers
 */
export function getUniqueLanguages(codeBlocks: CodeBlock[]): string[] {
  const languages = new Set<string>();
  for (const block of codeBlocks) {
    if (block.language) {
      languages.add(block.language);
    }
  }
  return Array.from(languages);
}

// =============================================================================
// Emphasis Marker Counting (T045)
// =============================================================================

/**
 * Count emphasis markers (MUST, IMPORTANT, CRITICAL, NEVER, ALWAYS).
 *
 * Uses word boundaries to avoid matching partial words like "CUSTOMER".
 *
 * @param content - Raw content string
 * @returns EmphasisCounts object with individual and total counts
 */
export function countEmphasisMarkers(content: string): EmphasisCounts {
  // Use word boundaries to avoid matching partial words
  const mustCount = (content.match(/\bMUST\b/g) || []).length;
  const importantCount = (content.match(/\bIMPORTANT\b/g) || []).length;
  const criticalCount = (content.match(/\bCRITICAL\b/g) || []).length;
  const neverCount = (content.match(/\bNEVER\b/g) || []).length;
  const alwaysCount = (content.match(/\bALWAYS\b/g) || []).length;

  return {
    must: mustCount,
    important: importantCount,
    critical: criticalCount,
    never: neverCount,
    always: alwaysCount,
    total: mustCount + importantCount + criticalCount + neverCount + alwaysCount,
  };
}

/**
 * Check if content has any emphasis markers.
 *
 * @param content - Raw content string
 * @returns True if any emphasis markers are present
 */
export function hasEmphasisMarkers(content: string): boolean {
  return countEmphasisMarkers(content).total > 0;
}

/**
 * Get the most frequent emphasis marker type.
 *
 * @param counts - EmphasisCounts object
 * @returns The marker type with highest count, or undefined if none
 */
export function getMostFrequentMarker(
  counts: EmphasisCounts
): keyof Omit<EmphasisCounts, 'total'> | undefined {
  const entries: Array<[keyof Omit<EmphasisCounts, 'total'>, number]> = [
    ['must', counts.must],
    ['important', counts.important],
    ['critical', counts.critical],
    ['never', counts.never],
    ['always', counts.always],
  ];

  let maxEntry: [keyof Omit<EmphasisCounts, 'total'>, number] | undefined;

  for (const entry of entries) {
    if (!maxEntry || entry[1] > maxEntry[1]) {
      maxEntry = entry;
    }
  }

  return maxEntry && maxEntry[1] > 0 ? maxEntry[0] : undefined;
}

// =============================================================================
// Link Counting
// =============================================================================

/**
 * Count links in AST.
 *
 * @param ast - Root AST node
 * @returns Number of links found
 */
export function countLinks(ast: Root): number {
  let count = 0;

  function visit(node: RootContent | Root): void {
    if (node.type === 'link') {
      count++;
    }

    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        visit(child as RootContent);
      }
    }
  }

  visit(ast);
  return count;
}

// =============================================================================
// JSON Metrics
// =============================================================================

/**
 * Create metrics for JSON configuration files.
 *
 * JSON files don't have markdown structure, so section/heading metrics are zero.
 *
 * @param content - JSON content string
 * @returns ConfigMetrics for JSON file
 */
export function createJsonMetrics(content: string): ConfigMetrics {
  const lines = content.split('\n');
  const words = content.split(/\s+/).filter((w) => w.length > 0);

  return {
    lineCount: lines.length,
    tokenEstimate: estimateTokens(content),
    sectionCount: 0,
    maxHeadingDepth: 0,
    codeBlockCount: 0,
    codeBlockLanguages: [],
    emphasisMarkerCount: {
      must: 0,
      important: 0,
      critical: 0,
      never: 0,
      always: 0,
      total: 0,
    },
    linkCount: 0,
    wordCount: words.length,
  };
}

// =============================================================================
// Empty Metrics
// =============================================================================

/**
 * Create empty metrics for error cases or empty files.
 *
 * @param content - Content string (may be empty)
 * @returns ConfigMetrics with appropriate values
 */
export function createEmptyMetrics(content: string): ConfigMetrics {
  return {
    lineCount: content.split('\n').length,
    tokenEstimate: estimateTokens(content),
    sectionCount: 0,
    maxHeadingDepth: 0,
    codeBlockCount: 0,
    codeBlockLanguages: [],
    emphasisMarkerCount: {
      must: 0,
      important: 0,
      critical: 0,
      never: 0,
      always: 0,
      total: 0,
    },
    linkCount: 0,
    wordCount: 0,
  };
}
