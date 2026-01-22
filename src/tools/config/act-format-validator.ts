/**
 * ACT Format Validator - Static validation for Claude Code artifact formats
 *
 * Validates:
 * - Frontmatter presence for types that require it (agents, skills)
 * - Required field validation for skills (name, description)
 * - Field value validation against Zod schemas
 *
 * @module tools/config/act-format-validator
 */

import type { ZodError } from 'zod';
import type { ConfigType, IssueType, IssueSeverity } from '../types';
import type { QualityIssue, Position } from './types';
import { requiresFrontmatter, getSchemaForConfigType } from './schemas';

/**
 * Input for ACT format validation.
 */
export interface ACTFormatValidationInput {
  /** Type of configuration file */
  configType: ConfigType;
  /** Path to the file (for error messages) */
  filePath: string;
  /** Raw file content */
  content: string;
  /** Parsed frontmatter (if present) */
  frontmatter?: Record<string, unknown>;
  /** Whether the file has frontmatter */
  hasFrontmatter: boolean;
}

/**
 * Result from ACT format validation.
 */
export interface ACTFormatValidationResult {
  /** Quality issues found */
  issues: QualityIssue[];
  /** Whether validation passed (no issues) */
  isValid: boolean;
}

/**
 * Human-readable names for config types.
 */
const CONFIG_TYPE_NAMES: Partial<Record<ConfigType, string>> = {
  'claude-agent': 'Agent',
  'skill-md': 'Skill',
};

/**
 * Validates ACT format requirements for a configuration file.
 *
 * This function performs static validation to ensure:
 * 1. Files that require frontmatter have it
 * 2. Required fields are present
 * 3. Field values match expected schemas
 *
 * @param input - Validation input containing file info and parsed data
 * @returns Validation result with any issues found
 *
 * @example
 * ```typescript
 * const result = validateACTFormat({
 *   configType: 'claude-agent',
 *   filePath: '.claude/agents/my-agent.md',
 *   content: '# My Agent\nDoes something.',
 *   hasFrontmatter: false,
 * });
 *
 * if (!result.isValid) {
 *   console.log('Issues found:', result.issues);
 * }
 * ```
 */
export function validateACTFormat(input: ACTFormatValidationInput): ACTFormatValidationResult {
  const issues: QualityIssue[] = [];
  const { configType, filePath, hasFrontmatter, frontmatter } = input;

  // Check if frontmatter is required but missing
  if (requiresFrontmatter(configType) && !hasFrontmatter) {
    const typeName = CONFIG_TYPE_NAMES[configType] ?? configType;
    issues.push(createMissingFrontmatterIssue(filePath, typeName));
    // Return early - can't validate schema if frontmatter is missing
    return { issues, isValid: false };
  }

  // If frontmatter exists, validate against schema
  if (hasFrontmatter && frontmatter !== undefined) {
    const schema = getSchemaForConfigType(configType);
    if (schema) {
      const schemaIssues = validateFrontmatterSchema(filePath, configType, frontmatter, schema);
      issues.push(...schemaIssues);
    }
  }

  return {
    issues,
    isValid: issues.length === 0,
  };
}

/**
 * Creates a missing-frontmatter issue.
 */
function createMissingFrontmatterIssue(filePath: string, typeName: string): QualityIssue {
  return {
    id: `missing-frontmatter-${hashPath(filePath)}`,
    type: 'missing-frontmatter' as IssueType,
    severity: 'high' as IssueSeverity,
    message: `${typeName} file is missing required YAML frontmatter`,
    position: createStartPosition(),
    suggestion: `Add YAML frontmatter at the beginning of the file:\n\`\`\`yaml\n---\n# frontmatter fields here\n---\n\`\`\``,
  };
}

/**
 * Validates frontmatter against its schema and returns any issues.
 */
function validateFrontmatterSchema(
  filePath: string,
  configType: ConfigType,
  frontmatter: Record<string, unknown>,
  schema: ReturnType<typeof getSchemaForConfigType>
): QualityIssue[] {
  if (!schema) {
    return [];
  }

  const issues: QualityIssue[] = [];

  try {
    schema.parse(frontmatter);
  } catch (error) {
    if (isZodError(error)) {
      for (const zodIssue of error.errors) {
        const issue = zodErrorToQualityIssue(filePath, configType, zodIssue);
        issues.push(issue);
      }
    } else {
      // Generic parse error
      issues.push({
        id: `invalid-frontmatter-${hashPath(filePath)}`,
        type: 'invalid-frontmatter' as IssueType,
        severity: 'high' as IssueSeverity,
        message: `Frontmatter validation failed: ${error instanceof Error ? error.message : String(error)}`,
        position: createStartPosition(),
        suggestion: 'Ensure frontmatter follows the expected format for this file type.',
      });
    }
  }

  return issues;
}

/**
 * Type guard for ZodError.
 */
function isZodError(error: unknown): error is ZodError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'errors' in error &&
    Array.isArray((error as ZodError).errors)
  );
}

/**
 * Converts a Zod validation issue to a QualityIssue.
 */
function zodErrorToQualityIssue(
  filePath: string,
  configType: ConfigType,
  zodIssue: ZodError['errors'][0]
): QualityIssue {
  const path = zodIssue.path.join('.');
  const typeName = CONFIG_TYPE_NAMES[configType] ?? configType;

  // Determine issue type based on Zod error code
  let issueType: IssueType;
  let severity: IssueSeverity;

  if (zodIssue.code === 'invalid_type' && zodIssue.received === 'undefined') {
    // Missing required field
    issueType = 'missing-required-field';
    severity = 'high';
  } else {
    // Invalid field value
    issueType = 'invalid-field-value';
    severity = 'medium';
  }

  const fieldPath = path || 'root';
  const id = `${issueType}-${fieldPath}-${hashPath(filePath)}`;

  return {
    id,
    type: issueType,
    severity,
    message: `${typeName} frontmatter: ${zodIssue.message}${path ? ` (field: ${path})` : ''}`,
    position: createStartPosition(),
    suggestion: getSuggestionForZodIssue(configType, zodIssue),
  };
}

/**
 * Gets a helpful suggestion based on the Zod issue.
 */
function getSuggestionForZodIssue(
  configType: ConfigType,
  zodIssue: ZodError['errors'][0]
): string {
  const path = zodIssue.path.join('.');

  // Skill-specific suggestions
  if (configType === 'skill-md') {
    if (path === 'name') {
      return 'Add a `name` field to the frontmatter (max 64 characters).';
    }
    if (path === 'description') {
      return 'Add a `description` field to the frontmatter (max 1024 characters).';
    }
  }

  // Agent-specific suggestions
  if (configType === 'claude-agent') {
    if (path === 'model') {
      return 'Use a valid model value: "sonnet", "opus", "haiku", or a full model ID like "claude-sonnet-4-20250514".';
    }
  }

  // Generic suggestion
  return `Fix the "${path}" field: ${zodIssue.message}`;
}

/**
 * Creates a position pointing to the start of the file (where frontmatter should be).
 */
function createStartPosition(): Position {
  return {
    start: { line: 1, column: 1 },
    end: { line: 1, column: 1 },
  };
}

/**
 * Simple hash function for generating unique IDs from file paths.
 */
function hashPath(filePath: string): string {
  let hash = 0;
  for (let i = 0; i < filePath.length; i++) {
    const char = filePath.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 6);
}
