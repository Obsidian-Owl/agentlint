/**
 * Global Test Preload - Blocks Live Tests by Default
 *
 * This preload runs BEFORE every test file. It detects if the current test
 * file is a "live" test (makes API calls) and blocks execution unless
 * explicitly opted in via RUN_LIVE_TESTS=1.
 *
 * This prevents Claude Code (or anyone) from accidentally running expensive
 * tests by running `bun test` without thinking.
 *
 * @module tests/preload
 */

import { registerAllPrompts } from '../src/prompts/register-prompts';

registerAllPrompts();

const currentFile = process.argv[1] ?? '';

// Patterns that indicate a test makes live API calls
// Note: -live.test.ts pattern covers honeyhive-api-live.test.ts, vercel-proxy-live.test.ts, etc.
const LIVE_TEST_PATTERNS = ['/e2e/', '/evals/', '-live.test.ts', 'live.test.ts'];

const isLiveTest = LIVE_TEST_PATTERNS.some((pattern) => currentFile.includes(pattern));

if (isLiveTest && !process.env.RUN_LIVE_TESTS) {
  console.error(`
════════════════════════════════════════════════════════════════════════════════
  BLOCKED: Live test requires explicit opt-in
════════════════════════════════════════════════════════════════════════════════

  File: ${currentFile}

  This test makes LIVE API CALLS and costs money.

  To run safe tests only:
    bun run test

  To run live tests (requires ANTHROPIC_API_KEY):
    RUN_LIVE_TESTS=1 bun test tests/e2e

  Or use the npm scripts:
    bun run test:live    # e2e tests
    bun run test:evals   # evaluation tests

════════════════════════════════════════════════════════════════════════════════
`);
  process.exit(1);
}
