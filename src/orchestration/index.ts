/**
 * Orchestration Core
 *
 * Provides tool registration, configuration, checkpointing,
 * context management, and the orchestrator factory.
 *
 * @module orchestration
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Verbosity & Streaming
  VerbosityLevel,
  StreamChunkType,
  StreamChunk,
  // Configuration
  OrchestratorConfig,
  AgentlintGlobalConfig,
  // Session State
  SessionState,
  ToolResult,
  ProjectContext,
  // Findings
  FindingType,
  Severity,
  Finding,
  Location,
  Origin,
  Recommendation,
  // Checkpointing
  CheckpointTrigger,
  CheckpointEvent,
  CheckpointMetadata,
  // Cognitive Workspace
  CognitiveWorkspace,
  ProgressSummary,
  FindingSummary,
  BaselineAwareness,
  // File Formats
  SessionStateFile,
  // Events
  OrchestratorEvents,
  OrchestratorEventHandler,
  // Permission
  PermissionResult,
  // Telemetry
  IOrchestratorTelemetryClient,
} from './types';

export { shouldDisplay } from './types';

// =============================================================================
// Configuration
// =============================================================================

export {
  loadConfig,
  getDefaultConfig,
  getDefaultGlobalConfig,
  saveGlobalConfig,
  initializeConfig,
  getConfigDir,
  getConfigFilePath,
  configFileExists,
  mergeWithDefaults,
  MAX_SUBAGENT_DEPTH,
} from './config';

// =============================================================================
// Tool Registry
// =============================================================================

export type { IToolRegistry, ToolDefinition } from './tool-registry';
export { ToolRegistry, createToolRegistry } from './tool-registry';

// =============================================================================
// Orchestrator
// =============================================================================

export type { IOrchestrator } from './interfaces';

import { OpencodeOrchestrator } from '../opencode/orchestrator';
import type { OrchestratorConfig } from './types';
import type { IToolRegistry } from './tool-registry';
import type { IOrchestrator } from './interfaces';

export function createOrchestrator(
  config: OrchestratorConfig,
  toolRegistry: IToolRegistry
): IOrchestrator {
  return new OpencodeOrchestrator(config, toolRegistry);
}

// =============================================================================
// Context Management
// =============================================================================

export type { ToolResultSummary } from './context';
export { handleToolResult, isLargeResult, RESULT_SIZE_THRESHOLD } from './context';

// =============================================================================
// Checkpointing
// =============================================================================

export type { ICheckpointHandler, CheckpointHandlerConfig } from './checkpoint';
export {
  CheckpointHandler,
  createCheckpointHandler,
  DEFAULT_CHECKPOINT_INTERVAL_MS,
} from './checkpoint';

// =============================================================================
// Retry Logic
// =============================================================================

export type { RetryConfig, RetryCallback } from './retry';
export { withRetry } from './retry';

// =============================================================================
// Execution Context
// =============================================================================

export type { ExecutionContext } from './execution-context';
export {
  runWithExecutionContext,
  getTargetDirectory,
  getExecutionContext,
  hasExecutionContext,
} from './execution-context';

// =============================================================================
// Telemetry Utilities
// =============================================================================

export { truncateToolOutput, truncateToolInput, extractErrorMessage } from './telemetry-utils';
