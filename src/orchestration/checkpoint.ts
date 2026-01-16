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

import type {
  CheckpointEvent,
  CheckpointTrigger,
  CheckpointMetadata,
  SessionState,
} from './types';

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
  emit(
    trigger: CheckpointTrigger,
    state: SessionState,
    metadata?: CheckpointMetadata
  ): void;

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
  emit(
    trigger: CheckpointTrigger,
    state: SessionState,
    metadata?: CheckpointMetadata
  ): void {
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
      throw new Error(
        'Cannot start interval timer without getState configuration'
      );
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
  private createStateSnapshot(
    state: SessionState,
    timestamp: string
  ): SessionState {
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
export function createCheckpointHandler(
  config: CheckpointHandlerConfig
): ICheckpointHandler {
  return new CheckpointHandler(config);
}
