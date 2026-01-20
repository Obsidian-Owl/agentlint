/**
 * EP11 Quality & Security - Debug Infrastructure
 *
 * Provides structured logging with namespace-based filtering and secret redaction.
 *
 * @module debug
 */

// Re-export types
export * from './types';

// Re-export namespaces
export * from './namespaces';

// Re-export redaction utilities
export * from './redaction';

// Logger will be exported after T019 implementation
// export * from './logger';
