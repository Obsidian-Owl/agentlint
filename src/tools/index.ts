/**
 * Tools module - EP05+ tool implementations
 *
 * This module exports all agentlint tools for use with the orchestration layer.
 * Tools are registered with the ToolRegistry from EP02.
 *
 * @module tools
 */

import type { IToolRegistry, ToolDefinition } from '../orchestration/tool-registry';

// Enumerations (shared across tools)
export * from './types';

// Config analysis tools (EP05)
export * from './config';

// Session analysis tools (EP06)
// Note: Export with namespace to avoid conflicts with config exports (both have extractMetrics)
export * as sessions from './sessions';

// Temporal analysis tools (EP09)
export * as temporal from '../temporal/tools';

// Adapters for different ACT formats
export * from './adapters';

// =============================================================================
// Tool Definitions for Registration
// =============================================================================

// Re-export individual tool definitions for explicit registration
export { discoverConfigsTool, parseConfigTool, analyzeHierarchyTool } from './config';
export { searchSessionsTool, getSessionStatsTool } from './sessions';
export {
  storeBaselineTool,
  queryBaselineTool,
  listBaselinesTool,
  calculateDeltaTool,
} from '../temporal/tools';

// =============================================================================
// Tool Registration Helpers (T072)
// =============================================================================

import { discoverConfigsTool, parseConfigTool, analyzeHierarchyTool } from './config';
import { searchSessionsTool, getSessionStatsTool } from './sessions';
import {
  storeBaselineTool,
  queryBaselineTool,
  listBaselinesTool,
  calculateDeltaTool,
} from '../temporal/tools';

/**
 * All EP05 config analysis tools as an array for bulk registration.
 * Cast to ToolDefinition[] for compatibility with ToolRegistry.
 */
export const EP05_CONFIG_TOOLS: ToolDefinition[] = [
  discoverConfigsTool,
  parseConfigTool,
  analyzeHierarchyTool,
] as ToolDefinition[];

/**
 * All EP06 session analysis tools as an array for bulk registration.
 */
export const EP06_SESSION_TOOLS: ToolDefinition[] = [
  searchSessionsTool,
  getSessionStatsTool,
] as ToolDefinition[];

/**
 * All EP09 temporal analysis tools as an array for bulk registration.
 */
export const EP09_TEMPORAL_TOOLS: ToolDefinition[] = [
  storeBaselineTool,
  queryBaselineTool,
  listBaselinesTool,
  calculateDeltaTool,
] as ToolDefinition[];

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
  registry.registerMany(EP05_CONFIG_TOOLS);
}

/**
 * Register all EP06 session analysis tools with a ToolRegistry.
 *
 * @param registry - The ToolRegistry to register tools with
 * @example
 * ```typescript
 * import { createToolRegistry } from './orchestration';
 * import { registerEP06Tools } from './tools';
 *
 * const registry = createToolRegistry();
 * registerEP06Tools(registry);
 * ```
 */
export function registerEP06Tools(registry: IToolRegistry): void {
  registry.registerMany(EP06_SESSION_TOOLS);
}

/**
 * Register all EP09 temporal analysis tools with a ToolRegistry.
 *
 * @param registry - The ToolRegistry to register tools with
 * @example
 * ```typescript
 * import { createToolRegistry } from './orchestration';
 * import { registerEP09Tools } from './tools';
 *
 * const registry = createToolRegistry();
 * registerEP09Tools(registry);
 * ```
 */
export function registerEP09Tools(registry: IToolRegistry): void {
  registry.registerMany(EP09_TEMPORAL_TOOLS);
}

/**
 * Register all agentlint tools with a ToolRegistry.
 * Includes EP05 config analysis, EP06 session analysis, and EP09 temporal tools.
 *
 * @param registry - The ToolRegistry to register tools with
 */
export function registerAllTools(registry: IToolRegistry): void {
  registerEP05Tools(registry);
  registerEP06Tools(registry);
  registerEP09Tools(registry);
}
