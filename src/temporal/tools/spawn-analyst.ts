/**
 * EP09 Temporal Analysis - spawn_temporal_analyst Tool
 *
 * SDK tool definition for spawning the temporal analyzer subagent.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * This tool enables the orchestrator to delegate temporal analysis
 * tasks to a specialized subagent with domain-specific context.
 *
 * @module temporal/tools/spawn-analyst
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import {
  buildTemporalAnalyzerAgent,
  buildTemporalAnalyzerReadonlyAgent,
} from '../subagent/temporal-subagent';
import type { TemporalAnalysisContext, AnalysisFocus } from '../subagent/types';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Focus areas for temporal analysis.
 * Each focus area guides the subagent's analysis priority.
 */
const AnalysisFocusSchema = z.enum(['trends', 'reviews', 'comparison', 'comprehensive']);

/**
 * Input schema for spawn_temporal_analyst tool.
 */
const spawnTemporalAnalystInputSchema = {
  focus: AnalysisFocusSchema.describe(`
Analysis focus area:
- trends: Analyze metric trends over time, identify inflection points
- reviews: Analyze qualitative review data and sentiment trends
- comparison: Compare specific baselines to identify changes
- comprehensive: Full analysis combining all dimensions
  `.trim()),

  query: z
    .string()
    .optional()
    .describe('Specific question or analysis request for the subagent'),

  baselineId: z
    .string()
    .optional()
    .describe('Target baseline ID for comparison-focused analysis'),

  compareToId: z
    .string()
    .optional()
    .describe('Baseline ID to compare against (for comparison focus)'),

  timeRange: z
    .object({
      startDate: z.string().optional().describe('Start date (ISO format)'),
      endDate: z.string().optional().describe('End date (ISO format)'),
      daysBack: z.number().optional().describe('Number of days back from today'),
    })
    .optional()
    .describe('Time range for trend analysis'),

  includeRecommendations: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include actionable recommendations in output'),

  readonly: z
    .boolean()
    .optional()
    .default(false)
    .describe('Use read-only mode (no baseline storage or review creation)'),
};

// =============================================================================
// Types
// =============================================================================

/**
 * Result from spawn_temporal_analyst tool.
 */
interface SpawnTemporalAnalystResult {
  success: boolean;
  focus: AnalysisFocus;
  agentType: 'temporal-analyzer' | 'temporal-analyzer-readonly';
  context: TemporalAnalysisContext;
  agentDefinition: {
    description: string;
    toolCount: number;
    tools: string[];
  };
  queryPrompt: string;
  message: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build the analysis context for the subagent.
 * @internal Exported for testing
 */
export function buildAnalysisContext(args: {
  focus: AnalysisFocus;
  query?: string;
  baselineId?: string;
  compareToId?: string;
  timeRange?: {
    startDate?: string;
    endDate?: string;
    daysBack?: number;
  };
  includeRecommendations?: boolean;
}): TemporalAnalysisContext {
  const now = new Date();

  // Calculate date range
  let dateRange: { start: string; end: string } | undefined;
  if (args.timeRange) {
    const endDate = args.timeRange.endDate ? new Date(args.timeRange.endDate) : now;
    let startDate: Date;

    if (args.timeRange.startDate) {
      startDate = new Date(args.timeRange.startDate);
    } else if (args.timeRange.daysBack) {
      startDate = new Date(now.getTime() - args.timeRange.daysBack * 24 * 60 * 60 * 1000);
    } else {
      // Default to 30 days back
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    dateRange = {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    };
  }

  // Build context with only defined properties (for exactOptionalPropertyTypes)
  const context: TemporalAnalysisContext = {
    focus: args.focus,
    includeRecommendations: args.includeRecommendations ?? true,
    // These will be populated by the subagent via tool calls
    baselineCount: 0,
    reviewCount: 0,
    daysSinceLastReview: null,
  };

  // Only add optional properties if they have defined values
  if (args.query !== undefined) {
    context.query = args.query;
  }
  if (args.baselineId !== undefined) {
    context.targetBaselineId = args.baselineId;
  }
  if (args.compareToId !== undefined) {
    context.comparisonBaselineId = args.compareToId;
  }
  if (dateRange !== undefined) {
    context.dateRange = dateRange;
  }

  return context;
}

/**
 * Build the query prompt for the subagent based on focus and context.
 * @internal Exported for testing
 */
export function buildQueryPrompt(focus: AnalysisFocus, context: TemporalAnalysisContext): string {
  const parts: string[] = [];

  // Focus-specific instructions
  switch (focus) {
    case 'trends':
      parts.push('Analyze workflow metric trends over time.');
      parts.push('Focus on: slope direction, statistical significance, inflection points.');
      parts.push('Use query_trends and list_baselines tools.');
      break;

    case 'reviews':
      parts.push('Analyze qualitative review data and sentiment trends.');
      parts.push('Focus on: sentiment changes, recurring themes, friction points.');
      parts.push('Use get_review_history tool.');
      break;

    case 'comparison':
      parts.push('Compare baselines to identify specific changes.');
      if (context.targetBaselineId) {
        parts.push(`Target baseline: ${context.targetBaselineId}`);
      }
      if (context.comparisonBaselineId) {
        parts.push(`Compare to baseline: ${context.comparisonBaselineId}`);
      }
      parts.push('Use calculate_delta tool.');
      break;

    case 'comprehensive':
      parts.push('Perform comprehensive temporal analysis.');
      parts.push('Combine quantitative metrics with qualitative reviews.');
      parts.push('Look for patterns where metrics and sentiment align or diverge.');
      break;
  }

  // Add date range context
  if (context.dateRange) {
    parts.push(`Time range: ${context.dateRange.start} to ${context.dateRange.end}`);
  }

  // Add user query
  if (context.query) {
    parts.push('');
    parts.push(`User question: ${context.query}`);
  }

  // Add recommendation request
  if (context.includeRecommendations) {
    parts.push('');
    parts.push('Include actionable recommendations based on your analysis.');
  }

  return parts.join('\n');
}

/**
 * Format the tool output for display.
 */
function formatToolOutput(result: SpawnTemporalAnalystResult): string {
  const lines: string[] = [];

  lines.push(`## Temporal Analyzer Spawned\n`);
  lines.push(`**Focus**: ${result.focus}`);
  lines.push(`**Agent Type**: ${result.agentType}`);
  lines.push(`**Tools Available**: ${result.agentDefinition.toolCount}`);

  lines.push(`\n### Analysis Context\n`);

  if (result.context.query) {
    lines.push(`**Query**: ${result.context.query}`);
  }

  if (result.context.dateRange) {
    lines.push(`**Date Range**: ${result.context.dateRange.start} to ${result.context.dateRange.end}`);
  }

  if (result.context.targetBaselineId) {
    lines.push(`**Target Baseline**: ${result.context.targetBaselineId}`);
  }

  if (result.context.comparisonBaselineId) {
    lines.push(`**Comparison Baseline**: ${result.context.comparisonBaselineId}`);
  }

  lines.push(`\n### Subagent Prompt\n`);
  lines.push('```');
  lines.push(result.queryPrompt);
  lines.push('```');

  lines.push(`\n### Available Tools\n`);
  for (const tool of result.agentDefinition.tools) {
    lines.push(`- ${tool}`);
  }

  lines.push(`\n---`);
  lines.push(result.message);

  return lines.join('\n');
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * spawn_temporal_analyst tool definition.
 *
 * Spawns the temporal analyzer subagent with configurable focus.
 * Returns the agent definition and context for orchestrator delegation.
 *
 * Per Constitution Principle C8 (single subagent depth), this tool
 * does NOT execute the subagent directly. Instead, it returns the
 * agent definition for the orchestrator to invoke via SDK.
 *
 * @example
 * ```typescript
 * import { spawnTemporalAnalystTool } from './temporal/tools/spawn-analyst';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(spawnTemporalAnalystTool);
 * ```
 */
export const spawnTemporalAnalystTool = tool(
  'spawn_temporal_analyst',
  `
Spawn a temporal analysis subagent with configurable focus.

Use this tool when you need to:
- Analyze workflow trends across multiple baselines
- Review qualitative sentiment trends over time
- Compare specific baselines for detailed change analysis
- Get comprehensive temporal insights combining metrics and reviews

The subagent has deep domain knowledge about:
- 6 qualitative review dimensions
- Mixed-methods analysis (quantitative + qualitative)
- Statistical trend interpretation
- ADR-0019 tool/agent boundary principles

Focus options:
- trends: Metric trends, slopes, inflection points
- reviews: Qualitative sentiment, themes, friction
- comparison: Baseline-to-baseline delta analysis
- comprehensive: Full multi-dimensional analysis

Returns the subagent definition and context for orchestrator delegation.
The orchestrator should invoke the subagent using the SDK agents option.
  `.trim(),
  spawnTemporalAnalystInputSchema,
  async (args) => {
    try {
      // Select agent type based on readonly flag
      const agent = args.readonly
        ? buildTemporalAnalyzerReadonlyAgent()
        : buildTemporalAnalyzerAgent();

      const agentType = args.readonly ? 'temporal-analyzer-readonly' : 'temporal-analyzer';

      // Build time range object with proper handling of undefined values
      let timeRange: { startDate?: string; endDate?: string; daysBack?: number } | undefined;
      if (args.timeRange) {
        timeRange = {};
        if (args.timeRange.startDate !== undefined) {
          timeRange.startDate = args.timeRange.startDate;
        }
        if (args.timeRange.endDate !== undefined) {
          timeRange.endDate = args.timeRange.endDate;
        }
        if (args.timeRange.daysBack !== undefined) {
          timeRange.daysBack = args.timeRange.daysBack;
        }
      }

      // Build analysis context - only pass defined optional properties
      const contextArgs: Parameters<typeof buildAnalysisContext>[0] = {
        focus: args.focus,
        includeRecommendations: args.includeRecommendations,
      };
      if (args.query !== undefined) {
        contextArgs.query = args.query;
      }
      if (args.baselineId !== undefined) {
        contextArgs.baselineId = args.baselineId;
      }
      if (args.compareToId !== undefined) {
        contextArgs.compareToId = args.compareToId;
      }
      if (timeRange !== undefined) {
        contextArgs.timeRange = timeRange;
      }
      const context = buildAnalysisContext(contextArgs);

      // Build query prompt for the subagent
      const queryPrompt = buildQueryPrompt(args.focus, context);

      // Get tools from agent (always defined, but handle edge case)
      const agentTools = agent.tools ?? [];

      const result: SpawnTemporalAnalystResult = {
        success: true,
        focus: args.focus,
        agentType,
        context,
        agentDefinition: {
          description: agent.description,
          toolCount: agentTools.length,
          tools: agentTools,
        },
        queryPrompt,
        message:
          'Temporal analyzer ready. Use SDK agents option to invoke with the provided prompt and context.',
      };

      // Simulate async operation for SDK compatibility
      await Promise.resolve();

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
            text: `Error spawning temporal analyst: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);
