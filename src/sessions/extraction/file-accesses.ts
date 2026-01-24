/**
 * EP15 Session Intelligence - File Access Extraction
 *
 * Extracts file access patterns from session entries, tracking read/write/edit
 * operations from various tools.
 *
 * Per Constitution Principle VII: Returns data (paths, counts, operations).
 * Agent interprets whether patterns indicate issues.
 *
 * @module sessions/extraction/file-accesses
 */

import type { SessionEntry, ContentBlock } from '../../tools/sessions/types';
import type { FileAccessRecord, FileAccessSummary, FileOperation } from '../types';

// =============================================================================
// Tool to Operation Mapping
// =============================================================================

/** Tools that perform file reads */
const READ_TOOLS = new Set(['Read']);

/** Tools that perform file writes */
const WRITE_TOOLS = new Set(['Write']);

/** Tools that perform file edits */
const EDIT_TOOLS = new Set(['Edit']);

// =============================================================================
// Bash Command Parsing
// =============================================================================

/**
 * Parse a Bash command to detect file operations.
 *
 * @param command - The bash command string
 * @returns File operation info or null if not a file operation
 */
function parseBashFileOperation(
  command: string
): { filePath: string; operation: FileOperation } | null {
  const trimmed = command.trim();

  // cat <file> - read operation
  const catMatch = trimmed.match(/^cat\s+([^\s|><&;]+)/);
  if (catMatch && catMatch[1]) {
    return { filePath: catMatch[1], operation: 'read' };
  }

  // echo/printf > <file> - write operation
  const redirectMatch = trimmed.match(/>\s*([^\s|>&;]+)\s*$/);
  if (redirectMatch && redirectMatch[1]) {
    return { filePath: redirectMatch[1], operation: 'write' };
  }

  // head/tail <file> - read operation
  const headTailMatch = trimmed.match(/^(?:head|tail)\s+(?:-[^\s]+\s+)?([^\s|><&;]+)/);
  if (headTailMatch && headTailMatch[1]) {
    return { filePath: headTailMatch[1], operation: 'read' };
  }

  return null;
}

// =============================================================================
// File Access Extraction
// =============================================================================

/**
 * Extract file access records from session entries.
 *
 * Processes tool use blocks to identify file operations:
 * - Read tool → read operation
 * - Write tool → write operation
 * - Edit tool → edit operation
 * - Bash tool → parsed for cat, redirects, etc.
 *
 * @param entries - Session entries from JSONL
 * @param sessionId - Session UUID
 * @returns Array of file access records in sequence order
 *
 * @example
 * ```typescript
 * const accesses = extractFileAccesses(entries, 'session-123');
 * // Returns: [{ filePath: '/src/index.ts', operation: 'read', ... }]
 * ```
 */
export function extractFileAccesses(
  entries: SessionEntry[],
  sessionId: string
): FileAccessRecord[] {
  const accesses: FileAccessRecord[] = [];
  let accessSequence = 0;

  for (const entry of entries) {
    if (entry.type !== 'assistant' || !entry.message?.content) {
      continue;
    }

    const toolUseBlocks = entry.message.content.filter(
      (block): block is ContentBlock & { type: 'tool_use'; name: string } =>
        block.type === 'tool_use' && typeof block.name === 'string'
    );

    for (const block of toolUseBlocks) {
      const access = extractAccessFromToolUse(block, sessionId, entry.timestamp, accessSequence);

      if (access) {
        accesses.push(access);
        accessSequence++;
      }
    }
  }

  return accesses;
}

/**
 * Extract file access from a single tool use block.
 */
function extractAccessFromToolUse(
  block: ContentBlock & { type: 'tool_use'; name: string },
  sessionId: string,
  timestamp: string,
  accessSequence: number
): FileAccessRecord | null {
  const input = block.input;

  // Read tool
  if (READ_TOOLS.has(block.name)) {
    const filePath = input?.file_path;
    if (typeof filePath === 'string') {
      return {
        sessionId,
        filePath,
        operation: 'read',
        timestamp,
        accessSequence,
      };
    }
  }

  // Write tool
  if (WRITE_TOOLS.has(block.name)) {
    const filePath = input?.file_path;
    if (typeof filePath === 'string') {
      return {
        sessionId,
        filePath,
        operation: 'write',
        timestamp,
        accessSequence,
      };
    }
  }

  // Edit tool
  if (EDIT_TOOLS.has(block.name)) {
    const filePath = input?.file_path;
    if (typeof filePath === 'string') {
      return {
        sessionId,
        filePath,
        operation: 'edit',
        timestamp,
        accessSequence,
      };
    }
  }

  // Bash tool - parse command for file operations
  if (block.name === 'Bash') {
    const command = input?.command;
    if (typeof command === 'string') {
      const bashAccess = parseBashFileOperation(command);
      if (bashAccess) {
        return {
          sessionId,
          filePath: bashAccess.filePath,
          operation: bashAccess.operation,
          timestamp,
          accessSequence,
        };
      }
    }
  }

  return null;
}

// =============================================================================
// File Access Aggregation
// =============================================================================

/**
 * Aggregate file access records into per-file summaries.
 *
 * Per Constitution Principle VII: Returns counts as data.
 * Agent interprets whether access patterns indicate issues.
 *
 * @param accesses - File access records from extractFileAccesses
 * @returns Array of file access summaries, sorted by total accesses descending
 *
 * @example
 * ```typescript
 * const summary = aggregateFileAccesses(accesses);
 * // Returns: [{ filePath: '/src/index.ts', operations: { read: 5, write: 0, edit: 2 }, totalAccesses: 7 }]
 * ```
 */
export function aggregateFileAccesses(accesses: FileAccessRecord[]): FileAccessSummary[] {
  if (accesses.length === 0) {
    return [];
  }

  // Group by file path
  const groups = new Map<
    string,
    {
      read: number;
      write: number;
      edit: number;
    }
  >();

  for (const access of accesses) {
    const existing = groups.get(access.filePath);

    if (existing) {
      existing[access.operation]++;
    } else {
      groups.set(access.filePath, {
        read: access.operation === 'read' ? 1 : 0,
        write: access.operation === 'write' ? 1 : 0,
        edit: access.operation === 'edit' ? 1 : 0,
      });
    }
  }

  // Convert to summaries
  const summaries: FileAccessSummary[] = [];

  for (const [filePath, ops] of groups) {
    summaries.push({
      filePath,
      operations: ops,
      totalAccesses: ops.read + ops.write + ops.edit,
    });
  }

  // Sort by total accesses descending
  summaries.sort((a, b) => b.totalAccesses - a.totalAccesses);

  return summaries;
}
