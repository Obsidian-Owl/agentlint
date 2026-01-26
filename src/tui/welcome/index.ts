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

export type {
  WelcomeContext,
  GitSummary,
  IncompleteSessionSummary,
  LoadingStepId,
  LoadingResult,
  LoadingProgressCallback,
  ContextLoaderOptions,
} from './types';
