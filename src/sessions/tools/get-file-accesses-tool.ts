/**
 * EP15 Session Intelligence - get_file_accesses Tool
 *
 * SDK tool definition for extracting file access patterns from sessions.
 *
 * Per Constitution Principle VII: Returns data (paths, counts, operations),
 * agent interprets whether patterns indicate issues.
 *
 * @module sessions/tools/get-file-accesses-tool
 */

import { adaptTool } from '../../opencode/tool-adapter';
import { z } from 'zod';
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { SessionEntry } from '../../tools/sessions/types';
import type { FileOperation, GetFileAccessesOutput } from '../types';
import { extractFileAccesses, aggregateFileAccesses } from '../extraction/file-accesses';
import { parseSessionLine } from '../../tools/sessions/parser';
import { resolveSessionIdentifier } from './session-resolver';

// =============================================================================
// Types
// =============================================================================

/**
 * Error details for file access extraction.
 */
export interface FileAccessesError {
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
 * Input for getFileAccesses function.
 */
export interface GetFileAccessesInput {
  /** Path to session JSONL file */
  filePath: string;
  /** Filter by file path pattern */
  filePattern?: string;
  /** Filter by operation type */
  operation?: FileOperation;
}

/**
 * Result from getFileAccesses function.
 */
export interface GetFileAccessesResult {
  /** Whether extraction succeeded */
  success: boolean;
  /** The extracted data (if success) */
  data?: GetFileAccessesOutput;
  /** Error details (if failed) */
  error?: FileAccessesError;
}

// =============================================================================
// Core Function
// =============================================================================

/**
 * Extract file access patterns from a JSONL file.
 *
 * Parses the session file and extracts:
 * - File access records (read/write/edit)
 * - Per-file operation counts
 * - Access sequence
 *
 * @param input - File path and query parameters
 * @returns File accesses extraction result
 */
export async function getFileAccesses(input: GetFileAccessesInput): Promise<GetFileAccessesResult> {
  const { filePath, filePattern, operation } = input;

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

  // Extract all file accesses
  let accesses = extractFileAccesses(entries, sessionId);

  // Apply file pattern filter
  if (filePattern) {
    const pattern = new RegExp(filePattern.replace(/\*/g, '.*'), 'i');
    accesses = accesses.filter((acc) => pattern.test(acc.filePath));
  }

  // Apply operation filter
  if (operation) {
    accesses = accesses.filter((acc) => acc.operation === operation);
  }

  // Aggregate into summaries
  const summaries = aggregateFileAccesses(accesses);

  // Calculate totals
  const uniqueFiles = summaries.length;
  const totalOperations = summaries.reduce((sum, s) => sum + s.totalAccesses, 0);

  return {
    success: true,
    data: {
      summaries,
      uniqueFiles,
      totalOperations,
    },
  };
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Input schema for get_file_accesses tool.
 */
const getFileAccessesInputSchema = {
  sessionIdentifier: z
    .string()
    .describe(
      'Session identifier: file path, session UUID (e.g., "session-abc123..."), or numeric ID'
    ),
  filePattern: z
    .string()
    .optional()
    .describe('Filter by file path pattern (supports * wildcard, e.g., "*.ts", "src/*")'),
  operation: z.enum(['read', 'write', 'edit']).optional().describe('Filter by operation type'),
};

/**
 * Format file accesses for tool output.
 */
function formatToolOutput(data: GetFileAccessesOutput): string {
  const lines: string[] = [];

  lines.push(`## File Accesses\n`);

  // Summary
  lines.push(`### Summary\n`);
  lines.push(`- **Unique files**: ${data.uniqueFiles}`);
  lines.push(`- **Total operations**: ${data.totalOperations}`);
  lines.push('');

  // File table
  lines.push(`### Files by Access Count\n`);

  if (data.summaries.length === 0) {
    lines.push('*No file accesses found matching filters*');
  } else {
    lines.push('| File | Read | Write | Edit | Total |');
    lines.push('|------|------|-------|------|-------|');

    // Show top 20, sorted by total accesses
    const topFiles = data.summaries.slice(0, 20);

    for (const summary of topFiles) {
      // Truncate long paths
      const path = truncatePath(summary.filePath, 50);
      lines.push(
        `| ${path} | ${summary.operations.read} | ${summary.operations.write} | ${summary.operations.edit} | ${summary.totalAccesses} |`
      );
    }

    if (data.summaries.length > 20) {
      lines.push(`| ... | ... | ... | ... | ... |`);
      lines.push(`| *${data.summaries.length - 20} more files* | | | | |`);
    }
  }
  lines.push('');

  // Hot files analysis hint
  if (data.summaries.length > 0) {
    const hotFiles = data.summaries.filter((s) => s.totalAccesses >= 5);
    if (hotFiles.length > 0) {
      lines.push(`### Hot Files (≥5 accesses)\n`);
      lines.push(`*Files with high access counts may indicate focus areas or issues.*\n`);
      for (const file of hotFiles.slice(0, 5)) {
        const path = truncatePath(file.filePath, 60);
        lines.push(`- **${path}**: ${file.totalAccesses} accesses`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Truncate a path from the left to fit within maxLen.
 */
function truncatePath(path: string, maxLen: number): string {
  if (path.length <= maxLen) return path;
  return '...' + path.slice(-(maxLen - 3));
}

/**
 * get_file_accesses tool definition.
 *
 * Extracts file access patterns and summaries from a session.
 *
 * @example
 * ```typescript
 * import { getFileAccessesTool } from './sessions/tools/get-file-accesses-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(getFileAccessesTool);
 * ```
 */
export const getFileAccessesTool = adaptTool({
  name: 'get_file_accesses',
  description: `Extract file access patterns from a Claude Code session.

Returns:
- **Summaries**: Per-file operation counts (read/write/edit)
- **Hot files**: Files with high access counts
- **Totals**: Unique files and total operations

Use this tool to understand which files were touched during a session.
Access patterns are DATA for your interpretation:
- High read counts might indicate reference files or confusion
- High edit counts might indicate iterative refinement or difficulty
- Many unique files might indicate breadth of changes
- Few files with high counts might indicate focused work

Filter options:
- \`filePattern\`: Focus on specific paths (e.g., "*.test.ts", "src/components/*")
- \`operation\`: Focus on specific operation type`,
  schema: getFileAccessesInputSchema,
  handler: async (args: unknown) => {
    const typedArgs = args as {
      sessionIdentifier?: string;
      filePattern?: string;
      operation?: FileOperation;
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
      const input: GetFileAccessesInput = {
        filePath: resolved.filePath,
      };
      if (typedArgs.filePattern !== undefined) {
        input.filePattern = typedArgs.filePattern;
      }
      if (typedArgs.operation !== undefined) {
        input.operation = typedArgs.operation;
      }

      const result = await getFileAccesses(input);

      if (!result.success || !result.data) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `File accesses extraction error: ${result.error?.message ?? 'Unknown error'}`,
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
            text: `Error extracting file accesses: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  },
});
