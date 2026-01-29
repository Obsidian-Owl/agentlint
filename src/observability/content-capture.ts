/**
 * EP22: Content Capture (Phase 3.5)
 * Opt-in content capture for tool calls and LLM prompts with sanitization.
 *
 * Tasks: T025d, T025e
 */

import { v4 as uuidv4 } from 'uuid';
import { redact } from '../debug/redaction';
import { DEFAULT_TRUNCATION_LIMIT } from '../telemetry/constants';

// =============================================================================
// Types
// =============================================================================

/**
 * Content capture configuration from environment.
 */
export interface ContentCaptureConfig {
  /** Whether content capture is enabled (requires explicit opt-in) */
  enabled: boolean;
  /** Maximum length for captured content before truncation */
  maxLength: number;
}

/**
 * Captured tool call content for span attributes.
 */
export interface ToolCallContent {
  /** Unique tool call ID (UUID v4) */
  callId: string;
  /** Tool call arguments (JSON stringified, sanitized, truncated) */
  arguments?: string;
  /** Tool call result (JSON stringified, sanitized, truncated) */
  result?: string;
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Check if content capture is enabled via environment variable.
 *
 * Content capture is DISABLED by default per Constitution Principle I (Local-First).
 * Users must explicitly opt-in via AGENTLINT_CAPTURE_CONTENT=true.
 *
 * @returns true if AGENTLINT_CAPTURE_CONTENT=true, false otherwise
 */
export function isContentCaptureEnabled(): boolean {
  return process.env.AGENTLINT_CAPTURE_CONTENT === 'true';
}

/**
 * Get content capture configuration from environment.
 *
 * @returns ContentCaptureConfig with enabled status and max length
 */
export function getContentCaptureConfig(): ContentCaptureConfig {
  const enabled = isContentCaptureEnabled();
  const maxLengthEnv = process.env.AGENTLINT_CAPTURE_MAX_LENGTH;
  const maxLength = maxLengthEnv ? parseInt(maxLengthEnv, 10) : DEFAULT_TRUNCATION_LIMIT;

  return {
    enabled,
    maxLength: Number.isNaN(maxLength) ? DEFAULT_TRUNCATION_LIMIT : maxLength,
  };
}

// =============================================================================
// Content Sanitization
// =============================================================================

/**
 * Sanitize and truncate content for safe capture.
 *
 * Applies secret redaction and length truncation to ensure captured content
 * is safe for storage and transmission.
 *
 * @param content - Raw content to sanitize
 * @param maxLength - Maximum length (defaults to config max)
 * @returns Sanitized and truncated content
 */
export function sanitizeContent(content: string, maxLength?: number): string {
  const config = getContentCaptureConfig();
  const limit = maxLength ?? config.maxLength;

  // First, redact any secrets using builtin patterns
  const redacted = redact(content);

  // Then truncate to max length
  if (redacted.length > limit) {
    return `${redacted.slice(0, limit)}... [TRUNCATED:${redacted.length - limit} chars]`;
  }

  return redacted;
}

// =============================================================================
// Tool Call Capture
// =============================================================================

/**
 * Generate a unique tool call ID for correlation.
 *
 * Uses UUID v4 for random generation (not time-based like trace IDs).
 *
 * @returns UUID v4 string
 */
export function generateToolCallId(): string {
  return uuidv4();
}

/**
 * Prepare tool call content for span attributes.
 *
 * Captures tool arguments and results with sanitization and truncation.
 * Returns null if content capture is disabled.
 *
 * @param args - Tool call arguments (any JSON-serializable value)
 * @param result - Tool call result (any JSON-serializable value)
 * @returns ToolCallContent with call ID and sanitized content, or null if disabled
 *
 * @example
 * const content = captureToolCallContent({ file_path: '/path/to/file' }, { content: '...' });
 * if (content) {
 *   span.setAttribute('gen_ai.tool.call.id', content.callId);
 *   if (content.arguments) {
 *     span.setAttribute('gen_ai.tool.call.arguments', content.arguments);
 *   }
 *   if (content.result) {
 *     span.setAttribute('gen_ai.tool.call.result', content.result);
 *   }
 * }
 */
export function captureToolCallContent(args?: unknown, result?: unknown): ToolCallContent | null {
  const config = getContentCaptureConfig();

  // Return null if content capture is disabled
  if (!config.enabled) {
    return null;
  }

  const callId = generateToolCallId();

  // Sanitize and truncate arguments
  let sanitizedArgs: string | undefined = undefined;
  if (args !== undefined) {
    try {
      const argsJson = JSON.stringify(args);
      sanitizedArgs = sanitizeContent(argsJson, config.maxLength);
    } catch {
      // JSON.stringify can fail on circular references or BigInt
      sanitizedArgs = '[CAPTURE_ERROR: Failed to stringify arguments]';
    }
  }

  // Sanitize and truncate result
  let sanitizedResult: string | undefined = undefined;
  if (result !== undefined) {
    try {
      const resultJson = JSON.stringify(result);
      sanitizedResult = sanitizeContent(resultJson, config.maxLength);
    } catch {
      // JSON.stringify can fail on circular references or BigInt
      sanitizedResult = '[CAPTURE_ERROR: Failed to stringify result]';
    }
  }

  // Build result object with only defined properties to satisfy exactOptionalPropertyTypes
  const toolCallContent: ToolCallContent = { callId };
  if (sanitizedArgs !== undefined) {
    toolCallContent.arguments = sanitizedArgs;
  }
  if (sanitizedResult !== undefined) {
    toolCallContent.result = sanitizedResult;
  }

  return toolCallContent;
}
