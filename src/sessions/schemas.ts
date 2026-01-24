/**
 * EP15 Session Intelligence - Zod Validation Schemas
 *
 * Runtime validation schemas for session intelligence data.
 * These schemas validate tool inputs and database records.
 *
 * @module sessions/schemas
 */

import { z } from 'zod';

// =============================================================================
// Core Type Schemas
// =============================================================================

/**
 * File operation type schema.
 */
export const FileOperationSchema = z.enum(['read', 'write', 'edit']);

/**
 * Compression type schema.
 */
export const CompressionTypeSchema = z.enum(['compact', 'microcompact']);

/**
 * Quality signal type schema.
 */
export const QualitySignalTypeSchema = z.enum(['test', 'build', 'lint']);

/**
 * Analysis focus schema.
 */
export const AnalysisFocusSchema = z.enum(['narrative', 'flow', 'quality', 'comprehensive']);

// =============================================================================
// Session Timeline Schemas
// =============================================================================

/**
 * Intent schema.
 */
export const IntentSchema = z.object({
  firstUserPrompt: z.string(),
  timestamp: z.string(),
  promptLength: z.number().int().nonnegative(),
});

/**
 * Tool call summary schema.
 */
export const ToolCallSummarySchema = z.object({
  name: z.string(),
  success: z.boolean(),
});

/**
 * Outcome signals schema.
 */
export const OutcomeSignalsSchema = z.object({
  containsThanks: z.boolean(),
  containsDone: z.boolean(),
  endsWithError: z.boolean(),
  hasUnresolvedError: z.boolean(),
});

/**
 * Session outcome schema.
 */
export const SessionOutcomeSchema = z.object({
  lastUserPrompt: z.string().nullable(),
  lastToolCall: ToolCallSummarySchema.nullable(),
  hasCommitActivity: z.boolean(),
  turnCount: z.number().int().nonnegative(),
  signals: OutcomeSignalsSchema,
});

/**
 * Session metrics schema.
 */
export const SessionMetricsSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheTokens: z.number().int().nonnegative(),
  compressionCount: z.number().int().nonnegative(),
});

/**
 * Session timeline schema.
 */
export const SessionTimelineSchema = z.object({
  sessionId: z.string().min(1),
  projectPath: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  duration: z.number().nonnegative(),
  turnCount: z.number().int().nonnegative(),
  intent: IntentSchema,
  outcome: SessionOutcomeSchema,
  metrics: SessionMetricsSchema,
});

// =============================================================================
// Record Schemas
// =============================================================================

/**
 * Tool call record schema.
 */
export const ToolCallRecordSchema = z.object({
  id: z.number().int().positive().optional(),
  sessionId: z.string().min(1),
  toolName: z.string().min(1),
  inputHash: z.string().length(64), // SHA-256 hex
  timestamp: z.string(),
  sequenceIndex: z.number().int().nonnegative(),
  isError: z.boolean(),
  errorMessage: z.string().optional(),
  filePath: z.string().optional(),
  lineNumber: z.number().int().positive().optional(),
});

/**
 * Tool repeat pattern schema.
 */
export const ToolRepeatPatternSchema = z.object({
  toolName: z.string().min(1),
  inputHash: z.string().length(64),
  repeatCount: z.number().int().min(2),
  firstOccurrence: z.number().int().nonnegative(),
  lastOccurrence: z.number().int().nonnegative(),
});

/**
 * File access record schema.
 */
export const FileAccessRecordSchema = z.object({
  id: z.number().int().positive().optional(),
  sessionId: z.string().min(1),
  filePath: z.string().min(1),
  operation: FileOperationSchema,
  timestamp: z.string(),
  accessSequence: z.number().int().nonnegative(),
});

/**
 * File access summary schema.
 */
export const FileAccessSummarySchema = z.object({
  filePath: z.string().min(1),
  operations: z.object({
    read: z.number().int().nonnegative(),
    write: z.number().int().nonnegative(),
    edit: z.number().int().nonnegative(),
  }),
  totalAccesses: z.number().int().nonnegative(),
});

/**
 * Compression event record schema.
 */
export const CompressionEventRecordSchema = z.object({
  id: z.number().int().positive().optional(),
  sessionId: z.string().min(1),
  timestamp: z.string(),
  compressionType: CompressionTypeSchema,
  preTokens: z.number().int().nonnegative().optional(),
  tokensSaved: z.number().int().nonnegative().optional(),
  summaryPreserved: z.string().optional(),
  filePath: z.string().optional(),
  lineNumber: z.number().int().positive().optional(),
});

/**
 * Delegation event record schema.
 */
export const DelegationEventRecordSchema = z.object({
  id: z.number().int().positive().optional(),
  sessionId: z.string().min(1),
  subagentType: z.string().min(1),
  taskPrompt: z.string().optional(),
  timestamp: z.string(),
  turnIndex: z.number().int().nonnegative(),
  success: z.boolean(),
  subagentSessionId: z.string().optional(),
  filePath: z.string().optional(),
  lineNumber: z.number().int().positive().optional(),
});

/**
 * MCP tool call record schema.
 */
export const McpToolCallRecordSchema = z.object({
  id: z.number().int().positive().optional(),
  sessionId: z.string().min(1),
  serverName: z.string().min(1),
  toolName: z.string().min(1),
  timestamp: z.string(),
  isError: z.boolean(),
  errorMessage: z.string().optional(),
  filePath: z.string().optional(),
  lineNumber: z.number().int().positive().optional(),
});

/**
 * MCP server usage schema.
 */
export const McpServerUsageSchema = z.object({
  serverName: z.string().min(1),
  callCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  errorRate: z.number().min(0).max(1),
  tools: z.array(
    z.object({
      toolName: z.string().min(1),
      callCount: z.number().int().nonnegative(),
      errorCount: z.number().int().nonnegative(),
    })
  ),
});

/**
 * Quality signal record schema.
 */
export const QualitySignalRecordSchema = z.object({
  id: z.number().int().positive().optional(),
  sessionId: z.string().min(1),
  signalType: QualitySignalTypeSchema,
  timestamp: z.string(),
  passed: z.boolean().nullable(),
  rawOutput: z.string().optional(),
  filePath: z.string().optional(),
  lineNumber: z.number().int().positive().optional(),
});

/**
 * Quality signals summary schema.
 */
export const QualitySignalsSummarySchema = z.object({
  testsPassed: z.number().int().nonnegative(),
  testsFailed: z.number().int().nonnegative(),
  testsIndeterminate: z.number().int().nonnegative(),
  buildsPassed: z.number().int().nonnegative(),
  buildsFailed: z.number().int().nonnegative(),
  buildsIndeterminate: z.number().int().nonnegative(),
  lintsPassed: z.number().int().nonnegative(),
  lintsFailed: z.number().int().nonnegative(),
  lintsIndeterminate: z.number().int().nonnegative(),
});

// =============================================================================
// Tool Input Schemas (for SDK tool definitions)
// =============================================================================

/**
 * Input schema for get_session_timeline tool.
 */
export const GetSessionTimelineInputSchema = z.object({
  sessionId: z.string().min(1).describe('Session UUID to analyze'),
});

/**
 * Input schema for get_tool_sequences tool.
 */
export const GetToolSequencesInputSchema = z.object({
  sessionId: z.string().min(1).describe('Session UUID'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .default(100)
    .describe('Maximum records to return'),
  offset: z.number().int().min(0).optional().default(0).describe('Offset for pagination'),
  toolName: z.string().optional().describe('Filter by tool name'),
  errorsOnly: z.boolean().optional().default(false).describe('Only return errors'),
});

/**
 * Input schema for get_file_accesses tool.
 */
export const GetFileAccessesInputSchema = z.object({
  sessionId: z.string().min(1).describe('Session UUID'),
  filePattern: z.string().optional().describe('Filter by file path pattern (glob)'),
  operation: FileOperationSchema.optional().describe('Filter by operation type'),
});

/**
 * Input schema for get_compression_events tool.
 */
export const GetCompressionEventsInputSchema = z.object({
  sessionId: z.string().min(1).describe('Session UUID'),
});

/**
 * Input schema for get_delegation_events tool.
 */
export const GetDelegationEventsInputSchema = z.object({
  sessionId: z.string().min(1).describe('Session UUID'),
  subagentType: z.string().optional().describe('Filter by subagent type'),
});

/**
 * Input schema for get_mcp_usage tool.
 */
export const GetMcpUsageInputSchema = z.object({
  sessionId: z.string().min(1).describe('Session UUID'),
  serverName: z.string().optional().describe('Filter by server name'),
});

/**
 * Input schema for get_quality_signals tool.
 */
export const GetQualitySignalsInputSchema = z.object({
  sessionId: z.string().min(1).describe('Session UUID'),
  signalType: QualitySignalTypeSchema.optional().describe('Filter by signal type'),
});

/**
 * Input schema for spawn_session_analyst tool.
 */
export const SpawnSessionAnalystInputSchema = z.object({
  sessionId: z.string().min(1).describe('Session UUID to analyze'),
  compareToSessionId: z.string().optional().describe('Optional second session for comparison'),
  query: z.string().optional().describe('Specific question to answer'),
  focus: AnalysisFocusSchema.optional().default('comprehensive').describe('Analysis focus area'),
});

// =============================================================================
// Tool Output Schemas
// =============================================================================

/**
 * Output schema for get_session_timeline tool.
 */
export const GetSessionTimelineOutputSchema = z.object({
  timeline: SessionTimelineSchema,
});

/**
 * Output schema for get_tool_sequences tool.
 */
export const GetToolSequencesOutputSchema = z.object({
  sequences: z.array(ToolCallRecordSchema),
  totalCount: z.number().int().nonnegative(),
  repeatPatterns: z.array(ToolRepeatPatternSchema),
  query: GetToolSequencesInputSchema,
});

/**
 * Output schema for get_file_accesses tool.
 */
export const GetFileAccessesOutputSchema = z.object({
  summaries: z.array(FileAccessSummarySchema),
  uniqueFiles: z.number().int().nonnegative(),
  totalOperations: z.number().int().nonnegative(),
});

/**
 * Output schema for get_compression_events tool.
 */
export const GetCompressionEventsOutputSchema = z.object({
  events: z.array(CompressionEventRecordSchema),
  totalCount: z.number().int().nonnegative(),
  totalTokensSaved: z.number().int().nonnegative().nullable(),
});

/**
 * Output schema for get_delegation_events tool.
 */
export const GetDelegationEventsOutputSchema = z.object({
  events: z.array(DelegationEventRecordSchema),
  totalCount: z.number().int().nonnegative(),
  successRate: z.number().min(0).max(1),
  subagentTypes: z.array(z.string()),
});

/**
 * Output schema for get_mcp_usage tool.
 */
export const GetMcpUsageOutputSchema = z.object({
  servers: z.array(McpServerUsageSchema),
  totalCalls: z.number().int().nonnegative(),
  totalErrors: z.number().int().nonnegative(),
  overallErrorRate: z.number().min(0).max(1),
});

/**
 * Output schema for get_quality_signals tool.
 */
export const GetQualitySignalsOutputSchema = z.object({
  signals: z.array(QualitySignalRecordSchema),
  summary: QualitySignalsSummarySchema,
});

/**
 * Agent definition summary schema.
 */
export const AgentDefinitionSummarySchema = z.object({
  description: z.string(),
  toolCount: z.number().int().nonnegative(),
  tools: z.array(z.string()),
});

/**
 * Output schema for spawn_session_analyst tool.
 */
export const SpawnSessionAnalystOutputSchema = z.object({
  success: z.boolean(),
  focus: AnalysisFocusSchema,
  agentType: z.literal('session-analyst'),
  context: z.object({
    sessionId: z.string(),
    compareToSessionId: z.string().optional(),
    query: z.string().optional(),
  }),
  agentDefinition: AgentDefinitionSummarySchema,
  queryPrompt: z.string(),
  message: z.string(),
});

// =============================================================================
// Type Exports (inferred from schemas)
// =============================================================================

export type FileOperationSchemaType = z.infer<typeof FileOperationSchema>;
export type CompressionTypeSchemaType = z.infer<typeof CompressionTypeSchema>;
export type QualitySignalTypeSchemaType = z.infer<typeof QualitySignalTypeSchema>;
export type AnalysisFocusSchemaType = z.infer<typeof AnalysisFocusSchema>;

export type IntentSchemaType = z.infer<typeof IntentSchema>;
export type SessionOutcomeSchemaType = z.infer<typeof SessionOutcomeSchema>;
export type SessionTimelineSchemaType = z.infer<typeof SessionTimelineSchema>;

export type ToolCallRecordSchemaType = z.infer<typeof ToolCallRecordSchema>;
export type FileAccessRecordSchemaType = z.infer<typeof FileAccessRecordSchema>;
export type CompressionEventRecordSchemaType = z.infer<typeof CompressionEventRecordSchema>;
export type DelegationEventRecordSchemaType = z.infer<typeof DelegationEventRecordSchema>;
export type McpToolCallRecordSchemaType = z.infer<typeof McpToolCallRecordSchema>;
export type QualitySignalRecordSchemaType = z.infer<typeof QualitySignalRecordSchema>;
