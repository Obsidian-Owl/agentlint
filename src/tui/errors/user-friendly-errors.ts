/**
 * User-Friendly Error Messages
 *
 * Transforms technical error messages into user-friendly messages with
 * actionable recovery suggestions.
 *
 * Format: WHAT happened + WHY it matters + WHAT to do
 *
 * @module tui/errors/user-friendly-errors
 */

import {
  isConfigNotFoundError,
  isFileNotFoundError,
  isProviderAuthError,
  isDatabaseError,
  isPermissionError,
  isNetworkError,
  isSessionsDirNotFoundError,
} from '../../errors';

// =============================================================================
// Types
// =============================================================================

/**
 * User-friendly error message with recovery suggestion.
 */
export interface UserFriendlyError {
  /** Short description of what happened */
  what: string;
  /** Why it matters (optional context) */
  why?: string;
  /** What the user should do to fix it */
  action: string;
  /** Original error message for debugging (optional) */
  technical?: string;
}

// =============================================================================
// Error Pattern Matchers
// =============================================================================

/**
 * Match file not found errors and provide specific recovery actions.
 */
function matchFileNotFound(error: Error): UserFriendlyError | null {
  const message = error.message.toLowerCase();

  // Config file not found
  if (message.includes('config') && (message.includes('not found') || message.includes('.json'))) {
    const configPath = '~/.agentlint/config.json';
    if (error.message.includes(configPath)) {
      return {
        what: "Can't find your config file",
        action: 'Run `agentlint init` to create one',
        technical: error.message,
      };
    }
    return {
      what: 'Missing configuration file',
      action: 'Run `agentlint init` to set up your configuration',
      technical: error.message,
    };
  }

  // Sessions directory not found
  if (message.includes('session') && message.includes('directory')) {
    return {
      what: 'No session history found',
      why: 'This is expected on first run',
      action: 'Start a session to begin recording history',
      technical: error.message,
    };
  }

  // Generic file not found
  if (message.includes('enoent') || message.includes('no such file')) {
    return {
      what: 'File or directory not found',
      action: 'Check the path and try again',
      technical: error.message,
    };
  }

  return null;
}

/**
 * Match network/connection errors and provide recovery actions.
 */
function matchNetworkError(error: Error): UserFriendlyError | null {
  const message = error.message.toLowerCase();

  // API connection failed
  if (
    message.includes('econnrefused') ||
    message.includes('connection refused') ||
    message.includes('network')
  ) {
    return {
      what: 'Connection to AI service failed',
      why: 'Your network may be down or the service is unavailable',
      action: 'Check your internet connection and try again',
      technical: error.message,
    };
  }

  // Timeout
  if (message.includes('timeout') || message.includes('etimedout')) {
    return {
      what: 'Request timed out',
      why: 'The service took too long to respond',
      action: 'Try again or check your network speed',
      technical: error.message,
    };
  }

  // DNS resolution failed
  if (message.includes('getaddrinfo') || message.includes('enotfound')) {
    return {
      what: 'Could not reach AI service',
      why: 'DNS lookup failed - check your internet connection',
      action: 'Verify your network connection and DNS settings',
      technical: error.message,
    };
  }

  return null;
}

/**
 * Match authentication/API key errors and provide recovery actions.
 */
function matchAuthError(error: Error): UserFriendlyError | null {
  const message = error.message.toLowerCase();

  // Missing API key
  if (message.includes('api key') && (message.includes('missing') || message.includes('not set'))) {
    return {
      what: 'No API key found',
      why: 'agentlint needs an Anthropic API key to work',
      action: 'Set ANTHROPIC_API_KEY in your environment or .env file',
      technical: error.message,
    };
  }

  // Invalid API key
  if (
    message.includes('unauthorized') ||
    message.includes('invalid api key') ||
    message.includes('authentication failed')
  ) {
    return {
      what: 'API key is invalid',
      why: 'The key may be expired or incorrect',
      action: 'Check your ANTHROPIC_API_KEY and get a new one from console.anthropic.com',
      technical: error.message,
    };
  }

  // Rate limited
  if (message.includes('rate limit') || message.includes('429')) {
    return {
      what: 'Too many requests',
      why: "You've hit the API rate limit",
      action: 'Wait a few minutes and try again',
      technical: error.message,
    };
  }

  return null;
}

/**
 * Match permission/access errors and provide recovery actions.
 */
function matchPermissionError(error: Error): UserFriendlyError | null {
  const message = error.message.toLowerCase();

  // File permission denied
  if (message.includes('eacces') || message.includes('permission denied')) {
    return {
      what: "Don't have permission to access this file",
      why: 'The file or directory has restricted permissions',
      action: 'Check file permissions or run with appropriate access rights',
      technical: error.message,
    };
  }

  // Read-only filesystem
  if (message.includes('erofs') || message.includes('read-only')) {
    return {
      what: "Can't write to this location",
      why: 'The filesystem is read-only',
      action: 'Choose a different location or check filesystem mount options',
      technical: error.message,
    };
  }

  return null;
}

/**
 * Match database errors and provide recovery actions.
 */
function matchDatabaseError(error: Error): UserFriendlyError | null {
  const message = error.message.toLowerCase();

  // Database locked
  if (message.includes('database is locked') || message.includes('sqlite_busy')) {
    return {
      what: 'Database is locked',
      why: 'Another process may be using it',
      action: 'Wait a moment and try again, or close other agentlint sessions',
      technical: error.message,
    };
  }

  // Database corrupted
  if (message.includes('corrupt') || message.includes('malformed')) {
    return {
      what: 'Database file is corrupted',
      why: 'The data may have been damaged',
      action: 'Run `agentlint clean --force` to reset, or restore from backup',
      technical: error.message,
    };
  }

  // Disk full
  if (message.includes('enospc') || message.includes('no space left')) {
    return {
      what: 'Not enough disk space',
      why: 'Your disk is full',
      action: 'Free up disk space and try again',
      technical: error.message,
    };
  }

  return null;
}

/**
 * Match configuration errors and provide recovery actions.
 */
function matchConfigError(error: Error): UserFriendlyError | null {
  const message = error.message.toLowerCase();

  // Invalid JSON
  if (message.includes('json') && (message.includes('invalid') || message.includes('parse'))) {
    return {
      what: 'Config file has invalid JSON',
      why: 'There may be a syntax error in the file',
      action: 'Check ~/.agentlint/config.json for syntax errors or run `agentlint init --force`',
      technical: error.message,
    };
  }

  // Invalid config value
  if (message.includes('invalid') && message.includes('config')) {
    return {
      what: 'Invalid configuration value',
      why: 'One or more config settings are incorrect',
      action: 'Review ~/.agentlint/config.json and fix the invalid values',
      technical: error.message,
    };
  }

  return null;
}

// =============================================================================
// Main Formatter
// =============================================================================

/**
 * Convert an error into a user-friendly message with recovery action.
 *
 * @param error - The error to format
 * @param context - Optional context about where the error occurred
 * @returns User-friendly error message
 */
export function formatUserFriendlyError(error: unknown, context?: string): UserFriendlyError {
  // Handle non-Error types
  if (!(error instanceof Error)) {
    return {
      what: 'Something went wrong',
      action: 'Try again or check the logs for details',
      technical: String(error),
    };
  }

  // Try typed error matchers first (from our error classes)
  if (isProviderAuthError(error)) {
    return (
      matchAuthError(error) ?? {
        what: 'Authentication failed',
        action: 'Check your API key configuration',
        technical: error.message,
      }
    );
  }

  if (isConfigNotFoundError(error)) {
    return {
      what: "Can't find your config file",
      action: 'Run `agentlint init` to create one',
      technical: error.message,
    };
  }

  if (isFileNotFoundError(error) || isSessionsDirNotFoundError(error)) {
    return (
      matchFileNotFound(error) ?? {
        what: 'File not found',
        action: 'Check the path and try again',
        technical: error.message,
      }
    );
  }

  if (isDatabaseError(error)) {
    return (
      matchDatabaseError(error) ?? {
        what: 'Database error',
        action: 'Try again or run `agentlint clean` to reset',
        technical: error.message,
      }
    );
  }

  if (isPermissionError(error)) {
    return (
      matchPermissionError(error) ?? {
        what: 'Permission denied',
        action: 'Check file permissions and try again',
        technical: error.message,
      }
    );
  }

  if (isNetworkError(error)) {
    return (
      matchNetworkError(error) ?? {
        what: 'Network error',
        action: 'Check your internet connection and try again',
        technical: error.message,
      }
    );
  }

  // Try pattern matchers (for errors from dependencies, Node.js, etc.)
  const matchers = [
    matchFileNotFound,
    matchNetworkError,
    matchAuthError,
    matchPermissionError,
    matchDatabaseError,
    matchConfigError,
  ];

  for (const matcher of matchers) {
    const result = matcher(error);
    if (result) {
      return result;
    }
  }

  // Fallback: generic error message
  return {
    what: context ? `Error in ${context}` : 'An error occurred',
    action: 'Try again or check the logs for details',
    technical: error.message,
  };
}

/**
 * Format a user-friendly error for display in the TUI.
 *
 * Returns a multi-line string with color formatting hints.
 *
 * @param error - The error to format
 * @param context - Optional context about where the error occurred
 * @returns Formatted error string ready for display
 */
export function formatErrorForDisplay(error: unknown, context?: string): string {
  const friendly = formatUserFriendlyError(error, context);

  const lines: string[] = [];

  // What happened (main message)
  lines.push(friendly.what);

  // Why it matters (context)
  if (friendly.why) {
    lines.push(`  ${friendly.why}`);
  }

  // What to do (recovery action)
  lines.push(`  → ${friendly.action}`);

  return lines.join('\n');
}

/**
 * Get a short one-line error summary for status bars.
 *
 * @param error - The error to summarize
 * @returns Short error summary
 */
export function getErrorSummary(error: unknown): string {
  const friendly = formatUserFriendlyError(error);
  return friendly.what;
}
