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

// Skills effectiveness tools (EP14)
export * as skills from '../skills';

// Session intelligence tools (EP15)
export * as sessionIntelligence from '../sessions';

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

// EP14 Skills effectiveness tools
export {
  getSkillInventoryTool,
  indexSkillInvocationsTool,
  getSessionSummariesTool,
  getSkillInvocationsTool,
} from '../skills';

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

// EP14 Skills effectiveness tools
import {
  getSkillInventoryTool,
  indexSkillInvocationsTool,
  getSessionSummariesTool,
  getSkillInvocationsTool,
} from '../skills';

// EP15 Session intelligence tools (placeholder - tools added in Phase 3+)
// import { } from '../sessions/tools';

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
export const EP11_SECURITY_TOOLS: ToolDefinition[] = [classifySecretTool] as ToolDefinition[];

/**
 * All EP14 skills effectiveness tools as an array for bulk registration.
 */
export const EP14_SKILLS_TOOLS: ToolDefinition[] = [
  getSkillInventoryTool,
  indexSkillInvocationsTool,
  getSessionSummariesTool,
  getSkillInvocationsTool,
] as ToolDefinition[];

/**
 * All EP15 session intelligence tools as an array for bulk registration.
 * Placeholder - tools will be added in Phase 3+.
 */
export const EP15_SESSION_INTELLIGENCE_TOOLS: ToolDefinition[] = [
  // Tools will be added as they are implemented:
  // - get_session_timeline (T025)
  // - get_tool_sequences (T036)
  // - get_file_accesses (T037)
  // - get_delegation_events (T044)
  // - get_quality_signals (T053)
  // - get_mcp_usage (T060)
  // - spawn_session_analyst (T069)
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
 * Register all EP14 skills effectiveness tools with a ToolRegistry.
 *
 * @param registry - The ToolRegistry to register tools with
 * @example
 * ```typescript
 * import { createToolRegistry } from './orchestration';
 * import { registerEP14SkillsTools } from './tools';
 *
 * const registry = createToolRegistry();
 * registerEP14SkillsTools(registry);
 * ```
 */
export function registerEP14SkillsTools(registry: IToolRegistry): void {
  registry.registerMany(EP14_SKILLS_TOOLS);
}

/**
 * Register all EP15 session intelligence tools with a ToolRegistry.
 * Placeholder - tools will be added in Phase 3+.
 *
 * @param registry - The ToolRegistry to register tools with
 * @example
 * ```typescript
 * import { createToolRegistry } from './orchestration';
 * import { registerEP15SessionIntelligenceTools } from './tools';
 *
 * const registry = createToolRegistry();
 * registerEP15SessionIntelligenceTools(registry);
 * ```
 */
export function registerEP15SessionIntelligenceTools(registry: IToolRegistry): void {
  registry.registerMany(EP15_SESSION_INTELLIGENCE_TOOLS);
}

/**
 * Register all agentlint tools with a ToolRegistry.
 * Includes EP05-EP15 tools:
 * - EP05: Config analysis (3 tools)
 * - EP06: Session analysis (3 tools)
 * - EP07: Causal tracing (2 tools)
 * - EP09: Temporal analysis (8 tools)
 * - EP10: Recommendations (9 tools)
 * - EP11: Security (1 tool)
 * - EP14: Skills effectiveness (4 tools)
 * - EP15: Session intelligence (0 tools, placeholder)
 *
 * Total: 30 tools (EP15 tools to be added)
 *
 * @param registry - The ToolRegistry to register tools with
 */
export function registerAllTools(registry: IToolRegistry): void {
  registerEP05Tools(registry); // Config (3)
  registerEP06Tools(registry); // Sessions (3)
  registerEP07Tools(registry); // Causal (2)
  registerEP09Tools(registry); // Temporal (8)
  registerEP10Tools(registry); // Recommendations (9)
  registerEP11SecurityTools(registry); // Security (1)
  registerEP14SkillsTools(registry); // Skills (4)
  registerEP15SessionIntelligenceTools(registry); // Session Intelligence (placeholder)
}
