/**
 * PromptKit Auto-Registration Module
 *
 * Registers all prompt specs with the global PromptRegistry on startup.
 * This enables version-aware lookup via resolvePrompt() instead of direct imports.
 *
 * @module prompts/register-prompts
 */

import { getPromptRegistry } from './promptkit/registry';

// Import all prompt specs
import { analysisPromptV1 } from './analysis/analysis-prompt';
import { sessionAnalystPromptV1 } from './subagents/session/session-analyst-prompt';
import { claudeCodeAnalyzerPromptV1 } from './subagents/act/claude-code-prompt';
import { generalizedAnalyzerPromptV1 } from './subagents/act/generalized-prompt';

let registered = false;

/**
 * Register all prompts with the global registry.
 * Safe to call multiple times (idempotent).
 *
 * @returns Number of prompts registered
 */
export function registerAllPrompts(): number {
  if (registered) {
    return getPromptRegistry().size;
  }

  const registry = getPromptRegistry();

  // Analysis prompts
  registry.register(analysisPromptV1);

  // Subagent prompts
  registry.register(sessionAnalystPromptV1);
  registry.register(claudeCodeAnalyzerPromptV1);
  registry.register(generalizedAnalyzerPromptV1);

  registered = true;
  return registry.size;
}

/**
 * Reset registration state (for testing).
 */
export function resetRegistration(): void {
  registered = false;
}

/**
 * Check if prompts have been registered.
 */
export function isRegistered(): boolean {
  return registered;
}
