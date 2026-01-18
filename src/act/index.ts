/**
 * ACT Subagents Module
 *
 * Provides specialized analysis subagents for different AI Coding Tools (ACTs)
 * using the Claude Agent SDK's native subagent pattern.
 *
 * @module act
 */

import type { AgentDefinition } from "./types.js";

/**
 * Builds the ACT subagent configuration for the SDK's `agents` option.
 *
 * @returns Record of subagent names to AgentDefinition objects
 */
export function buildACTSubagents(): Record<string, AgentDefinition> {
  // TODO: T014 - Implement registry instantiation and return toAgentsOption()
  return {};
}
