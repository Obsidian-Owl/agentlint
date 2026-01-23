/**
 * EP03 Persistence Layer - Zod Validation Schemas
 *
 * Provides runtime validation schemas for persistence entities.
 * These schemas enable best-effort parsing of stored data with
 * proper error handling for schema evolution.
 *
 * @module persistence/schemas
 */

import { z } from 'zod';

// =============================================================================
// Baseline Schemas
// =============================================================================

/**
 * Schema for baseline metrics.
 * Includes optional EP09 and EP14 extended metrics for backward compatibility.
 */
export const BaselineMetricsSchema = z.object({
  // Core metrics
  findingsCount: z.number().int().nonnegative(),
  criticalCount: z.number().int().nonnegative(),
  highCount: z.number().int().nonnegative(),
  mediumCount: z.number().int().nonnegative(),
  lowCount: z.number().int().nonnegative(),
  infoCount: z.number().int().nonnegative(),

  // EP09 Extended Metrics (optional)
  avgTokensPerSession: z.number().nonnegative().optional(),
  avgIterationsPerSession: z.number().nonnegative().optional(),
  sessionCount: z.number().int().nonnegative().optional(),
  errorRate: z.number().min(0).max(1).optional(),
  configTokens: z.number().int().nonnegative().optional(),
  configLines: z.number().int().nonnegative().optional(),
  warningCount: z.number().int().nonnegative().optional(),
  sectionCount: z.number().int().nonnegative().optional(),
  coverageScore: z.number().min(0).max(100).optional(),

  // EP14 Skills Effectiveness Metrics (optional)
  skillInvocationCount: z.number().int().nonnegative().optional(),
  uniqueSkillsUsed: z.number().int().nonnegative().optional(),
  sessionsWithSkillUsage: z.number().int().nonnegative().optional(),
  skillsDefinedCount: z.number().int().nonnegative().optional(),
});

/**
 * Schema for finding severity.
 */
export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);

/**
 * Schema for finding type.
 */
export const FindingTypeSchema = z.enum([
  'config_gap',
  'config_antipattern',
  'session_pattern',
  'session_error',
  'quality_issue',
  'improvement',
]);

/**
 * Schema for a finding's location.
 */
export const LocationSchema = z.object({
  file: z.string(),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
  snippet: z.string().optional(),
});

/**
 * Schema for a finding's origin.
 */
export const OriginSchema = z.object({
  type: z.enum(['config', 'session', 'git']),
  reference: z.string(),
  timestamp: z.string().optional(),
  description: z.string(),
});

/**
 * Schema for a recommendation.
 */
export const RecommendationSchema = z.object({
  type: z.enum(['symptomatic', 'preventive', 'systemic']),
  action: z.string(),
  rationale: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  effort: z.enum(['trivial', 'small', 'medium', 'large']).optional(),
});

/**
 * Schema for a finding.
 */
export const FindingSchema = z.object({
  id: z.string().uuid(),
  type: FindingTypeSchema,
  severity: SeveritySchema,
  title: z.string(),
  description: z.string(),
  location: LocationSchema.nullable(),
  origin: OriginSchema.nullable(),
  recommendations: z.array(RecommendationSchema),
  metadata: z.record(z.unknown()).optional(),
  detectedAt: z.string(),
  detectedInPhase: z.string(),
});

/**
 * Schema for a baseline.
 */
export const BaselineSchema = z.object({
  id: z.string().uuid(),
  version: z.string(),
  createdAt: z.string(),
  projectPath: z.string(),
  actType: z.string(),
  configPath: z.string().nullable(),
  gitCommit: z.string().nullable(),
  metrics: BaselineMetricsSchema,
  findings: z.array(FindingSchema),
  label: z.string().nullable(),
  notes: z.string().nullable(),
});

/**
 * Schema for baseline file format.
 */
export const BaselineFileSchema = z.object({
  version: z.string(),
  baseline: BaselineSchema,
});

// =============================================================================
// Learning Schemas
// =============================================================================

/**
 * Schema for learning category.
 */
export const LearningCategorySchema = z.enum(['patterns', 'anti-patterns', 'tools', 'workflows']);

/**
 * Schema for learning scope.
 */
export const LearningScopeSchema = z.enum(['project', 'global']);

/**
 * Schema for learning origin.
 */
export const LearningOriginSchema = z.object({
  project: z.string().optional(),
  sessionId: z.string().optional(),
  promotedAt: z.string().optional(),
});

/**
 * Schema for a learning.
 */
export const LearningSchema = z.object({
  id: z.string().uuid(),
  version: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  category: LearningCategorySchema,
  scope: LearningScopeSchema,
  origin: LearningOriginSchema.optional(),
});

/**
 * Schema for creating a learning.
 */
export const CreateLearningInputSchema = z.object({
  title: z.string().min(1),
  content: z.string(),
  tags: z.array(z.string()).optional(),
  category: LearningCategorySchema,
  scope: LearningScopeSchema,
  origin: LearningOriginSchema.optional(),
});

// =============================================================================
// Session State Schemas
// =============================================================================

/**
 * Schema for tool result cache entry.
 */
export const ToolResultSchema = z.object({
  toolName: z.string(),
  input: z.unknown(),
  output: z.unknown(),
  timestamp: z.string(),
  durationMs: z.number().nonnegative(),
});

/**
 * Schema for project context.
 */
export const ProjectContextSchema = z.object({
  name: z.string(),
  path: z.string(),
  hasClaudeMd: z.boolean(),
  primaryLanguage: z.string().nullable(),
  agentType: z.string(),
});

/**
 * Schema for session state.
 */
export const SessionStateSchema = z.object({
  id: z.string(),
  phase: z.string(),
  startedAt: z.string(),
  lastCheckpointAt: z.string().nullable(),
  findings: z.array(FindingSchema),
  toolResultCache: z.record(ToolResultSchema),
  checkpointSequence: z.number().int().nonnegative(),
  taskGoal: z.string(),
  projectContext: ProjectContextSchema,
});

/**
 * Schema for session state file.
 * Uses z.string() for version to allow best-effort parsing with version warnings.
 */
export const SessionStateFileSchema = z.object({
  version: z.string(),
  sessionState: SessionStateSchema,
});

// =============================================================================
// Query Option Schemas
// =============================================================================

/**
 * Schema for baseline query options.
 */
export const BaselineQueryOptionsSchema = z.object({
  label: z.string().optional(),
  after: z.string().optional(),
  before: z.string().optional(),
  gitCommit: z.string().optional(),
  limit: z.number().int().positive().optional(),
  orderBy: z.enum(['createdAt', 'findingsCount']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

/**
 * Schema for learning query options.
 */
export const LearningQueryOptionsSchema = z.object({
  category: LearningCategorySchema.optional(),
  scope: LearningScopeSchema.optional(),
  tag: z.string().optional(),
  limit: z.number().int().positive().optional(),
  orderBy: z.enum(['createdAt', 'updatedAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// =============================================================================
// Parsing Helpers
// =============================================================================

/**
 * Parse a baseline file with best-effort validation.
 * Returns null if parsing completely fails.
 */
export function parseBaselineFile(data: unknown): z.infer<typeof BaselineFileSchema> | null {
  const result = BaselineFileSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Parse a baseline with best-effort validation.
 */
export function parseBaseline(data: unknown): z.infer<typeof BaselineSchema> | null {
  const result = BaselineSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Parse a learning with best-effort validation.
 */
export function parseLearning(data: unknown): z.infer<typeof LearningSchema> | null {
  const result = LearningSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Parse a session state file with best-effort validation.
 */
export function parseSessionStateFile(
  data: unknown
): z.infer<typeof SessionStateFileSchema> | null {
  const result = SessionStateFileSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Parse a session state with best-effort validation.
 */
export function parseSessionState(data: unknown): z.infer<typeof SessionStateSchema> | null {
  const result = SessionStateSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate and return parsing errors for debugging.
 */
export function validateBaseline(data: unknown): { success: boolean; errors?: z.ZodError } {
  const result = BaselineSchema.safeParse(data);
  return result.success ? { success: true } : { success: false, errors: result.error };
}

/**
 * Validate and return parsing errors for learning.
 */
export function validateLearning(data: unknown): { success: boolean; errors?: z.ZodError } {
  const result = LearningSchema.safeParse(data);
  return result.success ? { success: true } : { success: false, errors: result.error };
}
