/**
 * EP14: Skills Effectiveness Analysis - Zod Validation Schemas
 *
 * Zod schemas for validating skills tool inputs.
 * These schemas correspond to the TypeScript interfaces in types.ts.
 *
 * @module src/skills/schemas
 */

import { z } from 'zod';

// =============================================================================
// Input Validation Constants
// =============================================================================

/** Maximum length for project path strings */
const MAX_PROJECT_PATH_LENGTH = 500;

/** Maximum length for timestamp strings (ISO-8601 with timezone) */
const MAX_TIMESTAMP_LENGTH = 30;

/** Maximum length for session ID strings (UUID format) */
const MAX_SESSION_ID_LENGTH = 50;

/** Maximum length for skill name strings */
const MAX_SKILL_NAME_LENGTH = 100;

/** Default limit for query results */
const DEFAULT_LIMIT = 100;

/** Maximum limit for query results */
const MAX_LIMIT = 500;

// =============================================================================
// Tool Input Schemas
// =============================================================================

/**
 * Input for get_skill_inventory tool.
 */
export const GetSkillInventoryInputSchema = z.object({
  projectPath: z
    .string()
    .max(
      MAX_PROJECT_PATH_LENGTH,
      `Project path cannot exceed ${MAX_PROJECT_PATH_LENGTH} characters`
    )
    .optional(),
});

/**
 * Input for get_skill_invocations tool.
 */
export const GetSkillInvocationsInputSchema = z.object({
  skillName: z
    .string()
    .max(MAX_SKILL_NAME_LENGTH, `Skill name cannot exceed ${MAX_SKILL_NAME_LENGTH} characters`)
    .optional(),
  sessionId: z
    .string()
    .max(MAX_SESSION_ID_LENGTH, `Session ID cannot exceed ${MAX_SESSION_ID_LENGTH} characters`)
    .optional(),
  since: z
    .string()
    .max(MAX_TIMESTAMP_LENGTH, `Timestamp cannot exceed ${MAX_TIMESTAMP_LENGTH} characters`)
    .optional(),
  until: z
    .string()
    .max(MAX_TIMESTAMP_LENGTH, `Timestamp cannot exceed ${MAX_TIMESTAMP_LENGTH} characters`)
    .optional(),
  limit: z.number().int().positive().max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.number().int().nonnegative().default(0),
});

/**
 * Input for get_session_summaries tool.
 */
export const GetSessionSummariesInputSchema = z.object({
  since: z
    .string()
    .max(MAX_TIMESTAMP_LENGTH, `Timestamp cannot exceed ${MAX_TIMESTAMP_LENGTH} characters`)
    .optional(),
  until: z
    .string()
    .max(MAX_TIMESTAMP_LENGTH, `Timestamp cannot exceed ${MAX_TIMESTAMP_LENGTH} characters`)
    .optional(),
  projectPath: z
    .string()
    .max(
      MAX_PROJECT_PATH_LENGTH,
      `Project path cannot exceed ${MAX_PROJECT_PATH_LENGTH} characters`
    )
    .optional(),
  limit: z.number().int().positive().max(MAX_LIMIT).default(50),
});

/**
 * Input for index_skill_invocations tool.
 */
export const IndexSkillInvocationsInputSchema = z.object({
  projectPath: z
    .string()
    .max(
      MAX_PROJECT_PATH_LENGTH,
      `Project path cannot exceed ${MAX_PROJECT_PATH_LENGTH} characters`
    )
    .optional(),
  force: z.boolean().default(false),
});

// =============================================================================
// Output Schemas
// =============================================================================

/**
 * A skill defined in .claude/skills/ directory.
 */
export const SkillInventoryItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  path: z.string(),
  filePatterns: z.array(z.string()),
  contentSections: z.array(z.string()),
  userInvocable: z.boolean(),
});

/**
 * Result from get_skill_inventory tool.
 */
export const GetSkillInventoryResultSchema = z.object({
  skills: z.array(SkillInventoryItemSchema),
  discoveryPath: z.string(),
  skillCount: z.number().int().nonnegative(),
  queryTimeMs: z.number().nonnegative(),
});

/**
 * A single skill invocation from session logs.
 */
export const SkillInvocationRecordSchema = z.object({
  skillName: z.string(),
  sessionId: z.string(),
  timestamp: z.string(),
  userPromptSnippet: z.string(),
});

/**
 * Result from get_skill_invocations tool.
 */
export const GetSkillInvocationsResultSchema = z.object({
  invocations: z.array(SkillInvocationRecordSchema),
  totalCount: z.number().int().nonnegative(),
  uniqueSkills: z.number().int().nonnegative(),
  sessionsQueried: z.number().int().nonnegative(),
  filters: z.object({
    skillName: z.string().optional(),
    sessionId: z.string().optional(),
    since: z.string().optional(),
    until: z.string().optional(),
  }),
  queryTimeMs: z.number().nonnegative(),
});

/**
 * Summarized session data for agent reasoning.
 */
export const SessionSummarySchema = z.object({
  sessionId: z.string(),
  timestamp: z.string(),
  firstUserPrompt: z.string(),
  filesOperated: z.array(z.string()),
  skillsInvoked: z.array(z.string()),
  turnCount: z.number().int().nonnegative(),
});

/**
 * Result from get_session_summaries tool.
 */
export const GetSessionSummariesResultSchema = z.object({
  sessions: z.array(SessionSummarySchema),
  totalSessions: z.number().int().nonnegative(),
  filters: z.object({
    since: z.string().optional(),
    until: z.string().optional(),
    projectPath: z.string().optional(),
  }),
  queryTimeMs: z.number().nonnegative(),
});

/**
 * Result from index_skill_invocations tool.
 */
export const IndexSkillInvocationsResultSchema = z.object({
  sessionsIndexed: z.number().int().nonnegative(),
  invocationsFound: z.number().int().nonnegative(),
  newSinceLastIndex: z.number().int().nonnegative(),
  indexedAt: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
});

// =============================================================================
// Database Row Schemas (Internal)
// =============================================================================

/**
 * Skill invocation row in SQLite database.
 * @internal
 */
export const SkillInvocationRowSchema = z.object({
  id: z.number().int(),
  session_id: z.string(),
  skill_name: z.string(),
  timestamp: z.string(),
  user_prompt_snippet: z.string().nullable(),
  file_path: z.string().nullable(),
  line_number: z.number().int().nullable(),
});

// =============================================================================
// Inferred Types
// =============================================================================

export type GetSkillInventoryInputZ = z.infer<typeof GetSkillInventoryInputSchema>;
export type GetSkillInvocationsInputZ = z.infer<typeof GetSkillInvocationsInputSchema>;
export type GetSessionSummariesInputZ = z.infer<typeof GetSessionSummariesInputSchema>;
export type IndexSkillInvocationsInputZ = z.infer<typeof IndexSkillInvocationsInputSchema>;
export type SkillInventoryItemZ = z.infer<typeof SkillInventoryItemSchema>;
export type GetSkillInventoryResultZ = z.infer<typeof GetSkillInventoryResultSchema>;
export type SkillInvocationRecordZ = z.infer<typeof SkillInvocationRecordSchema>;
export type GetSkillInvocationsResultZ = z.infer<typeof GetSkillInvocationsResultSchema>;
export type SessionSummaryZ = z.infer<typeof SessionSummarySchema>;
export type GetSessionSummariesResultZ = z.infer<typeof GetSessionSummariesResultSchema>;
export type IndexSkillInvocationsResultZ = z.infer<typeof IndexSkillInvocationsResultSchema>;
export type SkillInvocationRowZ = z.infer<typeof SkillInvocationRowSchema>;
