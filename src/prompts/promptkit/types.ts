/**
 * PromptKit Core Types
 *
 * SDK-agnostic prompt intermediate representation (IR) for agentlint.
 * Prompts are defined as PromptSpec instances that render to PromptMessage arrays.
 * Adapters convert these to provider-specific formats.
 *
 * @module prompts/promptkit/types
 */

import { z } from 'zod';

/**
 * Message role in the prompt conversation.
 * - 'system': System-level instructions (personality, rules, context)
 * - 'developer': Developer-level instructions (SDK-specific, tool guidance)
 * - 'user': User-facing message content
 */
export type PromptRole = 'system' | 'developer' | 'user';

/**
 * A single message in a prompt conversation.
 */
export interface PromptMessage {
  role: PromptRole;
  content: string;
}

/**
 * Metadata for a prompt specification.
 * Used for version tracking, telemetry, and learning over time.
 */
export interface PromptMetadata {
  /** Unique identifier for the prompt (e.g., "analysis/main", "welcome/system") */
  id: string;
  /** Semantic version (e.g., "1.0.0") */
  version: string;
  /** ISO 8601 timestamp when this version was created */
  createdAt: string;
  /** Human-readable description of the prompt's purpose */
  description: string;
  /** Optional tags for categorization (e.g., ["welcome", "tui"]) */
  tags?: string[] | undefined;
}

/**
 * A prompt specification that can render to provider-agnostic messages.
 *
 * @typeParam TCtx - Context type required for rendering (e.g., WelcomeContext, AnalysisContext)
 *
 * @example
 * ```typescript
 * const welcomePrompt: PromptSpec<WelcomeContext> = {
 *   id: 'welcome/system',
 *   version: '1.0.0',
 *   createdAt: '2026-01-27T00:00:00Z',
 *   description: 'Welcome message system prompt',
 *   render: (ctx) => [{
 *     role: 'system',
 *     content: `You are agentlint. Current branch: ${ctx.branch}`
 *   }]
 * };
 * ```
 */
export interface PromptSpec<TCtx = void> extends PromptMetadata {
  /**
   * Render the prompt to a list of messages given the context.
   * Messages are SDK-agnostic; adapters convert to provider formats.
   */
  render(ctx: TCtx): PromptMessage[];
}

/**
 * Static prompt spec for prompts that don't require runtime context.
 * Useful for subagent system prompts that are fully self-contained.
 */
export interface StaticPromptSpec extends PromptMetadata {
  /** Pre-rendered messages (no context required) */
  messages: PromptMessage[];
}

/**
 * Helper to check if a prompt spec is static (pre-rendered) or dynamic (requires context).
 */
export function isStaticPromptSpec(
  spec: PromptSpec<unknown> | StaticPromptSpec
): spec is StaticPromptSpec {
  return 'messages' in spec && !('render' in spec);
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Zod schema for PromptRole.
 */
export const PromptRoleSchema = z.enum(['system', 'developer', 'user']);

/**
 * Zod schema for PromptMessage.
 */
export const PromptMessageSchema = z.object({
  role: PromptRoleSchema,
  content: z.string().min(1, 'Message content cannot be empty'),
});

/**
 * Zod schema for semantic version string (e.g., "1.0.0", "2.1.3-beta").
 */
export const SemverSchema = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/,
    'Version must be semver format (e.g., "1.0.0", "2.1.3-beta")'
  );

/**
 * Zod schema for prompt ID (namespaced, e.g., "welcome/system", "analysis/main").
 */
export const PromptIdSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/,
    'Prompt ID must be namespaced (e.g., "welcome/system", "analysis/main")'
  );

/**
 * Zod schema for PromptMetadata.
 */
export const PromptMetadataSchema = z.object({
  id: PromptIdSchema,
  version: SemverSchema,
  createdAt: z.string().datetime({ message: 'createdAt must be ISO 8601 format' }),
  description: z.string().min(1, 'Description cannot be empty'),
  tags: z.array(z.string()).optional(),
});

/**
 * Zod schema for StaticPromptSpec.
 */
export const StaticPromptSpecSchema = PromptMetadataSchema.extend({
  messages: z.array(PromptMessageSchema).min(1, 'Must have at least one message'),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a prompt metadata object with defaults.
 */
export function createPromptMetadata(
  id: string,
  version: string,
  description: string,
  tags?: string[]
): PromptMetadata {
  return {
    id,
    version,
    createdAt: new Date().toISOString(),
    description,
    tags,
  };
}

/**
 * Validate prompt metadata against the schema.
 * Throws ZodError if invalid.
 */
export function validatePromptMetadata(metadata: unknown): PromptMetadata {
  return PromptMetadataSchema.parse(metadata);
}

/**
 * Validate a static prompt spec against the schema.
 * Throws ZodError if invalid.
 */
export function validateStaticPromptSpec(spec: unknown): StaticPromptSpec {
  return StaticPromptSpecSchema.parse(spec);
}

/**
 * Generate a unique key for a prompt spec (id@version).
 * Used for registry lookups and telemetry.
 */
export function getPromptKey(id: string, version: string): string {
  return `${id}@${version}`;
}

/**
 * Parse a prompt key back to id and version.
 */
export function parsePromptKey(key: string): { id: string; version: string } {
  const [id, version] = key.split('@');
  if (!id || !version) {
    throw new Error(`Invalid prompt key: ${key}. Expected format: "id@version"`);
  }
  return { id, version };
}
