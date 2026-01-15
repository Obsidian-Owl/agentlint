/**
 * Error handling for agentlint CLI
 */

// =============================================================================
// Exit Codes
// =============================================================================

/**
 * CLI exit codes
 */
export const ExitCode = {
  Success: 0,
  GeneralError: 1,
  InvalidArgument: 2,
  NetworkError: 3,
  ChecksumMismatch: 4,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

// =============================================================================
// Error Types
// =============================================================================

/**
 * Base error for agentlint CLI
 */
export class AgentlintError extends Error {
  constructor(
    message: string,
    public readonly code: ExitCode = ExitCode.GeneralError
  ) {
    super(message);
    this.name = 'AgentlintError';
  }
}

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
