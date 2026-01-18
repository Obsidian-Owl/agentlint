/**
 * EP09 Temporal Analysis - query_trends Tool
 *
 * SDK tool definition for analyzing trends across multiple baselines.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * @module temporal/tools/query-trends
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { getBaselineHistory, type QueryOptions } from '../../persistence/baselines/queries';
import { loadBaseline } from '../../persistence/baselines/storage';
import type { Baseline, BaselineQueryOptions } from '../../persistence/types';
import type { TrendAnalysis, MetricTrend } from '../types';
import {
  buildTrendAnalysis,
  hasSufficientBaselines,
  getTrendSummary,
  type TrendAnalysisOptions,
} from '../trends/analysis';
import { TOOL_DESCRIPTIONS } from './descriptions';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Input schema for query_trends tool.
 * Matches QueryTrendsInputSchema from contracts/temporal-tools.ts
 */
const queryTrendsInputSchema = {
  metrics: z.array(z.string()).optional().describe('Specific metrics to analyze (default: all)'),
  afterDate: z.string().optional().describe('Analyze baselines after this ISO-8601 date'),
  beforeDate: z.string().optional().describe('Analyze baselines before this ISO-8601 date'),
  minBaselines: z
    .number()
    .optional()
    .default(3)
    .describe('Minimum baselines required for trend analysis'),
  includeQualitative: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include qualitative review trends'),
  includeCorrelations: z
    .boolean()
    .optional()
    .default(true)
    .describe('Correlate trends with git commits'),
};

// =============================================================================
// Types
// =============================================================================

/**
 * Result from query_trends tool.
 *
 * Per ADR-0019, summary returns raw statistics. Agent interprets meaning.
 */
interface QueryTrendsResult {
  success: boolean;
  analysis?: TrendAnalysis;
  summary?: {
    /** Number of metrics with positive slope (values increasing) */
    slopePositiveCount: number;
    /** Number of metrics with negative slope (values decreasing) */
    slopeNegativeCount: number;
    /** Number of metrics with near-zero slope (stable) */
    slopeNearZeroCount: number;
    /** Number of metrics with high volatility */
    highVolatilityCount: number;
    /** Average R² across all trends (higher = more reliable) */
    averageRSquared: number;
  };
  error?: string;
  insufficientData?: {
    baselines: number;
    required: number;
    message: string;
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Load full baselines from summaries.
 * We need full baselines for trend analysis to access all metrics.
 */
async function loadFullBaselines(
  summaries: Array<{ id: string }>,
  queryOptions: QueryOptions = {}
): Promise<Baseline[]> {
  const baselines: Baseline[] = [];

  for (const summary of summaries) {
    const baseline = await loadBaseline(summary.id, queryOptions);
    if (baseline) {
      baselines.push(baseline);
    }
  }

  // Sort by createdAt (oldest first for trend analysis)
  baselines.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return baselines;
}

/**
 * Format the query result for human-readable output.
 */
function formatToolOutput(result: QueryTrendsResult): string {
  if (!result.success) {
    if (result.insufficientData) {
      return [
        '## Insufficient Data for Trend Analysis\n',
        `**Baselines Found**: ${result.insufficientData.baselines}`,
        `**Minimum Required**: ${result.insufficientData.required}`,
        '',
        result.insufficientData.message,
        '',
        '**Tip**: Use `store_baseline` to capture more snapshots over time.',
      ].join('\n');
    }
    return `Error: ${result.error ?? 'Unknown error'}`;
  }

  const analysis = result.analysis;
  if (!analysis) {
    return 'No analysis available.';
  }

  const lines: string[] = [];

  // Header
  lines.push('## Trend Analysis\n');
  lines.push(`**Project**: ${analysis.projectPath}`);
  lines.push(`**Date Range**: ${analysis.dateRange.start} to ${analysis.dateRange.end}`);
  lines.push(`**Baselines Analyzed**: ${analysis.baselineCount}`);

  // Summary
  if (result.summary) {
    // Per ADR-0019, present raw statistics. Agent interprets meaning.
    lines.push('\n### Summary');
    lines.push(`**Trends**: ${result.summary.slopePositiveCount} increasing, ${result.summary.slopeNegativeCount} decreasing, ${result.summary.slopeNearZeroCount} stable`);
    lines.push(`- High volatility: ${result.summary.highVolatilityCount}`);
    lines.push(`- Average R²: ${result.summary.averageRSquared.toFixed(2)}`);
  }

  // Metric Trends - group by slope direction
  if (analysis.metricTrends.length > 0) {
    const SLOPE_THRESHOLD = 0.01;
    const VOLATILITY_THRESHOLD = 0.5;

    lines.push('\n### Metric Trends');

    // Group by slope direction
    const increasing = analysis.metricTrends.filter((t) => t.slope > SLOPE_THRESHOLD);
    const decreasing = analysis.metricTrends.filter((t) => t.slope < -SLOPE_THRESHOLD);
    const stable = analysis.metricTrends.filter((t) => Math.abs(t.slope) <= SLOPE_THRESHOLD);
    const volatile = analysis.metricTrends.filter((t) => t.volatility > VOLATILITY_THRESHOLD);

    if (increasing.length > 0) {
      lines.push('\n**Increasing** ↑');
      for (const trend of increasing) {
        lines.push(formatMetricTrend(trend));
      }
    }

    if (decreasing.length > 0) {
      lines.push('\n**Decreasing** ↓');
      for (const trend of decreasing) {
        lines.push(formatMetricTrend(trend));
      }
    }

    if (stable.length > 0) {
      lines.push('\n**Stable** →');
      for (const trend of stable) {
        lines.push(formatMetricTrend(trend));
      }
    }

    if (volatile.length > 0) {
      lines.push('\n**High Volatility** ~');
      for (const trend of volatile) {
        lines.push(formatMetricTrend(trend));
      }
    }
  }

  // Inflection Points
  if (analysis.inflectionPoints && analysis.inflectionPoints.length > 0) {
    lines.push('\n### Inflection Points');
    lines.push('Points where trends changed direction:\n');

    for (const point of analysis.inflectionPoints) {
      lines.push(
        `- **${point.metric}** at ${point.timestamp}: ${point.beforeDirection} → ${point.afterDirection}`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Format a single metric trend.
 */
function formatMetricTrend(trend: MetricTrend): string {
  const name = formatMetricLabel(trend.metricName);
  const change =
    trend.percentChange >= 0
      ? `+${trend.percentChange.toFixed(1)}%`
      : `${trend.percentChange.toFixed(1)}%`;

  return `- ${name}: ${trend.firstValue.toFixed(1)} → ${trend.lastValue.toFixed(1)} (${change})`;
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
 * query_trends tool definition.
 *
 * Analyzes trends across multiple baselines over time.
 *
 * @example
 * ```typescript
 * import { queryTrendsTool } from './temporal/tools/query-trends';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(queryTrendsTool);
 * ```
 */
export const queryTrendsTool = tool(
  'query_trends',
  TOOL_DESCRIPTIONS.query_trends,
  queryTrendsInputSchema,
  async (args) => {
    try {
      const minBaselines = args.minBaselines ?? 3;

      // Build query options for date filtering
      const filter: BaselineQueryOptions = {};
      if (args.afterDate) {
        filter.after = args.afterDate;
      }
      if (args.beforeDate) {
        filter.before = args.beforeDate;
      }

      // Get baseline summaries
      const summaries = await getBaselineHistory({}, undefined, filter);

      // Check if we have enough baselines
      if (!hasSufficientBaselines(summaries as unknown as Baseline[], minBaselines)) {
        const result: QueryTrendsResult = {
          success: false,
          insufficientData: {
            baselines: summaries.length,
            required: minBaselines,
            message: `Need at least ${minBaselines} baselines for trend analysis, but only ${summaries.length} found.`,
          },
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

      // Load full baselines for analysis
      const baselines = await loadFullBaselines(summaries);

      // If we couldn't load enough full baselines
      if (!hasSufficientBaselines(baselines, minBaselines)) {
        const result: QueryTrendsResult = {
          success: false,
          insufficientData: {
            baselines: baselines.length,
            required: minBaselines,
            message: `Could only load ${baselines.length} complete baselines, need ${minBaselines}.`,
          },
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

      // Build analysis options
      const analysisOptions: TrendAnalysisOptions = {
        detectInflections: true,
      };

      // Add metric filters if specified
      if (args.metrics && args.metrics.length > 0) {
        analysisOptions.includeMetrics = args.metrics;
      }

      // Build the trend analysis
      const analysis = buildTrendAnalysis(baselines, analysisOptions);

      // Get summary
      const summary = getTrendSummary(analysis);

      const result: QueryTrendsResult = {
        success: true,
        analysis,
        summary,
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error analyzing trends: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);
