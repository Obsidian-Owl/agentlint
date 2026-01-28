/**
 * T051: get_session_stats SDK tool definition
 *
 * SDK tool definition for getting session statistics.
 * Uses the Claude Agent SDK's tool() pattern for MCP integration.
 *
 * @module tools/sessions/get-session-stats-tool
 */

import { adaptTool } from '../../opencode/tool-adapter';
import { z } from 'zod';
import { getSessionStats, type GetSessionStatsResult } from './stats';

/**
 * Input schema for get_session_stats tool.
 */
const getSessionStatsInputSchema = {
  since: z
    .string()
    .optional()
    .describe('Filter sessions to those starting after this ISO-8601 timestamp'),
  until: z
    .string()
    .optional()
    .describe('Filter sessions to those starting before this ISO-8601 timestamp'),
  project: z.string().optional().describe('Filter to a specific project path'),
  model: z
    .string()
    .optional()
    .describe('Filter to a specific model (e.g., "claude-opus-4-5-20251101")'),
};

/**
 * Format stats for tool output.
 */
function formatToolOutput(result: GetSessionStatsResult): string {
  const lines: string[] = [];
  const stats = result.stats;

  lines.push(`## Session Statistics\n`);

  // Filters applied
  if (stats.timeRange.since || stats.timeRange.until || stats.projectFilter || stats.modelFilter) {
    lines.push(`### Filters\n`);
    if (stats.timeRange.since) {
      lines.push(`- **Since**: ${stats.timeRange.since}`);
    }
    if (stats.timeRange.until) {
      lines.push(`- **Until**: ${stats.timeRange.until}`);
    }
    if (stats.projectFilter) {
      lines.push(`- **Project**: ${stats.projectFilter}`);
    }
    if (stats.modelFilter) {
      lines.push(`- **Model**: ${stats.modelFilter}`);
    }
    lines.push('');
  }

  // Overview
  lines.push(`### Overview\n`);
  lines.push(`- **Sessions**: ${stats.sessionCount}`);
  lines.push(`- **Avg turns/session**: ${stats.avgTurnsPerSession.toFixed(1)}`);
  lines.push(`- **Compressions**: ${stats.compressionCount}`);
  lines.push('');

  // Token usage
  lines.push(`### Token Usage\n`);
  lines.push(`- **Input tokens**: ${formatNumber(stats.totalInputTokens)}`);
  lines.push(`- **Output tokens**: ${formatNumber(stats.totalOutputTokens)}`);
  lines.push(`- **Cache tokens**: ${formatNumber(stats.totalCacheTokens)}`);
  lines.push(`- **Total**: ${formatNumber(stats.totalInputTokens + stats.totalOutputTokens)}`);
  lines.push(`- **Avg tokens/turn**: ${stats.avgTokensPerTurn.toFixed(0)}`);
  lines.push('');

  // Tool usage
  lines.push(`### Tool Usage\n`);
  lines.push(`- **Total calls**: ${stats.totalToolCalls}`);
  lines.push(`- **Error rate**: ${(stats.toolErrorRate * 100).toFixed(1)}%`);
  lines.push('');

  lines.push(`**Distribution:**`);
  const dist = stats.toolDistribution;
  if (dist.total > 0) {
    if (dist.read > 0) {
      lines.push(`- Read: ${dist.read} (${((dist.read / dist.total) * 100).toFixed(0)}%)`);
    }
    if (dist.write > 0) {
      lines.push(`- Write: ${dist.write} (${((dist.write / dist.total) * 100).toFixed(0)}%)`);
    }
    if (dist.bash > 0) {
      lines.push(`- Bash: ${dist.bash} (${((dist.bash / dist.total) * 100).toFixed(0)}%)`);
    }
    if (dist.search > 0) {
      lines.push(`- Search: ${dist.search} (${((dist.search / dist.total) * 100).toFixed(0)}%)`);
    }
    if (dist.other > 0) {
      lines.push(`- Other: ${dist.other} (${((dist.other / dist.total) * 100).toFixed(0)}%)`);
    }
  } else {
    lines.push('- No tool calls recorded');
  }

  // Model distribution
  const modelDist = stats.modelDistribution;
  const modelKeys = Object.keys(modelDist);
  if (modelKeys.length > 0) {
    lines.push('');
    lines.push(`### Model Distribution\n`);
    const totalSessions = stats.sessionCount;
    for (const modelName of modelKeys) {
      const count = modelDist[modelName]!;
      const pct = totalSessions > 0 ? ((count / totalSessions) * 100).toFixed(0) : '0';
      lines.push(`- ${modelName}: ${count} (${pct}%)`);
    }
  }

  // CLI version
  if (stats.topCliVersion) {
    lines.push('');
    lines.push(`### CLI Version\n`);
    lines.push(`- **Most common**: ${stats.topCliVersion}`);
  }

  // Query time
  lines.push(`\n*Query completed in ${result.queryTimeMs}ms*`);

  return lines.join('\n');
}

/**
 * Format large numbers with thousands separators.
 */
function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * get_session_stats tool definition.
 *
 * Gets aggregated statistics across sessions with filtering.
 *
 * @example
 * ```typescript
 * import { getSessionStatsTool } from './tools/sessions/get-session-stats-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(getSessionStatsTool);
 * ```
 */
export const getSessionStatsTool = adaptTool({
  name: 'get_session_stats',
  description: `Get aggregated statistics across Claude Code sessions.

Returns metrics including:
- Session count and average turns
- Token usage (input, output, cache)
- Tool call distribution and error rate
- Compression (context summarization) count
- Model usage distribution
- CLI version info

Supports filtering by:
- Date range (since/until)
- Project path
- Model (e.g., "claude-opus-4-5-20251101")

Use this to understand development patterns and resource usage.`,
  schema: getSessionStatsInputSchema,
  // eslint-disable-next-line @typescript-eslint/require-await -- Handler must return Promise for MCP compatibility
  handler: async (args: unknown) => {
    const typedArgs = args as { since?: string; until?: string; project?: string; model?: string };
    try {
      // Build input object, only including defined properties
      const input: Parameters<typeof getSessionStats>[0] = {};
      if (typedArgs.since !== undefined) {
        input.since = typedArgs.since;
      }
      if (typedArgs.until !== undefined) {
        input.until = typedArgs.until;
      }
      if (typedArgs.project !== undefined) {
        input.project = typedArgs.project;
      }
      if (typedArgs.model !== undefined) {
        input.model = typedArgs.model;
      }

      const result = getSessionStats(input);

      if (!result.success) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Stats error: ${result.error?.message ?? 'Unknown error'}`,
            },
          ],
          isError: true,
          _rawData: result,
        };
      }

      const output = formatToolOutput(result);

      return {
        content: [
          {
            type: 'text' as const,
            text: output,
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
            text: `Error getting session stats: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  },
});
