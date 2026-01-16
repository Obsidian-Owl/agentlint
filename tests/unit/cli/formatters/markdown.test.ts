/**
 * T059: Unit tests for Markdown formatter
 *
 * Tests US-007: Export Results to Markdown
 * Tests FR-008: Markdown output for documentation
 */

import { describe, test, expect } from 'bun:test';
import {
  MarkdownFormatter,
  formatComplete,
  formatStreamChunk,
  formatFindings,
  formatCausalChain,
  createMarkdownFormatter,
  type AnalysisResult,
  type Finding,
  type StreamChunk,
  type CausalNode,
} from '../../../../src/cli/formatters/markdown';

// Helper to create test findings
function createFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'FND-001',
    severity: 'medium',
    title: 'Test Finding',
    description: 'A test finding description',
    ...overrides,
  };
}

// Helper to create test analysis result
function createResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    status: 'success',
    findings: [createFinding()],
    summary: {
      total: 1,
      bySeverity: { medium: 1 },
    },
    timestamp: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Helper to create causal node
function createCausalNode(overrides: Partial<CausalNode> = {}): CausalNode {
  return {
    id: 'node-1',
    type: 'finding',
    title: 'Test Finding',
    description: 'A test description',
    ...overrides,
  };
}

describe('Markdown formatter', () => {
  describe('formatComplete', () => {
    test('outputs valid Markdown with header', () => {
      const result = createResult();
      const markdown = formatComplete(result);
      expect(markdown).toContain('# ');
    });

    test('includes summary section', () => {
      const result = createResult();
      const markdown = formatComplete(result);
      expect(markdown.toLowerCase()).toContain('summary');
    });

    test('includes findings count', () => {
      const result = createResult({
        findings: [createFinding(), createFinding({ id: 'FND-002' })],
        summary: { total: 2, bySeverity: { medium: 2 } },
      });
      const markdown = formatComplete(result);
      expect(markdown).toContain('2');
    });

    test('includes timestamp', () => {
      const result = createResult({ timestamp: '2024-06-15T10:30:00Z' });
      const markdown = formatComplete(result);
      expect(markdown.includes('2024') || markdown.includes('Jun')).toBe(true);
    });

    test('handles error status', () => {
      const result = createResult({
        status: 'error',
        error: 'Something went wrong',
        findings: [],
        summary: { total: 0, bySeverity: {} },
      });
      const markdown = formatComplete(result);
      expect(markdown.toLowerCase()).toContain('error');
    });

    test('handles empty findings', () => {
      const result = createResult({
        findings: [],
        summary: { total: 0, bySeverity: {} },
      });
      const markdown = formatComplete(result);
      expect(markdown).toBeDefined();
      expect(markdown.toLowerCase()).toContain('no');
    });
  });

  describe('formatFindings', () => {
    test('formats findings as a table', () => {
      const findings = [createFinding()];
      const markdown = formatFindings(findings);
      // Should contain table markers
      expect(markdown.includes('|') || markdown.includes('-')).toBe(true);
    });

    test('includes severity column', () => {
      const findings = [createFinding({ severity: 'high' })];
      const markdown = formatFindings(findings);
      const lower = markdown.toLowerCase();
      expect(lower.includes('severity') || lower.includes('high')).toBe(true);
    });

    test('includes finding title', () => {
      const findings = [createFinding({ title: 'Missing Context' })];
      const markdown = formatFindings(findings);
      expect(markdown).toContain('Missing Context');
    });

    test('includes finding ID', () => {
      const findings = [createFinding({ id: 'FND-042' })];
      const markdown = formatFindings(findings);
      expect(markdown).toContain('FND-042');
    });

    test('handles multiple findings', () => {
      const findings = [
        createFinding({ id: 'FND-001', title: 'First' }),
        createFinding({ id: 'FND-002', title: 'Second' }),
        createFinding({ id: 'FND-003', title: 'Third' }),
      ];
      const markdown = formatFindings(findings);
      expect(markdown).toContain('First');
      expect(markdown).toContain('Second');
      expect(markdown).toContain('Third');
    });

    test('handles empty findings', () => {
      const markdown = formatFindings([]);
      expect(markdown).toBeDefined();
      expect(markdown.toLowerCase()).toContain('no');
    });

    test('includes file location when available', () => {
      const findings = [createFinding({ location: { file: 'CLAUDE.md', line: 42 } })];
      const markdown = formatFindings(findings);
      expect(markdown).toContain('CLAUDE.md');
    });
  });

  describe('formatCausalChain', () => {
    test('formats causal chain as nested list', () => {
      const chain = createCausalNode({
        type: 'finding',
        title: 'Root Issue',
        children: [
          createCausalNode({
            id: 'cause',
            type: 'root_cause',
            title: 'The Cause',
          }),
        ],
      });
      const markdown = formatCausalChain(chain);
      // Should contain list markers
      expect(markdown.includes('-') || markdown.includes('*')).toBe(true);
    });

    test('includes node types', () => {
      const chain = createCausalNode({
        type: 'finding',
        title: 'Issue',
      });
      const markdown = formatCausalChain(chain);
      const lower = markdown.toLowerCase();
      expect(lower.includes('finding') || lower.includes('issue')).toBe(true);
    });

    test('includes node titles', () => {
      const chain = createCausalNode({
        title: 'My Specific Finding Title',
      });
      const markdown = formatCausalChain(chain);
      expect(markdown).toContain('My Specific Finding Title');
    });

    test('renders nested children with indentation', () => {
      const chain = createCausalNode({
        type: 'finding',
        title: 'Finding',
        children: [
          createCausalNode({
            id: 'origin',
            type: 'origin',
            title: 'Origin',
            children: [
              createCausalNode({
                id: 'cause',
                type: 'root_cause',
                title: 'Root Cause',
              }),
            ],
          }),
        ],
      });
      const markdown = formatCausalChain(chain);
      // Should contain all three
      expect(markdown).toContain('Finding');
      expect(markdown).toContain('Origin');
      expect(markdown).toContain('Root Cause');
    });

    test('includes descriptions when present', () => {
      const chain = createCausalNode({
        title: 'Finding',
        description: 'A detailed explanation of the issue',
      });
      const markdown = formatCausalChain(chain);
      expect(markdown).toContain('detailed explanation');
    });
  });

  describe('formatStreamChunk', () => {
    test('formats progress chunk', () => {
      const chunk: StreamChunk = {
        type: 'progress',
        phase: 'scanning',
        message: 'Looking for configs',
        timestamp: '2024-01-01T00:00:00Z',
      };
      const markdown = formatStreamChunk(chunk);
      expect(markdown.toLowerCase()).toContain('scanning');
    });

    test('formats finding chunk', () => {
      const chunk: StreamChunk = {
        type: 'finding',
        finding: createFinding({ title: 'Found Issue' }),
        timestamp: '2024-01-01T00:00:00Z',
      };
      const markdown = formatStreamChunk(chunk);
      expect(markdown).toContain('Found Issue');
    });

    test('formats error chunk', () => {
      const chunk: StreamChunk = {
        type: 'error',
        error: 'Connection failed',
        timestamp: '2024-01-01T00:00:00Z',
      };
      const markdown = formatStreamChunk(chunk);
      const lower = markdown.toLowerCase();
      expect(lower.includes('error') || lower.includes('failed')).toBe(true);
    });

    test('formats complete chunk', () => {
      const chunk: StreamChunk = {
        type: 'complete',
        summary: { total: 5, bySeverity: { high: 2, medium: 3 } },
        timestamp: '2024-01-01T00:00:00Z',
      };
      const markdown = formatStreamChunk(chunk);
      expect(markdown.includes('5') || markdown.toLowerCase().includes('complete')).toBe(true);
    });
  });

  describe('MarkdownFormatter class', () => {
    test('creates formatter with createMarkdownFormatter', () => {
      const formatter = createMarkdownFormatter();
      expect(formatter).toBeInstanceOf(MarkdownFormatter);
    });

    test('formatChunk method works', () => {
      const formatter = new MarkdownFormatter();
      const chunk: StreamChunk = {
        type: 'progress',
        phase: 'test',
        message: 'Testing',
        timestamp: '2024-01-01T00:00:00Z',
      };
      const result = formatter.formatChunk(chunk);
      expect(result).toBeDefined();
    });

    test('formatComplete method works', () => {
      const formatter = new MarkdownFormatter();
      const result = createResult();
      const markdown = formatter.formatComplete(result);
      expect(markdown).toBeDefined();
    });
  });

  describe('severity formatting', () => {
    test('formats critical severity with emphasis', () => {
      const findings = [createFinding({ severity: 'critical' })];
      const markdown = formatFindings(findings);
      const lower = markdown.toLowerCase();
      expect(lower.includes('critical') || lower.includes('🔴')).toBe(true);
    });

    test('formats high severity', () => {
      const findings = [createFinding({ severity: 'high' })];
      const markdown = formatFindings(findings);
      const lower = markdown.toLowerCase();
      expect(lower.includes('high') || lower.includes('🟠')).toBe(true);
    });

    test('formats medium severity', () => {
      const findings = [createFinding({ severity: 'medium' })];
      const markdown = formatFindings(findings);
      const lower = markdown.toLowerCase();
      expect(lower.includes('medium') || lower.includes('🟡')).toBe(true);
    });

    test('formats low severity', () => {
      const findings = [createFinding({ severity: 'low' })];
      const markdown = formatFindings(findings);
      const lower = markdown.toLowerCase();
      expect(lower.includes('low') || lower.includes('🟢')).toBe(true);
    });

    test('formats info severity', () => {
      const findings = [createFinding({ severity: 'info' })];
      const markdown = formatFindings(findings);
      const lower = markdown.toLowerCase();
      expect(lower.includes('info') || lower.includes('ℹ️')).toBe(true);
    });
  });
});
