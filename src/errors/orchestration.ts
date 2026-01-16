/**
 * EP02 Orchestration Core - Error Classes
 *
 * Error types for the orchestration layer.
 * All orchestration errors extend OrchestrationError which extends AgentlintError.
 *
 * @module errors/orchestration
 */

import { AgentlintError, ExitCode } from './base';

// =============================================================================
// Exit Codes for Orchestration
// =============================================================================

/**
 * Extended exit codes for orchestration errors.
 * These extend the base ExitCode enum.
 */
export const OrchestrationExitCode = {
  ...ExitCode,
  /** Session resume failed */
  SessionResumeError: 10,
  /** Tool registration failed */
  ToolRegistrationError: 11,
  /** API key missing or invalid */
  ApiKeyError: 12,
  /** Orchestration execution error */
  OrchestrationError: 13,
} as const;

export type OrchestrationExitCode =
  (typeof OrchestrationExitCode)[keyof typeof OrchestrationExitCode];

// =============================================================================
// Base Orchestration Error (T014)
// =============================================================================

/**
 * Base error class for all orchestration-related errors.
 * Extends AgentlintError with orchestration-specific context.
 */
export class OrchestrationError extends AgentlintError {
  /** Session ID if available */
  public readonly sessionId: string | undefined;

  constructor(
    message: string,
    options?: {
      code?: OrchestrationExitCode;
      sessionId?: string;
      cause?: Error;
    }
  ) {
    // Cast to ExitCode since our extended codes are compatible (just larger numbers)
    super(
      message,
      (options?.code ?? OrchestrationExitCode.OrchestrationError) as ExitCode
    );
    this.name = 'OrchestrationError';
    this.sessionId = options?.sessionId;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

// =============================================================================
// Specific Orchestration Errors (T015)
// =============================================================================

/**
 * Error thrown when session resume fails.
 * This can occur when:
 * - Session file not found
 * - Session file corrupted
 * - Session incompatible with current version
 */
export class SessionResumeError extends OrchestrationError {
  /** The session ID that failed to resume */
  public readonly failedSessionId: string;
  /** Reason for the failure */
  public readonly reason: 'not_found' | 'corrupted' | 'incompatible' | 'unknown';

  constructor(
    sessionId: string,
    reason: 'not_found' | 'corrupted' | 'incompatible' | 'unknown',
    message?: string
  ) {
    const defaultMessages: Record<typeof reason, string> = {
      not_found: `Session '${sessionId}' not found`,
      corrupted: `Session '${sessionId}' is corrupted and cannot be loaded`,
      incompatible: `Session '${sessionId}' is incompatible with the current version`,
      unknown: `Failed to resume session '${sessionId}'`,
    };

    super(message ?? defaultMessages[reason], {
      code: OrchestrationExitCode.SessionResumeError,
      sessionId,
    });

    this.name = 'SessionResumeError';
    this.failedSessionId = sessionId;
    this.reason = reason;
  }
}

/**
 * Error thrown when tool registration fails.
 * This can occur when:
 * - Tool name already registered
 * - Invalid tool definition
 * - Tool schema validation failed
 */
export class ToolRegistrationError extends OrchestrationError {
  /** The tool name that failed to register */
  public readonly toolName: string;
  /** Reason for the failure */
  public readonly reason: 'duplicate' | 'invalid_definition' | 'schema_error' | 'unknown';

  constructor(
    toolName: string,
    reason: 'duplicate' | 'invalid_definition' | 'schema_error' | 'unknown',
    message?: string
  ) {
    const defaultMessages: Record<typeof reason, string> = {
      duplicate: `Tool '${toolName}' is already registered`,
      invalid_definition: `Tool '${toolName}' has an invalid definition`,
      schema_error: `Tool '${toolName}' has an invalid schema`,
      unknown: `Failed to register tool '${toolName}'`,
    };

    super(message ?? defaultMessages[reason], {
      code: OrchestrationExitCode.ToolRegistrationError,
    });

    this.name = 'ToolRegistrationError';
    this.toolName = toolName;
    this.reason = reason;
  }
}

/**
 * Error thrown when API key is missing or invalid.
 * This occurs when:
 * - ANTHROPIC_API_KEY environment variable is not set
 * - API key format is invalid
 * - API key is rejected by the API
 */
export class ApiKeyError extends OrchestrationError {
  /** Reason for the failure */
  public readonly reason: 'missing' | 'invalid_format' | 'rejected' | 'unknown';

  constructor(
    reason: 'missing' | 'invalid_format' | 'rejected' | 'unknown',
    message?: string
  ) {
    const defaultMessages: Record<typeof reason, string> = {
      missing: 'ANTHROPIC_API_KEY environment variable is not set',
      invalid_format: 'ANTHROPIC_API_KEY has an invalid format',
      rejected: 'API key was rejected by the Anthropic API',
      unknown: 'API key error',
    };

    super(message ?? defaultMessages[reason], {
      code: OrchestrationExitCode.ApiKeyError,
    });

    this.name = 'ApiKeyError';
    this.reason = reason;
  }
}

// =============================================================================
// Error Type Guards
// =============================================================================

/**
 * Check if an error is an OrchestrationError
 */
export function isOrchestrationError(error: unknown): error is OrchestrationError {
  return error instanceof OrchestrationError;
}

/**
 * Check if an error is a SessionResumeError
 */
export function isSessionResumeError(error: unknown): error is SessionResumeError {
  return error instanceof SessionResumeError;
}

/**
 * Check if an error is a ToolRegistrationError
 */
export function isToolRegistrationError(error: unknown): error is ToolRegistrationError {
  return error instanceof ToolRegistrationError;
}

/**
 * Check if an error is an ApiKeyError
 */
export function isApiKeyError(error: unknown): error is ApiKeyError {
  return error instanceof ApiKeyError;
}
