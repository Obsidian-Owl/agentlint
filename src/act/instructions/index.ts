/**
 * ACT Instructions Aggregator
 *
 * Exports all bundled ACT instruction definitions.
 *
 * @module act/instructions
 */

import type { ACTInstructions } from '../types.js';
import { getClaudeCodeInstructions } from './claude-code.js';
import { getGeneralizedInstructions } from './generalized.js';

export { getClaudeCodeInstructions } from './claude-code.js';
export { getGeneralizedInstructions } from './generalized.js';

export function getBundledInstructions(): ACTInstructions[] {
  return [getClaudeCodeInstructions(), getGeneralizedInstructions()];
}
