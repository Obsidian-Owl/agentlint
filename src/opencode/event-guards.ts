/**
 * Opencode Event Type Guards
 *
 * Centralized type guards for SDK event data parsing.
 * Replaces scattered `as Record<string, unknown>` casts with proper type narrowing.
 *
 * @module opencode/event-guards
 */

/**
 * Tool event data shape (tool.call.started, tool.call.completed)
 */
export interface ToolEventData {
  name: string;
  input?: Record<string, unknown>;
  output?: unknown;
  isError?: boolean;
  time?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Type guard for tool event data
 */
export function isToolEventData(data: unknown): data is ToolEventData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    typeof (data as Record<string, unknown>).name === 'string'
  );
}

/**
 * Token usage data shape
 */
export interface TokenData {
  input?: number;
  output?: number;
  cache?: {
    read?: number;
    write?: number;
  };
}

/**
 * Message event data shape (message.updated)
 */
export interface MessageEventData {
  tokens?: TokenData;
  cost?: number;
  finish?: string;
  [key: string]: unknown;
}

/**
 * Type guard for message event data
 */
export function isMessageEventData(data: unknown): data is MessageEventData {
  return typeof data === 'object' && data !== null;
}

/**
 * Error event data shape (session.error)
 */
export interface ErrorEventData {
  message?: string;
  [key: string]: unknown;
}

/**
 * Type guard for error event data
 */
export function isErrorEventData(data: unknown): data is ErrorEventData {
  return typeof data === 'object' && data !== null;
}

/**
 * Text event data shape (message.part.updated)
 */
export interface TextEventData {
  text?: unknown;
  [key: string]: unknown;
}

/**
 * Type guard for text event data
 */
export function isTextEventData(data: unknown): data is TextEventData {
  return typeof data === 'object' && data !== null;
}

/**
 * Status event data shape (status.updated)
 */
export interface StatusEventData {
  status?: unknown;
  [key: string]: unknown;
}

/**
 * Type guard for status event data
 */
export function isStatusEventData(data: unknown): data is StatusEventData {
  return typeof data === 'object' && data !== null;
}

/**
 * Safely extract a string field from unknown data
 */
export function extractString(data: unknown, field: string, fallback: string): string {
  if (data && typeof data === 'object' && field in data) {
    const value = (data as Record<string, unknown>)[field];
    return typeof value === 'string' ? value : fallback;
  }
  return fallback;
}

/**
 * Safely extract tool name from event data
 */
export function extractToolName(data: unknown): string {
  return isToolEventData(data) ? data.name : 'unknown';
}

/**
 * Safely extract text content from event data
 */
export function extractText(data: unknown): string {
  if (isTextEventData(data) && typeof data.text === 'string') {
    return data.text;
  }
  return '';
}

/**
 * Safely extract status message from event data
 */
export function extractStatus(data: unknown): string {
  if (isStatusEventData(data) && typeof data.status === 'string') {
    return data.status;
  }
  return 'status update';
}
