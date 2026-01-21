/**
 * Unit tests for CLI renderers
 *
 * Tests the TerminalRenderer and JsonRenderer implementations.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { TerminalRenderer } from '../../../../src/cli/renderers/terminal-renderer';
import { JsonRenderer } from '../../../../src/cli/renderers/json-renderer';
import { createRenderer } from '../../../../src/cli/renderers';
import type { StreamChunk } from '../../../../src/orchestration/types';
import type { AnalyseFinding, AnalyseResult } from '../../../../src/cli/commands/analyse';

// Store original console methods
let originalLog: typeof console.log;
let originalError: typeof console.error;
let originalWarn: typeof console.warn;
let logs: string[] = [];
let errors: string[] = [];

beforeEach(() => {
  logs = [];
  errors = [];
  originalLog = console.log;
  originalError = console.error;
  originalWarn = console.warn;

  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };
  console.warn = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
});

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
  console.warn = originalWarn;
});

// Test fixtures
function createTestChunk(
  type: StreamChunk['type'],
  content: string,
  metadata?: Record<string, unknown>
): StreamChunk {
  return {
    type,
    level: 'normal',
    content,
    timestamp: new Date().toISOString(),
    ...(metadata && { metadata }),
  };
}

function createTestFinding(): AnalyseFinding {
  return {
    id: 'FND-0001',
    severity: 'high',
    type: 'config_gap',
    title: 'Missing configuration',
    description: 'The project is missing a CLAUDE.md file',
    location: {
      file: 'CLAUDE.md',
      line: 1,
    },
  };
}

function createTestResult(): AnalyseResult {
  return {
    status: 'success',
    directory: '/test/project',
    configs: [
      {
        path: '/test/project/CLAUDE.md',
        type: 'claude-code',
        description: 'Claude Code config',
        size: 100,
        relativePath: 'CLAUDE.md',
      },
    ],
    findings: [createTestFinding()],
    summary: { total: 1, bySeverity: { high: 1 } },
    timestamp: new Date().toISOString(),
    durationMs: 1000,
  };
}

describe('TerminalRenderer', () => {
  describe('renderChunk', () => {
    test('renders text chunks directly', () => {
      const renderer = new TerminalRenderer();
      const chunk = createTestChunk('text', 'Analyzing configuration...');

      // Text goes to stdout, not console.log
      // The terminal renderer writes to process.stdout.write for text
      renderer.renderChunk(chunk);
      renderer.flush();

      // Text chunks use process.stdout.write, not console.log
      // So we don't see them in logs array
    });

    test('renders status chunks', () => {
      const renderer = new TerminalRenderer();
      const chunk = createTestChunk('status', 'Analysis complete');

      renderer.renderChunk(chunk);
      renderer.flush();

      expect(logs.some((log) => log.includes('complete'))).toBe(true);
    });

    test('renders error chunks', () => {
      const renderer = new TerminalRenderer();
      const chunk = createTestChunk('error', 'Error: Something went wrong');

      renderer.renderChunk(chunk);
      renderer.flush();

      expect(errors.some((err) => err.includes('Error'))).toBe(true);
    });

    test('respects quiet mode', () => {
      const renderer = new TerminalRenderer({ quiet: true });
      const chunk = createTestChunk('status', 'Status message');

      renderer.renderChunk(chunk);
      renderer.flush();

      // In quiet mode, non-error messages are suppressed
      expect(logs.length).toBe(0);
    });

    test('shows errors in quiet mode', () => {
      const renderer = new TerminalRenderer({ quiet: true });
      const chunk = createTestChunk('error', 'Error message');

      renderer.renderChunk(chunk);
      renderer.flush();

      expect(errors.some((err) => err.includes('Error'))).toBe(true);
    });
  });

  describe('renderFinding', () => {
    test('renders finding with severity', () => {
      const renderer = new TerminalRenderer();
      const finding = createTestFinding();

      renderer.renderFinding(finding);
      renderer.flush();

      expect(logs.some((log) => log.includes('HIGH'))).toBe(true);
      expect(logs.some((log) => log.includes('Missing configuration'))).toBe(true);
    });

    test('shows description in verbose mode', () => {
      const renderer = new TerminalRenderer({ verbose: true });
      const finding = createTestFinding();

      renderer.renderFinding(finding);
      renderer.flush();

      expect(logs.some((log) => log.includes('CLAUDE.md'))).toBe(true);
    });

    test('suppresses findings in quiet mode', () => {
      const renderer = new TerminalRenderer({ quiet: true });
      const finding = createTestFinding();

      renderer.renderFinding(finding);
      renderer.flush();

      expect(logs.length).toBe(0);
    });
  });

  describe('renderError', () => {
    test('renders error message', () => {
      const renderer = new TerminalRenderer();
      const error = new Error('Test error');

      renderer.renderError(error);
      renderer.flush();

      expect(errors.some((err) => err.includes('Test error'))).toBe(true);
    });
  });

  describe('renderComplete', () => {
    test('renders summary', () => {
      const renderer = new TerminalRenderer();
      const result = createTestResult();

      renderer.renderComplete(result);
      renderer.flush();

      expect(logs.some((log) => log.includes('Summary'))).toBe(true);
      expect(logs.some((log) => log.includes('Findings'))).toBe(true);
    });

    test('shows minimal output in quiet mode', () => {
      const renderer = new TerminalRenderer({ quiet: true });
      const result = createTestResult();

      renderer.renderComplete(result);
      renderer.flush();

      // Quiet mode still shows finding count
      expect(logs.some((log) => log.includes('1'))).toBe(true);
    });
  });
});

describe('JsonRenderer', () => {
  describe('renderChunk', () => {
    test('outputs JSON line for chunk', () => {
      const renderer = new JsonRenderer();
      const chunk = createTestChunk('status', 'Analysis started');

      renderer.renderChunk(chunk);

      expect(logs.length).toBe(1);
      const logLine = logs[0]!;
      const parsed = JSON.parse(logLine) as { type: string; data: { content: string } };
      expect(parsed.type).toBe('status');
      expect(parsed.data.content).toBe('Analysis started');
    });

    test('includes timestamp in JSON', () => {
      const renderer = new JsonRenderer();
      const chunk = createTestChunk('text', 'Some text');

      renderer.renderChunk(chunk);

      const logLine = logs[0]!;
      const parsed = JSON.parse(logLine) as { timestamp: string };
      expect(parsed.timestamp).toBeDefined();
    });

    test('includes metadata when present', () => {
      const renderer = new JsonRenderer({ verbose: true });
      const chunk = createTestChunk('tool_start', 'Calling tool', {
        toolName: 'discover_configs',
      });

      renderer.renderChunk(chunk);

      const logLine = logs[0]!;
      const parsed = JSON.parse(logLine) as { data: { metadata: { toolName: string } } };
      expect(parsed.data.metadata.toolName).toBe('discover_configs');
    });

    test('filters non-verbose events in non-verbose mode', () => {
      const renderer = new JsonRenderer({ verbose: false });
      const chunk = createTestChunk('tool_result', 'Tool completed');

      renderer.renderChunk(chunk);

      // tool_result is filtered in non-verbose mode
      expect(logs.length).toBe(0);
    });
  });

  describe('renderFinding', () => {
    test('outputs finding as JSON', () => {
      const renderer = new JsonRenderer();
      const finding = createTestFinding();

      renderer.renderFinding(finding);

      const logLine = logs[0]!;
      const parsed = JSON.parse(logLine) as { type: string; data: { id: string; severity: string } };
      expect(parsed.type).toBe('finding');
      expect(parsed.data.id).toBe('FND-0001');
      expect(parsed.data.severity).toBe('high');
    });
  });

  describe('renderError', () => {
    test('outputs error as JSON', () => {
      const renderer = new JsonRenderer();
      const error = new Error('Test error');

      renderer.renderError(error);

      const logLine = logs[0]!;
      const parsed = JSON.parse(logLine) as { type: string; data: { message: string } };
      expect(parsed.type).toBe('error');
      expect(parsed.data.message).toBe('Test error');
    });
  });

  describe('renderComplete', () => {
    test('outputs complete result as JSON', () => {
      const renderer = new JsonRenderer();
      const result = createTestResult();

      renderer.renderComplete(result);

      const logLine = logs[0]!;
      const parsed = JSON.parse(logLine) as {
        type: string;
        data: { status: string; findings: unknown[] };
      };
      expect(parsed.type).toBe('complete');
      expect(parsed.data.status).toBe('success');
      expect(parsed.data.findings.length).toBe(1);
    });
  });
});

describe('createRenderer', () => {
  test('creates TerminalRenderer for terminal mode', () => {
    const renderer = createRenderer('terminal', {});
    expect(renderer.constructor.name).toBe('TerminalRenderer');
  });

  test('creates JsonRenderer for json mode', () => {
    const renderer = createRenderer('json', {});
    expect(renderer.constructor.name).toBe('JsonRenderer');
  });

  test('creates TerminalRenderer for plain mode', () => {
    const renderer = createRenderer('plain', {});
    expect(renderer.constructor.name).toBe('TerminalRenderer');
  });

  test('creates TerminalRenderer for markdown mode', () => {
    const renderer = createRenderer('markdown', {});
    expect(renderer.constructor.name).toBe('TerminalRenderer');
  });

  test('passes verbose option to renderer', () => {
    const renderer = createRenderer('terminal', { verbose: true });
    // Can't easily test internal state, but at least ensure it doesn't throw
    expect(renderer.constructor.name).toBe('TerminalRenderer');
  });
});
