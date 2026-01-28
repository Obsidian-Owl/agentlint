/**
 * Provider Requirement for Live Tests
 *
 * Import this at the top of any test file that requires a live LLM provider.
 * Supports multiple providers: Anthropic, OpenAI, or local Opencode auth.
 * If no provider is configured, the test will fail immediately with a clear message
 * rather than silently skipping or making calls that fail cryptically.
 *
 * This follows the principle: tests should FAIL, not SKIP, when prerequisites are missing.
 *
 * @module tests/lib/require-provider
 */

import { existsSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';

/**
 * Ensure at least one LLM provider is available.
 * Call this at module load time to fail fast.
 *
 * Checks for:
 * - ANTHROPIC_API_KEY environment variable
 * - OPENAI_API_KEY environment variable
 * - ~/.local/share/opencode/auth.json (Opencode SDK auth)
 *
 * @throws {Error} If no provider is configured
 *
 * @example
 * ```typescript
 * // At the top of your live test file:
 * import { requireLiveProvider } from '../lib/require-provider';
 * requireLiveProvider();
 *
 * // Now write tests that use the API...
 * ```
 */
export function requireLiveProvider(): void {
  if (!hasLiveProvider()) {
    throw new Error(
      '\n' +
        '═══════════════════════════════════════════════════════════════════\n' +
        '  No LLM Provider Configured\n' +
        '═══════════════════════════════════════════════════════════════════\n' +
        '\n' +
        '  This test file makes LIVE API calls and requires an LLM provider.\n' +
        '\n' +
        '  To run live tests, configure one of:\n' +
        '    1. export ANTHROPIC_API_KEY="sk-ant-..."\n' +
        '    2. export OPENAI_API_KEY="sk-..."\n' +
        '    3. Run: opencode auth\n' +
        '\n' +
        '  Then run:\n' +
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
 * Check if at least one LLM provider is available without throwing.
 *
 * Checks for:
 * - ANTHROPIC_API_KEY environment variable
 * - OPENAI_API_KEY environment variable
 * - ~/.local/share/opencode/auth.json (Opencode SDK auth)
 *
 * @returns True if any provider is configured
 */
export function hasLiveProvider(): boolean {
  // Check environment variables
  if (process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY) {
    return true;
  }

  // Check Opencode auth file
  const opencodeAuthPath = resolve(homedir(), '.local/share/opencode/auth.json');
  if (existsSync(opencodeAuthPath)) {
    return true;
  }

  return false;
}
