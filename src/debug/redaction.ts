/**
 * EP11 Quality & Security - Redaction Utilities
 *
 * Secret redaction utilities for debug output and logging.
 * Ensures sensitive data is never exposed in logs, console output,
 * or any external-facing interfaces.
 *
 * @module debug/redaction
 */

import type { RedactionPattern } from './types';

// =============================================================================
// Constants
// =============================================================================

/**
 * Default redaction placeholder text.
 */
export const REDACTED_PLACEHOLDER = '[REDACTED]';

/**
 * Redaction placeholder with type information.
 */
export const REDACTED_SECRET = '[REDACTED:SECRET]';

/**
 * Redaction placeholder for API keys.
 */
export const REDACTED_API_KEY = '[REDACTED:API_KEY]';

/**
 * Redaction placeholder for tokens.
 */
export const REDACTED_TOKEN = '[REDACTED:TOKEN]';

/**
 * Redaction placeholder for passwords.
 */
export const REDACTED_PASSWORD = '[REDACTED:PASSWORD]';

// =============================================================================
// Redaction Placeholder Creation
// =============================================================================

/**
 * Create a redacted placeholder showing partial information.
 *
 * This function creates safe placeholders that:
 * - Show the length of the original value (helps debugging)
 * - Optionally show first/last characters (for identification)
 * - Never expose enough to reconstruct the secret
 *
 * @param value - The sensitive value to redact
 * @param options - Configuration options
 * @returns A safe placeholder string
 *
 * @example
 * createRedactedPlaceholder('my_secret_value_here')
 * // '[REDACTED:20 chars]'
 *
 * createRedactedPlaceholder('my_secret_value_here', { showHint: true })
 * // '[REDACTED:my...re:20 chars]'
 *
 * createRedactedPlaceholder('my_secret_value_here', { type: 'API_KEY' })
 * // '[REDACTED:API_KEY:20 chars]'
 */
export function createRedactedPlaceholder(
  value: string,
  options: {
    /** Show first 2 and last 2 characters as hint */
    showHint?: boolean;
    /** Type label for the redacted value */
    type?: string;
    /** Show length of original value */
    showLength?: boolean;
  } = {}
): string {
  const { showHint = false, type, showLength = true } = options;

  if (!value) {
    return REDACTED_PLACEHOLDER;
  }

  const parts: string[] = ['[REDACTED'];

  // Add type if provided
  if (type) {
    parts.push(`:${type}`);
  }

  // Add hint (first 2 and last 2 chars) if requested and value is long enough
  if (showHint && value.length >= 8) {
    const hint = `${value.slice(0, 2)}...${value.slice(-2)}`;
    parts.push(`:${hint}`);
  }

  // Add length if requested
  if (showLength) {
    parts.push(`:${value.length} chars`);
  }

  parts.push(']');

  return parts.join('');
}

// =============================================================================
// Built-in Redaction Patterns
// =============================================================================

/**
 * Common patterns for sensitive data that should be redacted.
 */
export const BUILTIN_REDACTION_PATTERNS: RedactionPattern[] = [
  // API Keys (various formats)
  {
    pattern: /(?:api[_-]?key|apikey)[=:]\s*['"]?([a-zA-Z0-9_-]{16,})['"]?/gi,
    replacement: (match: string) => match.replace(/[a-zA-Z0-9_-]{16,}/, REDACTED_API_KEY),
    type: 'api_key',
  },

  // Bearer tokens
  {
    pattern: /Bearer\s+([a-zA-Z0-9._-]+)/gi,
    replacement: `Bearer ${REDACTED_TOKEN}`,
    type: 'bearer_token',
  },

  // AWS Access Key IDs (AKIA prefix)
  {
    pattern: /\b(AKIA[A-Z0-9]{16})\b/g,
    replacement: REDACTED_API_KEY,
    type: 'aws_access_key',
  },

  // Generic secret/password patterns
  {
    pattern: /(?:password|passwd|pwd|secret)[=:]\s*['"]?([^\s'"]+)['"]?/gi,
    replacement: (match: string) => match.replace(/[^\s'"]+$/, REDACTED_PASSWORD),
    type: 'password',
  },

  // Connection strings with credentials
  {
    pattern: /:\/\/([^:]+):([^@]+)@/g,
    replacement: `://$1:${REDACTED_PASSWORD}@`,
    type: 'connection_string',
  },

  // Private keys
  {
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
    replacement: '[REDACTED:PRIVATE_KEY]',
    type: 'private_key',
  },

  // JWT tokens (three base64 segments separated by dots)
  {
    pattern: /\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]+\b/g,
    replacement: REDACTED_TOKEN,
    type: 'jwt',
  },

  // GitHub tokens
  {
    pattern: /\b(gh[ps]_[a-zA-Z0-9]{36,})\b/g,
    replacement: REDACTED_TOKEN,
    type: 'github_token',
  },

  // Anthropic API keys
  {
    pattern: /\b(sk-ant-[a-zA-Z0-9-]+)\b/g,
    replacement: REDACTED_API_KEY,
    type: 'anthropic_key',
  },

  // OpenAI API keys
  {
    pattern: /\b(sk-[a-zA-Z0-9]{32,})\b/g,
    replacement: REDACTED_API_KEY,
    type: 'openai_key',
  },

  // Generic high-entropy strings (32+ chars of base64-like content)
  {
    pattern: /\b([A-Za-z0-9+/=]{32,})\b/g,
    replacement: (match: string) => {
      // Only redact if it looks like encoded data (has mixed case or special chars)
      if (/[a-z]/.test(match) && /[A-Z]/.test(match)) {
        return REDACTED_SECRET;
      }
      return match;
    },
    type: 'encoded_data',
  },
];

// =============================================================================
// Redaction Functions
// =============================================================================

/**
 * Apply redaction patterns to a string.
 *
 * @param input - The string to redact
 * @param patterns - Patterns to apply (defaults to BUILTIN_REDACTION_PATTERNS)
 * @returns Redacted string
 */
export function redact(
  input: string,
  patterns: RedactionPattern[] = BUILTIN_REDACTION_PATTERNS
): string {
  if (!input) {
    return input;
  }

  let result = input;

  for (const { pattern, replacement } of patterns) {
    if (typeof replacement === 'function') {
      result = result.replace(pattern, replacement);
    } else {
      result = result.replace(pattern, replacement);
    }
  }

  return result;
}

/**
 * Redact sensitive data from an object (deep redaction).
 *
 * @param obj - The object to redact
 * @param patterns - Patterns to apply
 * @returns New object with redacted values
 */
export function redactObject<T>(
  obj: T,
  patterns: RedactionPattern[] = BUILTIN_REDACTION_PATTERNS
): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return redact(obj, patterns) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, patterns)) as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Redact sensitive key names entirely
      if (isSensitiveKey(key)) {
        result[key] = REDACTED_PLACEHOLDER;
      } else {
        result[key] = redactObject(value, patterns);
      }
    }
    return result as T;
  }

  return obj;
}

/**
 * Check if a key name indicates sensitive data.
 *
 * @param key - The key name to check
 * @returns true if the key likely contains sensitive data
 */
export function isSensitiveKey(key: string): boolean {
  const sensitivePatterns = [
    /password/i,
    /passwd/i,
    /secret/i,
    /api[_-]?key/i,
    /apikey/i,
    /token/i,
    /auth/i,
    /credential/i,
    /private[_-]?key/i,
    /access[_-]?key/i,
    /secret[_-]?key/i,
  ];

  return sensitivePatterns.some((pattern) => pattern.test(key));
}

// =============================================================================
// Context Redaction
// =============================================================================

/**
 * Create redacted context for a secret match.
 *
 * Shows surrounding text with the secret value redacted,
 * useful for providing context in reports without exposing secrets.
 *
 * @param fullText - The full text containing the secret
 * @param secretStart - Start index of the secret
 * @param secretEnd - End index of the secret
 * @param contextChars - Number of context characters on each side (default: 20)
 * @returns Redacted context string
 *
 * @example
 * createRedactedContext('The API key is sk_live_xyz123 in config', 15, 29, 10)
 * // 'I key is [REDACTED:14 chars] in conf'
 */
export function createRedactedContext(
  fullText: string,
  secretStart: number,
  secretEnd: number,
  contextChars: number = 20
): string {
  const start = Math.max(0, secretStart - contextChars);
  const end = Math.min(fullText.length, secretEnd + contextChars);

  const before = fullText.slice(start, secretStart);
  const secret = fullText.slice(secretStart, secretEnd);
  const after = fullText.slice(secretEnd, end);

  const redactedSecret = createRedactedPlaceholder(secret, { showLength: true });

  return `${before}${redactedSecret}${after}`;
}

// =============================================================================
// Pattern Management
// =============================================================================

/**
 * Create a custom redaction pattern.
 *
 * @param pattern - The regex pattern to match
 * @param replacement - The replacement string or function
 * @param type - Optional type identifier
 * @returns A RedactionPattern object
 */
export function createRedactionPattern(
  pattern: RegExp,
  replacement: string | ((match: string) => string),
  type?: string
): RedactionPattern {
  const result: RedactionPattern = { pattern, replacement };
  if (type !== undefined) {
    result.type = type;
  }
  return result;
}

/**
 * Merge custom patterns with built-in patterns.
 *
 * @param customPatterns - Custom patterns to add
 * @param includeBuiltin - Whether to include built-in patterns (default: true)
 * @returns Combined pattern array
 */
export function mergePatterns(
  customPatterns: RedactionPattern[],
  includeBuiltin: boolean = true
): RedactionPattern[] {
  if (includeBuiltin) {
    return [...BUILTIN_REDACTION_PATTERNS, ...customPatterns];
  }
  return customPatterns;
}
