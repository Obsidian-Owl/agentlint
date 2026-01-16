/**
 * Base error types for agentlint CLI
 *
 * This module contains the foundational error types that other error modules extend.
 * Separated to avoid circular dependencies.
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
// Base Error
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
