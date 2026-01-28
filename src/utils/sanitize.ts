/**
 * Prompt Input Sanitization
 *
 * Prevents prompt injection by sanitizing user-controlled strings
 * before interpolation into system prompts.
 *
 * @module utils/sanitize
 */

/** Maximum length for sanitized prompt inputs */
const MAX_PROMPT_INPUT_LENGTH = 1000;

/**
 * Sanitize a string before interpolation into an LLM system prompt.
 *
 * Mitigations:
 * - Strips null bytes (prevent null-byte injection)
 * - Replaces newlines with spaces (prevent prompt structure manipulation)
 * - Escapes XML-like angle brackets (prevent XML/tag injection)
 * - Truncates to max length (prevent context overflow)
 *
 * @param input - The raw user input string
 * @param maxLength - Maximum output length (default: 1000)
 * @returns Sanitized string safe for prompt interpolation
 */
export function sanitizePromptInput(
  input: string,
  maxLength: number = MAX_PROMPT_INPUT_LENGTH
): string {
  let sanitized = input;

  // Strip null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Replace newlines and carriage returns with spaces
  sanitized = sanitized.replace(/[\r\n]+/g, ' ');

  // Escape angle brackets to prevent XML/tag injection
  sanitized = sanitized.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength) + '...';
  }

  return sanitized;
}
