/**
 * Retry logic with exponential backoff for network resilience.
 *
 * @module orchestration/retry
 */

import { getDefaultLogger } from '../debug/logger';
import { DEBUG_NAMESPACES } from '../debug/namespaces';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for retry behavior.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 8) */
  maxRetries: number;
  /** Initial delay in milliseconds before first retry (default: 1000) */
  initialDelayMs: number;
  /** Maximum delay in milliseconds (default: 60000) */
  maxDelayMs: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier: number;
  /** Jitter factor to randomize delays (default: 0.1) */
  jitterFactor: number;
}

/**
 * Callback for retry events.
 */
export type RetryCallback = (attempt: number, delay: number, error: Error) => void;

/**
 * Telemetry tracker interface for retry operations.
 * Subset of TelemetryTracker to avoid circular dependencies.
 */
export interface RetryTelemetryTracker {
  trackRetryAttempt(
    operationType: string,
    attemptNumber: number,
    success: boolean,
    retryTimeMs: number
  ): void;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default retry configuration.
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 8,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

/**
 * HTTP status codes that should trigger a retry.
 */
const RETRYABLE_STATUS_CODES = [
  429, // Too Many Requests (rate limit)
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
  529, // Anthropic overloaded
] as const;

/**
 * Error codes that should trigger a retry.
 */
const RETRYABLE_ERROR_CODES = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
] as const;

/**
 * Error message patterns that indicate retryable errors.
 */
const RETRYABLE_ERROR_PATTERNS = [
  /timeout/i,
  /timed out/i,
  /connection reset/i,
  /network error/i,
  /socket hang up/i,
  /overloaded/i,
  /rate limit/i,
  /too many requests/i,
] as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if an error is retryable.
 *
 * @param error - The error to check
 * @returns true if the error should trigger a retry
 */
function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  // Check for Anthropic API errors with status codes
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;

    // Check status code
    const status =
      err.status ?? err.statusCode ?? (err.response as Record<string, unknown>)?.status;
    if (
      typeof status === 'number' &&
      RETRYABLE_STATUS_CODES.includes(status as (typeof RETRYABLE_STATUS_CODES)[number])
    ) {
      return true;
    }

    // Check error code
    const code = err.code ?? err.errno;
    if (
      typeof code === 'string' &&
      RETRYABLE_ERROR_CODES.includes(code as (typeof RETRYABLE_ERROR_CODES)[number])
    ) {
      return true;
    }
  }

  // Check error message
  let message: string;
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    message = String((error as { message: unknown }).message);
  } else {
    message = '';
  }
  for (const pattern of RETRYABLE_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate backoff delay with jitter.
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
function calculateBackoff(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  // Exponential backoff: initialDelay * multiplier^attempt
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter: ±jitterFactor of the delay
  const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);
  const finalDelay = Math.max(0, cappedDelay + jitter);

  return Math.round(finalDelay);
}

/**
 * Sleep for a specified duration.
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Main Retry Function
// =============================================================================

/**
 * Execute a function with automatic retry on transient failures.
 *
 * @param fn - The async function to execute
 * @param config - Retry configuration (optional)
 * @param onRetry - Callback invoked before each retry (optional)
 * @param operationType - Operation type for telemetry tracking (optional)
 * @param telemetryTracker - Telemetry tracker instance (optional)
 * @returns The function result
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   { maxRetries: 5 },
 *   undefined,
 *   'api_fetch',
 *   telemetryTracker
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: RetryCallback,
  operationType?: string,
  telemetryTracker?: RetryTelemetryTracker
): Promise<T> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const logger = getDefaultLogger().child(DEBUG_NAMESPACES.ORCHESTRATION);

  let lastError: Error | undefined;
  const startTime = Date.now();
  let retryStartTime: number | undefined;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      const result = await fn();

      // Track successful retry (if telemetry enabled and this was a retry)
      if (telemetryTracker && operationType && attempt > 0 && retryStartTime !== undefined) {
        const retryTimeMs = Date.now() - retryStartTime;
        telemetryTracker.trackRetryAttempt(operationType, attempt + 1, true, retryTimeMs);
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this error is retryable
      if (!isRetryableError(error)) {
        logger.debug('Non-retryable error, failing immediately', {
          error: lastError.message,
          attempt,
        });
        throw lastError;
      }

      // Track failed retry (if telemetry enabled and this was a retry, not the initial attempt)
      if (telemetryTracker && operationType && attempt > 0 && retryStartTime !== undefined) {
        const retryTimeMs = Date.now() - retryStartTime;
        telemetryTracker.trackRetryAttempt(operationType, attempt + 1, false, retryTimeMs);
      }

      // Check if we have retries left
      if (attempt >= fullConfig.maxRetries) {
        logger.warn('All retries exhausted', {
          error: lastError.message,
          attempts: attempt + 1,
          totalTimeMs: Date.now() - startTime,
        });
        throw lastError;
      }

      // Calculate delay
      const delay = calculateBackoff(attempt, fullConfig);

      logger.info('Retrying after transient error', {
        error: lastError.message,
        attempt: attempt + 1,
        maxRetries: fullConfig.maxRetries,
        delayMs: delay,
      });

      // Invoke callback if provided
      if (onRetry) {
        onRetry(attempt + 1, delay, lastError);
      }

      // Mark the start of retry timing (after the sleep)
      // Wait before retrying
      await sleep(delay);
      retryStartTime = Date.now();
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError ?? new Error('Retry failed with no error');
}
