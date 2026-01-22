/**
 * CLI Renderers
 *
 * Provides different output renderers for the orchestrated analysis:
 * - TerminalRenderer: Rich terminal output with colors and spinners
 * - JsonRenderer: JSON Lines (NDJSON) for scripting
 *
 * @module cli/renderers
 */

export type { IStreamRenderer } from './stream-renderer';
export { TerminalRenderer, createTerminalRenderer } from './terminal-renderer';
export type { TerminalRendererOptions } from './terminal-renderer';
export { JsonRenderer, createJsonRenderer } from './json-renderer';
export type { JsonRendererOptions, JsonEventType, JsonLine } from './json-renderer';

import type { OutputMode, GlobalOptions } from '../types';
import type { IStreamRenderer } from './stream-renderer';
import { createTerminalRenderer } from './terminal-renderer';
import { createJsonRenderer } from './json-renderer';

/**
 * Create a renderer based on output mode and options.
 *
 * @param mode - The output mode (terminal, json, markdown, plain)
 * @param options - CLI global options
 * @returns Appropriate renderer for the mode
 */
export function createRenderer(mode: OutputMode, options: GlobalOptions): IStreamRenderer {
  switch (mode) {
    case 'json':
      return createJsonRenderer(options);

    case 'terminal':
    case 'plain':
    case 'markdown':
      // All non-JSON modes use terminal renderer
      // Plain mode will have colors disabled via environment
      // Markdown mode falls back to terminal for now
      return createTerminalRenderer(options);

    default:
      return createTerminalRenderer(options);
  }
}
