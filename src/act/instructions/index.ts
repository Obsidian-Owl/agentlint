/**
 * ACT Instructions Aggregator
 *
 * Exports all bundled ACT instruction definitions.
 *
 * @module act/instructions
 */

import type { ACTInstructions } from "../types.js";
import { claudeCodeInstructions } from "./claude-code.js";
// T026: import { generalizedInstructions } from "./generalized.js";

// Re-export individual instructions for direct access
export { claudeCodeInstructions } from "./claude-code.js";

/**
 * All bundled ACT instruction definitions.
 * Instructions are ordered by priority (highest first).
 */
export const bundledInstructions: ACTInstructions[] = [
  claudeCodeInstructions, // Priority 100 - Claude Code specialist
  // T026: generalizedInstructions, // Priority 10 - Fallback
];
