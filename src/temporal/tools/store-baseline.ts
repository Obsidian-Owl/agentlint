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

import { saveBaseline, getLatestBaseline } from '../../persistence/baselines/storage';
import { initBaselineSchema, indexBaseline } from '../../persistence/baselines/indexer';
import type { Baseline, BaselineMetrics } from '../../persistence/types';
import { getCurrentCommit } from '../utils/git';
import { TOOL_DESCRIPTIONS } from './descriptions';
import { checkAllTriggers, type TriggerCheckResult } from '../reminders';
import { calculateDelta } from '../delta/calculator';
import { createDeltaSummary } from '../delta/summarizer';
import { getLastReview } from '../../persistence/reviews';

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
  includeSkillsMetrics: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include skills effectiveness metrics from EP14 analysis'),
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
    // EP14 Skills metrics
    skillInvocationCount?: number;
    uniqueSkillsUsed?: number;
    sessionsWithSkillUsage?: number;
    skillsDefinedCount?: number;
  };
  message: string;
  /** Trigger check result for potential review prompt (informational) */
  triggerCheck?: TriggerCheckResult;
}

// =============================================================================
// Helper Functions
// =============================================================================

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
 * Gather skills effectiveness metrics from EP14.
 *
 * @param projectPath - Path to the project root
 * @returns Partial metrics with skills-related fields
 */
async function gatherSkillsMetrics(
  projectPath: string
): Promise<
  Pick<
    BaselineMetrics,
    'skillInvocationCount' | 'uniqueSkillsUsed' | 'sessionsWithSkillUsage' | 'skillsDefinedCount'
  >
> {
  try {
    // Import skills modules dynamically to avoid circular dependencies
    const { getSkillInventory } = await import('../../skills/discovery');
    const { countSkillInvocations, countUniqueSkills, countUniqueSessions } =
      await import('../../skills/storage');
    const { Database } = await import('bun:sqlite');
    const { join } = await import('node:path');
    const { existsSync } = await import('node:fs');

    // Get count of defined skills from inventory
    const inventory = await getSkillInventory(projectPath);
    const skillsDefinedCount = inventory.skills.length;

    // Check if skills database exists
    const dbPath = join(projectPath, '.agentlint', 'sessions.db');
    if (!existsSync(dbPath)) {
      return {
        skillInvocationCount: 0,
        uniqueSkillsUsed: 0,
        sessionsWithSkillUsage: 0,
        skillsDefinedCount,
      };
    }

    // Query skills invocation metrics from database
    const db = new Database(dbPath, { readonly: true });
    try {
      const skillInvocationCount = countSkillInvocations(db, {});
      const uniqueSkillsUsed = countUniqueSkills(db, {});
      const sessionsWithSkillUsage = countUniqueSessions(db, {});

      return {
        skillInvocationCount,
        uniqueSkillsUsed,
        sessionsWithSkillUsage,
        skillsDefinedCount,
      };
    } finally {
      db.close();
    }
  } catch {
    // If skills gathering fails, return zeros
    return {
      skillInvocationCount: 0,
      uniqueSkillsUsed: 0,
      sessionsWithSkillUsage: 0,
      skillsDefinedCount: 0,
    };
  }
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

  // EP14 Skills metrics
  if (result.metrics.skillsDefinedCount !== undefined && result.metrics.skillsDefinedCount > 0) {
    lines.push(`\n### Skills Effectiveness`);
    lines.push(`- Skills Defined: ${result.metrics.skillsDefinedCount}`);
    lines.push(`- Skills Used: ${result.metrics.uniqueSkillsUsed ?? 0}`);
    lines.push(`- Total Invocations: ${result.metrics.skillInvocationCount ?? 0}`);
    lines.push(`- Sessions with Skills: ${result.metrics.sessionsWithSkillUsage ?? 0}`);
  }

  // Include trigger check information if present
  if (result.triggerCheck) {
    lines.push(`\n### Review Triggers`);
    if (result.triggerCheck.shouldTrigger) {
      lines.push(`**${result.triggerCheck.summary}**`);
      for (const reason of result.triggerCheck.reasons) {
        lines.push(`- [${reason.severity.toUpperCase()}] ${reason.description}`);
      }
    } else {
      lines.push(result.triggerCheck.summary);
    }
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
      const gitCommit = await getCurrentCommit();

      // Create metrics (in full implementation, would gather from analysis)
      const metrics = createDefaultMetrics();

      // Gather skills metrics if enabled (EP14)
      if (args.includeSkillsMetrics !== false) {
        const skillsMetrics = await gatherSkillsMetrics(process.cwd());
        if (skillsMetrics.skillInvocationCount !== undefined) {
          metrics.skillInvocationCount = skillsMetrics.skillInvocationCount;
        }
        if (skillsMetrics.uniqueSkillsUsed !== undefined) {
          metrics.uniqueSkillsUsed = skillsMetrics.uniqueSkillsUsed;
        }
        if (skillsMetrics.sessionsWithSkillUsage !== undefined) {
          metrics.sessionsWithSkillUsage = skillsMetrics.sessionsWithSkillUsage;
        }
        if (skillsMetrics.skillsDefinedCount !== undefined) {
          metrics.skillsDefinedCount = skillsMetrics.skillsDefinedCount;
        }
      }

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

      // Include EP14 skills metrics if available
      if (metrics.skillInvocationCount !== undefined) {
        resultMetrics.skillInvocationCount = metrics.skillInvocationCount;
      }
      if (metrics.uniqueSkillsUsed !== undefined) {
        resultMetrics.uniqueSkillsUsed = metrics.uniqueSkillsUsed;
      }
      if (metrics.sessionsWithSkillUsage !== undefined) {
        resultMetrics.sessionsWithSkillUsage = metrics.sessionsWithSkillUsage;
      }
      if (metrics.skillsDefinedCount !== undefined) {
        resultMetrics.skillsDefinedCount = metrics.skillsDefinedCount;
      }

      // Check for review triggers (non-blocking, informational)
      let triggerCheck: TriggerCheckResult | undefined;
      try {
        // Get previous baseline for delta comparison
        const previousBaseline = await getLatestBaseline();

        // Get last review for time trigger
        const lastReview = await getLastReview(process.cwd());

        // Calculate delta if we have a previous baseline
        const triggerParams: Parameters<typeof checkAllTriggers>[0] = {};

        if (lastReview !== null) {
          triggerParams.lastReview = lastReview;
        }

        if (previousBaseline && previousBaseline.id !== baseline.id) {
          const { metricsDelta } = calculateDelta(previousBaseline, baseline);
          const deltaSummary = createDeltaSummary(metricsDelta, previousBaseline, baseline);
          triggerParams.deltaSummary = deltaSummary;
        }

        // Check all triggers
        triggerCheck = checkAllTriggers(triggerParams);
      } catch {
        // Non-blocking: if trigger check fails, continue without it
        triggerCheck = undefined;
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

      // Include trigger check if available
      if (triggerCheck !== undefined) {
        result.triggerCheck = triggerCheck;
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
