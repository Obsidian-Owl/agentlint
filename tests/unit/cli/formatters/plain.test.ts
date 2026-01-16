/**
 * Unit tests for plain.ts formatter
 *
 * Tests FR-013: Plain text output without colors or formatting
 */

import { describe, test, expect } from 'bun:test';
import {
  formatStreamChunk,
  formatFindings,
  formatComplete,
  PlainFormatter,
  createPlainFormatter,
  type Finding,
  type ProgressChunk,
  type FindingChunk,
  type ErrorChunk,
  type CompleteChunk,
  type AnalysisResult,
} from '../../../../src/cli/formatters/plain';

// Helper to create test findings
function createFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'FND-001',
    severity: 'high',
    title: 'Test Finding',
    description: 'A test finding description',
    ...overrides,
  };
}

// Helper to create test analysis results
function createAnalysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    status: 'success',
    findings: [],
    summary: {
      total: 0,
      bySeverity: {},
    },
    timestamp: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('formatStreamChunk', () => {
  describe('progress chunks', () => {
    test('formats progress chunk with phase and message', () => {
      const chunk: ProgressChunk = {
        type: 'progress',
        phase: 'scanning',
        message: 'Discovering config files',
        timestamp: '2024-01-01T00:00:00Z',
      };
      const result = formatStreamChunk(chunk);
      expect(result).toBe('[scanning] Discovering config files');
    });

    test('formats progress chunk with percent', () => {
      const chunk: ProgressChunk = {
        type: 'progress',
        phase: 'analysis',
        message: 'Processing',
        timestamp: '2024-01-01T00:00:00Z',
        percent: 50,
      };
      const result = formatStreamChunk(chunk);
      expect(result).toBe('[analysis] Processing');
    });
  });

  describe('finding chunks', () => {
    test('formats finding chunk with severity and title', () => {
      const chunk: FindingChunk = {
        type: 'finding',
        finding: createFinding({ id: 'FND-002', severity: 'critical', title: 'Security Issue' }),
        timestamp: '2024-01-01T00:00:00Z',
      };
      const result = formatStreamChunk(chunk);
      expect(result).toBe('[CRITICAL] FND-002: Security Issue');
    });

    test('formats finding chunk with lowercase severity converted to uppercase', () => {
      const chunk: FindingChunk = {
        type: 'finding',
        finding: createFinding({ severity: 'low' }),
        timestamp: '2024-01-01T00:00:00Z',
      };
      const result = formatStreamChunk(chunk);
      expect(result).toContain('[LOW]');
    });
  });

  describe('error chunks', () => {
    test('formats error chunk with error message', () => {
      const chunk: ErrorChunk = {
        type: 'error',
        error: 'Connection failed',
        timestamp: '2024-01-01T00:00:00Z',
      };
      const result = formatStreamChunk(chunk);
      expect(result).toBe('ERROR: Connection failed');
    });
  });

  describe('complete chunks', () => {
    test('formats complete chunk with total count', () => {
      const chunk: CompleteChunk = {
        type: 'complete',
        summary: {
          total: 5,
          bySeverity: { high: 2, medium: 3 },
        },
        timestamp: '2024-01-01T00:00:00Z',
      };
      const result = formatStreamChunk(chunk);
      expect(result).toBe('Complete: 5 finding(s)');
    });

    test('formats complete chunk with zero findings', () => {
      const chunk: CompleteChunk = {
        type: 'complete',
        summary: {
          total: 0,
          bySeverity: {},
        },
        timestamp: '2024-01-01T00:00:00Z',
      };
      const result = formatStreamChunk(chunk);
      expect(result).toBe('Complete: 0 finding(s)');
    });
  });
});

describe('formatFindings', () => {
  test('returns "No findings." for empty array', () => {
    const result = formatFindings([]);
    expect(result).toBe('No findings.');
  });

  test('formats single finding with all fields', () => {
    const findings = [
      createFinding({
        id: 'FND-001',
        severity: 'high',
        title: 'Missing Config',
        description: 'The config file is missing',
        location: { file: 'CLAUDE.md', line: 10 },
        recommendation: 'Add the missing config section',
      }),
    ];
    const result = formatFindings(findings);
    expect(result).toContain('[HIGH] FND-001: Missing Config');
    expect(result).toContain('(CLAUDE.md:10)');
    expect(result).toContain('The config file is missing');
    expect(result).toContain('Recommendation: Add the missing config section');
  });

  test('formats finding without location', () => {
    const findings = [createFinding({ id: 'FND-002', title: 'No Location' })];
    const result = formatFindings(findings);
    expect(result).toContain('[HIGH] FND-002: No Location');
    expect(result).not.toContain('(');
  });

  test('formats finding with file but no line', () => {
    const findings = [
      createFinding({
        id: 'FND-003',
        location: { file: 'config.json' },
      }),
    ];
    const result = formatFindings(findings);
    expect(result).toContain('(config.json)');
    expect(result).not.toContain(':)');
  });

  test('formats finding without recommendation', () => {
    // createFinding() doesn't include recommendation by default
    const findings = [createFinding({})];
    const result = formatFindings(findings);
    expect(result).not.toContain('Recommendation:');
  });

  test('formats multiple findings', () => {
    const findings = [
      createFinding({ id: 'FND-001', severity: 'critical' }),
      createFinding({ id: 'FND-002', severity: 'medium' }),
      createFinding({ id: 'FND-003', severity: 'low' }),
    ];
    const result = formatFindings(findings);
    expect(result).toContain('[CRITICAL] FND-001');
    expect(result).toContain('[MEDIUM] FND-002');
    expect(result).toContain('[LOW] FND-003');
  });
});

describe('formatComplete', () => {
  test('formats success result with no findings', () => {
    const result = formatComplete(createAnalysisResult());
    expect(result).toContain('Analysis Report');
    expect(result).toContain('===============');
    expect(result).toContain('Total Findings: 0');
    expect(result).toContain('No issues found.');
  });

  test('formats success result with findings', () => {
    const analysisResult = createAnalysisResult({
      findings: [
        createFinding({ id: 'FND-001', severity: 'high' }),
        createFinding({ id: 'FND-002', severity: 'medium' }),
      ],
      summary: {
        total: 2,
        bySeverity: { high: 1, medium: 1 },
      },
    });
    const result = formatComplete(analysisResult);
    expect(result).toContain('Total Findings: 2');
    expect(result).toContain('By Severity:');
    expect(result).toContain('high: 1');
    expect(result).toContain('medium: 1');
    expect(result).toContain('Findings');
    expect(result).toContain('--------');
  });

  test('formats error result', () => {
    const analysisResult = createAnalysisResult({
      status: 'error',
      error: 'Analysis failed due to network error',
    });
    const result = formatComplete(analysisResult);
    expect(result).toContain('Status: ERROR');
    expect(result).toContain('Error: Analysis failed due to network error');
    expect(result).not.toContain('Total Findings:');
  });

  test('formats error result without error message', () => {
    const analysisResult = createAnalysisResult({
      status: 'error',
    });
    const result = formatComplete(analysisResult);
    expect(result).toContain('Error: An unknown error occurred');
  });

  test('includes duration when present', () => {
    const analysisResult = createAnalysisResult({
      duration: 5500,
    });
    const result = formatComplete(analysisResult);
    expect(result).toContain('Duration: 5.50s');
  });

  test('omits duration when not present', () => {
    const analysisResult = createAnalysisResult();
    const result = formatComplete(analysisResult);
    expect(result).not.toContain('Duration:');
  });

  test('includes timestamp', () => {
    const analysisResult = createAnalysisResult({
      timestamp: '2024-01-15T10:30:00Z',
    });
    const result = formatComplete(analysisResult);
    expect(result).toContain('Timestamp: 2024-01-15T10:30:00Z');
  });

  test('skips zero-count severities', () => {
    const analysisResult = createAnalysisResult({
      findings: [createFinding({ severity: 'high' })],
      summary: {
        total: 1,
        bySeverity: { high: 1, medium: 0, low: 0 },
      },
    });
    const result = formatComplete(analysisResult);
    expect(result).toContain('high: 1');
    expect(result).not.toContain('medium: 0');
    expect(result).not.toContain('low: 0');
  });
});

describe('PlainFormatter class', () => {
  let formatter: PlainFormatter;

  test('createPlainFormatter returns PlainFormatter instance', () => {
    formatter = createPlainFormatter();
    expect(formatter).toBeInstanceOf(PlainFormatter);
  });

  describe('formatChunk', () => {
    test('delegates to formatStreamChunk', () => {
      formatter = new PlainFormatter();
      const chunk: ProgressChunk = {
        type: 'progress',
        phase: 'test',
        message: 'Testing',
        timestamp: '2024-01-01T00:00:00Z',
      };
      expect(formatter.formatChunk(chunk)).toBe(formatStreamChunk(chunk));
    });
  });

  describe('formatComplete', () => {
    test('delegates to formatComplete function', () => {
      formatter = new PlainFormatter();
      const result = createAnalysisResult();
      expect(formatter.formatComplete(result)).toBe(formatComplete(result));
    });
  });

  describe('writeChunk', () => {
    test('writes chunk to console', () => {
      formatter = new PlainFormatter();
      const chunk: ProgressChunk = {
        type: 'progress',
        phase: 'write',
        message: 'Test',
        timestamp: '2024-01-01T00:00:00Z',
      };
      // Just verify it doesn't throw
      expect(() => formatter.writeChunk(chunk)).not.toThrow();
    });
  });

  describe('writeComplete', () => {
    test('writes complete result to console', () => {
      formatter = new PlainFormatter();
      const result = createAnalysisResult();
      // Just verify it doesn't throw
      expect(() => formatter.writeComplete(result)).not.toThrow();
    });
  });
});
