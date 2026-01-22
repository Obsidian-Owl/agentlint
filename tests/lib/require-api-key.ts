/**
 * API Key Requirement for Live Tests
 *
 * Import this at the top of any test file that requires ANTHROPIC_API_KEY.
 * If the key is missing, the test will fail immediately with a clear message
 * rather than silently skipping or making calls that fail cryptically.
 *
 * This follows the principle: tests should FAIL, not SKIP, when prerequisites are missing.
 *
 * @module tests/lib/require-api-key
 */

/**
 * Ensure ANTHROPIC_API_KEY is available.
 * Call this at module load time to fail fast.
 *
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
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      '\n' +
        '═══════════════════════════════════════════════════════════════════\n' +
        '  ANTHROPIC_API_KEY Required\n' +
        '═══════════════════════════════════════════════════════════════════\n' +
        '\n' +
        '  This test file makes LIVE API calls and requires ANTHROPIC_API_KEY.\n' +
        '\n' +
        '  To run live tests:\n' +
        '    export ANTHROPIC_API_KEY="sk-ant-..."\n' +
        '    bun run test:live\n' +
        '\n' +
        '  To run safe tests (no API calls):\n' +
        '    bun run test\n' +
        '\n' +
        '  This test was likely triggered by running `bun test` directly.\n' +
        '  Use `bun run test` instead for the safe default.\n' +
        '\n' +
        '═══════════════════════════════════════════════════════════════════\n'
    );
  }
}

/**
 * Check if API key is available without throwing.
 *
 * @returns True if ANTHROPIC_API_KEY is set
 */
export function hasAPIKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Get the API key, throwing if not available.
 *
 * @returns The API key value
 * @throws {Error} If ANTHROPIC_API_KEY is not set
 */
export function getAPIKey(): string {
  requireAPIKey();
  return process.env.ANTHROPIC_API_KEY!;
}
