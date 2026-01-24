/**
 * EP15 Session Intelligence - Timeline Visualization Data
 *
 * Provides data structures and utilities for timeline visualization.
 * Designed for future TUI rendering (EP17).
 *
 * Per FR-021: Timeline data includes phase markers and key moments.
 * Per US-007: Events have consistent structure for rendering.
 *
 * @module sessions/extraction/timeline-viz
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * All possible timeline visualization event types.
 */
export const TIMELINE_VIZ_EVENT_TYPES = [
  'user_message',
  'assistant_message',
  'tool_call',
  'tool_result',
  'compression',
  'error',
  'delegation',
  'system',
] as const;

/**
 * Key moment types for flagging important events.
 */
export const KEY_MOMENT_TYPES = [
  'error',
  'compression',
  'milestone',
  'phase_transition',
  'delegation_start',
  'delegation_end',
] as const;

/**
 * Tool categories for visualization grouping.
 */
export const TOOL_CATEGORIES = [
  'navigation', // Read, Glob, Grep
  'mutation', // Edit, Write
  'execution', // Bash
  'coordination', // Task
  'external', // mcp__*
  'unknown',
] as const;

// =============================================================================
// Types
// =============================================================================

/**
 * Timeline visualization event type.
 */
export type TimelineVizEventType = (typeof TIMELINE_VIZ_EVENT_TYPES)[number];

/**
 * Key moment type for flagging important events.
 */
export type KeyMomentType = (typeof KEY_MOMENT_TYPES)[number];

/**
 * Tool category for visualization grouping.
 */
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

/**
 * Arbitrary metadata for timeline events.
 * Flexible structure to support different event types.
 */
export interface TimelineVizMetadata {
  // Compression events
  preTokens?: number;
  postTokens?: number;
  tokensSaved?: number;

  // Error events
  errorType?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  errorMessage?: string;

  // Delegation events
  subagentType?: string;
  taskPrompt?: string;
  delegationSuccess?: boolean;

  // Phase transition
  fromPhase?: string;
  toPhase?: string;

  // Tool-specific
  filePath?: string;
  linesRead?: number;
  command?: string;

  // Allow arbitrary additional fields
  [key: string]: unknown;
}

/**
 * A timeline visualization event.
 *
 * Consistent structure for all event types, suitable for rendering.
 * Key moments are flagged for visual emphasis.
 */
export interface TimelineVizEvent {
  /** Event type */
  type: TimelineVizEventType;

  /** ISO timestamp */
  timestamp: string;

  /** Turn index in session (1-based) */
  turnIndex: number;

  /** Human-readable summary of the event */
  summary: string;

  /** Whether this is a key moment (error, compression, milestone) */
  isKeyMoment: boolean;

  /** Type of key moment (if isKeyMoment is true) */
  keyMomentType?: KeyMomentType;

  /** Tool name (for tool_call events) */
  toolName?: string;

  /** Tool category (for tool_call events) */
  toolCategory?: ToolCategory;

  /** Flexible metadata for event-specific data */
  metadata?: TimelineVizMetadata;
}

/**
 * Input for creating a timeline visualization event.
 */
export interface CreateTimelineVizEventInput {
  type: TimelineVizEventType;
  timestamp: string;
  turnIndex: number;
  summary: string;
  isKeyMoment?: boolean;
  keyMomentType?: KeyMomentType;
  toolName?: string;
  toolCategory?: ToolCategory;
  metadata?: TimelineVizMetadata;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a timeline visualization event with consistent structure.
 *
 * @param input - Event creation input
 * @returns TimelineVizEvent with defaults applied
 *
 * @example
 * ```typescript
 * const event = createTimelineVizEvent({
 *   type: 'tool_call',
 *   timestamp: '2026-01-24T10:00:00Z',
 *   turnIndex: 5,
 *   summary: 'Read src/index.ts',
 *   toolName: 'Read',
 *   toolCategory: 'navigation',
 * });
 * ```
 */
export function createTimelineVizEvent(input: CreateTimelineVizEventInput): TimelineVizEvent {
  const event: TimelineVizEvent = {
    type: input.type,
    timestamp: input.timestamp,
    turnIndex: input.turnIndex,
    summary: input.summary,
    isKeyMoment: input.isKeyMoment ?? false,
  };

  // Add optional fields only if defined
  if (input.keyMomentType !== undefined) {
    event.keyMomentType = input.keyMomentType;
  }
  if (input.toolName !== undefined) {
    event.toolName = input.toolName;
  }
  if (input.toolCategory !== undefined) {
    event.toolCategory = input.toolCategory;
  }
  if (input.metadata !== undefined) {
    event.metadata = input.metadata;
  }

  return event;
}

/**
 * Flag an event as a key moment (immutable - returns new event).
 *
 * @param event - Original event
 * @param momentType - Type of key moment
 * @param additionalMetadata - Optional metadata to merge
 * @returns New event with key moment flag
 *
 * @example
 * ```typescript
 * const flaggedEvent = flagKeyMoment(event, 'phase_transition', {
 *   fromPhase: 'exploration',
 *   toPhase: 'implementation',
 * });
 * ```
 */
export function flagKeyMoment(
  event: TimelineVizEvent,
  momentType: KeyMomentType,
  additionalMetadata?: TimelineVizMetadata
): TimelineVizEvent {
  const result: TimelineVizEvent = {
    ...event,
    isKeyMoment: true,
    keyMomentType: momentType,
  };

  // Merge metadata if we have additional metadata or existing metadata
  if (additionalMetadata !== undefined) {
    result.metadata = event.metadata
      ? { ...event.metadata, ...additionalMetadata }
      : additionalMetadata;
  } else if (event.metadata !== undefined) {
    result.metadata = event.metadata;
  }

  return result;
}

/**
 * Check if an event is a key moment.
 *
 * @param event - Event to check
 * @returns True if the event is flagged as a key moment
 */
export function isKeyMoment(event: TimelineVizEvent): boolean {
  return event.isKeyMoment === true;
}

// =============================================================================
// Tool Category Classification
// =============================================================================

/**
 * Classify a tool name into a category.
 *
 * @param toolName - Name of the tool
 * @returns Tool category
 */
export function classifyToolCategory(toolName: string): ToolCategory {
  // Navigation tools
  if (['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch'].includes(toolName)) {
    return 'navigation';
  }

  // Mutation tools
  if (['Edit', 'Write', 'NotebookEdit'].includes(toolName)) {
    return 'mutation';
  }

  // Execution tools
  if (['Bash'].includes(toolName)) {
    return 'execution';
  }

  // Coordination tools
  if (['Task', 'Skill'].includes(toolName)) {
    return 'coordination';
  }

  // External tools (MCP)
  if (toolName.startsWith('mcp__')) {
    return 'external';
  }

  return 'unknown';
}

// =============================================================================
// Timeline Building Utilities
// =============================================================================

/**
 * Filter events to only key moments.
 *
 * @param events - Array of timeline events
 * @returns Array containing only key moment events
 */
export function filterKeyMoments(events: TimelineVizEvent[]): TimelineVizEvent[] {
  return events.filter(isKeyMoment);
}

/**
 * Group events by type.
 *
 * @param events - Array of timeline events
 * @returns Map of event type to events
 */
export function groupEventsByType(
  events: TimelineVizEvent[]
): Map<TimelineVizEventType, TimelineVizEvent[]> {
  const groups = new Map<TimelineVizEventType, TimelineVizEvent[]>();

  for (const event of events) {
    const existing = groups.get(event.type) ?? [];
    existing.push(event);
    groups.set(event.type, existing);
  }

  return groups;
}

/**
 * Get event counts by type.
 *
 * @param events - Array of timeline events
 * @returns Record of event type to count
 */
export function getEventCounts(events: TimelineVizEvent[]): Record<TimelineVizEventType, number> {
  const counts: Record<string, number> = {};

  for (const type of TIMELINE_VIZ_EVENT_TYPES) {
    counts[type] = 0;
  }

  for (const event of events) {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
  }

  return counts as Record<TimelineVizEventType, number>;
}
