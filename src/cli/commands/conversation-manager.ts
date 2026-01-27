/**
 * Conversation Manager
 *
 * Manages follow-up conversations in the TUI.
 * Each user input triggers a new orchestrator query with conversation context.
 *
 * @module cli/commands/conversation-manager
 */

import type { ITuiRenderer, ConversationMessage, ConversationalContext } from '../../tui/types';
import type { WelcomeContext } from '../../tui/welcome/types';
import type { IOrchestrator } from '../../orchestration/orchestrator';
import {
  buildFollowUpPrompt,
  createUserMessage,
  createAssistantMessage,
  isFollowUpQuestion,
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

      for (const message of this.conversationHistory) {
        this.tuiRenderer.addConversationMessage(message);
      }
    } else {
      this.session = createConversationSession(this.projectPath, this.welcomeContext);
    }
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

    const isFollowUp = isFollowUpQuestion(trimmed, this.currentContext);
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

      const fullPrompt = isFollowUp
        ? `${systemPrompt}\n\n${userPrompt}`
        : `Analyze and respond to: ${processedInput}`;

      let responseContent = '';

      for await (const chunk of this.orchestrator.run(fullPrompt)) {
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

  async saveSession(): Promise<void> {
    if (this.session && this.session.messages.length > 0) {
      await saveConversationSession(this.session);
    }
  }

  getConversationHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }
}
