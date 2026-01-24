/**
 * EP06 Session Analysis Tools - JSONL Parser
 *
 * Parses Claude Code session log files in JSONL format.
 * Handles malformed lines, extracts metrics, and supports streaming.
 *
 * @module src/tools/sessions/parser
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { SessionEntry, TokenUsage, ContentBlock, EntryType } from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of parsing a single line.
 */
export type ParseLineResult =
  | { success: true; entry: SessionEntry }
  | { success: false; error: string; lineNumber: number };

/**
 * Result of parsing an entire session file.
 */
export interface ParseSessionResult {
  /** Parsed session entries */
  entries: SessionEntry[];
  /** Path to the parsed file */
  filePath: string;
  /** Session ID (from first entry with sessionId) */
  sessionId: string | null;
  /** First timestamp in the session */
  firstTimestamp: string | null;
  /** Last timestamp in the session */
  lastTimestamp: string | null;
  /** Total input tokens across all entries */
  totalInputTokens: number;
  /** Total output tokens across all entries */
  totalOutputTokens: number;
  /** Total cache read tokens */
  totalCacheReadTokens: number;
  /** Number of compression events (summaries) */
  compressionCount: number;
  /** Number of parsing errors */
  errorCount: number;
  /** Detailed error information */
  errors: Array<{ lineNumber: number; message: string }>;
}

/**
 * Statistics from a streaming parser.
 */
export interface ParserStats {
  totalLines: number;
  validLines: number;
  errorLines: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  compressionCount: number;
}

/**
 * Streaming parser interface.
 */
export interface SessionParser {
  parseLine: (line: string) => ParseLineResult;
  getStats: () => ParserStats;
  reset: () => void;
}

// =============================================================================
// Line Parsing
// =============================================================================

/**
 * Parse a single JSONL line into a SessionEntry.
 *
 * @param line - Raw line from the JSONL file
 * @param lineNumber - Line number for error reporting
 * @returns Parse result with entry or error
 */
export function parseSessionLine(line: string, lineNumber: number): ParseLineResult {
  const trimmed = line.trim();

  if (trimmed === '') {
    return {
      success: false,
      error: 'Empty line',
      lineNumber,
    };
  }

  try {
    const raw = JSON.parse(trimmed) as Record<string, unknown>;

    // Extract common fields
    const entry: SessionEntry = {
      type: (raw.type as EntryType) || 'user',
      uuid: (raw.uuid as string) || (raw.messageId as string) || '',
      timestamp: (raw.timestamp as string) || '',
      lineNumber,
    };

    // Add optional sessionId if present
    if (typeof raw.sessionId === 'string') {
      entry.sessionId = raw.sessionId;
    }

    // Add optional version if present (CLI version)
    if (typeof raw.version === 'string') {
      entry.version = raw.version;
    }

    // Extract message if present
    if (raw.message && typeof raw.message === 'object') {
      const msg = raw.message as Record<string, unknown>;
      const parsedContent = parseContent(msg.content);
      const parsedUsage = parseUsage(msg.usage);
      entry.message = {
        role: (msg.role as 'user' | 'assistant') || 'user',
      };
      if (parsedContent) {
        entry.message.content = parsedContent;
      }
      if (parsedUsage) {
        entry.message.usage = parsedUsage;
      }
      if (typeof msg.model === 'string') {
        entry.message.model = msg.model;
      }
    }

    // Extract tool result if present
    if (raw.tool_result && typeof raw.tool_result === 'object') {
      const tr = raw.tool_result as Record<string, unknown>;
      entry.toolResult = {
        toolUseId: (tr.tool_use_id as string) || '',
      };
      if (tr.content !== undefined) {
        entry.toolResult.content = tr.content as string;
      }
      if (tr.is_error !== undefined) {
        entry.toolResult.isError = tr.is_error as boolean;
      }
    }

    // Extract summary if present
    if (typeof raw.summary === 'string') {
      entry.summary = raw.summary;
    }

    // Extract permission request if present (EP15 US-008)
    if (raw.permissionRequest && typeof raw.permissionRequest === 'object') {
      const pr = raw.permissionRequest as Record<string, unknown>;
      if (
        typeof pr.toolName === 'string' &&
        typeof pr.decision === 'string' &&
        typeof pr.timestamp === 'string'
      ) {
        entry.permissionRequest = {
          toolName: pr.toolName,
          toolInput: (pr.toolInput as Record<string, unknown>) ?? {},
          decision: pr.decision as 'approved' | 'denied' | 'auto_approved',
          timestamp: pr.timestamp,
        };
      }
    }

    return { success: true, entry };
  } catch (error) {
    return {
      success: false,
      error: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      lineNumber,
    };
  }
}

/**
 * Parse message content into ContentBlock array.
 */
function parseContent(content: unknown): ContentBlock[] | undefined {
  if (content === undefined || content === null) {
    return undefined;
  }

  // String content (common for user messages)
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  // Array of content blocks
  if (Array.isArray(content)) {
    return content.map((block) => {
      if (typeof block === 'object' && block !== null) {
        const b = block as Record<string, unknown>;
        const contentBlock: ContentBlock = {
          type: (b.type as ContentBlock['type']) || 'text',
        };
        if (b.text !== undefined) contentBlock.text = b.text as string;
        if (b.id !== undefined) contentBlock.id = b.id as string;
        if (b.name !== undefined) contentBlock.name = b.name as string;
        if (b.input !== undefined) contentBlock.input = b.input as Record<string, unknown>;
        return contentBlock;
      }
      return { type: 'text' as const, text: String(block) };
    });
  }

  return undefined;
}

/**
 * Parse token usage object.
 */
function parseUsage(usage: unknown): TokenUsage | undefined {
  if (!usage || typeof usage !== 'object') {
    return undefined;
  }

  const u = usage as Record<string, unknown>;
  const result: TokenUsage = {
    input_tokens: (u.input_tokens as number) || 0,
    output_tokens: (u.output_tokens as number) || 0,
  };

  if (typeof u.cache_creation_input_tokens === 'number') {
    result.cache_creation_input_tokens = u.cache_creation_input_tokens;
  }
  if (typeof u.cache_read_input_tokens === 'number') {
    result.cache_read_input_tokens = u.cache_read_input_tokens;
  }

  return result;
}

// =============================================================================
// File Parsing
// =============================================================================

/**
 * Parse an entire session file.
 *
 * Reads the file line by line, parsing each entry and accumulating statistics.
 *
 * @param filePath - Path to the JSONL file
 * @returns Parse result with all entries and statistics
 */
export async function parseSessionFile(filePath: string): Promise<ParseSessionResult> {
  const result: ParseSessionResult = {
    entries: [],
    filePath,
    sessionId: null,
    firstTimestamp: null,
    lastTimestamp: null,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    compressionCount: 0,
    errorCount: 0,
    errors: [],
  };

  try {
    const fileHandle = Bun.file(filePath);
    const content = await fileHandle.text();
    const lines = content.split('\n');

    let lineNumber = 0;
    for (const line of lines) {
      lineNumber++;

      if (line.trim() === '') {
        continue; // Skip empty lines
      }

      const parseResult = parseSessionLine(line, lineNumber);

      if (parseResult.success) {
        const entry = parseResult.entry;
        result.entries.push(entry);

        // Extract session ID from first entry that has it
        if (!result.sessionId && entry.sessionId) {
          result.sessionId = entry.sessionId;
        }

        // Track timestamps
        if (entry.timestamp) {
          if (!result.firstTimestamp) {
            result.firstTimestamp = entry.timestamp;
          }
          result.lastTimestamp = entry.timestamp;
        }

        // Accumulate token usage
        if (entry.message?.usage) {
          result.totalInputTokens += entry.message.usage.input_tokens || 0;
          result.totalOutputTokens += entry.message.usage.output_tokens || 0;
          result.totalCacheReadTokens += entry.message.usage.cache_read_input_tokens || 0;
        }

        // Count compression events
        if (entry.type === 'summary') {
          result.compressionCount++;
        }
      } else {
        result.errorCount++;
        result.errors.push({
          lineNumber: parseResult.lineNumber,
          message: parseResult.error,
        });
      }
    }
  } catch (error) {
    result.errorCount++;
    result.errors.push({
      lineNumber: 0,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

// =============================================================================
// Streaming Parser
// =============================================================================

/**
 * Create a streaming session parser.
 *
 * Use this for memory-efficient parsing of large files.
 *
 * @returns Parser interface for line-by-line parsing
 */
export function createSessionParser(): SessionParser {
  let lineNumber = 0;
  let validLines = 0;
  let errorLines = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let compressionCount = 0;

  return {
    parseLine(line: string): ParseLineResult {
      lineNumber++;
      const result = parseSessionLine(line, lineNumber);

      if (result.success) {
        validLines++;
        const entry = result.entry;

        // Accumulate token usage
        if (entry.message?.usage) {
          totalInputTokens += entry.message.usage.input_tokens || 0;
          totalOutputTokens += entry.message.usage.output_tokens || 0;
          totalCacheReadTokens += entry.message.usage.cache_read_input_tokens || 0;
        }

        // Count compression events
        if (entry.type === 'summary') {
          compressionCount++;
        }
      } else {
        errorLines++;
      }

      return result;
    },

    getStats(): ParserStats {
      return {
        totalLines: lineNumber,
        validLines,
        errorLines,
        totalInputTokens,
        totalOutputTokens,
        totalCacheReadTokens,
        compressionCount,
      };
    },

    reset(): void {
      lineNumber = 0;
      validLines = 0;
      errorLines = 0;
      totalInputTokens = 0;
      totalOutputTokens = 0;
      totalCacheReadTokens = 0;
      compressionCount = 0;
    },
  };
}

/**
 * Parse a session file using streaming for memory efficiency.
 *
 * @param filePath - Path to the JSONL file
 * @param onEntry - Callback for each parsed entry
 * @param onError - Optional callback for parse errors
 */
export async function parseSessionFileStreaming(
  filePath: string,
  onEntry: (entry: SessionEntry) => void,
  onError?: (lineNumber: number, error: string) => void
): Promise<ParserStats> {
  const parser = createSessionParser();

  const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.trim() === '') continue;

    const result = parser.parseLine(line);
    if (result.success) {
      onEntry(result.entry);
    } else if (onError) {
      onError(result.lineNumber, result.error);
    }
  }

  return parser.getStats();
}
