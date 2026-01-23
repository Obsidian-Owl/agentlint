/**
 * EP07 Causal Tracing Engine - Git Evidence Collector
 *
 * Collects evidence from git history using blame and pickaxe search
 * to correlate issues with commits that introduced them.
 *
 * @module src/tools/causal/git-evidence
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { v4 as uuidv4 } from 'uuid';

import type { EvidenceItem, Position } from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for pickaxe search.
 */
export interface PickaxeOptions {
  /** Maximum number of results to return */
  maxResults?: number | undefined;
  /** Filter to specific file or directory path */
  filePath?: string | undefined;
  /** Only search commits after this date (ISO format) */
  since?: string | undefined;
  /** Only search commits before this date (ISO format) */
  until?: string | undefined;
  /** Include diff snippet in content */
  includeDiff?: boolean | undefined;
}

/**
 * Options for combined evidence collection.
 */
export interface CollectEvidenceOptions {
  /** File position to run git blame on */
  position?: Position | undefined;
  /** Search terms for pickaxe search */
  searchTerms?: string[] | undefined;
  /** Maximum results per method */
  maxResults?: number | undefined;
  /** Date range filter */
  since?: string | undefined;
  until?: string | undefined;
}

/**
 * Result of evidence collection.
 */
export interface GitEvidenceResult {
  /** Collected evidence items */
  evidence: EvidenceItem[];
  /** Total commits searched */
  totalCommits?: number | undefined;
  /** Query execution time in milliseconds */
  queryTimeMs: number;
  /** Any warnings encountered */
  warnings?: string[] | undefined;
  /** Methods used for collection */
  methodsUsed?: string[] | undefined;
}

/**
 * Parsed git blame line.
 */
interface BlameInfo {
  commitHash: string;
  author: string;
  authorEmail: string;
  timestamp: string;
  lineNumber: number;
  content: string;
  summary: string;
}

/**
 * Parsed git log entry.
 */
interface LogEntry {
  commitHash: string;
  author: string;
  authorEmail: string;
  timestamp: string;
  subject: string;
  body: string;
  files: string[];
}

// =============================================================================
// GitEvidenceCollector Class
// =============================================================================

/**
 * Collects git-based evidence for causal chain construction.
 *
 * Uses `git blame` to find which commit introduced a specific line
 * and `git log -S` (pickaxe) to find commits that added/removed a string.
 *
 * @example
 * ```typescript
 * const collector = new GitEvidenceCollector('/my/project');
 *
 * // Find who introduced a specific line
 * const blameResult = await collector.collectBlameEvidence({
 *   filePath: 'src/api.ts',
 *   line: 42,
 * });
 *
 * // Find commits that added a specific string
 * const pickaxeResult = await collector.collectPickaxeEvidence('apiKey');
 *
 * // Combine both methods
 * const combined = await collector.collectEvidence({
 *   position: { filePath: 'src/api.ts', line: 42 },
 *   searchTerms: ['apiKey', 'secret'],
 * });
 * ```
 */
export class GitEvidenceCollector {
  private readonly projectPath: string;
  private readonly gitRoot: string | null;

  /**
   * Create a new GitEvidenceCollector.
   *
   * @param projectPath - Path to the project (must be within a git repository)
   */
  constructor(projectPath: string = process.cwd()) {
    this.projectPath = resolve(projectPath);
    this.gitRoot = this.findGitRoot();
  }

  /**
   * Check if the project path is within a git repository.
   *
   * @returns True if in a git repository
   */
  isGitRepository(): boolean {
    return this.gitRoot !== null;
  }

  /**
   * Collect evidence from git blame for a specific file position.
   *
   * @param position - File and line to blame
   * @returns Evidence items from the commit that introduced the line
   */
  collectBlameEvidence(position: Position): GitEvidenceResult {
    const startTime = Date.now();
    const warnings: string[] = [];

    if (!this.gitRoot) {
      return {
        evidence: [],
        queryTimeMs: Date.now() - startTime,
        warnings: ['Not a git repository'],
      };
    }

    const filePath = this.resolveFilePath(position.filePath);
    if (!existsSync(filePath)) {
      return {
        evidence: [],
        queryTimeMs: Date.now() - startTime,
        warnings: [`File not found: ${position.filePath}`],
      };
    }

    try {
      const blameInfo = this.runGitBlame(filePath, position.line);
      if (!blameInfo) {
        return {
          evidence: [],
          queryTimeMs: Date.now() - startTime,
          warnings: ['Unable to retrieve blame information'],
        };
      }

      const evidence: EvidenceItem = {
        id: uuidv4(),
        type: 'GitCorrelation',
        source: blameInfo.commitHash,
        timestamp: blameInfo.timestamp,
        content: blameInfo.summary,
        position: {
          filePath: position.filePath,
          line: position.line,
          snippet: blameInfo.content,
        },
        metadata: {
          author: blameInfo.author,
          authorEmail: blameInfo.authorEmail,
          method: 'blame',
        },
      };

      return {
        evidence: [evidence],
        queryTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Git blame failed: ${message}`);
      return {
        evidence: [],
        queryTimeMs: Date.now() - startTime,
        warnings,
      };
    }
  }

  /**
   * Collect evidence using git pickaxe search (git log -S).
   *
   * Finds commits that added or removed the specified search term.
   *
   * @param searchTerm - String to search for in commit diffs
   * @param options - Search options
   * @returns Evidence items from matching commits
   */
  collectPickaxeEvidence(searchTerm: string, options: PickaxeOptions = {}): GitEvidenceResult {
    const startTime = Date.now();
    const { maxResults = 10, filePath, since, until, includeDiff = false } = options;

    if (!this.gitRoot) {
      return {
        evidence: [],
        queryTimeMs: Date.now() - startTime,
        warnings: ['Not a git repository'],
      };
    }

    try {
      const logEntries = this.runGitPickaxe(searchTerm, {
        maxResults,
        filePath,
        since,
        until,
        includeDiff,
      });

      const evidence: EvidenceItem[] = logEntries.map((entry) => ({
        id: uuidv4(),
        type: 'GitCorrelation' as const,
        source: entry.commitHash,
        timestamp: entry.timestamp,
        content: entry.subject + (entry.body ? '\n\n' + entry.body : ''),
        position: entry.files.length > 0 ? { filePath: entry.files[0]! } : undefined,
        metadata: {
          author: entry.author,
          authorEmail: entry.authorEmail,
          method: 'pickaxe',
          searchTerm,
          files: entry.files,
        },
      }));

      return {
        evidence,
        totalCommits: logEntries.length,
        queryTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        evidence: [],
        queryTimeMs: Date.now() - startTime,
        warnings: [`Git pickaxe search failed: ${message}`],
      };
    }
  }

  /**
   * Collect evidence using both blame and pickaxe methods.
   *
   * Deduplicates evidence by commit hash and sorts by timestamp.
   *
   * @param options - Collection options
   * @returns Combined and deduplicated evidence
   */
  collectEvidence(options: CollectEvidenceOptions): GitEvidenceResult {
    const startTime = Date.now();
    const { position, searchTerms = [], maxResults = 10, since, until } = options;

    const allEvidence: EvidenceItem[] = [];
    const warnings: string[] = [];
    const methodsUsed: string[] = [];

    // Collect blame evidence if position provided
    if (position) {
      methodsUsed.push('blame');
      const blameResult = this.collectBlameEvidence(position);
      allEvidence.push(...blameResult.evidence);
      if (blameResult.warnings) {
        warnings.push(...blameResult.warnings);
      }
    }

    // Collect pickaxe evidence for each search term
    if (searchTerms.length > 0) {
      methodsUsed.push('pickaxe');
      for (const term of searchTerms) {
        const pickaxeResult = this.collectPickaxeEvidence(term, {
          maxResults,
          since,
          until,
        });
        allEvidence.push(...pickaxeResult.evidence);
        if (pickaxeResult.warnings) {
          warnings.push(...pickaxeResult.warnings);
        }
      }
    }

    // Deduplicate by commit hash
    const uniqueEvidence = this.deduplicateByCommit(allEvidence);

    // Sort by timestamp (newest first)
    const sortedEvidence = this.sortByTimestamp(uniqueEvidence);

    return {
      evidence: sortedEvidence,
      queryTimeMs: Date.now() - startTime,
      warnings: warnings.length > 0 ? warnings : undefined,
      methodsUsed,
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Find the git root directory.
   */
  private findGitRoot(): string | null {
    const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: this.projectPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (result.status !== 0 || result.error) {
      return null;
    }

    return result.stdout.trim();
  }

  /**
   * Resolve a file path relative to the project.
   */
  private resolveFilePath(filePath: string): string {
    if (filePath.startsWith('/')) {
      return filePath;
    }
    return join(this.projectPath, filePath);
  }

  /**
   * Run git blame for a specific line.
   */
  private runGitBlame(filePath: string, line?: number): BlameInfo | null {
    // Build argument array - no shell escaping needed with spawnSync
    const args = ['blame', '--porcelain'];

    if (line !== undefined) {
      args.push('-L', `${line},${line}`);
    }

    args.push(filePath);

    const result = spawnSync('git', args, {
      cwd: this.gitRoot!,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (result.status !== 0 || result.error) {
      return null;
    }

    return this.parseBlameOutput(result.stdout, line);
  }

  /**
   * Parse git blame porcelain output.
   */
  private parseBlameOutput(output: string, line?: number): BlameInfo | null {
    const lines = output.split('\n');
    if (lines.length === 0) return null;

    let commitHash = '';
    let author = '';
    let authorEmail = '';
    let timestamp = '';
    let summary = '';
    let content = '';

    for (const l of lines) {
      if (l.match(/^[a-f0-9]{40}/)) {
        commitHash = l.substring(0, 40);
      } else if (l.startsWith('author ')) {
        author = l.substring(7);
      } else if (l.startsWith('author-mail ')) {
        authorEmail = l.substring(12).replace(/[<>]/g, '');
      } else if (l.startsWith('author-time ')) {
        const unixTime = parseInt(l.substring(12), 10);
        timestamp = new Date(unixTime * 1000).toISOString();
      } else if (l.startsWith('summary ')) {
        summary = l.substring(8);
      } else if (l.startsWith('\t')) {
        content = l.substring(1);
      }
    }

    if (!commitHash) return null;

    return {
      commitHash: commitHash.substring(0, 7), // Short hash
      author,
      authorEmail,
      timestamp,
      lineNumber: line ?? 1,
      content,
      summary,
    };
  }

  /**
   * Run git log -S (pickaxe) search.
   */
  private runGitPickaxe(searchTerm: string, options: PickaxeOptions): LogEntry[] {
    const { maxResults = 10, filePath, since, until } = options;

    // Build argument array - no shell escaping needed with spawnSync
    // Use null bytes (%x00) as delimiters to avoid issues with | in commit messages
    const args = [
      'log',
      `-S${searchTerm}`,
      '--format=%H%x00%an%x00%ae%x00%aI%x00%s%x00%b%x00',
      '-n',
      String(maxResults),
    ];

    // Validate and add date filters
    if (since && this.isValidDateString(since)) {
      args.push(`--since=${since}`);
    }
    if (until && this.isValidDateString(until)) {
      args.push(`--until=${until}`);
    }

    // Add file path filter (use -- separator for safety)
    if (filePath) {
      args.push('--', filePath);
    }

    const result = spawnSync('git', args, {
      cwd: this.gitRoot!,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    if (result.status !== 0 || result.error) {
      return [];
    }

    return this.parseLogOutput(result.stdout);
  }

  /**
   * Parse git log output.
   * Format: %H%x00%an%x00%ae%x00%aI%x00%s%x00%b%x00 (null-byte delimited)
   */
  private parseLogOutput(output: string): LogEntry[] {
    const entries: LogEntry[] = [];
    // Split on null bytes - each commit entry has 6 fields
    const parts = output.split('\0');

    // Process in chunks of 6 (commit, author, email, timestamp, subject, body)
    // Each entry ends with a null byte, so last element is empty
    for (let i = 0; i + 5 < parts.length; i += 6) {
      const commitHash = parts[i]!.trim();
      const author = parts[i + 1]!;
      const authorEmail = parts[i + 2]!;
      const timestamp = parts[i + 3]!;
      const subject = parts[i + 4]!;
      const body = parts[i + 5]!;

      if (!commitHash) continue;

      entries.push({
        commitHash: commitHash.substring(0, 7),
        author,
        authorEmail,
        timestamp: this.normalizeTimestamp(timestamp),
        subject,
        body,
        files: [], // Could add --name-only to get files
      });
    }

    return entries;
  }

  /**
   * Normalize a git timestamp to ISO 8601 format with Z suffix.
   */
  private normalizeTimestamp(timestamp: string): string {
    try {
      return new Date(timestamp).toISOString();
    } catch {
      return timestamp;
    }
  }

  /**
   * Validate that a string is a safe date format for git.
   *
   * Accepts ISO-8601 dates (e.g., 2024-01-15, 2024-01-15T10:30:00Z)
   * and relative dates (e.g., "1 week ago", "yesterday").
   */
  private isValidDateString(dateStr: string): boolean {
    // Check for ISO-8601 format (strict)
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:?\d{2})?)?$/;
    if (iso8601Regex.test(dateStr)) {
      return true;
    }

    // Check for safe relative date formats (e.g., "1 week ago", "yesterday")
    // Only allow alphanumeric characters, spaces, and common date words
    // Note: \w includes underscores but that's safe for git date parsing
    const relativeDateRegex = /^[a-zA-Z0-9\s]+$/;
    if (relativeDateRegex.test(dateStr) && dateStr.length < 50) {
      return true;
    }

    return false;
  }

  /**
   * Deduplicate evidence by commit hash.
   */
  private deduplicateByCommit(evidence: EvidenceItem[]): EvidenceItem[] {
    const seen = new Set<string>();
    return evidence.filter((e) => {
      if (seen.has(e.source)) {
        return false;
      }
      seen.add(e.source);
      return true;
    });
  }

  /**
   * Sort evidence by timestamp (newest first).
   */
  private sortByTimestamp(evidence: EvidenceItem[]): EvidenceItem[] {
    return [...evidence].sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA; // Descending (newest first)
    });
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new GitEvidenceCollector instance.
 *
 * @param projectPath - Optional path to the project
 * @returns GitEvidenceCollector instance
 */
export function createGitEvidenceCollector(projectPath?: string): GitEvidenceCollector {
  return new GitEvidenceCollector(projectPath);
}
