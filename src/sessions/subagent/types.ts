/**
 * EP15 Session Intelligence - Subagent Type Definitions
 *
 * Type definitions for Session Analyst subagent.
 * Follows EP08 ACT subagent pattern per ADR-0005.
 *
 * Per Constitution Principle C8: Single subagent depth limit.
 * This subagent does NOT have access to the Task tool.
 *
 * @module sessions/subagent/types
 */

import { z } from 'zod';
import type { AgentDefinition } from '../../act/types';
import type { AnalysisFocus } from '../types';

// =============================================================================
// Tool Sets
// =============================================================================

/**
 * Tools available to the Session Analyst subagent.
 * Includes all EP15 session intelligence tools.
 *
 * Per Constitution Principle C8: NO Task tool (single-depth constraint).
 */
export const SESSION_ANALYST_TOOLS = [
  // Timeline understanding
  'get_session_timeline',

  // Tool flow analysis
  'get_tool_sequences',

  // File access patterns
  'get_file_accesses',

  // Delegation patterns
  'get_delegation_events',

  // Quality signals
  'get_quality_signals',

  // MCP usage
  'get_mcp_usage',
] as const;

// =============================================================================
// Context Types
// =============================================================================

/**
 * Context provided to the Session Analyst subagent.
 * Per ADR-0019, this is data for agent judgment, not instructions.
 */
export interface SessionAnalysisContext {
  /** Primary session ID to analyze */
  sessionId: string;

  /** Optional second session for comparison */
  compareToSessionId?: string;

  /** User's specific question or analysis request */
  query?: string;

  /** Analysis focus area */
  focus: AnalysisFocus;

  /** Whether session file exists */
  sessionFileExists: boolean;

  /** Session file path for direct access */
  sessionFilePath?: string;

  /** Comparison session file path (if comparing) */
  comparisonFilePath?: string;
}

// =============================================================================
// Instructions Schema
// =============================================================================

/**
 * Zod schema for SessionAnalystInstructions validation.
 */
export const SessionAnalystInstructionsSchema = z.object({
  /** Unique identifier for the subagent */
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens')
    .min(1)
    .max(50),

  /** Human-readable name */
  displayName: z.string().min(1).max(100),

  /** When to invoke - Claude uses this for delegation decisions */
  description: z.string().min(1).max(500),

  /** Full context-engineered system prompt */
  prompt: z.string().min(1).max(51200), // 50KB limit per NFR-002

  /** Tool names this subagent can use (must NOT include 'Task') */
  tools: z
    .array(z.string())
    .min(1)
    .refine((tools) => !tools.includes('Task'), {
      message: "Subagent tools must NOT include 'Task' (single-depth constraint)",
    }),

  /** Selection priority (higher = preferred) */
  priority: z.number().int().min(1).max(100),

  /** Model override (defaults to inherit) */
  model: z.enum(['sonnet', 'opus', 'haiku', 'inherit']).optional(),
});

/**
 * Instructions for the Session Analyst subagent.
 */
export type SessionAnalystInstructions = z.infer<typeof SessionAnalystInstructionsSchema>;

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Convert SessionAnalystInstructions to SDK AgentDefinition format.
 *
 * @param instructions - The session analyst instructions
 * @returns AgentDefinition for SDK registration
 */
export function toAgentDefinition(instructions: SessionAnalystInstructions): AgentDefinition {
  const definition: AgentDefinition = {
    description: instructions.description,
    prompt: instructions.prompt,
    tools: [...instructions.tools],
  };

  // Only include model if not 'inherit'
  if (instructions.model && instructions.model !== 'inherit') {
    definition.model = instructions.model;
  }

  return definition;
}
