/**
 * Config Analysis Tools - EP05
 *
 * Tools for discovering, parsing, and assessing AI Coding Tool configurations.
 * Supports CLAUDE.md, AGENTS.md, .claude/ directory structures, and SKILL.md files.
 *
 * @module tools/config
 */

// Types and interfaces
export * from './types';

// Discovery functions
export * from './discovery';

// Parsing functions
export * from './parse-config';

// Metrics extraction
export * from './metrics';

// Quality assessment
export * from './quality';

// ACT format validation
export * from './act-format-validator';
export * from './schemas';

// Skills detection
export * from './skills';

// Hierarchy analysis
export * from './hierarchy';

// Tool definitions (SDK tool() pattern)
export * from './discover-configs-tool';
export * from './parse-config-tool';
export * from './analyze-hierarchy-tool';
