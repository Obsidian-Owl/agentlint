/**
 * Telemetry Event Types and Schemas
 *
 * Comprehensive event types for alpha phase telemetry.
 * These events capture usage patterns without any user content.
 *
 * Privacy rules (hardcoded, cannot be disabled):
 * - NO file paths or contents
 * - NO prompts or AI responses
 * - NO user code or configuration values
 * - NO stack traces or error messages
 * - NO IP addresses (used for rate limiting only, not stored)
 *
 * @module telemetry/events
 */

// =============================================================================
// Event Types
// =============================================================================

/**
 * All telemetry event types.
 */
export type TelemetryEventType =
  | 'session.start'
  | 'session.end'
  | 'session.error'
  | 'tool.call'
  | 'finding.detected'
  | 'recommendation.generated'
  | 'llm.usage'
  | 'checkpoint.saved'
  | 'config.loaded'
  | 'command.start'
  | 'command.end';

// =============================================================================
// Event Data Types (Type-Safe Per Event)
// =============================================================================

/**
 * Data for session.start event.
 */
export interface SessionStartData {
  command: 'analyse' | 'scan' | 'compare' | 'validate' | 'trace';
  hasConfig: boolean;
  projectType?: string;
}

/**
 * Data for session.end event.
 */
export interface SessionEndData {
  durationMs: number;
  toolCallCount: number;
  findingCount: number;
  recommendationCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  success: boolean;
  interrupted: boolean;
}

/**
 * Data for session.error event.
 */
export interface SessionErrorData {
  errorType: string;
  errorCode?: string;
}

/**
 * Data for tool.call event.
 */
export interface ToolCallData {
  tool: string;
  durationMs: number;
  success: boolean;
}

/**
 * Data for finding.detected event.
 */
export interface FindingDetectedData {
  findingType: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Data for recommendation.generated event.
 */
export interface RecommendationGeneratedData {
  recommendationType: string;
  findingId?: string;
}

/**
 * Data for llm.usage event.
 */
export interface LLMUsageData {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs?: number;
  cached?: boolean;
}

/**
 * Data for checkpoint.saved event.
 */
export interface CheckpointSavedData {
  checkpointType: string;
  sequence: number;
}

/**
 * Data for config.loaded event.
 */
export interface ConfigLoadedData {
  configType: string;
  hasCustomSettings: boolean;
}

/**
 * Data for command.start event.
 */
export interface CommandStartData {
  command: string;
}

/**
 * Data for command.end event.
 */
export interface CommandEndData {
  command: string;
  durationMs: number;
  success: boolean;
}

/**
 * Union of all event data types.
 */
export type TelemetryEventData =
  | SessionStartData
  | SessionEndData
  | SessionErrorData
  | ToolCallData
  | FindingDetectedData
  | RecommendationGeneratedData
  | LLMUsageData
  | CheckpointSavedData
  | ConfigLoadedData
  | CommandStartData
  | CommandEndData;

// =============================================================================
// Event Metadata
// =============================================================================

/**
 * Metadata included with every event.
 */
export interface TelemetryEventMeta {
  /** agentlint version */
  version: string;
  /** Platform (darwin, linux, win32) */
  platform: string;
  /** Node.js version */
  nodeVersion: string;
  /** Source identifier (agentlint-cli for production, agentlint-cli-test for tests) */
  source: string;
}

// =============================================================================
// Telemetry Event
// =============================================================================

/**
 * Complete telemetry event.
 */
export interface TelemetryEvent {
  /** Event type */
  type: TelemetryEventType;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Start time in UTC milliseconds (for HoneyHive compatibility) */
  startTime: number;
  /** End time in UTC milliseconds (for HoneyHive compatibility) */
  endTime: number;
  /** Session ID for correlation */
  sessionId: string;
  /** Event ID (UUID) */
  eventId: string;
  /** Sequence number within session */
  sequence: number;
  /** Parent event ID for trace hierarchy */
  parentEventId?: string;
  /** Event-specific data */
  data: Record<string, unknown>;
  /** Event metadata */
  meta: TelemetryEventMeta;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get the telemetry source name.
 * Can be overridden via AGENTLINT_TELEMETRY_SOURCE env var.
 * Defaults to 'agentlint-cli' for production, 'agentlint-cli-test' if NODE_ENV=test.
 */
export function getTelemetrySource(): string {
  // Explicit override via env var
  const envSource = process.env['AGENTLINT_TELEMETRY_SOURCE'];
  if (envSource) {
    return envSource;
  }

  // Auto-detect test environment
  if (
    process.env['NODE_ENV'] === 'test' ||
    process.env['BUN_ENV'] === 'test' ||
    process.env['VITEST'] ||
    process.env['JEST_WORKER_ID']
  ) {
    return 'agentlint-cli-test';
  }

  return 'agentlint-cli';
}

/**
 * Get telemetry metadata for events.
 */
export function getTelemetryMeta(): TelemetryEventMeta {
  return {
    version: process.env['npm_package_version'] ?? 'unknown',
    platform: process.platform,
    nodeVersion: process.version,
    source: getTelemetrySource(),
  };
}

/**
 * Generate a random event ID.
 */
export function generateEventId(): string {
  return crypto.randomUUID();
}

/**
 * Fields that are NEVER allowed in telemetry data.
 * These are stripped before sending.
 */
export const FORBIDDEN_FIELDS = [
  'content',
  'prompt',
  'response',
  'path',
  'file',
  'code',
  'message',
  'stack',
  'arguments',
  'result',
  'input',
  'output',
  'config',
  'env',
  'secret',
  'key',
  'token',
  'password',
  'credential',
] as const;

/**
 * Deep clone an object and strip forbidden fields.
 * This is a safety net - events should not contain these fields in the first place.
 */
export function sanitizeEventData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip forbidden fields
    if (FORBIDDEN_FIELDS.some((f) => key.toLowerCase().includes(f))) {
      continue;
    }

    // Recursively sanitize nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeEventData(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      // Sanitize arrays of objects
      sanitized[key] = value.map((item: unknown) =>
        typeof item === 'object' && item !== null
          ? sanitizeEventData(item as Record<string, unknown>)
          : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Options for creating a telemetry event with timing info.
 */
export interface CreateEventOptions {
  /** Parent event ID for trace hierarchy */
  parentEventId?: string;
  /** Start time in UTC milliseconds (defaults to now) */
  startTime?: number;
  /** End time in UTC milliseconds (defaults to now) */
  endTime?: number;
}

/**
 * Create a telemetry event with validation and sanitization.
 */
export function createTelemetryEvent(
  type: TelemetryEventType,
  sessionId: string,
  sequence: number,
  data: Record<string, unknown>,
  options?: CreateEventOptions | string // string for backward compat with parentEventId
): TelemetryEvent {
  const now = Date.now();

  // Handle backward compatibility: options can be a parentEventId string
  const opts: CreateEventOptions =
    typeof options === 'string' ? { parentEventId: options } : (options ?? {});

  const event: TelemetryEvent = {
    type,
    timestamp: new Date().toISOString(),
    startTime: opts.startTime ?? now,
    endTime: opts.endTime ?? now,
    sessionId,
    eventId: generateEventId(),
    sequence,
    data: sanitizeEventData(data),
    meta: getTelemetryMeta(),
  };

  // Only include parentEventId if defined (exactOptionalPropertyTypes compliance)
  if (opts.parentEventId !== undefined) {
    event.parentEventId = opts.parentEventId;
  }

  return event;
}
