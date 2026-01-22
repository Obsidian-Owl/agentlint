/**
 * ACT Format Schemas - Zod validation schemas for Claude Code artifact frontmatter
 *
 * Defines validation schemas for:
 * - Agent files (.claude/agents/[name].md) - requires frontmatter, model field optional
 * - Skill files (.claude/skills/[name]/SKILL.md) - requires frontmatter with name/description
 *
 * @module tools/config/schemas/act-schemas
 */

import { z } from 'zod';
import type { ConfigType } from '../../types';

/**
 * Valid model values for Claude Code configurations.
 * Accepts shorthand names or full model IDs starting with "claude-".
 */
export const ModelSchema = z
  .enum(['sonnet', 'opus', 'haiku'])
  .or(z.string().regex(/^claude-/, 'Model ID must start with "claude-"'));

/**
 * Agent frontmatter schema.
 *
 * Agent files (.claude/agents/[name].md) MUST have YAML frontmatter,
 * but all fields within the frontmatter are optional (though recommended).
 *
 * @example
 * ```yaml
 * ---
 * model: sonnet
 * ---
 * ```
 */
export const AgentFrontmatterSchema = z
  .object({
    model: ModelSchema.optional().describe('Model to use for this agent'),
  })
  .passthrough(); // Allow unknown fields for future extensibility

/**
 * Skill frontmatter schema.
 *
 * Skill files (.claude/skills/[name]/SKILL.md) MUST have YAML frontmatter
 * with required `name` and `description` fields.
 *
 * @example
 * ```yaml
 * ---
 * name: my-skill
 * description: A skill that does something useful
 * allowed_tools:
 *   - Read
 *   - Glob
 * user_invocable: true
 * ---
 * ```
 */
export const SkillFrontmatterSchema = z.object({
  name: z
    .string()
    .min(1, 'Skill name is required')
    .max(64, 'Skill name must be 64 characters or less'),
  description: z
    .string()
    .min(1, 'Skill description is required')
    .max(1024, 'Skill description must be 1024 characters or less'),
  allowed_tools: z.array(z.string()).optional().describe('List of tools this skill can use'),
  model: z.string().optional().describe('Model to use for this skill'),
  user_invocable: z.boolean().optional().default(true).describe('Whether user can invoke via slash command'),
  disable_model_invocation: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to block programmatic invocation'),
});

/**
 * Config types that require YAML frontmatter.
 */
export const FRONTMATTER_REQUIRED_TYPES: readonly ConfigType[] = [
  'claude-agent',
  'skill-md',
] as const;

/**
 * Get the appropriate schema for a given config type.
 *
 * @param configType - The type of configuration file
 * @returns Zod schema for frontmatter validation, or null if no schema applies
 */
export function getSchemaForConfigType(
  configType: ConfigType
): z.ZodType<Record<string, unknown>> | null {
  switch (configType) {
    case 'claude-agent':
      return AgentFrontmatterSchema;
    case 'skill-md':
      return SkillFrontmatterSchema;
    default:
      return null;
  }
}

/**
 * Check if a config type requires frontmatter.
 *
 * @param configType - The type of configuration file
 * @returns True if the config type requires frontmatter
 */
export function requiresFrontmatter(configType: ConfigType): boolean {
  return (FRONTMATTER_REQUIRED_TYPES as readonly string[]).includes(configType);
}

/**
 * Type for agent frontmatter.
 */
export type AgentFrontmatter = z.infer<typeof AgentFrontmatterSchema>;

/**
 * Type for skill frontmatter.
 */
export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;
