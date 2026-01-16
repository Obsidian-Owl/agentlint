/**
 * EP04 CLI Interface - Formatters
 *
 * Output formatters for different output modes (JSON, Markdown, Plain).
 *
 * @module cli/formatters
 */

// JSON formatter - full exports
export * from './json';

// Markdown formatter - explicit exports to avoid conflicts with JSON formatter
export {
  MarkdownFormatter,
  createMarkdownFormatter,
  formatComplete as formatMarkdownComplete,
  formatStreamChunk as formatMarkdownStreamChunk,
  formatFindings as formatMarkdownFindings,
  formatCausalChain as formatMarkdownCausalChain,
} from './markdown';

// Re-export markdown-specific types with prefixes
export type { CausalNode as MarkdownCausalNode } from './markdown';

// Plain text formatter - explicit exports to avoid conflicts
export {
  PlainFormatter,
  createPlainFormatter,
  formatComplete as formatPlainComplete,
  formatStreamChunk as formatPlainStreamChunk,
  formatFindings as formatPlainFindings,
} from './plain';
