/**
 * API Key Requirement for Live Tests (DEPRECATED)
 *
 * @deprecated Use `require-provider.ts` instead for multi-provider support.
 * This module is maintained for backward compatibility only.
 *
 * Import this at the top of any test file that requires ANTHROPIC_API_KEY.
 * If the key is missing, the test will fail immediately with a clear message
 * rather than silently skipping or making calls that fail cryptically.
 *
 * This follows the principle: tests should FAIL, not SKIP, when prerequisites are missing.
 *
 * @module tests/lib/require-api-key
 */

import { requireLiveProvider, hasLiveProvider } from './require-provider';

/**
 * Ensure ANTHROPIC_API_KEY is available.
 * Call this at module load time to fail fast.
 *
 * @deprecated Use `requireLiveProvider()` from `require-provider.ts` instead.
 * @throws {Error} If ANTHROPIC_API_KEY is not set
 *
 * @example
 * ```typescript
 * // At the top of your live test file:
 * import { requireAPIKey } from '../lib/require-api-key';
 * requireAPIKey();
 *
 * // Now write tests that use the API...
 * ```
 */
export function requireAPIKey(): void {
  requireLiveProvider();
}

/**
 * Check if API key is available without throwing.
 *
 * @deprecated Use `hasLiveProvider()` from `require-provider.ts` instead.
 * @returns True if ANTHROPIC_API_KEY is set
 */
export function hasAPIKey(): boolean {
  return hasLiveProvider();
}

/**
 * Get the API key, throwing if not available.
 *
 * @deprecated Use `requireLiveProvider()` from `require-provider.ts` instead.
 * @returns The API key value (ANTHROPIC_API_KEY or OPENAI_API_KEY)
 * @throws {Error} If no provider is configured
 */
export function getAPIKey(): string {
  requireLiveProvider();
  return process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || '';
}
