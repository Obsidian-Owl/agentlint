/**
 * TTY Detection Utilities
 *
 * Utilities for detecting if the terminal is a TTY and supports
 * interactive features.
 *
 * @module tui/utils/tty
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Terminal capabilities.
 */
export interface TerminalCapabilities {
  /** Whether stdin is a TTY */
  isInputTTY: boolean;
  /** Whether stdout is a TTY */
  isOutputTTY: boolean;
  /** Whether both stdin and stdout are TTYs (fully interactive) */
  isInteractive: boolean;
  /** Whether the terminal supports colors */
  supportsColor: boolean;
  /** Terminal width in columns */
  columns: number;
  /** Terminal height in rows */
  rows: number;
}

// =============================================================================
// Detection
// =============================================================================

/**
 * Check if stdin is a TTY.
 */
export function isInputTTY(): boolean {
  return Boolean(process.stdin.isTTY);
}

/**
 * Check if stdout is a TTY.
 */
export function isOutputTTY(): boolean {
  return Boolean(process.stdout.isTTY);
}

/**
 * Check if the terminal is fully interactive.
 *
 * Returns true if both stdin and stdout are TTYs.
 */
export function isInteractive(): boolean {
  return isInputTTY() && isOutputTTY();
}

/**
 * Check if the terminal supports colors.
 *
 * Uses the FORCE_COLOR env var if set, otherwise checks TTY and TERM.
 */
export function supportsColor(): boolean {
  // Check for explicit force
  if (process.env.FORCE_COLOR !== undefined) {
    return process.env.FORCE_COLOR !== '0';
  }

  // Check for NO_COLOR
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }

  // Must be a TTY
  if (!isOutputTTY()) {
    return false;
  }

  // Check TERM
  const term = process.env.TERM ?? '';
  if (term === 'dumb') {
    return false;
  }

  return true;
}

/**
 * Get terminal dimensions.
 *
 * Returns default values if not a TTY.
 */
export function getTerminalSize(): { columns: number; rows: number } {
  if (!isOutputTTY()) {
    return { columns: 80, rows: 24 };
  }

  return {
    columns: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 24,
  };
}

/**
 * Get all terminal capabilities.
 */
export function getTerminalCapabilities(): TerminalCapabilities {
  const { columns, rows } = getTerminalSize();

  return {
    isInputTTY: isInputTTY(),
    isOutputTTY: isOutputTTY(),
    isInteractive: isInteractive(),
    supportsColor: supportsColor(),
    columns,
    rows,
  };
}

/**
 * Determine the appropriate renderer mode based on terminal capabilities
 * and CLI options.
 */
export function determineRenderMode(options: {
  nonInteractive?: boolean;
  json?: boolean;
  forceInteractive?: boolean;
}): 'ink' | 'headless' {
  const { nonInteractive, json, forceInteractive } = options;

  // Explicit non-interactive mode
  if (nonInteractive || json) {
    return 'headless';
  }

  // Explicit force interactive
  if (forceInteractive) {
    return 'ink';
  }

  // Auto-detect based on TTY
  return isInteractive() ? 'ink' : 'headless';
}
