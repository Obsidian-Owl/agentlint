/**
 * InkRenderer - Ink-based TUI Renderer
 *
 * Implements ITuiRenderer using Ink for interactive terminal UI.
 *
 * @module tui/renderers/ink-renderer
 */

import React from 'react';
import { render, type Instance } from 'ink';
import { App } from '../components/App';
import type {
  ITuiRenderer,
  AppProps,
  PermissionDecision,
  UserQuestion,
  AnalysisPhase,
  StreamState,
  DialogType,
  TuiState,
  LoadingStep,
  ConversationMessage,
  StatusBarContext,
} from '../types';
import type { WelcomeMenuOption } from '../welcome/welcome-prompt';
import type { AgentWorkState, AgentPhase } from '../state/agent-state';
import type { StreamChunk, Finding } from '../../orchestration/types';
import { DebugLogger, createDebugLogger, DEBUG_NAMESPACES } from '../../debug';
import { traceContextProvider } from '../../observability/trace-context';
import {
  recordStateChange,
  recordAgentWorkChange,
  recordQuestionAsked,
} from '../../observability/instrumentation/tui';
import { formatErrorForDisplay } from '../errors/user-friendly-errors';

// =============================================================================
// Helper Functions
// =============================================================================

function getContextualHelpText(phase: AgentPhase): string {
  switch (phase) {
    case 'idle':
    case 'complete':
      return 'Enter to send • / commands • q quit';
    case 'thinking':
    case 'streaming':
      return 'Agent working... • q to request stop';
    case 'calling_tool':
    case 'waiting_response':
      return 'Running tool... • q to request stop';
    case 'error':
      return 'Check error message above for recovery steps • q quit';
    default:
      return 'ctrl+? help';
  }
}

// =============================================================================
// Types
// =============================================================================

interface PermissionRequest {
  tool: string;
  description: string;
  pattern?: string;
  resolve: (decision: PermissionDecision) => void;
}

interface QuestionRequest {
  questions: UserQuestion[];
  resolve: (answers: Record<string, string>) => void;
}

// =============================================================================
// InkRenderer
// =============================================================================

/**
 * Ink-based TUI renderer.
 *
 * Renders the App component using Ink and manages the React tree.
 * Handles streaming chunks, permissions, and lifecycle.
 */
export class InkRenderer implements ITuiRenderer {
  private readonly logger = createDebugLogger({
    namespaces: [DEBUG_NAMESPACES.TUI],
  }).child(DEBUG_NAMESPACES.TUI);

  private instance: Instance | null = null;
  private chunks: StreamChunk[] = [];
  private findings: Finding[] = [];
  private currentPhase: AnalysisPhase = 'idle';
  private isStreaming = false;
  private pendingPermission: PermissionRequest | null = null;
  private pendingQuestions: QuestionRequest | null = null;
  private onInputCallback?: (input: string) => void | Promise<void>;
  private onExitCallback?: () => void | Promise<void>;
  private onStartCallback?: () => void;
  private onMenuSelectCallback?: (action: string) => void;

  // Render batching to prevent jitter/screen tearing
  private chunkBuffer: StreamChunk[] = [];
  private renderTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly RENDER_BATCH_MS = 50; // 20 FPS max

  private tuiState: TuiState = 'loading';
  private loadingSteps: LoadingStep[] = [];
  private conversationHistory: ConversationMessage[] = [];
  private welcomeMenuOptions: WelcomeMenuOption[] = [];
  private agentState: AgentWorkState = { phase: 'idle' };
  private cumulativeTokens: { input: number; output: number } = { input: 0, output: 0 };
  private sessionStartTime: number = Date.now();
  private statusBar: StatusBarContext = {
    helpHint: 'ctrl+? help',
    status: 'Loading...',
    model: '',
    openRecommendations: 0,
    projectPath: process.cwd(),
    elapsedMs: 0,
  };

  // Track pending instrumentation promises for testing
  private pendingInstrumentation: Promise<unknown>[] = [];

  /**
   * Start the TUI.
   */
  start(props: AppProps): void {
    if (props.onInput) this.onInputCallback = props.onInput;
    if (props.onExit) this.onExitCallback = props.onExit;
    if (props.onStart) this.onStartCallback = props.onStart;
    if (props.onMenuSelect) this.onMenuSelectCallback = props.onMenuSelect;

    // Suppress console debug logs during TUI operation
    DebugLogger.setTuiActive(true);

    this.instance = render(React.createElement(App, this.buildAppProps(props.initialState)));
  }

  private buildAppProps(initialState?: AppProps['initialState']): AppProps {
    const streamState: StreamState = {
      streamBuffer: this.chunks,
      isStreaming: this.isStreaming,
      analysisPhase: this.currentPhase,
      findings: this.findings,
    };

    let pendingPermission: AppProps['pendingPermission'] = null;
    let viewStack: DialogType[] = [];

    if (this.pendingPermission) {
      pendingPermission = {
        tool: this.pendingPermission.tool,
        description: this.pendingPermission.description,
        ...(this.pendingPermission.pattern ? { pattern: this.pendingPermission.pattern } : {}),
      };
      viewStack = ['permission'];
    }

    let pendingQuestions: AppProps['pendingQuestions'] = null;
    if (this.pendingQuestions) {
      pendingQuestions = this.pendingQuestions.questions;
      if (viewStack.length === 0) {
        viewStack = ['question'];
      }
    }

    const appProps: AppProps = {
      streamState,
      pendingPermission,
      pendingQuestions,
      onPermissionDecision: (decision: PermissionDecision) => {
        if (this.pendingPermission) {
          this.pendingPermission.resolve(decision);
          this.pendingPermission = null;
          this.rerender();
        }
      },
      onQuestionAnswers: (answers: Record<string, string>) => {
        if (this.pendingQuestions) {
          this.pendingQuestions.resolve(answers);
          this.pendingQuestions = null;
          this.rerender();
        }
      },
    };

    const mergedInitialState = {
      ...initialState,
      tuiState: this.tuiState,
      loadingSteps: this.loadingSteps,
      conversationHistory: this.conversationHistory,
      statusBar: this.statusBar,
      welcomeMenuOptions: this.welcomeMenuOptions,
      agentWorkState: this.agentState,
    };
    appProps.initialState = mergedInitialState;

    // Pass state as direct props for controlled rendering (these override internal state)
    appProps.tuiState = this.tuiState;
    appProps.welcomeMenuOptions = this.welcomeMenuOptions;
    appProps.loadingSteps = this.loadingSteps;
    appProps.conversationHistory = this.conversationHistory;
    appProps.statusBar = this.statusBar;

    if (viewStack.length > 0) appProps.viewStack = viewStack;
    if (this.onInputCallback) appProps.onInput = this.onInputCallback;
    if (this.onExitCallback) appProps.onExit = this.onExitCallback;
    if (this.onStartCallback) appProps.onStart = this.onStartCallback;
    if (this.onMenuSelectCallback) appProps.onMenuSelect = this.onMenuSelectCallback;

    return appProps;
  }

  /**
   * Stop the TUI.
   */
  stop(): void {
    // Flush any pending renders before stopping
    this.flushRender();

    // Re-enable console debug logs
    DebugLogger.setTuiActive(false);

    if (this.instance) {
      this.instance.unmount();
      this.instance = null;
    }
    this.chunks = [];
    this.findings = [];
    this.currentPhase = 'idle';
    this.isStreaming = false;
    this.pendingPermission = null;
    this.pendingQuestions = null;
  }

  /**
   * Render a stream chunk.
   */
  renderChunk(chunk: StreamChunk): void {
    this.logger.debug('Chunk received', { type: chunk.type, hasMetadata: !!chunk.metadata });

    // Add chunk to buffer instead of directly to chunks array
    this.chunkBuffer.push(chunk);
    this.isStreaming = true;

    // Track phase changes
    if (chunk.type === 'phase_change' && chunk.metadata?.newPhase) {
      this.currentPhase = chunk.metadata.newPhase as AnalysisPhase;
    }

    // Extract findings
    if (chunk.type === 'finding' && chunk.metadata?.finding) {
      this.findings.push(chunk.metadata.finding as Finding);
    }

    if (chunk.type === 'status' && chunk.metadata) {
      const inputTokens = chunk.metadata.inputTokens as number | undefined;
      const outputTokens = chunk.metadata.outputTokens as number | undefined;
      if (inputTokens !== undefined) {
        this.cumulativeTokens.input += inputTokens;
      }
      if (outputTokens !== undefined) {
        this.cumulativeTokens.output += outputTokens;
      }
      const totalUsed = this.cumulativeTokens.input + this.cumulativeTokens.output;
      if (totalUsed > 0) {
        this.statusBar = {
          ...this.statusBar,
          tokenUsage: { used: totalUsed, limit: 200000 },
        };
      }
    }

    this.statusBar = {
      ...this.statusBar,
      elapsedMs: Date.now() - this.sessionStartTime,
    };

    // Derive agent work state from chunk type
    switch (chunk.type) {
      case 'tool_start':
        this.agentState = {
          phase: 'calling_tool',
          tool: (chunk.metadata?.toolName as string) ?? 'unknown',
          startedAt: Date.now(),
        };
        break;
      case 'tool_result':
        this.agentState = { phase: 'thinking', startedAt: Date.now() };
        break;
      case 'text':
        if (this.agentState.phase !== 'streaming') {
          this.agentState = { phase: 'streaming', startedAt: Date.now() };
        }
        break;
      case 'error': {
        // Format error message to be user-friendly
        const errorMessage = chunk.metadata?.error
          ? formatErrorForDisplay(chunk.metadata.error, 'agent operation')
          : chunk.content;
        this.agentState = { phase: 'error', message: errorMessage };
        break;
      }
    }

    this.statusBar = {
      ...this.statusBar,
      helpHint: getContextualHelpText(this.agentState.phase),
    };

    // Derive analysis phase from agent activity
    if (chunk.type === 'tool_start' || chunk.type === 'tool_result') {
      if (this.currentPhase === 'idle') {
        this.currentPhase = 'scanning'; // Active work in progress
      }
    } else if (chunk.type === 'text' && this.currentPhase === 'idle') {
      this.currentPhase = 'scanning'; // Active work in progress
    } else if (chunk.type === 'error') {
      // Error chunks don't change phase - let completion handle it
    }

    // Schedule batched render instead of immediate rerender
    if (this.renderTimer === null) {
      this.renderTimer = setTimeout(() => {
        this.renderTimer = null;
        // CRITICAL: Create new array reference for React to detect changes
        this.chunks = [...this.chunks, ...this.chunkBuffer];
        this.chunkBuffer = [];
        this.rerender();
      }, this.RENDER_BATCH_MS);
    }
  }

  /**
   * Render completion.
   */
  renderComplete(_result: unknown): void {
    const durationMs = Date.now() - this.sessionStartTime;
    this.logger.debug('Render complete', { durationMs });

    this.isStreaming = false;
    this.currentPhase = 'presenting'; // Use 'presenting' as completion state per AnalysisPhase type
    this.agentState = { phase: 'complete', durationMs };
    this.tuiState = 'welcome'; // Return to welcome state so queued input can be flushed
    this.rerender();
  }

  /**
   * Request permission from user.
   *
   * Opens the permission dialog and waits for user decision.
   */
  requestPermission(request: {
    tool: string;
    description: string;
    pattern?: string;
  }): Promise<PermissionDecision> {
    this.logger.debug('Permission requested', { tool: request.tool });

    return new Promise((resolve) => {
      this.pendingPermission = {
        ...request,
        resolve,
      };

      // Rerender with permission dialog
      this.rerender();
    });
  }

  /**
   * Request answers to questions from user.
   *
   * Opens the question dialog and waits for user answers.
   */
  requestUserAnswers(request: { questions: UserQuestion[] }): Promise<Record<string, string>> {
    this.logger.debug('Questions requested', { count: request.questions.length });

    return new Promise((resolve) => {
      this.pendingQuestions = {
        questions: request.questions,
        resolve,
      };

      // Record question event in observability trace if available
      const context = traceContextProvider.getContext();
      if (context) {
        const requestId = `req-${Date.now()}`;
        const count = request.questions.length;
        const promise = traceContextProvider.withSpan({ name: 'tui.question_prompt' }, (span) => {
          recordQuestionAsked(span, requestId, count);
        });
        this.pendingInstrumentation.push(promise);
      }

      // Rerender with question dialog
      this.rerender();
    });
  }

  private rerender(): void {
    if (!this.instance) {
      return;
    }
    this.instance.rerender(React.createElement(App, this.buildAppProps()));
  }

  /**
   * Flush any buffered chunks and render immediately.
   * Used for cleanup and final render on stop.
   */
  private flushRender(): void {
    // Cancel pending timer
    if (this.renderTimer !== null) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }

    // Merge buffered chunks
    if (this.chunkBuffer.length > 0) {
      this.chunks = [...this.chunks, ...this.chunkBuffer];
      this.chunkBuffer = [];
      this.rerender();
    }
  }

  setTuiState(state: TuiState): void {
    const previousState = this.tuiState;
    this.logger.debug('TUI state changed', { from: previousState, to: state });

    // Record state transition in observability trace if available
    const context = traceContextProvider.getContext();
    if (context && previousState !== state) {
      // Track the promise for testing purposes
      const promise = traceContextProvider.withSpan({ name: 'tui.state_transition' }, (span) => {
        recordStateChange(span, previousState, state);
      });
      this.pendingInstrumentation.push(promise);
    }

    this.tuiState = state;
    this.rerender();
  }

  setLoadingSteps(steps: LoadingStep[]): void {
    this.loadingSteps = [...steps];
    this.rerender();
  }

  updateLoadingStep(id: string, status: LoadingStep['status'], detail?: string): void {
    const stepIndex = this.loadingSteps.findIndex((s) => s.id === id);
    if (stepIndex >= 0) {
      this.loadingSteps[stepIndex] = {
        ...this.loadingSteps[stepIndex]!,
        status,
        ...(detail !== undefined ? { detail } : {}),
      };
      this.rerender();
    }
  }

  addConversationMessage(message: ConversationMessage): void {
    this.conversationHistory = [...this.conversationHistory, message];
    this.rerender();
  }

  updateStatusBar(updates: Partial<StatusBarContext>): void {
    this.statusBar = { ...this.statusBar, ...updates };
    this.rerender();
  }

  setWelcomeMenu(options: WelcomeMenuOption[]): void {
    this.welcomeMenuOptions = [...options];
    this.rerender();
  }

  setAgentState(state: AgentWorkState): void {
    const previousPhase = this.agentState.phase;
    const newPhase = state.phase;
    this.logger.debug('Agent state changed', { from: previousPhase, to: newPhase });

    // Record agent work state transition in observability trace if available
    const context = traceContextProvider.getContext();
    if (context && previousPhase !== newPhase) {
      const promise = traceContextProvider.withSpan(
        { name: 'tui.agent_work_transition' },
        (span) => {
          recordAgentWorkChange(span, previousPhase, newPhase);
        }
      );
      this.pendingInstrumentation.push(promise);
    }

    this.agentState = state;
    this.rerender();
  }

  /**
   * Wait for all pending instrumentation operations to complete.
   * Primarily for testing purposes.
   */
  async flushInstrumentation(): Promise<void> {
    await Promise.all(this.pendingInstrumentation);
    this.pendingInstrumentation = [];
  }
}
