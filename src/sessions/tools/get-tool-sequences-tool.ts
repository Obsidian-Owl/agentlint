/**
 * EP15 Session Intelligence - get_tool_sequences Tool
 *
 * SDK tool definition for extracting tool call sequences and detecting
 * repeat patterns in sessions.
 *
 * Per Constitution Principle VII: Returns data (sequences, hashes, patterns),
 * agent interprets whether patterns indicate issues.
 *
 * @module sessions/tools/get-tool-sequences-tool
 */

import { adaptTool } from '../../opencode/tool-adapter';
import { z } from 'zod';
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { SessionEntry } from '../../tools/sessions/types';
import type { GetToolSequencesOutput } from '../types';
import { extractToolSequences, detectRepeatPatterns } from '../extraction/tool-sequences';
import { parseSessionLine } from '../../tools/sessions/parser';
import { resolveSessionIdentifier } from './session-resolver';

// =============================================================================
// Types
// =============================================================================

/**
 * Error details for tool sequence extraction.
 */
export interface ToolSequencesError {
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
 * Input for getToolSequences function.
 */
export interface GetToolSequencesInput {
  /** Path to session JSONL file */
  filePath: string;
  /** Maximum records to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Filter by tool name */
  toolName?: string;
  /** Only return errors */
  errorsOnly?: boolean;
}

/**
 * Result from getToolSequences function.
 */
export interface GetToolSequencesResult {
  /** Whether extraction succeeded */
  success: boolean;
  /** The extracted data (if success) */
  data?: GetToolSequencesOutput;
  /** Error details (if failed) */
  error?: ToolSequencesError;
}

// =============================================================================
// Core Function
// =============================================================================

/**
 * Extract tool call sequences from a JSONL file.
 *
 * Parses the session file and extracts:
 * - Tool calls in sequence order
 * - Input hashes for repeat detection
 * - Error information
 * - Repeat patterns
 *
 * @param input - File path and query parameters
 * @returns Tool sequences extraction result
 */
export async function getToolSequences(
  input: GetToolSequencesInput
): Promise<GetToolSequencesResult> {
  const { filePath, limit = 100, offset = 0, toolName, errorsOnly = false } = input;

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

  // Extract all tool sequences
  let sequences = extractToolSequences(entries, sessionId);

  // Apply filters
  if (toolName) {
    sequences = sequences.filter((seq) => seq.toolName === toolName);
  }
  if (errorsOnly) {
    sequences = sequences.filter((seq) => seq.isError);
  }

  // Detect repeat patterns on filtered sequences
  const repeatPatterns = detectRepeatPatterns(sequences);

  // Get total before pagination
  const totalCount = sequences.length;

  // Apply pagination
  const paginatedSequences = sequences.slice(offset, offset + limit);

  // Build query object conditionally to satisfy exactOptionalPropertyTypes
  const queryInfo: GetToolSequencesOutput['query'] = {
    sessionId,
    limit,
    offset,
    errorsOnly,
  };
  if (toolName) {
    queryInfo.toolName = toolName;
  }

  return {
    success: true,
    data: {
      sequences: paginatedSequences,
      totalCount,
      repeatPatterns,
      query: queryInfo,
    },
  };
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Input schema for get_tool_sequences tool.
 */
const getToolSequencesInputSchema = {
  sessionIdentifier: z
    .string()
    .describe(
      'Session identifier: file path, session UUID (e.g., "session-abc123..."), or numeric ID'
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(500)
    .optional()
    .describe('Maximum records to return (default: 100, max: 500)'),
  offset: z.number().int().min(0).optional().describe('Offset for pagination (default: 0)'),
  toolName: z.string().optional().describe('Filter by specific tool name (e.g., "Bash", "Read")'),
  errorsOnly: z.boolean().optional().describe('Only return tool calls that resulted in errors'),
};

/**
 * Format tool sequences for tool output.
 */
function formatToolOutput(data: GetToolSequencesOutput): string {
  const lines: string[] = [];

  lines.push(`## Tool Sequences\n`);

  // Summary
  lines.push(`### Summary\n`);
  lines.push(`- **Total tool calls**: ${data.totalCount}`);
  lines.push(`- **Returned**: ${data.sequences.length}`);
  lines.push(`- **Repeat patterns detected**: ${data.repeatPatterns.length}`);

  if (data.query.toolName) {
    lines.push(`- **Filtered by tool**: ${data.query.toolName}`);
  }
  if (data.query.errorsOnly) {
    lines.push(`- **Errors only**: Yes`);
  }
  lines.push('');

  // Repeat patterns (important signal for agent)
  if (data.repeatPatterns.length > 0) {
    lines.push(`### Repeat Patterns\n`);
    lines.push(
      `*Repeated tool calls with identical inputs may indicate issues. You decide what they mean.*\n`
    );

    for (const pattern of data.repeatPatterns) {
      lines.push(
        `- **${pattern.toolName}**: ${pattern.repeatCount}x (indices ${pattern.firstOccurrence}→${pattern.lastOccurrence})`
      );
    }
    lines.push('');
  }

  // Tool call table
  lines.push(`### Tool Calls\n`);

  if (data.sequences.length === 0) {
    lines.push('*No tool calls found matching filters*');
  } else {
    lines.push('| # | Tool | Error | Hash (first 8) |');
    lines.push('|---|------|-------|----------------|');

    for (const seq of data.sequences) {
      const errorFlag = seq.isError ? '⚠️' : '';
      const hashPrefix = seq.inputHash.slice(0, 8);
      lines.push(`| ${seq.sequenceIndex} | ${seq.toolName} | ${errorFlag} | ${hashPrefix} |`);
    }
  }
  lines.push('');

  // Pagination info
  if (data.totalCount > data.sequences.length) {
    lines.push(`### Pagination\n`);
    lines.push(
      `Showing ${data.query.offset ?? 0 + 1}-${(data.query.offset ?? 0) + data.sequences.length} of ${data.totalCount}`
    );
    lines.push(`Use \`offset\` parameter to page through results.`);
  }

  return lines.join('\n');
}

/**
 * get_tool_sequences tool definition.
 *
 * Extracts tool call sequences and detects repeat patterns from a session.
 *
 * @example
 * ```typescript
 * import { getToolSequencesTool } from './sessions/tools/get-tool-sequences-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(getToolSequencesTool);
 * ```
 */
export const getToolSequencesTool = adaptTool({
  name: 'get_tool_sequences',
  description: `Extract tool call sequences and detect repeat patterns from a Claude Code session.

Returns:
- **Sequences**: Tool calls in order with name, input hash, error status
- **Repeat patterns**: Same tool+input called multiple times (potential "stuck" indicator)
- **Pagination**: Supports limit/offset for large sessions

Use this tool to understand the flow of tool usage in a session.
Repeat patterns are DATA for your interpretation:
- Multiple identical Read calls might indicate confusion about file state
- Multiple identical Bash calls might indicate a command not working
- Some repetition is normal (re-checking status, etc.)

Filter options:
- \`toolName\`: Focus on specific tool (e.g., "Bash" for command patterns)
- \`errorsOnly\`: See only failed tool calls`,
  schema: getToolSequencesInputSchema,
  handler: async (args: unknown) => {
    const typedArgs = args as {
      sessionIdentifier?: string;
      limit?: number;
      offset?: number;
      toolName?: string;
      errorsOnly?: boolean;
    };
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
      const input: GetToolSequencesInput = {
        filePath: resolved.filePath,
      };
      if (typedArgs.limit !== undefined) {
        input.limit = typedArgs.limit;
      }
      if (typedArgs.offset !== undefined) {
        input.offset = typedArgs.offset;
      }
      if (typedArgs.toolName !== undefined) {
        input.toolName = typedArgs.toolName;
      }
      if (typedArgs.errorsOnly !== undefined) {
        input.errorsOnly = typedArgs.errorsOnly;
      }

      const result = await getToolSequences(input);

      if (!result.success || !result.data) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Tool sequences extraction error: ${result.error?.message ?? 'Unknown error'}`,
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
            text: `Error extracting tool sequences: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  },
});
