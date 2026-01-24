/**
 * CLI Renderers
 *
 * Provides different output renderers for the orchestrated analysis:
 * - HeadlessRenderer: Non-interactive output for CI/automation (default)
 * - JsonRenderer: JSON Lines (NDJSON) for scripting
 *
 * Note: Interactive TUI mode (InkRenderer) is handled separately in the
 * CLI commands when TTY is detected.
 *
 * @module cli/renderers
 */

export type { IStreamRenderer } from './stream-renderer';
export { JsonRenderer, createJsonRenderer } from './json-renderer';
export type { JsonRendererOptions, JsonEventType, JsonLine } from './json-renderer';

// Re-export TUI renderers for backwards compatibility
export { HeadlessRenderer, TuiStreamRenderer } from '../../tui';
export type { HeadlessRendererOptions } from '../../tui';

import type { OutputMode, GlobalOptions } from '../types';
import type { IStreamRenderer } from './stream-renderer';
import { createJsonRenderer } from './json-renderer';
import { HeadlessRenderer, TuiStreamRenderer, InkRenderer, determineRenderMode } from '../../tui';

/**
 * Create a headless renderer with options.
 *
 * @param options - CLI global options
 * @returns HeadlessRenderer wrapped in TuiStreamRenderer
 */
export function createHeadlessRenderer(options: GlobalOptions): IStreamRenderer {
  const headless = new HeadlessRenderer({
    verbose: options.verbose ?? false,
    quiet: options.quiet ?? false,
    json: false,
    colors: !process.env.NO_COLOR,
    denyAll: false,
  });
  return new TuiStreamRenderer(headless);
}

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

    case 'terminal': {
      // Use TTY detection to choose renderer
      const renderMode = determineRenderMode({
        nonInteractive: options.nonInteractive === true,
        json: false,
      });

      if (renderMode === 'ink') {
        const inkRenderer = new InkRenderer();
        return new TuiStreamRenderer(inkRenderer);
      }
      return createHeadlessRenderer(options);
    }

    case 'plain':
    case 'markdown':
      // Plain and markdown modes always use headless renderer
      return createHeadlessRenderer(options);

    default:
      return createHeadlessRenderer(options);
  }
}
