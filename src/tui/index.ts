/**
 * TUI Module - Agent-Led Exploration Interface
 *
 * This module provides the Ink-based terminal UI for agentlint's
 * conversational discovery experience. It replaces the legacy
 * TerminalRenderer with a React/Ink component tree.
 *
 * @module tui
 */

// =============================================================================
// Types
// =============================================================================

export * from './types';

// =============================================================================
// State Management
// =============================================================================

export { appReducer } from './state/app-reducer';
export { AppContext, AppProvider, useApp, useAppState, useAppDispatch } from './state/app-context';
export {
  type AgentWorkState,
  type AgentPhase,
  VALID_TRANSITIONS,
  isValidTransition,
  createIdleState,
  createThinkingState,
  createCallingToolState,
  createWaitingResponseState,
  createStreamingState,
  createErrorState,
  createCompleteState,
  getElapsedMs,
  getToolName,
} from './state/agent-state';

// =============================================================================
// Hooks
// =============================================================================

export { useKeyHandler, type KeyHandlerOptions } from './hooks/useKeyHandler';

// =============================================================================
// Components
// =============================================================================

export { App } from './components/App';
export { AgentOutput } from './components/AgentOutput';
export { InputField } from './components/InputField';
export { DialogOverlay } from './components/DialogOverlay';
export { PermissionDialog } from './components/PermissionDialog';
export { RecommendationDialog } from './components/RecommendationDialog';
export { QuestionDialog } from './components/QuestionDialog';
export { Breadcrumbs } from './components/Breadcrumbs';
export { Progress, type ProgressProps } from './components/Progress';
export { FindingsList, type FindingsListProps } from './components/FindingsList';
export { Summary, type SummaryProps } from './components/Summary';
export {
  CausalTree,
  type CausalTreeProps,
  type CausalNode,
  type CausalNodeType,
} from './components/CausalTree';
export {
  CompareView,
  type CompareViewProps,
  type ComparisonData,
  type BaselineSummary as CompareBaselineSummary,
} from './components/CompareView';
export { ActionMenu, type MenuOption, type ActionMenuProps } from './components/ActionMenu';
export {
  AgentStateIndicator,
  type AgentStateIndicatorProps,
} from './components/AgentStateIndicator';
export { QuitDialog, type QuitDialogProps } from './components/QuitDialog';
export {
  ToolPhaseRenderer,
  type ToolPhaseRendererProps,
  type ToolPhase,
} from './components/ToolPhaseRenderer';

// =============================================================================
// Renderers
// =============================================================================

export { InkRenderer } from './renderers/ink-renderer';
export { HeadlessRenderer, type HeadlessRendererOptions } from './renderers/headless-renderer';
export { TuiStreamRenderer } from './renderers/tui-stream-renderer';
export type { ITuiRenderer } from './renderers/types';

// =============================================================================
// Utils
// =============================================================================

export {
  isInputTTY,
  isOutputTTY,
  isInteractive,
  supportsColor,
  getTerminalSize,
  getTerminalCapabilities,
  determineRenderMode,
  type TerminalCapabilities,
} from './utils/tty';

// =============================================================================
// Error Handling
// =============================================================================

export {
  formatUserFriendlyError,
  formatErrorForDisplay,
  getErrorSummary,
  type UserFriendlyError,
} from './errors';

// =============================================================================
// Permissions
// =============================================================================

export {
  TuiPermissionHandler,
  createTuiCanUseTool,
  type TuiPermissionHandlerOptions,
} from './permissions';
