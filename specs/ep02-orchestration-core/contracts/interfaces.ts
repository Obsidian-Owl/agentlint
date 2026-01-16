/**
 * EP02 Orchestration Core - Contract Interfaces
 *
 * These interfaces define the contracts for the orchestration layer.
 * Implementation will be in src/orchestration/
 */

import type {
  SdkMcpToolDefinition,
  McpSdkServerConfigWithInstance,
  SDKMessage,
} from '@anthropic-ai/claude-agent-sdk';

// =============================================================================
// Verbosity & Stream Types
// =============================================================================

export type VerbosityLevel = 'quiet' | 'normal' | 'verbose' | 'debug';

export type StreamChunkType =
  | 'text'
  | 'tool_start'
  | 'tool_result'
  | 'finding'
  | 'phase_change'
  | 'checkpoint'
  | 'error'
  | 'status';

export interface StreamChunk {
  type: StreamChunkType;
  level: VerbosityLevel;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Configuration
// =============================================================================

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
}

export interface AgentlintGlobalConfig {
  model: string;
  checkpoint: {
    intervalMs: number;
  };
  verbosity: VerbosityLevel;
}

// =============================================================================
// Session State
// =============================================================================

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

export interface ToolResult {
  toolName: string;
  input: unknown;
  output: unknown;
  timestamp: string;
  durationMs: number;
}

export interface ProjectContext {
  name: string;
  path: string;
  hasClaudeMd: boolean;
  primaryLanguage: string | null;
  agentType: string;
}

// =============================================================================
// Findings
// =============================================================================

export type FindingType =
  | 'config_gap'
  | 'config_antipattern'
  | 'session_pattern'
  | 'session_error'
  | 'quality_issue'
  | 'improvement';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Finding {
  id: string;
  type: FindingType;
  severity: Severity;
  title: string;
  description: string;
  location: Location | null;
  origin: Origin | null;
  recommendations: Recommendation[];
  metadata?: Record<string, unknown>;
  detectedAt: string;
  detectedInPhase: string;
}

export interface Location {
  file: string;
  line?: number;
  column?: number;
  snippet?: string;
}

export interface Origin {
  type: 'config' | 'session' | 'git';
  reference: string;
  timestamp?: string;
  description: string;
}

export interface Recommendation {
  type: 'symptomatic' | 'preventive' | 'systemic';
  action: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  effort?: 'trivial' | 'small' | 'medium' | 'large';
}

// =============================================================================
// Checkpointing
// =============================================================================

export type CheckpointTrigger =
  | 'tool_complete'
  | 'finding'
  | 'phase_change'
  | 'interval'
  | 'user_request'
  | 'pre_compact'
  | 'session_end';

export interface CheckpointEvent {
  trigger: CheckpointTrigger;
  sequence: number;
  sessionId: string;
  state: SessionState;
  timestamp: string;
  metadata?: CheckpointMetadata;
}

export interface CheckpointMetadata {
  toolName?: string;
  findingId?: string;
  previousPhase?: string;
  newPhase?: string;
  compactionTrigger?: 'manual' | 'auto';
  preCompactTokens?: number;
}

// =============================================================================
// Cognitive Workspace
// =============================================================================

export interface CognitiveWorkspace {
  taskGoal: string;
  projectContext: ProjectContext;
  progress: ProgressSummary;
  findings: FindingSummary[];
  baselineAwareness: BaselineAwareness | null;
  globalLearnings: string[];
}

export interface ProgressSummary {
  currentPhase: string;
  toolsInvoked: number;
  findingsCount: number;
  elapsedMs: number;
}

export interface FindingSummary {
  id: string;
  type: FindingType;
  severity: Severity;
  title: string;
}

export interface BaselineAwareness {
  lastAnalysisDate: string;
  previousScore?: number;
  deltaFindings: number;
  improvementAreas: string[];
}

// =============================================================================
// Tool Registry
// =============================================================================

export interface IToolRegistry {
  /** Register a single tool */
  register(tool: SdkMcpToolDefinition<unknown>): void;

  /** Register multiple tools */
  registerMany(tools: SdkMcpToolDefinition<unknown>[]): void;

  /** Get tool by name */
  get(name: string): SdkMcpToolDefinition<unknown> | undefined;

  /** List all tool names */
  list(): string[];

  /** Get MCP server configuration for SDK */
  toMcpServer(): McpSdkServerConfigWithInstance;
}

// =============================================================================
// Orchestrator
// =============================================================================

export interface IOrchestrator {
  /** Current configuration */
  readonly config: Required<OrchestratorConfig>;

  /** Tool registry */
  readonly toolRegistry: IToolRegistry;

  /** Current session state (null if not running) */
  readonly sessionState: SessionState | null;

  /** Whether orchestrator is currently running */
  readonly isActive: boolean;

  /**
   * Execute an analysis task
   * @param task - The task description/prompt
   * @returns AsyncGenerator yielding StreamChunks
   */
  run(task: string): AsyncGenerator<StreamChunk, void, unknown>;

  /**
   * Resume a previous session
   * @param sessionId - The session ID to resume
   * @returns AsyncGenerator yielding StreamChunks
   */
  resume(sessionId: string): AsyncGenerator<StreamChunk, void, unknown>;

  /**
   * Interrupt the current execution
   */
  interrupt(): Promise<void>;
}

// =============================================================================
// Checkpoint Handler
// =============================================================================

export interface ICheckpointHandler {
  /**
   * Handle a checkpoint event
   * @param event - The checkpoint event
   */
  onCheckpoint(event: CheckpointEvent): Promise<void>;

  /**
   * Load session state from storage
   * @param sessionId - The session ID
   * @returns The session state or null if not found
   */
  loadState(sessionId: string): Promise<SessionState | null>;

  /**
   * Delete session state
   * @param sessionId - The session ID
   */
  deleteState(sessionId: string): Promise<void>;
}

// =============================================================================
// Stream Processor
// =============================================================================

export interface IStreamProcessor {
  /**
   * Process an SDK message into stream chunks
   * @param message - The SDK message
   * @returns Array of stream chunks (may be empty)
   */
  process(message: SDKMessage): StreamChunk[];

  /**
   * Filter chunks by verbosity level
   * @param chunks - The chunks to filter
   * @param level - The minimum verbosity level
   * @returns Filtered chunks
   */
  filterByVerbosity(chunks: StreamChunk[], level: VerbosityLevel): StreamChunk[];
}

// =============================================================================
// Session State File Format
// =============================================================================

export interface SessionStateFile {
  version: '1.0.0';
  sessionState: SessionState;
}

// =============================================================================
// Events (for EP03 integration)
// =============================================================================

export interface OrchestratorEvents {
  checkpoint: CheckpointEvent;
  finding: Finding;
  phaseChange: { from: string; to: string; timestamp: string };
  sessionStart: { sessionId: string; task: string; timestamp: string };
  sessionEnd: { sessionId: string; reason: string; timestamp: string };
}

export type OrchestratorEventHandler<K extends keyof OrchestratorEvents> = (
  event: OrchestratorEvents[K]
) => void | Promise<void>;
