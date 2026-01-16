/**
 * EP03 Persistence Layer - Error Classes
 *
 * Error types for the persistence layer.
 * All persistence errors extend PersistenceError which extends AgentlintError.
 *
 * @module errors/persistence
 */

import { AgentlintError, ExitCode } from './base';

// =============================================================================
// Exit Codes for Persistence
// =============================================================================

/**
 * Extended exit codes for persistence errors.
 * These extend the base ExitCode enum.
 */
export const PersistenceExitCode = {
  ...ExitCode,
  /** File not found */
  FileNotFound: 20,
  /** File corrupted or invalid format */
  FileCorrupted: 21,
  /** Database operation failed */
  DatabaseError: 22,
  /** Directory operation failed */
  DirectoryError: 23,
  /** Atomic write failed */
  AtomicWriteError: 24,
  /** Schema version mismatch */
  SchemaVersionError: 25,
  /** Permission denied */
  PermissionError: 26,
} as const;

export type PersistenceExitCode = (typeof PersistenceExitCode)[keyof typeof PersistenceExitCode];

// =============================================================================
// Base Persistence Error
// =============================================================================

/**
 * Base error class for all persistence-related errors.
 * Extends AgentlintError with persistence-specific context.
 */
export class PersistenceError extends AgentlintError {
  /** File path if applicable */
  public readonly filePath: string | undefined;

  constructor(
    message: string,
    options?: {
      code?: PersistenceExitCode | undefined;
      filePath?: string | undefined;
      cause?: Error | undefined;
    }
  ) {
    super(message, (options?.code ?? PersistenceExitCode.GeneralError) as ExitCode);
    this.name = 'PersistenceError';
    this.filePath = options?.filePath;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

// =============================================================================
// Specific Persistence Errors
// =============================================================================

/**
 * Error thrown when a file is not found.
 * This can occur when:
 * - Baseline file missing
 * - Learning file missing
 * - Session file missing
 */
export class FileNotFoundError extends PersistenceError {
  /** Type of file that was not found */
  public readonly fileType: 'baseline' | 'learning' | 'session' | 'database' | 'unknown';

  constructor(
    filePath: string,
    fileType: 'baseline' | 'learning' | 'session' | 'database' | 'unknown' = 'unknown',
    message?: string
  ) {
    const typeLabel = fileType === 'unknown' ? 'File' : `${fileType.charAt(0).toUpperCase()}${fileType.slice(1)}`;
    super(message ?? `${typeLabel} not found: ${filePath}`, {
      code: PersistenceExitCode.FileNotFound,
      filePath,
    });

    this.name = 'FileNotFoundError';
    this.fileType = fileType;
  }
}

/**
 * Error thrown when a file is corrupted or has invalid format.
 * This can occur when:
 * - JSON parsing fails
 * - YAML frontmatter is invalid
 * - Schema validation fails
 */
export class FileCorruptedError extends PersistenceError {
  /** Reason for the corruption */
  public readonly reason: 'parse_error' | 'invalid_schema' | 'missing_fields' | 'unknown';

  constructor(
    filePath: string,
    reason: 'parse_error' | 'invalid_schema' | 'missing_fields' | 'unknown',
    message?: string
  ) {
    const defaultMessages: Record<typeof reason, string> = {
      parse_error: `Failed to parse file: ${filePath}`,
      invalid_schema: `Invalid schema in file: ${filePath}`,
      missing_fields: `Missing required fields in file: ${filePath}`,
      unknown: `File corrupted: ${filePath}`,
    };

    super(message ?? defaultMessages[reason], {
      code: PersistenceExitCode.FileCorrupted,
      filePath,
    });

    this.name = 'FileCorruptedError';
    this.reason = reason;
  }
}

/**
 * Error thrown when a database operation fails.
 * This can occur when:
 * - SQLite query fails
 * - WAL mode initialization fails
 * - Transaction fails
 */
export class DatabaseError extends PersistenceError {
  /** Database operation that failed */
  public readonly operation: 'query' | 'insert' | 'update' | 'delete' | 'init' | 'transaction' | 'unknown';

  constructor(
    operation: 'query' | 'insert' | 'update' | 'delete' | 'init' | 'transaction' | 'unknown',
    message?: string,
    options?: { filePath?: string | undefined; cause?: Error | undefined }
  ) {
    const defaultMessages: Record<typeof operation, string> = {
      query: 'Database query failed',
      insert: 'Database insert failed',
      update: 'Database update failed',
      delete: 'Database delete failed',
      init: 'Database initialization failed',
      transaction: 'Database transaction failed',
      unknown: 'Database operation failed',
    };

    super(message ?? defaultMessages[operation], {
      code: PersistenceExitCode.DatabaseError,
      filePath: options?.filePath,
      cause: options?.cause,
    });

    this.name = 'DatabaseError';
    this.operation = operation;
  }
}

/**
 * Error thrown when a directory operation fails.
 * This can occur when:
 * - Directory creation fails
 * - Directory doesn't exist
 * - Permission issues
 */
export class DirectoryError extends PersistenceError {
  /** Directory operation that failed */
  public readonly operation: 'create' | 'read' | 'delete' | 'unknown';

  constructor(
    dirPath: string,
    operation: 'create' | 'read' | 'delete' | 'unknown',
    message?: string,
    cause?: Error
  ) {
    const defaultMessages: Record<typeof operation, string> = {
      create: `Failed to create directory: ${dirPath}`,
      read: `Failed to read directory: ${dirPath}`,
      delete: `Failed to delete directory: ${dirPath}`,
      unknown: `Directory operation failed: ${dirPath}`,
    };

    super(message ?? defaultMessages[operation], {
      code: PersistenceExitCode.DirectoryError,
      filePath: dirPath,
      cause,
    });

    this.name = 'DirectoryError';
    this.operation = operation;
  }
}

/**
 * Error thrown when an atomic write operation fails.
 * This can occur when:
 * - Temp file creation fails
 * - Rename operation fails
 * - Disk full
 */
export class AtomicWriteError extends PersistenceError {
  /** Stage where the atomic write failed */
  public readonly stage: 'temp_create' | 'write' | 'rename' | 'cleanup' | 'unknown';

  constructor(
    filePath: string,
    stage: 'temp_create' | 'write' | 'rename' | 'cleanup' | 'unknown',
    message?: string,
    cause?: Error
  ) {
    const defaultMessages: Record<typeof stage, string> = {
      temp_create: `Failed to create temp file for: ${filePath}`,
      write: `Failed to write temp file for: ${filePath}`,
      rename: `Failed to rename temp file to: ${filePath}`,
      cleanup: `Failed to cleanup temp file for: ${filePath}`,
      unknown: `Atomic write failed for: ${filePath}`,
    };

    super(message ?? defaultMessages[stage], {
      code: PersistenceExitCode.AtomicWriteError,
      filePath,
      cause,
    });

    this.name = 'AtomicWriteError';
    this.stage = stage;
  }
}

/**
 * Error thrown when schema version doesn't match.
 * This can occur when:
 * - File from newer version
 * - Migration needed
 * - Incompatible format
 */
export class SchemaVersionError extends PersistenceError {
  /** Expected schema version */
  public readonly expectedVersion: string;
  /** Actual schema version found */
  public readonly actualVersion: string;

  constructor(filePath: string, expectedVersion: string, actualVersion: string) {
    super(`Schema version mismatch in ${filePath}: expected ${expectedVersion}, got ${actualVersion}`, {
      code: PersistenceExitCode.SchemaVersionError,
      filePath,
    });

    this.name = 'SchemaVersionError';
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

/**
 * Error thrown when a permission operation fails.
 * This can occur when:
 * - File not writable
 * - Directory not accessible
 * - chmod fails
 */
export class PermissionError extends PersistenceError {
  /** Type of permission issue */
  public readonly permissionType: 'read' | 'write' | 'execute' | 'unknown';

  constructor(
    filePath: string,
    permissionType: 'read' | 'write' | 'execute' | 'unknown',
    message?: string,
    cause?: Error
  ) {
    const defaultMessages: Record<typeof permissionType, string> = {
      read: `Read permission denied: ${filePath}`,
      write: `Write permission denied: ${filePath}`,
      execute: `Execute permission denied: ${filePath}`,
      unknown: `Permission denied: ${filePath}`,
    };

    super(message ?? defaultMessages[permissionType], {
      code: PersistenceExitCode.PermissionError,
      filePath,
      cause,
    });

    this.name = 'PermissionError';
    this.permissionType = permissionType;
  }
}

// =============================================================================
// Error Type Guards
// =============================================================================

/**
 * Check if an error is a PersistenceError
 */
export function isPersistenceError(error: unknown): error is PersistenceError {
  return error instanceof PersistenceError;
}

/**
 * Check if an error is a FileNotFoundError
 */
export function isFileNotFoundError(error: unknown): error is FileNotFoundError {
  return error instanceof FileNotFoundError;
}

/**
 * Check if an error is a FileCorruptedError
 */
export function isFileCorruptedError(error: unknown): error is FileCorruptedError {
  return error instanceof FileCorruptedError;
}

/**
 * Check if an error is a DatabaseError
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

/**
 * Check if an error is a DirectoryError
 */
export function isDirectoryError(error: unknown): error is DirectoryError {
  return error instanceof DirectoryError;
}

/**
 * Check if an error is an AtomicWriteError
 */
export function isAtomicWriteError(error: unknown): error is AtomicWriteError {
  return error instanceof AtomicWriteError;
}

/**
 * Check if an error is a SchemaVersionError
 */
export function isSchemaVersionError(error: unknown): error is SchemaVersionError {
  return error instanceof SchemaVersionError;
}

/**
 * Check if an error is a PermissionError
 */
export function isPermissionError(error: unknown): error is PermissionError {
  return error instanceof PermissionError;
}
