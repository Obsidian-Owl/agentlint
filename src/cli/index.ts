/**
 * EP04 CLI Interface - Public Exports
 *
 * This module provides the command-line interface for agentlint.
 *
 * @module cli
 */

// Types
export * from './types';

// Program entry point
export { createProgram, run, extractGlobalOptions } from './program';

// Utilities
export * from './utils';

// Commands (to be implemented in Phase 4-6)
// export * from './commands';

// Components (to be implemented in Phase 6)
// export * from './components';

// Formatters (to be implemented in Phase 5)
// export * from './formatters';
