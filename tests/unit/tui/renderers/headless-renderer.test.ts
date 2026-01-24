/**
 * Unit tests for HeadlessRenderer
 *
 * Tests the headless renderer for non-interactive mode (--non-interactive).
 */

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { HeadlessRenderer } from '../../../../src/tui/renderers/headless-renderer';
import type { StreamChunk } from '../../../../src/orchestration/types';

// =============================================================================
// Helper
// =============================================================================

/** Capture console output */
function captureOutput(): { logs: string[]; errors: string[]; restore: () => void } {
  const logs: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };

  return {
    logs,
    errors,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('HeadlessRenderer', () => {
  let renderer: HeadlessRenderer;
  let output: ReturnType<typeof captureOutput>;

  beforeEach(() => {
    output = captureOutput();
  });

  afterEach(() => {
    output.restore();
    if (renderer) {
      renderer.stop();
    }
  });

  describe('construction', () => {
    test('should create renderer instance', () => {
      renderer = new HeadlessRenderer();
      expect(renderer).toBeDefined();
    });

    test('should accept json option', () => {
      renderer = new HeadlessRenderer({ json: true });
      expect(renderer).toBeDefined();
    });

    test('should accept quiet option', () => {
      renderer = new HeadlessRenderer({ quiet: true });
      expect(renderer).toBeDefined();
    });
  });

  describe('start', () => {
    test('should start without throwing', () => {
      renderer = new HeadlessRenderer();
      expect(() => {
        renderer.start({});
      }).not.toThrow();
    });

    test('should accept callbacks', () => {
      renderer = new HeadlessRenderer();
      const onInput = mock(() => {});
      const onExit = mock(() => {});

      expect(() => {
        renderer.start({ onInput, onExit });
      }).not.toThrow();
    });
  });

  describe('stop', () => {
    test('should stop without throwing', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      expect(() => {
        renderer.stop();
      }).not.toThrow();
    });

    test('should be idempotent', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      expect(() => {
        renderer.stop();
        renderer.stop();
      }).not.toThrow();
    });
  });

  describe('renderChunk', () => {
    test('should output text chunk to console', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      const chunk: StreamChunk = {
        type: 'text',
        content: 'Hello world',
        level: 'normal',
        timestamp: new Date().toISOString(),
      };

      renderer.renderChunk(chunk);

      expect(output.logs).toContain('Hello world');
    });

    test('should output tool use chunk', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      const chunk: StreamChunk = {
        type: 'tool_start',
        content: 'read_file',
        level: 'verbose',
        timestamp: new Date().toISOString(),
        metadata: { toolName: 'read_file' },
      };

      renderer.renderChunk(chunk);

      // Should log something about tool use
      expect(output.logs.some((log) => log.includes('read_file'))).toBe(true);
    });

    test('should respect quiet mode', () => {
      renderer = new HeadlessRenderer({ quiet: true });
      renderer.start({});

      const chunk: StreamChunk = {
        type: 'text',
        content: 'Verbose output',
        level: 'verbose',
        timestamp: new Date().toISOString(),
      };

      renderer.renderChunk(chunk);

      // Verbose should be suppressed in quiet mode
      expect(output.logs).not.toContain('Verbose output');
    });

    test('should output JSON in json mode', () => {
      renderer = new HeadlessRenderer({ json: true });
      renderer.start({});

      const chunk: StreamChunk = {
        type: 'text',
        content: 'Hello',
        level: 'normal',
        timestamp: new Date().toISOString(),
      };

      renderer.renderChunk(chunk);

      // Should output valid JSON
      const jsonOutput = output.logs.find((log) => {
        try {
          JSON.parse(log);
          return true;
        } catch {
          return false;
        }
      });

      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput!);
      expect(parsed.type).toBe('text');
    });
  });

  describe('renderComplete', () => {
    test('should handle completion', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      expect(() => {
        renderer.renderComplete({ success: true });
      }).not.toThrow();
    });

    test('should output JSON completion in json mode', () => {
      renderer = new HeadlessRenderer({ json: true });
      renderer.start({});

      renderer.renderComplete({ findings: [], recommendations: [] });

      // Should output completion JSON
      const jsonOutput = output.logs.find((log) => {
        try {
          const parsed = JSON.parse(log);
          return parsed.type === 'complete';
        } catch {
          return false;
        }
      });

      expect(jsonOutput).toBeDefined();
    });
  });

  describe('requestPermission', () => {
    test('should auto-approve in headless mode', async () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      const decision = await renderer.requestPermission({
        tool: 'read_file',
        description: 'Read a file',
      });

      // Headless mode should auto-approve for session
      expect(decision.allowed).toBe(true);
      expect(decision.scope).toBe('session');
    });

    test('should include tool name in decision', async () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      const decision = await renderer.requestPermission({
        tool: 'write_file',
        description: 'Write to file',
        pattern: '/tmp/*.txt',
      });

      expect(decision.tool).toBe('write_file');
      expect(decision.pattern).toBe('/tmp/*.txt');
    });

    test('should auto-deny when denyAll option is set', async () => {
      renderer = new HeadlessRenderer({ denyAll: true });
      renderer.start({});

      const decision = await renderer.requestPermission({
        tool: 'execute_command',
        description: 'Run a command',
      });

      expect(decision.allowed).toBe(false);
    });
  });

  describe('ITuiRenderer interface', () => {
    test('should implement all interface methods', () => {
      renderer = new HeadlessRenderer();

      expect(typeof renderer.start).toBe('function');
      expect(typeof renderer.stop).toBe('function');
      expect(typeof renderer.renderChunk).toBe('function');
      expect(typeof renderer.renderComplete).toBe('function');
      expect(typeof renderer.requestPermission).toBe('function');
    });
  });
});
