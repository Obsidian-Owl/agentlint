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
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  // Must have at least one message-specific field
  return obj.tokens !== undefined || typeof obj.cost === 'number' || typeof obj.finish === 'string';
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
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  // Error events should have a message or error field
  return typeof obj.message === 'string' || typeof obj.error === 'string';
}

/**
 * Text event data shape (message.part.updated)
 * SDK structure: { part: { type: "text", text: "..." } }
 */
export interface TextEventData {
  part?: {
    type?: string;
    text?: string;
  };
  [key: string]: unknown;
}

/**
 * Type guard for text event data
 */
export function isTextEventData(data: unknown): data is TextEventData {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (obj.part && typeof obj.part === 'object') {
    const part = obj.part as Record<string, unknown>;
    return 'text' in part;
  }
  return false;
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
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  // Status events must have a status field
  return 'status' in obj;
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
 * SDK structure: { part: { text: "..." } }
 */
export function extractText(data: unknown): string {
  if (!isTextEventData(data)) return '';
  const text = data.part?.text;
  return typeof text === 'string' ? text : '';
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

/**
 * Extract part type from text event data
 * SDK structure: { part: { type: "text" | "reasoning" | ... } }
 */
export function extractPartType(data: unknown): string | null {
  if (!isTextEventData(data)) return null;
  const partType = data.part?.type;
  return typeof partType === 'string' ? partType : null;
}
