/**
 * Claude Code Analyzer Subagent Instructions
 *
 * Uses PromptKit for the system prompt. See src/prompts/subagents/act/claude-code-prompt.ts
 *
 * @module act/instructions/claude-code
 */

import type { ACTInstructions } from '../types.js';
import { DEFAULT_ACT_TOOLS } from '../types.js';
import { claudeCodeAnalyzerPromptV1 } from '../../prompts/subagents/act/claude-code-prompt.js';

export const claudeCodeInstructions: ACTInstructions = {
  name: 'claude-code-analyzer',
  displayName: 'Claude Code Analyzer',
  description:
    'Analyzes Claude Code configurations, settings hierarchies, memory files, and session logs. Use when the project uses CLAUDE.md or .claude/ directory.',
  prompt: claudeCodeAnalyzerPromptV1.messages[0]?.content ?? '',
  tools: [...DEFAULT_ACT_TOOLS],
  actTypes: ['claude-code'],
  priority: 100,
};
