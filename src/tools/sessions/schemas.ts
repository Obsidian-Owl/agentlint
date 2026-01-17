/**
 * EP06 Session Analysis Tools - Zod Validation Schemas
 *
 * Zod schemas for validating session log entries and tool inputs.
 * These schemas correspond to the TypeScript interfaces in types.ts.
 *
 * @module src/tools/sessions/schemas
 */

import { z } from 'zod';

// =============================================================================
// Core Entry Types
// =============================================================================

/**
 * Session log entry types.
 */
export const EntryTypeSchema = z.enum(['user', 'assistant', 'summary', 'system']);

/**
 * Message role in conversation.
 */
export const MessageRoleSchema = z.enum(['user', 'assistant']);

/**
 * Content block type within a message.
 */
export const ContentBlockTypeSchema = z.enum(['text', 'tool_use', 'tool_result']);

/**
 * Tool category for distribution tracking.
 */
export const ToolCategorySchema = z.enum(['read', 'write', 'bash', 'search', 'other']);

// =============================================================================
// Session Entry Parsing
// =============================================================================

/**
 * Token usage metrics from Claude API.
 */
export const TokenUsageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  cache_creation_input_tokens: z.number().int().nonnegative().optional(),
  cache_read_input_tokens: z.number().int().nonnegative().optional(),
});

/**
 * A content block within a message.
 */
export const ContentBlockSchema = z.object({
  type: ContentBlockTypeSchema,
  text: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  input: z.record(z.unknown()).optional(),
  tool_use_id: z.string().optional(),
  content: z.string().optional(),
});

/**
 * Message content and metadata.
 */
export const MessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.array(ContentBlockSchema),
  usage: TokenUsageSchema.optional(),
  model: z.string().optional(),
});

/**
 * Tool execution result.
 */
export const ToolResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  result: z.union([z.string(), z.record(z.unknown())]),
});

/**
 * A single entry from a JSONL session log.
 * This is a lenient schema that allows for unknown fields.
 */
export const SessionEntrySchema = z.object({
  type: EntryTypeSchema,
  sessionId: z.string(),
  uuid: z.string(),
  parentUuid: z.string(),
  timestamp: z.string(),
  cwd: z.string().optional(),
  gitBranch: z.string().optional(),
  version: z.string().optional(),
  message: MessageSchema.optional(),
  toolUseResult: ToolResultSchema.optional(),
  summary: z.string().optional(),
  leafUuid: z.string().optional(),
  filePath: z.string(),
  lineNumber: z.number().int().positive(),
});

/**
 * Raw session entry as it appears in JSONL (before adding filePath/lineNumber).
 */
export const RawSessionEntrySchema = z.object({
  type: EntryTypeSchema,
  sessionId: z.string(),
  uuid: z.string(),
  parentUuid: z.string(),
  timestamp: z.string(),
  cwd: z.string().optional(),
  gitBranch: z.string().optional(),
  version: z.string().optional(),
  message: MessageSchema.optional(),
  toolUseResult: ToolResultSchema.optional(),
  summary: z.string().optional(),
  leafUuid: z.string().optional(),
});

// =============================================================================
// Tool Distribution
// =============================================================================

/**
 * Tool usage distribution by category.
 */
export const ToolDistributionSchema = z.object({
  read: z.number().int().nonnegative(),
  write: z.number().int().nonnegative(),
  bash: z.number().int().nonnegative(),
  search: z.number().int().nonnegative(),
  other: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

// =============================================================================
// Search Tool Schemas
// =============================================================================

/**
 * Time range filter for queries.
 */
export const TimeRangeSchema = z.object({
  since: z.string().optional(),
  until: z.string().optional(),
});

// =============================================================================
// Input Validation Constants
// =============================================================================

/** Maximum length for search query strings */
const MAX_QUERY_LENGTH = 1000;

/** Maximum length for timestamp strings (ISO-8601 with timezone) */
const MAX_TIMESTAMP_LENGTH = 30;

/** Maximum length for project path strings */
const MAX_PROJECT_PATH_LENGTH = 500;

/** Maximum length for session ID strings (UUID format) */
const MAX_SESSION_ID_LENGTH = 50;

/** Maximum length for model name strings */
const MAX_MODEL_LENGTH = 100;

// =============================================================================
// Search Tool Schemas
// =============================================================================

/**
 * Input for search_sessions tool.
 */
export const SearchSessionsInputSchema = z.object({
  query: z
    .string()
    .min(1, 'Query cannot be empty')
    .max(MAX_QUERY_LENGTH, `Query cannot exceed ${MAX_QUERY_LENGTH} characters`),
  since: z
    .string()
    .max(MAX_TIMESTAMP_LENGTH, `Timestamp cannot exceed ${MAX_TIMESTAMP_LENGTH} characters`)
    .optional(),
  until: z
    .string()
    .max(MAX_TIMESTAMP_LENGTH, `Timestamp cannot exceed ${MAX_TIMESTAMP_LENGTH} characters`)
    .optional(),
  project: z
    .string()
    .max(
      MAX_PROJECT_PATH_LENGTH,
      `Project path cannot exceed ${MAX_PROJECT_PATH_LENGTH} characters`
    )
    .optional(),
  sessionId: z
    .string()
    .max(MAX_SESSION_ID_LENGTH, `Session ID cannot exceed ${MAX_SESSION_ID_LENGTH} characters`)
    .optional(),
  limit: z.number().int().positive().max(500).default(50),
  offset: z.number().int().nonnegative().default(0),
});

/**
 * A single search result.
 */
export const SearchResultSchema = z.object({
  sessionId: z.string(),
  timestamp: z.string(),
  role: z.string().optional(),
  contentSnippet: z.string(),
  toolName: z.string().optional(),
  relevanceScore: z.number(),
  filePath: z.string(),
  lineNumber: z.number().int().positive(),
  projectPath: z.string(),
});

/**
 * Output from search_sessions tool.
 */
export const SearchSessionsOutputSchema = z.object({
  results: z.array(SearchResultSchema),
  totalMatches: z.number().int().nonnegative(),
  queryTimeMs: z.number().nonnegative(),
  filters: z.object({
    query: z.string(),
    timeRange: TimeRangeSchema,
    project: z.string().optional(),
    sessionId: z.string().optional(),
  }),
});

// =============================================================================
// Stats Tool Schemas
// =============================================================================

/**
 * Input for get_session_stats tool.
 */
export const GetSessionStatsInputSchema = z.object({
  since: z
    .string()
    .max(MAX_TIMESTAMP_LENGTH, `Timestamp cannot exceed ${MAX_TIMESTAMP_LENGTH} characters`)
    .optional(),
  until: z
    .string()
    .max(MAX_TIMESTAMP_LENGTH, `Timestamp cannot exceed ${MAX_TIMESTAMP_LENGTH} characters`)
    .optional(),
  project: z
    .string()
    .max(
      MAX_PROJECT_PATH_LENGTH,
      `Project path cannot exceed ${MAX_PROJECT_PATH_LENGTH} characters`
    )
    .optional(),
  model: z
    .string()
    .max(MAX_MODEL_LENGTH, `Model name cannot exceed ${MAX_MODEL_LENGTH} characters`)
    .optional(),
});

/**
 * Model usage distribution.
 */
export const ModelDistributionSchema = z.record(z.string(), z.number().int().nonnegative());

/**
 * Aggregated statistics across sessions.
 */
export const SessionStatsSchema = z.object({
  timeRange: TimeRangeSchema,
  projectFilter: z.string().optional(),
  modelFilter: z.string().optional(),
  sessionCount: z.number().int().nonnegative(),
  totalInputTokens: z.number().int().nonnegative(),
  totalOutputTokens: z.number().int().nonnegative(),
  totalCacheTokens: z.number().int().nonnegative(),
  avgTurnsPerSession: z.number().nonnegative(),
  totalToolCalls: z.number().int().nonnegative(),
  toolErrorRate: z.number().min(0).max(1),
  compressionCount: z.number().int().nonnegative(),
  avgTokensPerTurn: z.number().nonnegative(),
  toolDistribution: ToolDistributionSchema,
  modelDistribution: ModelDistributionSchema,
  topCliVersion: z.string().optional(),
});

/**
 * Output from get_session_stats tool.
 */
export const GetSessionStatsOutputSchema = z.object({
  stats: SessionStatsSchema,
  queryTimeMs: z.number().nonnegative(),
});

// =============================================================================
// Indexing Schemas
// =============================================================================

/**
 * Options for session discovery.
 */
export const DiscoverSessionsOptionsSchema = z.object({
  projectsDir: z.string().optional(),
  projectPath: z.string().optional(),
});

/**
 * Options for indexing operation.
 */
export const IndexSessionsOptionsSchema = z.object({
  projectsDir: z.string().optional(),
  projectPath: z.string().optional(),
  force: z.boolean().default(false),
});

// =============================================================================
// Inferred Types
// =============================================================================

export type EntryTypeZ = z.infer<typeof EntryTypeSchema>;
export type MessageRoleZ = z.infer<typeof MessageRoleSchema>;
export type ContentBlockTypeZ = z.infer<typeof ContentBlockTypeSchema>;
export type ToolCategoryZ = z.infer<typeof ToolCategorySchema>;
export type TokenUsageZ = z.infer<typeof TokenUsageSchema>;
export type ContentBlockZ = z.infer<typeof ContentBlockSchema>;
export type MessageZ = z.infer<typeof MessageSchema>;
export type ToolResultZ = z.infer<typeof ToolResultSchema>;
export type SessionEntryZ = z.infer<typeof SessionEntrySchema>;
export type RawSessionEntryZ = z.infer<typeof RawSessionEntrySchema>;
export type ToolDistributionZ = z.infer<typeof ToolDistributionSchema>;
export type TimeRangeZ = z.infer<typeof TimeRangeSchema>;
export type SearchSessionsInputZ = z.infer<typeof SearchSessionsInputSchema>;
export type SearchResultZ = z.infer<typeof SearchResultSchema>;
export type SearchSessionsOutputZ = z.infer<typeof SearchSessionsOutputSchema>;
export type GetSessionStatsInputZ = z.infer<typeof GetSessionStatsInputSchema>;
export type SessionStatsZ = z.infer<typeof SessionStatsSchema>;
export type GetSessionStatsOutputZ = z.infer<typeof GetSessionStatsOutputSchema>;
export type DiscoverSessionsOptionsZ = z.infer<typeof DiscoverSessionsOptionsSchema>;
export type IndexSessionsOptionsZ = z.infer<typeof IndexSessionsOptionsSchema>;
