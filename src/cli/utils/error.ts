/**
 * CLI Error Utilities
 *
 * Provides standardized error formatting for CLI commands.
 * Ensures consistent error presentation with automatic secret redaction.
 *
 * @module cli/utils/error
 */

import { redact } from '../../debug';

// =============================================================================
// Types
// =============================================================================

/**
 * Categories of CLI errors for structured logging.
 */
export type CLIErrorCategory =
  | 'validation'
  | 'io'
  | 'network'
  | 'config'
  | 'permission'
  | 'internal';

/**
 * Options for printError function.
 */
export interface PrintErrorOptions {
  /** Error category for debugging/filtering */
  category?: CLIErrorCategory;
  /** Additional details about the error */
  details?: string;
  /** Suggestion for how to fix the error */
  suggestion?: string;
  /** Whether to include stack trace in debug mode */
  includeStack?: boolean;
}

// =============================================================================
// Error Printing
// =============================================================================

/**
 * Print a user-facing error message with consistent formatting.
 *
 * Features:
 * - Automatic secret redaction
 * - Optional category for debug filtering
 * - Suggestion support for actionable errors
 *
 * @param message - The main error message
 * @param options - Additional error options
 *
 * @example
 * ```typescript
 * printError('Directory not found', {
 *   category: 'io',
 *   details: '/path/to/missing',
 *   suggestion: 'Check the path exists',
 * });
 * // Output:
 * // Error: Directory not found
 * //   Path: /path/to/missing
 * //   Suggestion: Check the path exists
 * ```
 */
export function printError(message: string, options: PrintErrorOptions = {}): void {
  const { category = 'internal', details, suggestion } = options;

  // Redact any secrets that may have leaked into error messages
  const safeMessage = redact(message);

  console.error(`Error: ${safeMessage}`);

  if (details) {
    const safeDetails = redact(details);
    console.error(`  Details: ${safeDetails}`);
  }

  if (suggestion) {
    console.error(`  Suggestion: ${suggestion}`);
  }

  // Debug mode shows category for log filtering
  if (process.env.DEBUG || process.env.AGENTLINT_DEBUG) {
    console.error(`  [category: ${category}]`);
  }
}

/**
 * Print an error from an exception with consistent formatting.
 *
 * Extracts message from Error objects and handles non-Error values.
 *
 * @param error - The error to print (Error, string, or unknown)
 * @param context - Optional context prefix (e.g., "Loading config")
 *
 * @example
 * ```typescript
 * try {
 *   await loadConfig();
 * } catch (error) {
 *   printException(error, 'Loading config');
 * }
 * // Output: Error: Loading config: File not found
 * ```
 */
export function printException(error: unknown, context?: string): void {
  const message = error instanceof Error ? error.message : String(error);
  const prefix = context ? `${context}: ` : '';

  const options: PrintErrorOptions = {
    category: 'internal',
  };

  // Include first line of stack trace in debug mode
  if (error instanceof Error && error.stack && (process.env.DEBUG || process.env.AGENTLINT_DEBUG)) {
    const stackLines = error.stack.split('\n');
    const stackLine = stackLines[1]?.trim();
    if (stackLine) {
      options.details = stackLine;
    }
  }

  printError(`${prefix}${message}`, options);
}

/**
 * Print a validation error with path information.
 *
 * @param message - The validation error message
 * @param path - The path that failed validation
 * @param suggestion - Optional suggestion for fixing
 */
export function printValidationError(message: string, path?: string, suggestion?: string): void {
  const options: PrintErrorOptions = { category: 'validation' };
  if (path) options.details = path;
  if (suggestion) options.suggestion = suggestion;
  printError(message, options);
}

/**
 * Print an IO error (file/directory operations).
 *
 * @param message - The IO error message
 * @param path - The path that caused the error
 */
export function printIOError(message: string, path?: string): void {
  const options: PrintErrorOptions = { category: 'io' };
  if (path) options.details = path;
  printError(message, options);
}

/**
 * Print a configuration error.
 *
 * @param message - The configuration error message
 * @param configPath - The config file path if known
 * @param suggestion - Optional suggestion for fixing
 */
export function printConfigError(message: string, configPath?: string, suggestion?: string): void {
  const options: PrintErrorOptions = { category: 'config' };
  if (configPath) options.details = configPath;
  if (suggestion) options.suggestion = suggestion;
  printError(message, options);
}
