/**
 * EP04 CLI Interface - JSON Formatter
 *
 * Implements FR-004: Output valid JSON when --json flag is provided.
 * Implements FR-012: Default to JSON output when stdout is not a TTY.
 *
 * Provides both streaming (JSON Lines) and complete JSON output formats.
 *
 * @module cli/formatters/json
 */

/**
 * Finding data structure for JSON output.
 */
export interface Finding {
  id: string;
  severity: string;
  title: string;
  description: string;
  location?: {
    file?: string;
    line?: number;
  };
  recommendation?: string;
}

/**
 * Stream chunk types for real-time output.
 */
export interface ProgressChunk {
  type: 'progress';
  phase: string;
  message: string;
  timestamp: string;
  percent?: number;
}

export interface FindingChunk {
  type: 'finding';
  finding: Finding;
  timestamp: string;
}

export interface ErrorChunk {
  type: 'error';
  error: string;
  timestamp: string;
}

export interface CompleteChunk {
  type: 'complete';
  summary: {
    total: number;
    bySeverity: Record<string, number>;
  };
  timestamp: string;
}

export type StreamChunk = ProgressChunk | FindingChunk | ErrorChunk | CompleteChunk;

/**
 * Complete analysis result for batch JSON output.
 */
export interface AnalysisResult {
  status: 'success' | 'error';
  error?: string;
  findings: Finding[];
  summary: {
    total: number;
    bySeverity: Record<string, number>;
  };
  timestamp: string;
  duration?: number;
}

/**
 * Options for JSON formatting.
 */
export interface FormatOptions {
  /** Output compact JSON (no indentation) */
  compact?: boolean;
}

/**
 * Formats a stream chunk as a JSON line (for JSON Lines streaming).
 *
 * JSON Lines format outputs one JSON object per line, enabling
 * real-time processing by consumers like `jq -c`.
 *
 * @param chunk - The stream chunk to format
 * @returns JSON string (without trailing newline)
 */
export function formatStreamChunk(chunk: StreamChunk): string {
  return JSON.stringify(chunk);
}

/**
 * Formats a complete analysis result as JSON.
 *
 * By default, outputs pretty-printed JSON with 2-space indentation.
 * Use `{ compact: true }` for single-line output.
 *
 * @param result - The complete analysis result
 * @param options - Formatting options
 * @returns Formatted JSON string
 */
export function formatComplete(result: AnalysisResult, options: FormatOptions = {}): string {
  if (options.compact) {
    return JSON.stringify(result);
  }
  return JSON.stringify(result, null, 2);
}

/**
 * JSON formatter class implementing the formatter interface.
 *
 * Provides both streaming and batch output methods for JSON format.
 */
export class JSONFormatter {
  /**
   * Formats a stream chunk for JSON Lines output.
   *
   * @param chunk - The stream chunk to format
   * @returns JSON string (without trailing newline)
   */
  formatChunk(chunk: StreamChunk): string {
    return formatStreamChunk(chunk);
  }

  /**
   * Formats a complete result as JSON.
   *
   * @param result - The complete analysis result
   * @param options - Formatting options
   * @returns Formatted JSON string
   */
  formatComplete(result: AnalysisResult, options: FormatOptions = {}): string {
    return formatComplete(result, options);
  }

  /**
   * Writes a stream chunk to stdout with newline.
   *
   * @param chunk - The stream chunk to write
   */
  writeChunk(chunk: StreamChunk): void {
    console.log(this.formatChunk(chunk));
  }

  /**
   * Writes a complete result to stdout.
   *
   * @param result - The complete analysis result
   * @param options - Formatting options
   */
  writeComplete(result: AnalysisResult, options: FormatOptions = {}): void {
    console.log(this.formatComplete(result, options));
  }
}

/**
 * Creates a new JSON formatter instance.
 *
 * @returns JSON formatter
 */
export function createJSONFormatter(): JSONFormatter {
  return new JSONFormatter();
}
