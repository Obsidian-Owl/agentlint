/**
 * Type definitions for ACT Subagents
 *
 * @module act/types
 */

import { z } from 'zod';

// T005: Re-export ACTType from EP05 (now includes aider, copilot-cli)
export { type ACTType } from '../tools/types.js';

/**
 * T006: AgentDefinition - Configuration for an SDK subagent.
 * Matches the Claude Agent SDK's AgentDefinition interface.
 */
export interface AgentDefinition {
  /** Natural language description - Claude uses this to decide when to invoke */
  description: string;

  /** The agent's system prompt defining its role and behavior */
  prompt: string;

  /** Array of allowed tool names. Omit to inherit all, use [] to deny all. */
  tools?: string[];

  /** Array of tool names to explicitly disallow (opposite of tools) */
  disallowedTools?: string[];

  /** Model override: 'sonnet' | 'opus' | 'haiku' | 'inherit' */
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';

  /** MCP servers available to this subagent */
  mcpServers?: Array<{ name: string; config: unknown }>;
}

/**
 * Opencode SDK agent configuration format.
 * Used for converting ACT subagents to Opencode's agent system.
 */
export interface OpencodeAgentConfig {
  /** Natural language description - Opencode uses this to decide when to invoke */
  description: string;

  /** Agent mode - must be 'subagent' for ACT analyzers */
  mode: 'subagent';

  /** The agent's system prompt defining its role and behavior */
  prompt: string;

  /** Boolean flags for built-in tool categories */
  tools: {
    /** Allow file reading operations */
    read?: boolean;
    /** Allow file writing operations */
    write?: boolean;
    /** Allow bash command execution */
    bash?: boolean;
    /** Allow Task tool (subagent invocation) - set false to enforce depth=1 */
    task?: boolean;
  };

  /** Fine-grained permissions for specific tools (including MCP tools) */
  permission?: Record<string, 'allow' | 'deny' | 'ask'>;

  /** Model override in Anthropic API format (e.g., 'anthropic/claude-sonnet-4-20250514') */
  model?: string;
}

/**
 * T016: Default tools available to ACT subagents.
 * Includes all EP05/EP06 analysis tools.
 */
export const DEFAULT_ACT_TOOLS = [
  'discover_configs',
  'parse_config',
  'analyze_hierarchy',
  'search_sessions',
  'get_session_stats',
] as const;

/**
 * T016: Minimal tools for generalized analyzer (fallback).
 * Only basic discovery and parsing.
 */
export const GENERALIZED_ACT_TOOLS = ['discover_configs', 'parse_config'] as const;

/**
 * T007: Zod schema for validating ACTInstructions.
 */
export const ACTInstructionsSchema = z.object({
  /** Unique identifier - becomes agent key (e.g., "claude-code-analyzer") */
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens')
    .min(1)
    .max(50),

  /** Human-readable name (internal metadata) */
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

  /** Which ACT types this analyzer handles (internal routing) */
  actTypes: z
    .array(
      z.enum(['claude-code', 'agents-md', 'cursor', 'aider', 'copilot-cli', 'windsurf', 'unknown'])
    )
    .min(1),

  /** Selection priority (higher = preferred, internal) */
  priority: z.number().int().min(1).max(100),

  /** Model override (defaults to inherit) */
  model: z.enum(['sonnet', 'opus', 'haiku', 'inherit']).optional(),
});

/**
 * T007: ACTInstructions type inferred from Zod schema.
 */
export type ACTInstructions = z.infer<typeof ACTInstructionsSchema>;

/**
 * T008: Severity of a detected issue.
 */
export type ACTIssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * T008: Type of recommendation.
 * Per Constitution III (Causal-First): preventive > symptomatic.
 */
export type ACTRecommendationType = 'symptomatic' | 'preventive' | 'systemic';

/**
 * T008: An issue detected in ACT configuration.
 */
export interface ACTConfigIssue {
  /** Issue severity */
  severity: ACTIssueSeverity;

  /** Brief description of the issue */
  description: string;

  /** File where the issue was found */
  file: string;

  /** Line number if applicable */
  line?: number;

  /** Suggested fix */
  suggestion: string;
}

/**
 * T008: An issue detected in ACT session history.
 */
export interface ACTSessionIssue {
  /** Issue severity */
  severity: ACTIssueSeverity;

  /** Brief description of the issue */
  description: string;

  /** Pattern observed across sessions */
  pattern: string;

  /** Example session IDs (if available) */
  sessionIds?: string[];

  /** Suggested fix */
  suggestion: string;
}

/**
 * T008: A recommendation from ACT analysis.
 */
export interface ACTRecommendation {
  /** Recommendation type (per Constitution III) */
  type: ACTRecommendationType;

  /** What action to take */
  action: string;

  /** Why this action is recommended */
  rationale: string;

  /** Where to make the change */
  target: string;
}

/**
 * T008: Complete analysis findings from an ACT subagent.
 */
export interface ACTAnalysisFindings {
  /** Project path that was analyzed */
  projectPath: string;

  /** Detected ACT type */
  actType: string;

  /** Number of files analyzed */
  filesAnalyzed: number;

  /** Configuration issues found */
  configIssues: ACTConfigIssue[];

  /** Session issues found (if session analysis was performed) */
  sessionIssues?: ACTSessionIssue[];

  /** Recommendations */
  recommendations: ACTRecommendation[];

  /** Summary of the analysis */
  summary: string;

  /** Any limitations or things that couldn't be determined */
  limitations?: string[];
}
