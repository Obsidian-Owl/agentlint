/**
 * Unit tests for CLI renderers
 *
 * Tests the HeadlessRenderer, JsonRenderer, and TuiStreamRenderer implementations.
 * As of EP17, TerminalRenderer has been replaced by HeadlessRenderer + TuiStreamRenderer.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { HeadlessRenderer, TuiStreamRenderer } from '../../../../src/tui';
import { JsonRenderer } from '../../../../src/cli/renderers/json-renderer';
import { createRenderer, createHeadlessRenderer } from '../../../../src/cli/renderers';
import type { StreamChunk } from '../../../../src/orchestration/types';
import type { AnalyseFinding, AnalyseResult } from '../../../../src/cli/commands/analyse';

// Store original console methods
let originalLog: typeof console.log;
let originalError: typeof console.error;
let originalWarn: typeof console.warn;
let originalStdoutWrite: typeof process.stdout.write;
let logs: string[] = [];
let errors: string[] = [];
let stdoutWrites: string[] = [];

beforeEach(() => {
  logs = [];
  errors = [];
  stdoutWrites = [];
  originalLog = console.log;
  originalError = console.error;
  originalWarn = console.warn;
  originalStdoutWrite = process.stdout.write.bind(process.stdout);

  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };
  console.warn = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutWrites.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
});

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
  console.warn = originalWarn;
  process.stdout.write = originalStdoutWrite;
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

describe('HeadlessRenderer', () => {
  describe('renderChunk', () => {
    test('renders text chunks to console', () => {
      const renderer = new HeadlessRenderer();
      renderer.start({ initialState: {} as never }); // HeadlessRenderer requires start()
      const chunk = createTestChunk('text', 'Analyzing configuration...');

      renderer.renderChunk(chunk);

      // HeadlessRenderer uses console.log for text
      expect(logs.some((s) => s.includes('Analyzing configuration'))).toBe(true);
    });

    test('renders status chunks', () => {
      const renderer = new HeadlessRenderer();
      renderer.start({ initialState: {} as never });
      const chunk = createTestChunk('status', 'Analysis complete');

      renderer.renderChunk(chunk);

      expect(logs.some((s) => s.includes('Analysis complete'))).toBe(true);
    });

    test('renders error chunks to stderr', () => {
      const renderer = new HeadlessRenderer();
      renderer.start({ initialState: {} as never });
      const chunk: StreamChunk = {
        type: 'error',
        level: 'normal',
        content: 'Something went wrong',
        timestamp: new Date().toISOString(),
      };

      renderer.renderChunk(chunk);

      expect(errors.some((err) => err.includes('Something went wrong'))).toBe(true);
    });

    test('respects quiet mode for verbose chunks', () => {
      const renderer = new HeadlessRenderer({ quiet: true });
      renderer.start({ initialState: {} as never });
      const chunk: StreamChunk = {
        type: 'status',
        level: 'verbose',
        content: 'Verbose status message',
        timestamp: new Date().toISOString(),
      };

      renderer.renderChunk(chunk);

      // In quiet mode, verbose chunks are suppressed
      expect(logs.length).toBe(0);
    });

    test('shows errors in quiet mode', () => {
      const renderer = new HeadlessRenderer({ quiet: true });
      renderer.start({ initialState: {} as never });
      const chunk: StreamChunk = {
        type: 'error',
        level: 'normal',
        content: 'Error message',
        timestamp: new Date().toISOString(),
      };

      renderer.renderChunk(chunk);

      expect(errors.some((err) => err.includes('Error message'))).toBe(true);
    });
  });

  describe('JSON mode', () => {
    test('outputs JSON when json option is true', () => {
      const renderer = new HeadlessRenderer({ json: true });
      renderer.start({ initialState: {} as never });
      const chunk = createTestChunk('status', 'Test status');

      renderer.renderChunk(chunk);

      // HeadlessRenderer uses console.log for JSON output
      const output = logs.join('');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      expect(() => JSON.parse(output)).not.toThrow();
    });
  });
});

describe('TuiStreamRenderer', () => {
  test('adapts HeadlessRenderer to IStreamRenderer', () => {
    const headless = new HeadlessRenderer();
    headless.start({ initialState: {} as never });
    const adapter = new TuiStreamRenderer(headless);

    const chunk = createTestChunk('text', 'Test message');
    adapter.renderChunk(chunk);

    // HeadlessRenderer uses console.log
    expect(logs.some((s) => s.includes('Test message'))).toBe(true);
  });

  test('flush is a no-op', () => {
    const headless = new HeadlessRenderer();
    const adapter = new TuiStreamRenderer(headless);

    // Should not throw
    adapter.flush();
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
      const parsed = JSON.parse(logLine) as {
        type: string;
        data: { id: string; severity: string };
      };
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
  test('creates TuiStreamRenderer for terminal mode', () => {
    const renderer = createRenderer('terminal', {});
    expect(renderer.constructor.name).toBe('TuiStreamRenderer');
  });

  test('creates JsonRenderer for json mode', () => {
    const renderer = createRenderer('json', {});
    expect(renderer.constructor.name).toBe('JsonRenderer');
  });

  test('creates TuiStreamRenderer for plain mode', () => {
    const renderer = createRenderer('plain', {});
    expect(renderer.constructor.name).toBe('TuiStreamRenderer');
  });

  test('creates TuiStreamRenderer for markdown mode', () => {
    const renderer = createRenderer('markdown', {});
    expect(renderer.constructor.name).toBe('TuiStreamRenderer');
  });

  test('passes verbose option to renderer', () => {
    const renderer = createRenderer('terminal', { verbose: true });
    // Can't easily test internal state, but at least ensure it doesn't throw
    expect(renderer.constructor.name).toBe('TuiStreamRenderer');
  });
});

describe('createHeadlessRenderer', () => {
  test('creates TuiStreamRenderer wrapping HeadlessRenderer', () => {
    const renderer = createHeadlessRenderer({});
    expect(renderer.constructor.name).toBe('TuiStreamRenderer');
  });

  test('passes verbose option', () => {
    const renderer = createHeadlessRenderer({ verbose: true });
    expect(renderer.constructor.name).toBe('TuiStreamRenderer');
  });

  test('passes quiet option', () => {
    const renderer = createHeadlessRenderer({ quiet: true });
    expect(renderer.constructor.name).toBe('TuiStreamRenderer');
  });
});
