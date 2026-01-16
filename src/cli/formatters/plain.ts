/**
 * EP04 CLI Interface - Plain Text Formatter
 *
 * Implements FR-013: Plain text output without colors or formatting.
 *
 * Provides unformatted plain text output suitable for piping to other
 * tools or for accessibility with screen readers.
 *
 * @module cli/formatters/plain
 */

/**
 * Finding data structure for plain text output.
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
 * Complete analysis result for plain text output.
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
 * Format a stream chunk as plain text.
 *
 * @param chunk - Stream chunk to format
 * @returns Plain text string
 */
export function formatStreamChunk(chunk: StreamChunk): string {
  switch (chunk.type) {
    case 'progress':
      return `[${chunk.phase}] ${chunk.message}`;

    case 'finding':
      return `[${chunk.finding.severity.toUpperCase()}] ${chunk.finding.id}: ${chunk.finding.title}`;

    case 'error':
      return `ERROR: ${chunk.error}`;

    case 'complete':
      return `Complete: ${chunk.summary.total} finding(s)`;
  }
}

/**
 * Format findings as plain text list.
 *
 * @param findings - Array of findings to format
 * @returns Plain text string
 */
export function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) {
    return 'No findings.';
  }

  const lines: string[] = [];

  for (const finding of findings) {
    const location = finding.location?.file
      ? ` (${finding.location.file}${finding.location.line ? `:${finding.location.line}` : ''})`
      : '';

    lines.push(`[${finding.severity.toUpperCase()}] ${finding.id}: ${finding.title}${location}`);
    lines.push(`  ${finding.description}`);
    if (finding.recommendation) {
      lines.push(`  Recommendation: ${finding.recommendation}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format a complete analysis result as plain text.
 *
 * @param result - Analysis result to format
 * @returns Plain text document string
 */
export function formatComplete(result: AnalysisResult): string {
  const lines: string[] = [];

  // Header
  lines.push('Analysis Report');
  lines.push('===============');
  lines.push('');
  lines.push(`Timestamp: ${result.timestamp}`);

  if (result.duration !== undefined) {
    lines.push(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
  }

  lines.push('');

  // Handle error status
  if (result.status === 'error') {
    lines.push('Status: ERROR');
    lines.push(`Error: ${result.error ?? 'An unknown error occurred'}`);
    lines.push('');
    return lines.join('\n');
  }

  // Summary
  lines.push('Summary');
  lines.push('-------');
  lines.push(`Total Findings: ${result.summary.total}`);
  lines.push('');

  if (result.summary.total === 0) {
    lines.push('No issues found.');
    lines.push('');
    return lines.join('\n');
  }

  // Severity breakdown
  if (Object.keys(result.summary.bySeverity).length > 0) {
    lines.push('By Severity:');
    for (const [severity, count] of Object.entries(result.summary.bySeverity)) {
      if (count > 0) {
        lines.push(`  ${severity}: ${count}`);
      }
    }
    lines.push('');
  }

  // Findings
  lines.push('Findings');
  lines.push('--------');
  lines.push(formatFindings(result.findings));

  return lines.join('\n');
}

/**
 * Plain text formatter class implementing the formatter interface.
 *
 * Provides both streaming and batch output methods for plain text format.
 */
export class PlainFormatter {
  /**
   * Formats a stream chunk for plain text output.
   *
   * @param chunk - The stream chunk to format
   * @returns Plain text string
   */
  formatChunk(chunk: StreamChunk): string {
    return formatStreamChunk(chunk);
  }

  /**
   * Formats a complete result as plain text.
   *
   * @param result - The complete analysis result
   * @returns Plain text document string
   */
  formatComplete(result: AnalysisResult): string {
    return formatComplete(result);
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
   */
  writeComplete(result: AnalysisResult): void {
    console.log(this.formatComplete(result));
  }
}

/**
 * Creates a new plain text formatter instance.
 *
 * @returns Plain text formatter
 */
export function createPlainFormatter(): PlainFormatter {
  return new PlainFormatter();
}
