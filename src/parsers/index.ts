/**
 * Parsers module - EP05
 *
 * Low-level parsing infrastructure for configuration files.
 * Uses unified/remark ecosystem for markdown parsing with mdast.
 *
 * @module parsers
 */

// Markdown parser (remark/unified wrapper)
export * from './markdown';

// YAML frontmatter extraction
export * from './frontmatter';

// JSON settings validation
export * from './json-config';
