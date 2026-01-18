/**
 * Type definitions for ACT Subagents
 *
 * @module act/types
 */

// TODO: T005 - Re-export ACTType from EP05 (with aider, copilot-cli values)
// TODO: T006 - Import AgentDefinition from SDK or define interface
// TODO: T007 - Implement ACTInstructions interface and Zod schema
// TODO: T008 - Implement analysis output types
// TODO: T016 - Export DEFAULT_ACT_TOOLS and GENERALIZED_ACT_TOOLS constants

/**
 * AgentDefinition - Configuration for an SDK subagent.
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
  model?: "sonnet" | "opus" | "haiku" | "inherit";

  /** MCP servers available to this subagent */
  mcpServers?: Array<{ name: string; config: unknown }>;
}
