/**
 * EP07 Causal Tracing Engine - Evidence Collector
 *
 * Collects evidence from sessions, git, and config analysis
 * to build causal chains for issue tracing.
 *
 * @module src/tools/causal/evidence-collector
 */

import { existsSync } from 'node:fs';
import { v4 as uuidv4 } from 'uuid';

import type { EvidenceItem, Position } from './types';
import { searchSessions } from '../sessions/search';
import { DEFAULT_SESSIONS_DB_PATH } from '../sessions/utils';
import { GitEvidenceCollector } from './git-evidence';

// =============================================================================
// Error Message Constants (T049-T050)
// =============================================================================

/**
 * User-friendly error messages for common FTS index issues.
 */
export const FTS_ERROR_MESSAGES = {
  /** Error message when database file doesn't exist */
  DATABASE_NOT_FOUND:
    'Sessions database not found. Run `agentlint sessions --index` to create the index.',
  /** Error message when schema version mismatch */
  SCHEMA_MISMATCH:
    'Sessions database has incompatible schema. Run `agentlint sessions --index --force` to rebuild.',
  /** Error message for FTS5 table missing */
  FTS_NOT_INITIALIZED:
    'FTS5 search index not initialized. Run `agentlint sessions --index` to create it.',
  /** Error message for stale index */
  INDEX_STALE:
    'Sessions index may be stale. Consider running `agentlint sessions --index` to refresh.',
  /** Generic search failure */
  SEARCH_FAILED: 'Session search failed. Check database integrity and try again.',
} as const;

/**
 * Classify a search error into a user-friendly message.
 *
 * @param errorMessage - The raw error message
 * @param dbPath - Path to the database
 * @returns User-friendly error message
 */
export function classifySearchError(errorMessage: string, dbPath: string): string {
  const lower = errorMessage.toLowerCase();

  // Check for database file issues
  if (!existsSync(dbPath)) {
    return FTS_ERROR_MESSAGES.DATABASE_NOT_FOUND;
  }

  // Check for schema mismatch
  if (lower.includes('schema version mismatch') || lower.includes('recreate')) {
    return FTS_ERROR_MESSAGES.SCHEMA_MISMATCH;
  }

  // Check for FTS table issues
  if (
    lower.includes('no such table') ||
    lower.includes('session_entries') ||
    lower.includes('fts5')
  ) {
    return FTS_ERROR_MESSAGES.FTS_NOT_INITIALIZED;
  }

  // Check for query syntax errors (usually user's fault, not our error)
  if (lower.includes('syntax error') || lower.includes('fts5')) {
    return `Search query error: ${errorMessage}. Try simplifying your search terms.`;
  }

  // Default to generic message
  return FTS_ERROR_MESSAGES.SEARCH_FAILED;
}

// =============================================================================
// Types
// =============================================================================

/**
 * Options for collecting session evidence.
 */
export interface CollectSessionEvidenceOptions {
  /** Keywords to search for in sessions */
  keywords: string[];
  /** Only search sessions in this project */
  projectPath?: string | undefined;
  /** Only search sessions after this date */
  since?: string | undefined;
  /** Only search sessions before this date */
  until?: string | undefined;
  /** Maximum number of results to return */
  limit?: number | undefined;
  /** Path to the sessions database */
  dbPath?: string | undefined;
}

/**
 * Options for collecting evidence from a specific file location.
 */
export interface CollectLocationEvidenceOptions {
  /** Path to the file where issue was found */
  filePath: string;
  /** Line number where issue was found */
  lineNumber?: number | undefined;
  /** Range of lines to search around the issue (default: 10) */
  lineRange?: number | undefined;
  /** Only search sessions in this project */
  projectPath?: string | undefined;
  /** Path to the sessions database */
  dbPath?: string | undefined;
}

/**
 * Result of evidence collection.
 */
export interface CollectEvidenceResult {
  /** Collected evidence items */
  evidence: EvidenceItem[];
  /** Total matches found (may exceed evidence.length due to limit) */
  totalMatches: number;
  /** Query execution time in milliseconds */
  queryTimeMs: number;
  /** Any errors or warnings */
  warnings?: string[] | undefined;
}

// =============================================================================
// Evidence Collector Class
// =============================================================================

/**
 * Collects evidence from various sources to support causal chain construction.
 *
 * The EvidenceCollector searches session logs, correlates tool calls with
 * file locations, and extracts temporal markers to build evidence for
 * causal chains.
 *
 * @example
 * ```typescript
 * const collector = new EvidenceCollector();
 *
 * // Collect session evidence by keywords
 * const result = collector.collectSessionEvidence({
 *   keywords: ['authentication', 'error'],
 *   projectPath: '/my/project',
 *   since: '2026-01-15T00:00:00Z',
 * });
 *
 * // Collect evidence related to a specific file location
 * const locationResult = collector.collectLocationEvidence({
 *   filePath: '/my/project/src/auth.ts',
 *   lineNumber: 42,
 * });
 * ```
 */
export class EvidenceCollector {
  private readonly dbPath: string;

  /**
   * Create a new EvidenceCollector.
   *
   * @param dbPath - Path to the sessions database (defaults to ~/.agentlint/sessions.db)
   */
  constructor(dbPath: string = DEFAULT_SESSIONS_DB_PATH) {
    this.dbPath = dbPath;
  }

  /**
   * Collect evidence from session logs matching the given keywords.
   *
   * Uses FTS5 full-text search with BM25 ranking to find relevant
   * session entries. Results are sorted by relevance score.
   *
   * @param options - Search options including keywords and filters
   * @returns Evidence items with metadata
   */
  collectSessionEvidence(options: CollectSessionEvidenceOptions): CollectEvidenceResult {
    const startTime = Date.now();
    const { keywords, projectPath, since, until, limit = 50, dbPath = this.dbPath } = options;

    // Build FTS5 query from keywords
    const query = this.buildFtsQuery(keywords);
    if (!query) {
      return {
        evidence: [],
        totalMatches: 0,
        queryTimeMs: Date.now() - startTime,
        warnings: ['No valid keywords provided'],
      };
    }

    // Use EP06 search function - build input object conditionally
    const searchInput: Parameters<typeof searchSessions>[0] = {
      query,
      limit,
      offset: 0,
    };
    if (projectPath) searchInput.project = projectPath;
    if (since) searchInput.since = since;
    if (until) searchInput.until = until;

    const searchResult = searchSessions(searchInput, { dbPath });

    if (!searchResult.success) {
      const errorMsg = searchResult.error?.message ?? 'Search failed';
      const userFriendlyMsg = classifySearchError(errorMsg, dbPath);
      return {
        evidence: [],
        totalMatches: 0,
        queryTimeMs: Date.now() - startTime,
        warnings: [userFriendlyMsg],
      };
    }

    // Convert search results to evidence items
    const evidence = searchResult.results.map((result) => this.searchResultToEvidence(result));

    return {
      evidence,
      totalMatches: searchResult.totalMatches,
      queryTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Collect evidence from sessions that touched a specific file location.
   *
   * Searches for tool calls (Edit, Write, Read) that operated on the
   * specified file, optionally within a range of lines around the issue.
   *
   * @param options - Location options including file path and line number
   * @returns Evidence items related to the file location
   */
  collectLocationEvidence(options: CollectLocationEvidenceOptions): CollectEvidenceResult {
    const startTime = Date.now();
    const { filePath, lineNumber, lineRange = 10, projectPath, dbPath = this.dbPath } = options;

    // Use the search function with file path in query
    const query = `file_path:"${this.escapeQuotes(filePath)}"`;

    const searchInput: Parameters<typeof searchSessions>[0] = {
      query,
      limit: 100,
      offset: 0,
    };
    if (projectPath) searchInput.project = projectPath;

    const searchResult = searchSessions(searchInput, { dbPath });

    if (!searchResult.success) {
      const errorMsg = searchResult.error?.message ?? 'Search failed';
      const userFriendlyMsg = classifySearchError(errorMsg, dbPath);
      return {
        evidence: [],
        totalMatches: 0,
        queryTimeMs: Date.now() - startTime,
        warnings: [userFriendlyMsg],
      };
    }

    // Filter by line number range if specified
    let filteredResults = searchResult.results;
    if (lineNumber !== undefined) {
      const minLine = lineNumber - lineRange;
      const maxLine = lineNumber + lineRange;
      filteredResults = searchResult.results.filter((result) => {
        if (!result.lineNumber) return true; // Include results without line numbers
        return result.lineNumber >= minLine && result.lineNumber <= maxLine;
      });
    }

    // Convert to evidence items
    const evidence = filteredResults.map((result) => this.searchResultToEvidence(result));

    return {
      evidence,
      totalMatches: filteredResults.length,
      queryTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Sort evidence items by timestamp (ascending - oldest first).
   *
   * This ensures causal ordering where earlier events come before
   * later effects.
   *
   * @param evidence - Evidence items to sort
   * @returns Sorted evidence items
   */
  sortByTimestamp(evidence: EvidenceItem[]): EvidenceItem[] {
    return [...evidence].sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });
  }

  /**
   * Find the earliest evidence item (potential trigger).
   *
   * @param evidence - Evidence items to search
   * @returns The earliest evidence item, or undefined if empty
   */
  findTrigger(evidence: EvidenceItem[]): EvidenceItem | undefined {
    if (evidence.length === 0) return undefined;
    return this.sortByTimestamp(evidence)[0];
  }

  /**
   * Create a temporal marker evidence item.
   *
   * @param timestamp - When the event occurred
   * @param description - What the event was
   * @param metadata - Additional context
   * @returns A TemporalMarker evidence item
   */
  createTemporalMarker(
    timestamp: string,
    description: string,
    metadata?: Record<string, unknown>
  ): EvidenceItem {
    return {
      id: uuidv4(),
      type: 'TemporalMarker',
      source: 'temporal-analysis',
      timestamp,
      content: description,
      metadata,
    };
  }

  /**
   * Create a position object from file coordinates.
   *
   * @param filePath - Path to the file
   * @param line - Line number (optional)
   * @param column - Column number (optional)
   * @param snippet - Code snippet (optional)
   * @returns Position object
   */
  createPosition(filePath: string, line?: number, column?: number, snippet?: string): Position {
    const position: Position = { filePath };
    if (line !== undefined) position.line = line;
    if (column !== undefined) position.column = column;
    if (snippet !== undefined) position.snippet = snippet;
    return position;
  }

  // ===========================================================================
  // Git Evidence Collection (T055)
  // ===========================================================================

  /**
   * Collect evidence from git history for a specific file position.
   *
   * Uses git blame to find the commit that introduced a specific line.
   *
   * @param position - File and line to investigate
   * @param projectPath - Path to the git repository
   * @returns Git-based evidence items
   */
  collectGitBlameEvidence(position: Position, projectPath?: string): CollectEvidenceResult {
    return this.collectGitEvidenceInternal({ position }, projectPath);
  }

  /**
   * Collect evidence from git history using pickaxe search.
   *
   * Finds commits that added or removed specific strings.
   *
   * @param searchTerms - Strings to search for in git history
   * @param options - Search options (since, until, maxResults)
   * @param projectPath - Path to the git repository
   * @returns Git-based evidence items
   */
  collectGitPickaxeEvidence(
    searchTerms: string[],
    options: {
      since?: string;
      until?: string;
      maxResults?: number;
    } = {},
    projectPath?: string
  ): CollectEvidenceResult {
    return this.collectGitEvidenceInternal({ searchTerms, ...options }, projectPath);
  }

  /**
   * Collect combined evidence from git (blame + pickaxe).
   *
   * @param options - Collection options
   * @param projectPath - Path to the git repository
   * @returns Combined git evidence
   */
  collectGitEvidence(
    options: {
      position?: Position | undefined;
      searchTerms?: string[] | undefined;
      since?: string | undefined;
      until?: string | undefined;
      maxResults?: number | undefined;
    },
    projectPath?: string
  ): CollectEvidenceResult {
    return this.collectGitEvidenceInternal(options, projectPath);
  }

  /**
   * Internal helper for git evidence collection.
   */
  private collectGitEvidenceInternal(
    options: {
      position?: Position | undefined;
      searchTerms?: string[] | undefined;
      since?: string | undefined;
      until?: string | undefined;
      maxResults?: number | undefined;
    },
    projectPath?: string
  ): CollectEvidenceResult {
    const startTime = Date.now();
    const gitCollector = new GitEvidenceCollector(projectPath);

    if (!gitCollector.isGitRepository()) {
      return {
        evidence: [],
        totalMatches: 0,
        queryTimeMs: Date.now() - startTime,
        warnings: ['Not a git repository - git evidence collection skipped'],
      };
    }

    const result = gitCollector.collectEvidence({
      position: options.position,
      searchTerms: options.searchTerms,
      maxResults: options.maxResults,
      since: options.since,
      until: options.until,
    });

    return {
      evidence: result.evidence,
      totalMatches: result.evidence.length,
      queryTimeMs: result.queryTimeMs,
      warnings: result.warnings,
    };
  }

  /**
   * Collect all available evidence (session + git) for an issue.
   *
   * Combines session search results with git history correlation
   * for comprehensive evidence gathering.
   *
   * @param options - Collection options
   * @returns Combined evidence from all sources
   */
  collectAllEvidence(options: {
    keywords: string[];
    position?: Position;
    projectPath?: string;
    since?: string;
    until?: string;
    maxResults?: number;
    dbPath?: string;
  }): CollectEvidenceResult {
    const startTime = Date.now();
    const allEvidence: EvidenceItem[] = [];
    const warnings: string[] = [];

    // Collect session evidence
    const sessionResult = this.collectSessionEvidence({
      keywords: options.keywords,
      projectPath: options.projectPath,
      since: options.since,
      until: options.until,
      limit: options.maxResults,
      dbPath: options.dbPath,
    });
    allEvidence.push(...sessionResult.evidence);
    if (sessionResult.warnings) {
      warnings.push(...sessionResult.warnings);
    }

    // Collect git evidence
    const gitResult = this.collectGitEvidence(
      {
        position: options.position,
        searchTerms: options.keywords,
        since: options.since,
        until: options.until,
        maxResults: options.maxResults,
      },
      options.projectPath
    );
    allEvidence.push(...gitResult.evidence);
    if (gitResult.warnings) {
      warnings.push(...gitResult.warnings);
    }

    // Deduplicate by source (commit hash or session ID)
    const uniqueEvidence = this.deduplicateEvidence(allEvidence);

    return {
      evidence: uniqueEvidence,
      totalMatches: sessionResult.totalMatches + gitResult.totalMatches,
      queryTimeMs: Date.now() - startTime,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Deduplicate evidence by source.
   */
  private deduplicateEvidence(evidence: EvidenceItem[]): EvidenceItem[] {
    const seen = new Set<string>();
    return evidence.filter((e) => {
      const key = `${e.type}:${e.source}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Build an FTS5 query from keywords.
   */
  private buildFtsQuery(keywords: string[]): string {
    if (keywords.length === 0) return '';

    // Escape special characters and join with OR
    const escaped = keywords
      .filter((k) => k.trim().length > 0)
      .map((k) => this.escapeQuotes(k.trim()));

    if (escaped.length === 0) return '';
    if (escaped.length === 1) return escaped[0]!;

    return escaped.join(' OR ');
  }

  /**
   * Escape quotes in a search term.
   */
  private escapeQuotes(term: string): string {
    return term.replace(/"/g, '""');
  }

  /**
   * Convert a search result to an evidence item.
   */
  private searchResultToEvidence(result: {
    sessionId: string;
    timestamp: string;
    contentSnippet: string;
    relevanceScore: number;
    filePath: string;
    lineNumber: number;
    projectPath: string;
    role?: string;
    toolName?: string;
  }): EvidenceItem {
    const position =
      result.filePath && result.filePath.length > 0
        ? this.createPosition(result.filePath, result.lineNumber || undefined)
        : undefined;

    return {
      id: uuidv4(),
      type: result.toolName ? 'ToolTrace' : 'SessionMatch',
      source: result.sessionId,
      timestamp: result.timestamp,
      content: result.contentSnippet,
      position,
      metadata: {
        relevanceScore: result.relevanceScore,
        projectPath: result.projectPath,
        role: result.role,
        toolName: result.toolName,
      },
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new EvidenceCollector instance.
 *
 * @param dbPath - Optional path to the sessions database
 * @returns EvidenceCollector instance
 */
export function createEvidenceCollector(dbPath?: string): EvidenceCollector {
  return new EvidenceCollector(dbPath);
}
