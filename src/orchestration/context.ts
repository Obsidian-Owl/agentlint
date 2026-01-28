/**
 * Context management utilities for large tool result summarization.
 *
 * @module orchestration/context
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Size threshold in characters for triggering result summarization.
 * Results larger than this are summarized with a reference to the full content.
 *
 * Value: 10KB - balances context preservation with token efficiency.
 * Full implementation in EP03 will add LLM-based summarization.
 */
export const RESULT_SIZE_THRESHOLD = 10_000;

/**
 * Maximum length for the truncated preview in summaries.
 */
const PREVIEW_LENGTH = 500;

// =============================================================================
// Types
// =============================================================================

/**
 * Result of handling a tool result, potentially summarized.
 */
export interface ToolResultSummary {
  /** The tool that produced this result */
  toolName: string;
  /** Whether the result was summarized */
  summarized: boolean;
  /** Original content (if not summarized) */
  content?: unknown;
  /** Summary text (if summarized) */
  summary?: string;
  /** Original size in characters */
  originalSize?: number;
  /** Reference ID to retrieve full content */
  fullContentRef?: string;
}

// =============================================================================
// Tool Result Handling
// =============================================================================

/**
 * Check if a result is considered "large" and should be summarized.
 *
 * @param result - The result to check
 * @returns True if the result exceeds the size threshold
 */
export function isLargeResult(result: unknown): boolean {
  const size = getResultSize(result);
  return size > RESULT_SIZE_THRESHOLD;
}

/**
 * Get the size of a result in characters.
 *
 * @param result - The result to measure
 * @returns Size in characters
 */
function getResultSize(result: unknown): number {
  if (typeof result === 'string') {
    return result.length;
  }
  return JSON.stringify(result).length;
}

/**
 * Handle a tool result, summarizing if it's too large for the context.
 *
 * For large results:
 * 1. Creates a truncated preview
 * 2. Stores a reference for later retrieval (EP03 will implement storage)
 * 3. Returns summary with metadata
 *
 * For small results:
 * - Returns the original content unchanged
 *
 * @param toolName - Name of the tool that produced the result
 * @param result - The tool result to handle
 * @returns Handled result (original or summarized)
 *
 * @example
 * ```typescript
 * const fileContent = await readFile('/large/file.ts');
 * const handled = handleToolResult('read_file', fileContent);
 *
 * if (handled.summarized) {
 *   console.log(`Summarized ${handled.originalSize} chars`);
 *   console.log(handled.summary);
 * }
 * ```
 */
export function handleToolResult(toolName: string, result: unknown): ToolResultSummary {
  const size = getResultSize(result);

  if (!isLargeResult(result)) {
    return {
      toolName,
      summarized: false,
      content: result,
    };
  }

  // Generate reference ID for full content retrieval
  const refId = generateContentRef(toolName, size);

  // Create truncated preview
  const preview = createPreview(result);

  return {
    toolName,
    summarized: true,
    summary: `[Large result from ${toolName}: ${size} chars]\n\nPreview:\n${preview}\n\n[Full content available via ref: ${refId}]`,
    originalSize: size,
    fullContentRef: refId,
  };
}

/**
 * Generate a reference ID for storing full content.
 *
 * @param toolName - Name of the tool
 * @param size - Size of the content
 * @returns Reference ID string
 */
function generateContentRef(toolName: string, size: number): string {
  const timestamp = Date.now();
  return `${toolName}_${timestamp}_${size}`;
}

/**
 * Create a truncated preview of a result.
 *
 * @param result - The result to preview
 * @returns Truncated preview string
 */
function createPreview(result: unknown): string {
  const str = typeof result === 'string' ? result : JSON.stringify(result);

  if (str.length <= PREVIEW_LENGTH) {
    return str;
  }

  // Show first part and indicate truncation
  return str.slice(0, PREVIEW_LENGTH) + '\n... [truncated]';
}
