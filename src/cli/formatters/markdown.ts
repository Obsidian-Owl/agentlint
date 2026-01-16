/**
 * EP04 CLI Interface - Markdown Formatter
 *
 * Implements FR-008: Output valid Markdown when --markdown flag is provided.
 *
 * Provides formatted Markdown output for findings, causal chains, and analysis
 * results suitable for documentation and reporting.
 *
 * @module cli/formatters/markdown
 */

/**
 * Finding data structure for Markdown output.
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
 * Complete analysis result for Markdown output.
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
 * Node in a causal chain tree.
 */
export interface CausalNode {
  id: string;
  type: 'finding' | 'origin' | 'root_cause' | 'recommendation';
  title: string;
  description?: string;
  children?: CausalNode[];
}

/**
 * Get severity indicator emoji.
 */
function getSeverityIndicator(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical':
      return '🔴';
    case 'high':
      return '🟠';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    case 'info':
      return 'ℹ️';
    default:
      return '⚪';
  }
}

/**
 * Get type label for causal node.
 */
function getTypeLabel(type: CausalNode['type']): string {
  const labels: Record<CausalNode['type'], string> = {
    finding: 'Finding',
    origin: 'Origin',
    root_cause: 'Root Cause',
    recommendation: 'Recommendation',
  };
  return labels[type];
}

/**
 * Format timestamp for display.
 */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Escape pipe characters for Markdown table cells.
 */
function escapeTableCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/**
 * Format findings as a Markdown table.
 *
 * @param findings - Array of findings to format
 * @returns Markdown table string
 */
export function formatFindings(findings: Finding[]): string {
  const lines: string[] = [];

  if (findings.length === 0) {
    lines.push('*No findings found.*');
    return lines.join('\n');
  }

  // Table header
  lines.push('| ID | Severity | Title | Location |');
  lines.push('|-----|----------|-------|----------|');

  // Table rows
  for (const finding of findings) {
    const severity = `${getSeverityIndicator(finding.severity)} ${finding.severity}`;
    const location = finding.location?.file
      ? `${finding.location.file}${finding.location.line ? `:${finding.location.line}` : ''}`
      : '-';

    lines.push(
      `| ${finding.id} | ${escapeTableCell(severity)} | ${escapeTableCell(finding.title)} | ${escapeTableCell(location)} |`
    );
  }

  return lines.join('\n');
}

/**
 * Format a causal chain as a nested Markdown list.
 *
 * @param node - Root node of the causal chain
 * @param indent - Current indentation level
 * @returns Markdown nested list string
 */
export function formatCausalChain(node: CausalNode, indent: number = 0): string {
  const lines: string[] = [];
  const prefix = '  '.repeat(indent);
  const label = getTypeLabel(node.type);

  lines.push(`${prefix}- **[${label}]** ${node.title}`);

  if (node.description) {
    lines.push(`${prefix}  - ${node.description}`);
  }

  if (node.children) {
    for (const child of node.children) {
      lines.push(formatCausalChain(child, indent + 1));
    }
  }

  return lines.join('\n');
}

/**
 * Format a stream chunk as Markdown.
 *
 * @param chunk - Stream chunk to format
 * @returns Markdown string
 */
export function formatStreamChunk(chunk: StreamChunk): string {
  switch (chunk.type) {
    case 'progress':
      return `> **${chunk.phase}**: ${chunk.message}`;

    case 'finding':
      return `- ${getSeverityIndicator(chunk.finding.severity)} **${chunk.finding.title}** (${chunk.finding.id})`;

    case 'error':
      return `> ⚠️ **Error**: ${chunk.error}`;

    case 'complete':
      return `\n**Analysis complete**: ${chunk.summary.total} finding(s)`;
  }
}

/**
 * Format a complete analysis result as Markdown.
 *
 * @param result - Analysis result to format
 * @returns Markdown document string
 */
export function formatComplete(result: AnalysisResult): string {
  const lines: string[] = [];

  // Header
  lines.push('# Analysis Report');
  lines.push('');
  lines.push(`**Generated**: ${formatTimestamp(result.timestamp)}`);

  if (result.duration !== undefined) {
    lines.push(`**Duration**: ${(result.duration / 1000).toFixed(2)}s`);
  }

  lines.push('');

  // Handle error status
  if (result.status === 'error') {
    lines.push('## Error');
    lines.push('');
    lines.push(`> ${result.error ?? 'An unknown error occurred'}`);
    lines.push('');
    return lines.join('\n');
  }

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`**Total Findings**: ${result.summary.total}`);
  lines.push('');

  if (result.summary.total === 0) {
    lines.push('✅ No issues found. Your configuration looks good!');
    lines.push('');
    return lines.join('\n');
  }

  // Severity breakdown
  if (Object.keys(result.summary.bySeverity).length > 0) {
    lines.push('### By Severity');
    lines.push('');
    lines.push('| Severity | Count |');
    lines.push('|----------|-------|');
    for (const [severity, count] of Object.entries(result.summary.bySeverity)) {
      if (count > 0) {
        lines.push(`| ${getSeverityIndicator(severity)} ${severity} | ${count} |`);
      }
    }
    lines.push('');
  }

  // Findings
  lines.push('## Findings');
  lines.push('');
  lines.push(formatFindings(result.findings));
  lines.push('');

  // Detailed findings
  if (result.findings.length > 0) {
    lines.push('## Details');
    lines.push('');
    for (const finding of result.findings) {
      lines.push(`### ${finding.id}: ${finding.title}`);
      lines.push('');
      lines.push(`**Severity**: ${getSeverityIndicator(finding.severity)} ${finding.severity}`);
      lines.push('');
      lines.push(finding.description);
      lines.push('');
      if (finding.location?.file) {
        lines.push(
          `**Location**: \`${finding.location.file}${finding.location.line ? `:${finding.location.line}` : ''}\``
        );
        lines.push('');
      }
      if (finding.recommendation) {
        lines.push(`**Recommendation**: ${finding.recommendation}`);
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Markdown formatter class implementing the formatter interface.
 *
 * Provides both streaming and batch output methods for Markdown format.
 */
export class MarkdownFormatter {
  /**
   * Formats a stream chunk for Markdown output.
   *
   * @param chunk - The stream chunk to format
   * @returns Markdown string
   */
  formatChunk(chunk: StreamChunk): string {
    return formatStreamChunk(chunk);
  }

  /**
   * Formats a complete result as Markdown.
   *
   * @param result - The complete analysis result
   * @returns Markdown document string
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
 * Creates a new Markdown formatter instance.
 *
 * @returns Markdown formatter
 */
export function createMarkdownFormatter(): MarkdownFormatter {
  return new MarkdownFormatter();
}
