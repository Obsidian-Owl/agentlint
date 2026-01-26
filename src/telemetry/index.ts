/**
 * Telemetry Module
 *
 * Opt-in telemetry infrastructure for agentlint.
 *
 * Disabled by default. Enable via:
 * - Environment variable: AGENTLINT_TELEMETRY=alpha
 * - Config file: ~/.agentlint/config.json -> telemetry.enabled: true, telemetry.mode: 'alpha'
 *
 * Modes:
 * - alpha: Send to agentlint's proxy for learning (recommended during alpha)
 * - otel: Send to user's own OTEL backend (future)
 * - disabled: No telemetry (default)
 *
 * When enabled, captures:
 * - Session statistics (duration, tool calls, findings)
 * - Error types (not messages)
 * - Token usage (aggregate, not content)
 *
 * User content is NEVER transmitted (enforced by sanitization).
 *
 * @module telemetry
 */

import type { TelemetryConfig, TelemetryMode } from '../persistence/types';
import { DEFAULT_TELEMETRY_CONFIG } from '../persistence/types';
import { AlphaTelemetryClient } from './alpha-client';

// Re-export event types
export * from './events';

// =============================================================================
// Types
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
// Configuration
// =============================================================================

/**
 * Check if telemetry is enabled via environment variable.
 * Supports: AGENTLINT_TELEMETRY=alpha, AGENTLINT_TELEMETRY=1
 */
export function isTelemetryEnabled(): boolean {
  const envValue = process.env['AGENTLINT_TELEMETRY'];
  return envValue === '1' || envValue === 'alpha' || envValue === 'otel';
}

/**
 * Get telemetry mode from environment variable.
 */
export function getTelemetryMode(): TelemetryMode {
  const envValue = process.env['AGENTLINT_TELEMETRY'];
  if (envValue === 'alpha' || envValue === '1') {
    return 'alpha';
  }
  if (envValue === 'otel') {
    return 'otel';
  }
  return 'disabled';
}

/**
 * Get telemetry configuration from environment or defaults.
 */
export function getTelemetryConfig(): TelemetryConfig {
  const envEnabled = isTelemetryEnabled();
  const envMode = getTelemetryMode();

  if (!envEnabled) {
    return { ...DEFAULT_TELEMETRY_CONFIG };
  }

  const config: TelemetryConfig = {
    enabled: true,
    mode: envMode,
    redactContent: true,
  };

  // For OTEL mode, check for endpoint
  if (envMode === 'otel') {
    const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
    if (endpoint) {
      config.endpoint = endpoint;
    }
  }

  return config;
}

// =============================================================================
// Telemetry Client Interface
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
 * Telemetry client interface.
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

  /** Track an error (type only) */
  trackError(sessionId: string, errorType: string, errorCode?: string): void;

  /** Flush any pending events */
  flush(): Promise<void>;

  /** Shutdown the client */
  shutdown(): Promise<void>;

  /** Get current session's parent event ID for hierarchy */
  getSessionEventId?(sessionId: string): string | undefined;
}

// =============================================================================
// No-Op Client (Disabled Mode)
// =============================================================================

/**
 * No-op telemetry client (used when telemetry is disabled).
 */
class NoOpTelemetryClient implements ITelemetryClient {
  readonly mode = 'disabled' as const;

  init(_config: TelemetryConfig): Promise<void> {
    return Promise.resolve();
  }

  isEnabled(): boolean {
    return false;
  }

  record(_event: import('./events').TelemetryEvent): void {
    // No-op
  }

  sessionStart(_sessionId: string, _data?: SessionStartData): void {
    // No-op
  }

  sessionEnd(_sessionId: string, _metrics: SessionMetrics): void {
    // No-op
  }

  trackTool(_sessionId: string, _tool: string, _durationMs: number, _success: boolean): void {
    // No-op
  }

  trackFinding(
    _sessionId: string,
    _findingType: string,
    _severity: 'info' | 'warning' | 'error' | 'critical'
  ): void {
    // No-op
  }

  trackLLM(
    _sessionId: string,
    _model: string,
    _inputTokens: number,
    _outputTokens: number,
    _latencyMs?: number
  ): void {
    // No-op
  }

  trackError(_sessionId: string, _errorType: string, _errorCode?: string): void {
    // No-op
  }

  flush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

// =============================================================================
// Debug Alpha Client (Logs AND Sends)
// =============================================================================

/**
 * Debug telemetry client that logs to console AND sends to the server.
 * This fixes the debug mode bug where AGENTLINT_TELEMETRY_DEBUG=1 was only
 * logging but not sending events.
 *
 * Extends AlphaTelemetryClient and adds console logging for debugging.
 */
class DebugAlphaTelemetryClient extends AlphaTelemetryClient {
  /**
   * Override record to log AND send.
   */
  override record(event: import('./events').TelemetryEvent): void {
    // Log to console for debugging
    console.error(`[TELEMETRY] ${event.type}:`, JSON.stringify(event.data));

    // Also send to server (parent behavior)
    super.record(event);
  }

  /**
   * Log flush for debugging.
   */
  override async flush(): Promise<void> {
    console.error('[TELEMETRY] Flush called');
    await super.flush();
  }

  /**
   * Log shutdown for debugging.
   */
  override async shutdown(): Promise<void> {
    console.error('[TELEMETRY] Shutdown');
    await super.shutdown();
  }
}

// =============================================================================
// Factory
// =============================================================================

let globalClient: ITelemetryClient | null = null;

/**
 * Get the global telemetry client.
 * Creates one if it doesn't exist.
 */
export function getTelemetryClient(): ITelemetryClient {
  if (!globalClient) {
    globalClient = createTelemetryClient();
    void globalClient.init(getTelemetryConfig());
  }
  return globalClient;
}

/**
 * Create a new telemetry client based on configuration.
 */
export function createTelemetryClient(config?: TelemetryConfig): ITelemetryClient {
  const effectiveConfig = config ?? getTelemetryConfig();

  if (!effectiveConfig.enabled) {
    return new NoOpTelemetryClient();
  }

  switch (effectiveConfig.mode) {
    case 'alpha':
      // Use DebugAlphaTelemetryClient for debug mode (logs AND sends)
      // Use AlphaTelemetryClient for production (sends only)
      if (process.env['AGENTLINT_TELEMETRY_DEBUG'] === '1') {
        return new DebugAlphaTelemetryClient();
      }
      return new AlphaTelemetryClient();

    case 'otel':
      // OTEL mode not yet implemented - fall back to no-op with warning
      console.error('[telemetry] OTEL mode not yet implemented, telemetry disabled');
      return new NoOpTelemetryClient();

    case 'disabled':
    default:
      return new NoOpTelemetryClient();
  }
}

/**
 * Reset the global telemetry client.
 * Useful for testing.
 */
export function resetTelemetryClient(): void {
  if (globalClient) {
    void globalClient.shutdown();
  }
  globalClient = null;
}

/**
 * Initialize telemetry with explicit config.
 * Use this when you have config from CLI or file.
 */
export async function initializeTelemetry(config: TelemetryConfig): Promise<ITelemetryClient> {
  if (globalClient) {
    await globalClient.shutdown();
  }
  globalClient = createTelemetryClient(config);
  await globalClient.init(config);
  return globalClient;
}
