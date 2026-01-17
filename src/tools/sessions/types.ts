/**
 * EP06 Session Analysis Tools - Type Definitions
 *
 * TypeScript interfaces for session log analysis.
 * These types define the contract for tool inputs/outputs.
 *
 * @module src/tools/sessions/types
 */

// =============================================================================
// Core Entry Types
// =============================================================================

/**
 * Session log entry types.
 */
export type EntryType = 'user' | 'assistant' | 'summary' | 'system';

/**
 * Message role in conversation.
 */
export type MessageRole = 'user' | 'assistant';

/**
 * Content block type within a message.
 */
export type ContentBlockType = 'text' | 'tool_use' | 'tool_result';

/**
 * Tool category for distribution tracking.
 */
export type ToolCategory = 'read' | 'write' | 'bash' | 'search' | 'other';

// =============================================================================
// Session File Discovery
// =============================================================================

/**
 * A discovered session log file.
 */
export interface SessionFile {
  /** Absolute path to JSONL file */
  path: string;
  /** Decoded project path (from encoded directory name) */
  projectPath: string;
  /** Original encoded directory name */
  encodedPath: string;
  /** File size in bytes */
  size: number;
  /** File mtime (Unix timestamp ms) */
  lastModified: number;
  /** Number of entries (set after indexing) */
  entryCount: number | null;
}

/**
 * Options for session discovery.
 */
export interface DiscoverSessionsOptions {
  /** Override default Claude projects directory */
  projectsDir?: string;
  /** Filter to specific project path */
  projectPath?: string;
}

/**
 * Result of session discovery.
 */
export interface DiscoverSessionsResult {
  /** Discovered session files */
  files: SessionFile[];
  /** Total files found */
  totalFiles: number;
  /** Total size in bytes */
  totalSize: number;
  /** Unique project paths */
  projects: string[];
}

// =============================================================================
// Session Entry Parsing
// =============================================================================

/**
 * Token usage metrics from Claude API.
 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * A content block within a message.
 */
export interface ContentBlock {
  type: ContentBlockType;
  /** Text content (for type='text') */
  text?: string;
  /** Tool call ID (for type='tool_use') */
  id?: string;
  /** Tool name (for type='tool_use') */
  name?: string;
  /** Tool input (for type='tool_use') */
  input?: Record<string, unknown>;
  /** Reference to tool call (for type='tool_result') */
  tool_use_id?: string;
  /** Result content (for type='tool_result') */
  content?: string;
}

/**
 * Message content and metadata.
 */
export interface Message {
  role: MessageRole;
  content: ContentBlock[];
  usage?: TokenUsage;
}

/**
 * Tool execution result.
 */
export interface ToolResult {
  id: string;
  name: string;
  result: string | Record<string, unknown>;
}

/**
 * A single entry from a JSONL session log.
 */
export interface SessionEntry {
  type: EntryType;
  sessionId: string;
  uuid: string;
  parentUuid: string;
  timestamp: string;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  message?: Message;
  toolUseResult?: ToolResult;
  /** Summary text (for type='summary') */
  summary?: string;
  /** Last message before compression (for type='summary') */
  leafUuid?: string;
  /** Source file path (added during parsing) */
  filePath: string;
  /** Line number in source file (1-indexed) */
  lineNumber: number;
}

// =============================================================================
// Metrics Extraction
// =============================================================================

/**
 * Tool usage distribution by category.
 */
export interface ToolDistribution {
  read: number;
  write: number;
  bash: number;
  search: number;
  other: number;
  total: number;
}

/**
 * Aggregated metrics for a single session.
 */
export interface SessionMetrics {
  sessionId: string;
  projectPath: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  turnCount: number;
  duration: number | null;
  firstTimestamp: string;
  lastTimestamp: string;
  toolDistribution: ToolDistribution;
  errorCount: number;
  compressionCount: number;
}

// =============================================================================
// Search Tool
// =============================================================================

/**
 * Time range filter for queries.
 */
export interface TimeRange {
  /** Start timestamp (ISO-8601) */
  since?: string;
  /** End timestamp (ISO-8601) */
  until?: string;
}

/**
 * Input for search_sessions tool.
 */
export interface SearchSessionsInput {
  /** FTS5 search query */
  query: string;
  /** Filter by start date (ISO-8601) */
  since?: string;
  /** Filter by end date (ISO-8601) */
  until?: string;
  /** Filter by project path */
  project?: string;
  /** Filter by session ID */
  sessionId?: string;
  /** Maximum results (default: 50) */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * A single search result.
 */
export interface SearchResult {
  sessionId: string;
  timestamp: string;
  role?: string;
  /** Matched content with <mark> highlights */
  contentSnippet: string;
  toolName?: string;
  /** BM25 relevance score (lower is more relevant) */
  relevanceScore: number;
  /** Source file path for causal reference */
  filePath: string;
  /** Line number for causal reference */
  lineNumber: number;
  projectPath: string;
}

/**
 * Output from search_sessions tool.
 */
export interface SearchSessionsOutput {
  /** Search results ranked by relevance */
  results: SearchResult[];
  /** Total matches (may exceed results.length) */
  totalMatches: number;
  /** Query execution time in milliseconds */
  queryTimeMs: number;
  /** Applied filters for reference */
  filters: {
    query: string;
    timeRange: TimeRange;
    project?: string;
    sessionId?: string;
  };
}

// =============================================================================
// Stats Tool
// =============================================================================

/**
 * Input for get_session_stats tool.
 */
export interface GetSessionStatsInput {
  /** Filter by start date (ISO-8601) */
  since?: string;
  /** Filter by end date (ISO-8601) */
  until?: string;
  /** Filter by project path */
  project?: string;
}

/**
 * Aggregated statistics across sessions.
 */
export interface SessionStats {
  timeRange: TimeRange;
  projectFilter?: string;
  sessionCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheTokens: number;
  avgTurnsPerSession: number;
  totalToolCalls: number;
  toolErrorRate: number;
  compressionCount: number;
  avgTokensPerTurn: number;
  toolDistribution: ToolDistribution;
}

/**
 * Output from get_session_stats tool.
 */
export interface GetSessionStatsOutput {
  stats: SessionStats;
  /** Query execution time in milliseconds */
  queryTimeMs: number;
}

// =============================================================================
// Indexing
// =============================================================================

/**
 * Metadata for an indexed file.
 */
export interface IndexedFile {
  filePath: string;
  lastModified: number;
  entryCount: number;
  indexedAt: string;
}

/**
 * Options for indexing operation.
 */
export interface IndexSessionsOptions {
  /** Override default Claude projects directory */
  projectsDir?: string;
  /** Filter to specific project path */
  projectPath?: string;
  /** Force re-index even if files unchanged */
  force?: boolean;
}

/**
 * Result of indexing operation.
 */
export interface IndexSessionsResult {
  /** Files indexed in this run */
  filesIndexed: number;
  /** Files skipped (already indexed, unchanged) */
  filesSkipped: number;
  /** Total entries indexed */
  entriesIndexed: number;
  /** Time taken in milliseconds */
  durationMs: number;
  /** Any errors encountered */
  errors: Array<{
    filePath: string;
    error: string;
  }>;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Session analysis error codes.
 */
export type SessionErrorCode =
  | 'SESSIONS_DIR_NOT_FOUND'
  | 'SESSION_FILE_NOT_FOUND'
  | 'SESSION_FILE_UNREADABLE'
  | 'INVALID_JSONL'
  | 'INDEX_LOCKED'
  | 'INDEX_CORRUPTED'
  | 'QUERY_SYNTAX_ERROR'
  | 'QUERY_TIMEOUT';

/**
 * Session analysis error.
 */
export interface SessionError {
  code: SessionErrorCode;
  message: string;
  filePath?: string;
  lineNumber?: number;
  suggestion?: string;
}

// =============================================================================
// Tool Result Wrapper
// =============================================================================

/**
 * Generic tool result wrapper.
 */
export interface SessionToolResult<T> {
  success: boolean;
  data?: T;
  error?: SessionError;
}
