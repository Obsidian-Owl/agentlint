/**
 * Telemetry Module
 *
 * Opt-in telemetry infrastructure for agentlint.
 *
 * Disabled by default. Enable via:
 * - Environment variable: AGENTLINT_TELEMETRY=1
 * - Config file: ~/.agentlint/config.json -> telemetry.enabled: true
 *
 * When enabled, captures:
 * - Session statistics (duration, tool calls, findings)
 * - Error rates and types
 * - Token usage (aggregate, not content)
 *
 * User content is NEVER transmitted (redacted by default).
 *
 * @module telemetry
 */

import type { TelemetryConfig } from '../persistence/types';
import { DEFAULT_TELEMETRY_CONFIG } from '../persistence/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Telemetry event types.
 */
export type TelemetryEventType =
  | 'session_start'
  | 'session_end'
  | 'tool_call'
  | 'finding'
  | 'error';

/**
 * Base telemetry event.
 */
export interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: string;
  sessionId: string;
  data: Record<string, unknown>;
}

/**
 * Session metrics for telemetry.
 */
export interface SessionTelemetry {
  sessionId: string;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  toolCallCount: number;
  findingCount: number;
  errorCount: number;
  tokensUsed: number;
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Check if telemetry is enabled via environment variable.
 */
export function isTelemetryEnabled(): boolean {
  return process.env['AGENTLINT_TELEMETRY'] === '1';
}

/**
 * Get telemetry configuration from environment or defaults.
 */
export function getTelemetryConfig(): TelemetryConfig {
  if (!isTelemetryEnabled()) {
    return { ...DEFAULT_TELEMETRY_CONFIG, enabled: false };
  }

  const config: TelemetryConfig = {
    enabled: true,
    redactContent: true,
  };

  const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
  if (endpoint) {
    config.endpoint = endpoint;
  }

  return config;
}

// =============================================================================
// Telemetry Client
// =============================================================================

/**
 * Telemetry client interface.
 */
export interface ITelemetryClient {
  /** Check if telemetry is enabled */
  isEnabled(): boolean;

  /** Record a telemetry event */
  record(event: TelemetryEvent): void;

  /** Record session start */
  sessionStart(sessionId: string): void;

  /** Record session end with metrics */
  sessionEnd(metrics: SessionTelemetry): void;

  /** Flush any pending events */
  flush(): Promise<void>;

  /** Shutdown the client */
  shutdown(): Promise<void>;
}

/**
 * No-op telemetry client (used when telemetry is disabled).
 */
class NoOpTelemetryClient implements ITelemetryClient {
  isEnabled(): boolean {
    return false;
  }

  record(_event: TelemetryEvent): void {
    // No-op
  }

  sessionStart(_sessionId: string): void {
    // No-op
  }

  sessionEnd(_metrics: SessionTelemetry): void {
    // No-op
  }

  async flush(): Promise<void> {
    // No-op
  }

  async shutdown(): Promise<void> {
    // No-op
  }
}

/**
 * Console-based telemetry client for debugging.
 * Logs telemetry events to stderr when AGENTLINT_TELEMETRY_DEBUG=1.
 */
class ConsoleTelemetryClient implements ITelemetryClient {
  private events: TelemetryEvent[] = [];
  private debugMode: boolean;

  constructor() {
    this.debugMode = process.env['AGENTLINT_TELEMETRY_DEBUG'] === '1';
  }

  isEnabled(): boolean {
    return true;
  }

  record(event: TelemetryEvent): void {
    this.events.push(event);
    if (this.debugMode) {
      console.error(`[TELEMETRY] ${event.type}:`, JSON.stringify(event.data));
    }
  }

  sessionStart(sessionId: string): void {
    this.record({
      type: 'session_start',
      timestamp: new Date().toISOString(),
      sessionId,
      data: {},
    });
  }

  sessionEnd(metrics: SessionTelemetry): void {
    this.record({
      type: 'session_end',
      timestamp: new Date().toISOString(),
      sessionId: metrics.sessionId,
      data: {
        durationMs: metrics.durationMs,
        toolCallCount: metrics.toolCallCount,
        findingCount: metrics.findingCount,
        errorCount: metrics.errorCount,
        tokensUsed: metrics.tokensUsed,
      },
    });
  }

  flush(): Promise<void> {
    // In a full implementation, this would send events to the OTLP endpoint
    // For now, just clear the buffer
    if (this.debugMode && this.events.length > 0) {
      console.error(`[TELEMETRY] Flushing ${this.events.length} events`);
    }
    this.events = [];
    return Promise.resolve();
  }

  async shutdown(): Promise<void> {
    await this.flush();
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
  }
  return globalClient;
}

/**
 * Create a new telemetry client based on configuration.
 */
export function createTelemetryClient(): ITelemetryClient {
  if (!isTelemetryEnabled()) {
    return new NoOpTelemetryClient();
  }

  // For now, use the console client
  // Future: integrate OpenTelemetry SDK for OTLP export
  return new ConsoleTelemetryClient();
}

/**
 * Reset the global telemetry client.
 * Useful for testing.
 */
export function resetTelemetryClient(): void {
  globalClient = null;
}
