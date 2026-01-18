/**
 * EP09 Temporal Analysis - store_baseline Tool
 *
 * SDK tool definition for capturing baseline snapshots with extended metrics.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * @module temporal/tools/store-baseline
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { saveBaseline } from '../../persistence/baselines/storage';
import { initBaselineSchema, indexBaseline } from '../../persistence/baselines/indexer';
import type { Baseline, BaselineMetrics } from '../../persistence/types';
import { TOOL_DESCRIPTIONS } from './descriptions';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Input schema for store_baseline tool.
 * Matches StoreBaselineInputSchema from contracts/temporal-tools.ts
 */
const storeBaselineInputSchema = {
  label: z
    .string()
    .optional()
    .describe('Optional label for this baseline (e.g., "Post-CLAUDE.md rewrite")'),
  notes: z.string().optional().describe('Optional notes about this baseline'),
  includeSessionMetrics: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include session metrics from EP06 analysis'),
};

// =============================================================================
// Types
// =============================================================================

/**
 * Result from store_baseline tool.
 */
interface StoreBaselineResult {
  success: boolean;
  baselineId: string;
  createdAt: string;
  label?: string;
  metrics: {
    findingsCount: number;
    warningCount: number;
    avgTokensPerSession?: number;
  };
  message: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get current git commit hash.
 * Returns null if not in a git repository or git is unavailable.
 */
async function getCurrentGitCommit(): Promise<string | null> {
  try {
    const proc = Bun.spawn(['git', 'rev-parse', 'HEAD'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode === 0) {
      return output.trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Create default metrics for a new baseline.
 * In a real implementation, this would gather metrics from EP05/EP06 analysis.
 */
function createDefaultMetrics(): BaselineMetrics {
  // For now, return zeroed metrics - actual metrics would come from analysis
  return {
    findingsCount: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    infoCount: 0,
    // EP09 extended metrics (optional)
    warningCount: 0,
  };
}

/**
 * Format the store result for human-readable output.
 */
function formatToolOutput(result: StoreBaselineResult): string {
  const lines: string[] = [];

  lines.push(`## Baseline Stored\n`);
  lines.push(`**ID**: ${result.baselineId}`);
  lines.push(`**Created**: ${result.createdAt}`);

  if (result.label) {
    lines.push(`**Label**: ${result.label}`);
  }

  lines.push(`\n### Metrics`);
  lines.push(`- Findings: ${result.metrics.findingsCount}`);
  lines.push(`- Warnings: ${result.metrics.warningCount}`);

  if (result.metrics.avgTokensPerSession !== undefined) {
    lines.push(`- Avg Tokens/Session: ${result.metrics.avgTokensPerSession}`);
  }

  lines.push(`\n${result.message}`);

  return lines.join('\n');
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * store_baseline tool definition.
 *
 * Captures a point-in-time snapshot of the current project state including:
 * - Analysis findings and metrics
 * - Configuration analysis results
 * - Session statistics (if available)
 * - Git commit reference for correlation
 *
 * @example
 * ```typescript
 * import { storeBaselineTool } from './temporal/tools/store-baseline';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(storeBaselineTool);
 * ```
 */
export const storeBaselineTool = tool(
  'store_baseline',
  TOOL_DESCRIPTIONS.store_baseline,
  storeBaselineInputSchema,
  async (args) => {
    try {
      // Generate baseline ID and timestamp
      const baselineId = uuidv4();
      const createdAt = new Date().toISOString();

      // Get git commit for correlation
      const gitCommit = await getCurrentGitCommit();

      // Create metrics (in full implementation, would gather from analysis)
      const metrics = createDefaultMetrics();

      // Build baseline object
      const baseline: Baseline = {
        id: baselineId,
        version: '1.0.0',
        createdAt,
        projectPath: process.cwd(),
        actType: 'claude-code',
        configPath: null, // Would be populated from discovery
        gitCommit,
        metrics,
        findings: [], // Would be populated from analysis
        label: args.label ?? null,
        notes: args.notes ?? null,
      };

      // Save baseline to disk
      const filePath = await saveBaseline(baseline);

      // Index baseline in SQLite for fast queries
      const db = await initBaselineSchema();
      indexBaseline(db, baseline, filePath);
      db.close();

      // Build result metrics object with proper optional handling
      const resultMetrics: StoreBaselineResult['metrics'] = {
        findingsCount: metrics.findingsCount,
        warningCount: metrics.warningCount ?? 0,
      };

      // Only include avgTokensPerSession if it exists
      if (metrics.avgTokensPerSession !== undefined) {
        resultMetrics.avgTokensPerSession = metrics.avgTokensPerSession;
      }

      // Build result with proper optional handling for exactOptionalPropertyTypes
      const result: StoreBaselineResult = {
        success: true,
        baselineId,
        createdAt,
        metrics: resultMetrics,
        message: 'Baseline snapshot captured successfully. Use this ID for future comparisons.',
      };

      // Only include label if provided
      if (args.label !== undefined) {
        result.label = args.label;
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: formatToolOutput(result),
          },
        ],
        // Include raw data for programmatic access
        _rawData: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error storing baseline: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);
