/**
 * EP22 US-005 T055: OTLP exporter sanitizes sensitive data
 * Verify no prompts, file contents, or API keys are exported.
 */

import { describe, it, expect } from 'bun:test';
import type { ExportableSpan } from '../../../src/observability/exporters/local-exporter';
import { sanitizeSpanForExport } from '../../../src/observability/exporters/otlp-exporter';

describe('OTLP data sanitization', () => {
  // Helper to create a test span with sensitive attributes
  function createTestSpan(attributes: Record<string, string | number | boolean>): ExportableSpan {
    return {
      traceId: '0123456789abcdef0123456789abcdef',
      spanId: '0123456789abcdef',
      name: 'test.operation',
      kind: 'internal',
      startTime: Date.now(),
      endTime: Date.now() + 1000,
      durationMs: 1000,
      status: { code: 'ok' },
      attributes,
      events: [],
    };
  }

  // Test data factories for common patterns
  const sensitiveData = {
    promptWithSecrets: 'Analyze this file: /Users/alice/secrets.txt with API key sk-secret',
    systemPromptWithKey: 'You are a helpful assistant. Use API key: ghp_secret',
    completionWithPassword: 'The file contains: password=secret123',
    fileContentWithSecret: 'File contents with secret: sk-ant-123',
    apiResponse: 'API response: {"api_key": "sk-live-xyz"}',
    apiKey: 'sk-ant-api03xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // Realistic fake Anthropic key (no underscores)
    tokenConfig: 'token=ghp-1234567890abcdefghijklmnopqrstuvwxyz', // Realistic fake GitHub token
    eventPrompt: 'Use API key sk-ant-api03xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    eventResult: 'File contents: password=secretpassword123',
  };

  const safeAttributes = {
    'llm.model': 'claude-sonnet-4',
    'llm.provider': 'anthropic',
    'llm.usage.input_tokens': 150,
    'llm.usage.output_tokens': 75,
    'tool.name': 'analyze_config',
    'session.id': 'abc-123',
    'error.type': 'ValidationError',
  };

  // Helper to test sensitive attribute redaction
  function testSensitiveRedaction(
    attributeName: string,
    sensitiveValue: string,
    expectedRedaction: string,
    safeAttributeName: string,
    safeValue: string | number
  ) {
    const span = createTestSpan({
      [attributeName]: sensitiveValue,
      [safeAttributeName]: safeValue,
    });

    const sanitized = sanitizeSpanForExport(span);

    expect(sanitized.attributes[attributeName]).toBe(expectedRedaction);
    expect(sanitized.attributes[safeAttributeName]).toBe(safeValue);
  }

  it('should redact gen_ai.prompt.user attributes', () => {
    testSensitiveRedaction(
      'gen_ai.prompt.user',
      sensitiveData.promptWithSecrets,
      '[REDACTED:PROMPT]',
      'llm.model',
      'claude-sonnet-4'
    );
  });

  it('should redact gen_ai.prompt.system attributes', () => {
    testSensitiveRedaction(
      'gen_ai.prompt.system',
      sensitiveData.systemPromptWithKey,
      '[REDACTED:PROMPT]',
      'llm.provider',
      'anthropic'
    );
  });

  it('should redact gen_ai.completion attributes', () => {
    testSensitiveRedaction(
      'gen_ai.completion',
      sensitiveData.completionWithPassword,
      '[REDACTED:COMPLETION]',
      'llm.usage.input_tokens',
      100
    );
  });

  it('should redact tool.arguments.content attributes', () => {
    testSensitiveRedaction(
      'tool.arguments.content',
      sensitiveData.fileContentWithSecret,
      '[REDACTED:FILE_CONTENT]',
      'tool.name',
      'read_file'
    );
  });

  it('should redact tool.result attributes', () => {
    testSensitiveRedaction(
      'tool.result',
      sensitiveData.apiResponse,
      '[REDACTED:TOOL_OUTPUT]',
      'tool.name',
      'execute'
    );
  });

  it('should redact API keys in any attribute value', () => {
    const span = createTestSpan({
      'api.endpoint': 'https://api.example.com',
      'api.key': sensitiveData.apiKey,
      'custom.config': sensitiveData.tokenConfig,
    });

    const sanitized = sanitizeSpanForExport(span);

    expect(sanitized.attributes['api.endpoint']).toBe('https://api.example.com');
    // The existing redact() function from src/debug/redaction.ts should handle these
    expect(sanitized.attributes['api.key']).toContain('[REDACTED');
    expect(sanitized.attributes['custom.config']).toContain('[REDACTED');
  });

  it('should preserve safe attributes unchanged', () => {
    const span = createTestSpan(safeAttributes);

    const sanitized = sanitizeSpanForExport(span);

    expect(sanitized.attributes).toEqual(span.attributes);
  });

  it('should redact sensitive data in span events', () => {
    const span: ExportableSpan = {
      ...createTestSpan({}),
      events: [
        {
          name: 'prompt.sent',
          timestamp: Date.now(),
          attributes: {
            prompt: sensitiveData.eventPrompt,
            model: 'claude-opus-4',
          },
        },
        {
          name: 'tool.completed',
          timestamp: Date.now(),
          attributes: {
            result: sensitiveData.eventResult,
          },
        },
      ],
    };

    const sanitized = sanitizeSpanForExport(span);

    expect(sanitized.events).toHaveLength(2);
    expect(sanitized.events[0]?.attributes?.prompt).toContain('[REDACTED');
    expect(sanitized.events[0]?.attributes?.model).toBe('claude-opus-4');
    expect(sanitized.events[1]?.attributes?.result).toContain('[REDACTED');
  });
});
