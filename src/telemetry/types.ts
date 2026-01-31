/**
 * Telemetry Module - Type Definitions
 *
 * This file defines the shared types for the telemetry system.
 * These types are used by telemetry clients, orchestration, and tracking modules.
 *
 * @module telemetry/types
 */

import type { TelemetryConfig, TelemetryMode } from '../persistence/types';

// =============================================================================
// Session Types
// =============================================================================

/**
 * Session start data for telemetry.
 */
export interface SessionStartData {
  command: 'analyse' | 'scan' | 'compare' | 'validate' | 'trace';
  hasConfig: boolean;
  projectType?: string;
  /** Project/directory name for human-readable session naming */
  directory?: string;
}

/**
 * Session metrics for telemetry.
 */
export interface SessionMetrics {
  durationMs: number;
  toolCallCount: number;
  findingCount: number;
  recommendationCount?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  success: boolean;
  interrupted?: boolean;
  /** EP23: Number of context compressions during session */
  compressionCount?: number;
  /** EP23: Total retry attempts across all operations */
  retryCount?: number;
}

// =============================================================================
// Tracking Options
// =============================================================================

/**
 * Options for tool tracking with timing and hierarchy.
 */
export interface TrackToolOptions {
  tool: string;
  durationMs: number;
  success: boolean;
  startTime?: number;
  endTime?: number;
  parentEventId?: string;
  /** Full tool input arguments (will be sanitized) */
  toolInput?: Record<string, unknown>;
  /** Tool output/result (truncated if large, will be sanitized) */
  toolOutput?: unknown;
  /** Error message if tool failed */
  errorMessage?: string;
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
  /** Tool call ID from SDK (if available) */
  callId?: string;
}

/**
 * Options for LLM tracking with timing and hierarchy.
 */
export interface TrackLLMOptions {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs?: number;
  startTime?: number;
  endTime?: number;
  parentEventId?: string;
  provider?: string;
  cost?: number;
  /** Model temperature setting (if known) */
  temperature?: number;
  /** Max tokens setting (if known) */
  maxTokens?: number;
  /** Top-p sampling parameter (if known) */
  topP?: number;
  /** Stop reason from model response */
  stopReason?: string;
  /** Cache read tokens (prompt caching) */
  cacheReadTokens?: number;
  /** Cache creation tokens (prompt caching) */
  cacheCreationTokens?: number;
  /** Full prompt messages as JSON string (opt-in via AGENTLINT_CAPTURE_CONTENT) */
  promptContent?: string;
  /** Full completion text (opt-in via AGENTLINT_CAPTURE_CONTENT) */
  completionContent?: string;
  /** System prompt/instructions (opt-in via AGENTLINT_CAPTURE_CONTENT) */
  systemInstructions?: string;
  /** Extended thinking tokens (Anthropic Claude 3.5+) */
  reasoningTokens?: number;
}

/**
 * Options for prompt usage tracking.
 */
export interface TrackPromptOptions {
  promptId: string;
  promptVersion: string;
  promptKey: string;
  usageContext: string;
  messageCount: number;
  contentLength: number;
}

// =============================================================================
// Recommendation Tracking (TEL-001)
// =============================================================================

/**
 * Recommendation outcome event for telemetry (TEL-001).
 * Tracks whether users accept or reject recommendations.
 */
export interface RecommendationOutcomeEvent {
  /** Unique identifier for the recommendation */
  recommendationId: string;
  /** Whether the recommendation was accepted */
  accepted: boolean;
  /** Optional reason for rejection or additional context */
  reason?: string;
  /** ISO-8601 timestamp of decision */
  timestamp: string;
}

// =============================================================================
// Telemetry Client Interface
// =============================================================================

/**
 * Telemetry client interface.
 *
 * All telemetry clients must implement this interface.
 * Provides methods for tracking sessions, tools, LLM calls, findings, and errors.
 */
export interface ITelemetryClient {
  /** Telemetry mode */
  readonly mode: TelemetryMode;

  /** Initialize the client */
  init(config: TelemetryConfig): Promise<void>;

  /** Check if telemetry is enabled */
  isEnabled(): boolean;

  /** Record a raw telemetry event */
  record(event: import('./events').TelemetryEvent): void;

  /** Record session start */
  sessionStart(sessionId: string, data?: SessionStartData): void;

  /** Record session end with metrics */
  sessionEnd(sessionId: string, metrics: SessionMetrics): void;

  /** Track a tool call (simple signature for backward compat) */
  trackTool(sessionId: string, tool: string, durationMs: number, success: boolean): void;

  /** Track a tool call with extended options */
  trackToolEx?(sessionId: string, options: TrackToolOptions): void;

  /** Track a finding */
  trackFinding(
    sessionId: string,
    findingType: string,
    severity: 'info' | 'warning' | 'error' | 'critical'
  ): void;

  /** Track LLM usage (simple signature for backward compat) */
  trackLLM(
    sessionId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    latencyMs?: number
  ): void;

  /** Track LLM usage with extended options */
  trackLLMEx?(sessionId: string, options: TrackLLMOptions): void;

  /** Track prompt usage for A/B testing and version correlation */
  trackPrompt?(sessionId: string, options: TrackPromptOptions): void;

  /** Track recommendation acceptance/rejection (TEL-001) */
  trackRecommendationOutcome?(sessionId: string, event: RecommendationOutcomeEvent): void;

  /** Track an error (type only) */
  trackError(sessionId: string, errorType: string, errorCode?: string): void;

  /** Flush any pending events */
  flush(): Promise<void>;

  /** Shutdown the client */
  shutdown(): Promise<void>;

  /** Get current session's parent event ID for hierarchy */
  getSessionEventId?(sessionId: string): string | undefined;
}
