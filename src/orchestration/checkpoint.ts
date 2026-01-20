/**
 * EP02 Orchestration Core - Checkpoint Handler
 *
 * Emits checkpoint events for crash recovery and session persistence.
 * Checkpoints are triggered by:
 * - Tool completion (PostToolUse hook)
 * - Finding detection
 * - Phase transitions
 * - Time-based intervals
 * - Context compression (PreCompact hook)
 * - Session end
 * - User request
 *
 * Implementation tasks:
 * - T038: ICheckpointHandler interface
 * - T039: Checkpoint triggers
 * - T040: Interval-based checkpoint timer
 *
 * @module orchestration/checkpoint
 */

import type { CheckpointEvent, CheckpointTrigger, CheckpointMetadata, SessionState } from './types';

// =============================================================================
// Constants
// =============================================================================

/**
 * Default checkpoint interval in milliseconds (1 minute).
 */
export const DEFAULT_CHECKPOINT_INTERVAL_MS = 60_000;

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for the CheckpointHandler.
 */
export interface CheckpointHandlerConfig {
  /** Interval for time-based checkpoints in milliseconds (default: 60000) */
  intervalMs?: number;
  /** Callback invoked when a checkpoint is emitted */
  onCheckpoint: (event: CheckpointEvent) => void;
  /** Function to get current session state (required for interval checkpoints) */
  getState?: () => SessionState;
}

/**
 * Interface for checkpoint handling.
 */
export interface ICheckpointHandler {
  /**
   * Emit a checkpoint event.
   *
   * @param trigger - What triggered this checkpoint
   * @param state - Current session state
   * @param metadata - Additional context for the trigger
   */
  emit(trigger: CheckpointTrigger, state: SessionState, metadata?: CheckpointMetadata): void;

  /**
   * Start the interval-based checkpoint timer.
   * Requires getState to be configured.
   */
  start(): void;

  /**
   * Stop the interval-based checkpoint timer.
   */
  stop(): void;

  /**
   * Check if interval timer is currently running.
   */
  isRunning(): boolean;

  /**
   * Get current sequence number.
   */
  getSequence(): number;

  /**
   * Get configured interval in milliseconds.
   */
  getIntervalMs(): number;

  /**
   * Reset handler to initial state.
   */
  reset(): void;
}

// =============================================================================
// Implementation (T038, T039, T040)
// =============================================================================

/**
 * Handles checkpoint emission for crash recovery and session persistence.
 *
 * @example
 * ```typescript
 * const handler = createCheckpointHandler({
 *   intervalMs: 60000,
 *   onCheckpoint: (event) => {
 *     console.log(`Checkpoint ${event.sequence}: ${event.trigger}`);
 *     saveState(event.state);
 *   },
 *   getState: () => orchestrator.getSessionState(),
 * });
 *
 * // Start interval-based checkpoints
 * handler.start();
 *
 * // Emit on tool completion
 * handler.emit('tool_complete', state, { toolName: 'read_file' });
 *
 * // Stop on session end
 * handler.stop();
 * ```
 */
export class CheckpointHandler implements ICheckpointHandler {
  private sequence: number = 0;
  private intervalMs: number;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private onCheckpoint: (event: CheckpointEvent) => void;
  private getState: (() => SessionState) | undefined;

  constructor(config: CheckpointHandlerConfig) {
    this.intervalMs = config.intervalMs ?? DEFAULT_CHECKPOINT_INTERVAL_MS;
    this.onCheckpoint = config.onCheckpoint;
    this.getState = config.getState;
  }

  /**
   * Emit a checkpoint event (T039).
   */
  emit(trigger: CheckpointTrigger, state: SessionState, metadata?: CheckpointMetadata): void {
    // Increment sequence
    this.sequence++;

    // Create timestamp
    const timestamp = new Date().toISOString();

    // Create deep copy of state with updated checkpoint info
    const stateSnapshot = this.createStateSnapshot(state, timestamp);

    // Create checkpoint event - only include metadata if defined
    const event: CheckpointEvent = {
      trigger,
      sequence: this.sequence,
      sessionId: state.id,
      state: stateSnapshot,
      timestamp,
      ...(metadata !== undefined && { metadata }),
    };

    // Invoke callback
    this.onCheckpoint(event);
  }

  /**
   * Start the interval-based checkpoint timer (T040).
   */
  start(): void {
    if (this.intervalTimer) {
      return; // Already running
    }

    if (!this.getState) {
      throw new Error('Cannot start interval timer without getState configuration');
    }

    this.intervalTimer = setInterval(() => {
      if (this.getState) {
        const state = this.getState();
        this.emit('interval', state);
      }
    }, this.intervalMs);
  }

  /**
   * Stop the interval-based checkpoint timer.
   */
  stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  /**
   * Check if interval timer is currently running.
   */
  isRunning(): boolean {
    return this.intervalTimer !== null;
  }

  /**
   * Get current sequence number.
   */
  getSequence(): number {
    return this.sequence;
  }

  /**
   * Get configured interval in milliseconds.
   */
  getIntervalMs(): number {
    return this.intervalMs;
  }

  /**
   * Reset handler to initial state.
   */
  reset(): void {
    this.stop();
    this.sequence = 0;
  }

  /**
   * Create a deep copy of session state with checkpoint info updated.
   */
  private createStateSnapshot(state: SessionState, timestamp: string): SessionState {
    // Deep clone via JSON serialization
    const snapshot: SessionState = JSON.parse(JSON.stringify(state)) as SessionState;

    // Update checkpoint-related fields
    snapshot.lastCheckpointAt = timestamp;
    snapshot.checkpointSequence = this.sequence;

    return snapshot;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new CheckpointHandler instance.
 *
 * @param config - Handler configuration
 * @returns Configured CheckpointHandler
 */
export function createCheckpointHandler(config: CheckpointHandlerConfig): ICheckpointHandler {
  return new CheckpointHandler(config);
}

// =============================================================================
// EP11: Session Recording (T054)
// =============================================================================

import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type {
  SessionCheckpoint,
  SessionSummary,
  ISessionRecorder,
  ISessionReplayer,
  ReplayContext,
  CheckpointRetentionConfig,
} from './checkpoint-types';
import {
  MAX_RETENTION_DAYS,
  getCheckpointStorageDir,
} from './checkpoint-types';

// =============================================================================
// Session Recording Configuration
// =============================================================================

/**
 * Configuration for SessionRecorder.
 */
export interface SessionRecorderConfig {
  /** Base directory for session storage (default: ~/.agentlint/session-state) */
  storageDir?: string;
  /** Retention policy configuration */
  retention?: CheckpointRetentionConfig;
}

/**
 * Get the default storage directory.
 */
function getDefaultStorageDir(): string {
  return join(homedir(), getCheckpointStorageDir());
}

// =============================================================================
// SessionRecorder Implementation
// =============================================================================

/**
 * Records session checkpoints to disk for crash recovery and replay.
 *
 * @example
 * ```typescript
 * const recorder = createSessionRecorder();
 * recorder.startRecording('session-123');
 *
 * await recorder.recordCheckpoint({
 *   version: '1.0',
 *   sessionId: 'session-123',
 *   timestamp: new Date().toISOString(),
 *   sequence: 1,
 *   phase: 'analyze',
 *   trigger: 'tool_complete',
 *   toolHistory: [...],
 *   findings: [...],
 *   metrics: { toolCalls: 5, llmCalls: 2, tokensUsed: 1500, elapsedMs: 5000 },
 * });
 *
 * await recorder.stopRecording();
 * ```
 */
export class SessionRecorder implements ISessionRecorder {
  private storageDir: string;
  private currentSessionId: string | null = null;

  constructor(config: SessionRecorderConfig = {}) {
    this.storageDir = config.storageDir ?? getDefaultStorageDir();
  }

  /**
   * Start recording a new session.
   */
  startRecording(sessionId: string): void {
    if (this.currentSessionId) {
      throw new Error(`Already recording session: ${this.currentSessionId}`);
    }

    this.currentSessionId = sessionId;

    // Create session directory
    const sessionDir = join(this.storageDir, sessionId);
    mkdirSync(sessionDir, { recursive: true });
  }

  /**
   * Record a checkpoint to storage.
   */
  async recordCheckpoint(checkpoint: SessionCheckpoint): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error('No active recording session. Call startRecording() first.');
    }

    if (checkpoint.sessionId !== this.currentSessionId) {
      throw new Error(
        `Checkpoint session ID (${checkpoint.sessionId}) does not match current session (${this.currentSessionId})`
      );
    }

    const filePath = this.getCheckpointFilePath(checkpoint.sessionId, checkpoint.sequence);

    // Ensure directory exists
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Write checkpoint to file
    await Bun.write(filePath, JSON.stringify(checkpoint, null, 2));
  }

  /**
   * Stop recording the current session.
   */
  async stopRecording(): Promise<void> {
    this.currentSessionId = null;
  }

  /**
   * Get all checkpoints for a session.
   */
  async getCheckpoints(sessionId: string): Promise<SessionCheckpoint[]> {
    const sessionDir = join(this.storageDir, sessionId);

    if (!existsSync(sessionDir)) {
      return [];
    }

    const files = readdirSync(sessionDir)
      .filter((f) => f.endsWith('.json'))
      .sort();

    const checkpoints: SessionCheckpoint[] = [];

    for (const file of files) {
      const filePath = join(sessionDir, file);
      const content = await Bun.file(filePath).text();
      checkpoints.push(JSON.parse(content) as SessionCheckpoint);
    }

    return checkpoints;
  }

  /**
   * Get the latest checkpoint for a session.
   */
  async getLatestCheckpoint(sessionId: string): Promise<SessionCheckpoint | null> {
    const checkpoints = await this.getCheckpoints(sessionId);
    return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1]! : null;
  }

  /**
   * List all recorded sessions.
   */
  async listSessions(): Promise<SessionSummary[]> {
    if (!existsSync(this.storageDir)) {
      return [];
    }

    const summaries: SessionSummary[] = [];
    const dirs = readdirSync(this.storageDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const sessionId of dirs) {
      const checkpoints = await this.getCheckpoints(sessionId);

      if (checkpoints.length > 0) {
        const sessionDir = join(this.storageDir, sessionId);
        const sizeBytes = this.calculateDirectorySize(sessionDir);

        summaries.push({
          sessionId,
          startedAt: checkpoints[0]!.timestamp,
          lastCheckpointAt: checkpoints[checkpoints.length - 1]!.timestamp,
          checkpointCount: checkpoints.length,
          finalPhase: checkpoints[checkpoints.length - 1]!.phase,
          sizeBytes,
        });
      }
    }

    return summaries;
  }

  /**
   * Delete a session's checkpoints.
   */
  async deleteSession(sessionId: string): Promise<void> {
    const sessionDir = join(this.storageDir, sessionId);

    if (existsSync(sessionDir)) {
      rmSync(sessionDir, { recursive: true, force: true });
    }
  }

  /**
   * Clean up old checkpoints based on retention policy.
   *
   * @param retentionDays - Number of days to retain (0 = never delete)
   * @returns Number of sessions deleted
   */
  async cleanupOldCheckpoints(retentionDays: number): Promise<number> {
    // Validate retention days
    if (retentionDays < 0 || retentionDays > MAX_RETENTION_DAYS) {
      throw new Error(`Retention days must be between 0 and ${MAX_RETENTION_DAYS}`);
    }

    // 0 means never delete
    if (retentionDays === 0) {
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deletedCount = 0;
    const sessions = await this.listSessions();

    for (const session of sessions) {
      const lastCheckpointDate = new Date(session.lastCheckpointAt);

      if (lastCheckpointDate < cutoffDate) {
        await this.deleteSession(session.sessionId);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Get storage directory for this recorder.
   */
  getStorageDir(): string {
    return this.storageDir;
  }

  /**
   * Get the file path for a checkpoint.
   */
  private getCheckpointFilePath(sessionId: string, sequence: number): string {
    return join(this.storageDir, sessionId, `${sequence.toString().padStart(4, '0')}.json`);
  }

  /**
   * Calculate total size of a directory in bytes.
   */
  private calculateDirectorySize(dirPath: string): number {
    let totalSize = 0;

    const files = readdirSync(dirPath);
    for (const file of files) {
      const filePath = join(dirPath, file);
      const stats = statSync(filePath);
      totalSize += stats.size;
    }

    return totalSize;
  }
}

// =============================================================================
// SessionReplayer Implementation
// =============================================================================

/**
 * Replays recorded sessions for crash recovery and debugging.
 *
 * @example
 * ```typescript
 * const replayer = createSessionReplayer();
 *
 * if (await replayer.canReplay('session-123')) {
 *   const checkpoints = await replayer.loadSession('session-123');
 *   const context = await replayer.restoreFromCheckpoint(checkpoints[checkpoints.length - 1]);
 *   // Resume analysis from context.phase with context.findings
 * }
 * ```
 */
export class SessionReplayer implements ISessionReplayer {
  private recorder: ISessionRecorder;

  constructor(recorder: ISessionRecorder) {
    this.recorder = recorder;
  }

  /**
   * Check if a session can be replayed.
   */
  async canReplay(sessionId: string): Promise<boolean> {
    const checkpoints = await this.recorder.getCheckpoints(sessionId);
    return checkpoints.length > 0;
  }

  /**
   * Load all checkpoints for a session.
   */
  async loadSession(sessionId: string): Promise<SessionCheckpoint[]> {
    return this.recorder.getCheckpoints(sessionId);
  }

  /**
   * Get the state at a specific checkpoint sequence number.
   */
  async getStateAt(sessionId: string, sequence: number): Promise<SessionCheckpoint | null> {
    const checkpoints = await this.recorder.getCheckpoints(sessionId);
    return checkpoints.find((c) => c.sequence === sequence) ?? null;
  }

  /**
   * Restore session state from a checkpoint.
   */
  async restoreFromCheckpoint(checkpoint: SessionCheckpoint): Promise<ReplayContext> {
    const context: ReplayContext = {
      sessionId: checkpoint.sessionId,
      phase: checkpoint.phase,
      findings: checkpoint.findings,
      metrics: checkpoint.metrics,
    };

    if (checkpoint.workspaceState !== undefined) {
      context.workspaceState = checkpoint.workspaceState;
    }

    return context;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new SessionRecorder instance.
 */
export function createSessionRecorder(config?: SessionRecorderConfig): SessionRecorder {
  return new SessionRecorder(config);
}

/**
 * Create a new SessionReplayer instance.
 */
export function createSessionReplayer(recorder?: ISessionRecorder): SessionReplayer {
  const rec = recorder ?? createSessionRecorder();
  return new SessionReplayer(rec);
}
