/**
 * EP15 Session Intelligence - Type Contracts
 *
 * TypeScript interfaces for the Session Intelligence feature.
 * Per Constitution Principle VII: Types define data structures,
 * not judgments or orchestration logic.
 *
 * @module sessions/contracts
 */

import { z } from 'zod';

// =============================================================================
// Core Types
// =============================================================================

/**
 * File operation type for file access tracking.
 */
export type FileOperation = 'read' | 'write' | 'edit';

/**
 * Compression type from Claude Code logs.
 */
export type CompressionType = 'compact' | 'microcompact';

/**
 * Quality signal category.
 */
export type QualitySignalType = 'test' | 'build' | 'lint';

// =============================================================================
// Session Timeline
// =============================================================================

/**
 * User intent extracted from first prompt.
 */
export interface Intent {
  /** Text of first user message */
  firstUserPrompt: string;
  /** ISO-8601 timestamp when intent was stated */
  timestamp: string;
  /** Character count (context hint for agent) */
  promptLength: number;
}

/**
 * Summary of a tool call for outcome tracking.
 */
export interface ToolCallSummary {
  /** Tool name */
  name: string;
  /** Whether the tool succeeded */
  success: boolean;
}

/**
 * Hints about session outcome (data, not judgment).
 * Agent interprets these signals to determine actual outcome.
 */
export interface OutcomeSignals {
  /** User expressed gratitude */
  containsThanks: boolean;
  /** User indicated completion ("done", "that's it", etc.) */
  containsDone: boolean;
  /** Last message was an error */
  endsWithError: boolean;
  /** Error occurred without subsequent recovery */
  hasUnresolvedError: boolean;
}

/**
 * Session outcome signals for agent interpretation.
 */
export interface SessionOutcome {
  /** Final user message if any */
  lastUserPrompt: string | null;
  /** Final tool invocation */
  lastToolCall: ToolCallSummary | null;
  /** Whether git commit activity occurred */
  hasCommitActivity: boolean;
  /** Total turns for context */
  turnCount: number;
  /** Detection hints for agent */
  signals: OutcomeSignals;
}

/**
 * Complete session timeline for narrative understanding.
 */
export interface SessionTimeline {
  /** Session UUID */
  sessionId: string;
  /** Decoded project path */
  projectPath: string;
  /** ISO-8601 session start */
  startTime: string;
  /** ISO-8601 session end */
  endTime: string;
  /** Duration in milliseconds */
  duration: number;
  /** Total user + assistant exchanges */
  turnCount: number;
  /** Extracted user intent */
  intent: Intent;
  /** Outcome signals */
  outcome: SessionOutcome;
  /** Token metrics for context */
  metrics: {
    inputTokens: number;
    outputTokens: number;
    cacheTokens: number;
    compressionCount: number;
  };
}

// =============================================================================
// Tool Call Records
// =============================================================================

/**
 * Single tool invocation record.
 */
export interface ToolCallRecord {
  /** Auto-increment ID (database) */
  id?: number;
  /** Parent session UUID */
  sessionId: string;
  /** Tool name */
  toolName: string;
  /** SHA-256 hash of input JSON */
  inputHash: string;
  /** ISO-8601 invocation time */
  timestamp: string;
  /** Position in session (0-based) */
  sequenceIndex: number;
  /** Whether tool returned error */
  isError: boolean;
  /** Error text if isError=true */
  errorMessage?: string;
  /** Source JSONL for causal trace */
  filePath?: string;
  /** Line number in source file */
  lineNumber?: number;
}

/**
 * Repeated tool call pattern (potential "stuck" indicator).
 * Per Constitution VII: This is data. Agent judges if it indicates being stuck.
 */
export interface ToolRepeatPattern {
  /** Tool name */
  toolName: string;
  /** Input hash that repeated */
  inputHash: string;
  /** Number of times this exact call occurred */
  repeatCount: number;
  /** First occurrence sequence index */
  firstOccurrence: number;
  /** Last occurrence sequence index */
  lastOccurrence: number;
}

// =============================================================================
// File Access Records
// =============================================================================

/**
 * Single file access record.
 */
export interface FileAccessRecord {
  /** Auto-increment ID (database) */
  id?: number;
  /** Parent session UUID */
  sessionId: string;
  /** Accessed file path */
  filePath: string;
  /** Operation type */
  operation: FileOperation;
  /** ISO-8601 access time */
  timestamp: string;
  /** Order within session */
  accessSequence: number;
}

/**
 * Aggregated file access counts.
 * Per Constitution VII: Counts are data. Agent judges if they indicate issues.
 */
export interface FileAccessSummary {
  /** File path */
  filePath: string;
  /** Count per operation type */
  operations: {
    read: number;
    write: number;
    edit: number;
  };
  /** Total access count */
  totalAccesses: number;
}

// =============================================================================
// Compression Events
// =============================================================================

/**
 * Context compression event.
 */
export interface CompressionEventRecord {
  /** Auto-increment ID (database) */
  id?: number;
  /** Parent session UUID */
  sessionId: string;
  /** ISO-8601 compression time */
  timestamp: string;
  /** Compression type */
  compressionType: CompressionType;
  /** Token count before compression */
  preTokens?: number;
  /** Tokens removed by compression */
  tokensSaved?: number;
  /** Summary text preserved after compression */
  summaryPreserved?: string;
  /** Source JSONL for causal trace */
  filePath?: string;
  /** Line number in source file */
  lineNumber?: number;
}

// =============================================================================
// Delegation Events
// =============================================================================

/**
 * Task tool invocation (subagent delegation).
 */
export interface DelegationEventRecord {
  /** Auto-increment ID (database) */
  id?: number;
  /** Parent session UUID */
  sessionId: string;
  /** Subagent type from Task tool input */
  subagentType: string;
  /** Prompt passed to subagent */
  taskPrompt?: string;
  /** ISO-8601 invocation time */
  timestamp: string;
  /** Turn position in session */
  turnIndex: number;
  /** Whether delegation completed successfully */
  success: boolean;
  /** Spawned session ID if available */
  subagentSessionId?: string;
  /** Source JSONL for causal trace */
  filePath?: string;
  /** Line number in source file */
  lineNumber?: number;
}

// =============================================================================
// MCP Tool Calls
// =============================================================================

/**
 * MCP server tool invocation.
 */
export interface McpToolCallRecord {
  /** Auto-increment ID (database) */
  id?: number;
  /** Parent session UUID */
  sessionId: string;
  /** Server name parsed from mcp__server__tool */
  serverName: string;
  /** Tool name within server */
  toolName: string;
  /** ISO-8601 invocation time */
  timestamp: string;
  /** Whether call failed */
  isError: boolean;
  /** Error text if isError=true */
  errorMessage?: string;
  /** Source JSONL for causal trace */
  filePath?: string;
  /** Line number in source file */
  lineNumber?: number;
}

/**
 * MCP server usage summary.
 * Per Constitution VII: Rates are data. Agent judges if they indicate issues.
 */
export interface McpServerUsage {
  /** Server name */
  serverName: string;
  /** Total calls to this server */
  callCount: number;
  /** Number of failed calls */
  errorCount: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Tool breakdown */
  tools: Array<{
    toolName: string;
    callCount: number;
    errorCount: number;
  }>;
}

// =============================================================================
// Quality Signals
// =============================================================================

/**
 * Quality signal (test/build/lint outcome).
 */
export interface QualitySignalRecord {
  /** Auto-increment ID (database) */
  id?: number;
  /** Parent session UUID */
  sessionId: string;
  /** Signal category */
  signalType: QualitySignalType;
  /** ISO-8601 detection time */
  timestamp: string;
  /** true=passed, false=failed, null=indeterminate */
  passed: boolean | null;
  /** Raw output for agent interpretation */
  rawOutput?: string;
  /** Source JSONL for causal trace */
  filePath?: string;
  /** Line number in source file */
  lineNumber?: number;
}

// =============================================================================
// Tool Input/Output Types
// =============================================================================

/**
 * Input for get_session_timeline tool.
 */
export interface GetSessionTimelineInput {
  /** Session UUID to analyze */
  sessionId: string;
}

/**
 * Output from get_session_timeline tool.
 */
export interface GetSessionTimelineOutput {
  /** The session timeline */
  timeline: SessionTimeline;
}

/**
 * Input for get_tool_sequences tool.
 */
export interface GetToolSequencesInput {
  /** Session UUID */
  sessionId: string;
  /** Maximum records to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Filter by tool name */
  toolName?: string;
  /** Only return errors */
  errorsOnly?: boolean;
}

/**
 * Output from get_tool_sequences tool.
 */
export interface GetToolSequencesOutput {
  /** Tool call records */
  sequences: ToolCallRecord[];
  /** Total count (for pagination) */
  totalCount: number;
  /** Detected repeat patterns */
  repeatPatterns: ToolRepeatPattern[];
  /** Query parameters used */
  query: GetToolSequencesInput;
}

/**
 * Input for get_file_accesses tool.
 */
export interface GetFileAccessesInput {
  /** Session UUID */
  sessionId: string;
  /** Filter by file path pattern */
  filePattern?: string;
  /** Filter by operation type */
  operation?: FileOperation;
}

/**
 * Output from get_file_accesses tool.
 */
export interface GetFileAccessesOutput {
  /** Per-file summaries */
  summaries: FileAccessSummary[];
  /** Total unique files accessed */
  uniqueFiles: number;
  /** Total operations */
  totalOperations: number;
}

/**
 * Input for get_compression_events tool.
 */
export interface GetCompressionEventsInput {
  /** Session UUID */
  sessionId: string;
}

/**
 * Output from get_compression_events tool.
 */
export interface GetCompressionEventsOutput {
  /** Compression events in chronological order */
  events: CompressionEventRecord[];
  /** Total compressions */
  totalCount: number;
  /** Total tokens saved (if available) */
  totalTokensSaved: number | null;
}

/**
 * Input for get_delegation_events tool.
 */
export interface GetDelegationEventsInput {
  /** Session UUID */
  sessionId: string;
  /** Filter by subagent type */
  subagentType?: string;
}

/**
 * Output from get_delegation_events tool.
 */
export interface GetDelegationEventsOutput {
  /** Delegation events */
  events: DelegationEventRecord[];
  /** Total delegations */
  totalCount: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Unique subagent types used */
  subagentTypes: string[];
}

/**
 * Input for get_mcp_usage tool.
 */
export interface GetMcpUsageInput {
  /** Session UUID */
  sessionId: string;
  /** Filter by server name */
  serverName?: string;
}

/**
 * Output from get_mcp_usage tool.
 */
export interface GetMcpUsageOutput {
  /** Per-server usage summaries */
  servers: McpServerUsage[];
  /** Total MCP calls */
  totalCalls: number;
  /** Total errors */
  totalErrors: number;
  /** Overall error rate */
  overallErrorRate: number;
}

/**
 * Input for get_quality_signals tool.
 */
export interface GetQualitySignalsInput {
  /** Session UUID */
  sessionId: string;
  /** Filter by signal type */
  signalType?: QualitySignalType;
}

/**
 * Output from get_quality_signals tool.
 */
export interface GetQualitySignalsOutput {
  /** Quality signals */
  signals: QualitySignalRecord[];
  /** Summary counts */
  summary: {
    testsPassed: number;
    testsFailed: number;
    testsIndeterminate: number;
    buildsPassed: number;
    buildsFailed: number;
    buildsIndeterminate: number;
    lintsPassed: number;
    lintsFailed: number;
    lintsIndeterminate: number;
  };
}

// =============================================================================
// Spawn Tool Types
// =============================================================================

/**
 * Input for spawn_session_analyst tool.
 */
export interface SpawnSessionAnalystInput {
  /** Session UUID to analyze */
  sessionId: string;
  /** Optional second session for comparison */
  compareToSessionId?: string;
  /** Specific question to answer */
  query?: string;
  /** Analysis focus */
  focus?: 'narrative' | 'flow' | 'quality' | 'comprehensive';
}

/**
 * Output from spawn_session_analyst tool.
 * Returns agent definition for orchestrator to invoke.
 */
export interface SpawnSessionAnalystOutput {
  /** Whether spawn was successful */
  success: boolean;
  /** Analysis focus */
  focus: 'narrative' | 'flow' | 'quality' | 'comprehensive';
  /** Agent type identifier */
  agentType: 'session-analyst';
  /** Context passed to subagent */
  context: {
    sessionId: string;
    compareToSessionId?: string;
    query?: string;
  };
  /** Agent definition summary */
  agentDefinition: {
    description: string;
    toolCount: number;
    tools: string[];
  };
  /** Prompt to send to subagent */
  queryPrompt: string;
  /** Human-readable message */
  message: string;
}

// =============================================================================
// Zod Schemas (for tool input validation)
// =============================================================================

export const GetSessionTimelineInputSchema = z.object({
  sessionId: z.string().min(1).describe('Session UUID to analyze'),
});

export const GetToolSequencesInputSchema = z.object({
  sessionId: z.string().min(1).describe('Session UUID'),
  limit: z.number().int().min(1).max(500).optional().default(100).describe('Maximum records to return'),
  offset: z.number().int().min(0).optional().default(0).describe('Offset for pagination'),
  toolName: z.string().optional().describe('Filter by tool name'),
  errorsOnly: z.boolean().optional().default(false).describe('Only return errors'),
});

export const GetFileAccessesInputSchema = z.object({
  sessionId: z.string().min(1).describe('Session UUID'),
  filePattern: z.string().optional().describe('Filter by file path pattern (glob)'),
  operation: z.enum(['read', 'write', 'edit']).optional().describe('Filter by operation type'),
});

export const GetCompressionEventsInputSchema = z.object({
  sessionId: z.string().min(1).describe('Session UUID'),
});

export const GetDelegationEventsInputSchema = z.object({
  sessionId: z.string().min(1).describe('Session UUID'),
  subagentType: z.string().optional().describe('Filter by subagent type'),
});

export const GetMcpUsageInputSchema = z.object({
  sessionId: z.string().min(1).describe('Session UUID'),
  serverName: z.string().optional().describe('Filter by server name'),
});

export const GetQualitySignalsInputSchema = z.object({
  sessionId: z.string().min(1).describe('Session UUID'),
  signalType: z.enum(['test', 'build', 'lint']).optional().describe('Filter by signal type'),
});

export const SpawnSessionAnalystInputSchema = z.object({
  sessionId: z.string().min(1).describe('Session UUID to analyze'),
  compareToSessionId: z.string().optional().describe('Optional second session for comparison'),
  query: z.string().optional().describe('Specific question to answer'),
  focus: z.enum(['narrative', 'flow', 'quality', 'comprehensive']).optional().default('comprehensive')
    .describe('Analysis focus area'),
});

// =============================================================================
// Constitution Principle VII Reminder
// =============================================================================

/*
 * Per Constitution Principle VII, the following are AGENT REASONING,
 * not tool outputs:
 *
 * - phaseType: 'exploration' | 'implementation' | 'debugging'
 * - sessionQuality: 'smooth' | 'chaotic' | 'efficient'
 * - isStuck: boolean
 * - issuesIdentified: Issue[]
 * - recommendations: Recommendation[]
 * - missedOpportunities: MissedOpportunity[]
 *
 * These judgments are made by the Session Analyst subagent using the
 * data these tools provide. Tools return counts, sequences, timestamps,
 * and patterns. The agent interprets what they MEAN.
 */
