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

// EP15 Session intelligence tools
export {
  getSessionTimelineTool,
  getToolSequencesTool,
  getFileAccessesTool,
  getDelegationEventsTool,
  getQualitySignalsTool,
  getMcpUsageTool,
  getPermissionEventsTool,
  spawnSessionAnalystTool,
} from '../sessions/tools';

// EP19 MCP config validation tools
export { getMcpConfigsTool, validateMcpConfigTool } from './config/mcp';

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

// EP15 Session intelligence tools
import {
  getSessionTimelineTool,
  getToolSequencesTool,
  getFileAccessesTool,
  getDelegationEventsTool,
  getQualitySignalsTool,
  getMcpUsageTool,
  getPermissionEventsTool,
  spawnSessionAnalystTool,
} from '../sessions/tools';

// EP19 MCP config validation tools
import { getMcpConfigsTool, validateMcpConfigTool } from './config/mcp';

/**
 * All config analysis tools as an array for bulk registration.
 * Cast to ToolDefinition[] for compatibility with ToolRegistry.
 */
export const CONFIG_TOOLS: ToolDefinition[] = [
  discoverConfigsTool,
  parseConfigTool,
  analyzeHierarchyTool,
] as ToolDefinition[];

/**
 * All session analysis tools as an array for bulk registration.
 */
export const SESSION_TOOLS: ToolDefinition[] = [
  searchSessionsTool,
  getSessionStatsTool,
  indexSessionsTool,
] as ToolDefinition[];

/**
 * All causal tracing tools as an array for bulk registration.
 */
export const CAUSAL_TOOLS: ToolDefinition[] = [
  traceIssueOriginTool,
  getIssuePatternsTool,
] as ToolDefinition[];

/**
 * All temporal analysis tools as an array for bulk registration.
 */
export const TEMPORAL_TOOLS: ToolDefinition[] = [
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
 * All recommendation tools as an array for bulk registration.
 */
export const RECOMMENDATION_TOOLS: ToolDefinition[] = [
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
 * All security tools as an array for bulk registration.
 */
export const SECURITY_TOOLS: ToolDefinition[] = [classifySecretTool] as ToolDefinition[];

/**
 * All skills effectiveness tools as an array for bulk registration.
 */
export const SKILLS_TOOLS: ToolDefinition[] = [
  getSkillInventoryTool,
  indexSkillInvocationsTool,
  getSessionSummariesTool,
  getSkillInvocationsTool,
] as ToolDefinition[];

/**
 * All session intelligence tools as an array for bulk registration.
 */
export const SESSION_INTELLIGENCE_TOOLS: ToolDefinition[] = [
  getSessionTimelineTool,
  getToolSequencesTool,
  getFileAccessesTool,
  getDelegationEventsTool,
  getQualitySignalsTool,
  getMcpUsageTool,
  getPermissionEventsTool,
  spawnSessionAnalystTool,
] as ToolDefinition[];

/**
 * MCP config validation tools for discovering and validating MCP server configurations.
 */
export const MCP_CONFIG_TOOLS: ToolDefinition[] = [
  getMcpConfigsTool,
  validateMcpConfigTool,
] as ToolDefinition[];

/**
 * Register all config analysis tools with a ToolRegistry.
 *
 * @param registry - The ToolRegistry to register tools with
 * @example
 * ```typescript
 * import { createToolRegistry } from './orchestration';
 * import { registerConfigTools } from './tools';
 *
 * const registry = createToolRegistry();
 * registerConfigTools(registry);
 * ```
 */
export function registerConfigTools(registry: IToolRegistry): void {
  registry.registerMany(CONFIG_TOOLS);
}

/**
 * Register all session analysis tools with a ToolRegistry.
 *
 * @param registry - The ToolRegistry to register tools with
 * @example
 * ```typescript
 * import { createToolRegistry } from './orchestration';
 * import { registerSessionTools } from './tools';
 *
 * const registry = createToolRegistry();
 * registerSessionTools(registry);
 * ```
 */
export function registerSessionTools(registry: IToolRegistry): void {
  registry.registerMany(SESSION_TOOLS);
}

/**
 * Register all causal tracing tools with a ToolRegistry.
 *
 * @param registry - The ToolRegistry to register tools with
 * @example
 * ```typescript
 * import { createToolRegistry } from './orchestration';
 * import { registerCausalTools } from './tools';
 *
 * const registry = createToolRegistry();
 * registerCausalTools(registry);
 * ```
 */
export function registerCausalTools(registry: IToolRegistry): void {
  registry.registerMany(CAUSAL_TOOLS);
}

/**
 * Register all temporal analysis tools with a ToolRegistry.
 *
 * @param registry - The ToolRegistry to register tools with
 * @example
 * ```typescript
 * import { createToolRegistry } from './orchestration';
 * import { registerTemporalTools } from './tools';
 *
 * const registry = createToolRegistry();
 * registerTemporalTools(registry);
 * ```
 */
export function registerTemporalTools(registry: IToolRegistry): void {
  registry.registerMany(TEMPORAL_TOOLS);
}

/**
 * Register all recommendation tools with a ToolRegistry.
 *
 * @param registry - The ToolRegistry to register tools with
 * @example
 * ```typescript
 * import { createToolRegistry } from './orchestration';
 * import { registerRecommendationTools } from './tools';
 *
 * const registry = createToolRegistry();
 * registerRecommendationTools(registry);
 * ```
 */
export function registerRecommendationTools(registry: IToolRegistry): void {
  registry.registerMany(RECOMMENDATION_TOOLS);
}

/**
 * Register all security tools with a ToolRegistry.
 *
 * @param registry - The ToolRegistry to register tools with
 * @example
 * ```typescript
 * import { createToolRegistry } from './orchestration';
 * import { registerSecurityTools } from './tools';
 *
 * const registry = createToolRegistry();
 * registerSecurityTools(registry);
 * ```
 */
export function registerSecurityTools(registry: IToolRegistry): void {
  registry.registerMany(SECURITY_TOOLS);
}

/**
 * Register all skills effectiveness tools with a ToolRegistry.
 *
 * @param registry - The ToolRegistry to register tools with
 * @example
 * ```typescript
 * import { createToolRegistry } from './orchestration';
 * import { registerSkillsTools } from './tools';
 *
 * const registry = createToolRegistry();
 * registerSkillsTools(registry);
 * ```
 */
export function registerSkillsTools(registry: IToolRegistry): void {
  registry.registerMany(SKILLS_TOOLS);
}

/**
 * Register all session intelligence tools with a ToolRegistry.
 *
 * @param registry - The ToolRegistry to register tools with
 * @example
 * ```typescript
 * import { createToolRegistry } from './orchestration';
 * import { registerSessionIntelligenceTools } from './tools';
 *
 * const registry = createToolRegistry();
 * registerSessionIntelligenceTools(registry);
 * ```
 */
export function registerSessionIntelligenceTools(registry: IToolRegistry): void {
  registry.registerMany(SESSION_INTELLIGENCE_TOOLS);
}

/**
 * Register MCP config validation tools with a ToolRegistry.
 *
 * @param registry - The ToolRegistry to register tools with
 * @example
 * ```typescript
 * import { createToolRegistry } from './orchestration';
 * import { registerMcpConfigTools } from './tools';
 *
 * const registry = createToolRegistry();
 * registerMcpConfigTools(registry);
 * ```
 */
export function registerMcpConfigTools(registry: IToolRegistry): void {
  registry.registerMany(MCP_CONFIG_TOOLS);
}

/**
 * Register all agentlint tools with a ToolRegistry.
 *
 * Tool categories:
 * - Config analysis: 3 tools
 * - Session analysis: 3 tools
 * - Causal tracing: 2 tools
 * - Temporal analysis: 8 tools
 * - Recommendations: 9 tools
 * - Security: 1 tool
 * - Skills effectiveness: 4 tools
 * - Session intelligence: 8 tools
 * - MCP config validation: 2 tools
 *
 * Total: 40 tools
 *
 * @param registry - The ToolRegistry to register tools with
 */
export function registerAllTools(registry: IToolRegistry): void {
  registerConfigTools(registry); // Config (3)
  registerSessionTools(registry); // Sessions (3)
  registerCausalTools(registry); // Causal (2)
  registerTemporalTools(registry); // Temporal (8)
  registerRecommendationTools(registry); // Recommendations (9)
  registerSecurityTools(registry); // Security (1)
  registerSkillsTools(registry); // Skills (4)
  registerSessionIntelligenceTools(registry); // Session Intelligence (8)
  registerMcpConfigTools(registry); // MCP Config Validation (2)
}
