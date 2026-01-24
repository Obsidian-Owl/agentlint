/**
 * EP15 Session Intelligence - Delegation Event Extraction
 *
 * Extracts Task tool calls as delegation events, tracking subagent type,
 * prompt, and success/failure status.
 *
 * Per Constitution Principle VII: Returns data (events, counts).
 * Agent interprets whether delegation patterns indicate issues.
 *
 * @module sessions/extraction/delegations
 */

import type { SessionEntry, ContentBlock } from '../../tools/sessions/types';
import type { DelegationEventRecord } from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * Summary of delegations by subagent type.
 */
export interface SubagentTypeSummary {
  /** Subagent type name */
  subagentType: string;
  /** Total delegations of this type */
  count: number;
  /** Successful delegations */
  successCount: number;
  /** Failed delegations */
  failureCount: number;
}

/**
 * Aggregated delegation statistics.
 */
export interface DelegationSummary {
  /** Total number of delegations */
  totalDelegations: number;
  /** Number of successful delegations */
  successCount: number;
  /** Number of failed delegations */
  failureCount: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Breakdown by subagent type */
  bySubagentType: SubagentTypeSummary[];
}

// =============================================================================
// Delegation Event Extraction
// =============================================================================

/**
 * Extract delegation events (Task tool calls) from session entries.
 *
 * Processes assistant messages to find Task tool calls and matches them
 * with their corresponding tool_result entries.
 *
 * @param entries - Session entries from JSONL
 * @param sessionId - Session UUID
 * @returns Array of delegation event records
 *
 * @example
 * ```typescript
 * const events = extractDelegationEvents(entries, 'session-123');
 * // Returns: [{ subagentType: 'Explore', taskPrompt: 'Find files', ... }]
 * ```
 */
export function extractDelegationEvents(
  entries: SessionEntry[],
  sessionId: string
): DelegationEventRecord[] {
  const events: DelegationEventRecord[] = [];

  // Build a map of tool_use_id -> tool result for matching
  const toolResults = new Map<string, { isError: boolean }>();
  for (const entry of entries) {
    if (entry.type === 'tool_result' && entry.toolResult) {
      toolResults.set(entry.toolResult.toolUseId, {
        isError: entry.toolResult.isError ?? false,
      });
    }
  }

  // Extract Task tool calls from assistant messages
  for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
    const entry = entries[entryIndex]!;

    if (entry.type !== 'assistant' || !entry.message?.content) {
      continue;
    }

    const taskBlocks = entry.message.content.filter(
      (
        block
      ): block is ContentBlock & {
        type: 'tool_use';
        name: 'Task';
        input: Record<string, unknown>;
      } => block.type === 'tool_use' && block.name === 'Task'
    );

    for (const block of taskBlocks) {
      const toolId = block.id ?? '';
      const result = toolResults.get(toolId);
      const success = !(result?.isError ?? false);

      const input = block.input ?? {};
      const subagentType =
        typeof input.subagent_type === 'string' ? input.subagent_type : 'unknown';
      const taskPrompt = typeof input.prompt === 'string' ? input.prompt : undefined;

      const event: DelegationEventRecord = {
        sessionId,
        subagentType,
        timestamp: entry.timestamp,
        turnIndex: entryIndex,
        success,
      };

      // Only add optional properties if they have values
      if (taskPrompt) {
        event.taskPrompt = taskPrompt;
      }
      if (entry.filePath) {
        event.filePath = entry.filePath;
      }
      if (entry.lineNumber !== undefined) {
        event.lineNumber = entry.lineNumber;
      }

      events.push(event);
    }
  }

  return events;
}

// =============================================================================
// Delegation Aggregation
// =============================================================================

/**
 * Aggregate delegation events into summary statistics.
 *
 * Per Constitution Principle VII: Returns counts as data.
 * Agent interprets whether patterns indicate issues.
 *
 * @param events - Delegation events from extractDelegationEvents
 * @returns Aggregated delegation summary
 *
 * @example
 * ```typescript
 * const summary = aggregateDelegations(events);
 * // Returns: { totalDelegations: 5, successRate: 0.8, bySubagentType: [...] }
 * ```
 */
export function aggregateDelegations(events: DelegationEventRecord[]): DelegationSummary {
  if (events.length === 0) {
    return {
      totalDelegations: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 1, // No failures = 100% success
      bySubagentType: [],
    };
  }

  // Group by subagent type
  const groups = new Map<
    string,
    {
      count: number;
      successCount: number;
      failureCount: number;
    }
  >();

  let totalSuccess = 0;
  let totalFailure = 0;

  for (const event of events) {
    const existing = groups.get(event.subagentType);

    if (existing) {
      existing.count++;
      if (event.success) {
        existing.successCount++;
        totalSuccess++;
      } else {
        existing.failureCount++;
        totalFailure++;
      }
    } else {
      groups.set(event.subagentType, {
        count: 1,
        successCount: event.success ? 1 : 0,
        failureCount: event.success ? 0 : 1,
      });
      if (event.success) {
        totalSuccess++;
      } else {
        totalFailure++;
      }
    }
  }

  // Convert to summaries
  const bySubagentType: SubagentTypeSummary[] = [];

  for (const [subagentType, stats] of groups) {
    bySubagentType.push({
      subagentType,
      count: stats.count,
      successCount: stats.successCount,
      failureCount: stats.failureCount,
    });
  }

  // Sort by count descending
  bySubagentType.sort((a, b) => b.count - a.count);

  const total = events.length;

  return {
    totalDelegations: total,
    successCount: totalSuccess,
    failureCount: totalFailure,
    successRate: totalSuccess / total,
    bySubagentType,
  };
}
