/**
 * EP22 US-005 T058: OTEL Telemetry Client
 * Bridges telemetry events to OTLP spans.
 */

import * as crypto from 'node:crypto';
import type { TelemetryConfig } from '../persistence/types';
import type {
  ITelemetryClient,
  SessionStartData,
  SessionMetrics,
  TrackToolOptions,
  TrackLLMOptions,
  TrackPromptOptions,
} from './types';
import type { TelemetryEvent } from './events';
import {
  createOtlpExporter,
  type OtlpSpanExporter,
} from '../observability/exporters/otlp-exporter';
import type { ExportableSpan } from '../observability/exporters/local-exporter';

/**
 * OTEL telemetry client.
 * Converts telemetry events to OpenTelemetry spans and exports via OTLP.
 */
export class OtelTelemetryClient implements ITelemetryClient {
  readonly mode = 'otel' as const;
  private exporter: OtlpSpanExporter | null = null;
  private enabled = false;
  private sessionSpans = new Map<string, ExportableSpan>();
  private pendingSpans: ExportableSpan[] = [];

  init(config: TelemetryConfig): Promise<void> {
    if (!config.enabled || config.mode !== 'otel') {
      this.enabled = false;
      return Promise.resolve();
    }

    if (!config.endpoint) {
      console.warn('[OTEL] No endpoint configured, telemetry disabled');
      this.enabled = false;
      return Promise.resolve();
    }

    this.exporter = createOtlpExporter({
      endpoint: config.endpoint,
      timeoutMs: 10000,
    });

    this.enabled = true;
    return Promise.resolve();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  record(event: TelemetryEvent): void {
    // Generic event recording - convert to span
    const span: ExportableSpan = {
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
      name: `telemetry.${event.type}`,
      kind: 'internal',
      startTime: Date.now(),
      endTime: Date.now(),
      durationMs: 0,
      status: { code: 'ok' },
      attributes: {
        'event.type': event.type,
        ...this.flattenData(event.data),
      },
      events: [],
    };

    this.pendingSpans.push(span);
  }

  sessionStart(sessionId: string, data?: SessionStartData): void {
    const span: ExportableSpan = {
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
      name: 'session',
      kind: 'server',
      startTime: Date.now(),
      endTime: Date.now(), // Will be updated on sessionEnd
      durationMs: 0,
      status: { code: 'unset' },
      attributes: {
        'session.id': sessionId,
        'session.command': data?.command ?? 'unknown',
        'session.has_config': data?.hasConfig ?? false,
      },
      events: [],
    };

    if (data?.projectType) {
      span.attributes['session.project_type'] = data.projectType;
    }
    if (data?.directory) {
      span.attributes['session.directory'] = data.directory;
    }

    this.sessionSpans.set(sessionId, span);
  }

  sessionEnd(sessionId: string, metrics: SessionMetrics): void {
    const span = this.sessionSpans.get(sessionId);
    if (!span) {
      return;
    }

    // Update span with end time and metrics
    span.endTime = Date.now();
    span.durationMs = metrics.durationMs;

    if (metrics.success) {
      span.status = { code: 'ok' };
    } else if (metrics.interrupted) {
      span.status = { code: 'error', message: 'Interrupted by user' };
    } else {
      span.status = { code: 'error' };
    }

    // Add metrics as attributes
    span.attributes['session.tool_calls'] = metrics.toolCallCount;
    span.attributes['session.findings'] = metrics.findingCount;
    span.attributes['session.duration_ms'] = metrics.durationMs;

    if (metrics.recommendationCount !== undefined) {
      span.attributes['session.recommendations'] = metrics.recommendationCount;
    }
    if (metrics.totalInputTokens !== undefined) {
      span.attributes['session.input_tokens'] = metrics.totalInputTokens;
    }
    if (metrics.totalOutputTokens !== undefined) {
      span.attributes['session.output_tokens'] = metrics.totalOutputTokens;
    }

    this.pendingSpans.push(span);
    this.sessionSpans.delete(sessionId);

    // Auto-flush on session end
    void this.flush();
  }

  trackTool(_sessionId: string, tool: string, durationMs: number, success: boolean): void {
    this.trackToolEx(_sessionId, { tool, durationMs, success });
  }

  trackToolEx(_sessionId: string, options: TrackToolOptions): void {
    const span: ExportableSpan = {
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
      name: `tool.${options.tool}`,
      kind: 'client',
      startTime: options.startTime ?? Date.now() - options.durationMs,
      endTime: options.endTime ?? Date.now(),
      durationMs: options.durationMs,
      status: options.success
        ? { code: 'ok' }
        : options.errorMessage
          ? { code: 'error', message: options.errorMessage }
          : { code: 'error' },
      attributes: {
        'tool.name': options.tool,
        'tool.duration_ms': options.durationMs,
        'tool.success': options.success,
      },
      events: [],
    };

    this.pendingSpans.push(span);
  }

  trackFinding(
    _sessionId: string,
    findingType: string,
    severity: 'info' | 'warning' | 'error' | 'critical'
  ): void {
    const span: ExportableSpan = {
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
      name: 'finding.detected',
      kind: 'internal',
      startTime: Date.now(),
      endTime: Date.now(),
      durationMs: 0,
      status: { code: 'ok' },
      attributes: {
        'finding.type': findingType,
        'finding.severity': severity,
      },
      events: [],
    };

    this.pendingSpans.push(span);
  }

  trackLLM(
    _sessionId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    latencyMs?: number
  ): void {
    const opts: TrackLLMOptions = {
      model,
      inputTokens,
      outputTokens,
    };
    if (latencyMs !== undefined) {
      opts.latencyMs = latencyMs;
    }
    this.trackLLMEx(_sessionId, opts);
  }

  trackLLMEx(_sessionId: string, options: TrackLLMOptions): void {
    const span: ExportableSpan = {
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
      name: 'llm.call',
      kind: 'client',
      startTime: options.startTime ?? Date.now() - (options.latencyMs ?? 0),
      endTime: options.endTime ?? Date.now(),
      durationMs: options.latencyMs ?? 0,
      status: { code: 'ok' },
      attributes: {
        'llm.model': options.model,
        'llm.usage.input_tokens': options.inputTokens,
        'llm.usage.output_tokens': options.outputTokens,
      },
      events: [],
    };

    if (options.provider) {
      span.attributes['llm.provider'] = options.provider;
    }
    if (options.latencyMs !== undefined) {
      span.attributes['llm.latency_ms'] = options.latencyMs;
    }
    if (options.temperature !== undefined) {
      span.attributes['llm.temperature'] = options.temperature;
    }

    this.pendingSpans.push(span);
  }

  trackPrompt(_sessionId: string, options: TrackPromptOptions): void {
    const span: ExportableSpan = {
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
      name: 'prompt.used',
      kind: 'internal',
      startTime: Date.now(),
      endTime: Date.now(),
      durationMs: 0,
      status: { code: 'ok' },
      attributes: {
        'prompt.id': options.promptId,
        'prompt.version': options.promptVersion,
        'prompt.key': options.promptKey,
        'prompt.context': options.usageContext,
        'prompt.message_count': options.messageCount,
        'prompt.content_length': options.contentLength,
      },
      events: [],
    };

    this.pendingSpans.push(span);
  }

  trackError(_sessionId: string, errorType: string, errorCode?: string): void {
    const span: ExportableSpan = {
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
      name: 'error',
      kind: 'internal',
      startTime: Date.now(),
      endTime: Date.now(),
      durationMs: 0,
      status: { code: 'error', message: errorType },
      attributes: {
        'error.type': errorType,
      },
      events: [],
    };

    if (errorCode) {
      span.attributes['error.code'] = errorCode;
    }

    this.pendingSpans.push(span);
  }

  async flush(): Promise<void> {
    if (!this.exporter || this.pendingSpans.length === 0) {
      return;
    }

    const spans = [...this.pendingSpans];
    this.pendingSpans = [];

    await this.exporter.export(spans);
  }

  async shutdown(): Promise<void> {
    await this.flush();
    this.exporter?.shutdown();
    this.exporter = null;
    this.enabled = false;
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private generateTraceId(): string {
    // Generate 32 hex chars (16 random bytes)
    return crypto.randomBytes(16).toString('hex');
  }

  private generateSpanId(): string {
    // Generate 16 hex chars (8 random bytes)
    return crypto.randomBytes(8).toString('hex');
  }

  private flattenData(data: Record<string, unknown>): Record<string, string | number | boolean> {
    const flat: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        flat[key] = value;
      } else if (value !== null && value !== undefined) {
        flat[key] = JSON.stringify(value);
      }
    }

    return flat;
  }
}
