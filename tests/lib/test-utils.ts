/**
 * Test Utilities
 *
 * Common utilities for integration tests.
 *
 * @module tests/lib/test-utils
 */

// =============================================================================
// Path Isolation
// =============================================================================

let originalCwd: string | null = null;

/**
 * Set a test agentlint home directory.
 * Changes process.cwd() to the test directory for isolation.
 *
 * @param testDir - Path to test directory
 */
export function setTestAgentlintHome(testDir: string): void {
  if (originalCwd === null) {
    originalCwd = process.cwd();
  }
  process.chdir(testDir);
}

/**
 * Reset to original working directory.
 */
export function resetTestAgentlintHome(): void {
  if (originalCwd !== null) {
    process.chdir(originalCwd);
    originalCwd = null;
  }
}
