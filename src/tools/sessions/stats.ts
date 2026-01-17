/**
 * EP06 Session Analysis Tools - Session Statistics
 *
 * Aggregates statistics across sessions with filtering.
 *
 * @module src/tools/sessions/stats
 */

import type {
  GetSessionStatsInput,
  SessionStats,
  ToolDistribution,
  ModelDistribution,
  TimeRange,
  SessionError,
} from './types';
import { openDatabase, closeDatabase } from '../../persistence/sessions/fts';
import { DEFAULT_SESSIONS_DB_PATH, validateTimestamp } from './utils';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for stats operation.
 */
export interface StatsOptions {
  /** Path to the FTS database */
  dbPath?: string;
}

/**
 * Result of stats operation.
 */
export interface GetSessionStatsResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Aggregated statistics */
  stats: SessionStats;
  /** Query execution time in milliseconds */
  queryTimeMs: number;
  /** Error if operation failed */
  error?: SessionError;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create an empty stats object for error responses.
 */
function createEmptyStats(timeRange: TimeRange, project?: string, model?: string): SessionStats {
  const stats: SessionStats = {
    timeRange,
    sessionCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheTokens: 0,
    avgTurnsPerSession: 0,
    totalToolCalls: 0,
    toolErrorRate: 0,
    compressionCount: 0,
    avgTokensPerTurn: 0,
    toolDistribution: {
      read: 0,
      write: 0,
      bash: 0,
      search: 0,
      other: 0,
      total: 0,
    },
    modelDistribution: {},
  };
  if (project !== undefined) {
    stats.projectFilter = project;
  }
  if (model !== undefined) {
    stats.modelFilter = model;
  }
  return stats;
}

// =============================================================================
// Stats Implementation
// =============================================================================

/**
 * Get aggregated statistics across sessions.
 *
 * @param input - Filter parameters
 * @param options - Stats options
 * @returns Aggregated statistics
 */
export function getSessionStats(
  input: GetSessionStatsInput,
  options: StatsOptions = {}
): GetSessionStatsResult {
  const startTime = Date.now();
  const dbPath = options.dbPath ?? DEFAULT_SESSIONS_DB_PATH;

  const { since, until, project, model } = input;

  // Build time range for result
  const timeRange: TimeRange = {};
  if (since) {
    timeRange.since = since;
  }
  if (until) {
    timeRange.until = until;
  }

  // Validate timestamps before querying
  if (since) {
    const sinceValidation = validateTimestamp(since, 'since');
    if (!sinceValidation.valid) {
      return {
        success: false,
        stats: createEmptyStats(timeRange, project, model),
        queryTimeMs: Date.now() - startTime,
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
        stats: createEmptyStats(timeRange, project, model),
        queryTimeMs: Date.now() - startTime,
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
    // Build WHERE clause for filters
    const whereConditions: string[] = [];
    const whereParams: string[] = [];

    if (since) {
      whereConditions.push('first_timestamp >= ?');
      whereParams.push(since);
    }

    if (until) {
      whereConditions.push('first_timestamp <= ?');
      whereParams.push(until);
    }

    if (project) {
      whereConditions.push('project_path = ?');
      whereParams.push(project);
    }

    if (model) {
      whereConditions.push('model = ?');
      whereParams.push(model);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Query sessions table for aggregates
    const sessionsSql = `
      SELECT
        COUNT(*) as session_count,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        COALESCE(SUM(cache_tokens), 0) as total_cache_tokens,
        COALESCE(SUM(compression_count), 0) as compression_count,
        COALESCE(SUM(entry_count), 0) as total_entries
      FROM sessions
      ${whereClause}
    `;

    const sessionsResult = db
      .query<
        {
          session_count: number;
          total_input_tokens: number;
          total_output_tokens: number;
          total_cache_tokens: number;
          compression_count: number;
          total_entries: number;
        },
        string[]
      >(sessionsSql)
      .get(...whereParams);

    // Query session_tools for tool distribution
    let toolsSql: string;
    let toolsParams: string[];

    if (whereConditions.length > 0) {
      // Need to join with sessions to apply filters
      toolsSql = `
        SELECT
          st.category,
          SUM(st.call_count) as call_count,
          SUM(st.error_count) as error_count
        FROM session_tools st
        JOIN sessions s ON st.session_id = s.session_id
        ${whereClause}
        GROUP BY st.category
      `;
      toolsParams = whereParams;
    } else {
      toolsSql = `
        SELECT
          category,
          SUM(call_count) as call_count,
          SUM(error_count) as error_count
        FROM session_tools
        GROUP BY category
      `;
      toolsParams = [];
    }

    const toolsResult = db
      .query<
        {
          category: string;
          call_count: number;
          error_count: number;
        },
        string[]
      >(toolsSql)
      .all(...toolsParams);

    // Build tool distribution
    const toolDistribution: ToolDistribution = {
      read: 0,
      write: 0,
      bash: 0,
      search: 0,
      other: 0,
      total: 0,
    };

    let totalErrors = 0;
    for (const row of toolsResult) {
      const category = row.category as keyof Omit<ToolDistribution, 'total'>;
      if (category in toolDistribution) {
        toolDistribution[category] = row.call_count;
      } else {
        toolDistribution.other += row.call_count;
      }
      toolDistribution.total += row.call_count;
      totalErrors += row.error_count;
    }

    // Query for model distribution
    let modelDistSql: string;
    let modelDistParams: string[];

    if (whereConditions.length > 0) {
      modelDistSql = `
        SELECT model, COUNT(*) as count
        FROM sessions
        ${whereClause}
        GROUP BY model
        ORDER BY count DESC
      `;
      modelDistParams = whereParams;
    } else {
      modelDistSql = `
        SELECT model, COUNT(*) as count
        FROM sessions
        GROUP BY model
        ORDER BY count DESC
      `;
      modelDistParams = [];
    }

    const modelDistResult = db
      .query<{ model: string | null; count: number }, string[]>(modelDistSql)
      .all(...modelDistParams);

    const modelDistribution: ModelDistribution = {};
    for (const row of modelDistResult) {
      const modelName = row.model ?? 'unknown';
      modelDistribution[modelName] = row.count;
    }

    // Query for top CLI version
    let topCliVersion: string | undefined;
    let cliVersionSql: string;
    let cliVersionParams: string[];

    if (whereConditions.length > 0) {
      cliVersionSql = `
        SELECT cli_version, COUNT(*) as count
        FROM sessions
        ${whereClause}
        GROUP BY cli_version
        ORDER BY count DESC
        LIMIT 1
      `;
      cliVersionParams = whereParams;
    } else {
      cliVersionSql = `
        SELECT cli_version, COUNT(*) as count
        FROM sessions
        GROUP BY cli_version
        ORDER BY count DESC
        LIMIT 1
      `;
      cliVersionParams = [];
    }

    const cliVersionResult = db
      .query<{ cli_version: string | null; count: number }, string[]>(cliVersionSql)
      .get(...cliVersionParams);

    if (cliVersionResult?.cli_version) {
      topCliVersion = cliVersionResult.cli_version;
    }

    // Calculate derived metrics
    const sessionCount = sessionsResult?.session_count ?? 0;
    const totalEntries = sessionsResult?.total_entries ?? 0;
    const totalInputTokens = sessionsResult?.total_input_tokens ?? 0;
    const totalOutputTokens = sessionsResult?.total_output_tokens ?? 0;

    const avgTurnsPerSession = sessionCount > 0 ? totalEntries / sessionCount : 0;

    const totalTokens = totalInputTokens + totalOutputTokens;
    const avgTokensPerTurn = totalEntries > 0 ? totalTokens / totalEntries : 0;

    const toolErrorRate = toolDistribution.total > 0 ? totalErrors / toolDistribution.total : 0;

    const stats: SessionStats = {
      timeRange,
      sessionCount,
      totalInputTokens,
      totalOutputTokens,
      totalCacheTokens: sessionsResult?.total_cache_tokens ?? 0,
      avgTurnsPerSession,
      totalToolCalls: toolDistribution.total,
      toolErrorRate,
      compressionCount: sessionsResult?.compression_count ?? 0,
      avgTokensPerTurn,
      toolDistribution,
      modelDistribution,
    };
    if (project !== undefined) {
      stats.projectFilter = project;
    }
    if (model !== undefined) {
      stats.modelFilter = model;
    }
    if (topCliVersion !== undefined) {
      stats.topCliVersion = topCliVersion;
    }

    return {
      success: true,
      stats,
      queryTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    // Handle database errors
    return {
      success: false,
      stats: createEmptyStats(timeRange, project, model),
      queryTimeMs: Date.now() - startTime,
      error: {
        code: 'QUERY_SYNTAX_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  } finally {
    closeDatabase(db);
  }
}
