/**
 * EP22 US-005 T056: OTLP Exporter
 * Remote export to OTLP/HTTP endpoints with data sanitization.
 */

import { redact } from '../../debug/redaction';
import type { ExportableSpan } from './local-exporter';

// =============================================================================
// Types
// =============================================================================

/** OTLP exporter configuration */
export interface OtlpExporterConfig {
  /** OTLP endpoint URL (e.g., http://localhost:4318/v1/traces) */
  endpoint: string;
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
  /** Custom headers for authentication */
  headers?: Record<string, string>;
}

// =============================================================================
// Data Sanitization
// =============================================================================

/**
 * Sensitive attribute patterns that should be redacted.
 * These follow OpenTelemetry semantic conventions for GenAI and custom tool attributes.
 */
const SENSITIVE_ATTRIBUTE_PATTERNS = [
  // GenAI semantic conventions (prompts and completions)
  /^gen_ai\.prompt\.(user|system)$/,
  /^gen_ai\.completion$/,

  // Tool-specific attributes (file contents and results)
  /^tool\.arguments\.content$/,
  /^tool\.result$/,
];

/**
 * Check if an attribute key is sensitive and should be redacted.
 */
function isSensitiveAttribute(key: string): boolean {
  return SENSITIVE_ATTRIBUTE_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Get redaction label based on attribute name.
 */
function getRedactionLabel(key: string): string {
  if (key.includes('prompt.user') || key.includes('prompt.system')) {
    return '[REDACTED:PROMPT]';
  }
  if (key.includes('completion')) {
    return '[REDACTED:COMPLETION]';
  }
  if (key.includes('arguments.content')) {
    return '[REDACTED:FILE_CONTENT]';
  }
  if (key.includes('result')) {
    return '[REDACTED:TOOL_OUTPUT]';
  }
  return '[REDACTED]';
}

/**
 * Sanitize span attributes for export.
 * Redacts prompts, completions, file contents, and API keys.
 */
function sanitizeAttributes(
  attributes: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(attributes)) {
    // Check if attribute key is inherently sensitive
    if (isSensitiveAttribute(key)) {
      sanitized[key] = getRedactionLabel(key);
      continue;
    }

    // For string values, ALWAYS apply redaction (catches API keys in any field)
    if (typeof value === 'string') {
      const redacted = redact(value);
      sanitized[key] = redacted;
    } else {
      // Numbers and booleans are safe
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize span events for export.
 * Applies same redaction rules to event attributes.
 */
function sanitizeEvents(
  events: Array<{
    name: string;
    timestamp: number;
    attributes?: Record<string, unknown>;
  }>
): Array<{
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}> {
  return events.map((event) => {
    if (!event.attributes) {
      return {
        name: event.name,
        timestamp: event.timestamp,
      };
    }
    return {
      name: event.name,
      timestamp: event.timestamp,
      attributes: sanitizeAttributes(
        event.attributes as Record<string, string | number | boolean>
      ) as Record<string, unknown>,
    };
  });
}

/**
 * Sanitize a span before export.
 * Ensures no sensitive data (prompts, file contents, API keys) is transmitted.
 *
 * @param span - Span to sanitize
 * @returns Sanitized span safe for remote export
 */
export function sanitizeSpanForExport(span: ExportableSpan): ExportableSpan {
  return {
    ...span,
    attributes: sanitizeAttributes(span.attributes),
    events: sanitizeEvents(span.events),
  };
}

// =============================================================================
// OtlpSpanExporter
// =============================================================================

/**
 * OTLP/HTTP span exporter.
 * Sends spans to remote OTLP collectors with automatic sanitization.
 *
 * Implements the same SpanExporter interface as LocalSpanExporter for consistency.
 */
export class OtlpSpanExporter {
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly headers: Record<string, string>;

  constructor(config: OtlpExporterConfig) {
    this.endpoint = config.endpoint;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  /**
   * Export spans to OTLP endpoint.
   * Sanitizes data before transmission.
   */
  async export(spans: ExportableSpan[]): Promise<void> {
    if (spans.length === 0) {
      return;
    }

    // Sanitize all spans before export
    const sanitizedSpans = spans.map((span) => sanitizeSpanForExport(span));

    // Convert to OTLP JSON format
    const payload = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'agentlint' } },
              { key: 'service.version', value: { stringValue: '1.0.0' } },
            ],
          },
          scopeSpans: [
            {
              scope: {
                name: 'agentlint-observability',
                version: '1.0.0',
              },
              spans: sanitizedSpans.map((span) => this.convertToOtlpSpan(span)),
            },
          ],
        },
      ],
    };

    // Send to OTLP endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        // Log failure but don't throw - telemetry is non-critical
        console.error(`[OTLP] Export failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      // Log but don't crash - telemetry failures should not break the app
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[OTLP] Export timeout after ${this.timeoutMs}ms`);
      } else {
        console.error(
          `[OTLP] Export error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Convert ExportableSpan to OTLP JSON span format.
   */
  private convertToOtlpSpan(span: ExportableSpan): unknown {
    return {
      traceId: this.hexToBase64(span.traceId),
      spanId: this.hexToBase64(span.spanId),
      parentSpanId: span.parentSpanId ? this.hexToBase64(span.parentSpanId) : undefined,
      name: span.name,
      kind: this.mapSpanKind(span.kind),
      startTimeUnixNano: String(span.startTime * 1_000_000), // ms to ns
      endTimeUnixNano: String(span.endTime * 1_000_000), // ms to ns
      attributes: this.convertAttributes(span.attributes),
      events: span.events.map((event) => ({
        name: event.name,
        timeUnixNano: String(event.timestamp * 1_000_000),
        attributes: event.attributes
          ? this.convertAttributes(event.attributes as Record<string, string | number | boolean>)
          : [],
      })),
      status: {
        code: this.mapStatusCode(span.status.code),
        message: span.status.message,
      },
    };
  }

  /**
   * Convert hex string to base64 (OTLP format).
   */
  private hexToBase64(hex: string): string {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return Buffer.from(bytes).toString('base64');
  }

  /**
   * Map span kind to OTLP numeric enum.
   */
  private mapSpanKind(kind: 'internal' | 'client' | 'server'): number {
    switch (kind) {
      case 'internal':
        return 1;
      case 'server':
        return 2;
      case 'client':
        return 3;
      default:
        return 0; // UNSPECIFIED
    }
  }

  /**
   * Map status code to OTLP numeric enum.
   */
  private mapStatusCode(code: 'ok' | 'error' | 'unset'): number {
    switch (code) {
      case 'unset':
        return 0;
      case 'ok':
        return 1;
      case 'error':
        return 2;
      default:
        return 0;
    }
  }

  /**
   * Convert attributes to OTLP format.
   */
  private convertAttributes(attributes: Record<string, string | number | boolean>): Array<{
    key: string;
    value: { stringValue?: string; intValue?: string; boolValue?: boolean };
  }> {
    return Object.entries(attributes).map(([key, value]) => {
      if (typeof value === 'string') {
        return { key, value: { stringValue: value } };
      }
      if (typeof value === 'number') {
        return { key, value: { intValue: String(value) } };
      }
      return { key, value: { boolValue: value } };
    });
  }

  /**
   * Flush buffered spans (no-op for HTTP exporter).
   */
  flush(): void {
    // HTTP export is immediate, no buffering
  }

  /**
   * Shutdown exporter (cleanup).
   */
  shutdown(): void {
    // No persistent connections to close
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an OTLP span exporter.
 * @param config - Exporter configuration
 * @returns Configured OtlpSpanExporter
 */
export function createOtlpExporter(config: OtlpExporterConfig): OtlpSpanExporter {
  return new OtlpSpanExporter(config);
}
