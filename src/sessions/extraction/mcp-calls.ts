/**
 * EP15 Session Intelligence - MCP Tool Call Extraction
 *
 * Extracts MCP (Model Context Protocol) tool calls from session entries,
 * parsing mcp__ prefixed tool names to identify server and tool.
 *
 * Per Constitution Principle VII: Returns data (calls, error rates).
 * Agent interprets whether error patterns indicate MCP issues.
 *
 * @module sessions/extraction/mcp-calls
 */

import type { SessionEntry, ContentBlock } from '../../tools/sessions/types';
import type { McpToolCallRecord, McpServerUsage } from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * Parsed MCP tool name components.
 */
export interface ParsedMcpToolName {
  /** Server name extracted from mcp__server__tool */
  serverName: string;
  /** Tool name within the server */
  toolName: string;
}

/**
 * Aggregated MCP usage across all servers.
 */
export interface McpUsageSummary {
  /** Per-server usage statistics */
  servers: McpServerUsage[];
  /** Total MCP calls across all servers */
  totalCalls: number;
  /** Total errors across all servers */
  totalErrors: number;
  /** Overall error rate (0-1) */
  overallErrorRate: number;
}

// =============================================================================
// MCP Name Parsing
// =============================================================================

/**
 * Parse an MCP tool name into server and tool components.
 *
 * MCP tools follow the pattern: mcp__<server>__<tool>
 * The server name may contain underscores (e.g., plugin_deepwiki_deepwiki).
 *
 * @param toolName - Full tool name (e.g., "mcp__linear__list_issues")
 * @returns Parsed components or null if not a valid MCP tool name
 *
 * @example
 * ```typescript
 * parseMcpToolName('mcp__linear__list_issues');
 * // Returns: { serverName: 'linear', toolName: 'list_issues' }
 *
 * parseMcpToolName('Read');
 * // Returns: null
 * ```
 */
export function parseMcpToolName(toolName: string): ParsedMcpToolName | null {
  // Must start with mcp__
  if (!toolName.startsWith('mcp__')) {
    return null;
  }

  // Remove the mcp__ prefix
  const remainder = toolName.slice(5);

  // Find the last __ which separates server from tool
  // Server names can contain underscores, tool names can too,
  // but we need at least one __ separator after the prefix
  const lastDoubleUnderscore = remainder.lastIndexOf('__');

  if (lastDoubleUnderscore === -1 || lastDoubleUnderscore === 0) {
    // No __ found or __ at start (meaning no server name)
    return null;
  }

  const serverName = remainder.slice(0, lastDoubleUnderscore);
  const toolNamePart = remainder.slice(lastDoubleUnderscore + 2);

  // Both server and tool names must be non-empty
  if (!serverName || !toolNamePart) {
    return null;
  }

  return {
    serverName,
    toolName: toolNamePart,
  };
}

// =============================================================================
// MCP Call Extraction
// =============================================================================

/**
 * Extract MCP tool calls from session entries.
 *
 * Scans assistant messages for tools with mcp__ prefix and extracts:
 * - Server name and tool name
 * - Success/error status
 * - Error messages for failed calls
 *
 * Per Constitution Principle VII: Returns raw data for agent interpretation.
 *
 * @param entries - Session entries from JSONL
 * @param sessionId - Session UUID
 * @returns Array of MCP tool call records
 *
 * @example
 * ```typescript
 * const calls = extractMcpCalls(entries, 'session-123');
 * // Returns: [{ serverName: 'linear', toolName: 'list_issues', isError: false }]
 * ```
 */
export function extractMcpCalls(entries: SessionEntry[], sessionId: string): McpToolCallRecord[] {
  const calls: McpToolCallRecord[] = [];

  // Build a map of tool_use_id -> tool result for matching
  const toolResults = new Map<string, { content: string; isError: boolean }>();
  for (const entry of entries) {
    if (entry.type === 'tool_result' && entry.toolResult) {
      const content =
        typeof entry.toolResult.content === 'string'
          ? entry.toolResult.content
          : JSON.stringify(entry.toolResult.content);
      toolResults.set(entry.toolResult.toolUseId, {
        content,
        isError: entry.toolResult.isError ?? false,
      });
    }
  }

  // Scan for MCP tool calls from assistant messages
  for (const entry of entries) {
    if (entry.type !== 'assistant' || !entry.message?.content) {
      continue;
    }

    // Find tool_use blocks
    const toolUseBlocks = entry.message.content.filter(
      (block): block is ContentBlock & { type: 'tool_use'; name: string } =>
        block.type === 'tool_use' && typeof block.name === 'string'
    );

    for (const block of toolUseBlocks) {
      // Try to parse as MCP tool
      const parsed = parseMcpToolName(block.name);
      if (!parsed) {
        continue;
      }

      // Get tool result if available
      const toolId = block.id ?? '';
      const result = toolResults.get(toolId);
      const isError = result?.isError ?? false;
      const errorMessage = isError ? result?.content : undefined;

      // Create call record
      const call: McpToolCallRecord = {
        sessionId,
        serverName: parsed.serverName,
        toolName: parsed.toolName,
        timestamp: entry.timestamp,
        isError,
      };

      // Only add optional properties if they have values
      if (errorMessage !== undefined) {
        call.errorMessage = errorMessage;
      }
      if (entry.filePath) {
        call.filePath = entry.filePath;
      }
      if (entry.lineNumber !== undefined) {
        call.lineNumber = entry.lineNumber;
      }

      calls.push(call);
    }
  }

  return calls;
}

// =============================================================================
// MCP Usage Aggregation
// =============================================================================

/**
 * Aggregate MCP calls into per-server usage statistics.
 *
 * Per Constitution Principle VII: Returns rates as data.
 * Agent interprets whether error patterns indicate MCP issues.
 *
 * @param calls - MCP calls from extractMcpCalls
 * @returns Aggregated usage summary
 *
 * @example
 * ```typescript
 * const usage = aggregateMcpUsage(calls);
 * // Returns: { servers: [...], totalCalls: 10, overallErrorRate: 0.1 }
 * ```
 */
export function aggregateMcpUsage(calls: McpToolCallRecord[]): McpUsageSummary {
  if (calls.length === 0) {
    return {
      servers: [],
      totalCalls: 0,
      totalErrors: 0,
      overallErrorRate: 0,
    };
  }

  // Group by server
  const serverMap = new Map<
    string,
    {
      callCount: number;
      errorCount: number;
      tools: Map<string, { callCount: number; errorCount: number }>;
    }
  >();

  for (const call of calls) {
    let server = serverMap.get(call.serverName);
    if (!server) {
      server = {
        callCount: 0,
        errorCount: 0,
        tools: new Map(),
      };
      serverMap.set(call.serverName, server);
    }

    server.callCount++;
    if (call.isError) {
      server.errorCount++;
    }

    // Track per-tool stats
    let tool = server.tools.get(call.toolName);
    if (!tool) {
      tool = { callCount: 0, errorCount: 0 };
      server.tools.set(call.toolName, tool);
    }
    tool.callCount++;
    if (call.isError) {
      tool.errorCount++;
    }
  }

  // Convert to usage summaries
  const servers: McpServerUsage[] = [];

  for (const [serverName, stats] of serverMap) {
    const tools: Array<{ toolName: string; callCount: number; errorCount: number }> = [];

    for (const [toolName, toolStats] of stats.tools) {
      tools.push({
        toolName,
        callCount: toolStats.callCount,
        errorCount: toolStats.errorCount,
      });
    }

    // Sort tools by call count descending
    tools.sort((a, b) => b.callCount - a.callCount);

    servers.push({
      serverName,
      callCount: stats.callCount,
      errorCount: stats.errorCount,
      errorRate: stats.callCount > 0 ? stats.errorCount / stats.callCount : 0,
      tools,
    });
  }

  // Sort servers by call count descending
  servers.sort((a, b) => b.callCount - a.callCount);

  // Calculate totals
  const totalCalls = calls.length;
  const totalErrors = calls.filter((c) => c.isError).length;

  return {
    servers,
    totalCalls,
    totalErrors,
    overallErrorRate: totalCalls > 0 ? totalErrors / totalCalls : 0,
  };
}
