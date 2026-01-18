/**
 * ACT Subagents Module
 *
 * Provides specialized analysis subagents for different AI Coding Tools (ACTs)
 * using the Claude Agent SDK's native subagent pattern.
 *
 * @module act
 */

import type { AgentDefinition } from "./types.js";
import { ACTSubagentRegistry } from "./registry.js";
import { bundledInstructions } from "./instructions/index.js";

// Re-export public types
export type { AgentDefinition, ACTInstructions, ACTType } from "./types.js";
export type {
  ACTAnalysisFindings,
  ACTConfigIssue,
  ACTSessionIssue,
  ACTRecommendation,
} from "./types.js";
export { DEFAULT_ACT_TOOLS, GENERALIZED_ACT_TOOLS } from "./types.js";
export { ACTSubagentRegistry } from "./registry.js";
export type { IACTSubagentRegistry } from "./registry.js";

/**
 * T014: Builds the ACT subagent configuration for the SDK's `agents` option.
 *
 * Creates a registry, registers all bundled instructions, and returns
 * the agents configuration in SDK format.
 *
 * @returns Record of subagent names to AgentDefinition objects
 */
export function buildACTSubagents(): Record<string, AgentDefinition> {
  const registry = new ACTSubagentRegistry();

  // Register all bundled instructions
  for (const instructions of bundledInstructions) {
    registry.register(instructions);
  }

  return registry.toAgentsOption();
}
