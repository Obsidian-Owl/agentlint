/**
 * EP11 Quality & Security - Redaction Utilities
 *
 * Secret redaction utilities for debug output and logging.
 * Ensures sensitive data is never exposed in logs, console output,
 * or any external-facing interfaces.
 *
 * Pattern coverage based on ADR-0013 (Gitleaks patterns) and common secret formats.
 * This module provides fast, synchronous redaction for runtime use.
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
// Built-in Redaction Patterns (Comprehensive coverage per ADR-0013)
// =============================================================================

/**
 * Common patterns for sensitive data that should be redacted.
 * Patterns based on Gitleaks rules and common secret formats.
 */
export const BUILTIN_REDACTION_PATTERNS: RedactionPattern[] = [
  // =========================================================================
  // Cloud Provider Keys (AWS, GCP, Azure)
  // =========================================================================

  // AWS Access Key IDs (AKIA prefix - 20 chars)
  {
    pattern: /\b(AKIA[A-Z0-9]{16})\b/g,
    replacement: '[REDACTED:AWS_ACCESS_KEY]',
    type: 'aws_access_key',
  },

  // AWS Secret Access Keys (40 chars, base64-like)
  {
    pattern: /(?:aws[_-]?secret[_-]?(?:access[_-]?)?key|secret[_-]?access[_-]?key)[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi,
    replacement: (match: string) => match.replace(/[A-Za-z0-9/+=]{40}/, '[REDACTED:AWS_SECRET]'),
    type: 'aws_secret_key',
  },

  // Google API Keys (AIzaSy prefix)
  {
    pattern: /\b(AIzaSy[A-Za-z0-9_-]{33})\b/g,
    replacement: '[REDACTED:GOOGLE_API_KEY]',
    type: 'google_api_key',
  },

  // Google Cloud Service Account (JSON with private_key)
  {
    pattern: /("private_key":\s*"-----BEGIN[^"]+-----")/g,
    replacement: '"private_key":"[REDACTED:GCP_PRIVATE_KEY]"',
    type: 'gcp_service_account',
  },

  // Azure Storage Account Keys
  {
    pattern: /(?:account[_-]?key|azure[_-]?storage[_-]?key)[=:]\s*['"]?([A-Za-z0-9+/=]{88})['"]?/gi,
    replacement: (match: string) => match.replace(/[A-Za-z0-9+/=]{88}/, '[REDACTED:AZURE_KEY]'),
    type: 'azure_storage_key',
  },

  // Azure AD Client Secret
  {
    pattern: /(?:client[_-]?secret|azure[_-]?client[_-]?secret)[=:]\s*['"]?([A-Za-z0-9~_.-]{34,40})['"]?/gi,
    replacement: (match: string) => match.replace(/[A-Za-z0-9~_.-]{34,40}/, '[REDACTED:AZURE_SECRET]'),
    type: 'azure_client_secret',
  },

  // =========================================================================
  // Version Control & DevOps Tokens
  // =========================================================================

  // GitHub Personal Access Token (ghp_)
  {
    pattern: /\b(ghp_[a-zA-Z0-9]{36,})\b/g,
    replacement: '[REDACTED:GITHUB_PAT]',
    type: 'github_pat',
  },

  // GitHub OAuth Access Token (gho_)
  {
    pattern: /\b(gho_[a-zA-Z0-9]{36,})\b/g,
    replacement: '[REDACTED:GITHUB_OAUTH]',
    type: 'github_oauth',
  },

  // GitHub App Token (ghu_)
  {
    pattern: /\b(ghu_[a-zA-Z0-9]{36,})\b/g,
    replacement: '[REDACTED:GITHUB_USER_TOKEN]',
    type: 'github_user_token',
  },

  // GitHub App Installation Token (ghs_)
  {
    pattern: /\b(ghs_[a-zA-Z0-9]{36,})\b/g,
    replacement: '[REDACTED:GITHUB_SERVER_TOKEN]',
    type: 'github_server_token',
  },

  // GitHub Refresh Token (ghr_)
  {
    pattern: /\b(ghr_[a-zA-Z0-9]{36,})\b/g,
    replacement: '[REDACTED:GITHUB_REFRESH]',
    type: 'github_refresh',
  },

  // GitLab Personal Access Token (glpat-)
  {
    pattern: /\b(glpat-[a-zA-Z0-9_-]{20,})\b/g,
    replacement: '[REDACTED:GITLAB_PAT]',
    type: 'gitlab_pat',
  },

  // GitLab Pipeline Trigger Token
  {
    pattern: /\b(glptt-[a-zA-Z0-9_-]{20,})\b/g,
    replacement: '[REDACTED:GITLAB_TRIGGER]',
    type: 'gitlab_trigger',
  },

  // Bitbucket App Password
  {
    pattern: /(?:bitbucket[_-]?(?:app[_-]?)?password)[=:]\s*['"]?([A-Za-z0-9]{18,})['"]?/gi,
    replacement: (match: string) => match.replace(/[A-Za-z0-9]{18,}/, '[REDACTED:BITBUCKET_PASS]'),
    type: 'bitbucket_app_password',
  },

  // =========================================================================
  // AI/LLM Provider Keys
  // =========================================================================

  // Anthropic API Keys (sk-ant-)
  {
    pattern: /\b(sk-ant-[a-zA-Z0-9-]{10,})\b/g,
    replacement: '[REDACTED:ANTHROPIC_KEY]',
    type: 'anthropic_key',
  },

  // OpenAI API Keys (sk-)
  {
    pattern: /\b(sk-[a-zA-Z0-9]{32,})\b/g,
    replacement: '[REDACTED:OPENAI_KEY]',
    type: 'openai_key',
  },

  // Cohere API Keys
  {
    pattern: /(?:cohere[_-]?api[_-]?key)[=:]\s*['"]?([a-zA-Z0-9]{40})['"]?/gi,
    replacement: (match: string) => match.replace(/[a-zA-Z0-9]{40}/, '[REDACTED:COHERE_KEY]'),
    type: 'cohere_key',
  },

  // Hugging Face API Tokens (hf_)
  {
    pattern: /\b(hf_[a-zA-Z0-9]{34,})\b/g,
    replacement: '[REDACTED:HUGGINGFACE_TOKEN]',
    type: 'huggingface_token',
  },

  // =========================================================================
  // Payment & Financial Services
  // =========================================================================

  // Stripe API Keys (sk_live_, sk_test_, rk_live_, rk_test_)
  {
    pattern: /\b(sk_live_[a-zA-Z0-9]{24,})\b/g,
    replacement: '[REDACTED:STRIPE_LIVE_KEY]',
    type: 'stripe_live_key',
  },

  {
    pattern: /\b(sk_test_[a-zA-Z0-9]{24,})\b/g,
    replacement: '[REDACTED:STRIPE_TEST_KEY]',
    type: 'stripe_test_key',
  },

  {
    pattern: /\b(rk_live_[a-zA-Z0-9]{24,})\b/g,
    replacement: '[REDACTED:STRIPE_RESTRICTED_KEY]',
    type: 'stripe_restricted_key',
  },

  // Square API Keys
  {
    pattern: /\b(sq0atp-[a-zA-Z0-9_-]{22,})\b/g,
    replacement: '[REDACTED:SQUARE_ACCESS_TOKEN]',
    type: 'square_access_token',
  },

  {
    pattern: /\b(sq0csp-[a-zA-Z0-9_-]{43,})\b/g,
    replacement: '[REDACTED:SQUARE_SECRET]',
    type: 'square_secret',
  },

  // PayPal (Basic format detection)
  {
    pattern: /(?:paypal[_-]?(?:client[_-]?)?(?:secret|id))[=:]\s*['"]?([A-Za-z0-9_-]{32,})['"]?/gi,
    replacement: (match: string) => match.replace(/[A-Za-z0-9_-]{32,}/, '[REDACTED:PAYPAL]'),
    type: 'paypal_credential',
  },

  // =========================================================================
  // Communication Services
  // =========================================================================

  // Slack Bot/User OAuth Tokens (xoxb-, xoxp-, xoxs-)
  {
    pattern: /\b(xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+)\b/g,
    replacement: '[REDACTED:SLACK_BOT_TOKEN]',
    type: 'slack_bot_token',
  },

  {
    pattern: /\b(xoxp-[0-9]+-[0-9]+-[0-9]+-[a-zA-Z0-9]+)\b/g,
    replacement: '[REDACTED:SLACK_USER_TOKEN]',
    type: 'slack_user_token',
  },

  {
    pattern: /\b(xoxs-[0-9]+-[0-9]+-[0-9]+-[a-zA-Z0-9]+)\b/g,
    replacement: '[REDACTED:SLACK_SESSION_TOKEN]',
    type: 'slack_session_token',
  },

  // Slack Webhook URLs
  {
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[a-zA-Z0-9]+/g,
    replacement: '[REDACTED:SLACK_WEBHOOK]',
    type: 'slack_webhook',
  },

  // Discord Bot Tokens
  {
    pattern: /\b([MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27,})\b/g,
    replacement: '[REDACTED:DISCORD_TOKEN]',
    type: 'discord_token',
  },

  // Discord Webhook URLs
  {
    pattern: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9_-]+/g,
    replacement: '[REDACTED:DISCORD_WEBHOOK]',
    type: 'discord_webhook',
  },

  // Twilio Account SID and Auth Token
  {
    pattern: /\b(AC[a-f0-9]{32})\b/gi,
    replacement: '[REDACTED:TWILIO_SID]',
    type: 'twilio_sid',
  },

  {
    pattern: /(?:twilio[_-]?auth[_-]?token)[=:]\s*['"]?([a-f0-9]{32})['"]?/gi,
    replacement: (match: string) => match.replace(/[a-f0-9]{32}/, '[REDACTED:TWILIO_TOKEN]'),
    type: 'twilio_auth_token',
  },

  // SendGrid API Keys (SG.)
  {
    pattern: /\b(SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43})\b/g,
    replacement: '[REDACTED:SENDGRID_KEY]',
    type: 'sendgrid_key',
  },

  // Mailgun API Keys
  {
    pattern: /(?:mailgun[_-]?api[_-]?key)[=:]\s*['"]?(key-[a-f0-9]{32})['"]?/gi,
    replacement: (match: string) => match.replace(/key-[a-f0-9]{32}/, '[REDACTED:MAILGUN_KEY]'),
    type: 'mailgun_key',
  },

  // =========================================================================
  // Package Registries & CI/CD
  // =========================================================================

  // NPM Access Tokens
  {
    pattern: /\b(npm_[a-zA-Z0-9]{36,})\b/g,
    replacement: '[REDACTED:NPM_TOKEN]',
    type: 'npm_token',
  },

  // PyPI API Tokens
  {
    pattern: /\b(pypi-[a-zA-Z0-9_-]{100,})\b/g,
    replacement: '[REDACTED:PYPI_TOKEN]',
    type: 'pypi_token',
  },

  // Docker Hub Access Token (dckr_pat_)
  {
    pattern: /\b(dckr_pat_[a-zA-Z0-9_-]{27,})\b/g,
    replacement: '[REDACTED:DOCKER_TOKEN]',
    type: 'docker_token',
  },

  // CircleCI Token
  {
    pattern: /(?:circle[_-]?ci[_-]?token)[=:]\s*['"]?([a-f0-9]{40})['"]?/gi,
    replacement: (match: string) => match.replace(/[a-f0-9]{40}/, '[REDACTED:CIRCLECI_TOKEN]'),
    type: 'circleci_token',
  },

  // Travis CI Token
  {
    pattern: /(?:travis[_-]?api[_-]?token)[=:]\s*['"]?([A-Za-z0-9]{22,})['"]?/gi,
    replacement: (match: string) => match.replace(/[A-Za-z0-9]{22,}/, '[REDACTED:TRAVIS_TOKEN]'),
    type: 'travis_token',
  },

  // =========================================================================
  // Infrastructure & Hosting
  // =========================================================================

  // DigitalOcean Access Token
  {
    pattern: /\b(dop_v1_[a-f0-9]{64})\b/g,
    replacement: '[REDACTED:DIGITALOCEAN_TOKEN]',
    type: 'digitalocean_token',
  },

  // Heroku API Key
  {
    pattern: /(?:heroku[_-]?api[_-]?key)[=:]\s*['"]?([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})['"]?/gi,
    replacement: (match: string) => match.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/, '[REDACTED:HEROKU_KEY]'),
    type: 'heroku_api_key',
  },

  // Netlify Access Token
  {
    pattern: /(?:netlify[_-]?(?:access[_-]?)?token)[=:]\s*['"]?([a-zA-Z0-9_-]{40,})['"]?/gi,
    replacement: (match: string) => match.replace(/[a-zA-Z0-9_-]{40,}/, '[REDACTED:NETLIFY_TOKEN]'),
    type: 'netlify_token',
  },

  // Vercel Token
  {
    pattern: /(?:vercel[_-]?token)[=:]\s*['"]?([a-zA-Z0-9]{24,})['"]?/gi,
    replacement: (match: string) => match.replace(/[a-zA-Z0-9]{24,}/, '[REDACTED:VERCEL_TOKEN]'),
    type: 'vercel_token',
  },

  // =========================================================================
  // Databases
  // =========================================================================

  // MongoDB Connection String (preserve username, redact password)
  {
    pattern: /(mongodb(?:\+srv)?:\/\/[^:]+):([^@]+)@/g,
    replacement: `$1:${REDACTED_PASSWORD}@`,
    type: 'mongodb_password',
  },

  // PostgreSQL Connection String (preserve username, redact password)
  {
    pattern: /(postgres(?:ql)?:\/\/[^:]+):([^@]+)@/g,
    replacement: `$1:${REDACTED_PASSWORD}@`,
    type: 'postgres_password',
  },

  // MySQL Connection String (preserve username, redact password)
  {
    pattern: /(mysql:\/\/[^:]+):([^@]+)@/g,
    replacement: `$1:${REDACTED_PASSWORD}@`,
    type: 'mysql_password',
  },

  // Redis Connection String (preserve username, redact password)
  {
    pattern: /(redis:\/\/[^:]*):([^@]+)@/g,
    replacement: `$1:${REDACTED_PASSWORD}@`,
    type: 'redis_password',
  },

  // Generic connection strings with credentials (preserve protocol and username)
  {
    pattern: /(:\/\/[^:]+):([^@]+)@/g,
    replacement: `$1:${REDACTED_PASSWORD}@`,
    type: 'connection_string',
  },

  // =========================================================================
  // Authentication & OAuth
  // =========================================================================

  // Bearer tokens
  {
    pattern: /Bearer\s+([a-zA-Z0-9._-]+)/gi,
    replacement: `Bearer ${REDACTED_TOKEN}`,
    type: 'bearer_token',
  },

  // JWT tokens (three base64 segments separated by dots)
  {
    pattern: /\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]+\b/g,
    replacement: REDACTED_TOKEN,
    type: 'jwt',
  },

  // OAuth Client Secrets
  {
    pattern: /(?:client[_-]?secret|oauth[_-]?secret)[=:]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
    replacement: (match: string) => match.replace(/[a-zA-Z0-9_-]{20,}$/, '[REDACTED:CLIENT_SECRET]'),
    type: 'oauth_client_secret',
  },

  // =========================================================================
  // Private Keys & Certificates
  // =========================================================================

  // RSA/DSA/EC/OpenSSH Private Keys
  {
    pattern: /-----BEGIN\s+(?:RSA\s+)?(?:DSA\s+)?(?:EC\s+)?(?:OPENSSH\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?(?:DSA\s+)?(?:EC\s+)?(?:OPENSSH\s+)?PRIVATE\s+KEY-----/g,
    replacement: '[REDACTED:PRIVATE_KEY]',
    type: 'private_key',
  },

  // PGP Private Keys
  {
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]*?-----END PGP PRIVATE KEY BLOCK-----/g,
    replacement: '[REDACTED:PGP_PRIVATE_KEY]',
    type: 'pgp_private_key',
  },

  // =========================================================================
  // Generic Patterns (Lower priority - checked last)
  // =========================================================================

  // Generic API Keys (various formats)
  {
    pattern: /(?:api[_-]?key|apikey)[=:]\s*['"]?([a-zA-Z0-9_-]{16,})['"]?/gi,
    replacement: (match: string) => match.replace(/[a-zA-Z0-9_-]{16,}$/, '[REDACTED:API_KEY]'),
    type: 'api_key',
  },

  // Generic secrets/passwords (min 6 chars to catch common passwords)
  {
    pattern: /(?:password|passwd|pwd|secret)[=:]\s*['"]?([^\s'"]{6,})['"]?/gi,
    replacement: (match: string) => match.replace(/[^\s'"]{6,}$/, REDACTED_PASSWORD),
    type: 'password',
  },

  // Generic tokens
  {
    pattern: /(?:token|auth[_-]?token|access[_-]?token)[=:]\s*['"]?([a-zA-Z0-9_.-]{16,})['"]?/gi,
    replacement: (match: string) => match.replace(/[a-zA-Z0-9_.-]{16,}$/, '[REDACTED:TOKEN]'),
    type: 'token',
  },

  // Generic high-entropy strings (32+ chars of base64-like content)
  // Only applied if mixed case detected (to avoid false positives on UUIDs, hashes)
  {
    pattern: /\b([A-Za-z0-9+/=]{40,})\b/g,
    replacement: (match: string): string => {
      // Only redact if it looks like encoded data (has mixed case and special chars)
      const hasMixedCase = /[a-z]/.test(match) && /[A-Z]/.test(match);
      const hasSpecial = /[+/=]/.test(match);
      if (hasMixedCase && hasSpecial) {
        return '[REDACTED:ENCODED_SECRET]';
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
    return obj.map((item: unknown) => redactObject(item, patterns)) as T;
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

/**
 * Get the count of built-in redaction patterns.
 * Useful for verification and testing.
 */
export function getPatternCount(): number {
  return BUILTIN_REDACTION_PATTERNS.length;
}
