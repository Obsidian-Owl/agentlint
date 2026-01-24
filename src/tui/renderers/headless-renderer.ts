/**
 * HeadlessRenderer - Non-interactive TUI Renderer
 *
 * Implements ITuiRenderer for --non-interactive mode.
 * Outputs to stdout/stderr without interactive UI.
 *
 * @module tui/renderers/headless-renderer
 */

import type { ITuiRenderer, AppProps, PermissionDecision } from '../types';
import type { StreamChunk } from '../../orchestration/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for HeadlessRenderer.
 */
export interface HeadlessRendererOptions {
  /** Output JSON instead of plain text */
  json?: boolean;
  /** Suppress verbose output */
  quiet?: boolean;
  /** Enable verbose output */
  verbose?: boolean;
  /** Auto-deny all permission requests */
  denyAll?: boolean;
  /** Enable colored output */
  colors?: boolean;
}

// =============================================================================
// HeadlessRenderer
// =============================================================================

/**
 * Headless renderer for non-interactive mode.
 *
 * Outputs chunks to stdout, optionally as JSON.
 * Auto-approves or auto-denies permission requests.
 */
export class HeadlessRenderer implements ITuiRenderer {
  private options: HeadlessRendererOptions;
  private running = false;

  constructor(options: HeadlessRendererOptions = {}) {
    this.options = options;
  }

  /**
   * Start the renderer.
   */
  start(_props: AppProps): void {
    this.running = true;
  }

  /**
   * Stop the renderer.
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Render a stream chunk.
   */
  renderChunk(chunk: StreamChunk): void {
    if (!this.running) {
      return;
    }

    // Suppress verbose output in quiet mode
    if (this.options.quiet && chunk.level === 'verbose') {
      return;
    }

    if (this.options.json) {
      this.outputJson({ ...chunk });
      return;
    }

    // Plain text output based on chunk type
    switch (chunk.type) {
      case 'text':
        console.log(chunk.content);
        break;

      case 'tool_start':
        if (!this.options.quiet) {
          const toolName = (chunk.metadata?.toolName as string) ?? 'unknown';
          console.log(`[tool] ${toolName}`);
        }
        break;

      case 'tool_result':
        if (!this.options.quiet) {
          const toolName = (chunk.metadata?.toolName as string) ?? 'unknown';
          const success = (chunk.metadata?.success as boolean) ?? true;
          console.log(`[result] ${toolName}: ${success ? 'success' : 'failed'}`);
        }
        break;

      case 'error':
        console.error(`[error] ${chunk.content}`);
        break;

      case 'finding':
        console.log(`[finding] ${chunk.content}`);
        break;

      case 'phase_change':
        if (!this.options.quiet) {
          console.log(`[phase] ${chunk.content}`);
        }
        break;

      case 'checkpoint':
        if (!this.options.quiet && this.options.verbose) {
          console.log(`[checkpoint] ${chunk.content}`);
        }
        break;

      case 'status':
        if (!this.options.quiet) {
          console.log(`[status] ${chunk.content}`);
        }
        break;

      case 'user_question':
        console.log(`[question] ${chunk.content}`);
        break;

      default:
        // Unknown chunk type - output as-is in verbose mode
        if (!this.options.quiet && this.options.verbose) {
          console.log(`[chunk] ${chunk.content}`);
        }
    }
  }

  /**
   * Render completion.
   */
  renderComplete(result: unknown): void {
    if (!this.running) {
      return;
    }

    if (this.options.json) {
      this.outputJson({
        type: 'complete',
        result,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Plain text completion
    if (!this.options.quiet) {
      console.log('[complete]');
    }
  }

  /**
   * Request permission.
   *
   * In headless mode, auto-approves (or auto-denies if denyAll is set).
   */
  requestPermission(request: {
    tool: string;
    description: string;
    pattern?: string;
  }): Promise<PermissionDecision> {
    const allowed = !this.options.denyAll;

    const decision: PermissionDecision = {
      allowed,
      scope: 'session',
      grantedAt: new Date().toISOString(),
      tool: request.tool,
      pattern: request.pattern ?? null,
    };

    if (!this.options.quiet) {
      if (this.options.json) {
        this.outputJson({
          type: 'permission',
          request,
          decision,
        });
      } else {
        console.log(`[permission] ${request.tool}: ${allowed ? 'auto-approved' : 'auto-denied'}`);
      }
    }

    return Promise.resolve(decision);
  }

  /**
   * Output JSON to stdout.
   */
  private outputJson(data: unknown): void {
    console.log(JSON.stringify(data));
  }
}
