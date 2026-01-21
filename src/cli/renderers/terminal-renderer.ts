/**
 * Terminal Stream Renderer
 *
 * Renders StreamChunks with rich terminal formatting including colors,
 * spinners for tool execution, and formatted findings.
 *
 * @module cli/renderers/terminal-renderer
 */

import ora, { type Ora } from 'ora';
import type { StreamChunk } from '../../orchestration/types';
import type { AnalyseFinding, AnalyseResult } from '../commands/analyse';
import type { IStreamRenderer } from './stream-renderer';
import { bold, colorByStatus, colorBySeverity, dim } from '../utils/colors';
import type { GlobalOptions } from '../types';

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
      console.log(`Duration:    ${result.durationMs}ms`);
    }

    console.log('');
    this.hasOutput = true;
  }

  /**
   * Flush output and clean up.
   */
  flush(): void {
    this.stopSpinner();
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private renderText(content: string): void {
    this.stopSpinner();
    // Stream text directly - this is the agent's reasoning
    process.stdout.write(content);
    this.hasOutput = true;
  }

  private renderToolStart(chunk: StreamChunk): void {
    const toolName = (chunk.metadata?.toolName as string) ?? 'tool';
    this.currentToolName = toolName;

    if (this.options.verbose) {
      // In verbose mode, show the tool call with a spinner
      this.stopSpinner();
      this.spinner = ora({
        text: `Calling ${toolName}...`,
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
      if (this.options.verbose) {
        this.spinner.succeed(`${toolName} completed`);
      } else {
        this.spinner.stop();
      }
      this.spinner = null;
    }
    this.currentToolName = null;

    // In debug mode, show the result
    if (this.options.debug && chunk.metadata?.result) {
      const result = chunk.metadata.result;
      const preview =
        typeof result === 'string' ? result.slice(0, 200) : JSON.stringify(result).slice(0, 200);
      console.log(dim(`  → ${preview}${preview.length >= 200 ? '...' : ''}`));
    }
  }

  private renderPhaseChange(chunk: StreamChunk): void {
    if (this.options.quiet) return;

    this.stopSpinner();
    const newPhase = (chunk.metadata?.newPhase as string) ?? chunk.content;
    console.log(colorByStatus(`\n▸ ${newPhase}`, 'info'));
    this.hasOutput = true;
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
