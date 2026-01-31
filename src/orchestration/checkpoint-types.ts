/**
 * EP11 Quality & Security - Session Checkpoint Type Extensions
 *
 * Extensions to EP02 checkpoint system for session recording and replay.
 * These types enable crash recovery, session replay, and retention policies.
 *
 * @module orchestration/checkpoint-types
 */

// =============================================================================
// Analysis Phases
// =============================================================================

/**
 * Phases of analysis execution.
 */
export type AnalysisPhase =
  | 'init' // Initialization
  | 'scan' // File scanning
  | 'analyze' // Analysis in progress
  | 'recommend' // Generating recommendations
  | 'complete'; // Analysis complete

// =============================================================================
// Tool History
// =============================================================================

/**
 * A recorded tool invocation.
 */
export interface ToolHistoryEntry {
  /** Tool name */
  tool: string;

  /** Arguments (redacted for sensitive data) */
  arguments: Record<string, unknown>;

  /** Result summary (truncated and redacted) */
  resultSummary: string;

  /** Invocation timestamp */
  timestamp: string;

  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Maximum length for result summaries.
 */
export const MAX_RESULT_SUMMARY_LENGTH = 500;

// =============================================================================
// Finding Summary
// =============================================================================

/**
 * A summarized finding for checkpoint state.
 */
export interface CheckpointFindingSummary {
  /** Finding identifier */
  id: string;

  /** Finding type */
  type: string;

  /** Location in the codebase */
  location: {
    file: string;
    line: number;
  };

  /** Brief description */
  summary?: string;
}

// =============================================================================
// Session Metrics
// =============================================================================

/**
 * Metrics collected during the session.
 */
export interface SessionMetrics {
  /** Number of tool calls made */
  toolCalls: number;

  /** Number of LLM calls made */
  llmCalls: number;

  /** Total tokens used (input + output) */
  tokensUsed: number;

  /** Input tokens used (for telemetry) */
  inputTokens: number;

  /** Output tokens used (for telemetry) */
  outputTokens: number;

  /** Elapsed time in milliseconds */
  elapsedMs: number;
}

// =============================================================================
// Session Checkpoint
// =============================================================================

/**
 * Checkpoint trigger types for session recording.
 */
export type SessionCheckpointTrigger =
  | 'tool_complete' // After a tool finishes
  | 'finding' // When a finding is detected
  | 'phase_transition' // When moving to new phase
  | 'interval' // Time-based interval
  | 'compact' // Before context compaction
  | 'session_end' // End of session
  | 'user_request'; // User requested checkpoint

/**
 * Extended checkpoint format for session recording.
 */
export interface SessionCheckpoint {
  /** Schema version */
  version: '1.0';

  /** Session identifier */
  sessionId: string;

  /** Checkpoint timestamp */
  timestamp: string;

  /** Sequence number */
  sequence: number;

  /** Current analysis phase */
  phase: AnalysisPhase;

  /** What triggered this checkpoint */
  trigger: SessionCheckpointTrigger;

  /** Tool call history (redacted) */
  toolHistory: ToolHistoryEntry[];

  /** Current findings */
  findings: CheckpointFindingSummary[];

  /** Session metrics */
  metrics: SessionMetrics;

  /** Optional cognitive workspace state */
  workspaceState?: Record<string, unknown>;

  /** Trace context for observability (EP22 T061) */
  traceContext?: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
  };
}

// =============================================================================
// Retention Configuration
// =============================================================================

/**
 * Checkpoint retention configuration.
 */
export interface CheckpointRetentionConfig {
  /** Number of days to retain checkpoints (0 = never delete) */
  retentionDays: number;
}

/**
 * Default retention configuration.
 */
export const DEFAULT_RETENTION: CheckpointRetentionConfig = {
  retentionDays: 7,
};

/**
 * Maximum allowed retention days.
 */
export const MAX_RETENTION_DAYS = 365;

// =============================================================================
// Session Recording Interface
// =============================================================================

/**
 * Summary of a recorded session.
 */
export interface SessionSummary {
  /** Session identifier */
  sessionId: string;

  /** First checkpoint timestamp */
  startedAt: string;

  /** Last checkpoint timestamp */
  lastCheckpointAt: string;

  /** Number of checkpoints */
  checkpointCount: number;

  /** Final phase reached */
  finalPhase: AnalysisPhase;

  /** Total size in bytes */
  sizeBytes: number;
}

/**
 * Interface for session recording.
 */
export interface ISessionRecorder {
  /**
   * Start recording a new session.
   */
  startRecording(sessionId: string): void;

  /**
   * Record a checkpoint.
   */
  recordCheckpoint(checkpoint: SessionCheckpoint): Promise<void>;

  /**
   * Stop recording.
   */
  stopRecording(): void;

  /**
   * Get recorded checkpoints for a session.
   */
  getCheckpoints(sessionId: string): Promise<SessionCheckpoint[]>;

  /**
   * Get the latest checkpoint for a session.
   */
  getLatestCheckpoint(sessionId: string): Promise<SessionCheckpoint | null>;

  /**
   * List all recorded sessions.
   */
  listSessions(): Promise<SessionSummary[]>;

  /**
   * Delete a session's checkpoints.
   */
  deleteSession(sessionId: string): void;

  /**
   * Clean up old checkpoints based on retention policy.
   */
  cleanupOldCheckpoints(retentionDays: number): Promise<number>;
}

// =============================================================================
// Session Replay Interface
// =============================================================================

/**
 * Context needed to resume from a checkpoint.
 */
export interface ReplayContext {
  /** Session identifier */
  sessionId: string;

  /** Phase to resume from */
  phase: AnalysisPhase;

  /** Findings to carry forward */
  findings: CheckpointFindingSummary[];

  /** Metrics accumulated so far */
  metrics: SessionMetrics;

  /** Any workspace state to restore */
  workspaceState?: Record<string, unknown>;
}

/**
 * Interface for session replay.
 */
export interface ISessionReplayer {
  /**
   * Check if a session can be replayed.
   */
  canReplay(sessionId: string): Promise<boolean>;

  /**
   * Load a session for replay.
   */
  loadSession(sessionId: string): Promise<SessionCheckpoint[]>;

  /**
   * Get the state at a specific checkpoint.
   */
  getStateAt(sessionId: string, sequence: number): Promise<SessionCheckpoint | null>;

  /**
   * Restore session state from a checkpoint.
   */
  restoreFromCheckpoint(checkpoint: SessionCheckpoint): ReplayContext;
}

// =============================================================================
// Crash Recovery
// =============================================================================

/**
 * Check for recoverable sessions.
 */
export interface CrashRecoveryInfo {
  /** Session ID that can be recovered */
  sessionId: string;

  /** When the session was started */
  startedAt: string;

  /** When the last checkpoint was taken */
  lastCheckpointAt: string;

  /** Phase at last checkpoint */
  phase: AnalysisPhase;

  /** Number of findings so far */
  findingsCount: number;
}

/**
 * Interface for crash recovery.
 */
export interface ICrashRecovery {
  /**
   * Check for any sessions that can be recovered.
   */
  checkForRecoverableSessions(): Promise<CrashRecoveryInfo[]>;

  /**
   * Prompt user about recovery.
   */
  promptForRecovery(info: CrashRecoveryInfo): Promise<boolean>;

  /**
   * Recover a session.
   */
  recoverSession(sessionId: string): Promise<ReplayContext>;
}

// =============================================================================
// CLI Integration
// =============================================================================

/**
 * CLI options for session replay.
 */
export interface ReplayCLIOptions {
  /** Session ID to replay */
  replay?: string;
}

// =============================================================================
// Storage Path Utilities
// =============================================================================

/**
 * Get the checkpoint storage directory.
 */
export function getCheckpointStorageDir(): string {
  return '.agentlint/session-state';
}

/**
 * Get the checkpoint file path for a session.
 */
export function getCheckpointFilePath(sessionId: string, sequence: number): string {
  return `${getCheckpointStorageDir()}/${sessionId}/${sequence.toString().padStart(4, '0')}.json`;
}
