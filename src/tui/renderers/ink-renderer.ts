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
import { DebugLogger } from '../../debug/logger.js';

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
      return 'Error occurred • Enter to retry • q quit';
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

  /**
   * Start the TUI.
   */
  start(props: AppProps): void {
    if (props.onInput) this.onInputCallback = props.onInput;
    if (props.onExit) this.onExitCallback = props.onExit;
    if (props.onStart) this.onStartCallback = props.onStart;

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
    if (viewStack.length > 0) appProps.viewStack = viewStack;
    if (this.onInputCallback) appProps.onInput = this.onInputCallback;
    if (this.onExitCallback) appProps.onExit = this.onExitCallback;
    if (this.onStartCallback) appProps.onStart = this.onStartCallback;

    return appProps;
  }

  /**
   * Stop the TUI.
   */
  stop(): void {
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
    this.chunks.push(chunk);
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
      case 'error':
        this.agentState = { phase: 'error', message: chunk.content };
        break;
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

    this.rerender();
  }

  /**
   * Render completion.
   */
  renderComplete(_result: unknown): void {
    this.isStreaming = false;
    this.currentPhase = 'presenting'; // Use 'presenting' as completion state per AnalysisPhase type
    const durationMs = Date.now() - this.sessionStartTime;
    this.agentState = { phase: 'complete', durationMs };
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
    return new Promise((resolve) => {
      this.pendingQuestions = {
        questions: request.questions,
        resolve,
      };

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

  setTuiState(state: TuiState): void {
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
    this.agentState = state;
    this.rerender();
  }
}
