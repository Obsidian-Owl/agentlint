/**
 * EP11 Quality & Security - Redaction Utilities Unit Tests
 *
 * Tests for secret redaction in debug output.
 *
 * @module tests/unit/debug/redaction
 */

import { describe, it, expect } from 'bun:test';
import {
  REDACTED_PLACEHOLDER,
  REDACTED_SECRET,
  REDACTED_API_KEY,
  REDACTED_TOKEN,
  REDACTED_PASSWORD,
  createRedactedPlaceholder,
  redact,
  redactObject,
  isSensitiveKey,
  createRedactedContext,
  createRedactionPattern,
  mergePatterns,
  BUILTIN_REDACTION_PATTERNS,
} from '../../../src/debug/redaction';

describe('Redaction Constants', () => {
  it('should have standard placeholder values', () => {
    expect(REDACTED_PLACEHOLDER).toBe('[REDACTED]');
    expect(REDACTED_SECRET).toBe('[REDACTED:SECRET]');
    expect(REDACTED_API_KEY).toBe('[REDACTED:API_KEY]');
    expect(REDACTED_TOKEN).toBe('[REDACTED:TOKEN]');
    expect(REDACTED_PASSWORD).toBe('[REDACTED:PASSWORD]');
  });
});

describe('createRedactedPlaceholder', () => {
  it('should return default placeholder for empty value', () => {
    expect(createRedactedPlaceholder('')).toBe(REDACTED_PLACEHOLDER);
  });

  it('should include length by default', () => {
    const result = createRedactedPlaceholder('my_secret_value');
    expect(result).toContain('15 chars');
    expect(result).toMatch(/^\[REDACTED:15 chars\]$/);
  });

  it('should include type when provided', () => {
    const result = createRedactedPlaceholder('my_secret_value', { type: 'API_KEY' });
    expect(result).toContain('API_KEY');
    expect(result).toMatch(/^\[REDACTED:API_KEY:15 chars\]$/);
  });

  it('should include hint when requested and value is long enough', () => {
    const result = createRedactedPlaceholder('my_secret_value', { showHint: true });
    expect(result).toContain('my...ue');
    expect(result).toMatch(/^\[REDACTED:my\.\.\.ue:15 chars\]$/);
  });

  it('should not include hint for short values', () => {
    const result = createRedactedPlaceholder('short', { showHint: true });
    // Value is only 5 chars, below the 8-char threshold for hints
    expect(result).not.toContain('...');
  });

  it('should omit length when showLength is false', () => {
    const result = createRedactedPlaceholder('my_secret_value', { showLength: false });
    expect(result).not.toContain('chars');
    expect(result).toBe('[REDACTED]');
  });

  it('should combine type and hint', () => {
    const result = createRedactedPlaceholder('my_secret_value', {
      type: 'TOKEN',
      showHint: true,
    });
    expect(result).toContain('TOKEN');
    expect(result).toContain('my...ue');
  });
});

describe('redact', () => {
  it('should return empty string unchanged', () => {
    expect(redact('')).toBe('');
  });

  it('should redact Bearer tokens', () => {
    const input = 'Authorization: Bearer abc123xyz789';
    const result = redact(input);
    expect(result).toContain(REDACTED_TOKEN);
    expect(result).not.toContain('abc123xyz789');
  });

  it('should redact API keys in key=value format', () => {
    const input = 'api_key=' + 'a'.repeat(20); // Generic long key
    const result = redact(input);
    expect(result).toContain(REDACTED_API_KEY);
    expect(result).not.toContain('a'.repeat(20));
  });

  it('should redact passwords', () => {
    const input = 'password=mysecretpassword';
    const result = redact(input);
    expect(result).toContain(REDACTED_PASSWORD);
    expect(result).not.toContain('mysecretpassword');
  });

  it('should redact connection strings', () => {
    const input = 'mongodb://user:secretpass@localhost:27017';
    const result = redact(input);
    expect(result).toContain(REDACTED_PASSWORD);
    expect(result).not.toContain('secretpass');
    expect(result).toContain('user'); // Username should remain
  });

  it('should redact JWT tokens', () => {
    // JWT pattern: three base64 segments separated by dots
    // Using a constructed example to avoid pre-commit false positives
    const header = 'eyJhbGciOiJIUzI1NiJ9';
    const payload = 'eyJzdWIiOiIxMjM0NTY3ODkwIn0';
    const signature = 'abc123';
    const input = `token: ${header}.${payload}.${signature}`;
    const result = redact(input);
    expect(result).toContain(REDACTED_TOKEN);
    expect(result).not.toContain(header);
  });

  it('should not modify text without secrets', () => {
    const input = 'This is a normal log message with no secrets';
    const result = redact(input);
    expect(result).toBe(input);
  });

  it('should handle multiple secrets in one string', () => {
    const input = 'password=secret1 and api_key=secret2secret2secret2';
    const result = redact(input);
    expect(result).not.toContain('secret1');
    expect(result).not.toContain('secret2');
  });
});

describe('redactObject', () => {
  it('should return null/undefined unchanged', () => {
    expect(redactObject(null)).toBeNull();
    expect(redactObject(undefined)).toBeUndefined();
  });

  it('should redact string values', () => {
    const result = redactObject('password=mysecret');
    expect(result).toContain(REDACTED_PASSWORD);
  });

  it('should redact values in object properties', () => {
    const obj = {
      message: 'Connecting with password=mysecret',
      data: 'normal data',
    };
    const result = redactObject(obj);
    expect(result.message).toContain(REDACTED_PASSWORD);
    expect(result.data).toBe('normal data');
  });

  it('should redact nested objects', () => {
    const obj = {
      outer: {
        inner: 'api_key=supersecretkey12345',
      },
    };
    const result = redactObject(obj);
    expect(result.outer.inner).toContain(REDACTED_API_KEY);
  });

  it('should redact arrays', () => {
    const arr = ['normal', 'password=secret123'];
    const result = redactObject(arr);
    expect(result[0]).toBe('normal');
    expect(result[1]).toContain(REDACTED_PASSWORD);
  });

  it('should redact sensitive key values entirely', () => {
    const obj = {
      username: 'admin',
      password: 'mysecretpassword',
      apiKey: 'key123456',
    };
    const result = redactObject(obj);
    expect(result.username).toBe('admin');
    expect(result.password).toBe(REDACTED_PLACEHOLDER);
    expect(result.apiKey).toBe(REDACTED_PLACEHOLDER);
  });

  it('should handle complex nested structures', () => {
    const obj = {
      config: {
        database: {
          host: 'localhost',
          // Note: 'credentials' is itself a sensitive key, so entire value is redacted
          credentials: {
            password: 'dbpass123',
          },
        },
      },
      items: [{ secret: 'hidden' }],
    };
    const result = redactObject(obj);
    expect(result.config.database.host).toBe('localhost');
    // 'credentials' is a sensitive key, so the entire nested object is replaced
    expect(result.config.database.credentials as unknown).toBe(REDACTED_PLACEHOLDER);
    expect((result.items[0] as Record<string, unknown>).secret).toBe(REDACTED_PLACEHOLDER);
  });
});

describe('isSensitiveKey', () => {
  it('should identify password variations', () => {
    expect(isSensitiveKey('password')).toBe(true);
    expect(isSensitiveKey('PASSWORD')).toBe(true);
    expect(isSensitiveKey('passwd')).toBe(true);
    expect(isSensitiveKey('userPassword')).toBe(true);
  });

  it('should identify API key variations', () => {
    expect(isSensitiveKey('apiKey')).toBe(true);
    expect(isSensitiveKey('api_key')).toBe(true);
    expect(isSensitiveKey('API_KEY')).toBe(true);
    expect(isSensitiveKey('apikey')).toBe(true);
  });

  it('should identify token variations', () => {
    expect(isSensitiveKey('token')).toBe(true);
    expect(isSensitiveKey('accessToken')).toBe(true);
    expect(isSensitiveKey('refresh_token')).toBe(true);
  });

  it('should identify secret variations', () => {
    expect(isSensitiveKey('secret')).toBe(true);
    expect(isSensitiveKey('clientSecret')).toBe(true);
    expect(isSensitiveKey('secret_key')).toBe(true);
  });

  it('should identify auth/credential variations', () => {
    expect(isSensitiveKey('auth')).toBe(true);
    expect(isSensitiveKey('authorization')).toBe(true);
    expect(isSensitiveKey('credentials')).toBe(true);
  });

  it('should not flag normal keys', () => {
    expect(isSensitiveKey('username')).toBe(false);
    expect(isSensitiveKey('email')).toBe(false);
    expect(isSensitiveKey('name')).toBe(false);
    expect(isSensitiveKey('id')).toBe(false);
  });
});

describe('createRedactedContext', () => {
  it('should show context around redacted secret', () => {
    const text = 'The API key is supersecret123 in this config';
    const result = createRedactedContext(text, 15, 29, 10);
    expect(result).toContain('[REDACTED');
    expect(result).not.toContain('supersecret123');
  });

  it('should handle secret at start of string', () => {
    const text = 'secretvalue at start';
    const result = createRedactedContext(text, 0, 11, 5);
    expect(result).toContain('[REDACTED');
  });

  it('should handle secret at end of string', () => {
    const text = 'at end secretvalue';
    const result = createRedactedContext(text, 7, 18, 5);
    expect(result).toContain('[REDACTED');
  });

  it('should respect context character limit', () => {
    const text = 'aaaaa secret bbbbb';
    const result = createRedactedContext(text, 6, 12, 3);
    // Should have ~3 chars before and ~3 chars after the redacted placeholder
    // The placeholder itself may be longer than original, but context is limited
    // With 3 chars context: "aa " (positions 3-5) before, " bb" (positions 12-14) after
    expect(result).toContain('[REDACTED');
    expect(result).toContain('aa '); // 3 chars before position 6
    expect(result).toContain(' bb'); // 3 chars after position 12
    expect(result).not.toContain('aaaaa'); // Not full prefix
  });
});

describe('createRedactionPattern', () => {
  it('should create pattern with string replacement', () => {
    const pattern = createRedactionPattern(/test/g, '[HIDDEN]');
    expect(pattern.pattern).toEqual(/test/g);
    expect(pattern.replacement).toBe('[HIDDEN]');
  });

  it('should create pattern with function replacement', () => {
    const replacer = (match: string) => `[${match.length}]`;
    const pattern = createRedactionPattern(/test/g, replacer);
    expect(typeof pattern.replacement).toBe('function');
  });

  it('should include type when provided', () => {
    const pattern = createRedactionPattern(/test/g, '[HIDDEN]', 'custom');
    expect(pattern.type).toBe('custom');
  });

  it('should not include type when not provided', () => {
    const pattern = createRedactionPattern(/test/g, '[HIDDEN]');
    expect(pattern.type).toBeUndefined();
  });
});

describe('mergePatterns', () => {
  it('should include builtin patterns by default', () => {
    const custom = [createRedactionPattern(/custom/g, '[CUSTOM]')];
    const merged = mergePatterns(custom);
    expect(merged.length).toBe(BUILTIN_REDACTION_PATTERNS.length + 1);
  });

  it('should exclude builtin patterns when requested', () => {
    const custom = [createRedactionPattern(/custom/g, '[CUSTOM]')];
    const merged = mergePatterns(custom, false);
    expect(merged.length).toBe(1);
  });

  it('should put builtin patterns first', () => {
    const custom = [createRedactionPattern(/custom/g, '[CUSTOM]', 'custom')];
    const merged = mergePatterns(custom);
    // Custom pattern should be at the end
    const lastPattern = merged[merged.length - 1];
    expect(lastPattern).toBeDefined();
    expect(lastPattern!.type).toBe('custom');
  });
});

describe('BUILTIN_REDACTION_PATTERNS', () => {
  it('should have multiple patterns', () => {
    expect(BUILTIN_REDACTION_PATTERNS.length).toBeGreaterThan(5);
  });

  it('should have typed patterns', () => {
    const types = BUILTIN_REDACTION_PATTERNS.map((p) => p.type).filter(Boolean);
    expect(types).toContain('api_key');
    expect(types).toContain('bearer_token');
    expect(types).toContain('password');
  });
});
