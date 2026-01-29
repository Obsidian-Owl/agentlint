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
import { createDebugLogger, DEBUG_NAMESPACES } from '../debug';
import type {
  ITelemetryClient,
  SessionStartData,
  SessionMetrics,
  TrackPromptOptions,
} from './types';

// Re-export event types (except SessionStartData which comes from ./types)
export type {
  TelemetryEventType,
  SessionEndData,
  SessionErrorData,
  ToolCallData,
  FindingDetectedData,
  RecommendationGeneratedData,
  LLMUsageData,
  CheckpointSavedData,
  ConfigLoadedData,
  CommandStartData,
  CommandEndData,
  PromptUsedData,
  TelemetryEventData,
  TelemetryEventMeta,
  TelemetryEvent,
  CreateEventOptions,
} from './events';
export {
  getTelemetrySource,
  getTelemetryMeta,
  generateEventId,
  FORBIDDEN_FIELDS,
  sanitizeEventData,
  createTelemetryEvent,
} from './events';

// Re-export type definitions
export * from './types';

// Re-export constants
export * from './constants';

// Create module-level logger
const logger = createDebugLogger({
  namespaces: [DEBUG_NAMESPACES.ORCHESTRATION],
});

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

  trackPrompt(_sessionId: string, _options: TrackPromptOptions): void {
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
    logger.error(DEBUG_NAMESPACES.ORCHESTRATION, `[TELEMETRY] ${event.type}`, event.data);

    // Also send to server (parent behavior)
    super.record(event);
  }

  /**
   * Log flush for debugging.
   */
  override async flush(): Promise<void> {
    logger.error(DEBUG_NAMESPACES.ORCHESTRATION, '[TELEMETRY] Flush called');
    await super.flush();
  }

  /**
   * Log shutdown for debugging.
   */
  override async shutdown(): Promise<void> {
    logger.error(DEBUG_NAMESPACES.ORCHESTRATION, '[TELEMETRY] Shutdown');
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
    globalClient.init(getTelemetryConfig()).catch((error) => {
      // Log but don't crash - telemetry is non-critical
      if (process.env['AGENTLINT_TELEMETRY_DEBUG'] === '1') {
        logger.warn(DEBUG_NAMESPACES.ORCHESTRATION, '[telemetry] Init failed:', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
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
      logger.warn(
        DEBUG_NAMESPACES.ORCHESTRATION,
        '[telemetry] OTEL mode not yet implemented, telemetry disabled'
      );
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
