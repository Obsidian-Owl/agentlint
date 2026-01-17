/**
 * EP06 Session Analysis Tools - Session Search
 *
 * Full-text search with BM25 ranking and date filtering.
 *
 * @module src/tools/sessions/search
 */

import type {
  SearchSessionsInput,
  SearchSessionsOutput,
  SearchResult,
  TimeRange,
  SessionError,
} from './types';
import { openDatabase, closeDatabase } from '../../persistence/sessions/fts';
import { DEFAULT_SESSIONS_DB_PATH, truncateText, validateTimestamp } from './utils';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for search operation.
 */
export interface SearchOptions {
  /** Path to the FTS database */
  dbPath?: string;
}

/**
 * Result of search operation.
 */
export interface SearchSessionsResult {
  /** Whether search was successful */
  success: boolean;
  /** Search results */
  results: SearchResult[];
  /** Total matches (may exceed results.length due to limit) */
  totalMatches: number;
  /** Query execution time in milliseconds */
  queryTimeMs: number;
  /** Applied filters */
  filters: {
    query: string;
    timeRange: TimeRange;
    project?: string;
    sessionId?: string;
  };
  /** Error if search failed */
  error?: SessionError;
}

// =============================================================================
// Search Implementation
// =============================================================================

/**
 * Search session logs using full-text search.
 *
 * Supports FTS5 query syntax including:
 * - Simple terms: `error`
 * - Phrases: `"exact phrase"`
 * - Prefix: `err*`
 * - Boolean: `error AND warning`, `user OR assistant`, `error NOT info`
 * - Field-specific: `role:assistant`, `tool_name:Bash`
 *
 * @param input - Search parameters
 * @param options - Search options
 * @returns Search results with relevance ranking
 */
export function searchSessions(
  input: SearchSessionsInput,
  options: SearchOptions = {}
): SearchSessionsResult {
  const startTime = Date.now();
  const dbPath = options.dbPath ?? DEFAULT_SESSIONS_DB_PATH;

  const { query, since, until, project, sessionId, limit = 50, offset = 0 } = input;

  // Build result filters for response
  const filters: SearchSessionsResult['filters'] = {
    query,
    timeRange: {},
  };
  if (since) {
    filters.timeRange.since = since;
  }
  if (until) {
    filters.timeRange.until = until;
  }
  if (project) {
    filters.project = project;
  }
  if (sessionId) {
    filters.sessionId = sessionId;
  }

  // Handle empty query
  if (!query || query.trim() === '') {
    return {
      success: true,
      results: [],
      totalMatches: 0,
      queryTimeMs: Date.now() - startTime,
      filters,
    };
  }

  // Validate timestamps before querying
  if (since) {
    const sinceValidation = validateTimestamp(since, 'since');
    if (!sinceValidation.valid) {
      return {
        success: false,
        results: [],
        totalMatches: 0,
        queryTimeMs: Date.now() - startTime,
        filters,
        error: {
          code: 'QUERY_SYNTAX_ERROR',
          message: sinceValidation.error,
          suggestion: 'Use ISO-8601 format: "2026-01-17" or "2026-01-17T10:30:00Z"',
        },
      };
    }
  }

  if (until) {
    const untilValidation = validateTimestamp(until, 'until');
    if (!untilValidation.valid) {
      return {
        success: false,
        results: [],
        totalMatches: 0,
        queryTimeMs: Date.now() - startTime,
        filters,
        error: {
          code: 'QUERY_SYNTAX_ERROR',
          message: untilValidation.error,
          suggestion: 'Use ISO-8601 format: "2026-01-17" or "2026-01-17T10:30:00Z"',
        },
      };
    }
  }

  const db = openDatabase(dbPath);
  try {
    // Build WHERE clause for additional filters
    const whereConditions: string[] = [];
    const whereParams: (string | number)[] = [];

    if (since) {
      whereConditions.push('timestamp >= ?');
      whereParams.push(since);
    }

    if (until) {
      whereConditions.push('timestamp <= ?');
      whereParams.push(until);
    }

    if (project) {
      whereConditions.push('project_path = ?');
      whereParams.push(project);
    }

    if (sessionId) {
      whereConditions.push('session_id = ?');
      whereParams.push(sessionId);
    }

    const whereClause = whereConditions.length > 0 ? ` AND ${whereConditions.join(' AND ')}` : '';

    // First get total count
    const countSql = `
      SELECT COUNT(*) as count
      FROM session_entries
      WHERE session_entries MATCH ?
      ${whereClause}
    `;

    let totalMatches = 0;
    try {
      const countParams = [query, ...whereParams];
      const countResult = db
        .query<{ count: number }, (string | number)[]>(countSql)
        .get(...countParams);
      totalMatches = countResult?.count ?? 0;
    } catch {
      // Query syntax error - return empty results
      return {
        success: true,
        results: [],
        totalMatches: 0,
        queryTimeMs: Date.now() - startTime,
        filters,
      };
    }

    // If no matches, return early
    if (totalMatches === 0) {
      return {
        success: true,
        results: [],
        totalMatches: 0,
        queryTimeMs: Date.now() - startTime,
        filters,
      };
    }

    // Search with BM25 ranking and snippets
    // Column index 4 = content (0=session_id, 1=project_path, 2=timestamp, 3=role, 4=content)
    const searchSql = `
      SELECT
        session_id,
        project_path,
        timestamp,
        role,
        content,
        snippet(session_entries, 4, '<mark>', '</mark>', '...', 64) as snippet,
        tool_name,
        file_path,
        line_number,
        bm25(session_entries) as rank
      FROM session_entries
      WHERE session_entries MATCH ?
      ${whereClause}
      ORDER BY rank
      LIMIT ? OFFSET ?
    `;

    const searchParams = [query, ...whereParams, limit, offset];
    const results = db
      .query<
        {
          session_id: string;
          project_path: string;
          timestamp: string;
          role: string;
          content: string;
          snippet: string;
          tool_name: string;
          file_path: string;
          line_number: number;
          rank: number;
        },
        (string | number)[]
      >(searchSql)
      .all(...searchParams);

    // Map to SearchResult type
    const searchResults: SearchResult[] = results.map((row) => {
      // Use snippet if available, fall back to truncated content
      const contentSnippet = row.snippet || truncateText(row.content || '', 200);

      const result: SearchResult = {
        sessionId: row.session_id,
        timestamp: row.timestamp,
        contentSnippet,
        relevanceScore: row.rank,
        filePath: row.file_path,
        lineNumber: row.line_number,
        projectPath: row.project_path,
      };
      if (row.role) {
        result.role = row.role;
      }
      if (row.tool_name) {
        result.toolName = row.tool_name;
      }
      return result;
    });

    return {
      success: true,
      results: searchResults,
      totalMatches,
      queryTimeMs: Date.now() - startTime,
      filters,
    };
  } catch (error) {
    // Handle database errors
    return {
      success: false,
      results: [],
      totalMatches: 0,
      queryTimeMs: Date.now() - startTime,
      filters,
      error: {
        code: 'QUERY_SYNTAX_ERROR',
        message: error instanceof Error ? error.message : String(error),
        suggestion: 'Check your search query syntax. Use quotes for phrases, * for prefix.',
      },
    };
  } finally {
    closeDatabase(db);
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build a SearchSessionsOutput from SearchSessionsResult.
 * For use with SDK tool wrapper.
 */
export function toSearchOutput(result: SearchSessionsResult): SearchSessionsOutput {
  return {
    results: result.results,
    totalMatches: result.totalMatches,
    queryTimeMs: result.queryTimeMs,
    filters: result.filters,
  };
}
