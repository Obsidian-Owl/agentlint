/**
 * EP11 Quality & Security - Debug Infrastructure
 *
 * Provides structured logging with namespace-based filtering and secret redaction.
 *
 * @module debug
 *
 * @example
 * ```typescript
 * import {
 *   createDebugLogger,
 *   DEBUG_NAMESPACES,
 *   redact,
 * } from './debug';
 *
 * // Create a logger with specific namespaces enabled
 * const logger = createDebugLogger({
 *   level: 'debug',
 *   namespaces: ['agentlint:tools', 'agentlint:llm'],
 * });
 *
 * // Get a child logger with fixed namespace
 * const toolsLogger = logger.child(DEBUG_NAMESPACES.TOOLS);
 * toolsLogger.info('Tool invoked', { name: 'read_file' });
 *
 * // Redact secrets from strings
 * const safe = redact('password=mysecret');
 * // 'password=[REDACTED:PASSWORD]'
 * ```
 */

// Re-export types
export * from './types';

// Re-export namespaces
export * from './namespaces';

// Re-export redaction utilities
export * from './redaction';

// Re-export logger
export {
  DebugLogger,
  createDebugLogger,
  createLoggerFromCLIOptions,
  getDefaultLogger,
  setDefaultLogger,
  DEFAULT_DEBUG_CONFIG,
} from './logger';
