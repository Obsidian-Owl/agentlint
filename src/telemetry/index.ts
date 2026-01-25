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

  /** Track a tool call */
  trackTool(sessionId: string, tool: string, durationMs: number, success: boolean): void;

  /** Track a finding */
  trackFinding(
    sessionId: string,
    findingType: string,
    severity: 'info' | 'warning' | 'error' | 'critical'
  ): void;

  /** Track LLM usage */
  trackLLM(
    sessionId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    latencyMs?: number
  ): void;

  /** Track an error (type only) */
  trackError(sessionId: string, errorType: string, errorCode?: string): void;

  /** Flush any pending events */
  flush(): Promise<void>;

  /** Shutdown the client */
  shutdown(): Promise<void>;
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
// Console Debug Client
// =============================================================================

/**
 * Console-based telemetry client for debugging.
 * Logs telemetry events to stderr when AGENTLINT_TELEMETRY_DEBUG=1.
 */
class ConsoleTelemetryClient implements ITelemetryClient {
  readonly mode = 'alpha' as const;

  private debugMode = false;

  init(_config: TelemetryConfig): Promise<void> {
    this.debugMode = process.env['AGENTLINT_TELEMETRY_DEBUG'] === '1';
    return Promise.resolve();
  }

  isEnabled(): boolean {
    return true;
  }

  record(event: import('./events').TelemetryEvent): void {
    if (this.debugMode) {
      console.error(`[TELEMETRY] ${event.type}:`, JSON.stringify(event.data));
    }
  }

  sessionStart(sessionId: string, data?: SessionStartData): void {
    this.record({
      type: 'session.start',
      timestamp: new Date().toISOString(),
      sessionId,
      eventId: crypto.randomUUID(),
      sequence: 0,
      data: (data ?? {}) as Record<string, unknown>,
      meta: {
        version: process.env['npm_package_version'] ?? 'unknown',
        platform: process.platform,
        nodeVersion: process.version,
      },
    });
  }

  sessionEnd(sessionId: string, metrics: SessionMetrics): void {
    this.record({
      type: 'session.end',
      timestamp: new Date().toISOString(),
      sessionId,
      eventId: crypto.randomUUID(),
      sequence: 999,
      data: metrics as unknown as Record<string, unknown>,
      meta: {
        version: process.env['npm_package_version'] ?? 'unknown',
        platform: process.platform,
        nodeVersion: process.version,
      },
    });
  }

  trackTool(sessionId: string, tool: string, durationMs: number, success: boolean): void {
    this.record({
      type: 'tool.call',
      timestamp: new Date().toISOString(),
      sessionId,
      eventId: crypto.randomUUID(),
      sequence: 0,
      data: { tool, durationMs, success },
      meta: {
        version: process.env['npm_package_version'] ?? 'unknown',
        platform: process.platform,
        nodeVersion: process.version,
      },
    });
  }

  trackFinding(
    sessionId: string,
    findingType: string,
    severity: 'info' | 'warning' | 'error' | 'critical'
  ): void {
    this.record({
      type: 'finding.detected',
      timestamp: new Date().toISOString(),
      sessionId,
      eventId: crypto.randomUUID(),
      sequence: 0,
      data: { findingType, severity },
      meta: {
        version: process.env['npm_package_version'] ?? 'unknown',
        platform: process.platform,
        nodeVersion: process.version,
      },
    });
  }

  trackLLM(
    sessionId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    latencyMs?: number
  ): void {
    this.record({
      type: 'llm.usage',
      timestamp: new Date().toISOString(),
      sessionId,
      eventId: crypto.randomUUID(),
      sequence: 0,
      data: { model, inputTokens, outputTokens, latencyMs },
      meta: {
        version: process.env['npm_package_version'] ?? 'unknown',
        platform: process.platform,
        nodeVersion: process.version,
      },
    });
  }

  trackError(sessionId: string, errorType: string, errorCode?: string): void {
    this.record({
      type: 'session.error',
      timestamp: new Date().toISOString(),
      sessionId,
      eventId: crypto.randomUUID(),
      sequence: 0,
      data: { errorType, errorCode },
      meta: {
        version: process.env['npm_package_version'] ?? 'unknown',
        platform: process.platform,
        nodeVersion: process.version,
      },
    });
  }

  flush(): Promise<void> {
    if (this.debugMode) {
      console.error('[TELEMETRY] Flush called');
    }
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    if (this.debugMode) {
      console.error('[TELEMETRY] Shutdown');
    }
    return Promise.resolve();
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
      // Use AlphaTelemetryClient for production
      // Use ConsoleTelemetryClient for debug mode
      if (process.env['AGENTLINT_TELEMETRY_DEBUG'] === '1') {
        return new ConsoleTelemetryClient();
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
