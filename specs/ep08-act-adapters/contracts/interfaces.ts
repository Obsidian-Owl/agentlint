/**
 * EP08 ACT Subagents - TypeScript Interfaces
 *
 * Contract definitions for the ACT subagent system.
 * These interfaces define the API surface for integrating
 * ACT-specific analysis agents into the agentlint orchestrator.
 *
 * @module act/contracts
 */

import { z } from 'zod';

// =============================================================================
// ACT Type (re-exported from EP05 for convenience)
// =============================================================================

/**
 * Supported AI Coding Tool types.
 * Matches the ACTType enum from EP05 config analysis.
 */
export type ACTType =
  | 'claude-code'
  | 'agents-md'
  | 'cursor'
  | 'aider'
  | 'copilot-cli'
  | 'unknown';

// =============================================================================
// SDK Types (from @anthropic-ai/claude-agent-sdk)
// =============================================================================

/**
 * AgentDefinition from Claude Agent SDK.
 * This is the shape expected by the SDK's `agents` option.
 *
 * NOTE: In implementation, import this type directly from the SDK:
 * ```typescript
 * import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
 * ```
 *
 * This interface is documented here for contract clarity.
 */
export interface AgentDefinition {
  /** Natural language description of when to use this agent - Claude uses this to decide invocation */
  description: string;

  /** The agent's system prompt defining its role and behavior */
  prompt: string;

  /** Array of allowed tool names. If omitted, inherits all tools from parent. Use [] to deny all. */
  tools?: string[];

  /** Array of tool names to explicitly disallow (opposite of tools) */
  disallowedTools?: string[];

  /** Model override for this agent. If omitted or 'inherit', uses main agent's model. */
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';

  /** MCP servers available to this subagent (optional) */
  mcpServers?: Array<{ name: string; config: unknown }>;
}

// =============================================================================
// ACT Instructions
// =============================================================================

/**
 * Bundled instructions for an ACT analyzer subagent.
 * Used internally to build SDK-compatible AgentDefinition objects.
 *
 * The registry's `toAgentsOption()` converts these to SDK AgentDefinition:
 * - `name` becomes the key in Record<string, AgentDefinition>
 * - `description`, `prompt`, `tools`, `model` map directly
 * - `displayName`, `actTypes`, `priority` are internal metadata
 */
export interface ACTInstructions {
  /** Unique identifier - becomes the agent key (e.g., "claude-code-analyzer") */
  name: string;

  /** Human-readable display name (internal metadata, not sent to SDK) */
  displayName: string;

  /** When this subagent should be invoked - Claude uses this to decide delegation */
  description: string;

  /** Full context-engineered system prompt */
  prompt: string;

  /** List of tool names this subagent can use. Do NOT include 'Task'. */
  tools: string[];

  /** Which ACT types this analyzer handles (internal routing metadata) */
  actTypes: ACTType[];

  /** Selection priority (higher = preferred when multiple match, internal) */
  priority: number;

  /** Optional model override. Defaults to 'inherit' (use main agent's model). */
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
}

/**
 * Zod schema for ACTInstructions validation.
 */
export const ACTInstructionsSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens')
    .min(1)
    .max(50),
  displayName: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  prompt: z.string().min(1).max(51200), // 50KB limit per NFR-002
  tools: z
    .array(z.string())
    .min(1)
    .refine((tools) => !tools.includes('Task'), {
      message: "Subagent tools must NOT include 'Task' (single-depth constraint)",
    }),
  actTypes: z
    .array(
      z.enum(['claude-code', 'agents-md', 'cursor', 'aider', 'copilot-cli', 'unknown'])
    )
    .min(1),
  priority: z.number().int().min(1).max(100),
  model: z.enum(['sonnet', 'opus', 'haiku', 'inherit']).optional(),
});

// =============================================================================
// ACT Subagent Registry
// =============================================================================

/**
 * Registry for managing ACT subagent definitions.
 */
export interface IACTSubagentRegistry {
  /**
   * Register a new subagent.
   * @throws Error if name already registered
   */
  register(instructions: ACTInstructions): void;

  /**
   * Get subagent by name.
   */
  get(name: string): ACTInstructions | undefined;

  /**
   * List all registered subagents.
   */
  list(): ACTInstructions[];

  /**
   * Find the best subagent for a given ACT type.
   * Returns highest priority match.
   */
  getForACTType(actType: ACTType): ACTInstructions | undefined;

  /**
   * Convert registry to SDK's `agents` option format.
   * @returns Record<string, AgentDefinition>
   */
  toAgentsOption(): Record<string, AgentDefinition>;
}

// =============================================================================
// Builder Function
// =============================================================================

/**
 * Build ACT subagents for the orchestrator.
 * This is the main integration point used by the orchestrator.
 *
 * @returns SDK-compatible agents option (Record<string, AgentDefinition>)
 *
 * @example
 * ```typescript
 * import { buildACTSubagents } from '../act';
 * import { query } from '@anthropic-ai/claude-agent-sdk';
 *
 * for await (const message of query({
 *   prompt: task,
 *   options: {
 *     // CRITICAL: 'Task' must be in allowedTools for subagent invocation
 *     allowedTools: ['Read', 'Grep', 'Glob', 'Task', ...mcpTools],
 *     agents: buildACTSubagents(),
 *   },
 * })) {
 *   // process messages
 * }
 * ```
 *
 * @remarks
 * - Subagents are invoked via the Task tool - Claude decides when based on description
 * - Subagents CANNOT spawn their own subagents (single-depth constraint)
 * - Do NOT include 'Task' in any subagent's tools array
 */
export type BuildACTSubagentsFn = () => Record<string, AgentDefinition>;

// =============================================================================
// Subagent Output Types
// =============================================================================

/**
 * Findings reported by a subagent back to the orchestrator.
 * This is not enforced by the SDK but provides a consistent structure.
 */
export interface ACTAnalysisFindings {
  /** Which ACT type was analyzed */
  actType: ACTType;

  /** Configuration analysis results */
  config?: {
    /** Files discovered and analyzed */
    filesAnalyzed: string[];
    /** Issues found in configuration */
    issues: ACTConfigIssue[];
    /** Configuration quality score (0-100) */
    qualityScore?: number;
  };

  /** Session analysis results (Claude Code only) */
  sessions?: {
    /** Number of sessions analyzed */
    sessionCount: number;
    /** Patterns identified */
    patterns: string[];
    /** Session-related issues */
    issues: ACTSessionIssue[];
  };

  /** Recommendations for improvement */
  recommendations: ACTRecommendation[];

  /** Any limitations or caveats in the analysis */
  limitations?: string[];
}

/**
 * Issue found in ACT configuration.
 */
export interface ACTConfigIssue {
  /** Issue severity */
  severity: 'error' | 'warning' | 'info';
  /** File where issue was found */
  file: string;
  /** Line number if applicable */
  line?: number;
  /** Issue description */
  message: string;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Issue found in session analysis.
 */
export interface ACTSessionIssue {
  /** Issue severity */
  severity: 'error' | 'warning' | 'info';
  /** Session ID or identifier */
  sessionId?: string;
  /** Issue description */
  message: string;
  /** Related sessions count */
  occurrences?: number;
}

/**
 * Recommendation from ACT analysis.
 */
export interface ACTRecommendation {
  /** Recommendation type */
  type: 'symptomatic' | 'preventive' | 'systemic';
  /** Priority (1 = highest) */
  priority: number;
  /** What to do */
  action: string;
  /** Why this matters */
  rationale: string;
  /** Where to make the change */
  target?: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default tools available to ACT subagents.
 */
export const DEFAULT_ACT_TOOLS = [
  'discover_configs',
  'parse_config',
  'analyze_hierarchy',
  'search_sessions',
  'get_session_stats',
] as const;

/**
 * Tools available to generalized analyzer (subset).
 */
export const GENERALIZED_ACT_TOOLS = ['discover_configs', 'parse_config'] as const;
