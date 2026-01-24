/**
 * EP15 Session Intelligence - Tool Sequence Extraction
 *
 * Extracts tool call sequences from session entries, calculates input hashes,
 * and detects repeat patterns.
 *
 * Per Constitution Principle VII: Returns data (sequences, hashes, counts).
 * Agent interprets whether patterns indicate issues.
 *
 * @module sessions/extraction/tool-sequences
 */

import { createHash } from 'node:crypto';
import type { SessionEntry, ContentBlock } from '../../tools/sessions/types';
import type { ToolCallRecord, ToolRepeatPattern } from '../types';

// =============================================================================
// Constants
// =============================================================================

/** Maximum error message length to store */
const MAX_ERROR_MESSAGE_LENGTH = 1024;

// =============================================================================
// Input Hash Calculation
// =============================================================================

/**
 * Calculate a SHA-256 hash of tool input for detecting repeated calls.
 *
 * @param input - Tool input object
 * @returns 64-character hex hash
 *
 * @example
 * ```typescript
 * const hash = calculateInputHash({ file_path: '/src/index.ts' });
 * // Returns consistent hash for same input
 * ```
 */
export function calculateInputHash(input: Record<string, unknown>): string {
  // Sort keys for consistent hashing regardless of property order
  const sortedInput = sortObjectKeys(input);
  const json = JSON.stringify(sortedInput);
  return createHash('sha256').update(json).digest('hex');
}

/**
 * Recursively sort object keys for consistent JSON serialization.
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  for (const key of keys) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

// =============================================================================
// Tool Sequence Extraction
// =============================================================================

/**
 * Extract tool call sequences from session entries.
 *
 * Processes assistant messages to find tool_use blocks and matches them
 * with their corresponding tool_result entries.
 *
 * @param entries - Session entries from JSONL
 * @param sessionId - Session UUID
 * @returns Array of tool call records in sequence order
 *
 * @example
 * ```typescript
 * const sequences = extractToolSequences(entries, 'session-123');
 * // Returns: [{ toolName: 'Read', sequenceIndex: 0, ... }, ...]
 * ```
 */
export function extractToolSequences(entries: SessionEntry[], sessionId: string): ToolCallRecord[] {
  const sequences: ToolCallRecord[] = [];
  let sequenceIndex = 0;

  // Build a map of tool_use_id -> tool result for matching
  const toolResults = new Map<string, { isError: boolean; errorMessage?: string }>();
  for (const entry of entries) {
    if (entry.type === 'tool_result' && entry.toolResult) {
      const resultInfo: { isError: boolean; errorMessage?: string } = {
        isError: entry.toolResult.isError ?? false,
      };
      if (entry.toolResult.isError && entry.toolResult.content) {
        resultInfo.errorMessage = entry.toolResult.content;
      }
      toolResults.set(entry.toolResult.toolUseId, resultInfo);
    }
  }

  // Extract tool calls from assistant messages
  for (const entry of entries) {
    if (entry.type !== 'assistant' || !entry.message?.content) {
      continue;
    }

    const toolUseBlocks = entry.message.content.filter(
      (
        block
      ): block is ContentBlock & {
        type: 'tool_use';
        name: string;
        input: Record<string, unknown>;
      } => block.type === 'tool_use' && typeof block.name === 'string'
    );

    for (const block of toolUseBlocks) {
      const toolId = block.id ?? '';
      const result = toolResults.get(toolId);
      const isError = result?.isError ?? false;
      let errorMessage = result?.errorMessage;

      // Truncate long error messages
      if (errorMessage && errorMessage.length > MAX_ERROR_MESSAGE_LENGTH) {
        errorMessage = errorMessage.slice(0, MAX_ERROR_MESSAGE_LENGTH);
      }

      const record: ToolCallRecord = {
        sessionId,
        toolName: block.name,
        inputHash: calculateInputHash(block.input ?? {}),
        timestamp: entry.timestamp,
        sequenceIndex,
        isError,
      };

      // Only add optional properties if they have values
      if (errorMessage) {
        record.errorMessage = errorMessage;
      }
      if (entry.filePath) {
        record.filePath = entry.filePath;
      }
      if (entry.lineNumber !== undefined) {
        record.lineNumber = entry.lineNumber;
      }

      sequences.push(record);
      sequenceIndex++;
    }
  }

  return sequences;
}

// =============================================================================
// Repeat Pattern Detection
// =============================================================================

/**
 * Detect repeated tool calls with the same input hash.
 *
 * Per Constitution Principle VII: Returns pattern data (counts, indices).
 * Agent interprets whether these indicate "stuck" behavior or valid retries.
 *
 * @param sequences - Tool call records from extractToolSequences
 * @returns Array of repeat patterns (only includes patterns with count >= 2)
 *
 * @example
 * ```typescript
 * const patterns = detectRepeatPatterns(sequences);
 * // Returns: [{ toolName: 'Bash', repeatCount: 3, ... }]
 * ```
 */
export function detectRepeatPatterns(sequences: ToolCallRecord[]): ToolRepeatPattern[] {
  if (sequences.length === 0) {
    return [];
  }

  // Group by tool name + input hash
  const groups = new Map<
    string,
    {
      toolName: string;
      inputHash: string;
      occurrences: number[];
    }
  >();

  for (const seq of sequences) {
    const key = `${seq.toolName}:${seq.inputHash}`;
    const existing = groups.get(key);

    if (existing) {
      existing.occurrences.push(seq.sequenceIndex);
    } else {
      groups.set(key, {
        toolName: seq.toolName,
        inputHash: seq.inputHash,
        occurrences: [seq.sequenceIndex],
      });
    }
  }

  // Filter to patterns with >= 2 occurrences
  const patterns: ToolRepeatPattern[] = [];

  for (const group of groups.values()) {
    if (group.occurrences.length >= 2) {
      patterns.push({
        toolName: group.toolName,
        inputHash: group.inputHash,
        repeatCount: group.occurrences.length,
        firstOccurrence: Math.min(...group.occurrences),
        lastOccurrence: Math.max(...group.occurrences),
      });
    }
  }

  return patterns;
}
