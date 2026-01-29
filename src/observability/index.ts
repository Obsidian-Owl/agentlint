/**
 * EP22: Unified Observability
 *
 * Provides trace context management, span creation with GenAI semantic conventions,
 * and infrastructure for both local logging and OTLP export.
 *
 * @module observability
 */

// Types
export type {
  TraceContext,
  SpanOptions,
  ActiveSpan,
  SpanEvent,
  SpanStatus,
  GenAIProvider,
} from './types';

// Configuration
export type { ObservabilityConfig } from './config';
export { DEFAULT_OBSERVABILITY_CONFIG } from './config';

// Trace ID generation
export { generateTraceId, generateSpanId, formatTraceparent, parseTraceparent } from './trace-id';

// Trace context provider
export { TraceContextProvider, traceContextProvider, traceStorage } from './trace-context';

// Span factory
export {
  TracingSpanFactory,
  spanFactory,
  GenAIAttributes,
  AgentlintAttributes,
} from './span-factory';
export type {
  SessionSpanOptions,
  ToolSpanOptions,
  LLMSpanOptions,
  StreamSpanOptions,
} from './span-factory';
