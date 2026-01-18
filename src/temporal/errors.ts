/**
 * EP09 Temporal Analysis - Error Types
 *
 * Custom error classes for temporal analysis operations.
 *
 * @module temporal/errors
 */

/**
 * Base error class for temporal analysis errors.
 */
export class TemporalError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'TemporalError';
    this.code = code;
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TemporalError);
    }
  }
}

/**
 * Error thrown when there is insufficient data for analysis.
 * For example, trend analysis requires at least 3 baselines.
 */
export class InsufficientDataError extends TemporalError {
  readonly required: number;
  readonly actual: number;

  constructor(message: string, required: number, actual: number) {
    super(message, 'INSUFFICIENT_DATA');
    this.name = 'InsufficientDataError';
    this.required = required;
    this.actual = actual;
  }
}

/**
 * Error thrown when a referenced baseline cannot be found.
 */
export class BaselineNotFoundError extends TemporalError {
  readonly baselineId: string;

  constructor(baselineId: string) {
    super(`Baseline not found: ${baselineId}`, 'BASELINE_NOT_FOUND');
    this.name = 'BaselineNotFoundError';
    this.baselineId = baselineId;
  }
}

/**
 * Error thrown when a qualitative review cannot be found.
 */
export class ReviewNotFoundError extends TemporalError {
  readonly reviewId: string;

  constructor(reviewId: string) {
    super(`Review not found: ${reviewId}`, 'REVIEW_NOT_FOUND');
    this.name = 'ReviewNotFoundError';
    this.reviewId = reviewId;
  }
}

/**
 * Error thrown when baseline schema versions are incompatible.
 */
export class SchemaVersionError extends TemporalError {
  readonly expectedVersion: string;
  readonly actualVersion: string;

  constructor(expectedVersion: string, actualVersion: string) {
    super(
      `Schema version mismatch: expected ${expectedVersion}, got ${actualVersion}`,
      'SCHEMA_VERSION_MISMATCH'
    );
    this.name = 'SchemaVersionError';
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

/**
 * Error thrown when git operations fail during correlation.
 */
export class GitCorrelationError extends TemporalError {
  constructor(message: string) {
    super(message, 'GIT_CORRELATION_ERROR');
    this.name = 'GitCorrelationError';
  }
}

/**
 * Error thrown when configuration is invalid.
 */
export class ConfigurationError extends TemporalError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
  }
}
