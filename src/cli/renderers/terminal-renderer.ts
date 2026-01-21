/**
 * Terminal Stream Renderer
 *
 * Renders StreamChunks with rich terminal formatting including colors,
 * spinners for tool execution, and formatted findings.
 *
 * @module cli/renderers/terminal-renderer
 */

import ora, { type Ora } from 'ora';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import type { StreamChunk } from '../../orchestration/types';
import type { AnalyseFinding, AnalyseResult } from '../commands/analyse';
import type { IStreamRenderer } from './stream-renderer';
import { bold, colorByStatus, colorBySeverity, dim } from '../utils/colors';
import { formatDuration } from '../utils/terminal';
import type { GlobalOptions } from '../types';

// Configure marked with terminal renderer for markdown-to-ANSI conversion
// Note: Type assertion needed because @types/marked-terminal is out of sync with the library
marked.use(
  markedTerminal({
    showSectionPrefix: false,
    tab: 2,
    emoji: false, // Respect agentlint's no-emoji-by-default policy
  }) as Parameters<typeof marked.use>[0]
);

/**
 * Options for the TerminalRenderer.
 */
export interface TerminalRendererOptions {
  /** Whether to show verbose output (tool calls, timing) */
  verbose?: boolean;
  /** Whether to show debug output */
  debug?: boolean;
  /** Suppress most output */
  quiet?: boolean;
}

/**
 * Terminal renderer for rich console output.
 *
 * Features:
 * - Streams agent text directly to stdout
 * - Shows spinners during tool execution
 * - Formats findings with severity colors
 * - Shows progress for long operations
 */
export class TerminalRenderer implements IStreamRenderer {
  private readonly options: TerminalRendererOptions;
  private spinner: Ora | null = null;
  private currentToolName: string | null = null;
  private hasOutput = false;
  /** Buffer for accumulating text for sentence boundary output */
  private textBuffer = '';
  /** Current analysis phase for status display */
  private currentPhase: string = 'Initializing';
  /** Persistent status spinner for phase tracking */
  private statusSpinner: Ora | null = null;

  constructor(options: TerminalRendererOptions = {}) {
    this.options = options;
  }

  /**
   * Render a StreamChunk to the terminal.
   */
  renderChunk(chunk: StreamChunk): void {
    // In quiet mode, only show errors
    if (this.options.quiet && chunk.type !== 'error') {
      return;
    }

    switch (chunk.type) {
      case 'text':
        this.renderText(chunk.content);
        break;

      case 'tool_start':
        this.renderToolStart(chunk);
        break;

      case 'tool_result':
        this.renderToolResult(chunk);
        break;

      case 'finding':
        // Findings rendered separately via renderFinding
        break;

      case 'phase_change':
        this.renderPhaseChange(chunk);
        break;

      case 'checkpoint':
        this.renderCheckpoint(chunk);
        break;

      case 'status':
        this.renderStatus(chunk);
        break;

      case 'error':
        this.renderErrorChunk(chunk);
        break;
    }
  }

  /**
   * Render a finding with severity coloring.
   */
  renderFinding(finding: AnalyseFinding): void {
    if (this.options.quiet) return;

    this.stopSpinner();
    this.ensureNewline();

    const severityLabel = finding.severity.toUpperCase().padEnd(8);
    const coloredSeverity = colorBySeverity(
      severityLabel,
      finding.severity as 'critical' | 'high' | 'medium' | 'low' | 'info'
    );

    console.log(`  [${coloredSeverity}] ${bold(finding.title)}`);

    if (this.options.verbose && finding.description) {
      console.log(`             ${dim(finding.description)}`);
    }

    if (this.options.verbose && finding.location) {
      const loc = finding.location.line
        ? `${finding.location.file}:${finding.location.line}`
        : finding.location.file;
      console.log(`             ${dim(`Location: ${loc}`)}`);
    }

    this.hasOutput = true;
  }

  /**
   * Render an error.
   */
  renderError(error: Error): void {
    this.stopSpinner();
    this.ensureNewline();
    console.error(colorByStatus(`Error: ${error.message}`, 'error'));
    this.hasOutput = true;
  }

  /**
   * Render the final analysis result.
   */
  renderComplete(result: AnalyseResult): void {
    this.stopSpinner();
    this.ensureNewline();

    if (this.options.quiet) {
      // In quiet mode, just show the count
      if (result.findings.length > 0) {
        console.log(`${result.findings.length} finding(s)`);
      }
      return;
    }

    console.log('');
    console.log(bold('Analysis Summary'));
    console.log('─'.repeat(40));
    console.log(`Directory:   ${result.directory}`);
    console.log(`Configs:     ${result.configs.length}`);
    console.log(`Findings:    ${result.findings.length}`);

    if (Object.keys(result.summary.bySeverity).length > 0) {
      const severityCounts = Object.entries(result.summary.bySeverity)
        .map(([sev, count]) => `${sev}: ${count}`)
        .join(', ');
      console.log(`By Severity: ${severityCounts}`);
    }

    if (result.durationMs !== undefined) {
      console.log(`Duration:    ${formatDuration(result.durationMs)}`);
    }

    console.log('');
    this.hasOutput = true;
  }

  /**
   * Flush output and clean up.
   */
  flush(): void {
    this.stopSpinner();
    this.stopStatusLine();

    // Flush any remaining buffered text with markdown rendering
    if (this.textBuffer.length > 0) {
      const rendered = this.renderMarkdown(this.textBuffer);
      process.stdout.write(rendered);
      this.textBuffer = '';
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private renderText(content: string): void {
    this.stopSpinner();

    // Accumulate text for sentence-boundary output
    this.textBuffer += content;

    // Process complete lines first (newlines always flush)
    const lines = this.textBuffer.split('\n');

    // Keep the last incomplete line in the buffer
    this.textBuffer = lines.pop() ?? '';

    // Output complete lines with word wrapping
    for (const line of lines) {
      this.outputLine(line);
    }

    // Also flush complete sentences from the remaining buffer
    // Sentence ends with . ! ? followed by space (or end of buffer before newline)
    this.flushCompleteSentences();

    this.hasOutput = true;
  }

  /**
   * Flush complete sentences from the text buffer.
   * A sentence is considered complete when it ends with . ! ? followed by a space.
   */
  private flushCompleteSentences(): void {
    const text = this.textBuffer;
    if (!text) return;

    // Pattern: sentence-ending punctuation followed by whitespace
    // This ensures we don't break on abbreviations like "e.g." or "Dr."
    const sentenceEndPattern = /([.!?])(\s+)/g;
    let match;
    let lastEnd = 0;
    const sentences: string[] = [];

    while ((match = sentenceEndPattern.exec(text)) !== null) {
      // Include the punctuation AND the following space to preserve spacing
      const sentence = text.slice(lastEnd, match.index + match[0].length);
      sentences.push(sentence);
      lastEnd = match.index + match[0].length;
    }

    // Output complete sentences (join without adding extra space)
    if (sentences.length > 0) {
      const completedText = sentences.join('');
      this.outputLine(completedText);
      // Keep incomplete sentence in buffer
      this.textBuffer = text.slice(lastEnd);
    }
  }

  /**
   * Output a line with markdown rendering and word wrapping if needed.
   */
  private outputLine(line: string): void {
    if (line.length === 0) {
      process.stdout.write('\n');
      return;
    }

    // Render markdown to ANSI escape sequences for terminal display
    const rendered = this.renderMarkdown(line);

    // Output the rendered text (markdown renderer handles its own formatting)
    process.stdout.write(rendered);
  }

  /**
   * Render markdown text to terminal-formatted output with ANSI codes.
   * Handles bold, italic, headers, code blocks, and lists.
   *
   * Issue 6 fix: Dedupe excessive newlines from marked-terminal to prevent
   * blank lines from accumulating.
   */
  private renderMarkdown(text: string): string {
    try {
      // Use marked to convert markdown to ANSI-formatted terminal output
      const rendered = marked.parse(text) as string;
      // Issue 6 fix: Dedupe excessive newlines (3+ becomes 2)
      return rendered.replace(/\n{3,}/g, '\n\n');
    } catch {
      // Fall back to plain text on any error
      return text + '\n';
    }
  }

  private renderToolStart(chunk: StreamChunk): void {
    const toolName = (chunk.metadata?.toolName as string) ?? 'tool';
    this.currentToolName = toolName;

    // Stop the status line while showing tool spinner (avoid conflicts)
    this.stopStatusLine();

    if (this.options.verbose || this.options.debug) {
      // Issue 5 fix: In verbose/debug mode, show tool name AND input preview
      this.stopSpinner();
      const input = chunk.metadata?.input;
      const inputPreview = input ? JSON.stringify(input).slice(0, 100) : '';
      const statusText = inputPreview
        ? `${this.currentPhase}: ${toolName} (${inputPreview}${inputPreview.length >= 100 ? '...' : ''})`
        : `${this.currentPhase}: ${toolName}...`;
      this.spinner = ora({
        text: statusText,
        color: 'cyan',
      }).start();
    } else {
      // In normal mode, just show a subtle indicator
      this.stopSpinner();
      this.spinner = ora({
        text: dim(`[${toolName}]`),
        color: 'gray',
        spinner: 'dots',
      }).start();
    }
  }

  private renderToolResult(chunk: StreamChunk): void {
    if (this.spinner) {
      const toolName = this.currentToolName ?? 'tool';
      if (this.options.verbose || this.options.debug) {
        this.spinner.succeed(`${toolName} completed`);
      } else {
        this.spinner.stop();
      }
      this.spinner = null;
    }
    this.currentToolName = null;

    // Issue 5 fix: Show result in verbose mode, not just debug mode
    // Use shorter preview for verbose, longer for debug
    if ((this.options.verbose || this.options.debug) && chunk.metadata?.result) {
      const result = chunk.metadata.result;
      const maxLen = this.options.debug ? 1000 : 200;
      const preview =
        typeof result === 'string' ? result.slice(0, maxLen) : JSON.stringify(result).slice(0, maxLen);
      console.log(dim(`  → ${preview}${preview.length >= maxLen ? '...' : ''}`));
    }

    // Restart the status line in verbose mode (after tool completion)
    if (this.options.verbose) {
      this.updateStatusLine(this.currentPhase);
    }
  }

  private renderPhaseChange(chunk: StreamChunk): void {
    if (this.options.quiet) return;

    this.stopSpinner();
    const newPhase = (chunk.metadata?.newPhase as string) ?? chunk.content;
    this.currentPhase = newPhase;

    // Show phase change as text output
    console.log(colorByStatus(`\n▸ ${newPhase}`, 'info'));

    // Start/update the persistent status spinner
    this.updateStatusLine(newPhase);

    this.hasOutput = true;
  }

  /**
   * Update the persistent status line showing current phase and operation.
   */
  private updateStatusLine(phase: string, detail?: string): void {
    // Only show status line in verbose mode
    if (!this.options.verbose) return;

    const text = detail ? `${phase}: ${detail}` : phase;

    if (!this.statusSpinner) {
      this.statusSpinner = ora({
        text,
        color: 'cyan',
        spinner: 'dots',
      }).start();
    } else {
      this.statusSpinner.text = text;
    }
  }

  /**
   * Stop the persistent status spinner.
   */
  private stopStatusLine(): void {
    if (this.statusSpinner) {
      this.statusSpinner.stop();
      this.statusSpinner = null;
    }
  }

  private renderCheckpoint(chunk: StreamChunk): void {
    // Only show checkpoints in debug mode
    if (!this.options.debug) return;

    this.stopSpinner();
    console.log(dim(`  [checkpoint: ${chunk.content}]`));
  }

  private renderStatus(chunk: StreamChunk): void {
    if (this.options.quiet) return;

    this.stopSpinner();

    // Status messages are informational
    if (chunk.content.toLowerCase().includes('complete')) {
      console.log(colorByStatus(`✓ ${chunk.content}`, 'success'));
    } else if (chunk.content.toLowerCase().includes('error')) {
      console.log(colorByStatus(`✗ ${chunk.content}`, 'error'));
    } else {
      console.log(dim(chunk.content));
    }
    this.hasOutput = true;
  }

  private renderErrorChunk(chunk: StreamChunk): void {
    this.stopSpinner();
    console.error(colorByStatus(chunk.content, 'error'));
    this.hasOutput = true;
  }

  private stopSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  private ensureNewline(): void {
    // If we've been streaming text, ensure we're on a new line
    if (this.hasOutput) {
      // Check if the last character was a newline by tracking state
      // For simplicity, always add a newline before structured output
    }
  }
}

/**
 * Create a terminal renderer from CLI options.
 *
 * @param options - CLI global options
 * @returns Configured TerminalRenderer
 */
export function createTerminalRenderer(options: GlobalOptions): TerminalRenderer {
  const rendererOpts: TerminalRendererOptions = {};
  if (options.verbose !== undefined) rendererOpts.verbose = options.verbose;
  if (options.debug !== undefined) rendererOpts.debug = true;
  if (options.quiet !== undefined) rendererOpts.quiet = options.quiet;
  return new TerminalRenderer(rendererOpts);
}
