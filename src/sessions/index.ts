/**
 * EP15 Session Intelligence
 *
 * Provides tools and subagent for understanding what happened in sessions and why.
 * Enables narrative understanding rather than raw metrics.
 *
 * @module sessions
 */

// Types (T007)
export * from './types';

// Schemas (T008)
export * from './schemas';

// Extraction functions (Phase 3-7)
export * from './extraction';

// Storage helpers (T010-T016)
export * from './storage';

// Tools (Phase 3-9) - export tools only, not type re-definitions
export {
  getSessionTimelineTool,
  getSessionTimeline,
  getToolSequencesTool,
  getToolSequences,
  getFileAccessesTool,
  getFileAccesses,
  getDelegationEventsTool,
  getDelegationEvents,
  getQualitySignalsTool,
  getQualitySignals,
  getMcpUsageTool,
  getMcpUsage,
  getPermissionEventsTool,
  getPermissionEvents,
  spawnSessionAnalystTool,
  buildAnalysisContext,
  buildQueryPrompt,
} from './tools';

// Subagent (Phase 8)
export * from './subagent';

/**
 * Session Intelligence module version constant.
 * Used for schema versioning and compatibility checks.
 */
export const SESSION_INTELLIGENCE_VERSION = '0.1.0';

/**
 * Session Intelligence module is ready.
 */
export const SESSION_INTELLIGENCE_READY = true;
