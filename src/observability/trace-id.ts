/**
 * EP22: Trace ID Generation
 *
 * Generates W3C Trace Context compatible identifiers using UUID v7.
 * UUID v7 is time-sortable, which enables chronological ordering of traces.
 */

import { v7 as uuidv7 } from 'uuid';

/**
 * Generate a W3C Trace Context compatible trace ID.
 *
 * Uses UUID v7 for time-sortability, formatted as 32 hex characters
 * (UUID without hyphens) per W3C Trace Context specification.
 *
 * @returns 32 character hex string (e.g., "018e5e5e5e5e70008000012345678ab")
 */
export function generateTraceId(): string {
  // UUID v7 generates time-sortable UUIDs
  // Remove hyphens to get 32-char hex format for W3C Trace Context
  return uuidv7().replace(/-/g, '');
}

/**
 * Generate a span ID for use within a trace.
 *
 * Uses the last 16 characters of a UUID v7 for uniqueness,
 * per W3C Trace Context specification.
 *
 * @returns 16 character hex string (e.g., "a1b2c3d4e5f6a7b8")
 */
export function generateSpanId(): string {
  // Take last 16 hex chars from UUID v7 (after removing hyphens)
  const uuid = uuidv7().replace(/-/g, '');
  return uuid.slice(-16);
}

/**
 * Format trace context as W3C traceparent header value.
 *
 * Format: {version}-{trace-id}-{span-id}-{trace-flags}
 * Example: 00-018e5e5e5e5e70008000012345678ab-a1b2c3d4e5f6a7b8-01
 *
 * @param traceId - 32 character hex trace ID
 * @param spanId - 16 character hex span ID
 * @param sampled - Whether this trace is sampled (default: true)
 * @returns W3C traceparent header value
 */
export function formatTraceparent(
  traceId: string,
  spanId: string,
  sampled: boolean = true
): string {
  const version = '00';
  const traceFlags = sampled ? '01' : '00';
  return `${version}-${traceId}-${spanId}-${traceFlags}`;
}

/**
 * Parse a W3C traceparent header value.
 *
 * @param traceparent - W3C traceparent header value
 * @returns Parsed components or null if invalid
 */
export function parseTraceparent(traceparent: string): {
  version: string;
  traceId: string;
  spanId: string;
  traceFlags: number;
} | null {
  const match = traceparent.match(/^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i);

  if (!match || match.length < 5) {
    return null;
  }

  // Validated by regex pattern above
  return {
    version: match[1]!,
    traceId: match[2]!.toLowerCase(),
    spanId: match[3]!.toLowerCase(),
    traceFlags: parseInt(match[4]!, 16),
  };
}
