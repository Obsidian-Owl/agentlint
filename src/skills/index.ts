/**
 * EP14: Skills Effectiveness Analysis - Public Exports
 *
 * This module provides tools for analyzing skill usage effectiveness,
 * including invocation tracking, session summaries, and skill inventory.
 *
 * Per Constitution Principle VII: Tools return data, agent reasons about effectiveness.
 *
 * @module src/skills
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Tool inputs
  GetSkillInventoryInput,
  GetSkillInvocationsInput,
  GetSessionSummariesInput,
  IndexSkillInvocationsInput,
  // Tool outputs
  SkillInventoryItem,
  GetSkillInventoryResult,
  SkillInvocationRecord,
  GetSkillInvocationsResult,
  SessionSummary,
  GetSessionSummariesResult,
  IndexSkillInvocationsResult,
  // Database types
  SkillInvocationRow,
  // Error types
  SkillsErrorCode,
  SkillsError,
  SkillsToolResult,
} from './types';

// =============================================================================
// Schemas
// =============================================================================

export {
  // Input schemas
  GetSkillInventoryInputSchema,
  GetSkillInvocationsInputSchema,
  GetSessionSummariesInputSchema,
  IndexSkillInvocationsInputSchema,
  // Output schemas
  SkillInventoryItemSchema,
  GetSkillInventoryResultSchema,
  SkillInvocationRecordSchema,
  GetSkillInvocationsResultSchema,
  SessionSummarySchema,
  GetSessionSummariesResultSchema,
  IndexSkillInvocationsResultSchema,
  // Database schemas
  SkillInvocationRowSchema,
} from './schemas';

// =============================================================================
// Inferred Types from Schemas
// =============================================================================

export type {
  GetSkillInventoryInputZ,
  GetSkillInvocationsInputZ,
  GetSessionSummariesInputZ,
  IndexSkillInvocationsInputZ,
  SkillInventoryItemZ,
  GetSkillInventoryResultZ,
  SkillInvocationRecordZ,
  GetSkillInvocationsResultZ,
  SessionSummaryZ,
  GetSessionSummariesResultZ,
  IndexSkillInvocationsResultZ,
  SkillInvocationRowZ,
} from './schemas';

// =============================================================================
// Discovery (skill inventory from .claude/skills/)
// =============================================================================

export { getSkillInventory, hasSkills, getSkillByName } from './discovery';

// =============================================================================
// Detection (skill invocation extraction from logs)
// =============================================================================

export {
  isSkillInvocation,
  extractSkillCommand,
  extractUserPromptContext,
  detectSkillInvocations,
  isSkillToolUse,
} from './detection';

export type { DetectedSkillInvocation } from './detection';

// =============================================================================
// Storage
// =============================================================================

export {
  // Schema
  SKILL_INVOCATIONS_SCHEMA,
  SKILL_INVOCATIONS_SCHEMA_VERSION,
  initializeSkillsSchema,
  skillsSchemaExists,
  dropSkillsSchema,
  getSkillInvocationCount,
  // Queries
  querySkillInvocations,
  countSkillInvocations,
  countUniqueSkills,
  countUniqueSessions,
  insertSkillInvocation,
  insertSkillInvocationsBatch,
  querySessionSummaries,
  getFirstUserPrompt,
  getFilesOperated,
  getSkillsInvoked,
  deleteSkillInvocationsForSession,
  deleteAllSkillInvocations,
} from './storage';

// =============================================================================
// SDK Tools
// =============================================================================

export {
  getSkillInventoryTool,
  indexSkillInvocationsTool,
  getSessionSummariesTool,
  getSkillInvocationsTool,
} from './tools';
