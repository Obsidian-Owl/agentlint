/**
 * EP15 Session Intelligence - Compression Event Extraction
 *
 * Extract compression events from session entries.
 * Compression events are indicated by 'summary' type entries in Claude Code logs.
 *
 * Per Constitution Principle VII: Functions return data, agent provides judgment.
 *
 * @module sessions/extraction/compressions
 */

import type { SessionEntry } from '../../tools/sessions/types';
import type { CompressionEventRecord, CompressionType } from '../types';

/**
 * Threshold for distinguishing compact vs microcompact compression.
 * Microcompact is more aggressive and produces shorter summaries.
 */
const MICROCOMPACT_THRESHOLD = 1000;

/**
 * Extract compression events from session entries.
 *
 * Compression events are entries with type 'summary' that indicate
 * context compaction occurred. These preserve a summary of the
 * conversation up to that point.
 *
 * @param entries - Session entries to scan
 * @param sessionId - Parent session UUID
 * @returns Array of compression event records
 */
export function extractCompressionEvents(
  entries: SessionEntry[],
  sessionId: string
): CompressionEventRecord[] {
  const events: CompressionEventRecord[] = [];

  for (const entry of entries) {
    if (entry.type === 'summary') {
      const record: CompressionEventRecord = {
        sessionId,
        timestamp: entry.timestamp,
        compressionType: detectCompressionType(entry.summary),
      };

      // Add optional fields only if they have values (exactOptionalPropertyTypes)
      if (entry.lineNumber !== undefined) {
        record.lineNumber = entry.lineNumber;
      }

      if (entry.summary !== undefined) {
        record.summaryPreserved = entry.summary;
      }

      if (entry.filePath) {
        record.filePath = entry.filePath;
      }

      events.push(record);
    }
  }

  return events;
}

/**
 * Detect compression type based on summary characteristics.
 *
 * Claude Code uses two compression types:
 * - 'compact': Standard compression, preserves more context
 * - 'microcompact': Aggressive compression, shorter summaries
 *
 * Since the log format doesn't explicitly indicate the type,
 * we infer it from the summary length.
 *
 * @param summary - The preserved summary text
 * @returns Inferred compression type
 */
export function detectCompressionType(summary: string | undefined): CompressionType {
  if (!summary || summary.length === 0) {
    // Default to compact for empty/missing summaries
    return 'compact';
  }

  // Microcompact produces shorter summaries
  if (summary.length < MICROCOMPACT_THRESHOLD) {
    return 'microcompact';
  }

  return 'compact';
}
