/**
 * EP22 Unified Observability - TypeScript Interfaces
 *
 * These interfaces define the contracts for agentlint's observability system.
 * They follow OpenTelemetry conventions and are designed for both local and remote export.
 */

// =============================================================================
// Core Trace Context
// =============================================================================

/**
 * Trace context propagated through all operations.
 * Compatible with W3C Trace Context specification.
 */
export interface TraceContext {
  /** UUID v7 trace identifier (32 hex chars, no hyphens) */
  traceId: string;

  /** Current span identifier (16 hex chars) */
  spanId: string;

  /** Parent span identifier for hierarchy (16 hex chars) */
  parentSpanId?: string;

  /** W3C trace flags (8-bit, 01 = sampled) */
  traceFlags: number;
}

/**
 * W3C traceparent header format.
 * Format: 00-{traceId}-{spanId}-{traceFlags}
 */
export type TraceParent = `00-${string}-${string}-${string}`;

// =============================================================================
// Span Types
// =============================================================================

/** Span kind following OpenTelemetry conventions */
export type SpanKind = 'INTERNAL' | 'CLIENT' | 'SERVER';

/** Span status codes */
export type SpanStatusCode = 'UNSET' | 'OK' | 'ERROR';

/** Span status with optional error message */
export interface SpanStatus {
  code: SpanStatusCode;
  message?: string;
}

/** Attribute value types */
export type AttributeValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | boolean[];

/** Span attributes as key-value pairs */
export type SpanAttributes = Record<string, AttributeValue>;

/** Event within a span (milestone marker) */
export interface SpanEvent {
  /** Event name (e.g., "first_token", "stream_complete") */
  name: string;

  /** Event timestamp in nanoseconds since Unix epoch */
  timeUnixNano: bigint;

  /** Event-specific attributes */
  attributes?: SpanAttributes;
}

/** Link to a related span */
export interface SpanLink {
  /** Trace ID of the linked span */
  traceId: string;

  /** Span ID of the linked span */
  spanId: string;

  /** Attributes describing the relationship */
  attributes?: SpanAttributes;
}

/** Complete span definition */
export interface Span {
  /** Trace ID from context */
  traceId: string;

  /** Unique span identifier */
  spanId: string;

  /** Parent span ID (undefined for root spans) */
  parentSpanId?: string;

  /** Operation name */
  name: string;

  /** Span kind */
  kind: SpanKind;

  /** Start time in nanoseconds since Unix epoch */
  startTimeUnixNano: bigint;

  /** End time in nanoseconds since Unix epoch */
  endTimeUnixNano?: bigint;

  /** Span status */
  status: SpanStatus;

  /** Span attributes */
  attributes: SpanAttributes;

  /** Events within the span */
  events: SpanEvent[];

  /** Links to related spans */
  links: SpanLink[];
}

// =============================================================================
// GenAI Semantic Conventions
// =============================================================================

/** GenAI operation types */
export type GenAIOperationName =
  | 'invoke_agent'
  | 'execute_tool'
  | 'chat'
  | 'sse_streaming';

/** GenAI provider names - supports all major Opencode SDK providers */
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

/** LLM finish reasons */
export type FinishReason = 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';

/** Session span attributes (GenAI conventions) */
export interface SessionSpanAttributes {
  'gen_ai.operation.name': 'invoke_agent';
  'gen_ai.conversation.id': string;
  'gen_ai.provider.name': GenAIProvider;

  // Agent identity (OTel GenAI v1.39+)
  'gen_ai.agent.id': string;
  'gen_ai.agent.name': string;
  'gen_ai.agent.description'?: string;

  // Project context
  'agentlint.session.target'?: string;
  'agentlint.session.command'?: string;
  'agentlint.project.name'?: string;
  'agentlint.project.type'?: string;

  // Path context (from Opencode SDK AssistantMessage.path)
  'agentlint.session.cwd'?: string;
  'agentlint.session.root'?: string;

  // Session-end metrics (set when span ends)
  'agentlint.session.tool_call_count'?: number;
  'agentlint.session.finding_count'?: number;
  'agentlint.session.recommendation_count'?: number;
  'agentlint.session.success'?: boolean;

  // Session-level cost aggregation
  'agentlint.session.total_cost_usd'?: number;
  'agentlint.session.total_input_tokens'?: number;
  'agentlint.session.total_output_tokens'?: number;
  'agentlint.session.total_reasoning_tokens'?: number;
}

/** Tool span attributes (GenAI conventions) */
export interface ToolSpanAttributes {
  'gen_ai.operation.name': 'execute_tool';
  'gen_ai.tool.name': string;
  'gen_ai.tool.success': boolean;

  // Standard OTel tool attributes
  'gen_ai.tool.call.id'?: string;
  'gen_ai.tool.type'?: 'function';

  // Opt-in content capture (truncated to CONTENT_CAPTURE_MAX_LENGTH)
  'gen_ai.tool.call.arguments'?: string; // JSON stringified, opt-in
  'gen_ai.tool.call.result'?: string; // JSON stringified, opt-in, truncated

  // Legacy (deprecated in favor of arguments/result)
  'gen_ai.tool.input_truncated'?: boolean;

  // Tool metadata from SDK (ToolPart and ToolState)
  'agentlint.tool.title'?: string;
  'agentlint.tool.metadata'?: string; // JSON stringified
  'agentlint.tool.attachment_count'?: number;

  // State transition tracking
  'agentlint.tool.state_transitions'?: string[]; // ['pending', 'running', 'completed']
  'agentlint.tool.pending_duration_ms'?: number;
  'agentlint.tool.running_duration_ms'?: number;

  // agentlint-specific
  'agentlint.tool.duration_ms'?: number;
}

/** LLM span attributes (GenAI conventions) */
export interface LLMSpanAttributes {
  'gen_ai.operation.name': 'chat';
  'gen_ai.request.model': string;

  // Token usage
  'gen_ai.usage.input_tokens'?: number;
  'gen_ai.usage.output_tokens'?: number;
  'gen_ai.usage.reasoning_tokens'?: number; // Extended thinking (Claude 3.5+)

  // Prompt caching (Anthropic, Google Gemini - NOT available on all providers)
  'gen_ai.usage.cache_creation.input_tokens'?: number;
  'gen_ai.usage.cache_read.input_tokens'?: number;

  // Request hyperparameters
  'gen_ai.request.temperature'?: number;
  'gen_ai.request.max_tokens'?: number;
  'gen_ai.request.top_p'?: number;
  'gen_ai.request.top_k'?: number;
  'gen_ai.request.stop_sequences'?: string[];
  'gen_ai.request.seed'?: number;

  // Response details
  'gen_ai.response.id'?: string;
  'gen_ai.response.model'?: string;
  'gen_ai.response.finish_reasons'?: FinishReason[];

  // agentlint-specific
  'agentlint.llm.latency_ms'?: number;
  'agentlint.llm.cost_usd'?: number;
  'agentlint.llm.tokens_per_second'?: number;
}

/** SSE stream span attributes */
export interface StreamSpanAttributes {
  'gen_ai.operation.name': 'sse_streaming';
  'agentlint.stream.chunk_count'?: number;
  'agentlint.stream.duration_ms'?: number;
  'agentlint.stream.first_token_ms'?: number;
  'agentlint.stream.event_counts'?: Record<string, number>;
}

// =============================================================================
// Structured Logging
// =============================================================================

/** Log severity levels */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Structured log entry with trace correlation */
export interface StructuredLogEntry {
  /** ISO 8601 timestamp */
  timestamp: string;

  /** Log level */
  level: LogLevel;

  /** Logger namespace (e.g., "agentlint:streaming") */
  namespace: string;

  /** Human-readable message */
  message: string;

  /** Trace ID (auto-injected from context) */
  trace_id?: string;

  /** Span ID (auto-injected from context) */
  span_id?: string;

  /** Arbitrary structured data */
  data?: Record<string, unknown>;
}

// =============================================================================
// Checkpoint Integration
// =============================================================================

/** Trace context stored in checkpoints */
export interface CheckpointTraceContext {
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
}

/** Checkpoint with trace context */
export interface TracedCheckpoint {
  id: string;
  timestamp: string;
  phase: string;
  trace_context: CheckpointTraceContext;
  state: Record<string, unknown>;
}

// =============================================================================
// Configuration
// =============================================================================

/** Local observability configuration */
export interface LocalObservabilityConfig {
  /** Always true - local logging cannot be disabled */
  enabled: true;

  /** Log level threshold */
  level: LogLevel;

  /** Log file retention in days */
  retentionDays: number;

  /** Maximum log file size in bytes */
  maxFileSizeBytes: number;
}

/** Remote export configuration */
export interface RemoteObservabilityConfig {
  /** Whether remote export is enabled (opt-in) */
  enabled: boolean;

  /** Default proxy endpoint */
  proxy: {
    endpoint: string;
  };

  /** Optional user-provided OTLP endpoint */
  userEndpoint?: {
    url: string;
    headers?: Record<string, string>;
  };

  /** Sample rate (0.0 to 1.0) */
  sampleRate: number;
}

/** Content capture configuration (opt-in for privacy) */
export interface ContentCaptureConfig {
  /** Enable LLM input/output message capture (default: false) */
  enabled: boolean;

  /** Enable tool arguments/results capture (default: true, truncated) */
  toolContent: boolean;

  /** Maximum content length before truncation (default: 5000) */
  maxContentLength: number;

  /** Maximum message length for LLM content (default: 500) */
  maxMessageLength: number;
}

/** Complete observability configuration */
export interface ObservabilityConfig {
  local: LocalObservabilityConfig;
  remote: RemoteObservabilityConfig;
  contentCapture: ContentCaptureConfig;
}

/** Default configuration values */
export const DEFAULT_OBSERVABILITY_CONFIG: ObservabilityConfig = {
  local: {
    enabled: true,
    level: 'info',
    retentionDays: 30,
    maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
  },
  remote: {
    enabled: false, // Opt-in per Constitution Principle I
    proxy: {
      endpoint: 'https://agentlint.vercel.app/api/traces',
    },
    sampleRate: 1.0, // 100% for alpha
  },
  contentCapture: {
    enabled: false, // Opt-in via AGENTLINT_CAPTURE_CONTENT=1
    toolContent: true, // Tool args/results captured by default (truncated)
    maxContentLength: 5000,
    maxMessageLength: 500,
  },
};

/** Content capture environment variable */
export const CONTENT_CAPTURE_ENV_VAR = 'AGENTLINT_CAPTURE_CONTENT';

// =============================================================================
// Exporter Interfaces
// =============================================================================

/** Span exporter interface */
export interface SpanExporter {
  /** Export a batch of spans */
  export(spans: Span[]): Promise<ExportResult>;

  /** Shutdown the exporter */
  shutdown(): Promise<void>;
}

/** Export result status */
export interface ExportResult {
  success: boolean;
  error?: Error;
  exportedCount: number;
}

/** Local JSONL exporter options */
export interface LocalExporterOptions {
  /** Log directory path */
  logDir: string;

  /** Current log file path */
  logFile: string;

  /** Maximum file size before rotation */
  maxFileSizeBytes: number;
}

/** OTLP exporter options */
export interface OTLPExporterOptions {
  /** OTLP endpoint URL */
  endpoint: string;

  /** Request headers (for auth) */
  headers?: Record<string, string>;

  /** Request timeout in milliseconds */
  timeoutMs: number;

  /** Batch size for export */
  batchSize: number;
}

// =============================================================================
// Tracer Interfaces
// =============================================================================

/** Span creation options */
export interface SpanOptions {
  /** Span name */
  name: string;

  /** Span kind (default: INTERNAL) */
  kind?: SpanKind;

  /** Initial attributes */
  attributes?: SpanAttributes;

  /** Parent context (auto-detected if not provided) */
  parentContext?: TraceContext;

  /** Links to related spans */
  links?: SpanLink[];
}

/** Active span handle */
export interface ActiveSpan {
  /** Span context */
  context: TraceContext;

  /** Set span attributes */
  setAttributes(attributes: SpanAttributes): void;

  /** Add a span event */
  addEvent(name: string, attributes?: SpanAttributes): void;

  /** Set span status */
  setStatus(status: SpanStatus): void;

  /** End the span */
  end(): void;
}

/** Tracer interface for creating spans */
export interface Tracer {
  /** Start a new span */
  startSpan(options: SpanOptions): ActiveSpan;

  /** Run a function within a span context */
  withSpan<T>(options: SpanOptions, fn: (span: ActiveSpan) => T | Promise<T>): Promise<T>;

  /** Get current trace context (from AsyncLocalStorage) */
  getCurrentContext(): TraceContext | undefined;
}

// =============================================================================
// TUI State Events
// =============================================================================

/** TUI state transition event attributes */
export interface TUIStateChangeAttributes {
  from: string;
  to: string;
}

/** Agent work state change event attributes */
export interface AgentWorkChangeAttributes {
  from: string;
  to: string;
}

/** Question asked event attributes */
export interface QuestionAskedAttributes {
  request_id: string;
  question_count: number;
}

/** Permission requested event attributes */
export interface PermissionRequestedAttributes {
  tool: string;
  pattern: string;
}

// =============================================================================
// Analysis Events (agentlint-specific)
// =============================================================================

/** Finding severity levels */
export type FindingSeverity = 'info' | 'warning' | 'error' | 'critical';

/** Finding detected event attributes */
export interface FindingDetectedAttributes {
  'agentlint.finding.type': string;
  'agentlint.finding.severity': FindingSeverity;
  'agentlint.finding.id'?: string;
}

/** Recommendation generated event attributes */
export interface RecommendationGeneratedAttributes {
  'agentlint.recommendation.type': string;
  'agentlint.recommendation.finding_id'?: string;
}

/** Checkpoint saved event attributes */
export interface CheckpointSavedAttributes {
  'agentlint.checkpoint.type': string;
  'agentlint.checkpoint.sequence': number;
}

// =============================================================================
// Evaluation Events (OTel GenAI Standard)
// =============================================================================

/** Evaluation result event attributes (gen_ai.evaluation.result) */
export interface EvaluationResultAttributes {
  /** Evaluation name (e.g., "relevance", "accuracy", "constitution_check") */
  'gen_ai.evaluation.name': string;

  /** Numeric score (0.0 to 1.0 or custom range) */
  'gen_ai.evaluation.score.value'?: number;

  /** Categorical label (e.g., "pass", "fail", "relevant") */
  'gen_ai.evaluation.score.label'?: string;

  /** Human-readable explanation of the score */
  'gen_ai.evaluation.explanation'?: string;

  /** Links to the completion being evaluated */
  'gen_ai.response.id'?: string;
}

// =============================================================================
// Content Events (Opt-In, OTel GenAI Standard)
// =============================================================================

/** Content event attributes (gen_ai.client.inference.operation.details) */
export interface ContentEventAttributes {
  /** Input messages to the LLM (opt-in, truncated) */
  'gen_ai.input.messages'?: string;

  /** Output messages from the LLM (opt-in, truncated) */
  'gen_ai.output.messages'?: string;

  /** System instructions/prompt (opt-in, truncated) */
  'gen_ai.system_instructions'?: string;

  /** Tool definitions available to the model (opt-in) */
  'gen_ai.tool.definitions'?: string;
}

// =============================================================================
// Error Event Attributes
// =============================================================================

/** Error event attributes (standard OTel error conventions + SDK enrichment) */
export interface ErrorEventAttributes {
  /** Error type/class */
  'error.type': string;

  /** Error message */
  'error.message': string;

  /** Sanitized stack trace (optional) */
  'error.stack'?: string;

  // SDK-enriched error details (from Opencode ApiError)
  /** HTTP status code (if API error) */
  'error.http_status'?: number;

  /** Whether the error is retryable */
  'error.is_retryable'?: boolean;

  /** Error category for grouping */
  'error.category'?: 'auth' | 'api' | 'rate_limit' | 'timeout' | 'unknown';
}

// =============================================================================
// Service Resource
// =============================================================================

/** Service resource attributes */
export interface ServiceResource {
  'service.name': 'agentlint';
  'service.version': string;
  'service.instance.id'?: string;
  'deployment.environment'?: string;
}
