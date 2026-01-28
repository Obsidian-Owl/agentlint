/**
 * EP09 Temporal Analysis - calculate_delta Tool
 *
 * SDK tool definition for calculating the difference between two baselines.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * @module temporal/tools/calculate-delta
 */

import { z } from 'zod';

import { adaptTool } from '../../opencode/tool-adapter';

import { loadBaseline, getLatestBaseline } from '../../persistence/baselines/storage';
import type { Baseline } from '../../persistence/types';
import type { BaselineDelta, DeltaSummary } from '../types';
import { calculateDelta } from '../delta/calculator';
import { createDeltaSummary, formatDeltaSummary } from '../delta/summarizer';
import { getCommitsBetweenDates, getCommitsBetweenHashes } from '../utils/git';
import { TOOL_DESCRIPTIONS } from './descriptions';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Input schema for calculate_delta tool.
 * Matches CalculateDeltaInputSchema from contracts/temporal-tools.ts
 */
const calculateDeltaInputSchema = {
  fromId: z.string().describe('UUID of the older baseline'),
  toId: z.string().describe('UUID of the newer baseline (or "latest")'),
  includeGitCommits: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include git commits between baselines'),
  detailedDiff: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include full jsondiffpatch delta (verbose)'),
};

// =============================================================================
// Types
// =============================================================================

/**
 * Result from calculate_delta tool.
 */
interface CalculateDeltaResult {
  success: boolean;
  delta?: BaselineDelta;
  error?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Load a baseline by ID or get latest if "latest" is specified.
 */
async function loadBaselineOrLatest(idOrLatest: string): Promise<Baseline | null> {
  if (idOrLatest.toLowerCase() === 'latest') {
    return getLatestBaseline();
  }
  return loadBaseline(idOrLatest);
}

/**
 * Format the delta result for human-readable output.
 */
function formatToolOutput(result: CalculateDeltaResult): string {
  if (!result.success || !result.delta) {
    return `Error: ${result.error ?? 'Failed to calculate delta'}`;
  }

  const lines: string[] = [];

  lines.push(`## Baseline Comparison\n`);
  lines.push(
    `**From**: ${result.delta.fromId.slice(0, 8)}... (${formatDate(result.delta.fromTimestamp)})`
  );
  lines.push(
    `**To**: ${result.delta.toId.slice(0, 8)}... (${formatDate(result.delta.toTimestamp)})\n`
  );

  // Add formatted summary
  lines.push(formatDeltaSummary(result.delta.summary));

  // Add git commits if present
  if (result.delta.gitCommitsInRange && result.delta.gitCommitsInRange.length > 0) {
    lines.push(`\n### Git Commits in Range\n`);
    for (const commit of result.delta.gitCommitsInRange.slice(0, 10)) {
      lines.push(`- ${commit}`);
    }
    if (result.delta.gitCommitsInRange.length > 10) {
      lines.push(`\n*... and ${result.delta.gitCommitsInRange.length - 10} more commits.*`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a date string for display.
 */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * calculate_delta tool definition.
 *
 * Calculates the difference between two baselines with trend indicators.
 *
 * @example
 * ```typescript
 * import { calculateDeltaTool } from './temporal/tools/calculate-delta';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(calculateDeltaTool);
 * ```
 */
export const calculateDeltaTool = adaptTool({
  name: 'calculate_delta',
  description: TOOL_DESCRIPTIONS.calculate_delta,
  schema: calculateDeltaInputSchema,
  handler: async (args: unknown) => {
    const typedArgs = args as {
      fromId: string;
      toId: string;
      includeGitCommits?: boolean;
      detailedDiff?: boolean;
    };
    try {
      // Load the source baseline
      const fromBaseline = await loadBaseline(typedArgs.fromId);
      if (!fromBaseline) {
        const result: CalculateDeltaResult = {
          success: false,
          error: `Source baseline not found: ${typedArgs.fromId}`,
        };
        return {
          content: [{ type: 'text' as const, text: formatToolOutput(result) }],
          _rawData: result,
          isError: true,
        };
      }

      // Load the target baseline
      const toBaseline = await loadBaselineOrLatest(typedArgs.toId);
      if (!toBaseline) {
        const result: CalculateDeltaResult = {
          success: false,
          error:
            typedArgs.toId.toLowerCase() === 'latest'
              ? 'No latest baseline found. Store a baseline first.'
              : `Target baseline not found: ${typedArgs.toId}`,
        };
        return {
          content: [{ type: 'text' as const, text: formatToolOutput(result) }],
          _rawData: result,
          isError: true,
        };
      }

      // Calculate the delta
      const { metricsDelta, delta } = calculateDelta(fromBaseline, toBaseline);

      // Create summary
      const summary: DeltaSummary = createDeltaSummary(metricsDelta, fromBaseline, toBaseline);

      // Build result
      const baselineDelta: BaselineDelta = {
        fromId: fromBaseline.id,
        toId: toBaseline.id,
        fromTimestamp: fromBaseline.createdAt,
        toTimestamp: toBaseline.createdAt,
        delta: typedArgs.detailedDiff ? delta : undefined,
        summary,
      };

      // Add git commits if requested
      const includeGitCommits = typedArgs.includeGitCommits ?? true;
      if (includeGitCommits) {
        let commits: string[] = [];

        // Prefer git hashes when both baselines have them (more accurate)
        if (fromBaseline.gitCommit && toBaseline.gitCommit) {
          commits = await getCommitsBetweenHashes(fromBaseline.gitCommit, toBaseline.gitCommit);
        } else {
          // Fall back to date-based query if hashes not available
          commits = await getCommitsBetweenDates(fromBaseline.createdAt, toBaseline.createdAt);
        }

        if (commits.length > 0) {
          baselineDelta.gitCommitsInRange = commits;
        }
      }

      const result: CalculateDeltaResult = {
        success: true,
        delta: baselineDelta,
      };

      return {
        content: [{ type: 'text' as const, text: formatToolOutput(result) }],
        _rawData: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result: CalculateDeltaResult = {
        success: false,
        error: errorMessage,
      };
      return {
        content: [{ type: 'text' as const, text: formatToolOutput(result) }],
        _rawData: result,
        isError: true,
      };
    }
  },
});
