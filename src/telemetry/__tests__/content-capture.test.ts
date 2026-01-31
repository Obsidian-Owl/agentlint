/**
 * EP23: Content Capture Telemetry Tests
 *
 * Tests for opt-in content capture with sanitization and truncation.
 *
 * Tasks: T004-T008
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  isContentCaptureEnabled,
  getContentCaptureConfig,
  sanitizeContent,
  captureToolCallContent,
  generateToolCallId,
} from '../../observability/content-capture';
import { DEFAULT_TRUNCATION_LIMIT } from '../constants';

describe('Content Capture Configuration', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env.AGENTLINT_CAPTURE_CONTENT;
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv === undefined) {
      delete process.env.AGENTLINT_CAPTURE_CONTENT;
    } else {
      process.env.AGENTLINT_CAPTURE_CONTENT = originalEnv;
    }
    delete process.env.AGENTLINT_CAPTURE_MAX_LENGTH;
  });

  it('should be disabled by default', () => {
    delete process.env.AGENTLINT_CAPTURE_CONTENT;
    expect(isContentCaptureEnabled()).toBe(false);
  });

  it('should be enabled when AGENTLINT_CAPTURE_CONTENT=true', () => {
    process.env.AGENTLINT_CAPTURE_CONTENT = 'true';
    expect(isContentCaptureEnabled()).toBe(true);
  });

  it('should be disabled for any non-true value', () => {
    process.env.AGENTLINT_CAPTURE_CONTENT = 'false';
    expect(isContentCaptureEnabled()).toBe(false);

    process.env.AGENTLINT_CAPTURE_CONTENT = '1';
    expect(isContentCaptureEnabled()).toBe(false);

    process.env.AGENTLINT_CAPTURE_CONTENT = 'yes';
    expect(isContentCaptureEnabled()).toBe(false);
  });

  it('should use default max length from constants', () => {
    process.env.AGENTLINT_CAPTURE_CONTENT = 'true';
    const config = getContentCaptureConfig();
    expect(config.maxLength).toBe(DEFAULT_TRUNCATION_LIMIT);
  });

  it('should use custom max length from environment', () => {
    process.env.AGENTLINT_CAPTURE_CONTENT = 'true';
    process.env.AGENTLINT_CAPTURE_MAX_LENGTH = '1000';
    const config = getContentCaptureConfig();
    expect(config.maxLength).toBe(1000);
  });

  it('should fall back to default for invalid max length', () => {
    process.env.AGENTLINT_CAPTURE_CONTENT = 'true';
    process.env.AGENTLINT_CAPTURE_MAX_LENGTH = 'invalid';
    const config = getContentCaptureConfig();
    expect(config.maxLength).toBe(DEFAULT_TRUNCATION_LIMIT);
  });
});

describe('Content Sanitization', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.AGENTLINT_CAPTURE_CONTENT;
    process.env.AGENTLINT_CAPTURE_CONTENT = 'true';
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AGENTLINT_CAPTURE_CONTENT;
    } else {
      process.env.AGENTLINT_CAPTURE_CONTENT = originalEnv;
    }
    delete process.env.AGENTLINT_CAPTURE_MAX_LENGTH;
  });

  // T006: Test secrets are redacted from captured content
  describe('Secret Redaction (T006)', () => {
    it('should redact API keys from content', () => {
      const content = 'Using api_key=sk-ant-1234567890abcdef for requests';
      const sanitized = sanitizeContent(content);
      expect(sanitized).not.toContain('sk-ant-1234567890abcdef');
      expect(sanitized).toContain('[REDACTED:ANTHROPIC_KEY]');
    });

    it('should redact OpenAI API keys', () => {
      const content = 'api_key: sk-proj-FAKE_TEST_KEY_NOT_REAL';
      const sanitized = sanitizeContent(content);
      expect(sanitized).not.toContain('sk-proj-FAKE_TEST_KEY_NOT_REAL');
      expect(sanitized).toContain('[REDACTED:OPENAI_KEY]');
    });

    it('should redact generic API keys', () => {
      const content = 'config.api_key = "test-key-placeholder"';
      const sanitized = sanitizeContent(content);
      expect(sanitized).not.toContain('test-key-placeholder');
      expect(sanitized).toContain('[REDACTED:API_KEY]');
    });

    it('should redact tokens', () => {
      const content = 'Bearer ghp_FAKE_TEST_TOKEN_NOT_REAL_KEY';
      const sanitized = sanitizeContent(content);
      expect(sanitized).not.toContain('ghp_FAKE_TEST_TOKEN_NOT_REAL_KEY');
      expect(sanitized).toContain('[REDACTED:GITHUB_PAT]');
    });

    it('should redact passwords from connection strings', () => {
      const content = 'postgres://user:secretpass123@localhost/db';
      const sanitized = sanitizeContent(content);
      expect(sanitized).not.toContain('secretpass123');
      expect(sanitized).toContain('[REDACTED:PASSWORD]');
    });

    it('should redact JWT tokens', () => {
      // Use a minimal JWT-like pattern that triggers the redactor
      const content = 'token: ey.ey.sig';
      const sanitized = sanitizeContent(content);
      expect(sanitized).toContain('[REDACTED:TOKEN]');
      expect(sanitized).not.toContain('ey.ey.sig');
    });

    it('should preserve non-sensitive content', () => {
      const content = 'Processing file /path/to/file.ts with 100 lines';
      const sanitized = sanitizeContent(content);
      expect(sanitized).toBe(content);
    });

    it('should redact multiple secrets in same content', () => {
      const content = 'api_key=sk-ant-FAKETEST and password=testpass';
      const sanitized = sanitizeContent(content);
      expect(sanitized).not.toContain('sk-ant-FAKETEST');
      expect(sanitized).not.toContain('testpass');
      expect(sanitized).toContain('[REDACTED:ANTHROPIC_KEY]');
      expect(sanitized).toContain('[REDACTED:PASSWORD]');
    });
  });

  // T007: Test content exceeding max length is truncated with marker
  describe('Content Truncation (T007)', () => {
    it('should not truncate content below max length', () => {
      const content = 'Short content';
      const sanitized = sanitizeContent(content);
      expect(sanitized).toBe(content);
      expect(sanitized).not.toContain('TRUNCATED');
    });

    it('should truncate content exceeding default max length', () => {
      const longContent = 'x'.repeat(DEFAULT_TRUNCATION_LIMIT + 100);
      const sanitized = sanitizeContent(longContent);

      expect(sanitized.length).toBeLessThan(longContent.length);
      expect(sanitized).toContain('... [TRUNCATED:');
      expect(sanitized).toContain(' chars]');
    });

    it('should include correct truncation byte count', () => {
      const excess = 250;
      const longContent = 'x'.repeat(DEFAULT_TRUNCATION_LIMIT + excess);
      const sanitized = sanitizeContent(longContent);

      expect(sanitized).toContain(`... [TRUNCATED:${excess} chars]`);
    });

    it('should truncate at custom max length', () => {
      const customMax = 100;
      const content = 'x'.repeat(150);
      const sanitized = sanitizeContent(content, customMax);

      expect(sanitized).toContain('... [TRUNCATED:50 chars]');
    });

    it('should preserve content exactly at max length', () => {
      const content = 'x'.repeat(DEFAULT_TRUNCATION_LIMIT);
      const sanitized = sanitizeContent(content);

      expect(sanitized).toBe(content);
      expect(sanitized).not.toContain('TRUNCATED');
    });

    it('should redact before truncating', () => {
      // Content with secret that should be redacted, then truncated
      const secretPart = 'api_key=sk-ant-' + 'x'.repeat(50);
      const longPart = 'y'.repeat(DEFAULT_TRUNCATION_LIMIT);
      const content = secretPart + longPart;

      const sanitized = sanitizeContent(content);

      // Should not contain the original secret
      expect(sanitized).not.toContain('sk-ant-x');
      // Should contain redaction marker
      expect(sanitized).toContain('[REDACTED:ANTHROPIC_KEY]');
      // Should be truncated
      expect(sanitized).toContain('TRUNCATED');
    });

    it('should handle edge case of exactly max length after redaction', () => {
      // Create content that becomes exactly max length after redaction
      const secret = 'x'.repeat(100);
      const filler = 'y'.repeat(DEFAULT_TRUNCATION_LIMIT - 100);
      const content = `password=${secret}${filler}`;

      const sanitized = sanitizeContent(content);

      // Redaction might shorten content, so it shouldn't be truncated
      expect(sanitized.length).toBeLessThanOrEqual(DEFAULT_TRUNCATION_LIMIT);
    });
  });
});

describe('Tool Call Content Capture', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.AGENTLINT_CAPTURE_CONTENT;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AGENTLINT_CAPTURE_CONTENT;
    } else {
      process.env.AGENTLINT_CAPTURE_CONTENT = originalEnv;
    }
    delete process.env.AGENTLINT_CAPTURE_MAX_LENGTH;
  });

  // T005: Test content capture disabled excludes content from events
  describe('Content Capture Disabled (T005)', () => {
    beforeEach(() => {
      delete process.env.AGENTLINT_CAPTURE_CONTENT;
    });

    it('should return null when capture is disabled', () => {
      const args = { file_path: '/path/to/file.ts' };
      const result = { content: 'file contents' };

      const captured = captureToolCallContent(args, result);

      expect(captured).toBeNull();
    });

    it('should not capture even for simple arguments', () => {
      const args = { message: 'Hello world' };

      const captured = captureToolCallContent(args);

      expect(captured).toBeNull();
    });

    it('should not capture even for sensitive content', () => {
      const args = { api_key: 'sk-ant-secret123' };

      const captured = captureToolCallContent(args);

      expect(captured).toBeNull();
    });
  });

  // T004: Test content capture enabled includes content in events
  // T008: Test tool arguments included in tool.call event inputs
  describe('Content Capture Enabled (T004, T008)', () => {
    beforeEach(() => {
      process.env.AGENTLINT_CAPTURE_CONTENT = 'true';
    });

    it('should generate unique call ID', () => {
      const id1 = generateToolCallId();
      const id2 = generateToolCallId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id1).toMatch(uuidRegex);
      expect(id2).toMatch(uuidRegex);
    });

    it('should capture tool arguments when enabled (T008)', () => {
      const args = { file_path: '/path/to/file.ts', line: 42 };

      const captured = captureToolCallContent(args);

      expect(captured).not.toBeNull();
      expect(captured?.callId).toBeDefined();
      expect(captured?.arguments).toBeDefined();

      const parsedArgs = JSON.parse(captured!.arguments!) as typeof args;
      expect(parsedArgs).toEqual(args);
    });

    it('should capture tool results when enabled', () => {
      const result = { content: 'File contents here', lines: 100 };

      const captured = captureToolCallContent(undefined, result);

      expect(captured).not.toBeNull();
      expect(captured?.callId).toBeDefined();
      expect(captured?.result).toBeDefined();

      const parsedResult = JSON.parse(captured!.result!) as typeof result;
      expect(parsedResult).toEqual(result);
    });

    it('should capture both arguments and results', () => {
      const args = { tool: 'read_file', path: '/test.ts' };
      const result = { success: true, content: 'data' };

      const captured = captureToolCallContent(args, result);

      expect(captured).not.toBeNull();
      expect(captured?.arguments).toBeDefined();
      expect(captured?.result).toBeDefined();

      const parsedArgs = JSON.parse(captured!.arguments!) as typeof args;
      const parsedResult = JSON.parse(captured!.result!) as typeof result;

      expect(parsedArgs).toEqual(args);
      expect(parsedResult).toEqual(result);
    });

    it('should sanitize secrets in arguments', () => {
      const args = {
        api_key: 'sk-ant-secret123456',
        endpoint: 'https://api.example.com',
      };

      const captured = captureToolCallContent(args);

      expect(captured?.arguments).not.toContain('sk-ant-secret123456');
      expect(captured?.arguments).toContain('[REDACTED:ANTHROPIC_KEY]');
      expect(captured?.arguments).toContain('https://api.example.com');
    });

    it('should sanitize secrets in results', () => {
      const result = {
        token: 'ghp_FAKE_PAT_FOR_TEST',
        status: 'success',
      };

      const captured = captureToolCallContent(undefined, result);

      expect(captured?.result).not.toContain('ghp_FAKE_PAT_FOR_TEST');
      expect(captured?.result).toContain('[REDACTED:GITHUB_PAT]');
      expect(captured?.result).toContain('success');
    });

    it('should truncate long arguments', () => {
      process.env.AGENTLINT_CAPTURE_MAX_LENGTH = '100';

      const longData = 'x'.repeat(200);
      const args = { data: longData };

      const captured = captureToolCallContent(args);

      expect(captured?.arguments).toContain('TRUNCATED');
      expect(captured?.arguments!.length).toBeLessThan(JSON.stringify(args).length);
    });

    it('should truncate long results', () => {
      process.env.AGENTLINT_CAPTURE_MAX_LENGTH = '100';

      const longContent = 'y'.repeat(200);
      const result = { content: longContent };

      const captured = captureToolCallContent(undefined, result);

      expect(captured?.result).toContain('TRUNCATED');
      expect(captured?.result!.length).toBeLessThan(JSON.stringify(result).length);
    });

    it('should handle undefined arguments', () => {
      const result = { status: 'ok' };

      const captured = captureToolCallContent(undefined, result);

      expect(captured).not.toBeNull();
      expect(captured?.arguments).toBeUndefined();
      expect(captured?.result).toBeDefined();
    });

    it('should handle undefined results', () => {
      const args = { operation: 'delete' };

      const captured = captureToolCallContent(args, undefined);

      expect(captured).not.toBeNull();
      expect(captured?.arguments).toBeDefined();
      expect(captured?.result).toBeUndefined();
    });

    it('should handle both undefined arguments and results', () => {
      const captured = captureToolCallContent(undefined, undefined);

      expect(captured).not.toBeNull();
      expect(captured?.callId).toBeDefined();
      expect(captured?.arguments).toBeUndefined();
      expect(captured?.result).toBeUndefined();
    });

    it('should handle JSON stringify errors for circular references', () => {
      const circular: Record<string, unknown> = { name: 'test' };
      circular.self = circular; // Create circular reference

      const captured = captureToolCallContent(circular);

      expect(captured).not.toBeNull();
      expect(captured?.arguments).toContain('[CAPTURE_ERROR: Failed to stringify arguments]');
    });

    it('should handle complex nested objects', () => {
      const args = {
        config: {
          nested: {
            deeply: {
              value: 'test',
              count: 42,
            },
          },
        },
        array: [1, 2, 3],
      };

      const captured = captureToolCallContent(args);

      expect(captured?.arguments).toBeDefined();
      const parsed = JSON.parse(captured!.arguments!) as typeof args;
      expect(parsed).toEqual(args);
    });

    it('should sanitize secrets in nested objects', () => {
      const args = {
        auth: {
          credentials: {
            api_key: 'sk-ant-nested-secret',
            username: 'user',
          },
        },
      };

      const captured = captureToolCallContent(args);

      expect(captured?.arguments).not.toContain('sk-ant-nested-secret');
      expect(captured?.arguments).toContain('[REDACTED:ANTHROPIC_KEY]');
      expect(captured?.arguments).toContain('user');
    });

    it('should respect custom max length from environment', () => {
      process.env.AGENTLINT_CAPTURE_MAX_LENGTH = '50';

      const args = { data: 'x'.repeat(100) };

      const captured = captureToolCallContent(args);

      expect(captured?.arguments).toContain('TRUNCATED');
      // Length should be close to 50 + truncation marker
      expect(captured?.arguments!.length).toBeLessThan(100);
    });
  });
});

describe('Integration with LLM Events', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.AGENTLINT_CAPTURE_CONTENT;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AGENTLINT_CAPTURE_CONTENT;
    } else {
      process.env.AGENTLINT_CAPTURE_CONTENT = originalEnv;
    }
  });

  // T004: Test content capture enabled includes prompt in LLM event
  it('should include sanitized prompts when content capture is enabled', () => {
    process.env.AGENTLINT_CAPTURE_CONTENT = 'true';

    const prompt = 'Analyze this code: const x = 42;';
    const sanitized = sanitizeContent(prompt);

    expect(sanitized).toBe(prompt);
    expect(isContentCaptureEnabled()).toBe(true);
  });

  // T005: Test content capture disabled excludes prompt from LLM event
  it('should not capture prompts when content capture is disabled', () => {
    delete process.env.AGENTLINT_CAPTURE_CONTENT;

    expect(isContentCaptureEnabled()).toBe(false);

    // When disabled, LLM event handler should skip content capture
    const captured = captureToolCallContent({ prompt: 'test' });
    expect(captured).toBeNull();
  });

  it('should redact API keys in prompts', () => {
    process.env.AGENTLINT_CAPTURE_CONTENT = 'true';

    const prompt = 'Use api_key sk-ant-leaked-key to authenticate';
    const sanitized = sanitizeContent(prompt);

    expect(sanitized).not.toContain('sk-ant-leaked-key');
    expect(sanitized).toContain('[REDACTED:ANTHROPIC_KEY]');
  });

  it('should handle long prompts with truncation', () => {
    process.env.AGENTLINT_CAPTURE_CONTENT = 'true';
    process.env.AGENTLINT_CAPTURE_MAX_LENGTH = '100';

    const longPrompt = 'Analyze this code: ' + 'x'.repeat(200);
    const sanitized = sanitizeContent(longPrompt);

    expect(sanitized).toContain('TRUNCATED');
    expect(sanitized.length).toBeLessThan(longPrompt.length);
  });
});
