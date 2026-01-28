/**
 * EP11 Quality & Security - Debug Namespaces
 *
 * Namespace constants for debug logging, supporting hierarchical
 * namespace filtering similar to the `debug` npm package.
 *
 * Usage with DEBUG environment variable:
 *   DEBUG=agentlint:*         # All agentlint namespaces
 *   DEBUG=agentlint:tools     # Only tools namespace
 *   DEBUG=agentlint:llm,agentlint:secrets  # Multiple namespaces
 *
 * @module debug/namespaces
 */

// =============================================================================
// Debug Namespace Hierarchy
// =============================================================================

/**
 * Debug namespace hierarchy for agentlint components.
 *
 * Namespaces follow the pattern `agentlint:<component>` for consistency
 * with the `debug` npm package convention. Wildcards are supported:
 * - `agentlint:*` matches all agentlint namespaces
 * - `agentlint:tools*` matches tools and any sub-namespaces
 */
export const DEBUG_NAMESPACES = {
  /** Match all agentlint debug output */
  ALL: 'agentlint:*',

  /** Tool invocations and results */
  TOOLS: 'agentlint:tools',

  /** LLM API calls and responses */
  LLM: 'agentlint:llm',

  /** Secret detection and classification */
  SECRETS: 'agentlint:secrets',

  /** Evaluation framework */
  EVAL: 'agentlint:eval',

  /** Session checkpoints and recovery */
  CHECKPOINT: 'agentlint:checkpoint',

  /** Orchestration core */
  ORCHESTRATION: 'agentlint:orchestration',

  /** Server lifecycle and health */
  SERVER: 'agentlint:server',

  /** Causal tracing engine */
  CAUSAL: 'agentlint:causal',

  /** ACT adapters */
  ACT: 'agentlint:act',

  /** Recommendation advisor */
  ADVISOR: 'agentlint:advisor',
} as const;

/**
 * Type for valid debug namespace values.
 */
export type DebugNamespace = (typeof DEBUG_NAMESPACES)[keyof typeof DEBUG_NAMESPACES];

// =============================================================================
// Namespace Matching
// =============================================================================

/**
 * Check if a namespace matches a pattern.
 *
 * Supports wildcard matching:
 * - `agentlint:*` matches any namespace starting with `agentlint:`
 * - `agentlint:tools` matches exactly `agentlint:tools`
 * - `agentlint:tools:*` matches `agentlint:tools:read`, `agentlint:tools:write`, etc.
 *
 * @param namespace - The namespace to check
 * @param pattern - The pattern to match against
 * @returns true if the namespace matches the pattern
 */
export function matchesNamespace(namespace: string, pattern: string): boolean {
  // Exact match
  if (namespace === pattern) {
    return true;
  }

  // Wildcard match: pattern ends with '*'
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return namespace.startsWith(prefix);
  }

  return false;
}

/**
 * Check if a namespace is enabled based on active patterns.
 *
 * @param namespace - The namespace to check
 * @param enabledPatterns - List of enabled namespace patterns
 * @returns true if the namespace is enabled
 */
export function isNamespaceEnabled(namespace: string, enabledPatterns: string[]): boolean {
  if (enabledPatterns.length === 0) {
    return false;
  }

  return enabledPatterns.some((pattern) => matchesNamespace(namespace, pattern));
}

// =============================================================================
// Environment Variable Integration
// =============================================================================

/**
 * Parse DEBUG environment variable into namespace patterns.
 *
 * Only returns patterns that are relevant to agentlint (start with 'agentlint').
 * This ensures we don't interfere with other debug namespaces in the environment.
 *
 * @param env - The DEBUG environment variable value
 * @returns Array of agentlint namespace patterns
 */
export function parseDebugEnv(env: string | undefined): string[] {
  if (!env) {
    return [];
  }

  // Only activate for agentlint-specific namespaces
  if (!env.includes('agentlint')) {
    return [];
  }

  return env
    .split(',')
    .map((ns) => ns.trim())
    .filter((ns) => ns.startsWith('agentlint'));
}

/**
 * Check if debug is enabled for agentlint based on environment.
 *
 * @param env - Optional DEBUG environment variable value (defaults to process.env.DEBUG)
 * @returns true if any agentlint debug output is enabled
 */
export function isAgentlintDebugEnabled(env?: string): boolean {
  const debug = env ?? process.env.DEBUG ?? '';
  return debug.includes('agentlint:') || debug === 'agentlint';
}

/**
 * Get the DEBUG environment variable value for enabling all agentlint namespaces.
 *
 * @returns The value to set DEBUG to for full agentlint debug output
 */
export function getAllNamespacesDebugValue(): string {
  return DEBUG_NAMESPACES.ALL;
}

// =============================================================================
// Namespace Utilities
// =============================================================================

/**
 * Create a sub-namespace under a parent namespace.
 *
 * @param parent - The parent namespace
 * @param child - The child component name
 * @returns The combined namespace
 *
 * @example
 * createSubNamespace('agentlint:tools', 'read') // 'agentlint:tools:read'
 */
export function createSubNamespace(parent: string, child: string): string {
  return `${parent}:${child}`;
}

/**
 * Get all defined namespace values (excluding ALL wildcard).
 *
 * @returns Array of specific namespace values
 */
export function getSpecificNamespaces(): string[] {
  return Object.values(DEBUG_NAMESPACES).filter((ns) => !ns.endsWith('*'));
}
