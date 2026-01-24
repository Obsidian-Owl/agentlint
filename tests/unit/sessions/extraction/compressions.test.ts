/**
 * Unit tests for compression event extraction
 *
 * Tests extraction of compression events from session entries.
 * Compression events are indicated by 'summary' type entries.
 *
 * @module tests/unit/sessions/extraction/compressions.test.ts
 */

import { describe, it, expect } from 'bun:test';
import type { SessionEntry } from '../../../../src/tools/sessions/types';
import {
  extractCompressionEvents,
  detectCompressionType,
} from '../../../../src/sessions/extraction/compressions';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a minimal summary entry (compression event).
 */
function createSummaryEntry(
  summary: string,
  timestamp: string,
  lineNumber: number = 1,
  options: {
    leafUuid?: string;
    filePath?: string;
  } = {}
): SessionEntry {
  const entry: SessionEntry = {
    type: 'summary',
    uuid: `summary-${lineNumber}`,
    timestamp,
    lineNumber,
    summary,
  };
  if (options.leafUuid) {
    entry.leafUuid = options.leafUuid;
  }
  if (options.filePath) {
    entry.filePath = options.filePath;
  }
  return entry;
}

/**
 * Create a minimal user entry.
 */
function createUserEntry(content: string, timestamp: string, lineNumber: number = 1): SessionEntry {
  return {
    type: 'user',
    uuid: `user-${lineNumber}`,
    timestamp,
    lineNumber,
    message: {
      role: 'user',
      content: [{ type: 'text', text: content }],
    },
  };
}

/**
 * Create a minimal assistant entry.
 */
function createAssistantEntry(timestamp: string, lineNumber: number = 2): SessionEntry {
  return {
    type: 'assistant',
    uuid: `assistant-${lineNumber}`,
    timestamp,
    lineNumber,
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: 'Response' }],
    },
  };
}

// =============================================================================
// Compression Event Extraction Tests (T019)
// =============================================================================

describe('extractCompressionEvents', () => {
  it('should extract compression events from summary entries', () => {
    const entries: SessionEntry[] = [
      createUserEntry('First message', '2026-01-24T00:00:00Z', 1),
      createAssistantEntry('2026-01-24T00:00:01Z', 2),
      createSummaryEntry('Summary of conversation so far...', '2026-01-24T00:05:00Z', 100, {
        leafUuid: 'assistant-2',
      }),
      createUserEntry('Continue', '2026-01-24T00:05:01Z', 101),
    ];

    const events = extractCompressionEvents(entries, 'session-123');

    expect(events).toHaveLength(1);
    expect(events[0]).toBeDefined();
    expect(events[0]!.sessionId).toBe('session-123');
    expect(events[0]!.timestamp).toBe('2026-01-24T00:05:00Z');
    expect(events[0]!.compressionType).toBe('microcompact'); // Short summary detected as microcompact
    expect(events[0]!.summaryPreserved).toBe('Summary of conversation so far...');
    expect(events[0]!.lineNumber).toBe(100);
  });

  it('should extract multiple compression events in order', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Start', '2026-01-24T00:00:00Z', 1),
      createSummaryEntry('First summary', '2026-01-24T01:00:00Z', 50),
      createUserEntry('Continue', '2026-01-24T01:00:01Z', 51),
      createSummaryEntry('Second summary', '2026-01-24T02:00:00Z', 100),
      createUserEntry('More', '2026-01-24T02:00:01Z', 101),
    ];

    const events = extractCompressionEvents(entries, 'session-123');

    expect(events).toHaveLength(2);
    expect(events[0]!.timestamp).toBe('2026-01-24T01:00:00Z');
    expect(events[0]!.summaryPreserved).toBe('First summary');
    expect(events[1]!.timestamp).toBe('2026-01-24T02:00:00Z');
    expect(events[1]!.summaryPreserved).toBe('Second summary');
  });

  it('should return empty array when no compression events', () => {
    const entries: SessionEntry[] = [
      createUserEntry('Hello', '2026-01-24T00:00:00Z', 1),
      createAssistantEntry('2026-01-24T00:00:01Z', 2),
    ];

    const events = extractCompressionEvents(entries, 'session-123');

    expect(events).toHaveLength(0);
  });

  it('should include file path for causal tracing', () => {
    const entries: SessionEntry[] = [
      createSummaryEntry('Summary text', '2026-01-24T00:00:00Z', 50, {
        filePath: '/path/to/session.jsonl',
      }),
    ];

    const events = extractCompressionEvents(entries, 'session-123');

    expect(events).toHaveLength(1);
    expect(events[0]!.filePath).toBe('/path/to/session.jsonl');
    expect(events[0]!.lineNumber).toBe(50);
  });

  it('should handle empty summary text', () => {
    const entries: SessionEntry[] = [createSummaryEntry('', '2026-01-24T00:00:00Z', 50)];

    const events = extractCompressionEvents(entries, 'session-123');

    expect(events).toHaveLength(1);
    expect(events[0]!.summaryPreserved).toBe('');
  });

  it('should handle summary entries without summary field', () => {
    const entries: SessionEntry[] = [
      {
        type: 'summary',
        uuid: 'summary-1',
        timestamp: '2026-01-24T00:00:00Z',
        lineNumber: 50,
        // No summary field
      },
    ];

    const events = extractCompressionEvents(entries, 'session-123');

    expect(events).toHaveLength(1);
    expect(events[0]!.summaryPreserved).toBeUndefined();
  });
});

// =============================================================================
// Compression Type Detection Tests
// =============================================================================

describe('detectCompressionType', () => {
  it('should detect compact compression from summary length', () => {
    // Compact compression typically preserves more context
    const longSummary = 'A'.repeat(5000);
    expect(detectCompressionType(longSummary)).toBe('compact');
  });

  it('should detect microcompact from short summary', () => {
    // Microcompact is more aggressive, shorter summaries
    const shortSummary = 'Brief summary.';
    expect(detectCompressionType(shortSummary)).toBe('microcompact');
  });

  it('should default to compact for undefined summary', () => {
    expect(detectCompressionType(undefined)).toBe('compact');
  });

  it('should default to compact for empty summary', () => {
    expect(detectCompressionType('')).toBe('compact');
  });

  it('should detect microcompact at threshold boundary', () => {
    // Microcompact threshold is around 1000 characters
    const atThreshold = 'A'.repeat(999);
    expect(detectCompressionType(atThreshold)).toBe('microcompact');

    const aboveThreshold = 'A'.repeat(1001);
    expect(detectCompressionType(aboveThreshold)).toBe('compact');
  });
});
