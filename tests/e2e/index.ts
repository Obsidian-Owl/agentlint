/**
 * EP11 E2E Tests - Public Exports
 *
 * Central export for E2E test utilities and helpers.
 *
 * @module tests/e2e
 */

// =============================================================================
// Helpers
// =============================================================================

export {
  runCLI,
  createTestFixture,
  getFixturePath,
  parseJSONOutput,
  extractFindings,
  outputContains,
  isCI,
  hasAPIKey,
  SKIP_LIVE_TESTS,
  SKIP_NON_CI,
} from './helpers';

export type { CLIResult, CLIOptions, TestFixture } from './helpers';
