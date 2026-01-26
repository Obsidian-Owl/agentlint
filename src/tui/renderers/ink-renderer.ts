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
} from '../types';
import type { StreamChunk, Finding } from '../../orchestration/types';

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
  private currentPhase: AnalysisPhase = 'scanning';
  private isStreaming = false;
  private pendingPermission: PermissionRequest | null = null;
  private pendingQuestions: QuestionRequest | null = null;
  private onInputCallback?: (input: string) => void;
  private onExitCallback?: () => void;
  private onStartCallback?: () => void;

  /**
   * Start the TUI.
   */
  start(props: AppProps): void {
    if (props.onInput) this.onInputCallback = props.onInput;
    if (props.onExit) this.onExitCallback = props.onExit;
    if (props.onStart) this.onStartCallback = props.onStart;

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

    if (initialState) appProps.initialState = initialState;
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

    this.rerender();
  }

  /**
   * Render completion.
   */
  renderComplete(_result: unknown): void {
    this.isStreaming = false;
    this.currentPhase = 'presenting';
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
}
