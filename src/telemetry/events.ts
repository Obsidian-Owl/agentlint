/**
 * Telemetry Event Types and Schemas
 *
 * Comprehensive event types for alpha phase telemetry.
 *
 * Privacy model (alpha phase - opt-in debugging):
 * - Users explicitly enable telemetry knowing data goes to HoneyHive
 * - Full debugging info (paths, tool I/O, errors) is sent for observability
 * - Only actual secrets (API keys, passwords, tokens) are redacted
 * - Uses the comprehensive redaction patterns from src/debug/redaction.ts
 *
 * @module telemetry/events
 */

import { redact } from '../debug/redaction';

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
  | 'command.end'
  | 'agent.subagent'
  | 'agent.turn';

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
  /** Project/directory name for human-readable session naming */
  directory?: string;
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
  /** Full tool input arguments */
  toolInput?: Record<string, unknown>;
  /** Tool output/result (truncated if large) */
  toolOutput?: unknown;
  /** Error message if tool failed */
  errorMessage?: string;
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
  /** Model provider (e.g., 'anthropic') */
  provider?: string;
  /** Estimated cost in USD */
  cost?: number;
  /** Model temperature setting */
  temperature?: number;
  /** Max tokens setting */
  maxTokens?: number;
  /** Top-p sampling parameter */
  topP?: number;
  /** Stop reason from model response */
  stopReason?: string;
  /** Cache read tokens (prompt caching) */
  cacheReadTokens?: number;
  /** Cache creation tokens (prompt caching) */
  cacheCreationTokens?: number;
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
 * Data for agent.subagent event.
 */
export interface SubagentEventData {
  agentType: string;
  description?: string;
  toolCount?: number;
  tokenCount?: number;
}

/**
 * Data for agent.turn event.
 */
export interface AgentTurnEventData {
  turnNumber: number;
  inputTokens: number;
  outputTokens: number;
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
  | CommandEndData
  | SubagentEventData
  | AgentTurnEventData;

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
 * Fields that are NEVER allowed in telemetry data (by key name).
 * These field NAMES indicate the value is a secret.
 *
 * IMPORTANT: This is now secrets-only. For alpha phase telemetry, we WANT
 * debugging information like paths, messages, inputs, outputs to be visible
 * in HoneyHive traces. Users explicitly opt-in knowing data goes to HoneyHive.
 *
 * What IS sent (for debugging):
 * - File paths - needed to understand what was analyzed
 * - Tool inputs/outputs - needed to debug tool behavior
 * - Error messages/stacks - needed to debug failures
 * - Code snippets - needed to understand context
 * - Config values - needed to understand settings
 *
 * What is REDACTED (secrets only):
 * - Fields with secret-like names (password, apikey, token, etc.)
 * - Values matching secret patterns (sk-xxx, Bearer tokens, etc.) via redact()
 */
export const FORBIDDEN_FIELDS = [
  'secret',
  'apikey',
  'api_key',
  'password',
  'credential',
  'bearer',
  'authorization',
  'private_key',
  'privatekey',
] as const;

/**
 * Deep clone an object, strip forbidden fields, and redact secret patterns.
 * Uses the comprehensive redaction patterns from src/debug/redaction.ts.
 */
export function sanitizeEventData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip forbidden fields (secret-related field names)
    if (FORBIDDEN_FIELDS.some((f) => key.toLowerCase().includes(f))) {
      continue;
    }

    // Recursively sanitize nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeEventData(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      // Sanitize arrays of objects
      sanitized[key] = value.map((item: unknown) => {
        if (typeof item === 'object' && item !== null) {
          return sanitizeEventData(item as Record<string, unknown>);
        } else if (typeof item === 'string') {
          // Use comprehensive redaction from debug module
          return redact(item);
        }
        return item;
      });
    } else if (typeof value === 'string') {
      // Use comprehensive redaction from debug module
      sanitized[key] = redact(value);
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
