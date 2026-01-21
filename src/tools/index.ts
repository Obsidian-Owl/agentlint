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

// Causal tracing tools (EP07)
export * as causal from './causal';

// Temporal analysis tools (EP09)
export * as temporal from '../temporal/tools';

// Recommendation tools (EP10)
export * as recommendations from '../recommendations/tools';

// Security tools (EP11)
export * as security from '../security';

// Adapters for different ACT formats
export * from './adapters';

// =============================================================================
// Tool Definitions for Registration
// =============================================================================

// Re-export individual tool definitions for explicit registration

// EP05 Config tools
export { discoverConfigsTool, parseConfigTool, analyzeHierarchyTool } from './config';

// EP06 Session tools
export { searchSessionsTool, getSessionStatsTool, indexSessionsTool } from './sessions';

// EP07 Causal tools
export { traceIssueOriginTool, getIssuePatternsTool } from './causal';

// EP09 Temporal tools
export {
  storeBaselineTool,
  queryBaselineTool,
  listBaselinesTool,
  calculateDeltaTool,
  queryTrendsTool,
  conductReviewTool,
  getReviewHistoryTool,
  spawnTemporalAnalystTool,
} from '../temporal/tools';

// EP10 Recommendation tools
export {
  createRecommendationTool,
  getRecommendationTool,
  listRecommendationsTool,
  refineRecommendationTool,
  updateRecommendationStatusTool,
  completeRecommendationTool,
  addRecommendationEventTool,
  getRecommendationSummaryTool,
  spawnRecommendationAdvisorTool,
} from '../recommendations/tools';

// EP11 Security tools
export { classifySecretTool } from '../security';

// =============================================================================
// Tool Registration Helpers (T072)
// =============================================================================

// EP05 Config tools
import { discoverConfigsTool, parseConfigTool, analyzeHierarchyTool } from './config';

// EP06 Session tools
import { searchSessionsTool, getSessionStatsTool, indexSessionsTool } from './sessions';

// EP07 Causal tools
import { traceIssueOriginTool, getIssuePatternsTool } from './causal';

// EP09 Temporal tools
import {
  storeBaselineTool,
  queryBaselineTool,
  listBaselinesTool,
  calculateDeltaTool,
  queryTrendsTool,
  conductReviewTool,
  getReviewHistoryTool,
  spawnTemporalAnalystTool,
} from '../temporal/tools';

// EP10 Recommendation tools
import {
  createRecommendationTool,
  getRecommendationTool,
  listRecommendationsTool,
  refineRecommendationTool,
  updateRecommendationStatusTool,
  completeRecommendationTool,
  addRecommendationEventTool,
  getRecommendationSummaryTool,
  spawnRecommendationAdvisorTool,
} from '../recommendations/tools';

// EP11 Security tools
import { classifySecretTool } from '../security';

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
  indexSessionsTool,
] as ToolDefinition[];

/**
 * All EP07 causal tracing tools as an array for bulk registration.
 */
export const EP07_CAUSAL_TOOLS: ToolDefinition[] = [
  traceIssueOriginTool,
  getIssuePatternsTool,
] as ToolDefinition[];

/**
 * All EP09 temporal analysis tools as an array for bulk registration.
 */
export const EP09_TEMPORAL_TOOLS: ToolDefinition[] = [
  storeBaselineTool,
  queryBaselineTool,
  listBaselinesTool,
  calculateDeltaTool,
  queryTrendsTool,
  conductReviewTool,
  getReviewHistoryTool,
  spawnTemporalAnalystTool,
] as ToolDefinition[];

/**
 * All EP10 recommendation tools as an array for bulk registration.
 */
export const EP10_RECOMMENDATION_TOOLS: ToolDefinition[] = [
  createRecommendationTool,
  getRecommendationTool,
  listRecommendationsTool,
  refineRecommendationTool,
  updateRecommendationStatusTool,
  completeRecommendationTool,
  addRecommendationEventTool,
  getRecommendationSummaryTool,
  spawnRecommendationAdvisorTool,
] as ToolDefinition[];

/**
 * All EP11 security tools as an array for bulk registration.
 */
export const EP11_SECURITY_TOOLS: ToolDefinition[] = [
  classifySecretTool,
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
 * Register all EP07 causal tracing tools with a ToolRegistry.
 *
 * @param registry - The ToolRegistry to register tools with
 * @example
 * ```typescript
 * import { createToolRegistry } from './orchestration';
 * import { registerEP07Tools } from './tools';
 *
 * const registry = createToolRegistry();
 * registerEP07Tools(registry);
 * ```
 */
export function registerEP07Tools(registry: IToolRegistry): void {
  registry.registerMany(EP07_CAUSAL_TOOLS);
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
 * Register all EP10 recommendation tools with a ToolRegistry.
 *
 * @param registry - The ToolRegistry to register tools with
 * @example
 * ```typescript
 * import { createToolRegistry } from './orchestration';
 * import { registerEP10Tools } from './tools';
 *
 * const registry = createToolRegistry();
 * registerEP10Tools(registry);
 * ```
 */
export function registerEP10Tools(registry: IToolRegistry): void {
  registry.registerMany(EP10_RECOMMENDATION_TOOLS);
}

/**
 * Register all EP11 security tools with a ToolRegistry.
 *
 * @param registry - The ToolRegistry to register tools with
 * @example
 * ```typescript
 * import { createToolRegistry } from './orchestration';
 * import { registerEP11SecurityTools } from './tools';
 *
 * const registry = createToolRegistry();
 * registerEP11SecurityTools(registry);
 * ```
 */
export function registerEP11SecurityTools(registry: IToolRegistry): void {
  registry.registerMany(EP11_SECURITY_TOOLS);
}

/**
 * Register all agentlint tools with a ToolRegistry.
 * Includes EP05-EP11 tools:
 * - EP05: Config analysis (3 tools)
 * - EP06: Session analysis (3 tools)
 * - EP07: Causal tracing (2 tools)
 * - EP09: Temporal analysis (8 tools)
 * - EP10: Recommendations (9 tools)
 * - EP11: Security (1 tool)
 *
 * Total: 26 tools
 *
 * @param registry - The ToolRegistry to register tools with
 */
export function registerAllTools(registry: IToolRegistry): void {
  registerEP05Tools(registry);    // Config (3)
  registerEP06Tools(registry);    // Sessions (2)
  registerEP07Tools(registry);    // Causal (2)
  registerEP09Tools(registry);    // Temporal (8)
  registerEP10Tools(registry);    // Recommendations (9)
  registerEP11SecurityTools(registry);  // Security (1)
}
