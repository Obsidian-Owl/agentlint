/**
 * EP15 Session Intelligence - get_mcp_usage Tool
 *
 * SDK tool definition for extracting MCP tool call statistics from sessions.
 *
 * Per Constitution Principle VII: Returns data (calls, error rates),
 * agent interprets whether MCP patterns indicate issues.
 *
 * @module sessions/tools/get-mcp-usage-tool
 */

import { adaptTool } from '../../opencode/tool-adapter';
import { z } from 'zod';
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { SessionEntry } from '../../tools/sessions/types';
import type { GetMcpUsageOutput } from '../types';
import { extractMcpCalls, aggregateMcpUsage } from '../extraction/mcp-calls';
import { parseSessionLine } from '../../tools/sessions/parser';
import { resolveSessionIdentifier } from './session-resolver';

// =============================================================================
// Types
// =============================================================================

/**
 * Error details for MCP usage extraction.
 */
export interface McpUsageError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** File path if applicable */
  filePath?: string;
  /** Suggestion for resolution */
  suggestion?: string;
}

/**
 * Input for getMcpUsage function.
 */
export interface GetMcpUsageInput {
  /** Path to session JSONL file */
  filePath: string;
  /** Filter by server name */
  serverName?: string;
}

/**
 * Result from getMcpUsage function.
 */
export interface GetMcpUsageResult {
  /** Whether extraction succeeded */
  success: boolean;
  /** The extracted data (if success) */
  data?: GetMcpUsageOutput;
  /** Error details (if failed) */
  error?: McpUsageError;
}

// =============================================================================
// Core Function
// =============================================================================

/**
 * Extract MCP usage statistics from a JSONL file.
 *
 * Parses the session file and extracts MCP tool calls:
 * - Server name parsed from mcp__server__tool pattern
 * - Per-server and per-tool call counts
 * - Error rates and error messages
 *
 * @param input - File path and query parameters
 * @returns MCP usage extraction result
 */
export async function getMcpUsage(input: GetMcpUsageInput): Promise<GetMcpUsageResult> {
  const { filePath, serverName } = input;

  // Check file exists
  try {
    await access(filePath, constants.R_OK);
  } catch {
    return {
      success: false,
      error: {
        code: 'SESSION_FILE_NOT_FOUND',
        message: `Session file not found: ${filePath}`,
        filePath,
        suggestion: 'Verify the session ID is correct and the file has not been deleted.',
      },
    };
  }

  // Parse session file
  const entries: SessionEntry[] = [];
  let sessionId = 'unknown';

  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const result = parseSessionLine(line, i + 1);
      if (result.success) {
        const entry = result.entry;
        entry.filePath = filePath;
        entry.lineNumber = i + 1;
        entries.push(entry);

        // Capture session ID from first entry
        if (entry.sessionId && sessionId === 'unknown') {
          sessionId = entry.sessionId;
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SESSION_FILE_UNREADABLE',
        message: `Failed to read session file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        suggestion: 'Check file permissions and ensure the file is valid JSONL.',
      },
    };
  }

  // Extract MCP calls
  let calls = extractMcpCalls(entries, sessionId);

  // Apply filter
  if (serverName) {
    calls = calls.filter((c) => c.serverName === serverName);
  }

  // Aggregate
  const usage = aggregateMcpUsage(calls);

  return {
    success: true,
    data: {
      servers: usage.servers,
      totalCalls: usage.totalCalls,
      totalErrors: usage.totalErrors,
      overallErrorRate: usage.overallErrorRate,
    },
  };
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Input schema for get_mcp_usage tool.
 */
const getMcpUsageInputSchema = {
  sessionIdentifier: z
    .string()
    .describe(
      'Session identifier: file path, session UUID (e.g., "session-abc123..."), or numeric ID'
    ),
  serverName: z
    .string()
    .optional()
    .describe('Filter by MCP server name (e.g., "linear", "github")'),
};

/**
 * Format MCP usage for tool output.
 */
function formatToolOutput(data: GetMcpUsageOutput): string {
  const lines: string[] = [];

  lines.push(`## MCP Usage\n`);

  // Summary
  lines.push(`### Summary\n`);
  lines.push(`- **Total MCP calls**: ${data.totalCalls}`);
  lines.push(`- **Total errors**: ${data.totalErrors}`);
  lines.push(`- **Overall error rate**: ${(data.overallErrorRate * 100).toFixed(1)}%`);
  lines.push(`- **Servers used**: ${data.servers.length}`);
  lines.push('');

  // Per-server breakdown
  if (data.servers.length === 0) {
    lines.push('*No MCP tool calls detected*');
  } else {
    lines.push(`### Servers (${data.servers.length})\n`);
    lines.push('| Server | Calls | Errors | Error Rate |');
    lines.push('|--------|-------|--------|------------|');

    for (const server of data.servers) {
      const errorRate = (server.errorRate * 100).toFixed(1);
      const errorIndicator = server.errorRate > 0.1 ? ' ⚠️' : '';
      lines.push(
        `| ${server.serverName} | ${server.callCount} | ${server.errorCount} | ${errorRate}%${errorIndicator} |`
      );
    }
    lines.push('');

    // Tool breakdown for servers with multiple tools
    for (const server of data.servers) {
      if (server.tools.length > 1) {
        lines.push(`### ${server.serverName} Tools\n`);
        lines.push('| Tool | Calls | Errors |');
        lines.push('|------|-------|--------|');

        for (const tool of server.tools) {
          lines.push(`| ${tool.toolName} | ${tool.callCount} | ${tool.errorCount} |`);
        }
        lines.push('');
      }
    }
  }

  // Highlight high error rate servers
  const highErrorServers = data.servers.filter((s) => s.errorRate > 0.2);
  if (highErrorServers.length > 0) {
    lines.push(`### High Error Rate Servers\n`);
    lines.push(
      `*Servers with >20% error rate may indicate configuration or connectivity issues.*\n`
    );

    for (const server of highErrorServers) {
      lines.push(`- **${server.serverName}**: ${(server.errorRate * 100).toFixed(0)}% errors`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * get_mcp_usage tool definition.
 *
 * Extracts MCP tool call statistics from a session.
 *
 * @example
 * ```typescript
 * import { getMcpUsageTool } from './sessions/tools/get-mcp-usage-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(getMcpUsageTool);
 * ```
 */
export const getMcpUsageTool = adaptTool({
  name: 'get_mcp_usage',
  description: `Extract MCP (Model Context Protocol) tool call statistics from a Claude Code session.

Returns:
- **Per-server stats**: Call counts, error counts, error rates for each MCP server
- **Per-tool breakdown**: Which tools were called on each server
- **Error messages**: For failed MCP calls (available in raw data)

Use this tool to understand MCP server usage during a session.
MCP patterns are DATA for your interpretation:
- High error rates may indicate server configuration issues
- Frequent calls to same server may indicate reliance on external data
- Mixed success/failure may indicate rate limiting or connectivity

Filter options:
- \`serverName\`: Focus on specific MCP server (e.g., "linear", "github")`,
  schema: getMcpUsageInputSchema,
  handler: async (args: unknown) => {
    const typedArgs = args as { sessionIdentifier?: string; serverName?: string };
    try {
      if (!typedArgs.sessionIdentifier) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: sessionIdentifier is required.',
            },
          ],
          isError: true,
        };
      }

      // Resolve session identifier to file path
      const resolved = resolveSessionIdentifier(typedArgs.sessionIdentifier);
      if (!resolved.success || !resolved.filePath) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error resolving session: ${resolved.error ?? 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }

      // Build input conditionally to satisfy exactOptionalPropertyTypes
      const input: GetMcpUsageInput = {
        filePath: resolved.filePath,
      };
      if (typedArgs.serverName !== undefined) {
        input.serverName = typedArgs.serverName;
      }

      const result = await getMcpUsage(input);

      if (!result.success || !result.data) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `MCP usage extraction error: ${result.error?.message ?? 'Unknown error'}`,
            },
          ],
          isError: true,
          _rawData: result,
        };
      }

      const output = formatToolOutput(result.data);

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
            text: `Error extracting MCP usage: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  },
});
