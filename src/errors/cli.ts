/**
 * EP04 CLI Interface - Error Classes
 *
 * CLI-specific error types for command execution, output formatting,
 * and user interaction failures.
 *
 * @module errors/cli
 */

import { AgentlintError, ExitCode } from './base';

// =============================================================================
// CLI Exit Codes (extending base)
// =============================================================================

/**
 * CLI-specific exit codes.
 * Values 10-19 reserved for CLI errors.
 */
export const CLIExitCode = {
  /** Command not found or invalid */
  CommandNotFound: 10,
  /** Invalid command option or flag */
  InvalidOption: 11,
  /** Missing required argument */
  MissingArgument: 12,
  /** Output formatting failed */
  OutputError: 13,
  /** User cancelled operation */
  UserCancelled: 14,
  /** Findings present (with --fail-on-findings) */
  FindingsPresent: 15,
} as const;

export type CLIExitCode = (typeof CLIExitCode)[keyof typeof CLIExitCode];

// =============================================================================
// CLI Error Classes
// =============================================================================

/**
 * Base class for CLI-specific errors.
 */
export class CLIError extends AgentlintError {
  constructor(message: string, code: ExitCode | CLIExitCode = ExitCode.GeneralError) {
    super(message, code as ExitCode);
    this.name = 'CLIError';
  }
}

/**
 * Command not found or invalid command name.
 */
export class CommandNotFoundError extends CLIError {
  constructor(
    public readonly commandName: string,
    public readonly availableCommands?: string[]
  ) {
    const suggestion = availableCommands?.length
      ? `. Available commands: ${availableCommands.join(', ')}`
      : '';
    super(`Unknown command: ${commandName}${suggestion}`, CLIExitCode.CommandNotFound);
    this.name = 'CommandNotFoundError';
  }
}

/**
 * Invalid option provided to a command.
 */
export class InvalidOptionError extends CLIError {
  constructor(
    public readonly optionName: string,
    public readonly reason?: string
  ) {
    const detail = reason ? `: ${reason}` : '';
    super(`Invalid option '${optionName}'${detail}`, CLIExitCode.InvalidOption);
    this.name = 'InvalidOptionError';
  }
}

/**
 * Required argument missing.
 */
export class MissingArgumentError extends CLIError {
  constructor(
    public readonly argumentName: string,
    public readonly commandName?: string
  ) {
    const context = commandName ? ` for '${commandName}'` : '';
    super(`Missing required argument '${argumentName}'${context}`, CLIExitCode.MissingArgument);
    this.name = 'MissingArgumentError';
  }
}

/**
 * Output formatting or rendering failed.
 */
export class OutputError extends CLIError {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(`Output error: ${message}`, CLIExitCode.OutputError);
    this.name = 'OutputError';
  }
}

/**
 * User cancelled the operation.
 */
export class UserCancelledError extends CLIError {
  constructor(message = 'Operation cancelled by user') {
    super(message, CLIExitCode.UserCancelled);
    this.name = 'UserCancelledError';
  }
}

/**
 * Findings are present and --fail-on-findings was set.
 */
export class FindingsPresentError extends CLIError {
  constructor(
    public readonly findingsCount: number,
    public readonly criticalCount: number = 0
  ) {
    const critical = criticalCount > 0 ? ` (${criticalCount} critical)` : '';
    super(`Analysis found ${findingsCount} issues${critical}`, CLIExitCode.FindingsPresent);
    this.name = 'FindingsPresentError';
  }
}

/**
 * Configuration file not found or invalid.
 */
export class ConfigNotFoundError extends CLIError {
  constructor(
    public readonly configPath: string,
    public readonly configType?: string
  ) {
    const type = configType ? `${configType} ` : '';
    super(`${type}Configuration not found at: ${configPath}`, ExitCode.GeneralError);
    this.name = 'ConfigNotFoundError';
  }
}

/**
 * Baseline not found for comparison.
 */
export class BaselineNotFoundError extends CLIError {
  constructor(public readonly baselineId?: string) {
    const idPart = baselineId ? ` '${baselineId}'` : '';
    super(
      `No baseline found${idPart}. Run 'agentlint baseline' to create one.`,
      ExitCode.GeneralError
    );
    this.name = 'BaselineNotFoundError';
  }
}

/**
 * Finding not found for trace command.
 */
export class FindingNotFoundError extends CLIError {
  constructor(public readonly findingId: string) {
    super(
      `Finding '${findingId}' not found. Run 'agentlint analyse' first.`,
      ExitCode.GeneralError
    );
    this.name = 'FindingNotFoundError';
  }
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Checks if an error is a CLI error.
 */
export function isCLIError(error: unknown): error is CLIError {
  return error instanceof CLIError;
}

/**
 * Checks if an error is a command not found error.
 */
export function isCommandNotFoundError(error: unknown): error is CommandNotFoundError {
  return error instanceof CommandNotFoundError;
}

/**
 * Checks if an error is an invalid option error.
 */
export function isInvalidOptionError(error: unknown): error is InvalidOptionError {
  return error instanceof InvalidOptionError;
}

/**
 * Checks if an error is a missing argument error.
 */
export function isMissingArgumentError(error: unknown): error is MissingArgumentError {
  return error instanceof MissingArgumentError;
}

/**
 * Checks if an error is an output error.
 */
export function isOutputError(error: unknown): error is OutputError {
  return error instanceof OutputError;
}

/**
 * Checks if an error is a user cancelled error.
 */
export function isUserCancelledError(error: unknown): error is UserCancelledError {
  return error instanceof UserCancelledError;
}

/**
 * Checks if an error is a findings present error.
 */
export function isFindingsPresentError(error: unknown): error is FindingsPresentError {
  return error instanceof FindingsPresentError;
}

/**
 * Checks if an error is a baseline not found error.
 */
export function isBaselineNotFoundError(error: unknown): error is BaselineNotFoundError {
  return error instanceof BaselineNotFoundError;
}

/**
 * Checks if an error is a finding not found error.
 */
export function isFindingNotFoundError(error: unknown): error is FindingNotFoundError {
  return error instanceof FindingNotFoundError;
}
