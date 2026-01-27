/**
 * Generalized ACT Analyzer Subagent Instructions
 *
 * Uses PromptKit for the system prompt. See src/prompts/subagents/act/generalized-prompt.ts
 *
 * @module act/instructions/generalized
 */

import type { ACTInstructions } from '../types.js';
import { GENERALIZED_ACT_TOOLS } from '../types.js';
import { generalizedAnalyzerPromptV1 } from '../../prompts/subagents/act/generalized-prompt.js';

export const generalizedInstructions: ACTInstructions = {
  name: 'generalized-analyzer',
  displayName: 'Generalized ACT Analyzer',
  description:
    'Fallback analyzer for AI coding tools without a dedicated specialist. Use when ACT type is unknown or for generic AGENTS.md configurations.',
  prompt: generalizedAnalyzerPromptV1.messages[0]?.content ?? '',
  tools: [...GENERALIZED_ACT_TOOLS],
  actTypes: ['agents-md', 'unknown'],
  priority: 10,
};
