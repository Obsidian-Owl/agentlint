/**
 * Error handling for agentlint CLI
 */

// =============================================================================
// Base Types (re-exported from base.ts)
// =============================================================================

export { ExitCode, AgentlintError } from './base';
export type { ExitCode as ExitCodeType } from './base';

import { AgentlintError, ExitCode } from './base';

// =============================================================================
// Error Types
// =============================================================================

/**
 * Invalid argument or option provided
 */
export class InvalidArgumentError extends AgentlintError {
  constructor(message: string) {
    super(message, ExitCode.InvalidArgument);
    this.name = 'InvalidArgumentError';
  }
}

/**
 * Network request failed
 */
export class NetworkError extends AgentlintError {
  constructor(message: string) {
    super(message, ExitCode.NetworkError);
    this.name = 'NetworkError';
  }
}

/**
 * Checksum verification failed
 */
export class ChecksumMismatchError extends AgentlintError {
  constructor(expected: string, actual: string) {
    super(`Checksum mismatch: expected ${expected}, got ${actual}`, ExitCode.ChecksumMismatch);
    this.name = 'ChecksumMismatchError';
  }
}

// =============================================================================
// Error Handling Utilities
// =============================================================================

/**
 * Get exit code from an error
 */
export function getExitCode(error: unknown): ExitCode {
  if (error instanceof AgentlintError) {
    return error.code;
  }
  return ExitCode.GeneralError;
}

/**
 * Format error for display
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Error: ${String(error)}`;
}

// =============================================================================
// Orchestration Errors (EP02)
// =============================================================================

export {
  OrchestrationError,
  SessionResumeError,
  ToolRegistrationError,
  ApiKeyError,
  SubagentDepthError,
  OrchestrationExitCode,
  isOrchestrationError,
  isSessionResumeError,
  isToolRegistrationError,
  isApiKeyError,
  isSubagentDepthError,
} from './orchestration';

// =============================================================================
// Persistence Errors (EP03)
// =============================================================================

export {
  PersistenceError,
  FileNotFoundError,
  FileCorruptedError,
  DatabaseError,
  DirectoryError,
  AtomicWriteError,
  SchemaVersionError,
  PermissionError,
  PersistenceExitCode,
  isPersistenceError,
  isFileNotFoundError,
  isFileCorruptedError,
  isDatabaseError,
  isDirectoryError,
  isAtomicWriteError,
  isSchemaVersionError,
  isPermissionError,
} from './persistence';
