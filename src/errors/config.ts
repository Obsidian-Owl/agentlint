/**
 * EP05 Config Analysis Tools - Error Classes
 *
 * Error types for configuration parsing and analysis.
 * All config errors extend ConfigError which extends AgentlintError.
 *
 * @module errors/config
 */

import { AgentlintError, ExitCode } from './base';
import type { Position, WarningCode } from '../tools/config/types';

// =============================================================================
// Exit Codes for Config Analysis
// =============================================================================

/**
 * Extended exit codes for config analysis errors.
 */
export const ConfigExitCode = {
  ...ExitCode,
  /** Configuration file not found */
  ConfigNotFound: 30,
  /** Configuration file parse error */
  ConfigParseError: 31,
  /** Configuration validation failed */
  ConfigValidationError: 32,
  /** Configuration discovery failed */
  ConfigDiscoveryError: 33,
} as const;

export type ConfigExitCode = (typeof ConfigExitCode)[keyof typeof ConfigExitCode];

// =============================================================================
// Base Config Error
// =============================================================================

/**
 * Base error class for all config-related errors.
 * Extends AgentlintError with config-specific context.
 */
export class ConfigError extends AgentlintError {
  /** File path if applicable */
  public readonly filePath: string | undefined;

  constructor(
    message: string,
    options?: {
      code?: ConfigExitCode | undefined;
      filePath?: string | undefined;
      cause?: Error | undefined;
    }
  ) {
    super(message, (options?.code ?? ConfigExitCode.GeneralError) as ExitCode);
    this.name = 'ConfigError';
    this.filePath = options?.filePath;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

// =============================================================================
// Specific Config Errors
// =============================================================================

/**
 * Configuration file not found.
 */
export class ConfigNotFoundError extends ConfigError {
  constructor(filePath: string, options?: { cause?: Error }) {
    super(`Configuration file not found: ${filePath}`, {
      code: ConfigExitCode.ConfigNotFound,
      filePath,
      cause: options?.cause,
    });
    this.name = 'ConfigNotFoundError';
  }
}

/**
 * Configuration file could not be parsed.
 */
export class ConfigParseError extends ConfigError {
  /** Position in the file where error occurred */
  public readonly position: Position | undefined;
  /** Warning code if applicable */
  public readonly warningCode: WarningCode | undefined;
  /** Whether partial parsing was still possible */
  public readonly recoverable: boolean;

  constructor(
    message: string,
    options?: {
      filePath?: string;
      position?: Position;
      warningCode?: WarningCode;
      recoverable?: boolean;
      cause?: Error;
    }
  ) {
    const positionStr = options?.position
      ? ` at line ${options.position.start.line}, column ${options.position.start.column}`
      : '';
    super(`Parse error${positionStr}: ${message}`, {
      code: ConfigExitCode.ConfigParseError,
      filePath: options?.filePath,
      cause: options?.cause,
    });
    this.name = 'ConfigParseError';
    this.position = options?.position;
    this.warningCode = options?.warningCode;
    this.recoverable = options?.recoverable ?? false;
  }
}

/**
 * Configuration validation failed.
 */
export class ConfigValidationError extends ConfigError {
  /** Validation errors encountered */
  public readonly validationErrors: string[];

  constructor(
    message: string,
    options?: {
      filePath?: string;
      validationErrors?: string[];
      cause?: Error;
    }
  ) {
    super(message, {
      code: ConfigExitCode.ConfigValidationError,
      filePath: options?.filePath,
      cause: options?.cause,
    });
    this.name = 'ConfigValidationError';
    this.validationErrors = options?.validationErrors ?? [];
  }
}

/**
 * Configuration discovery failed.
 */
export class ConfigDiscoveryError extends ConfigError {
  /** Directory that was being searched */
  public readonly searchDir: string | undefined;

  constructor(
    message: string,
    options?: {
      searchDir?: string;
      cause?: Error;
    }
  ) {
    super(`Discovery error: ${message}`, {
      code: ConfigExitCode.ConfigDiscoveryError,
      filePath: options?.searchDir,
      cause: options?.cause,
    });
    this.name = 'ConfigDiscoveryError';
    this.searchDir = options?.searchDir;
  }
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if error is a ConfigError.
 */
export function isConfigError(error: unknown): error is ConfigError {
  return error instanceof ConfigError;
}

/**
 * Check if error is a ConfigNotFoundError.
 */
export function isConfigNotFoundError(error: unknown): error is ConfigNotFoundError {
  return error instanceof ConfigNotFoundError;
}

/**
 * Check if error is a ConfigParseError.
 */
export function isConfigParseError(error: unknown): error is ConfigParseError {
  return error instanceof ConfigParseError;
}

/**
 * Check if error is a ConfigValidationError.
 */
export function isConfigValidationError(error: unknown): error is ConfigValidationError {
  return error instanceof ConfigValidationError;
}

/**
 * Check if error is a ConfigDiscoveryError.
 */
export function isConfigDiscoveryError(error: unknown): error is ConfigDiscoveryError {
  return error instanceof ConfigDiscoveryError;
}
