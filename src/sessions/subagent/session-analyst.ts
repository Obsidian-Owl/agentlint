/**
 * EP15 Session Intelligence - Session Analyst Subagent
 *
 * Uses PromptKit for the system prompt. See src/prompts/subagents/session/session-analyst-prompt.ts
 *
 * @module sessions/subagent/session-analyst
 */

import type { AgentDefinition } from '../../act/types';
import { SESSION_ANALYST_TOOLS, type SessionAnalystInstructions, toAgentDefinition } from './types';
import { sessionAnalystPromptV1 } from '../../prompts/subagents/session/session-analyst-prompt';

export const sessionAnalystInstructions: SessionAnalystInstructions = {
  name: 'session-analyst',
  displayName: 'Session Analyst',
  description:
    'Analyzes Claude Code sessions to understand developer workflow patterns, identify issues, and generate narrative summaries. Use when analyzing session effectiveness, comparing sessions, or understanding what happened during a session.',
  prompt: sessionAnalystPromptV1.messages[0]?.content ?? '',
  tools: [...SESSION_ANALYST_TOOLS],
  priority: 80,
};

// =============================================================================
// Builder Functions
// =============================================================================

/**
 * Build the session analyst as an SDK AgentDefinition.
 *
 * @returns AgentDefinition for SDK registration
 */
export function buildSessionAnalystAgent(): AgentDefinition {
  return toAgentDefinition(sessionAnalystInstructions);
}

/**
 * Build all session subagents for SDK registration.
 *
 * @returns Record of subagent names to AgentDefinition objects
 */
export function buildSessionSubagents(): Record<string, AgentDefinition> {
  return {
    [sessionAnalystInstructions.name]: buildSessionAnalystAgent(),
  };
}
