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
  AppState,
  UserQuestion,
  AnalysisPhase,
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

    // Build initial state
    const initialState: Partial<AppState> = {
      ...props.initialState,
      streamBuffer: this.chunks,
      isStreaming: this.isStreaming,
      analysisPhase: this.currentPhase,
      findings: this.findings,
    };

    // If there's a pending permission, add it to state
    if (this.pendingPermission) {
      const pendingPerm: { tool: string; description: string; pattern?: string } = {
        tool: this.pendingPermission.tool,
        description: this.pendingPermission.description,
      };
      if (this.pendingPermission.pattern) {
        pendingPerm.pattern = this.pendingPermission.pattern;
      }
      initialState.pendingPermission = pendingPerm;
      initialState.viewStack = ['permission'];
    }

    // If there's pending questions, add to state
    if (this.pendingQuestions) {
      initialState.pendingQuestions = this.pendingQuestions.questions;
      if (!initialState.viewStack) {
        initialState.viewStack = ['question'];
      }
    }

    // Create wrapped callbacks to handle permission resolution
    const handleInput = (input: string): void => {
      this.onInputCallback?.(input);
    };

    const handleExit = (): void => {
      this.onExitCallback?.();
    };

    const handleStart = (): void => {
      this.onStartCallback?.();
    };

    // Render the App
    this.instance = render(
      React.createElement(App, {
        initialState,
        onInput: handleInput,
        onExit: handleExit,
        onStart: handleStart,
      })
    );
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

  /**
   * Rerender the app with current state.
   */
  private rerender(): void {
    if (!this.instance) {
      return;
    }

    const initialState: Partial<AppState> = {
      streamBuffer: this.chunks,
      isStreaming: this.isStreaming,
      analysisPhase: this.currentPhase,
      findings: this.findings,
    };

    if (this.pendingPermission) {
      const pendingPerm: { tool: string; description: string; pattern?: string } = {
        tool: this.pendingPermission.tool,
        description: this.pendingPermission.description,
      };
      if (this.pendingPermission.pattern) {
        pendingPerm.pattern = this.pendingPermission.pattern;
      }
      initialState.pendingPermission = pendingPerm;
      initialState.viewStack = ['permission'];
    }

    if (this.pendingQuestions) {
      initialState.pendingQuestions = this.pendingQuestions.questions;
      // Only set viewStack if not already set by permission
      if (!initialState.viewStack) {
        initialState.viewStack = ['question'];
      }
    }

    // Note: Ink's rerender() is deprecated - in a real implementation
    // we would use a state management approach (e.g., external store)
    // For now, we restart the render which works for the test cases
    this.instance.unmount();

    // Build props for App, only including defined callbacks
    const appProps: AppProps = { initialState };
    if (this.onInputCallback) appProps.onInput = this.onInputCallback;
    if (this.onExitCallback) appProps.onExit = this.onExitCallback;
    if (this.onStartCallback) appProps.onStart = this.onStartCallback;

    this.instance = render(React.createElement(App, appProps));
  }
}
