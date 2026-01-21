/**
 * Stream Renderer Interface
 *
 * Defines the contract for rendering StreamChunks and analysis results
 * in different output formats (terminal, JSON, etc.).
 *
 * @module cli/renderers/stream-renderer
 */

import type { StreamChunk } from '../../orchestration/types';
import type { AnalyseFinding, AnalyseResult } from '../commands/analyse';

/**
 * Interface for rendering orchestrated analysis output.
 *
 * Implementations handle different output modes:
 * - TerminalRenderer: Rich terminal output with colors and spinners
 * - JsonRenderer: JSON Lines (NDJSON) for scripting
 */
export interface IStreamRenderer {
  /**
   * Render a single StreamChunk from the orchestrator.
   * Called for each chunk yielded during analysis.
   *
   * @param chunk - The chunk to render
   */
  renderChunk(chunk: StreamChunk): void;

  /**
   * Render a finding discovered during analysis.
   *
   * @param finding - The finding to render
   */
  renderFinding(finding: AnalyseFinding): void;

  /**
   * Render an error that occurred during analysis.
   *
   * @param error - The error to render
   */
  renderError(error: Error): void;

  /**
   * Render the final analysis result.
   *
   * @param result - The complete analysis result
   */
  renderComplete(result: AnalyseResult): void;

  /**
   * Flush any buffered output and clean up resources.
   * Should be called when analysis completes or is interrupted.
   */
  flush(): void;
}
