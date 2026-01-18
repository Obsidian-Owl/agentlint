/**
 * EP09 Temporal Analysis - query_baseline Tool
 *
 * SDK tool definition for retrieving baseline snapshots by ID or latest.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * @module temporal/tools/query-baseline
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { loadBaseline, getLatestBaseline } from '../../persistence/baselines/storage';
import type { Baseline } from '../../persistence/types';
import { TOOL_DESCRIPTIONS } from './descriptions';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Input schema for query_baseline tool.
 * Matches QueryBaselineInputSchema from contracts/temporal-tools.ts
 */
const queryBaselineInputSchema = {
  id: z.string().optional().describe('Baseline UUID, or omit for "latest"'),
  includeFindings: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include full findings array (increases response size)'),
};

// =============================================================================
// Types
// =============================================================================

/**
 * Result from query_baseline tool.
 */
interface QueryBaselineResult {
  found: boolean;
  baseline?: {
    id: string;
    createdAt: string;
    projectPath: string;
    actType: string;
    gitCommit?: string;
    label?: string;
    notes?: string;
    metrics: Record<string, number>;
    findingsCount: number;
    findings?: unknown[];
  };
  message?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract metrics as a flat record.
 */
function extractMetrics(baseline: Baseline): Record<string, number> {
  const metrics: Record<string, number> = {};

  // Copy all numeric properties from baseline.metrics
  for (const [key, value] of Object.entries(baseline.metrics)) {
    if (typeof value === 'number') {
      metrics[key] = value;
    }
  }

  return metrics;
}

/**
 * Build a QueryBaselineResult from a Baseline.
 */
function buildResult(baseline: Baseline, includeFindings: boolean): QueryBaselineResult {
  const result: QueryBaselineResult = {
    found: true,
    baseline: {
      id: baseline.id,
      createdAt: baseline.createdAt,
      projectPath: baseline.projectPath,
      actType: baseline.actType,
      metrics: extractMetrics(baseline),
      findingsCount: baseline.findings.length,
    },
  };

  // Add optional fields only if present
  if (baseline.gitCommit) {
    result.baseline!.gitCommit = baseline.gitCommit;
  }
  if (baseline.label) {
    result.baseline!.label = baseline.label;
  }
  if (baseline.notes) {
    result.baseline!.notes = baseline.notes;
  }
  if (includeFindings) {
    result.baseline!.findings = baseline.findings;
  }

  return result;
}

/**
 * Format the query result for human-readable output.
 */
function formatToolOutput(result: QueryBaselineResult): string {
  if (!result.found || !result.baseline) {
    return result.message ?? 'Baseline not found.';
  }

  const lines: string[] = [];
  const b = result.baseline;

  lines.push(`## Baseline: ${b.id}\n`);
  lines.push(`**Created**: ${b.createdAt}`);
  lines.push(`**Project**: ${b.projectPath}`);
  lines.push(`**ACT Type**: ${b.actType}`);

  if (b.gitCommit) {
    lines.push(`**Git Commit**: ${b.gitCommit}`);
  }
  if (b.label) {
    lines.push(`**Label**: ${b.label}`);
  }
  if (b.notes) {
    lines.push(`**Notes**: ${b.notes}`);
  }

  lines.push(`\n### Metrics`);
  lines.push(`- **Findings Count**: ${b.findingsCount}`);

  // Show key metrics
  const keyMetrics = ['criticalCount', 'highCount', 'mediumCount', 'lowCount', 'warningCount'];
  for (const key of keyMetrics) {
    if (b.metrics[key] !== undefined) {
      const label = formatMetricLabel(key);
      lines.push(`- **${label}**: ${b.metrics[key]}`);
    }
  }

  // Show extended metrics if present
  const extendedMetrics = ['avgTokensPerSession', 'avgIterationsPerSession', 'coverageScore'];
  const hasExtended = extendedMetrics.some((m) => b.metrics[m] !== undefined);

  if (hasExtended) {
    lines.push(`\n### Extended Metrics`);
    for (const key of extendedMetrics) {
      if (b.metrics[key] !== undefined) {
        const label = formatMetricLabel(key);
        lines.push(`- **${label}**: ${b.metrics[key]}`);
      }
    }
  }

  if (b.findings && b.findings.length > 0) {
    lines.push(`\n### Findings (${b.findings.length} total)`);
    // Show first few findings
    const preview = b.findings.slice(0, 5);
    for (const finding of preview) {
      const f = finding as { id?: string; severity?: string; message?: string };
      const severity = f.severity ?? 'info';
      const message = f.message ?? 'No message';
      lines.push(`- [${severity.toUpperCase()}] ${message}`);
    }
    if (b.findings.length > 5) {
      lines.push(`\n... and ${b.findings.length - 5} more findings.`);
    }
  }

  return lines.join('\n');
}

/**
 * Format metric name for display.
 */
function formatMetricLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * query_baseline tool definition.
 *
 * Retrieves a baseline snapshot by ID or gets the latest baseline.
 *
 * @example
 * ```typescript
 * import { queryBaselineTool } from './temporal/tools/query-baseline';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(queryBaselineTool);
 * ```
 */
export const queryBaselineTool = tool(
  'query_baseline',
  TOOL_DESCRIPTIONS.query_baseline,
  queryBaselineInputSchema,
  async (args) => {
    try {
      let baseline: Baseline | null = null;

      if (args.id) {
        // Load specific baseline by ID
        baseline = await loadBaseline(args.id);

        if (!baseline) {
          const result: QueryBaselineResult = {
            found: false,
            message: `No baseline found with ID: ${args.id}`,
          };

          return {
            content: [
              {
                type: 'text' as const,
                text: formatToolOutput(result),
              },
            ],
            _rawData: result,
          };
        }
      } else {
        // Get latest baseline
        baseline = await getLatestBaseline();

        if (!baseline) {
          const result: QueryBaselineResult = {
            found: false,
            message:
              'No baselines found. Use store_baseline to capture your first baseline snapshot.',
          };

          return {
            content: [
              {
                type: 'text' as const,
                text: formatToolOutput(result),
              },
            ],
            _rawData: result,
          };
        }
      }

      const includeFindings = args.includeFindings ?? false;
      const result = buildResult(baseline, includeFindings);

      return {
        content: [
          {
            type: 'text' as const,
            text: formatToolOutput(result),
          },
        ],
        _rawData: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error querying baseline: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);
