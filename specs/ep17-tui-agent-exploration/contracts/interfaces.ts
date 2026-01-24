/**
 * EP17 TUI Architecture - Type Contracts
 *
 * These interfaces define the public API for the TUI module.
 * Implementation will be in src/tui/types.ts.
 *
 * @module specs/ep17-tui-agent-exploration/contracts
 */

import type { StreamChunk, Finding, Recommendation, CheckpointData } from '../../src/orchestration/types';

// =============================================================================
// Analysis Phase
// =============================================================================

/**
 * Current phase of agent analysis.
 */
export type AnalysisPhase = 'idle' | 'scanning' | 'presenting' | 'exploring';

// =============================================================================
// Dialog Types
// =============================================================================

/**
 * Types of dialog overlays that can be displayed.
 */
export type DialogType =
  | 'permission'
  | 'recommendation'
  | 'session-list'
  | 'session-timeline';

/**
 * Focus target for key routing.
 */
export type FocusTarget = 'main' | 'dialog' | 'input';

// =============================================================================
// Exploration
// =============================================================================

/**
 * Single step in drill-down navigation history.
 */
export interface ExplorationStep {
  /** Unique identifier (UUID) */
  id: string;
  /** Topic being explored (e.g., "Skill invocation") */
  topic: string;
  /** Brief context for breadcrumb display */
  context: string;
  /** ISO-8601 when step was taken */
  timestamp: string;
  /** Parent step ID for tree structure */
  parentId: string | null;
}

/**
 * Option presented by the agent for user selection.
 */
export interface AgentOption {
  /** Display label */
  label: string;
  /** Brief description */
  description?: string;
  /** Value to send if selected */
  value: string;
}

/**
 * Agent's current understanding of user intent.
 * Used to construct prompts with context.
 */
export interface ConversationalContext {
  /** Topic currently being discussed */
  currentTopic: string | null;
  /** How deep in exploration (0 = root) */
  drillDownDepth: number;
  /** Skills, sessions, configs mentioned */
  mentionedEntities: string[];
  /** Last question agent asked user */
  lastAgentQuestion: string | null;
  /** Last thing user said */
  lastUserResponse: string | null;
  /** Options agent presented (for "1", "2" interpretation) */
  pendingOptions: AgentOption[];
}

// =============================================================================
// Permissions
// =============================================================================

/**
 * Scope of a permission decision.
 */
export type PermissionScope = 'session' | 'permanent';

/**
 * Cached decision for a permission request.
 */
export interface PermissionDecision {
  /** Whether permission was granted */
  allowed: boolean;
  /** How long decision lasts */
  scope: PermissionScope;
  /** ISO-8601 when decision was made */
  grantedAt: string;
  /** Tool name that was permitted/denied */
  tool: string;
  /** Path pattern if applicable */
  pattern: string | null;
}

/**
 * Persistent permission record (stored to disk).
 */
export interface PermissionRecord {
  allowed: boolean;
  scope: 'permanent';
  grantedAt: string;
  tool: string;
  pattern?: string;
}

/**
 * File format for ~/.agentlint/permissions.json
 */
export interface PermissionStore {
  version: '1.0.0';
  permissions: Record<string, PermissionRecord>;
}

// =============================================================================
// App State
// =============================================================================

/**
 * Central state model for the TUI application.
 * Single source of truth managed by appReducer.
 */
export interface AppState {
  // Analysis state
  analysisPhase: AnalysisPhase;
  isStreaming: boolean;
  isPaused: boolean;

  // View management
  viewStack: DialogType[];
  focusTarget: FocusTarget;

  // Exploration state
  explorationPath: ExplorationStep[];
  currentContext: ConversationalContext;

  // Buffers
  inputBuffer: string;
  streamBuffer: StreamChunk[];

  // Data
  findings: Finding[];
  recommendations: Recommendation[];

  // Permissions (session-only cache)
  permissionCache: Map<string, PermissionDecision>;

  // Recovery
  lastCheckpoint: CheckpointData | null;
}

// =============================================================================
// App Messages (Actions)
// =============================================================================

/**
 * All possible message types for appReducer.
 */
export type AppMessage =
  | { type: 'SET_PHASE'; payload: { phase: AnalysisPhase } }
  | { type: 'PUSH_DIALOG'; payload: { dialog: DialogType; context?: unknown } }
  | { type: 'POP_DIALOG' }
  | { type: 'ADD_STREAM_CHUNK'; payload: { chunk: StreamChunk } }
  | { type: 'CLEAR_STREAM' }
  | { type: 'SET_STREAMING'; payload: { isStreaming: boolean } }
  | { type: 'SET_PAUSED'; payload: { isPaused: boolean } }
  | { type: 'UPDATE_INPUT_BUFFER'; payload: { input: string } }
  | { type: 'CLEAR_INPUT_BUFFER' }
  | { type: 'ADD_EXPLORATION_STEP'; payload: { step: ExplorationStep } }
  | { type: 'POP_EXPLORATION' }
  | { type: 'ADD_FINDING'; payload: { finding: Finding } }
  | { type: 'ADD_RECOMMENDATION'; payload: { recommendation: Recommendation } }
  | { type: 'SET_CONTEXT'; payload: { context: ConversationalContext } }
  | { type: 'CACHE_PERMISSION'; payload: { key: string; decision: PermissionDecision } }
  | { type: 'SET_FOCUS'; payload: { target: FocusTarget } }
  | { type: 'SET_CHECKPOINT'; payload: { checkpoint: CheckpointData } };

// =============================================================================
// Reducer
// =============================================================================

/**
 * Reducer function type for app state management.
 */
export type AppReducer = (state: AppState, message: AppMessage) => AppState;

// =============================================================================
// Initial State Factory
// =============================================================================

/**
 * Creates initial AppState with default values.
 */
export function createInitialState(): AppState {
  return {
    analysisPhase: 'idle',
    isStreaming: false,
    isPaused: false,
    viewStack: [],
    focusTarget: 'main',
    explorationPath: [],
    currentContext: {
      currentTopic: null,
      drillDownDepth: 0,
      mentionedEntities: [],
      lastAgentQuestion: null,
      lastUserResponse: null,
      pendingOptions: [],
    },
    inputBuffer: '',
    streamBuffer: [],
    findings: [],
    recommendations: [],
    permissionCache: new Map(),
    lastCheckpoint: null,
  };
}

// =============================================================================
// Component Props
// =============================================================================

/**
 * Props for the root App component.
 */
export interface AppProps {
  /** Initial state (for testing or recovery) */
  initialState?: Partial<AppState>;
  /** Callback when user submits input */
  onInput?: (input: string) => void;
  /** Callback when analysis should start */
  onStart?: () => void;
  /** Callback when user exits */
  onExit?: () => void;
}

/**
 * Props for AgentOutput component.
 */
export interface AgentOutputProps {
  /** Chunks to display */
  chunks: StreamChunk[];
  /** Whether currently streaming */
  isStreaming: boolean;
}

/**
 * Props for InputField component.
 */
export interface InputFieldProps {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Submit handler */
  onSubmit: (value: string) => void;
  /** Whether input is disabled (during streaming) */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Props for DialogOverlay component.
 */
export interface DialogOverlayProps {
  /** Dialog content */
  children: React.ReactNode;
  /** Title for the dialog */
  title?: string;
  /** Dismiss handler (ESC key) */
  onDismiss?: () => void;
}

/**
 * Props for PermissionDialog component.
 */
export interface PermissionDialogProps {
  /** Tool requesting permission */
  tool: string;
  /** Description of what's being requested */
  description: string;
  /** Path/pattern if applicable */
  pattern?: string;
  /** Handler for permission decision */
  onDecision: (decision: PermissionDecision) => void;
}

/**
 * Props for RecommendationDialog component.
 */
export interface RecommendationDialogProps {
  /** The recommendation to display */
  recommendation: Recommendation;
  /** Handler for user's action choice */
  onAction: (action: 'accept' | 'dismiss' | 'defer') => void;
}

/**
 * Props for Breadcrumbs component.
 */
export interface BreadcrumbsProps {
  /** Navigation steps */
  steps: ExplorationStep[];
  /** Handler when user clicks a breadcrumb */
  onNavigate?: (stepId: string) => void;
}

// =============================================================================
// Renderer Interface
// =============================================================================

/**
 * Interface for TUI renderers (Ink or Headless).
 * Matches IStreamRenderer from cli/renderers but with TUI-specific methods.
 */
export interface ITuiRenderer {
  /** Start the TUI */
  start(props: AppProps): void;
  /** Stop the TUI */
  stop(): void;
  /** Render a stream chunk */
  renderChunk(chunk: StreamChunk): void;
  /** Render final result */
  renderComplete(result: unknown): void;
  /** Request permission from user */
  requestPermission(request: { tool: string; description: string; pattern?: string }): Promise<PermissionDecision>;
}
