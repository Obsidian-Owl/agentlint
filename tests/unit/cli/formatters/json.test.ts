/**
 * T028: Unit tests for JSON formatter
 *
 * Tests US-003: Export Results to JSON
 */

import { describe, test, expect } from 'bun:test';
import {
  JSONFormatter,
  formatStreamChunk,
  formatComplete,
  type StreamChunk,
  type AnalysisResult,
} from '../../../../src/cli/formatters/json';

describe('JSON formatter', () => {
  describe('JSONFormatter class', () => {
    test('can be instantiated', () => {
      const formatter = new JSONFormatter();
      expect(formatter).toBeDefined();
    });

    test('has formatChunk method', () => {
      const formatter = new JSONFormatter();
      expect(typeof formatter.formatChunk).toBe('function');
    });

    test('has formatComplete method', () => {
      const formatter = new JSONFormatter();
      expect(typeof formatter.formatComplete).toBe('function');
    });
  });

  describe('formatStreamChunk', () => {
    test('outputs valid JSON line for progress chunk', () => {
      const chunk: StreamChunk = {
        type: 'progress',
        phase: 'scanning',
        message: 'Scanning for config files',
        timestamp: '2026-01-16T10:00:00.000Z',
      };

      const result = formatStreamChunk(chunk);
      const parsed = JSON.parse(result);

      expect(parsed.type).toBe('progress');
      expect(parsed.phase).toBe('scanning');
      expect(parsed.message).toBe('Scanning for config files');
    });

    test('outputs valid JSON line for finding chunk', () => {
      const chunk: StreamChunk = {
        type: 'finding',
        finding: {
          id: 'FND-001',
          severity: 'high',
          title: 'Missing instructions',
          description: 'CLAUDE.md lacks project context',
        },
        timestamp: '2026-01-16T10:00:00.000Z',
      };

      const result = formatStreamChunk(chunk);
      const parsed = JSON.parse(result);

      expect(parsed.type).toBe('finding');
      expect(parsed.finding.id).toBe('FND-001');
      expect(parsed.finding.severity).toBe('high');
    });

    test('outputs valid JSON line for error chunk', () => {
      const chunk: StreamChunk = {
        type: 'error',
        error: 'File not found: missing.md',
        timestamp: '2026-01-16T10:00:00.000Z',
      };

      const result = formatStreamChunk(chunk);
      const parsed = JSON.parse(result);

      expect(parsed.type).toBe('error');
      expect(parsed.error).toBe('File not found: missing.md');
    });

    test('includes timestamp in output', () => {
      const timestamp = '2026-01-16T10:00:00.000Z';
      const chunk: StreamChunk = {
        type: 'progress',
        phase: 'scanning',
        message: 'Test',
        timestamp,
      };

      const result = formatStreamChunk(chunk);
      const parsed = JSON.parse(result);

      expect(parsed.timestamp).toBe(timestamp);
    });

    test('output ends without newline (caller adds newline)', () => {
      const chunk: StreamChunk = {
        type: 'progress',
        phase: 'scanning',
        message: 'Test',
        timestamp: '2026-01-16T10:00:00.000Z',
      };

      const result = formatStreamChunk(chunk);
      expect(result.endsWith('\n')).toBe(false);
    });
  });

  describe('formatComplete', () => {
    test('outputs valid JSON object', () => {
      const result: AnalysisResult = {
        status: 'success',
        findings: [],
        summary: {
          total: 0,
          bySeverity: {},
        },
        timestamp: '2026-01-16T10:00:00.000Z',
      };

      const output = formatComplete(result);
      const parsed = JSON.parse(output);

      expect(parsed.status).toBe('success');
      expect(parsed.findings).toEqual([]);
    });

    test('includes findings array', () => {
      const result: AnalysisResult = {
        status: 'success',
        findings: [
          {
            id: 'FND-001',
            severity: 'high',
            title: 'Test finding',
            description: 'Description',
          },
        ],
        summary: {
          total: 1,
          bySeverity: { high: 1 },
        },
        timestamp: '2026-01-16T10:00:00.000Z',
      };

      const output = formatComplete(result);
      const parsed = JSON.parse(output);

      expect(parsed.findings.length).toBe(1);
      expect(parsed.findings[0].id).toBe('FND-001');
    });

    test('includes summary with totals', () => {
      const result: AnalysisResult = {
        status: 'success',
        findings: [
          { id: 'FND-001', severity: 'high', title: 'A', description: 'A' },
          { id: 'FND-002', severity: 'medium', title: 'B', description: 'B' },
          { id: 'FND-003', severity: 'high', title: 'C', description: 'C' },
        ],
        summary: {
          total: 3,
          bySeverity: { high: 2, medium: 1 },
        },
        timestamp: '2026-01-16T10:00:00.000Z',
      };

      const output = formatComplete(result);
      const parsed = JSON.parse(output);

      expect(parsed.summary.total).toBe(3);
      expect(parsed.summary.bySeverity.high).toBe(2);
      expect(parsed.summary.bySeverity.medium).toBe(1);
    });

    test('pretty-prints with indentation by default', () => {
      const result: AnalysisResult = {
        status: 'success',
        findings: [],
        summary: { total: 0, bySeverity: {} },
        timestamp: '2026-01-16T10:00:00.000Z',
      };

      const output = formatComplete(result);
      expect(output).toContain('\n');
      expect(output).toContain('  '); // Indentation
    });

    test('can output compact JSON', () => {
      const result: AnalysisResult = {
        status: 'success',
        findings: [],
        summary: { total: 0, bySeverity: {} },
        timestamp: '2026-01-16T10:00:00.000Z',
      };

      const output = formatComplete(result, { compact: true });
      expect(output).not.toContain('\n');
    });

    test('handles error status', () => {
      const result: AnalysisResult = {
        status: 'error',
        error: 'Analysis failed: no config files found',
        findings: [],
        summary: { total: 0, bySeverity: {} },
        timestamp: '2026-01-16T10:00:00.000Z',
      };

      const output = formatComplete(result);
      const parsed = JSON.parse(output);

      expect(parsed.status).toBe('error');
      expect(parsed.error).toBe('Analysis failed: no config files found');
    });
  });

  describe('JSONFormatter instance methods', () => {
    test('formatChunk delegates to formatStreamChunk', () => {
      const formatter = new JSONFormatter();
      const chunk: StreamChunk = {
        type: 'progress',
        phase: 'scanning',
        message: 'Test',
        timestamp: '2026-01-16T10:00:00.000Z',
      };

      const result = formatter.formatChunk(chunk);
      const standalone = formatStreamChunk(chunk);

      expect(result).toBe(standalone);
    });

    test('formatComplete delegates to standalone function', () => {
      const formatter = new JSONFormatter();
      const result: AnalysisResult = {
        status: 'success',
        findings: [],
        summary: { total: 0, bySeverity: {} },
        timestamp: '2026-01-16T10:00:00.000Z',
      };

      const output = formatter.formatComplete(result);
      const standalone = formatComplete(result);

      expect(output).toBe(standalone);
    });
  });
});
