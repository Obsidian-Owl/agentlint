/**
 * EP02 Orchestration Core - Type Definitions
 *
 * This module defines all types for the orchestration layer.
 * Types are organized by domain:
 * - Verbosity & Streaming (T010, T011)
 * - Configuration (T012)
 * - Session State & Findings (T013)
 * - Checkpointing
 * - Cognitive Workspace
 *
 * @module orchestration/types
 */

// =============================================================================
// Verbosity & Stream Types (T010)
// =============================================================================

/**
 * Output verbosity level controlling what information is displayed.
 * - 'quiet': Minimal output, only errors and final results
 * - 'normal': Standard output, findings and progress
 * - 'verbose': Detailed output, tool calls and reasoning
 * - 'debug': Full output, all internal state
 */
export type VerbosityLevel = 'quiet' | 'normal' | 'verbose' | 'debug';

/**
 * Type of streaming output chunk.
 * Used to categorize and filter output based on verbosity.
 */
export type StreamChunkType =
  | 'text' // Agent reasoning text
  | 'tool_start' // Tool invocation starting
  | 'tool_result' // Tool result received
  | 'finding' // New finding detected
  | 'phase_change' // Phase transition
  | 'checkpoint' // Checkpoint saved
  | 'error' // Error occurred
  | 'status' // Status update
  | 'user_question'; // Agent requesting user input (human-in-the-loop)

// =============================================================================
// Stream Chunk (T011)
// =============================================================================

/**
 * A single unit of streaming output from the orchestrator.
 * StreamChunks are yielded by the Orchestrator.run() generator.
 */
export interface StreamChunk {
  /** Type of this chunk */
  type: StreamChunkType;
  /** Minimum verbosity level required to display this chunk */
  level: VerbosityLevel;
  /** The content of this chunk */
  content: string;
  /** ISO-8601 timestamp when this chunk was created */
  timestamp: string;
  /** Optional additional metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Configuration (T012)
// =============================================================================

/**
 * Configuration for the Orchestrator instance.
 * All fields are optional with sensible defaults.
 */
export interface OrchestratorConfig {
  /** Claude model to use (default: 'claude-sonnet-4-20250514') */
  model?: string;
  /** Checkpoint interval in milliseconds (default: 60000) */
  checkpointIntervalMs?: number;
  /** Output verbosity level (default: 'normal') */
  verbosity?: VerbosityLevel;
  /** Working directory (default: process.cwd()) */
  cwd?: string;
  /** Additional system prompt content */
  systemPromptAppend?: string;
  /**
   * Setting sources to load from filesystem (default: ['project'])
   * - 'user': Global user settings (~/.claude/settings.json)
   * - 'project': Shared project settings (.claude/settings.json, CLAUDE.md)
   * - 'local': Local project settings (.claude/settings.local.json)
   *
   * IMPORTANT: Must include 'project' to load CLAUDE.md files for analysis.
   * If omitted or empty, SDK does not load any filesystem settings.
   */
  settingSources?: ('user' | 'project' | 'local')[];
  /**
   * Current subagent depth level (default: 0)
   * - 0: Main orchestrator (can spawn subagents)
   * - 1: Subagent (cannot spawn further subagents per C8)
   *
   * Maximum depth is 1 per Constitution Principle C8.
   */
  depth?: number;
  /**
   * Tools the orchestrator is allowed to use.
   * Must include 'Task' for subagent invocation (EP08).
   * If undefined, all tools are allowed.
   */
  allowedTools?: string[];
  /**
   * Non-interactive mode (default: false)
   * When true, auto-allows all tool calls without user prompts.
   * Used for CI/CD and automation scenarios.
   */
  nonInteractive?: boolean;
}

/**
 * Global agentlint configuration loaded from ~/.agentlint/config.json
 */
export interface AgentlintGlobalConfig {
  /** Claude model to use */
  model: string;
  /** Checkpoint configuration */
  checkpoint: {
    /** Checkpoint interval in milliseconds */
    intervalMs: number;
  };
  /** Default verbosity level */
  verbosity: VerbosityLevel;
}

// =============================================================================
// Session State (T013)
// =============================================================================

/**
 * Agentlint-specific session state (separate from SDK session).
 * Persisted to ~/.agentlint/sessions/{session-id}.json
 */
export interface SessionState {
  /** Session UUID (matches SDK session_id) */
  id: string;
  /** Current analysis phase */
  phase: string;
  /** ISO-8601 start timestamp */
  startedAt: string;
  /** ISO-8601 last checkpoint timestamp */
  lastCheckpointAt: string | null;
  /** Accumulated findings */
  findings: Finding[];
  /** Cache of tool results */
  toolResultCache: Record<string, ToolResult>;
  /** Monotonic checkpoint sequence number */
  checkpointSequence: number;
  /** Original task goal for context preservation */
  taskGoal: string;
  /** Project metadata */
  projectContext: ProjectContext;
}

/**
 * Cached result from a tool invocation.
 */
export interface ToolResult {
  /** Name of the tool that was invoked */
  toolName: string;
  /** Input provided to the tool */
  input: unknown;
  /** Output returned by the tool */
  output: unknown;
  /** ISO-8601 timestamp when the tool was invoked */
  timestamp: string;
  /** Duration of the tool execution in milliseconds */
  durationMs: number;
}

/**
 * Metadata about the project being analyzed.
 */
export interface ProjectContext {
  /** Project name */
  name: string;
  /** Project root path */
  path: string;
  /** Whether CLAUDE.md exists in the project */
  hasClaudeMd: boolean;
  /** Detected primary programming language */
  primaryLanguage: string | null;
  /** Detected ACT type (default: 'claude-code') */
  agentType: string;
}

// =============================================================================
// Findings (T013)
// =============================================================================

/**
 * Category of finding detected during analysis.
 */
export type FindingType =
  | 'config_gap' // Missing or incomplete configuration
  | 'config_antipattern' // Configuration anti-pattern
  | 'session_pattern' // Pattern detected in sessions
  | 'session_error' // Error pattern in sessions
  | 'quality_issue' // General quality concern
  | 'improvement'; // Improvement opportunity

/**
 * Severity level of a finding.
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * A single analysis finding with traced origin and recommendations.
 */
export interface Finding {
  /** Finding UUID */
  id: string;
  /** Category of finding */
  type: FindingType;
  /** Impact severity */
  severity: Severity;
  /** Short description */
  title: string;
  /** Detailed explanation */
  description: string;
  /** Source location if applicable */
  location: Location | null;
  /** Traced origin (session, config, git) */
  origin: Origin | null;
  /** Suggested fixes (at least one for actionable findings) */
  recommendations: Recommendation[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** ISO-8601 detection timestamp */
  detectedAt: string;
  /** Phase when detected */
  detectedInPhase: string;
}

/**
 * Source code location of a finding.
 */
export interface Location {
  /** File path */
  file: string;
  /** Line number (1-indexed) */
  line?: number;
  /** Column number (1-indexed) */
  column?: number;
  /** Code snippet */
  snippet?: string;
}

/**
 * Traced origin of a finding (where the issue originated).
 */
export interface Origin {
  /** Type of origin */
  type: 'config' | 'session' | 'git';
  /** Reference to the origin (file path, session ID, commit hash) */
  reference: string;
  /** ISO-8601 timestamp of the origin */
  timestamp?: string;
  /** Description of how this is the origin */
  description: string;
}

/**
 * A recommendation for addressing a finding.
 * Follows the DETECT -> TRACE -> UNDERSTAND -> RECOMMEND pattern.
 */
export interface Recommendation {
  /**
   * Type of recommendation:
   * - 'symptomatic': Quick fix for immediate issue
   * - 'preventive': Prevents recurrence
   * - 'systemic': Addresses root cause across system
   */
  type: 'symptomatic' | 'preventive' | 'systemic';
  /** Action to take */
  action: string;
  /** Why this recommendation helps */
  rationale: string;
  /** Priority of this recommendation */
  priority: 'high' | 'medium' | 'low';
  /** Estimated effort */
  effort?: 'trivial' | 'small' | 'medium' | 'large';
}

// =============================================================================
// Checkpointing
// =============================================================================

/**
 * What triggered a checkpoint event.
 */
export type CheckpointTrigger =
  | 'tool_complete' // After tool execution
  | 'finding' // New finding detected
  | 'phase_change' // Phase transition
  | 'interval' // Time-based interval
  | 'user_request' // Manual trigger
  | 'pre_compact' // Before context compression
  | 'session_end'; // Session termination

/**
 * Event emitted when a checkpoint is triggered.
 * Contains full session state for crash recovery.
 */
export interface CheckpointEvent {
  /** What triggered this checkpoint */
  trigger: CheckpointTrigger;
  /** Monotonic sequence number */
  sequence: number;
  /** Session ID */
  sessionId: string;
  /** Full session state snapshot */
  state: SessionState;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Additional context */
  metadata?: CheckpointMetadata;
}

/**
 * Additional metadata for checkpoint events.
 */
export interface CheckpointMetadata {
  /** Tool name (for tool_complete trigger) */
  toolName?: string;
  /** Finding ID (for finding trigger) */
  findingId?: string;
  /** Previous phase (for phase_change trigger) */
  previousPhase?: string;
  /** New phase (for phase_change trigger) */
  newPhase?: string;
  /** Compaction trigger (for pre_compact trigger) */
  compactionTrigger?: 'manual' | 'auto';
  /** Tokens before compaction (for pre_compact trigger) */
  preCompactTokens?: number;
}

// =============================================================================
// Cognitive Workspace
// =============================================================================

/**
 * Hierarchical context structure for agent reasoning.
 * Used to maintain cognitive state across context compressions.
 */
export interface CognitiveWorkspace {
  /** Current task objective */
  taskGoal: string;
  /** Project metadata */
  projectContext: ProjectContext;
  /** Analysis progress summary */
  progress: ProgressSummary;
  /** Compressed findings list */
  findings: FindingSummary[];
  /** Previous analysis context (for delta comparison) */
  baselineAwareness: BaselineAwareness | null;
  /** Relevant global learnings */
  globalLearnings: string[];
}

/**
 * Summary of analysis progress.
 */
export interface ProgressSummary {
  /** Current analysis phase */
  currentPhase: string;
  /** Number of tools invoked */
  toolsInvoked: number;
  /** Number of findings detected */
  findingsCount: number;
  /** Elapsed time in milliseconds */
  elapsedMs: number;
}

/**
 * Compressed summary of a finding (for cognitive workspace).
 */
export interface FindingSummary {
  /** Finding UUID */
  id: string;
  /** Category of finding */
  type: FindingType;
  /** Impact severity */
  severity: Severity;
  /** Short description */
  title: string;
}

/**
 * Context from previous analysis for delta comparison.
 */
export interface BaselineAwareness {
  /** ISO-8601 date of last analysis */
  lastAnalysisDate: string;
  /** Previous analysis score (if applicable) */
  previousScore?: number;
  /** Change in findings count */
  deltaFindings: number;
  /** Areas that need improvement */
  improvementAreas: string[];
}

// =============================================================================
// Session State File Format
// =============================================================================

/**
 * File format for persisted session state.
 * Stored at ~/.agentlint/sessions/{session-id}.json
 */
export interface SessionStateFile {
  /** File format version */
  version: '1.0.0';
  /** The session state */
  sessionState: SessionState;
}

// =============================================================================
// Events (for EP03 integration)
// =============================================================================

/**
 * Events emitted by the Orchestrator.
 * Used for EP03 integration with CLI and persistence.
 */
export interface OrchestratorEvents {
  /** Checkpoint saved */
  checkpoint: CheckpointEvent;
  /** New finding detected */
  finding: Finding;
  /** Phase transition */
  phaseChange: { from: string; to: string; timestamp: string };
  /** Session started */
  sessionStart: { sessionId: string; task: string; timestamp: string };
  /** Session ended */
  sessionEnd: { sessionId: string; reason: string; timestamp: string };
}

/**
 * Type-safe event handler for Orchestrator events.
 */
export type OrchestratorEventHandler<K extends keyof OrchestratorEvents> = (
  event: OrchestratorEvents[K]
) => void | Promise<void>;
