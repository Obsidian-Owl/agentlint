/**
 * EP04 CLI Interface - Output Mode Detection
 *
 * Implements FR-012: Auto-detect output mode based on TTY and flags.
 * Non-TTY (piped) contexts default to JSON for scripting.
 *
 * @module cli/utils/output
 */

import type { GlobalOptions, OutputFormat, OutputMode } from '../types';
import { supportsColor } from './colors';
import { getTerminalWidth } from './terminal';

/**
 * Determines the output mode based on CLI options and environment.
 *
 * Priority:
 * 1. Explicit flags (--json, --markdown, --plain)
 * 2. Non-TTY detection (piped output → JSON)
 * 3. NO_COLOR environment variable (→ plain)
 * 4. Default to terminal (rich Ink rendering)
 *
 * @param options - CLI options from command invocation
 * @returns The determined output mode
 */
export function getOutputMode(options: GlobalOptions): OutputMode {
  // Explicit flags take priority
  if (options.json) return 'json';
  if (options.markdown) return 'markdown';
  if (options.plain) return 'plain';

  // Non-TTY (piped) contexts default to JSON for scripting
  if (!process.stdout.isTTY) return 'json';

  // NO_COLOR environment variable for accessibility
  if (process.env['NO_COLOR']) return 'plain';

  // Default to rich terminal rendering
  return 'terminal';
}

/**
 * Builds a complete OutputFormat configuration.
 *
 * @param options - CLI options from command invocation
 * @returns Complete output format configuration
 */
export function getOutputFormat(options: GlobalOptions): OutputFormat {
  const mode = getOutputMode(options);
  const isTTY = process.stdout.isTTY ?? false;

  return {
    mode,
    isTTY,
    supportsColor: supportsColor(),
    terminalWidth: getTerminalWidth(),
  };
}

/**
 * Checks if the current output mode supports streaming.
 *
 * @param mode - Output mode to check
 * @returns True if mode supports streaming output
 */
export function supportsStreaming(mode: OutputMode): boolean {
  // Terminal and JSON support streaming (JSON Lines)
  // Markdown and plain are batch outputs
  return mode === 'terminal' || mode === 'json';
}
