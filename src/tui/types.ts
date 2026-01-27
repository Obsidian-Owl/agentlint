/**
 * EP17 TUI Architecture - Type Definitions
 *
 * These types define the state and messaging model for the TUI module.
 * They implement the contracts from specs/ep17-tui-agent-exploration/contracts/interfaces.ts.
 *
 * @module tui/types
 */

import type { StreamChunk, Finding, Recommendation } from '../orchestration/types';
import type { SessionCheckpoint } from '../orchestration/checkpoint-types';

// =============================================================================
// TUI State Machine
// =============================================================================

/**
 * Top-level TUI state for the welcome flow and conversation mode.
 * Controls which major view is displayed.
 */
export type TuiState =
  | 'loading' // Initial render, gathering context
  | 'welcome' // Showing LLM-generated welcome
  | 'analysing' // Agent running analysis
  | 'presenting' // Showing findings, enable exploration
  | 'idle' // Waiting for user input
  | 'conversing'; // Follow-up conversation active

/**
 * Loading step for progressive context loading display.
 */
export interface LoadingStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'complete' | 'error' | 'skipped';
  detail?: string;
}

/**
 * Context for the status bar display.
 */
export interface StatusBarContext {
  helpHint: string;
  status: string;
  model: string;
  openRecommendations: number;
  projectPath: string;
}

// =============================================================================
// Analysis Phase
// =============================================================================

/**
 * Current phase of agent analysis.
 * This is the TUI-specific phase tracking, distinct from orchestration's AnalysisPhase.
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
  | 'question'
  | 'session-list'
  | 'session-timeline';

// =============================================================================
// User Questions (AskUserQuestion Tool)
// =============================================================================

/**
 * Option for a user question.
 */
export interface UserQuestionOption {
  /** Display label for the option */
  label: string;
  /** Description explaining the option */
  description?: string;
}

/**
 * A question to present to the user.
 * Maps to the AskUserQuestion tool's question structure.
 */
export interface UserQuestion {
  /** The complete question to ask */
  question: string;
  /** Short header/label for the question */
  header: string;
  /** Available options (2-4 options) */
  options: UserQuestionOption[];
  /** Whether multiple options can be selected */
  multiSelect?: boolean;
}

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
// Conversation History
// =============================================================================

/**
 * Role in a conversation turn.
 */
export type ConversationRole = 'user' | 'assistant';

/**
 * Single message in conversation history.
 */
export interface ConversationMessage {
  /** Message role */
  role: ConversationRole;
  /** Message content */
  content: string;
  /** ISO-8601 timestamp */
  timestamp: string;
}

/** Maximum conversation history turns to retain */
export const MAX_CONVERSATION_HISTORY = 10;

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
  // TUI state machine
  tuiState: TuiState;
  loadingSteps: LoadingStep[];
  statusBar: StatusBarContext;

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

  // Conversation history (last N turns for follow-ups)
  conversationHistory: ConversationMessage[];

  // Buffers
  inputBuffer: string;
  streamBuffer: StreamChunk[];

  // Data
  findings: Finding[];
  recommendations: Recommendation[];

  // Permissions (session-only cache)
  permissionCache: Map<string, PermissionDecision>;
  /** Pending permission request (shown in dialog) */
  pendingPermission: { tool: string; description: string; pattern?: string } | null;

  // Questions (AskUserQuestion tool)
  /** Pending questions from AskUserQuestion tool */
  pendingQuestions: UserQuestion[] | null;

  // Recovery
  lastCheckpoint: SessionCheckpoint | null;
}

// =============================================================================
// App Messages (Actions)
// =============================================================================

/**
 * All possible message types for appReducer.
 */
export type AppMessage =
  | { type: 'SET_TUI_STATE'; payload: { state: TuiState } }
  | { type: 'SET_LOADING_STEPS'; payload: { steps: LoadingStep[] } }
  | {
      type: 'UPDATE_LOADING_STEP';
      payload: { id: string; status: LoadingStep['status']; detail?: string };
    }
  | { type: 'SET_STATUS_BAR'; payload: Partial<StatusBarContext> }
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
  | {
      type: 'SET_PENDING_PERMISSION';
      payload: { permission: { tool: string; description: string; pattern?: string } | null };
    }
  | {
      type: 'SET_PENDING_QUESTIONS';
      payload: { questions: UserQuestion[] | null };
    }
  | { type: 'SET_FOCUS'; payload: { target: FocusTarget } }
  | { type: 'SET_CHECKPOINT'; payload: { checkpoint: SessionCheckpoint } }
  | { type: 'ADD_CONVERSATION_MESSAGE'; payload: { message: ConversationMessage } }
  | { type: 'CLEAR_CONVERSATION_HISTORY' };

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
    tuiState: 'loading',
    loadingSteps: [],
    statusBar: {
      helpHint: 'ctrl+? help',
      status: 'Loading...',
      model: '',
      openRecommendations: 0,
      projectPath: process.cwd(),
    },
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
    conversationHistory: [],
    inputBuffer: '',
    streamBuffer: [],
    findings: [],
    recommendations: [],
    permissionCache: new Map(),
    pendingPermission: null,
    pendingQuestions: null,
    lastCheckpoint: null,
  };
}

// =============================================================================
// Component Props
// =============================================================================

/**
 * Streaming state passed from InkRenderer (external source of truth).
 * When provided, these values override the internal reducer state.
 */
export interface StreamState {
  /** Accumulated stream chunks */
  streamBuffer: StreamChunk[];
  /** Whether currently streaming */
  isStreaming: boolean;
  /** Current analysis phase */
  analysisPhase: AnalysisPhase;
  /** Discovered findings */
  findings: Finding[];
}

/**
 * Props for the root App component.
 */
export interface AppProps {
  /** Initial state (for testing or recovery) */
  initialState?: Partial<AppState>;
  /** Streaming state from InkRenderer (source of truth for streaming data) */
  streamState?: StreamState;
  /** Pending permission from InkRenderer */
  pendingPermission?: { tool: string; description: string; pattern?: string } | null;
  /** Pending questions from InkRenderer */
  pendingQuestions?: UserQuestion[] | null;
  /** Current dialog stack from InkRenderer */
  viewStack?: DialogType[];
  /** Callback when user submits input (can be async) */
  onInput?: (input: string) => void | Promise<void>;
  /** Callback when analysis should start */
  onStart?: () => void;
  /** Callback when user exits (can be async for cleanup) */
  onExit?: () => void | Promise<void>;
  /** Callback when permission decision is made */
  onPermissionDecision?: (decision: PermissionDecision) => void;
  /** Callback when question answers are submitted */
  onQuestionAnswers?: (answers: Record<string, string>) => void;
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
 * Props for QuestionDialog component.
 */
export interface QuestionDialogProps {
  /** Questions to present to the user */
  questions: UserQuestion[];
  /** Handler for when all questions are answered */
  onSubmit: (answers: Record<string, string>) => void;
  /** Handler for when user cancels (Escape) */
  onCancel?: () => void;
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
  requestPermission(request: {
    tool: string;
    description: string;
    pattern?: string;
  }): Promise<PermissionDecision>;
  /** Request answers to questions from user (AskUserQuestion tool) */
  requestUserAnswers(request: { questions: UserQuestion[] }): Promise<Record<string, string>>;

  // =============================================================================
  // TUI State Control (Welcome Flow + Conversation Mode)
  // =============================================================================

  /** Set the current TUI state (loading, welcome, analysing, etc.) */
  setTuiState(state: TuiState): void;
  /** Set the loading steps for the progress display */
  setLoadingSteps(steps: LoadingStep[]): void;
  /** Update a specific loading step's status */
  updateLoadingStep(id: string, status: LoadingStep['status'], detail?: string): void;
  /** Add a message to the conversation history */
  addConversationMessage(message: ConversationMessage): void;
  /** Update the status bar */
  updateStatusBar(updates: Partial<StatusBarContext>): void;
}
