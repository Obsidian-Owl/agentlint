/**
 * EP22 US-005 T055: OTLP exporter sanitizes sensitive data
 * Verify no prompts, file contents, or API keys are exported.
 */

import { describe, it, expect } from 'bun:test';
import type { ExportableSpan } from '../../../src/observability/exporters/local-exporter';

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

  it('should redact gen_ai.prompt.user attributes', () => {
    const { sanitizeSpanForExport } = require('../../../src/observability/exporters/otlp-exporter');

    const span = createTestSpan({
      'gen_ai.prompt.user': 'Analyze this file: /Users/alice/secrets.txt with API key sk-secret',
      'llm.model': 'claude-sonnet-4',
    });

    const sanitized = sanitizeSpanForExport(span);

    expect(sanitized.attributes['gen_ai.prompt.user']).toBe('[REDACTED:PROMPT]');
    expect(sanitized.attributes['llm.model']).toBe('claude-sonnet-4'); // Not sensitive
  });

  it('should redact gen_ai.prompt.system attributes', () => {
    const { sanitizeSpanForExport } = require('../../../src/observability/exporters/otlp-exporter');

    const span = createTestSpan({
      'gen_ai.prompt.system': 'You are a helpful assistant. Use API key: ghp_secret',
      'llm.provider': 'anthropic',
    });

    const sanitized = sanitizeSpanForExport(span);

    expect(sanitized.attributes['gen_ai.prompt.system']).toBe('[REDACTED:PROMPT]');
    expect(sanitized.attributes['llm.provider']).toBe('anthropic');
  });

  it('should redact gen_ai.completion attributes', () => {
    const { sanitizeSpanForExport } = require('../../../src/observability/exporters/otlp-exporter');

    const span = createTestSpan({
      'gen_ai.completion': 'The file contains: password=secret123',
      'llm.usage.input_tokens': 100,
    });

    const sanitized = sanitizeSpanForExport(span);

    expect(sanitized.attributes['gen_ai.completion']).toBe('[REDACTED:COMPLETION]');
    expect(sanitized.attributes['llm.usage.input_tokens']).toBe(100);
  });

  it('should redact tool.arguments.content attributes', () => {
    const { sanitizeSpanForExport } = require('../../../src/observability/exporters/otlp-exporter');

    const span = createTestSpan({
      'tool.name': 'read_file',
      'tool.arguments.content': 'File contents with secret: sk-ant-123',
    });

    const sanitized = sanitizeSpanForExport(span);

    expect(sanitized.attributes['tool.name']).toBe('read_file');
    expect(sanitized.attributes['tool.arguments.content']).toBe('[REDACTED:FILE_CONTENT]');
  });

  it('should redact tool.result attributes', () => {
    const { sanitizeSpanForExport } = require('../../../src/observability/exporters/otlp-exporter');

    const span = createTestSpan({
      'tool.name': 'execute',
      'tool.result': 'API response: {"api_key": "sk-live-xyz"}',
    });

    const sanitized = sanitizeSpanForExport(span);

    expect(sanitized.attributes['tool.name']).toBe('execute');
    expect(sanitized.attributes['tool.result']).toBe('[REDACTED:TOOL_OUTPUT]');
  });

  it('should redact API keys in any attribute value', () => {
    const { sanitizeSpanForExport } = require('../../../src/observability/exporters/otlp-exporter');

    const span = createTestSpan({
      'api.endpoint': 'https://api.example.com',
      'api.key': 'sk-ant-FAKE_KEY_FOR_TESTING',
      'custom.config': 'token=ghp_FAKE_TOKEN_FOR_TESTING',
    });

    const sanitized = sanitizeSpanForExport(span);

    expect(sanitized.attributes['api.endpoint']).toBe('https://api.example.com');
    // The existing redact() function from src/debug/redaction.ts should handle these
    expect(sanitized.attributes['api.key']).toContain('[REDACTED');
    expect(sanitized.attributes['custom.config']).toContain('[REDACTED');
  });

  it('should preserve safe attributes unchanged', () => {
    const { sanitizeSpanForExport } = require('../../../src/observability/exporters/otlp-exporter');

    const span = createTestSpan({
      'llm.model': 'claude-sonnet-4',
      'llm.provider': 'anthropic',
      'llm.usage.input_tokens': 150,
      'llm.usage.output_tokens': 75,
      'tool.name': 'analyze_config',
      'session.id': 'abc-123',
      'error.type': 'ValidationError',
    });

    const sanitized = sanitizeSpanForExport(span);

    expect(sanitized.attributes).toEqual(span.attributes);
  });

  it('should redact sensitive data in span events', () => {
    const { sanitizeSpanForExport } = require('../../../src/observability/exporters/otlp-exporter');

    const span: ExportableSpan = {
      ...createTestSpan({}),
      events: [
        {
          name: 'prompt.sent',
          timestamp: Date.now(),
          attributes: {
            prompt: 'Use API key sk-ant-api03xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            model: 'claude-opus-4',
          },
        },
        {
          name: 'tool.completed',
          timestamp: Date.now(),
          attributes: {
            result: 'File contents: password=secretpassword123',
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
