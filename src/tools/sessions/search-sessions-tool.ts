/**
 * T046: search_sessions SDK tool definition
 *
 * SDK tool definition for searching session logs.
 * Uses the Claude Agent SDK's tool() pattern for MCP integration.
 *
 * @module tools/sessions/search-sessions-tool
 */

import { adaptTool } from '../../opencode/tool-adapter';
import { z } from 'zod';
import { searchSessions, type SearchSessionsResult } from './search';
import type { SearchResult } from './types';

/**
 * Input schema for search_sessions tool.
 */
const searchSessionsInputSchema = {
  query: z.string().describe(
    `FTS5 search query. Supports:
- Simple terms: error
- Phrases: "exact phrase"
- Prefix: err*
- Boolean: error AND warning, user OR assistant, error NOT info
- Field-specific: role:assistant, tool_name:Bash, content:hello`
  ),
  since: z.string().optional().describe('Filter results to entries after this ISO-8601 timestamp'),
  until: z.string().optional().describe('Filter results to entries before this ISO-8601 timestamp'),
  project: z.string().optional().describe('Filter to a specific project path'),
  sessionId: z.string().optional().describe('Filter to a specific session ID'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of results to return (default: 50)'),
  offset: z.number().int().min(0).optional().describe('Offset for pagination (default: 0)'),
};

/**
 * Format a single search result for display.
 */
function formatResult(result: SearchResult, index: number): string {
  const lines: string[] = [];

  lines.push(`### ${index + 1}. ${result.sessionId}`);
  lines.push(`**Timestamp**: ${result.timestamp}`);
  lines.push(`**Project**: ${result.projectPath}`);

  if (result.role) {
    lines.push(`**Role**: ${result.role}`);
  }

  if (result.toolName) {
    lines.push(`**Tool**: ${result.toolName}`);
  }

  lines.push(`**Score**: ${result.relevanceScore.toFixed(4)}`);
  lines.push(`**Location**: ${result.filePath}:${result.lineNumber}`);

  if (result.contentSnippet) {
    lines.push(`\n**Snippet**:`);
    lines.push('```');
    lines.push(result.contentSnippet);
    lines.push('```');
  }

  return lines.join('\n');
}

/**
 * Format search results for tool output.
 */
function formatToolOutput(result: SearchSessionsResult): string {
  const lines: string[] = [];

  lines.push(`## Search Results\n`);
  lines.push(`**Query**: \`${result.filters.query}\``);
  lines.push(`**Total matches**: ${result.totalMatches}`);
  lines.push(`**Returned**: ${result.results.length}`);
  lines.push(`**Query time**: ${result.queryTimeMs}ms\n`);

  // Show applied filters
  if (result.filters.timeRange.since || result.filters.timeRange.until) {
    lines.push(`### Filters\n`);
    if (result.filters.timeRange.since) {
      lines.push(`- **Since**: ${result.filters.timeRange.since}`);
    }
    if (result.filters.timeRange.until) {
      lines.push(`- **Until**: ${result.filters.timeRange.until}`);
    }
    if (result.filters.project) {
      lines.push(`- **Project**: ${result.filters.project}`);
    }
    if (result.filters.sessionId) {
      lines.push(`- **Session**: ${result.filters.sessionId}`);
    }
    lines.push('');
  }

  // Results
  if (result.results.length === 0) {
    lines.push('No results found matching your query.\n');
    lines.push('**Tips:**');
    lines.push('- Try simpler search terms');
    lines.push('- Use prefix search: `err*` matches error, errors, etc.');
    lines.push('- Check date range filters');
    lines.push('- Ensure sessions are indexed');
  } else {
    lines.push(`### Results\n`);
    for (let i = 0; i < result.results.length; i++) {
      const r = result.results[i];
      if (r) {
        lines.push(formatResult(r, i));
        if (i < result.results.length - 1) {
          lines.push('\n---\n');
        }
      }
    }

    // Pagination hint
    if (result.totalMatches > result.results.length) {
      lines.push(
        `\n*Showing ${result.results.length} of ${result.totalMatches} total matches. Use offset to paginate.*`
      );
    }
  }

  return lines.join('\n');
}

/**
 * search_sessions tool definition.
 *
 * Searches session logs using full-text search with BM25 ranking.
 * Supports FTS5 query syntax including phrases, prefixes, and boolean operators.
 *
 * @example
 * ```typescript
 * import { searchSessionsTool } from './tools/sessions/search-sessions-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(searchSessionsTool);
 * ```
 */
export const searchSessionsTool = adaptTool({
  name: 'search_sessions',
  description: `Search Claude Code session logs using full-text search.

Searches through indexed session logs with BM25 ranking for relevance.
Returns matching entries with highlighted snippets and source locations.

Query Syntax (FTS5):
- Simple terms: error, warning
- Phrases: "exact phrase"
- Prefix: err* (matches error, errors, etc.)
- Boolean: error AND warning, user OR assistant, error NOT info
- Field-specific: role:assistant, tool_name:Bash

Filters:
- since/until: Date range filtering (ISO-8601 format)
- project: Filter to specific project path
- sessionId: Filter to specific session

Returns results ranked by relevance with snippets showing match context.`,
  schema: searchSessionsInputSchema,
  // eslint-disable-next-line @typescript-eslint/require-await -- Handler must return Promise for MCP compatibility
  handler: async (args: unknown) => {
    const typedArgs = args as {
      query: string;
      since?: string;
      until?: string;
      project?: string;
      sessionId?: string;
      limit?: number;
      offset?: number;
    };
    try {
      // Build input object, only including defined properties
      const input: Parameters<typeof searchSessions>[0] = {
        query: typedArgs.query,
      };
      if (typedArgs.since !== undefined) {
        input.since = typedArgs.since;
      }
      if (typedArgs.until !== undefined) {
        input.until = typedArgs.until;
      }
      if (typedArgs.project !== undefined) {
        input.project = typedArgs.project;
      }
      if (typedArgs.sessionId !== undefined) {
        input.sessionId = typedArgs.sessionId;
      }
      if (typedArgs.limit !== undefined) {
        input.limit = typedArgs.limit;
      }
      if (typedArgs.offset !== undefined) {
        input.offset = typedArgs.offset;
      }

      const result = searchSessions(input);

      if (!result.success) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Search error: ${result.error?.message ?? 'Unknown error'}\n\n${result.error?.suggestion ?? ''}`,
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
            text: `Error searching sessions: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  },
});
