/**
 * EP04 CLI Interface - Utilities Index
 *
 * Re-exports all CLI utility functions.
 *
 * @module cli/utils
 */

// Output mode detection (FR-012)
export { getOutputMode, getOutputFormat, supportsStreaming } from './output';

// Color support (FR-014, NFR-005)
export {
  supportsColor,
  createChalk,
  severityColors,
  statusColors,
  colorBySeverity,
  colorByStatus,
  bold,
  dim,
  chalk,
} from './colors';

// Terminal utilities (NFR-002)
export {
  getTerminalWidth,
  getTerminalHeight,
  supportsCursor,
  truncateText,
  wrapText,
  wrapTextWithIndent,
  padText,
  formatDuration,
} from './terminal';
