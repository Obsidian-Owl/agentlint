/**
 * Claude Code Analyzer Subagent Instructions
 *
 * Uses PromptKit for the system prompt. See src/prompts/subagents/act/claude-code-prompt.ts
 *
 * @module act/instructions/claude-code
 */

import type { ACTInstructions } from '../types.js';
import { DEFAULT_ACT_TOOLS } from '../types.js';
import { resolvePromptContent } from '../../prompts/index.js';

export function getClaudeCodeInstructions(): ACTInstructions {
  return {
    name: 'claude-code-analyzer',
    displayName: 'Claude Code Analyzer',
    description:
      'Analyzes Claude Code configurations, settings hierarchies, memory files, and session logs. Use when the project uses CLAUDE.md or .claude/ directory.',
    prompt: resolvePromptContent('subagent/claude-code-analyzer', {}) ?? '',
    tools: [...DEFAULT_ACT_TOOLS],
    actTypes: ['claude-code'],
    priority: 100,
  };
}
