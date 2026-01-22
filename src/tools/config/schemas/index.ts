/**
 * ACT Format Schemas - Index
 *
 * Exports all validation schemas for Claude Code artifact formats.
 *
 * @module tools/config/schemas
 */

export {
  AgentFrontmatterSchema,
  SkillFrontmatterSchema,
  ModelSchema,
  FRONTMATTER_REQUIRED_TYPES,
  getSchemaForConfigType,
  requiresFrontmatter,
  type AgentFrontmatter,
  type SkillFrontmatter,
} from './act-schemas';
