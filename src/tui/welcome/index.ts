/**
 * Welcome Module
 *
 * Exports for the welcome context loading and display.
 *
 * @module tui/welcome
 */

export { loadWelcomeContext } from './context-loader';
export { getGitSummary } from './git-summary';
export {
  getWelcomeSystemPrompt,
  getWelcomeUserPrompt,
  formatContextSummary,
} from './welcome-prompt';
export {
  buildFollowUpPrompt,
  createUserMessage,
  createAssistantMessage,
  formatHistoryForPrompt,
  isFollowUpQuestion,
  interpretNumericChoice,
} from './conversation';

export type {
  WelcomeContext,
  GitSummary,
  IncompleteSessionSummary,
  LoadingStepId,
  LoadingResult,
  LoadingProgressCallback,
  ContextLoaderOptions,
} from './types';

export type { ConversationTurn, FollowUpPromptOptions } from './conversation';

export {
  saveConversationSession,
  loadConversationSession,
  clearConversationSession,
  createConversationSession,
  addMessageToSession,
  isSessionForProject,
  isSessionStale,
} from './session-persistence';

export type { ConversationSession } from './session-persistence';
