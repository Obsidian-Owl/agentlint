/**
 * Tools module - EP05+ tool implementations
 *
 * This module exports all agentlint tools for use with the orchestration layer.
 * Tools are registered with the ToolRegistry from EP02.
 *
 * @module tools
 */

import type { IToolRegistry } from '../orchestration/tool-registry';

// Enumerations (shared across tools)
export * from './types';

// Config analysis tools (EP05)
export * from './config';

// Adapters for different ACT formats
export * from './adapters';

// =============================================================================
// Tool Definitions for Registration
// =============================================================================

// Re-export individual tool definitions for explicit registration
export {
  discoverConfigsTool,
  parseConfigTool,
  analyzeHierarchyTool,
} from './config';

// =============================================================================
// Tool Registration Helpers (T072)
// =============================================================================

import {
  discoverConfigsTool,
  parseConfigTool,
  analyzeHierarchyTool,
} from './config';

/**
 * All EP05 config analysis tools as an array for bulk registration.
 */
export const EP05_CONFIG_TOOLS = [
  discoverConfigsTool,
  parseConfigTool,
  analyzeHierarchyTool,
] as const;

/**
 * Register all EP05 config analysis tools with a ToolRegistry.
 *
 * @param registry - The ToolRegistry to register tools with
 * @example
 * ```typescript
 * import { createToolRegistry } from './orchestration';
 * import { registerEP05Tools } from './tools';
 *
 * const registry = createToolRegistry();
 * registerEP05Tools(registry);
 * ```
 */
export function registerEP05Tools(registry: IToolRegistry): void {
  registry.registerMany([...EP05_CONFIG_TOOLS]);
}

/**
 * Register all agentlint tools with a ToolRegistry.
 * Currently includes EP05 config analysis tools.
 * Will be expanded as more epics add tools.
 *
 * @param registry - The ToolRegistry to register tools with
 */
export function registerAllTools(registry: IToolRegistry): void {
  registerEP05Tools(registry);
}
