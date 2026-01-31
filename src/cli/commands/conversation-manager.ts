/**
 * Conversation Manager
 *
 * Manages follow-up conversations in the TUI.
 * Each user input triggers a new orchestrator query with conversation context.
 *
 * @module cli/commands/conversation-manager
 */

import type {
  ITuiRenderer,
  ConversationMessage,
  ConversationalContext,
  UserQuestion,
} from '../../tui/types';
import type { WelcomeContext } from '../../tui/welcome/types';
import type { IOrchestrator } from '../../orchestration/interfaces';
import type { StreamChunk } from '../../orchestration/types';
import {
  buildFollowUpPrompt,
  createUserMessage,
  createAssistantMessage,
  interpretNumericChoice,
} from '../../tui/welcome/conversation';
import {
  saveConversationSession,
  loadConversationSession,
  createConversationSession,
  addMessageToSession,
  isSessionForProject,
  isSessionStale,
  type ConversationSession,
} from '../../tui/welcome/session-persistence';
import { MAX_CONVERSATION_HISTORY } from '../../tui/types';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { createOutcomeStorage, getDefaultOutcomeDbPath } from '../../persistence/outcome-storage';
import { findIncomplete } from '../../persistence/sessions/storage';

export interface ConversationManagerOptions {
  tuiRenderer: ITuiRenderer;
  orchestrator: IOrchestrator;
  welcomeContext: WelcomeContext;
  projectPath: string;
  maxSessionAgeHours?: number;
}

export class ConversationManager {
  private tuiRenderer: ITuiRenderer;
  private orchestrator: IOrchestrator;
  private welcomeContext: WelcomeContext;
  private projectPath: string;
  private maxSessionAgeHours: number;

  private session: ConversationSession | null = null;
  private conversationHistory: ConversationMessage[] = [];
  private currentContext: ConversationalContext = {
    currentTopic: null,
    drillDownDepth: 0,
    mentionedEntities: [],
    lastAgentQuestion: null,
    lastUserResponse: null,
    pendingOptions: [],
  };
  private isWelcomeMenuPending = false;

  constructor(options: ConversationManagerOptions) {
    this.tuiRenderer = options.tuiRenderer;
    this.orchestrator = options.orchestrator;
    this.welcomeContext = options.welcomeContext;
    this.projectPath = options.projectPath;
    this.maxSessionAgeHours = options.maxSessionAgeHours ?? 24;
  }

  async initialize(): Promise<void> {
    const existingSession = await loadConversationSession();

    if (
      existingSession &&
      isSessionForProject(existingSession, this.projectPath) &&
      !isSessionStale(existingSession, this.maxSessionAgeHours)
    ) {
      this.session = existingSession;
      this.conversationHistory = existingSession.messages.slice(-MAX_CONVERSATION_HISTORY);

      // Add visual separator before showing previous session messages
      if (this.conversationHistory.length > 0) {
        this.tuiRenderer.addConversationMessage({
          role: 'assistant',
          content: '─── Previous session ───',
          timestamp: new Date().toISOString(),
        });
      }

      for (const message of this.conversationHistory) {
        this.tuiRenderer.addConversationMessage(message);
      }
    } else {
      this.session = createConversationSession(this.projectPath, this.welcomeContext);
    }
  }

  /**
   * Set flag indicating that the next question from the agent should be treated
   * as the welcome menu selection.
   */
  setWelcomeMenuPending(): void {
    this.isWelcomeMenuPending = true;
  }

  /**
   * Check if welcome menu question is pending and clear the flag.
   */
  checkAndClearWelcomeMenuPending(): boolean {
    const isPending = this.isWelcomeMenuPending;
    this.isWelcomeMenuPending = false;
    return isPending;
  }

  /**
   * Map a welcome menu answer to the corresponding menu action.
   * This translates user-friendly option labels to internal action identifiers.
   */
  mapWelcomeAnswerToAction(answer: string): string | null {
    const normalized = answer.toLowerCase().trim();

    if (normalized.includes('full analysis')) {
      return 'full-analysis';
    }
    if (normalized.includes('diff') || normalized.includes('uncommitted')) {
      return 'analyze-diff';
    }
    if (normalized.includes('recommendation')) {
      return 'review-recommendations';
    }
    if (normalized.includes('resume') || normalized.includes('session')) {
      return 'resume-session';
    }

    return null;
  }

  async handleInput(input: string): Promise<void> {
    const trimmed = input.trim();
    if (!trimmed) return;

    this.tuiRenderer.setTuiState('conversing');

    const userMessage = createUserMessage(trimmed);
    this.conversationHistory.push(userMessage);
    this.tuiRenderer.addConversationMessage(userMessage);

    if (this.session) {
      this.session = addMessageToSession(this.session, userMessage);
    }

    let processedInput = trimmed;

    if (this.currentContext.pendingOptions.length > 0) {
      const interpreted = interpretNumericChoice(trimmed, this.currentContext.pendingOptions);
      if (interpreted) {
        processedInput = interpreted;
      }
    }

    try {
      const { systemPrompt, userPrompt } = buildFollowUpPrompt({
        userInput: processedInput,
        conversationHistory: this.conversationHistory.slice(0, -1),
        welcomeContext: this.welcomeContext,
        currentContext: this.currentContext,
      });

      // Pass system prompt separately to avoid it appearing in output
      // The orchestrator sends it via body.system in the SDK request
      let responseContent = '';

      for await (const chunk of this.orchestrator.run(userPrompt, { systemPrompt })) {
        this.tuiRenderer.renderChunk(chunk);

        if (chunk.type === 'text') {
          responseContent += chunk.content;
        }

        // Handle AskUserQuestion events (user_question chunks)
        if (chunk.type === 'user_question' && chunk.metadata) {
          await this.handleUserQuestion(chunk);
        }
      }

      if (responseContent) {
        const assistantMessage = createAssistantMessage(responseContent);
        this.conversationHistory.push(assistantMessage);
        this.tuiRenderer.addConversationMessage(assistantMessage);

        if (this.session) {
          this.session = addMessageToSession(this.session, assistantMessage);
        }
      }

      while (this.conversationHistory.length > MAX_CONVERSATION_HISTORY) {
        this.conversationHistory.shift();
      }

      this.currentContext = {
        ...this.currentContext,
        lastUserResponse: trimmed,
      };
    } finally {
      this.tuiRenderer.setTuiState('idle');
    }
  }

  /**
   * Handle user_question chunks from AskUserQuestion tool.
   * Shows QuestionDialog and sends reply to SDK.
   */
  private async handleUserQuestion(chunk: StreamChunk): Promise<void> {
    const requestId = chunk.metadata?.requestId as string;
    const rawQuestions = chunk.metadata?.questions as Array<{
      question: string;
      header: string;
      options: Array<{ label: string; description?: string }>;
      multiSelect?: boolean;
    }>;

    if (!requestId || !rawQuestions || rawQuestions.length === 0) {
      return; // Invalid question event, skip
    }

    // Map to UserQuestion format expected by TUI
    const userQuestions: UserQuestion[] = rawQuestions.map((q) => ({
      question: q.question,
      header: q.header,
      options: q.options.map((o) => {
        const opt: { label: string; description?: string } = { label: o.label };
        if (o.description !== undefined) {
          opt.description = o.description;
        }
        return opt;
      }),
      multiSelect: q.multiSelect ?? false,
    }));

    // Get user answers via TUI dialog
    const answers = await this.tuiRenderer.requestUserAnswers({ questions: userQuestions });

    // Convert answers to SDK format: [[label], [label], ...] or [[label1, label2]] for multiSelect
    const answerArrays = Object.values(answers).map((answerStr) => {
      return answerStr.split(', ').filter(Boolean);
    });

    // Send reply to SDK using type assertion (getClient not in IOrchestrator interface)
    const orchestrator = this.orchestrator as {
      getClient?: () => {
        replyToQuestion: (id: string, answers: string[][]) => Promise<void>;
      } | null;
    };
    const client = orchestrator.getClient?.();
    if (client) {
      await client.replyToQuestion(requestId, answerArrays);
    }
  }

  /**
   * Handle action from the welcome menu.
   * Transitions state and executes the appropriate analysis or workflow.
   *
   * @param action - Menu action identifier (e.g., 'full-analysis', 'analyze-diff')
   */
  async handleMenuAction(action: string): Promise<void> {
    // Clear menu after selection
    this.tuiRenderer.setWelcomeMenu([]);

    // Map actions to appropriate TUI state
    const analysisActions = ['full-analysis', 'analyze-diff', 'review-recommendations'];
    const stateForAction = analysisActions.includes(action) ? 'analysing' : 'conversing';
    this.tuiRenderer.setTuiState(stateForAction);

    switch (action) {
      case 'full-analysis': {
        // Build the full analysis prompt
        const { systemPrompt, userPrompt } = buildFollowUpPrompt({
          userInput: 'Run a full analysis of this project',
          conversationHistory: [],
          welcomeContext: this.welcomeContext,
          currentContext: this.currentContext,
        });

        try {
          let responseContent = '';

          for await (const chunk of this.orchestrator.run(userPrompt, { systemPrompt })) {
            this.tuiRenderer.renderChunk(chunk);

            if (chunk.type === 'text') {
              responseContent += chunk.content;
            }
          }

          if (responseContent) {
            const assistantMessage = createAssistantMessage(responseContent);
            this.conversationHistory.push(assistantMessage);
            this.tuiRenderer.addConversationMessage(assistantMessage);

            if (this.session) {
              this.session = addMessageToSession(this.session, assistantMessage);
            }
          }
        } catch (error) {
          const errorMessage = createAssistantMessage(
            `Failed to run full analysis: ${error instanceof Error ? error.message : String(error)}`
          );
          this.conversationHistory.push(errorMessage);
          this.tuiRenderer.addConversationMessage(errorMessage);

          if (this.session) {
            this.session = addMessageToSession(this.session, errorMessage);
          }
        } finally {
          this.tuiRenderer.setTuiState('idle');
        }
        break;
      }

      case 'analyze-diff': {
        try {
          // Get git diff output
          let diffOutput: string;
          try {
            diffOutput = execSync('git diff --no-color', {
              cwd: this.projectPath,
              encoding: 'utf8',
              maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            });
          } catch (error) {
            const errMessage = createAssistantMessage(
              `Failed to get git diff: ${error instanceof Error ? error.message : String(error)}\n\nMake sure you're in a git repository with uncommitted changes.`
            );
            this.conversationHistory.push(errMessage);
            this.tuiRenderer.addConversationMessage(errMessage);
            if (this.session) {
              this.session = addMessageToSession(this.session, errMessage);
            }
            this.tuiRenderer.setTuiState('idle');
            break;
          }

          if (!diffOutput.trim()) {
            const message = createAssistantMessage(
              'No uncommitted changes found in the working directory.'
            );
            this.conversationHistory.push(message);
            this.tuiRenderer.addConversationMessage(message);
            if (this.session) {
              this.session = addMessageToSession(this.session, message);
            }
            this.tuiRenderer.setTuiState('idle');
            break;
          }

          // Build prompt with diff context
          const diffPrompt = `Analyze the following uncommitted changes:\n\n\`\`\`diff\n${diffOutput}\n\`\`\``;
          const { systemPrompt, userPrompt } = buildFollowUpPrompt({
            userInput: diffPrompt,
            conversationHistory: [],
            welcomeContext: this.welcomeContext,
            currentContext: this.currentContext,
          });

          let responseContent = '';

          for await (const chunk of this.orchestrator.run(userPrompt, { systemPrompt })) {
            this.tuiRenderer.renderChunk(chunk);

            if (chunk.type === 'text') {
              responseContent += chunk.content;
            }
          }

          if (responseContent) {
            const assistantMessage = createAssistantMessage(responseContent);
            this.conversationHistory.push(assistantMessage);
            this.tuiRenderer.addConversationMessage(assistantMessage);

            if (this.session) {
              this.session = addMessageToSession(this.session, assistantMessage);
            }
          }
        } catch (error) {
          const errorMessage = createAssistantMessage(
            `Failed to analyze diff: ${error instanceof Error ? error.message : String(error)}`
          );
          this.conversationHistory.push(errorMessage);
          this.tuiRenderer.addConversationMessage(errorMessage);

          if (this.session) {
            this.session = addMessageToSession(this.session, errorMessage);
          }
        } finally {
          this.tuiRenderer.setTuiState('idle');
        }
        break;
      }

      case 'review-recommendations': {
        try {
          const dbPath = getDefaultOutcomeDbPath();

          if (!existsSync(dbPath)) {
            const message = createAssistantMessage(
              'No recommendation outcomes found. Recommendations will be stored after you receive them during analysis sessions.'
            );
            this.conversationHistory.push(message);
            this.tuiRenderer.addConversationMessage(message);
            if (this.session) {
              this.session = addMessageToSession(this.session, message);
            }
            this.tuiRenderer.setTuiState('idle');
            break;
          }

          const storage = createOutcomeStorage(dbPath);
          const metrics = storage.getMetrics();

          // Build summary of recommendations
          const summaryLines: string[] = [
            '## Recommendation Outcomes Summary\n',
            `**Total recommendations**: ${metrics.all.totalRecommendations}`,
            `**Implementation rate**: ${(metrics.all.implementationRate * 100).toFixed(1)}%`,
            `**Success rate**: ${(metrics.all.successRate * 100).toFixed(1)}%\n`,
          ];

          if (metrics.symptomatic.totalRecommendations > 0) {
            summaryLines.push(
              `### Symptomatic (${metrics.symptomatic.totalRecommendations})`,
              `- Implementation rate: ${(metrics.symptomatic.implementationRate * 100).toFixed(1)}%`,
              `- Success rate: ${(metrics.symptomatic.successRate * 100).toFixed(1)}%\n`
            );
          }

          if (metrics.preventive.totalRecommendations > 0) {
            summaryLines.push(
              `### Preventive (${metrics.preventive.totalRecommendations})`,
              `- Implementation rate: ${(metrics.preventive.implementationRate * 100).toFixed(1)}%`,
              `- Success rate: ${(metrics.preventive.successRate * 100).toFixed(1)}%\n`
            );
          }

          if (metrics.systemic.totalRecommendations > 0) {
            summaryLines.push(
              `### Systemic (${metrics.systemic.totalRecommendations})`,
              `- Implementation rate: ${(metrics.systemic.implementationRate * 100).toFixed(1)}%`,
              `- Success rate: ${(metrics.systemic.successRate * 100).toFixed(1)}%\n`
            );
          }

          const summary = summaryLines.join('\n');
          const message = createAssistantMessage(summary);
          this.conversationHistory.push(message);
          this.tuiRenderer.addConversationMessage(message);

          if (this.session) {
            this.session = addMessageToSession(this.session, message);
          }
        } catch (error) {
          const errorMessage = createAssistantMessage(
            `Failed to retrieve recommendations: ${error instanceof Error ? error.message : String(error)}`
          );
          this.conversationHistory.push(errorMessage);
          this.tuiRenderer.addConversationMessage(errorMessage);

          if (this.session) {
            this.session = addMessageToSession(this.session, errorMessage);
          }
        } finally {
          this.tuiRenderer.setTuiState('idle');
        }
        break;
      }

      case 'resume-session': {
        try {
          const incompleteSessions = await findIncomplete();

          if (incompleteSessions.length === 0) {
            const message = createAssistantMessage(
              'No incomplete sessions found. All previous sessions are complete or no sessions exist.'
            );
            this.conversationHistory.push(message);
            this.tuiRenderer.addConversationMessage(message);
            if (this.session) {
              this.session = addMessageToSession(this.session, message);
            }
            this.tuiRenderer.setTuiState('idle');
            break;
          }

          // Build list of resumable sessions
          const sessionLines: string[] = ['## Resumable Sessions\n'];
          for (let i = 0; i < Math.min(incompleteSessions.length, 5); i++) {
            const info = incompleteSessions[i];
            if (!info) continue;
            const timestamp = info.lastCheckpointAt
              ? new Date(info.lastCheckpointAt).toLocaleString()
              : 'Unknown';
            const phase = info.state.phase || 'unknown';
            sessionLines.push(
              `${i + 1}. **Session ${info.sessionId.slice(0, 8)}** (Phase: ${phase}, Last checkpoint: ${timestamp})`
            );
          }

          if (incompleteSessions.length > 5) {
            sessionLines.push(`\n_...and ${incompleteSessions.length - 5} more sessions_`);
          }

          sessionLines.push(
            '\nTo resume a session, you would need to use the orchestrator.resume() method with the session ID.'
          );
          sessionLines.push(
            'Note: Full session resume integration requires additional TUI support.'
          );

          const summary = sessionLines.join('\n');
          const message = createAssistantMessage(summary);
          this.conversationHistory.push(message);
          this.tuiRenderer.addConversationMessage(message);

          if (this.session) {
            this.session = addMessageToSession(this.session, message);
          }
        } catch (error) {
          const errorMessage = createAssistantMessage(
            `Failed to retrieve sessions: ${error instanceof Error ? error.message : String(error)}`
          );
          this.conversationHistory.push(errorMessage);
          this.tuiRenderer.addConversationMessage(errorMessage);

          if (this.session) {
            this.session = addMessageToSession(this.session, errorMessage);
          }
        } finally {
          this.tuiRenderer.setTuiState('idle');
        }
        break;
      }

      default: {
        const message = createAssistantMessage(`Unknown action: ${action}`);
        this.conversationHistory.push(message);
        this.tuiRenderer.addConversationMessage(message);

        if (this.session) {
          this.session = addMessageToSession(this.session, message);
        }

        this.tuiRenderer.setTuiState('idle');
      }
    }
  }

  async saveSession(): Promise<void> {
    if (this.session && this.session.messages.length > 0) {
      await saveConversationSession(this.session);
    }
  }

  getConversationHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }
}
