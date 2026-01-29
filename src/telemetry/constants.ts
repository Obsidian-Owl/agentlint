/**
 * EP22: Centralized telemetry configuration constants
 */

// From telemetry-tracker.ts
export const MAX_PENDING_TOOLS = 100;
export const TOOL_TRACKING_TTL_MS = 5 * 60 * 1000; // 5 minutes

// From alpha-client.ts
export const FLUSH_INTERVAL_MS = 10_000;
export const MAX_BUFFER_SIZE = 100;
export const REQUEST_TIMEOUT_MS = 5_000;

// From telemetry-utils.ts
export const DEFAULT_TRUNCATION_LIMIT = 5000;
export const ERROR_TRUNCATION_LIMIT = 1000;
