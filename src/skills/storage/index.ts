/**
 * EP14: Skills Effectiveness Analysis - Storage Module Exports
 *
 * Public API for skill invocation storage.
 *
 * @module src/skills/storage
 */

// =============================================================================
// Schema
// =============================================================================

export {
  SKILL_INVOCATIONS_SCHEMA,
  SKILL_INVOCATIONS_SCHEMA_VERSION,
  initializeSkillsSchema,
  skillsSchemaExists,
  dropSkillsSchema,
  getSkillInvocationCount,
} from './schema';

// =============================================================================
// Queries
// =============================================================================

export {
  // Skill invocation queries
  querySkillInvocations,
  countSkillInvocations,
  countUniqueSkills,
  countUniqueSessions,
  // Skill invocation insert
  insertSkillInvocation,
  insertSkillInvocationsBatch,
  // Session summary queries
  querySessionSummaries,
  getFirstUserPrompt,
  getFilesOperated,
  getSkillsInvoked,
  // Delete operations
  deleteSkillInvocationsForSession,
  deleteAllSkillInvocations,
} from './queries';
