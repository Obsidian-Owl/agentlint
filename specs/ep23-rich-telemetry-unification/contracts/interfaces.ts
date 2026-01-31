/**
 * EP23 Rich Telemetry Unification - Type Definitions
 *
 * This file defines the EXTENDED interfaces for telemetry types.
 * These interfaces document the new fields added for rich content capture.
 *
 * NOTE: This is a SPECIFICATION file, not production code.
 * The actual implementations will be in:
 * - src/telemetry/types.ts
 * - src/opencode/telemetry-tracker.ts
 *
 * @module specs/ep23-rich-telemetry-unification/contracts
 */

// =============================================================================
// Content Capture Types (NEW)
// =============================================================================

/**
 * Configuration for content capture feature.
 * Content capture is opt-in per Constitution Principle I (Local-First).
 */
export interface ContentCaptureConfig {
  /** Whether content capture is enabled (default: false) */
  enabled: boolean;
  /** Maximum length before truncation (default: 5000) */
  maxLength: number;
  /** Whether to redact secrets (default: true) */
  redactSecrets: boolean;
}

/**
 * Captured LLM content when content capture is enabled.
 * All fields are optional since content capture is opt-in.
 */
export interface LLMContentCapture {
  /** Prompt messages as JSON string (truncated, secrets redacted) */
  promptContent?: string;
  /** Completion text (truncated, secrets redacted) */
  completionContent?: string;
  /** System prompt/instructions (truncated, secrets redacted) */
  systemInstructions?: string;
}

/**
 * Captured tool content when content capture is enabled.
 * Extends existing toolInput/toolOutput with full JSON capture.
 */
export interface ToolContentCapture {
  /** Unique ID for this tool call (UUID v4) */
  callId: string;
  /** Full tool arguments as JSON string (truncated, secrets redacted) */
  toolInputJson?: string;
  /** Full tool result as JSON string (truncated, secrets redacted) */
  toolOutputJson?: string;
}

// =============================================================================
// Extended TrackLLMOptions (MODIFIED)
// =============================================================================

/**
 * Extended options for tracking LLM calls with content.
 *
 * New fields (EP23):
 * - promptContent: Full prompt messages (opt-in)
 * - completionContent: Full completion text (opt-in)
 * - systemInstructions: System prompt (opt-in)
 * - reasoningTokens: Extended thinking tokens
 */
export interface TrackLLMOptionsExtended {
  // Existing fields (from src/telemetry/types.ts)
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs?: number;
  startTime?: number;
  endTime?: number;
  parentEventId?: string;
  provider?: string;
  cost?: number;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopReason?: string;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;

  // NEW fields (EP23)
  /** Full prompt messages as JSON string (opt-in via AGENTLINT_CAPTURE_CONTENT) */
  promptContent?: string;
  /** Full completion text (opt-in via AGENTLINT_CAPTURE_CONTENT) */
  completionContent?: string;
  /** System prompt/instructions (opt-in via AGENTLINT_CAPTURE_CONTENT) */
  systemInstructions?: string;
  /** Extended thinking tokens (Anthropic Claude 3.5+) */
  reasoningTokens?: number;

  // Trace context (existing from EP22)
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
}

// =============================================================================
// Extended TrackToolOptions (MODIFIED)
// =============================================================================

/**
 * Extended options for tracking tool calls with content.
 *
 * New fields (EP23):
 * - toolInputJson: Full arguments JSON (opt-in)
 * - toolOutputJson: Full result JSON (opt-in)
 * - errorCategory: Error classification
 * - errorStack: Sanitized stack trace
 * - errorIsRetryable: Retry hint
 */
export interface TrackToolOptionsExtended {
  // Existing fields (from src/telemetry/types.ts)
  tool: string;
  durationMs: number;
  success: boolean;
  startTime?: number;
  endTime?: number;
  parentEventId?: string;
  /** Truncated/sanitized tool input (existing) */
  toolInput?: Record<string, unknown>;
  /** Truncated/sanitized tool output (existing) */
  toolOutput?: unknown;
  errorMessage?: string;

  // NEW fields (EP23)
  /** Full tool arguments as JSON string (opt-in via AGENTLINT_CAPTURE_CONTENT) */
  toolInputJson?: string;
  /** Full tool result as JSON string (opt-in via AGENTLINT_CAPTURE_CONTENT) */
  toolOutputJson?: string;
  /** Error category for classification */
  errorCategory?: 'auth' | 'api' | 'rate_limit' | 'timeout' | 'unknown';
  /** Sanitized stack trace (secrets redacted) */
  errorStack?: string;
  /** Whether the error is retryable */
  errorIsRetryable?: boolean;
  /** HTTP status code if applicable */
  errorStatusCode?: number;
  /** Tool call ID from SDK (if available) */
  callId?: string;

  // Trace context (existing from EP22)
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
}

// =============================================================================
// HoneyHive Schema Types (Target)
// =============================================================================

/**
 * HoneyHive Model Event structure.
 * This is the target schema for LLM events.
 */
export interface HoneyHiveModelEvent {
  event_type: 'model';
  event_name: string;
  config: {
    model: string;
    provider: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stop_sequences?: string[];
  };
  inputs: {
    /** NEW: Prompt messages (opt-in) */
    messages?: unknown[];
    /** NEW: System instructions (opt-in) */
    system_instructions?: string;
    model: string;
    provider: string;
    prompt_tokens: number;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  };
  outputs: {
    /** NEW: Completion content (opt-in) */
    content?: string;
    completion_tokens: number;
    stop_reason?: string;
  };
  metrics: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    /** NEW: Cache read tokens */
    cache_read_tokens?: number;
    /** NEW: Cache creation tokens */
    cache_creation_tokens?: number;
    /** NEW: Extended thinking tokens */
    reasoning_tokens?: number;
    cost?: number;
    latency_ms?: number;
    tokens_per_second?: number;
  };
  metadata: {
    agentlint_version: string;
    platform: string;
    sequence: number;
    /** NEW: Trace ID for correlation */
    trace_id?: string;
  };
  parent_id?: string;
  error?: string;
}

/**
 * HoneyHive Tool Event structure.
 * This is the target schema for tool events.
 */
export interface HoneyHiveToolEvent {
  event_type: 'tool';
  event_name: string;
  config: {
    tool_name: string;
    /** NEW: Tool call ID */
    tool_call_id?: string;
    provider: string;
  };
  inputs: {
    tool: string;
    /** NEW: Full arguments (opt-in) */
    arguments?: Record<string, unknown>;
  };
  outputs: {
    success: boolean;
    /** NEW: Full result (opt-in) */
    result?: unknown;
    error?: string;
  };
  metrics: {
    duration_ms: number;
    success: number;
  };
  metadata: {
    agentlint_version: string;
    platform: string;
    sequence: number;
    success: boolean;
    duration_ms: number;
    /** NEW: Error category */
    error_category?: string;
    /** NEW: Sanitized stack trace */
    error_stack?: string;
    /** NEW: Retry hint */
    error_is_retryable?: boolean;
    /** NEW: Trace ID for correlation */
    trace_id?: string;
  };
  parent_id?: string;
  error?: string;
}

/**
 * HoneyHive Session Start structure.
 * Extended with agent identity attributes.
 */
export interface HoneyHiveSessionStart {
  session: {
    project: string;
    session_name: string;
    source: string;
    session_id: string;
    user_properties: {
      version: string;
      platform: string;
      node_version: string;
    };
    config: {
      app_version: string;
      node_version: string;
      command: string;
      /** NEW: Agent identity */
      agent_id?: string;
      /** NEW: Agent name */
      agent_name?: string;
    };
    inputs: {
      command: string;
      directory?: string;
      project_type?: string;
      has_config: boolean;
    };
    outputs: Record<string, unknown>;
    metrics: Record<string, unknown>;
    metadata?: {
      /** NEW: Trace ID for correlation */
      trace_id?: string;
    };
  };
}

// =============================================================================
// Stream Instrumentation Types (NEW)
// =============================================================================

/**
 * Stream span options for SSE streaming instrumentation.
 * P3 priority - optional enhancement.
 */
export interface StreamSpanOptions {
  /** Session ID for context */
  sessionId: string;
  /** Parent span ID (LLM span) */
  parentSpanId: string;
  /** Model being streamed from */
  model: string;
}

/**
 * Stream span state during streaming.
 */
export interface StreamSpanState {
  /** Span ID for this stream */
  spanId: string;
  /** Timestamp of first token */
  firstTokenAt?: number;
  /** Total chunks received */
  chunkCount: number;
  /** Whether stream completed successfully */
  completed: boolean;
  /** Error if stream failed */
  error?: string;
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Check if content capture is enabled.
 * Checks both env var and config.
 */
export function isContentCaptureEnabled(): boolean {
  // Implementation would check:
  // 1. AGENTLINT_CAPTURE_CONTENT env var
  // 2. config.telemetry.captureContent
  // Env var overrides config
  return process.env['AGENTLINT_CAPTURE_CONTENT'] === 'true';
}

/**
 * Get max content length for truncation.
 */
export function getMaxContentLength(): number {
  const envValue = process.env['AGENTLINT_CAPTURE_MAX_LENGTH'];
  return envValue ? parseInt(envValue, 10) : 5000;
}

/**
 * Truncation marker appended to truncated content.
 */
export const TRUNCATION_MARKER = '[truncated at {length} chars]';
