/**
 * T027-T029: Unit tests for session metrics extraction
 *
 * Tests token usage, tool distribution, and compression event counting.
 *
 * @module tests/unit/tools/sessions/metrics.test.ts
 */

import { describe, it, expect } from 'bun:test';
import * as path from 'node:path';
import {
  extractMetrics,
  extractMetricsFromFile,
  calculateToolDistribution,
  aggregateTokenUsage,
} from '../../../../src/tools/sessions/metrics';
import type { SessionEntry } from '../../../../src/tools/sessions/types';

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/sessions');
const VALID_FILE = path.join(FIXTURES_DIR, 'sample-valid.jsonl');
const WITH_SUMMARY_FILE = path.join(FIXTURES_DIR, 'sample-with-summary.jsonl');
const WITH_TOOLS_FILE = path.join(FIXTURES_DIR, 'sample-with-tools.jsonl');

describe('Token Metrics Extraction', () => {
  describe('aggregateTokenUsage', () => {
    it('should sum token usage from multiple entries', () => {
      const entries: SessionEntry[] = [
        {
          type: 'assistant',
          uuid: 'msg-001',
          timestamp: '2026-01-15T10:00:00.000Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello' }],
            usage: { input_tokens: 10, output_tokens: 5 },
          },
        },
        {
          type: 'assistant',
          uuid: 'msg-002',
          timestamp: '2026-01-15T10:01:00.000Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'World' }],
            usage: { input_tokens: 20, output_tokens: 15 },
          },
        },
      ];

      const result = aggregateTokenUsage(entries);

      expect(result.inputTokens).toBe(30);
      expect(result.outputTokens).toBe(20);
    });

    it('should handle entries without usage data', () => {
      const entries: SessionEntry[] = [
        {
          type: 'user',
          uuid: 'msg-001',
          timestamp: '2026-01-15T10:00:00.000Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        },
        {
          type: 'assistant',
          uuid: 'msg-002',
          timestamp: '2026-01-15T10:01:00.000Z',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hi' }],
            usage: { input_tokens: 10, output_tokens: 5 },
          },
        },
      ];

      const result = aggregateTokenUsage(entries);

      expect(result.inputTokens).toBe(10);
      expect(result.outputTokens).toBe(5);
    });

    it('should include cache tokens when present', () => {
      const entries: SessionEntry[] = [
        {
          type: 'assistant',
          uuid: 'msg-001',
          timestamp: '2026-01-15T10:00:00.000Z',
          message: {
            role: 'assistant',
            content: [],
            usage: {
              input_tokens: 100,
              output_tokens: 50,
              cache_read_input_tokens: 80,
              cache_creation_input_tokens: 20,
            },
          },
        },
      ];

      const result = aggregateTokenUsage(entries);

      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(50);
      expect(result.cacheReadTokens).toBe(80);
      expect(result.cacheCreationTokens).toBe(20);
    });

    it('should return zero for empty entries', () => {
      const result = aggregateTokenUsage([]);

      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
      expect(result.cacheReadTokens).toBe(0);
      expect(result.cacheCreationTokens).toBe(0);
    });
  });

  describe('extractMetricsFromFile', () => {
    it('should extract token totals from a valid session file', async () => {
      const metrics = await extractMetricsFromFile(VALID_FILE, '/test/project');

      // From sample-valid.jsonl: 15+25+50=90 input, 20+30+25=75 output
      expect(metrics.inputTokens).toBe(90);
      expect(metrics.outputTokens).toBe(75);
    });
  });
});

describe('Tool Distribution Categorization', () => {
  describe('calculateToolDistribution', () => {
    it('should categorize tool usage from entries', () => {
      const entries: SessionEntry[] = [
        {
          type: 'assistant',
          uuid: 'msg-001',
          timestamp: '2026-01-15T10:00:00.000Z',
          message: {
            role: 'assistant',
            content: [{ type: 'tool_use', id: 't1', name: 'Read', input: {} }],
          },
        },
        {
          type: 'assistant',
          uuid: 'msg-002',
          timestamp: '2026-01-15T10:01:00.000Z',
          message: {
            role: 'assistant',
            content: [{ type: 'tool_use', id: 't2', name: 'Bash', input: {} }],
          },
        },
        {
          type: 'assistant',
          uuid: 'msg-003',
          timestamp: '2026-01-15T10:02:00.000Z',
          message: {
            role: 'assistant',
            content: [{ type: 'tool_use', id: 't3', name: 'Write', input: {} }],
          },
        },
      ];

      const distribution = calculateToolDistribution(entries);

      expect(distribution.read).toBe(1);
      expect(distribution.bash).toBe(1);
      expect(distribution.write).toBe(1);
      expect(distribution.total).toBe(3);
    });

    it('should count multiple tools in single message', () => {
      const entries: SessionEntry[] = [
        {
          type: 'assistant',
          uuid: 'msg-001',
          timestamp: '2026-01-15T10:00:00.000Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 't1', name: 'Read', input: {} },
              { type: 'tool_use', id: 't2', name: 'Glob', input: {} },
              { type: 'tool_use', id: 't3', name: 'Grep', input: {} },
            ],
          },
        },
      ];

      const distribution = calculateToolDistribution(entries);

      // Read and Glob are categorized as 'read', Grep is 'search' (checked before read)
      expect(distribution.read).toBe(2); // Read + Glob
      expect(distribution.search).toBe(1); // Grep (search checked before read)
      expect(distribution.total).toBe(3);
    });

    it('should categorize unknown tools as other', () => {
      const entries: SessionEntry[] = [
        {
          type: 'assistant',
          uuid: 'msg-001',
          timestamp: '2026-01-15T10:00:00.000Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 't1', name: 'CustomTool', input: {} },
              { type: 'tool_use', id: 't2', name: 'UnknownTool', input: {} },
            ],
          },
        },
      ];

      const distribution = calculateToolDistribution(entries);

      expect(distribution.other).toBe(2);
      expect(distribution.total).toBe(2);
    });

    it('should return zeros for entries without tools', () => {
      const entries: SessionEntry[] = [
        {
          type: 'user',
          uuid: 'msg-001',
          timestamp: '2026-01-15T10:00:00.000Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        },
      ];

      const distribution = calculateToolDistribution(entries);

      expect(distribution.read).toBe(0);
      expect(distribution.write).toBe(0);
      expect(distribution.bash).toBe(0);
      expect(distribution.search).toBe(0);
      expect(distribution.other).toBe(0);
      expect(distribution.total).toBe(0);
    });

    it('should extract tool distribution from session file', async () => {
      const metrics = await extractMetricsFromFile(WITH_TOOLS_FILE, '/test/project');

      // From sample-with-tools.jsonl: Glob(read), Bash, Write, WebSearch(search)
      expect(metrics.toolDistribution.read).toBe(1); // Glob
      expect(metrics.toolDistribution.bash).toBe(1);
      expect(metrics.toolDistribution.write).toBe(1);
      expect(metrics.toolDistribution.search).toBe(1); // WebSearch
      expect(metrics.toolDistribution.total).toBe(4);
    });
  });
});

describe('Compression Event Counting', () => {
  describe('extractMetrics', () => {
    it('should count summary entries as compressions', () => {
      const entries: SessionEntry[] = [
        {
          type: 'user',
          uuid: 'msg-001',
          timestamp: '2026-01-15T10:00:00.000Z',
          message: { role: 'user' },
        },
        {
          type: 'summary',
          uuid: 'msg-002',
          timestamp: '2026-01-15T10:30:00.000Z',
          summary: 'First summary',
        },
        {
          type: 'user',
          uuid: 'msg-003',
          timestamp: '2026-01-15T10:31:00.000Z',
          message: { role: 'user' },
        },
        {
          type: 'summary',
          uuid: 'msg-004',
          timestamp: '2026-01-15T11:00:00.000Z',
          summary: 'Second summary',
        },
      ];

      const metrics = extractMetrics(entries, 'test-session', '/test/project');

      expect(metrics.compressionCount).toBe(2);
    });

    it('should return zero compressions when no summaries', () => {
      const entries: SessionEntry[] = [
        {
          type: 'user',
          uuid: 'msg-001',
          timestamp: '2026-01-15T10:00:00.000Z',
          message: { role: 'user' },
        },
        {
          type: 'assistant',
          uuid: 'msg-002',
          timestamp: '2026-01-15T10:01:00.000Z',
          message: { role: 'assistant' },
        },
      ];

      const metrics = extractMetrics(entries, 'test-session', '/test/project');

      expect(metrics.compressionCount).toBe(0);
    });

    it('should extract compression count from session file', async () => {
      const metrics = await extractMetricsFromFile(WITH_SUMMARY_FILE, '/test/project');

      expect(metrics.compressionCount).toBe(1);
    });
  });

  describe('extractMetrics complete', () => {
    it('should extract all metrics from entries', () => {
      const entries: SessionEntry[] = [
        {
          type: 'user',
          uuid: 'msg-001',
          timestamp: '2026-01-15T10:00:00.000Z',
          message: { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        },
        {
          type: 'assistant',
          uuid: 'msg-002',
          timestamp: '2026-01-15T10:00:05.000Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Hi!' },
              { type: 'tool_use', id: 't1', name: 'Read', input: {} },
            ],
            usage: { input_tokens: 50, output_tokens: 30 },
          },
        },
      ];

      const metrics = extractMetrics(entries, 'test-session', '/test/project');

      expect(metrics.sessionId).toBe('test-session');
      expect(metrics.projectPath).toBe('/test/project');
      expect(metrics.inputTokens).toBe(50);
      expect(metrics.outputTokens).toBe(30);
      expect(metrics.turnCount).toBe(2);
      expect(metrics.toolDistribution.read).toBe(1);
      expect(metrics.toolDistribution.total).toBe(1);
      expect(metrics.compressionCount).toBe(0);
      expect(metrics.firstTimestamp).toBe('2026-01-15T10:00:00.000Z');
      expect(metrics.lastTimestamp).toBe('2026-01-15T10:00:05.000Z');
    });

    it('should handle empty entries', () => {
      const metrics = extractMetrics([], 'test-session', '/test/project');

      expect(metrics.sessionId).toBe('test-session');
      expect(metrics.inputTokens).toBe(0);
      expect(metrics.outputTokens).toBe(0);
      expect(metrics.turnCount).toBe(0);
      expect(metrics.toolDistribution.total).toBe(0);
    });
  });
});
