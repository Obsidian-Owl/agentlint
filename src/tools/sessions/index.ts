/**
 * EP06 Session Analysis Tools - Public Exports
 *
 * This module provides tools for analyzing Claude Code session logs,
 * including full-text search with BM25 ranking and metrics extraction.
 *
 * @module src/tools/sessions
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Core entry types
  EntryType,
  MessageRole,
  ContentBlockType,
  ToolCategory,
  // Session file discovery
  SessionFile,
  DiscoverSessionsOptions,
  DiscoverSessionsResult,
  // Session entry parsing
  TokenUsage,
  ContentBlock,
  Message,
  ToolResult,
  SessionEntry,
  // Metrics
  ToolDistribution,
  SessionMetrics,
  // Search tool
  TimeRange,
  SearchSessionsInput,
  SearchResult,
  SearchSessionsOutput,
  // Stats tool
  GetSessionStatsInput,
  SessionStats,
  GetSessionStatsOutput,
  // Indexing
  IndexedFile,
  IndexSessionsOptions,
  IndexSessionsResult,
  // Errors
  SessionErrorCode,
  SessionError,
  SessionToolResult,
} from './types';

// =============================================================================
// Schemas
// =============================================================================

export {
  // Core schemas
  EntryTypeSchema,
  MessageRoleSchema,
  ContentBlockTypeSchema,
  ToolCategorySchema,
  // Session entry schemas
  TokenUsageSchema,
  ContentBlockSchema,
  MessageSchema,
  ToolResultSchema,
  SessionEntrySchema,
  RawSessionEntrySchema,
  // Distribution schemas
  ToolDistributionSchema,
  // Search schemas
  TimeRangeSchema,
  SearchSessionsInputSchema,
  SearchResultSchema,
  SearchSessionsOutputSchema,
  // Stats schemas
  GetSessionStatsInputSchema,
  SessionStatsSchema,
  GetSessionStatsOutputSchema,
  // Indexing schemas
  DiscoverSessionsOptionsSchema,
  IndexSessionsOptionsSchema,
} from './schemas';

// =============================================================================
// Utilities
// =============================================================================

export {
  // Constants
  DEFAULT_CLAUDE_PROJECTS_DIR,
  DEFAULT_AGENTLINT_DIR,
  DEFAULT_SESSIONS_DB_PATH,
  // Path encoding/decoding
  decodeProjectPath,
  encodeProjectPath,
  extractProjectPath,
  // Session ID utilities
  extractSessionId,
  isSessionLogFile,
  // Tool categorization
  categorizeToolByName,
  // Timestamp utilities
  parseTimestamp,
  isWithinDateRange,
  // Content extraction
  extractTextFromContent,
  truncateText,
} from './utils';

// =============================================================================
// Discovery
// =============================================================================

export { discoverSessions, getDefaultProjectsDir, isValidProjectsDir } from './discovery';

// =============================================================================
// Parser
// =============================================================================

export {
  parseSessionLine,
  parseSessionFile,
  createSessionParser,
  parseSessionFileStreaming,
} from './parser';

export type { ParseLineResult, ParseSessionResult, ParserStats, SessionParser } from './parser';

// =============================================================================
// Metrics
// =============================================================================

export {
  aggregateTokenUsage,
  calculateToolDistribution,
  extractMetrics,
  extractMetricsFromFile,
  extractMetricsBatch,
} from './metrics';

export type { TokenUsageAggregate, BatchMetricsOptions } from './metrics';
