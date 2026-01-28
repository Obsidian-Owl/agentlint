/**
 * JSON Stream Renderer
 *
 * Renders StreamChunks as JSON Lines (NDJSON) for scripting and piping.
 * Each line is a complete JSON object.
 *
 * @module cli/renderers/json-renderer
 */

import type { StreamChunk } from '../../orchestration/types';
import type { AnalyseFinding, AnalyseResult } from '../commands/analyse';
import type { IStreamRenderer } from './stream-renderer';
import type { GlobalOptions } from '../types';

/**
 * JSON Line event types.
 */
export type JsonEventType =
  | 'chunk'
  | 'finding'
  | 'error'
  | 'complete'
  | 'tool_start'
  | 'tool_result'
  | 'text'
  | 'status';

/**
 * JSON Line structure for streaming output.
 */
export interface JsonLine {
  type: JsonEventType;
  timestamp: string;
  data: unknown;
}

/**
 * Options for the JsonRenderer.
 */
export interface JsonRendererOptions {
  /** Whether to include all chunk types (default: false - only key events) */
  verbose?: boolean;
  /** Pretty-print JSON (default: false for NDJSON compatibility) */
  pretty?: boolean;
}

/**
 * JSON renderer for NDJSON streaming output.
 *
 * Features:
 * - Outputs one JSON object per line
 * - Suitable for piping to jq or other tools
 * - Includes timestamps for all events
 * - In non-verbose mode, filters to key events only
 */
export class JsonRenderer implements IStreamRenderer {
  private readonly options: JsonRendererOptions;

  constructor(options: JsonRendererOptions = {}) {
    this.options = options;
  }

  /**
   * Render a StreamChunk as a JSON line.
   */
  renderChunk(chunk: StreamChunk): void {
    // In non-verbose mode, only output key events
    if (!this.options.verbose) {
      // Skip tool_result and checkpoint in non-verbose mode
      if (chunk.type === 'tool_result' || chunk.type === 'checkpoint') {
        return;
      }
    }

    const line: JsonLine = {
      type: this.mapChunkType(chunk.type),
      timestamp: chunk.timestamp,
      data: {
        content: chunk.content,
        level: chunk.level,
        ...(chunk.metadata && { metadata: chunk.metadata }),
      },
    };

    this.writeLine(line);
  }

  /**
   * Render a finding as a JSON line.
   */
  renderFinding(finding: AnalyseFinding): void {
    const line: JsonLine = {
      type: 'finding',
      timestamp: new Date().toISOString(),
      data: finding,
    };

    this.writeLine(line);
  }

  /**
   * Render an error as a JSON line.
   */
  renderError(error: Error): void {
    const line: JsonLine = {
      type: 'error',
      timestamp: new Date().toISOString(),
      data: {
        message: error.message,
        name: error.name,
      },
    };

    this.writeLine(line);
  }

  /**
   * Render the final result as a JSON line.
   */
  renderComplete(result: AnalyseResult): void {
    const line: JsonLine = {
      type: 'complete',
      timestamp: new Date().toISOString(),
      data: result,
    };

    this.writeLine(line);
  }

  /**
   * Flush output (no-op for JSON renderer).
   */
  flush(): void {
    // JSON Lines are written immediately, nothing to flush
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private mapChunkType(chunkType: StreamChunk['type']): JsonEventType {
    switch (chunkType) {
      case 'text':
        return 'text';
      case 'tool_start':
        return 'tool_start';
      case 'tool_result':
        return 'tool_result';
      case 'finding':
        return 'finding';
      case 'status':
        return 'status';
      case 'error':
        return 'error';
      default:
        return 'chunk';
    }
  }

  private writeLine(line: JsonLine): void {
    const json = this.options.pretty ? JSON.stringify(line, null, 2) : JSON.stringify(line);

    console.log(json);
  }
}

/**
 * Create a JSON renderer from CLI options.
 *
 * @param options - CLI global options
 * @returns Configured JsonRenderer
 */
export function createJsonRenderer(options: GlobalOptions): JsonRenderer {
  const rendererOpts: JsonRendererOptions = { pretty: false };
  if (options.verbose !== undefined) rendererOpts.verbose = options.verbose;
  return new JsonRenderer(rendererOpts);
}
