/**
 * EP15 Session Intelligence - Session Analyst Subagent
 *
 * Uses PromptKit for the system prompt. See src/prompts/subagents/session/session-analyst-prompt.ts
 *
 * @module sessions/subagent/session-analyst
 */

import type { AgentDefinition } from '../../act/types';
import { SESSION_ANALYST_TOOLS, type SessionAnalystInstructions, toAgentDefinition } from './types';
import { resolvePromptContent } from '../../prompts';

export function getSessionAnalystInstructions(): SessionAnalystInstructions {
  return {
    name: 'session-analyst',
    displayName: 'Session Analyst',
    description:
      'Analyzes Claude Code sessions to understand developer workflow patterns, identify issues, and generate narrative summaries. Use when analyzing session effectiveness, comparing sessions, or understanding what happened during a session.',
    prompt: resolvePromptContent('subagent/session-analyst', {}) ?? '',
    tools: [...SESSION_ANALYST_TOOLS],
    priority: 80,
  };
}

// =============================================================================
// Builder Functions
// =============================================================================

/**
 * Build the session analyst as an SDK AgentDefinition.
 *
 * @returns AgentDefinition for SDK registration
 */
export function buildSessionAnalystAgent(): AgentDefinition {
  return toAgentDefinition(getSessionAnalystInstructions());
}

/**
 * Build all session subagents for SDK registration.
 *
 * @returns Record of subagent names to AgentDefinition objects
 */
export function buildSessionSubagents(): Record<string, AgentDefinition> {
  const instructions = getSessionAnalystInstructions();
  return {
    [instructions.name]: buildSessionAnalystAgent(),
  };
}
