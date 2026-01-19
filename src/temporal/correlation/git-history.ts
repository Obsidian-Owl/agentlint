/**
 * EP09 Temporal Analysis - Git History Fetcher
 *
 * Provides detailed git commit metadata for correlation with temporal analysis.
 * Per ADR-0019 (Tool/Agent Boundary), returns raw metadata for agent interpretation.
 * Does NOT categorize impact - agent determines relevance.
 *
 * @module temporal/correlation/git-history
 */

import type { GitOptions } from '../utils/git';

// =============================================================================
// Types
// =============================================================================

/**
 * Detailed commit metadata for correlation analysis.
 *
 * Per ADR-0019, provides raw data for agent interpretation.
 * Agent determines which commits are relevant to observed changes.
 */
export interface CommitMetadata {
  /** Full commit hash (40 characters) */
  hash: string;
  /** Short commit hash (7 characters) */
  shortHash: string;
  /** Commit author name */
  author: string;
  /** Commit date (ISO-8601) */
  date: string;
  /** Commit message (first line only) */
  subject: string;
  /** Full commit message (all lines) */
  body?: string;
  /** Files changed in this commit */
  filesChanged: string[];
  /** Number of insertions */
  insertions: number;
  /** Number of deletions */
  deletions: number;
}

/**
 * Summary of commits between two points.
 */
export interface CommitRangeSummary {
  /** Total commits in range */
  totalCommits: number;
  /** Unique files changed across all commits */
  uniqueFilesChanged: string[];
  /** Total insertions across all commits */
  totalInsertions: number;
  /** Total deletions across all commits */
  totalDeletions: number;
  /** Date range covered */
  dateRange: {
    earliest: string;
    latest: string;
  };
}

// =============================================================================
// Constants
// =============================================================================

/** Default timeout for git commands */
const DEFAULT_TIMEOUT = 10000;

/** Maximum commits to return (prevent memory issues on large histories) */
const MAX_COMMITS = 100;

// =============================================================================
// Public API
// =============================================================================

/**
 * Get detailed commit metadata between two dates.
 *
 * Per ADR-0019, returns raw metadata for agent interpretation.
 * Agent determines which commits are relevant to changes.
 *
 * @param after - Start date (ISO-8601)
 * @param before - End date (ISO-8601)
 * @param options - Git options
 * @returns Array of commit metadata
 *
 * @example
 * ```typescript
 * const commits = await getCommitMetadataBetweenDates(
 *   baseline1.createdAt,
 *   baseline2.createdAt
 * );
 * // Agent interprets which commits correlate with observed metric changes
 * ```
 */
export async function getCommitMetadataBetweenDates(
  after: string,
  before: string,
  options: GitOptions = {}
): Promise<CommitMetadata[]> {
  const cwd = options.cwd ?? process.cwd();

  try {
    // Get commit hashes in date range
    const hashesProc = Bun.spawn(
      [
        'git',
        'log',
        `--after=${after}`,
        `--before=${before}`,
        '--format=%H',
        '--reverse',
        `-n${MAX_COMMITS}`,
      ],
      {
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );

    const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT;
    const hashesOutput = await Promise.race([
      new Response(hashesProc.stdout).text(),
      new Promise<string>((resolve) => setTimeout(() => resolve(''), timeoutMs)),
    ]);

    await hashesProc.exited;

    const hashes = hashesOutput
      .trim()
      .split('\n')
      .filter((h) => h.length > 0);

    if (hashes.length === 0) {
      return [];
    }

    // Get metadata for each commit
    const commits: CommitMetadata[] = [];
    for (const hash of hashes) {
      const metadata = await getCommitMetadata(hash, options);
      if (metadata) {
        commits.push(metadata);
      }
    }

    return commits;
  } catch {
    return [];
  }
}

/**
 * Get detailed commit metadata between two git hashes.
 *
 * Per ADR-0019, returns raw metadata for agent interpretation.
 * Agent determines which commits are relevant to changes.
 *
 * @param fromHash - Start commit hash (exclusive)
 * @param toHash - End commit hash (inclusive)
 * @param options - Git options
 * @returns Array of commit metadata
 *
 * @example
 * ```typescript
 * const commits = await getCommitMetadataBetweenHashes(
 *   baseline1.gitCommit,
 *   baseline2.gitCommit
 * );
 * // Agent interprets which commits correlate with observed metric changes
 * ```
 */
export async function getCommitMetadataBetweenHashes(
  fromHash: string,
  toHash: string,
  options: GitOptions = {}
): Promise<CommitMetadata[]> {
  const cwd = options.cwd ?? process.cwd();

  try {
    // Get commit hashes in range
    const hashesProc = Bun.spawn(
      ['git', 'log', `${fromHash}..${toHash}`, '--format=%H', '--reverse', `-n${MAX_COMMITS}`],
      {
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );

    const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT;
    const hashesOutput = await Promise.race([
      new Response(hashesProc.stdout).text(),
      new Promise<string>((resolve) => setTimeout(() => resolve(''), timeoutMs)),
    ]);

    await hashesProc.exited;

    const hashes = hashesOutput
      .trim()
      .split('\n')
      .filter((h) => h.length > 0);

    if (hashes.length === 0) {
      return [];
    }

    // Get metadata for each commit
    const commits: CommitMetadata[] = [];
    for (const hash of hashes) {
      const metadata = await getCommitMetadata(hash, options);
      if (metadata) {
        commits.push(metadata);
      }
    }

    return commits;
  } catch {
    return [];
  }
}

/**
 * Get detailed metadata for a single commit.
 *
 * @param hash - Commit hash
 * @param options - Git options
 * @returns Commit metadata or null if not found
 */
export async function getCommitMetadata(
  hash: string,
  options: GitOptions = {}
): Promise<CommitMetadata | null> {
  const cwd = options.cwd ?? process.cwd();

  try {
    // Get commit info with format
    // Format: hash|shortHash|author|date|subject
    const format = '%H|%h|%an|%aI|%s';
    const infoProc = Bun.spawn(['git', 'log', '-1', `--format=${format}`, hash], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT;
    const infoOutput = await Promise.race([
      new Response(infoProc.stdout).text(),
      new Promise<string>((resolve) => setTimeout(() => resolve(''), timeoutMs)),
    ]);

    const infoExitCode = await infoProc.exited;
    if (infoExitCode !== 0 || !infoOutput.trim()) {
      return null;
    }

    const parts = infoOutput.trim().split('|');
    if (parts.length < 5) {
      return null;
    }

    const [fullHash, shortHash, author, date, ...subjectParts] = parts;
    const subject = subjectParts.join('|');

    // Get files changed with stats
    const statsProc = Bun.spawn(['git', 'show', '--stat', '--format=', hash], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const statsOutput = await Promise.race([
      new Response(statsProc.stdout).text(),
      new Promise<string>((resolve) => setTimeout(() => resolve(''), timeoutMs)),
    ]);

    await statsProc.exited;

    // Parse files and stats from output
    const { filesChanged, insertions, deletions } = parseStatOutput(statsOutput);

    return {
      hash: fullHash ?? '',
      shortHash: shortHash ?? '',
      author: author ?? '',
      date: date ?? '',
      subject: subject ?? '',
      filesChanged,
      insertions,
      deletions,
    };
  } catch {
    return null;
  }
}

/**
 * Get summary of commits between two dates.
 *
 * @param after - Start date (ISO-8601)
 * @param before - End date (ISO-8601)
 * @param options - Git options
 * @returns Commit range summary or null if no commits
 */
export async function getCommitRangeSummary(
  after: string,
  before: string,
  options: GitOptions = {}
): Promise<CommitRangeSummary | null> {
  const commits = await getCommitMetadataBetweenDates(after, before, options);

  if (commits.length === 0) {
    return null;
  }

  // Collect unique files
  const allFiles = new Set<string>();
  let totalInsertions = 0;
  let totalDeletions = 0;

  for (const commit of commits) {
    for (const file of commit.filesChanged) {
      allFiles.add(file);
    }
    totalInsertions += commit.insertions;
    totalDeletions += commit.deletions;
  }

  // Find date range
  const dates = commits.map((c) => new Date(c.date).getTime()).filter((d) => !isNaN(d));
  const earliest = dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : after;
  const latest = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : before;

  return {
    totalCommits: commits.length,
    uniqueFilesChanged: Array.from(allFiles),
    totalInsertions,
    totalDeletions,
    dateRange: {
      earliest,
      latest,
    },
  };
}

/**
 * Filter commits that modified specific files or patterns.
 *
 * Per ADR-0019, returns matching commits for agent interpretation.
 * Agent determines which are relevant.
 *
 * @param commits - Commits to filter
 * @param patterns - File patterns to match (supports simple wildcards)
 * @returns Filtered commits
 *
 * @example
 * ```typescript
 * const configCommits = filterCommitsByFiles(commits, ['CLAUDE.md', '*.yaml']);
 * // Agent interprets which config changes correlate with improvements
 * ```
 */
export function filterCommitsByFiles(
  commits: CommitMetadata[],
  patterns: string[]
): CommitMetadata[] {
  return commits.filter((commit) => {
    return commit.filesChanged.some((file) => {
      return patterns.some((pattern) => matchPattern(file, pattern));
    });
  });
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Parse git show --stat output to extract files and stats.
 */
function parseStatOutput(output: string): {
  filesChanged: string[];
  insertions: number;
  deletions: number;
} {
  const lines = output.trim().split('\n');
  const filesChanged: string[] = [];
  let insertions = 0;
  let deletions = 0;

  for (const line of lines) {
    // Skip empty lines and the summary line
    if (!line.trim() || line.includes('files changed') || line.includes('file changed')) {
      // Try to parse summary line
      const summaryMatch = line.match(/(\d+) insertions?\(\+\)/);
      const deletionsMatch = line.match(/(\d+) deletions?\(-\)/);
      if (summaryMatch) {
        insertions = parseInt(summaryMatch[1] ?? '0', 10);
      }
      if (deletionsMatch) {
        deletions = parseInt(deletionsMatch[1] ?? '0', 10);
      }
      continue;
    }

    // Parse file line: " path/to/file.ts | 10 ++++-----"
    const fileMatch = line.match(/^\s*(.+?)\s+\|/);
    if (fileMatch && fileMatch[1]) {
      filesChanged.push(fileMatch[1].trim());
    }
  }

  return { filesChanged, insertions, deletions };
}

/**
 * Simple pattern matching with wildcard support.
 */
function matchPattern(filename: string, pattern: string): boolean {
  // Escape regex special characters except *
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  // Convert * to regex equivalent
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$');
  return regex.test(filename);
}
