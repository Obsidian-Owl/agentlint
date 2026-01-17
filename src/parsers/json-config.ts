/**
 * JSON configuration parser
 *
 * T017: Parses and validates .claude/settings.json files.
 *
 * @module parsers/json-config
 */

import { z } from 'zod';
import type { Position, ParseWarning } from '../tools/config/types';

/**
 * Known Claude models for validation.
 */
const KNOWN_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
] as const;

/**
 * Zod schema for settings.json permissions.
 */
const PermissionsSchema = z
  .object({
    allow_file_write: z.boolean().optional(),
    allow_shell_commands: z.boolean().optional(),
    allow_mcp_servers: z.boolean().optional(),
  })
  .passthrough();

/**
 * Zod schema for settings.json context.
 */
const ContextSchema = z
  .object({
    max_tokens: z.number().int().positive().max(200000).optional(),
  })
  .passthrough();

/**
 * Zod schema for settings.json.
 */
const SettingsSchema = z
  .object({
    model: z.string().optional(),
    permissions: PermissionsSchema.optional(),
    context: ContextSchema.optional(),
  })
  .passthrough();

/**
 * Parsed settings configuration.
 */
export type SettingsConfig = z.infer<typeof SettingsSchema>;

/**
 * Options for JSON config parsing.
 */
export interface JsonConfigParseOptions {
  /** Validate against settings schema */
  validateSchema?: boolean;
  /** Strict mode - warn on unknown fields */
  strict?: boolean;
  /** Validate model names against known list */
  validateModelNames?: boolean;
}

/**
 * Successful parse result.
 */
export interface JsonConfigSuccess {
  success: true;
  config: SettingsConfig;
  raw: string;
  validationErrors: string[];
  warnings: ParseWarning[];
}

/**
 * Failed parse result.
 */
export interface JsonConfigFailure {
  success: false;
  raw: string;
  error: {
    message: string;
    position?: Position;
    suggestion?: string;
  };
}

/**
 * Result of parsing JSON config.
 */
export type JsonConfigParseResult = JsonConfigSuccess | JsonConfigFailure;

/**
 * Attempt to extract error position from JSON parse error.
 */
function extractErrorPosition(error: unknown, content: string): Position | undefined {
  if (!(error instanceof SyntaxError)) return undefined;

  // Try to extract position from error message
  const message = error.message;

  // Common patterns: "at position X", "at line Y column Z"
  const posMatch = message.match(/position\s+(\d+)/i);
  if (posMatch) {
    const offset = parseInt(posMatch[1] ?? '0', 10);
    const lines = content.slice(0, offset).split('\n');
    const line = lines.length;
    const column = (lines[lines.length - 1]?.length ?? 0) + 1;
    return {
      start: { line, column, offset },
      end: { line, column: column + 1, offset: offset + 1 },
    };
  }

  return undefined;
}

/**
 * Get suggestion for common JSON errors.
 */
function getSuggestion(error: unknown): string {
  if (!(error instanceof SyntaxError)) return 'Check JSON syntax';

  const message = error.message.toLowerCase();

  if (message.includes('unexpected token')) {
    return 'Check for missing commas, quotes, or brackets';
  }
  if (message.includes('unexpected end')) {
    return 'Check for unclosed brackets or braces';
  }
  if (message.includes('expected')) {
    return 'Ensure all keys are quoted and values are valid JSON';
  }

  return 'Validate JSON syntax at jsonlint.com';
}

/**
 * Parse JSON configuration file.
 *
 * @param content - JSON content to parse
 * @param options - Parsing options
 * @returns Parse result
 */
export async function parseJsonConfig(
  content: string,
  options: JsonConfigParseOptions = {}
): Promise<JsonConfigParseResult> {
  return await Promise.resolve(parseJsonConfigSync(content, options));
}

/**
 * Parse JSON configuration file synchronously.
 *
 * @param content - JSON content to parse
 * @param options - Parsing options
 * @returns Parse result
 */
export function parseJsonConfigSync(
  content: string,
  options: JsonConfigParseOptions = {}
): JsonConfigParseResult {
  const warnings: ParseWarning[] = [];
  const validationErrors: string[] = [];

  // Handle empty/whitespace content
  if (!content || content.trim() === '') {
    return {
      success: false,
      raw: content || '',
      error: {
        message: 'Empty content is not valid JSON',
        suggestion: 'Provide a valid JSON object like {}',
      },
    };
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const errorObj: JsonConfigFailure['error'] = {
      message: `JSON parse error: ${error instanceof Error ? error.message : String(error)}`,
      suggestion: getSuggestion(error),
    };
    const pos = extractErrorPosition(error, content);
    if (pos) errorObj.position = pos;
    return {
      success: false,
      raw: content,
      error: errorObj,
    };
  }

  // Check it's an object
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      success: false,
      raw: content,
      error: {
        message: 'Settings must be a JSON object',
        suggestion: 'Wrap content in curly braces: { ... }',
      },
    };
  }

  const config = parsed as SettingsConfig;

  // Schema validation
  if (options.validateSchema) {
    const result = SettingsSchema.safeParse(parsed);
    if (!result.success) {
      for (const issue of result.error.issues) {
        validationErrors.push(`${issue.path.join('.')}: ${issue.message}`);
      }
    }
  }

  // Strict mode - check for unknown fields
  if (options.strict) {
    const knownFields = ['model', 'permissions', 'context'];
    for (const key of Object.keys(config)) {
      if (!knownFields.includes(key)) {
        warnings.push({
          code: 'INVALID_FRONTMATTER', // Reusing code for unknown field
          message: `Unknown field: ${key}`,
          recoverable: true,
        });
      }
    }
  }

  // Model name validation
  if (options.validateModelNames && config.model) {
    if (!KNOWN_MODELS.includes(config.model as (typeof KNOWN_MODELS)[number])) {
      warnings.push({
        code: 'INVALID_FRONTMATTER',
        message: `Unknown model name: ${config.model}. Known models: ${KNOWN_MODELS.join(', ')}`,
        recoverable: true,
      });
    }
  }

  // Max tokens range validation
  if (config.context?.max_tokens !== undefined) {
    const maxTokens = config.context.max_tokens;
    if (typeof maxTokens === 'number' && maxTokens > 200000) {
      warnings.push({
        code: 'INVALID_FRONTMATTER',
        message: `max_tokens value ${maxTokens} exceeds typical maximum of 200000`,
        recoverable: true,
      });
    }
  }

  return {
    success: true,
    config,
    raw: content,
    validationErrors,
    warnings,
  };
}
