/**
 * Conversation Handler
 *
 * Manages follow-up conversations in the TUI.
 * Builds context from conversation history for LLM follow-ups.
 *
 * @module tui/welcome/conversation
 */

import type { ConversationMessage, ConversationalContext } from '../types';
import type { WelcomeContext } from './types';

// =============================================================================
// Types
// =============================================================================

export interface ConversationTurn {
  userMessage: string;
  assistantResponse: string;
}

export interface FollowUpPromptOptions {
  userInput: string;
  conversationHistory: ConversationMessage[];
  welcomeContext: WelcomeContext;
  currentContext: ConversationalContext;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Build a follow-up prompt for the LLM based on conversation history.
 *
 * @param options - Follow-up prompt options
 * @returns System and user prompts for the LLM
 */
export function buildFollowUpPrompt(options: FollowUpPromptOptions): {
  systemPrompt: string;
  userPrompt: string;
} {
  const { userInput, conversationHistory, welcomeContext, currentContext } = options;

  const systemPrompt = buildFollowUpSystemPrompt(welcomeContext, currentContext);
  const userPrompt = buildFollowUpUserPrompt(userInput, conversationHistory);

  return { systemPrompt, userPrompt };
}

/**
 * Create a conversation message from user input.
 */
export function createUserMessage(content: string): ConversationMessage {
  return {
    role: 'user',
    content,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a conversation message from assistant response.
 */
export function createAssistantMessage(content: string): ConversationMessage {
  return {
    role: 'assistant',
    content,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format conversation history for LLM context.
 */
export function formatHistoryForPrompt(history: ConversationMessage[]): string {
  if (history.length === 0) {
    return '';
  }

  const formatted = history.map((msg) => {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    return `${role}: ${msg.content}`;
  });

  return formatted.join('\n\n');
}

/**
 * Check if the user input seems like a follow-up question.
 */
export function isFollowUpQuestion(input: string, context: ConversationalContext): boolean {
  const normalized = input.toLowerCase().trim();

  if (context.pendingOptions.length > 0) {
    const isNumericChoice = /^[1-9]$/.test(normalized);
    if (isNumericChoice) return true;
  }

  const followUpIndicators = [
    'why',
    'how',
    'what about',
    'can you',
    'tell me more',
    'explain',
    'show me',
    'what is',
    'what are',
    'when',
    'where',
    'which',
  ];

  return followUpIndicators.some((indicator) => normalized.startsWith(indicator));
}

/**
 * Interpret numeric choice (1, 2, 3) from pending options.
 */
export function interpretNumericChoice(
  input: string,
  options: ConversationalContext['pendingOptions']
): string | null {
  const num = parseInt(input.trim(), 10);
  if (isNaN(num) || num < 1 || num > options.length) {
    return null;
  }
  return options[num - 1]?.value ?? null;
}

// =============================================================================
// Internal Helpers
// =============================================================================

function buildFollowUpSystemPrompt(
  _welcomeContext: WelcomeContext,
  currentContext: ConversationalContext
): string {
  const parts = [
    'You are agentlint, an AI assistant for improving development workflows.',
    'You are in a follow-up conversation with the user.',
    '',
    'PERSONALITY:',
    '- Observant and analytical',
    '- Professional with occasional dry wit',
    '- Concise and direct',
    '',
    'BEHAVIOR:',
    '- Reference previous conversation when relevant',
    '- If user says a number (1, 2, 3), interpret it as a choice from your last options',
    '- Ask clarifying questions if needed',
    '- Keep responses focused and actionable',
  ];

  if (currentContext.currentTopic) {
    parts.push('', `Current topic: ${currentContext.currentTopic}`);
  }

  if (currentContext.mentionedEntities.length > 0) {
    parts.push('', `Entities discussed: ${currentContext.mentionedEntities.join(', ')}`);
  }

  return parts.join('\n');
}

function buildFollowUpUserPrompt(userInput: string, history: ConversationMessage[]): string {
  const parts: string[] = [];

  if (history.length > 0) {
    parts.push('Previous conversation:');
    parts.push(formatHistoryForPrompt(history));
    parts.push('');
  }

  parts.push(`User: ${userInput}`);

  return parts.join('\n');
}
