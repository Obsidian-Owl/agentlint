/**
 * EP22: Observability Type Definitions
 * Core interfaces for unified trace context and span management.
 */

/** W3C Trace Context */
export interface TraceContext {
  /** 32 hex character trace ID (UUID v7 without hyphens) */
  traceId: string;
  /** 16 hex character span ID */
  spanId: string;
  /** Parent span ID (optional, for hierarchy) */
  parentSpanId?: string;
  /** Trace flags (01 = sampled) */
  traceFlags: number;
}

/** Span creation options */
export interface SpanOptions {
  name: string;
  kind?: 'internal' | 'client' | 'server';
  attributes?: Record<string, string | number | boolean>;
  parentSpanId?: string;
}

/** Active span handle */
export interface ActiveSpan {
  spanId: string;
  name: string;
  startTime: number;
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[];
  end(status?: SpanStatus): void;
  addEvent(name: string, attributes?: Record<string, unknown>): void;
  setAttribute(key: string, value: string | number | boolean): void;
}

/** Span event (milestone within a span) */
export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}

/** Span completion status */
export interface SpanStatus {
  code: 'ok' | 'error' | 'unset';
  message?: string;
}

/** GenAI provider types supported */
export type GenAIProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'bedrock'
  | 'azure'
  | 'groq'
  | 'openrouter'
  | 'ollama'
  | 'deepseek'
  | 'xai'
  | 'together'
  | 'github'
  | 'custom'
  | 'unknown';
