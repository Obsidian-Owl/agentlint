/**
 * TUI Stream Renderer Adapter
 *
 * Adapts ITuiRenderer to IStreamRenderer interface, allowing the TUI
 * to integrate with the existing orchestration system.
 *
 * @module tui/renderers/tui-stream-renderer
 */

import type { IStreamRenderer } from '../../cli/renderers/stream-renderer';
import type { ITuiRenderer } from '../types';
import type { StreamChunk } from '../../orchestration/types';
import type { AnalyseFinding, AnalyseResult } from '../../cli/commands/analyse';

// =============================================================================
// TuiStreamRenderer
// =============================================================================

/**
 * Adapter that bridges ITuiRenderer to IStreamRenderer.
 *
 * This allows the TUI renderers (InkRenderer, HeadlessRenderer) to be
 * used wherever IStreamRenderer is expected.
 */
export class TuiStreamRenderer implements IStreamRenderer {
  private tuiRenderer: ITuiRenderer;

  constructor(tuiRenderer: ITuiRenderer) {
    this.tuiRenderer = tuiRenderer;
  }

  /**
   * Render a stream chunk.
   */
  renderChunk(chunk: StreamChunk): void {
    this.tuiRenderer.renderChunk(chunk);
  }

  /**
   * Render a finding.
   *
   * Converts the finding to a StreamChunk and delegates to the TUI renderer.
   */
  renderFinding(finding: AnalyseFinding): void {
    const chunk: StreamChunk = {
      type: 'finding',
      level: 'normal',
      content: `${finding.severity.toUpperCase()}: ${finding.title ?? finding.id}`,
      timestamp: new Date().toISOString(),
      metadata: {
        finding: {
          id: finding.id,
          type: finding.type,
          severity: finding.severity,
          title: finding.title,
          description: finding.description,
          location: finding.location,
          origin: finding.origin,
        },
      },
    };
    this.tuiRenderer.renderChunk(chunk);
  }

  /**
   * Render an error.
   *
   * Converts the error to a StreamChunk and delegates to the TUI renderer.
   */
  renderError(error: Error): void {
    const chunk: StreamChunk = {
      type: 'error',
      level: 'normal',
      content: error.message,
      timestamp: new Date().toISOString(),
      metadata: {
        name: error.name,
        stack: error.stack,
      },
    };
    this.tuiRenderer.renderChunk(chunk);
  }

  /**
   * Render completion.
   */
  renderComplete(result: AnalyseResult): void {
    this.tuiRenderer.renderComplete(result);
  }

  /**
   * Flush output.
   *
   * Currently a no-op for TUI renderers as they render immediately.
   */
  flush(): void {
    // TUI renderers don't buffer, so nothing to flush
  }
}
