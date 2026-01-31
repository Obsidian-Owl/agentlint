/**
 * EP02 Orchestration Core - Interfaces
 *
 * This module defines the core interfaces for the orchestration layer.
 * Separated from types.ts to avoid circular dependencies with config.ts.
 *
 * @module orchestration/interfaces
 */

import type { IToolRegistry } from './tool-registry';
import type { OrchestratorConfig, SessionState, StreamChunk } from './types';
import type { ResolvedOrchestratorConfig } from './config';

/**
 * Interface for the Orchestrator.
 */
export interface IOrchestrator {
  /** Current configuration (with defaults applied) */
  readonly config: ResolvedOrchestratorConfig;

  /** Tool registry */
  readonly toolRegistry: IToolRegistry;

  /** Current session state (null if not running) */
  readonly sessionState: SessionState | null;

  /** Whether orchestrator is currently running */
  readonly isActive: boolean;

  /** Current subagent depth level (0 = main, 1 = subagent) */
  readonly depth: number;

  /**
   * Execute an analysis task
   * @param task - The task description/prompt (user message)
   * @param options - Optional settings including systemPrompt
   * @returns AsyncGenerator yielding StreamChunks
   */
  run(
    task: string,
    options?: { systemPrompt?: string }
  ): AsyncGenerator<StreamChunk, void, unknown>;

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

  /**
   * Dispose of the orchestrator and release all resources.
   * Clears all sessions, stops any running servers, and resets state.
   * Safe to call multiple times (idempotent).
   */
  dispose(): void;

  /**
   * Check if this orchestrator can spawn a subagent
   * @returns true if depth < MAX_SUBAGENT_DEPTH
   */
  canSpawnSubagent(): boolean;

  /**
   * Get configuration for spawning a subagent
   * @returns Config with incremented depth
   */
  getSubagentConfig(): OrchestratorConfig;

  /**
   * Get the underlying client for direct API calls (e.g., question replies).
   * Optional - only available on implementations that have a client.
   * @returns Client instance or null if not available
   */
  getClient?(): { replyToQuestion(requestId: string, answers: string[][]): Promise<void> } | null;
}
