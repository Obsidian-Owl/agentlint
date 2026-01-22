/**
 * EP11 E2E Test Helpers
 *
 * Common utilities for end-to-end tests.
 * Provides helpers for running agentlint CLI and validating output.
 *
 * @module tests/e2e/helpers
 */

import { spawn } from 'bun';
import { resolve } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

// =============================================================================
// Types
// =============================================================================

/**
 * Result from running a CLI command.
 */
export interface CLIResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

/**
 * Options for running CLI commands.
 */
export interface CLIOptions {
  /** Working directory for the command */
  cwd?: string;
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Timeout in milliseconds (default: 60000) */
  timeout?: number;
  /** Whether to capture JSON output */
  json?: boolean;
}

/**
 * Test fixture configuration.
 */
export interface TestFixture {
  /** Unique fixture ID */
  id: string;
  /** Fixture directory path */
  path: string;
  /** Cleanup function */
  cleanup: () => void;
}

// =============================================================================
// CLI Runner
// =============================================================================

/**
 * Run the agentlint CLI with given arguments.
 *
 * @param args - CLI arguments
 * @param options - Execution options
 * @returns CLI result with stdout, stderr, and exit code
 *
 * @example
 * ```typescript
 * const result = await runCLI(['scan', '-d', './project']);
 * expect(result.exitCode).toBe(0);
 * ```
 */
export async function runCLI(args: string[], options: CLIOptions = {}): Promise<CLIResult> {
  const cwd = options.cwd ?? process.cwd();
  const timeout = options.timeout ?? 60000;
  const cliPath = resolve(__dirname, '../../src/cli.ts');

  const startTime = performance.now();

  // Build environment
  const env: Record<string, string> = {
    ...process.env,
    ...options.env,
  } as Record<string, string>;

  // Add --json flag if requested
  const fullArgs = options.json ? [...args, '--json'] : args;

  const proc = spawn({
    cmd: ['bun', 'run', cliPath, ...fullArgs],
    cwd,
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // Set up timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      proc.kill();
      reject(new Error(`CLI command timed out after ${timeout}ms`));
    }, timeout);
  });

  try {
    // Wait for process to complete or timeout
    const exitCode = await Promise.race([proc.exited, timeoutPromise]);

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const duration = performance.now() - startTime;

    return {
      exitCode,
      stdout,
      stderr,
      duration,
    };
  } catch (error) {
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const duration = performance.now() - startTime;

    if (error instanceof Error && error.message.includes('timed out')) {
      return {
        exitCode: -1,
        stdout,
        stderr: stderr + '\n[TIMEOUT]',
        duration,
      };
    }
    throw error;
  }
}

// =============================================================================
// Fixture Management
// =============================================================================

/**
 * Create a temporary test fixture directory.
 *
 * @param name - Optional name prefix for the fixture
 * @returns Test fixture with path and cleanup function
 *
 * @example
 * ```typescript
 * const fixture = createTestFixture('my-test');
 * try {
 *   // Use fixture.path for test files
 *   await writeFile(join(fixture.path, 'CLAUDE.md'), content);
 *   const result = await runCLI(['analyse'], { cwd: fixture.path });
 * } finally {
 *   fixture.cleanup();
 * }
 * ```
 */
export function createTestFixture(name?: string): TestFixture {
  const id = randomUUID().slice(0, 8);
  const fixtureName = name ? `${name}-${id}` : `test-${id}`;
  const fixturePath = resolve(tmpdir(), 'agentlint-e2e', fixtureName);

  // Create fixture directory
  mkdirSync(fixturePath, { recursive: true });

  return {
    id,
    path: fixturePath,
    cleanup: () => {
      if (existsSync(fixturePath)) {
        rmSync(fixturePath, { recursive: true, force: true });
      }
    },
  };
}

/**
 * Create a fixture from an existing fixtures directory.
 *
 * @param fixtureName - Name of the fixture in tests/e2e/fixtures/
 * @returns Path to the fixture directory
 */
export function getFixturePath(fixtureName: string): string {
  return resolve(__dirname, 'fixtures', fixtureName);
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Parse JSON output from CLI.
 *
 * @param result - CLI result
 * @returns Parsed JSON or null if invalid
 */
export function parseJSONOutput<T = unknown>(result: CLIResult): T | null {
  try {
    return JSON.parse(result.stdout) as T;
  } catch {
    return null;
  }
}

/**
 * Extract findings from JSON output.
 *
 * @param result - CLI result with JSON output
 * @returns Array of findings or empty array
 */
export function extractFindings(result: CLIResult): unknown[] {
  const json = parseJSONOutput<{ findings?: unknown[] }>(result);
  return json?.findings ?? [];
}

/**
 * Check if CLI output contains expected text.
 *
 * @param result - CLI result
 * @param text - Text to search for
 * @returns True if text found in stdout or stderr
 */
export function outputContains(result: CLIResult, text: string): boolean {
  return result.stdout.includes(text) || result.stderr.includes(text);
}

// =============================================================================
// Environment Helpers
// =============================================================================

/**
 * Check if running in CI environment.
 */
export function isCI(): boolean {
  return process.env.CI === 'true';
}

/**
 * Check if API key is available for live tests.
 */
export function hasAPIKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Skip condition for live tests.
 */
export const SKIP_LIVE_TESTS = !hasAPIKey();

/**
 * Skip condition for CI-only tests.
 */
export const SKIP_NON_CI = !isCI();
