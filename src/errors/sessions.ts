/**
 * EP06 Session Analysis - Error Classes
 *
 * Error types for session analysis tools.
 * All session errors extend SessionError which extends AgentlintError.
 *
 * @module errors/sessions
 */

import { AgentlintError, ExitCode } from './base';

// =============================================================================
// Exit Codes for Sessions
// =============================================================================

/**
 * Extended exit codes for session errors.
 * These extend the base ExitCode enum.
 */
export const SessionExitCode = {
  ...ExitCode,
  /** Sessions directory not found */
  SessionsDirNotFound: 30,
  /** Session file not found */
  SessionFileNotFound: 31,
  /** Session file unreadable */
  SessionFileUnreadable: 32,
  /** Invalid JSONL format */
  InvalidJsonl: 33,
  /** Index is locked */
  IndexLocked: 34,
  /** Index is corrupted */
  IndexCorrupted: 35,
  /** Query syntax error */
  QuerySyntaxError: 36,
  /** Query timeout */
  QueryTimeout: 37,
} as const;

export type SessionExitCode = (typeof SessionExitCode)[keyof typeof SessionExitCode];

// =============================================================================
// Base Session Error
// =============================================================================

/**
 * Base error class for all session-related errors.
 * Extends AgentlintError with session-specific context.
 */
export class SessionError extends AgentlintError {
  /** File path if applicable */
  public readonly filePath: string | undefined;
  /** Line number if applicable */
  public readonly lineNumber: number | undefined;
  /** Suggestion for fixing the error */
  public readonly suggestion: string | undefined;

  constructor(
    message: string,
    options?: {
      code?: SessionExitCode | undefined;
      filePath?: string | undefined;
      lineNumber?: number | undefined;
      suggestion?: string | undefined;
      cause?: Error | undefined;
    }
  ) {
    super(message, (options?.code ?? SessionExitCode.GeneralError) as ExitCode);
    this.name = 'SessionError';
    this.filePath = options?.filePath;
    this.lineNumber = options?.lineNumber;
    this.suggestion = options?.suggestion;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

// =============================================================================
// Specific Session Errors
// =============================================================================

/**
 * Error thrown when the Claude sessions directory is not found.
 * This can occur when:
 * - ~/.claude/projects/ does not exist
 * - Custom projects directory does not exist
 */
export class SessionsDirNotFoundError extends SessionError {
  /** The directory that was not found */
  public readonly dirPath: string;

  constructor(dirPath: string, message?: string) {
    super(message ?? `Sessions directory not found: ${dirPath}`, {
      code: SessionExitCode.SessionsDirNotFound,
      filePath: dirPath,
      suggestion: 'Ensure Claude Code has been used in at least one project.',
    });

    this.name = 'SessionsDirNotFoundError';
    this.dirPath = dirPath;
  }
}

/**
 * Error thrown when a session file is not found.
 * This can occur when:
 * - Session log file was deleted
 * - Session log file was moved
 */
export class SessionFileNotFoundError extends SessionError {
  constructor(filePath: string, message?: string) {
    super(message ?? `Session file not found: ${filePath}`, {
      code: SessionExitCode.SessionFileNotFound,
      filePath,
      suggestion: 'The session file may have been deleted or moved.',
    });

    this.name = 'SessionFileNotFoundError';
  }
}

/**
 * Error thrown when a session file cannot be read.
 * This can occur when:
 * - Permission denied
 * - File locked by another process
 * - I/O error
 */
export class SessionFileUnreadableError extends SessionError {
  /** Reason for the read failure */
  public readonly reason: 'permission_denied' | 'locked' | 'io_error' | 'unknown';

  constructor(
    filePath: string,
    reason: 'permission_denied' | 'locked' | 'io_error' | 'unknown',
    message?: string,
    cause?: Error
  ) {
    const defaultMessages: Record<typeof reason, string> = {
      permission_denied: `Permission denied reading session file: ${filePath}`,
      locked: `Session file is locked: ${filePath}`,
      io_error: `I/O error reading session file: ${filePath}`,
      unknown: `Cannot read session file: ${filePath}`,
    };

    const suggestions: Record<typeof reason, string> = {
      permission_denied: 'Check file permissions.',
      locked: 'Close any application that may have the file open.',
      io_error: 'Check disk health and available space.',
      unknown: 'Check file exists and is readable.',
    };

    super(message ?? defaultMessages[reason], {
      code: SessionExitCode.SessionFileUnreadable,
      filePath,
      suggestion: suggestions[reason],
      cause,
    });

    this.name = 'SessionFileUnreadableError';
    this.reason = reason;
  }
}

/**
 * Error thrown when JSONL parsing fails.
 * This can occur when:
 * - Line is not valid JSON
 * - Line is truncated
 * - Binary data in file
 */
export class InvalidJsonlError extends SessionError {
  /** Reason for the parse failure */
  public readonly reason: 'parse_error' | 'truncated' | 'binary_data' | 'unknown';

  constructor(
    filePath: string,
    lineNumber: number,
    reason: 'parse_error' | 'truncated' | 'binary_data' | 'unknown',
    message?: string,
    cause?: Error
  ) {
    const defaultMessages: Record<typeof reason, string> = {
      parse_error: `Invalid JSON at ${filePath}:${lineNumber}`,
      truncated: `Truncated JSON at ${filePath}:${lineNumber}`,
      binary_data: `Binary data detected at ${filePath}:${lineNumber}`,
      unknown: `Invalid JSONL at ${filePath}:${lineNumber}`,
    };

    super(message ?? defaultMessages[reason], {
      code: SessionExitCode.InvalidJsonl,
      filePath,
      lineNumber,
      suggestion: 'This line will be skipped during parsing.',
      cause,
    });

    this.name = 'InvalidJsonlError';
    this.reason = reason;
  }
}

/**
 * Error thrown when the FTS5 index is locked.
 * This can occur when:
 * - Another indexing operation is running
 * - Database locked by another process
 */
export class IndexLockedError extends SessionError {
  constructor(dbPath: string, message?: string, cause?: Error) {
    super(message ?? `Index is locked: ${dbPath}`, {
      code: SessionExitCode.IndexLocked,
      filePath: dbPath,
      suggestion: 'Wait for the current operation to complete or restart the application.',
      cause,
    });

    this.name = 'IndexLockedError';
  }
}

/**
 * Error thrown when the FTS5 index is corrupted.
 * This can occur when:
 * - Database file is corrupted
 * - Schema is invalid
 * - FTS5 index integrity check fails
 */
export class IndexCorruptedError extends SessionError {
  /** Reason for the corruption */
  public readonly reason: 'database_corrupted' | 'invalid_schema' | 'fts_integrity' | 'unknown';

  constructor(
    dbPath: string,
    reason: 'database_corrupted' | 'invalid_schema' | 'fts_integrity' | 'unknown',
    message?: string,
    cause?: Error
  ) {
    const defaultMessages: Record<typeof reason, string> = {
      database_corrupted: `Database corrupted: ${dbPath}`,
      invalid_schema: `Invalid schema in index: ${dbPath}`,
      fts_integrity: `FTS5 index integrity check failed: ${dbPath}`,
      unknown: `Index corrupted: ${dbPath}`,
    };

    super(message ?? defaultMessages[reason], {
      code: SessionExitCode.IndexCorrupted,
      filePath: dbPath,
      suggestion: 'Delete the index file and re-run indexing.',
      cause,
    });

    this.name = 'IndexCorruptedError';
    this.reason = reason;
  }
}

/**
 * Error thrown when search query syntax is invalid.
 * This can occur when:
 * - FTS5 query syntax error
 * - Invalid filter combination
 */
export class QuerySyntaxError extends SessionError {
  /** The invalid query */
  public readonly query: string;

  constructor(query: string, message?: string, cause?: Error) {
    super(message ?? `Invalid query syntax: ${query}`, {
      code: SessionExitCode.QuerySyntaxError,
      suggestion: 'Check FTS5 query syntax. Use double quotes for phrase search.',
      cause,
    });

    this.name = 'QuerySyntaxError';
    this.query = query;
  }
}

/**
 * Error thrown when a query times out.
 * This can occur when:
 * - Query too complex
 * - Index too large
 * - System under heavy load
 */
export class QueryTimeoutError extends SessionError {
  /** Query timeout in milliseconds */
  public readonly timeoutMs: number;
  /** The query that timed out */
  public readonly query: string;

  constructor(query: string, timeoutMs: number, message?: string) {
    super(message ?? `Query timed out after ${timeoutMs}ms: ${query}`, {
      code: SessionExitCode.QueryTimeout,
      suggestion: 'Try a more specific query or add date filters to reduce scope.',
    });

    this.name = 'QueryTimeoutError';
    this.timeoutMs = timeoutMs;
    this.query = query;
  }
}

// =============================================================================
// Error Type Guards
// =============================================================================

/**
 * Check if an error is a SessionError
 */
export function isSessionError(error: unknown): error is SessionError {
  return error instanceof SessionError;
}

/**
 * Check if an error is a SessionsDirNotFoundError
 */
export function isSessionsDirNotFoundError(error: unknown): error is SessionsDirNotFoundError {
  return error instanceof SessionsDirNotFoundError;
}

/**
 * Check if an error is a SessionFileNotFoundError
 */
export function isSessionFileNotFoundError(error: unknown): error is SessionFileNotFoundError {
  return error instanceof SessionFileNotFoundError;
}

/**
 * Check if an error is a SessionFileUnreadableError
 */
export function isSessionFileUnreadableError(error: unknown): error is SessionFileUnreadableError {
  return error instanceof SessionFileUnreadableError;
}

/**
 * Check if an error is an InvalidJsonlError
 */
export function isInvalidJsonlError(error: unknown): error is InvalidJsonlError {
  return error instanceof InvalidJsonlError;
}

/**
 * Check if an error is an IndexLockedError
 */
export function isIndexLockedError(error: unknown): error is IndexLockedError {
  return error instanceof IndexLockedError;
}

/**
 * Check if an error is an IndexCorruptedError
 */
export function isIndexCorruptedError(error: unknown): error is IndexCorruptedError {
  return error instanceof IndexCorruptedError;
}

/**
 * Check if an error is a QuerySyntaxError
 */
export function isQuerySyntaxError(error: unknown): error is QuerySyntaxError {
  return error instanceof QuerySyntaxError;
}

/**
 * Check if an error is a QueryTimeoutError
 */
export function isQueryTimeoutError(error: unknown): error is QueryTimeoutError {
  return error instanceof QueryTimeoutError;
}
