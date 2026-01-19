/**
 * EP09 Temporal Analysis - Git Utilities
 *
 * Provides git-related utilities for temporal analysis including
 * commit extraction and repository status checking.
 *
 * @module temporal/utils/git
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Git commit information.
 */
export interface GitCommitInfo {
  /** Full commit hash (40 characters) */
  hash: string;
  /** Short commit hash (7 characters) */
  shortHash: string;
  /** Commit author name */
  author?: string;
  /** Commit date (ISO-8601) */
  date?: string;
  /** Commit message (first line) */
  subject?: string;
}

/**
 * Options for git operations.
 */
export interface GitOptions {
  /** Working directory (default: process.cwd()) */
  cwd?: string;
  /** Timeout in milliseconds (default: 5000) */
  timeout?: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Default timeout for git commands */
const DEFAULT_TIMEOUT = 5000;

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the current git commit hash.
 *
 * Returns the full SHA-1 hash of the current HEAD commit.
 *
 * @param options - Git options
 * @returns Commit hash or null if not in a git repository
 *
 * @example
 * ```typescript
 * const commit = await getCurrentCommit();
 * if (commit) {
 *   console.log(`Current commit: ${commit}`);
 * }
 * ```
 */
export async function getCurrentCommit(options: GitOptions = {}): Promise<string | null> {
  const cwd = options.cwd ?? process.cwd();

  try {
    const proc = Bun.spawn(['git', 'rev-parse', 'HEAD'], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    // Handle timeout
    const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT;
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        proc.kill();
        resolve(null);
      }, timeoutMs);
    });

    const resultPromise = (async (): Promise<string | null> => {
      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      if (exitCode === 0) {
        return output.trim();
      }
      return null;
    })();

    return await Promise.race([resultPromise, timeoutPromise]);
  } catch {
    return null;
  }
}

/**
 * Get detailed commit information.
 *
 * Returns structured information about a specific commit or HEAD.
 *
 * @param commitish - Commit reference (hash, branch, tag), defaults to HEAD
 * @param options - Git options
 * @returns Commit info or null if not found/not in a git repo
 *
 * @example
 * ```typescript
 * const info = await getCommitInfo();
 * if (info) {
 *   console.log(`${info.shortHash}: ${info.subject}`);
 * }
 * ```
 */
export async function getCommitInfo(
  commitish = 'HEAD',
  options: GitOptions = {}
): Promise<GitCommitInfo | null> {
  const cwd = options.cwd ?? process.cwd();

  try {
    // Format: hash|shortHash|author|date|subject
    const format = '%H|%h|%an|%aI|%s';
    const proc = Bun.spawn(['git', 'log', '-1', `--format=${format}`, commitish], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    // Handle timeout
    const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT;
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        proc.kill();
        resolve(null);
      }, timeoutMs);
    });

    const resultPromise = (async (): Promise<GitCommitInfo | null> => {
      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0 || !output.trim()) {
        return null;
      }

      const parts = output.trim().split('|');
      if (parts.length < 2) {
        return null;
      }

      const [hash, shortHash, author, date, ...subjectParts] = parts;

      // Handle subject that might contain | characters
      const subject = subjectParts.join('|');

      const result: GitCommitInfo = {
        hash: hash ?? '',
        shortHash: shortHash ?? '',
      };

      if (author) {
        result.author = author;
      }
      if (date) {
        result.date = date;
      }
      if (subject) {
        result.subject = subject;
      }

      return result;
    })();

    return await Promise.race([resultPromise, timeoutPromise]);
  } catch {
    return null;
  }
}

/**
 * Check if the current directory is inside a git repository.
 *
 * @param options - Git options
 * @returns True if inside a git repository
 *
 * @example
 * ```typescript
 * if (await isGitRepository()) {
 *   const commit = await getCurrentCommit();
 * }
 * ```
 */
export async function isGitRepository(options: GitOptions = {}): Promise<boolean> {
  const cwd = options.cwd ?? process.cwd();

  try {
    const proc = Bun.spawn(['git', 'rev-parse', '--is-inside-work-tree'], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    return exitCode === 0 && output.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Get the root directory of the git repository.
 *
 * @param options - Git options
 * @returns Repository root path or null if not in a git repo
 *
 * @example
 * ```typescript
 * const root = await getRepositoryRoot();
 * if (root) {
 *   console.log(`Git root: ${root}`);
 * }
 * ```
 */
export async function getRepositoryRoot(options: GitOptions = {}): Promise<string | null> {
  const cwd = options.cwd ?? process.cwd();

  try {
    const proc = Bun.spawn(['git', 'rev-parse', '--show-toplevel'], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode === 0) {
      return output.trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the current branch name.
 *
 * @param options - Git options
 * @returns Branch name or null if in detached HEAD state or not in a git repo
 *
 * @example
 * ```typescript
 * const branch = await getCurrentBranch();
 * if (branch) {
 *   console.log(`Current branch: ${branch}`);
 * }
 * ```
 */
export async function getCurrentBranch(options: GitOptions = {}): Promise<string | null> {
  const cwd = options.cwd ?? process.cwd();

  try {
    const proc = Bun.spawn(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode === 0) {
      const branch = output.trim();
      // 'HEAD' means detached HEAD state
      return branch === 'HEAD' ? null : branch;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get commits between two dates.
 *
 * Returns commit messages (short format) for commits in the date range.
 *
 * @param after - Start date (ISO-8601)
 * @param before - End date (ISO-8601)
 * @param options - Git options
 * @returns Array of commit messages (shortHash: subject)
 *
 * @example
 * ```typescript
 * const commits = await getCommitsBetweenDates(
 *   '2026-01-01T00:00:00Z',
 *   '2026-01-15T00:00:00Z'
 * );
 * console.log(`${commits.length} commits in range`);
 * ```
 */
export async function getCommitsBetweenDates(
  after: string,
  before: string,
  options: GitOptions = {}
): Promise<string[]> {
  const cwd = options.cwd ?? process.cwd();

  try {
    const proc = Bun.spawn(
      ['git', 'log', `--after=${after}`, `--before=${before}`, '--format=%h: %s', '--reverse'],
      {
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );

    // Handle timeout
    const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT;
    const timeoutPromise = new Promise<string[]>((resolve) => {
      setTimeout(() => {
        proc.kill();
        resolve([]);
      }, timeoutMs);
    });

    const resultPromise = (async (): Promise<string[]> => {
      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        return [];
      }

      return output
        .trim()
        .split('\n')
        .filter((line) => line.length > 0);
    })();

    return await Promise.race([resultPromise, timeoutPromise]);
  } catch {
    return [];
  }
}

/**
 * Get commits between two git hashes.
 *
 * Returns commit messages (short format) for commits between the two hashes.
 * Uses exclusive start (fromHash is not included) and inclusive end (toHash is included).
 *
 * Per ADR-0019, returns raw commit data for agent interpretation.
 *
 * @param fromHash - Start commit hash (exclusive - not included in results)
 * @param toHash - End commit hash (inclusive - included in results)
 * @param options - Git options
 * @returns Array of commit messages (shortHash: subject)
 *
 * @example
 * ```typescript
 * const commits = await getCommitsBetweenHashes('abc123', 'def456');
 * console.log(`${commits.length} commits between hashes`);
 * ```
 */
export async function getCommitsBetweenHashes(
  fromHash: string,
  toHash: string,
  options: GitOptions = {}
): Promise<string[]> {
  const cwd = options.cwd ?? process.cwd();

  try {
    // Use git log with range: fromHash..toHash (exclusive start, inclusive end)
    const proc = Bun.spawn(
      ['git', 'log', `${fromHash}..${toHash}`, '--format=%h: %s', '--reverse'],
      {
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );

    // Handle timeout
    const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT;
    const timeoutPromise = new Promise<string[]>((resolve) => {
      setTimeout(() => {
        proc.kill();
        resolve([]);
      }, timeoutMs);
    });

    const resultPromise = (async (): Promise<string[]> => {
      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        return [];
      }

      return output
        .trim()
        .split('\n')
        .filter((line) => line.length > 0);
    })();

    return await Promise.race([resultPromise, timeoutPromise]);
  } catch {
    return [];
  }
}

/**
 * Get detailed commit metadata between two hashes.
 *
 * Returns full commit information for commits between the two hashes.
 * Per ADR-0019, returns raw metadata for agent interpretation - does NOT
 * categorize impact (agent determines relevance).
 *
 * @param fromHash - Start commit hash (exclusive)
 * @param toHash - End commit hash (inclusive)
 * @param options - Git options
 * @returns Array of commit info objects
 *
 * @example
 * ```typescript
 * const commits = await getCommitDetailsBetweenHashes('abc123', 'def456');
 * for (const commit of commits) {
 *   console.log(`${commit.shortHash}: ${commit.subject} by ${commit.author}`);
 * }
 * ```
 */
export async function getCommitDetailsBetweenHashes(
  fromHash: string,
  toHash: string,
  options: GitOptions = {}
): Promise<GitCommitInfo[]> {
  const cwd = options.cwd ?? process.cwd();

  try {
    // Format: hash|shortHash|author|date|subject
    const format = '%H|%h|%an|%aI|%s';
    const proc = Bun.spawn(
      ['git', 'log', `${fromHash}..${toHash}`, `--format=${format}`, '--reverse'],
      {
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );

    // Handle timeout
    const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT;
    const timeoutPromise = new Promise<GitCommitInfo[]>((resolve) => {
      setTimeout(() => {
        proc.kill();
        resolve([]);
      }, timeoutMs);
    });

    const resultPromise = (async (): Promise<GitCommitInfo[]> => {
      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        return [];
      }

      const lines = output
        .trim()
        .split('\n')
        .filter((line) => line.length > 0);

      return lines.map((line) => {
        const [hash, shortHash, author, date, ...subjectParts] = line.split('|');
        const subject = subjectParts.join('|');

        const result: GitCommitInfo = {
          hash: hash ?? '',
          shortHash: shortHash ?? '',
        };

        if (author) result.author = author;
        if (date) result.date = date;
        if (subject) result.subject = subject;

        return result;
      });
    })();

    return await Promise.race([resultPromise, timeoutPromise]);
  } catch {
    return [];
  }
}
