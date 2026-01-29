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

// Content capture (Phase 3.5 - T025d, T025e)
export {
  isContentCaptureEnabled,
  getContentCaptureConfig,
  sanitizeContent,
  generateToolCallId,
  captureToolCallContent,
} from './content-capture';
export type { ContentCaptureConfig, ToolCallContent } from './content-capture';

// Orchestrator instrumentation (Phase 3.5 - T025a-c, T025f-g, Phase 5 - T039)
export {
  extractCacheTokens,
  extractRequestParams,
  extractResponseDetails,
  emitFindingEvent,
  emitRecommendationEvent,
  applyCacheTokens,
  applyRequestParams,
  applyResponseDetails,
  instrumentSession,
  instrumentToolCall,
  instrumentLLMCall,
} from './instrumentation/orchestrator';
export type {
  CacheTokens,
  LLMRequestParams,
  LLMResponseDetails,
  FindingEventData,
  RecommendationEventData,
  InstrumentSessionOptions,
  InstrumentToolOptions,
  InstrumentLLMOptions,
} from './instrumentation/orchestrator';

// Local exporter (Phase 4 - T029)
export { LocalSpanExporter, createLocalExporter } from './exporters/local-exporter';
export type { LocalExporterConfig, ExportableSpan } from './exporters/local-exporter';
