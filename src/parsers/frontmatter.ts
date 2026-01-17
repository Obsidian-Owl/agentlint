/**
 * YAML frontmatter parser
 *
 * T015: Extracts and parses YAML frontmatter from markdown files (SKILL.md).
 *
 * @module parsers/frontmatter
 */

import YAML from 'yaml';
import type { Position, ParseWarning, WarningCode } from '../tools/config/types';

/**
 * Options for frontmatter parsing.
 */
export interface FrontmatterParseOptions {
  /** Fields that must be present */
  requiredFields?: string[];
  /** Maximum name field length */
  maxNameLength?: number;
  /** Maximum description field length */
  maxDescriptionLength?: number;
}

/**
 * Result of parsing frontmatter.
 */
export interface FrontmatterParseResult {
  /** Whether frontmatter was found */
  hasFrontmatter: boolean;
  /** Parsed frontmatter data */
  frontmatter?: Record<string, unknown>;
  /** Content without frontmatter */
  content: string;
  /** Position of frontmatter in source */
  frontmatterPosition?: Position;
  /** Parse warnings */
  warnings: ParseWarning[];
}

/**
 * Frontmatter delimiter pattern.
 */
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Parse YAML frontmatter from markdown content.
 *
 * @param content - Full markdown content
 * @param options - Parsing options
 * @returns Parsed frontmatter result
 */
export async function parseFrontmatter(
  content: string,
  options: FrontmatterParseOptions = {}
): Promise<FrontmatterParseResult> {
  return parseFrontmatterSync(content, options);
}

/**
 * Parse YAML frontmatter synchronously.
 *
 * @param content - Full markdown content
 * @param options - Parsing options
 * @returns Parsed frontmatter result
 */
export function parseFrontmatterSync(
  content: string,
  options: FrontmatterParseOptions = {}
): FrontmatterParseResult {
  const warnings: ParseWarning[] = [];

  // Handle empty content
  if (!content || content.trim() === '') {
    return {
      hasFrontmatter: false,
      content: content || '',
      warnings,
    };
  }

  // Check for frontmatter pattern
  const match = content.match(FRONTMATTER_REGEX);

  if (!match) {
    // Check for unclosed frontmatter
    if (content.startsWith('---\n') || content.startsWith('---\r\n')) {
      const hasClosing = content.includes('\n---\n') || content.includes('\r\n---\r\n');
      if (!hasClosing) {
        warnings.push({
          code: 'INVALID_FRONTMATTER' as WarningCode,
          message: 'Frontmatter started but never closed',
          position: { start: { line: 1, column: 1 }, end: { line: 1, column: 4 } },
          recoverable: true,
        });
      }
    }

    return {
      hasFrontmatter: false,
      content,
      warnings,
    };
  }

  const yamlContent = match[1] ?? '';
  const restContent = content.slice(match[0].length);

  // Calculate frontmatter position
  const yamlLines = yamlContent.split('\n');
  const frontmatterPosition: Position = {
    start: { line: 1, column: 1, offset: 0 },
    end: {
      line: yamlLines.length + 2, // +2 for opening and closing ---
      column: 4,
      offset: match[0].length,
    },
  };

  // Handle empty frontmatter
  if (yamlContent.trim() === '') {
    return {
      hasFrontmatter: true,
      frontmatter: {},
      content: restContent,
      frontmatterPosition,
      warnings,
    };
  }

  // Parse YAML
  let frontmatter: Record<string, unknown> | undefined;
  try {
    const parsed = YAML.parse(yamlContent);

    // Ensure it's an object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      warnings.push({
        code: 'INVALID_YAML' as WarningCode,
        message: 'Frontmatter must be a YAML object',
        position: frontmatterPosition,
        recoverable: true,
      });
      return {
        hasFrontmatter: true,
        content: restContent,
        frontmatterPosition,
        warnings,
      };
    }

    frontmatter = parsed as Record<string, unknown>;
  } catch (error) {
    warnings.push({
      code: 'INVALID_YAML' as WarningCode,
      message: `Failed to parse YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`,
      position: frontmatterPosition,
      recoverable: true,
    });
    return {
      hasFrontmatter: true,
      content: restContent,
      frontmatterPosition,
      warnings,
    };
  }

  // Validate required fields
  if (options.requiredFields) {
    for (const field of options.requiredFields) {
      if (!(field in frontmatter)) {
        warnings.push({
          code: 'MISSING_REQUIRED_FIELD' as WarningCode,
          message: `Missing required field: ${field}`,
          position: frontmatterPosition,
          recoverable: true,
        });
      }
    }
  }

  // Validate name length
  if (options.maxNameLength && typeof frontmatter.name === 'string') {
    if (frontmatter.name.length > options.maxNameLength) {
      warnings.push({
        code: 'INVALID_FRONTMATTER' as WarningCode,
        message: `Name field exceeds maximum length of ${options.maxNameLength} characters`,
        position: frontmatterPosition,
        recoverable: true,
      });
    }
  }

  // Validate description length
  if (options.maxDescriptionLength && typeof frontmatter.description === 'string') {
    if (frontmatter.description.length > options.maxDescriptionLength) {
      warnings.push({
        code: 'INVALID_FRONTMATTER' as WarningCode,
        message: `Description field exceeds maximum length of ${options.maxDescriptionLength} characters`,
        position: frontmatterPosition,
        recoverable: true,
      });
    }
  }

  return {
    hasFrontmatter: true,
    frontmatter,
    content: restContent,
    frontmatterPosition,
    warnings,
  };
}
