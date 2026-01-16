/**
 * EP04 CLI Interface - Color Support Utilities
 *
 * Implements FR-014 and NFR-005: NO_COLOR support and ANSI 4-bit colors.
 * Respects the NO_COLOR standard (https://no-color.org/).
 *
 * @module cli/utils/colors
 */

import chalk, { Chalk, type ChalkInstance } from 'chalk';

/**
 * Checks if color output is supported.
 *
 * Respects:
 * - NO_COLOR environment variable (disables colors)
 * - FORCE_COLOR environment variable (enables colors)
 * - TTY detection
 *
 * @returns True if colors should be used
 */
export function supportsColor(): boolean {
  // NO_COLOR takes precedence (accessibility standard)
  if (process.env['NO_COLOR']) {
    return false;
  }

  // FORCE_COLOR can override TTY detection
  if (process.env['FORCE_COLOR']) {
    return true;
  }

  // Fall back to chalk's detection (handles TTY, CI environments, etc.)
  return chalk.level > 0;
}

/**
 * Creates a chalk instance configured for current environment.
 *
 * Uses ANSI 4-bit colors (NFR-005) for maximum compatibility.
 *
 * @returns Configured chalk instance
 */
export function createChalk(): ChalkInstance {
  if (!supportsColor()) {
    // Return a no-op chalk instance
    return new Chalk({ level: 0 });
  }

  // Use level 1 (4-bit colors) for maximum compatibility
  // This provides 16 colors which is sufficient for severity indicators
  return new Chalk({ level: 1 });
}

// Lazy-initialized chalk instance (avoids issues with bundling/process availability)
let _cliChalk: ChalkInstance | null = null;

function getChalk(): ChalkInstance {
  if (_cliChalk === null) {
    _cliChalk = createChalk();
  }
  return _cliChalk;
}

/**
 * Severity color mapping using ANSI 4-bit colors.
 * These colors are chosen for accessibility and visibility.
 */
export const severityColors = {
  critical: (text: string): string => getChalk().red(text),
  high: (text: string): string => getChalk().yellow(text),
  medium: (text: string): string => getChalk().cyan(text),
  low: (text: string): string => getChalk().blue(text),
  info: (text: string): string => getChalk().white(text),
} as const;

/**
 * Status color mapping for UI elements.
 */
export const statusColors = {
  success: (text: string): string => getChalk().green(text),
  error: (text: string): string => getChalk().red(text),
  warning: (text: string): string => getChalk().yellow(text),
  info: (text: string): string => getChalk().blue(text),
  muted: (text: string): string => getChalk().gray(text),
} as const;

/**
 * Formats text with severity color.
 *
 * @param text - Text to colorize
 * @param severity - Severity level
 * @returns Colorized text (or plain if NO_COLOR)
 */
export function colorBySeverity(
  text: string,
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
): string {
  return severityColors[severity](text);
}

/**
 * Formats text with status color.
 *
 * @param text - Text to colorize
 * @param status - Status type
 * @returns Colorized text (or plain if NO_COLOR)
 */
export function colorByStatus(
  text: string,
  status: 'success' | 'error' | 'warning' | 'info' | 'muted'
): string {
  return statusColors[status](text);
}

/**
 * Applies bold formatting.
 *
 * @param text - Text to format
 * @returns Bold text (or plain if NO_COLOR)
 */
export function bold(text: string): string {
  return getChalk().bold(text);
}

/**
 * Applies dim formatting.
 *
 * @param text - Text to format
 * @returns Dim text (or plain if NO_COLOR)
 */
export function dim(text: string): string {
  return getChalk().dim(text);
}

/**
 * Gets the configured chalk instance.
 * Lazy-initialized to avoid issues at module load time.
 */
export { getChalk as chalk };

/**
 * Color map for use in Ink components.
 * Returns color names that Ink's Text component accepts.
 */
export interface ColorMap {
  /** Error/critical color (red) */
  error: string;
  /** Warning color (yellow) */
  warning: string;
  /** Success color (green) */
  success: string;
  /** Info color (blue/cyan) */
  info: string;
  /** Muted/dim color (gray) */
  dim: string;
  /** Default text color */
  text: string;
}

/**
 * Hook to get color map for Ink components.
 *
 * Returns color names that Ink's Text component accepts.
 * When NO_COLOR is set, returns undefined colors (default terminal colors).
 *
 * @returns Color map for Ink components
 */
export function useColors(): ColorMap {
  const hasColor = supportsColor();

  if (!hasColor) {
    return {
      error: '',
      warning: '',
      success: '',
      info: '',
      dim: '',
      text: '',
    };
  }

  return {
    error: 'red',
    warning: 'yellow',
    success: 'green',
    info: 'cyan',
    dim: 'gray',
    text: 'white',
  };
}
