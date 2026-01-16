/**
 * EP02: Orchestration Core
 *
 * This module wraps the Claude Agent SDK to power agentlint analysis sessions.
 * It provides:
 * - Master loop execution (Orchestrator)
 * - Tool registration and MCP server creation (ToolRegistry)
 * - Streaming output processing (StreamProcessor)
 * - Checkpointing for crash recovery (CheckpointHandler)
 * - Session state persistence (SessionState)
 * - Context workspace management (CognitiveWorkspace)
 *
 * @module orchestration
 */

// =============================================================================
// Types (T010-T013) - Phase 2 Complete
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
} from './types';

// =============================================================================
// Configuration (T017) - Phase 2 Complete
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
} from './config';

// =============================================================================
// Tool Registry (T021-T023) - Phase 3 Complete
// =============================================================================

export type { IToolRegistry } from './tool-registry';
export { ToolRegistry, createToolRegistry } from './tool-registry';

// =============================================================================
// Orchestrator (T024-T026) - Phase 3 Complete
// =============================================================================

export type { IOrchestrator } from './orchestrator';
export { Orchestrator, createOrchestrator } from './orchestrator';

// =============================================================================
// Streaming (T030-T032) - Phase 4 Complete
// =============================================================================

export type { IStreamProcessor } from './streaming';
export {
  StreamProcessor,
  createStreamProcessor,
  filterByVerbosity,
  shouldDisplay,
  createStreamChunk,
} from './streaming';

// =============================================================================
// Context Management (T029, T033-T034) - Phase 4 Complete
// =============================================================================

export type { ToolResultSummary, PreCompactHandler, PreCompactEvent } from './context';
export {
  handleToolResult,
  isLargeResult,
  createPreCompactHandler,
  buildPreservedContext,
  RESULT_SIZE_THRESHOLD,
} from './context';

// =============================================================================
// Checkpointing (T038-T040) - Phase 5 Complete
// =============================================================================

export type { ICheckpointHandler, CheckpointHandlerConfig } from './checkpoint';
export {
  CheckpointHandler,
  createCheckpointHandler,
  DEFAULT_CHECKPOINT_INTERVAL_MS,
} from './checkpoint';

// =============================================================================
// Session State (T044-T046) - Phase 6 Complete
// =============================================================================

export type { SessionSummary } from './session-state';
export {
  saveState,
  loadState,
  listSessions,
  deleteSession,
  getSessionsDir,
  getSessionFilePath,
  buildStateSummary,
  SESSION_STATE_VERSION,
} from './session-state';

// =============================================================================
// Cognitive Workspace (T051-T052) - Phase 7 Complete
// =============================================================================

export {
  buildCognitiveWorkspace,
  formatWorkspaceForPrompt,
  createProgressSummary,
  compressFindingsToSummary,
} from './cognitive-workspace';

// =============================================================================
// Configuration Exports (for subagent depth)
// =============================================================================

export { MAX_SUBAGENT_DEPTH } from './config';
