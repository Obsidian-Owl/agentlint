/**
 * HeadlessRenderer - Non-interactive TUI Renderer
 *
 * Implements ITuiRenderer for --non-interactive mode.
 * Outputs to stdout/stderr without interactive UI.
 *
 * @module tui/renderers/headless-renderer
 */

import * as readline from 'node:readline';
import type {
  ITuiRenderer,
  AppProps,
  PermissionDecision,
  UserQuestion,
  TuiState,
  LoadingStep,
  ConversationMessage,
  StatusBarContext,
} from '../types';
import type { StreamChunk } from '../../orchestration/types';
import type { WelcomeMenuOption } from '../welcome/welcome-prompt';
import type { AgentWorkState } from '../state/agent-state';
import { formatErrorForDisplay } from '../errors';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for HeadlessRenderer.
 */
export interface HeadlessRendererOptions {
  /** Output JSON instead of plain text */
  json?: boolean;
  /** Suppress verbose output */
  quiet?: boolean;
  /** Enable verbose output */
  verbose?: boolean;
  /** Auto-deny all permission requests */
  denyAll?: boolean;
  /** Enable colored output */
  colors?: boolean;
}

// =============================================================================
// HeadlessRenderer
// =============================================================================

/**
 * Headless renderer for non-interactive mode.
 *
 * Outputs chunks to stdout, optionally as JSON.
 * Auto-approves or auto-denies permission requests.
 */
export class HeadlessRenderer implements ITuiRenderer {
  private options: HeadlessRendererOptions;
  private running = false;

  constructor(options: HeadlessRendererOptions = {}) {
    this.options = options;
  }

  /**
   * Start the renderer.
   */
  start(_props: AppProps): void {
    this.running = true;
  }

  /**
   * Stop the renderer.
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Render a stream chunk.
   */
  renderChunk(chunk: StreamChunk): void {
    if (!this.running) {
      return;
    }

    // Suppress verbose output in quiet mode
    if (this.options.quiet && chunk.level === 'verbose') {
      return;
    }

    if (this.options.json) {
      this.outputJson({ ...chunk });
      return;
    }

    // Plain text output based on chunk type
    switch (chunk.type) {
      case 'text':
        console.log(chunk.content);
        break;

      case 'tool_start':
        if (!this.options.quiet) {
          const toolName = (chunk.metadata?.toolName as string) ?? 'unknown';
          console.log(`[tool] ${toolName}`);
        }
        break;

      case 'tool_result':
        if (!this.options.quiet) {
          const toolName = (chunk.metadata?.toolName as string) ?? 'unknown';
          const success = (chunk.metadata?.success as boolean) ?? true;
          console.log(`[result] ${toolName}: ${success ? 'success' : 'failed'}`);
        }
        break;

      case 'error': {
        // Format error to be user-friendly
        const errorMessage = chunk.metadata?.error
          ? formatErrorForDisplay(chunk.metadata.error, 'operation')
          : chunk.content;
        console.error(`[error] ${errorMessage}`);
        break;
      }

      case 'finding':
        console.log(`[finding] ${chunk.content}`);
        break;

      case 'phase_change':
        if (!this.options.quiet) {
          console.log(`[phase] ${chunk.content}`);
        }
        break;

      case 'checkpoint':
        if (!this.options.quiet && this.options.verbose) {
          console.log(`[checkpoint] ${chunk.content}`);
        }
        break;

      case 'status':
        if (!this.options.quiet) {
          console.log(`[status] ${chunk.content}`);
        }
        break;

      case 'user_question':
        console.log(`[question] ${chunk.content}`);
        break;

      default:
        // Unknown chunk type - output as-is in verbose mode
        if (!this.options.quiet && this.options.verbose) {
          console.log(`[chunk] ${chunk.content}`);
        }
    }
  }

  /**
   * Render completion.
   */
  renderComplete(result: unknown): void {
    if (!this.running) {
      return;
    }

    if (this.options.json) {
      this.outputJson({
        type: 'complete',
        result,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Plain text completion
    if (!this.options.quiet) {
      console.log('[complete]');
    }
  }

  /**
   * Request permission.
   *
   * In headless mode, auto-approves (or auto-denies if denyAll is set).
   */
  requestPermission(request: {
    tool: string;
    description: string;
    pattern?: string;
  }): Promise<PermissionDecision> {
    const allowed = !this.options.denyAll;

    const decision: PermissionDecision = {
      allowed,
      scope: 'session',
      grantedAt: new Date().toISOString(),
      tool: request.tool,
      pattern: request.pattern ?? null,
    };

    if (!this.options.quiet) {
      if (this.options.json) {
        this.outputJson({
          type: 'permission',
          request,
          decision,
        });
      } else {
        console.log(`[permission] ${request.tool}: ${allowed ? 'auto-approved' : 'auto-denied'}`);
      }
    }

    return Promise.resolve(decision);
  }

  /**
   * Request answers to questions from user.
   *
   * In headless mode with denyAll/quiet, auto-selects first option.
   * Otherwise, uses readline for interactive input.
   */
  async requestUserAnswers(request: {
    questions: UserQuestion[];
  }): Promise<Record<string, string>> {
    const answers: Record<string, string> = {};

    // In denyAll mode or quiet mode, auto-select first option
    if (this.options.denyAll || this.options.quiet) {
      for (const question of request.questions) {
        const firstOption = question.options[0];
        answers[question.question] = firstOption?.label ?? 'skipped';
      }

      if (this.options.json) {
        this.outputJson({
          type: 'questions',
          questions: request.questions.map((q) => q.question),
          answers,
          mode: 'auto',
        });
      }

      return answers;
    }

    // Interactive mode: use readline
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    try {
      for (const question of request.questions) {
        const answer = await this.askQuestion(rl, question);
        answers[question.question] = answer;
      }
    } finally {
      rl.close();
    }

    if (this.options.json) {
      this.outputJson({
        type: 'questions',
        questions: request.questions.map((q) => q.question),
        answers,
        mode: 'interactive',
      });
    }

    return answers;
  }

  /**
   * Ask a single question via readline.
   */
  private askQuestion(rl: readline.Interface, question: UserQuestion): Promise<string> {
    return new Promise((resolve) => {
      // Display question
      console.log('');
      console.log(`[${question.header}] ${question.question}`);
      console.log('');

      // Display options
      question.options.forEach((opt, i) => {
        console.log(`  ${i + 1}. ${opt.label}`);
        if (opt.description) {
          console.log(`     ${opt.description}`);
        }
      });

      console.log('');

      rl.question('Enter choice (number): ', (input) => {
        const trimmed = input.trim();
        const choice = parseInt(trimmed, 10);

        // Valid option selection
        if (choice >= 1 && choice <= question.options.length) {
          const selectedOption = question.options[choice - 1];
          resolve(selectedOption?.label ?? 'selected');
          return;
        }

        // Invalid input - use first option as default
        const firstOption = question.options[0];
        resolve(firstOption?.label ?? 'default');
      });
    });
  }

  /**
   * Output JSON to stdout.
   */
  private outputJson(data: unknown): void {
    console.log(JSON.stringify(data));
  }

  setTuiState(_state: TuiState): void {}

  setLoadingSteps(_steps: LoadingStep[]): void {}

  updateLoadingStep(_id: string, _status: LoadingStep['status'], _detail?: string): void {}

  addConversationMessage(_message: ConversationMessage): void {}

  updateStatusBar(_updates: Partial<StatusBarContext>): void {}

  setWelcomeMenu(_options: WelcomeMenuOption[]): void {}

  setAgentState(_state: AgentWorkState): void {}
}
