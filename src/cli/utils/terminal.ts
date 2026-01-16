/**
 * EP04 CLI Interface - Terminal Utilities
 *
 * Implements NFR-002: Terminal width detection (80-120 chars).
 * Provides utilities for terminal dimension handling.
 *
 * @module cli/utils/terminal
 */

/**
 * Default terminal width when not detectable.
 * 80 columns is the classic standard.
 */
const DEFAULT_WIDTH = 80;

/**
 * Minimum terminal width for rendering.
 */
const MIN_WIDTH = 40;

/**
 * Maximum terminal width for readability.
 * Content wider than 120 chars becomes hard to scan.
 */
const MAX_WIDTH = 120;

/**
 * Gets the current terminal width.
 *
 * Falls back to DEFAULT_WIDTH if:
 * - stdout is not a TTY
 * - Width cannot be determined
 *
 * Clamps result to MIN_WIDTH..MAX_WIDTH range per NFR-002.
 *
 * @returns Terminal width in columns
 */
export function getTerminalWidth(): number {
  const columns = process.stdout.columns;

  if (!columns || columns <= 0) {
    return DEFAULT_WIDTH;
  }

  // Clamp to reasonable range
  return Math.min(Math.max(columns, MIN_WIDTH), MAX_WIDTH);
}

/**
 * Gets the current terminal height.
 *
 * Falls back to 24 rows if not detectable.
 *
 * @returns Terminal height in rows
 */
export function getTerminalHeight(): number {
  const rows = process.stdout.rows;

  if (!rows || rows <= 0) {
    return 24; // Classic terminal height
  }

  return rows;
}

/**
 * Checks if the terminal supports cursor positioning.
 * Required for Ink's interactive rendering.
 *
 * @returns True if cursor positioning is supported
 */
export function supportsCursor(): boolean {
  return process.stdout.isTTY ?? false;
}

/**
 * Truncates text to fit within a maximum width.
 * Adds ellipsis (...) if truncated.
 *
 * @param text - Text to truncate
 * @param maxWidth - Maximum width in characters
 * @param suffix - Suffix to append when truncated (default: '...')
 * @returns Truncated text
 */
export function truncateText(text: string, maxWidth: number, suffix = '...'): string {
  if (text.length <= maxWidth) {
    return text;
  }

  const truncateAt = maxWidth - suffix.length;
  if (truncateAt <= 0) {
    return suffix.slice(0, maxWidth);
  }

  return text.slice(0, truncateAt) + suffix;
}

/**
 * Wraps text to fit within a maximum width.
 * Breaks on word boundaries when possible.
 *
 * @param text - Text to wrap
 * @param maxWidth - Maximum width in characters
 * @returns Array of wrapped lines
 */
export function wrapText(text: string, maxWidth: number): string[] {
  if (text.length <= maxWidth) {
    return [text];
  }

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Pads text to a fixed width.
 *
 * @param text - Text to pad
 * @param width - Target width
 * @param align - Alignment ('left', 'right', 'center')
 * @returns Padded text
 */
export function padText(
  text: string,
  width: number,
  align: 'left' | 'right' | 'center' = 'left'
): string {
  if (text.length >= width) {
    return text.slice(0, width);
  }

  const padding = width - text.length;

  switch (align) {
    case 'right':
      return ' '.repeat(padding) + text;
    case 'center': {
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
    }
    case 'left':
    default:
      return text + ' '.repeat(padding);
  }
}
