/**
 * Git Summary Extraction
 *
 * Extracts git repository status for welcome context.
 * Uses lightweight git commands with timeout protection.
 *
 * @module tui/welcome/git-summary
 */

import { spawn } from 'node:child_process';
import type { GitSummary } from './types';

// =============================================================================
// Constants
// =============================================================================

/** Default timeout for git operations (500ms) */
const DEFAULT_GIT_TIMEOUT = 500;

// =============================================================================
// Public API
// =============================================================================

/**
 * Get git repository summary for the given path.
 *
 * Extracts:
 * - Current branch name
 * - Number of uncommitted changes
 * - Whether there are unpushed commits
 * - Last commit message (truncated)
 * - Time since last commit
 *
 * @param projectPath - Path to the project root
 * @param timeout - Timeout in ms for git operations (default: 500)
 * @returns GitSummary or null if not a git repo or on error
 */
export async function getGitSummary(
  projectPath: string,
  timeout: number = DEFAULT_GIT_TIMEOUT
): Promise<GitSummary | null> {
  try {
    // Check if this is a git repository
    const isRepo = await runGitCommand(['rev-parse', '--git-dir'], projectPath, timeout);
    if (isRepo === null) {
      return null; // Not a git repo
    }

    // Run commands in parallel for speed
    const [branch, status, unpushed, lastCommit, commitTime] = await Promise.all([
      // Current branch
      runGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], projectPath, timeout),
      // Status (porcelain for parsing)
      runGitCommand(['status', '--porcelain'], projectPath, timeout),
      // Unpushed commits (count)
      runGitCommand(['rev-list', '--count', '@{u}..HEAD'], projectPath, timeout).catch((_err) => {
        // Expected to fail when no upstream is configured — not a security concern
        return null;
      }),
      // Last commit message (first line, max 50 chars)
      runGitCommand(['log', '-1', '--format=%s'], projectPath, timeout),
      // Last commit relative time
      runGitCommand(['log', '-1', '--format=%cr'], projectPath, timeout),
    ]);

    // Parse uncommitted changes count from status output
    const uncommittedChanges = status
      ? status.split('\n').filter((line) => line.trim().length > 0).length
      : 0;

    // Parse unpushed commits (null means no upstream or error)
    const hasUnpushedCommits = unpushed !== null && parseInt(unpushed.trim(), 10) > 0;

    return {
      branch: branch?.trim() ?? 'unknown',
      uncommittedChanges,
      hasUnpushedCommits,
      lastCommitMessage: truncate(lastCommit?.trim(), 50),
      timeSinceLastCommit: commitTime?.trim(),
    };
  } catch {
    // Any unexpected error - return null
    return null;
  }
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Run a git command with timeout.
 *
 * @param args - Git command arguments (without 'git')
 * @param cwd - Working directory
 * @param timeout - Timeout in ms
 * @returns stdout string or null on error/timeout
 */
function runGitCommand(args: string[], cwd: string, timeout: number): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    });

    let stdout = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut || code !== 0) {
        resolve(null);
      } else {
        resolve(stdout);
      }
    });

    proc.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

/**
 * Truncate a string to max length with ellipsis.
 */
function truncate(str: string | undefined, maxLength: number): string | undefined {
  if (!str) return undefined;
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
