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

  /** Track an error (type only) */
  trackError(sessionId: string, errorType: string, errorCode?: string): void;

  /** Flush any pending events */
  flush(): Promise<void>;

  /** Shutdown the client */
  shutdown(): Promise<void>;

  /** Get current session's parent event ID for hierarchy */
  getSessionEventId?(sessionId: string): string | undefined;
}
