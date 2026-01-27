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
    test('should enable chunk rendering after start', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      const chunk: StreamChunk = {
        type: 'text',
        content: 'After start',
        level: 'normal',
        timestamp: new Date().toISOString(),
      };

      renderer.renderChunk(chunk);

      expect(output.logs).toContain('After start');
    });

    test('should not render chunks before start is called', () => {
      renderer = new HeadlessRenderer();

      const chunk: StreamChunk = {
        type: 'text',
        content: 'Before start',
        level: 'normal',
        timestamp: new Date().toISOString(),
      };

      renderer.renderChunk(chunk);

      expect(output.logs).not.toContain('Before start');
    });

    test('should accept callbacks without error', () => {
      renderer = new HeadlessRenderer();
      const onInput = mock(() => {});
      const onExit = mock(() => {});

      renderer.start({ onInput, onExit });

      expect(onInput).not.toHaveBeenCalled();
      expect(onExit).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    test('should disable chunk rendering after stop', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});
      renderer.stop();

      const chunk: StreamChunk = {
        type: 'text',
        content: 'After stop',
        level: 'normal',
        timestamp: new Date().toISOString(),
      };

      renderer.renderChunk(chunk);

      expect(output.logs).not.toContain('After stop');
    });

    test('should disable renderComplete after stop', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});
      renderer.stop();

      renderer.renderComplete({ success: true });

      expect(output.logs).not.toContain('[complete]');
    });

    test('should be idempotent - multiple stops do not cause errors', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      renderer.stop();
      renderer.stop();
      renderer.stop();

      const chunk: StreamChunk = {
        type: 'text',
        content: 'After multiple stops',
        level: 'normal',
        timestamp: new Date().toISOString(),
      };

      renderer.renderChunk(chunk);
      expect(output.logs).not.toContain('After multiple stops');
    });

    test('should allow restart after stop', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});
      renderer.stop();
      renderer.start({});

      const chunk: StreamChunk = {
        type: 'text',
        content: 'After restart',
        level: 'normal',
        timestamp: new Date().toISOString(),
      };

      renderer.renderChunk(chunk);
      expect(output.logs).toContain('After restart');
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
    test('should output complete message in plain text mode', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      renderer.renderComplete({ success: true });

      expect(output.logs).toContain('[complete]');
    });

    test('should not output complete message in quiet mode', () => {
      renderer = new HeadlessRenderer({ quiet: true });
      renderer.start({});

      renderer.renderComplete({ success: true });

      expect(output.logs).not.toContain('[complete]');
    });

    test('should output JSON completion in json mode', () => {
      renderer = new HeadlessRenderer({ json: true });
      renderer.start({});

      renderer.renderComplete({ findings: [], recommendations: [] });

      const jsonOutput = output.logs.find((log) => {
        try {
          const parsed = JSON.parse(log);
          return parsed.type === 'complete';
        } catch {
          return false;
        }
      });

      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput!);
      expect(parsed.result).toEqual({ findings: [], recommendations: [] });
      expect(parsed.timestamp).toBeDefined();
    });

    test('should include result in JSON output', () => {
      renderer = new HeadlessRenderer({ json: true });
      renderer.start({});

      const result = { findings: [{ id: 'f1' }], success: true };
      renderer.renderComplete(result);

      const jsonOutput = output.logs.find((log) => {
        try {
          const parsed = JSON.parse(log);
          return parsed.type === 'complete';
        } catch {
          return false;
        }
      });

      const parsed = JSON.parse(jsonOutput!);
      expect(parsed.result).toEqual(result);
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
    test('should implement all required interface methods', () => {
      renderer = new HeadlessRenderer();

      expect(typeof renderer.start).toBe('function');
      expect(typeof renderer.stop).toBe('function');
      expect(typeof renderer.renderChunk).toBe('function');
      expect(typeof renderer.renderComplete).toBe('function');
      expect(typeof renderer.requestPermission).toBe('function');
    });

    test('should implement extended methods as no-ops', () => {
      renderer = new HeadlessRenderer();

      expect(typeof renderer.setTuiState).toBe('function');
      expect(typeof renderer.setLoadingSteps).toBe('function');
      expect(typeof renderer.updateLoadingStep).toBe('function');
      expect(typeof renderer.addConversationMessage).toBe('function');
      expect(typeof renderer.updateStatusBar).toBe('function');
      expect(typeof renderer.setWelcomeMenu).toBe('function');
      expect(typeof renderer.setAgentState).toBe('function');
      expect(typeof renderer.requestUserAnswers).toBe('function');
    });
  });

  describe('extended methods (no-ops)', () => {
    test('setTuiState should be callable without error', () => {
      renderer = new HeadlessRenderer();
      renderer.setTuiState('loading');
      renderer.setTuiState('welcome');
      renderer.setTuiState('analysing');
      expect(output.logs.length).toBe(0);
    });

    test('setLoadingSteps should be callable without error', () => {
      renderer = new HeadlessRenderer();
      renderer.setLoadingSteps([{ id: 'step1', label: 'Loading...', status: 'pending' }]);
      expect(output.logs.length).toBe(0);
    });

    test('updateLoadingStep should be callable without error', () => {
      renderer = new HeadlessRenderer();
      renderer.updateLoadingStep('step1', 'complete');
      renderer.updateLoadingStep('step1', 'error', 'Failed');
      expect(output.logs.length).toBe(0);
    });

    test('addConversationMessage should be callable without error', () => {
      renderer = new HeadlessRenderer();
      renderer.addConversationMessage({
        role: 'user',
        content: 'Hello',
        timestamp: new Date().toISOString(),
      });
      expect(output.logs.length).toBe(0);
    });

    test('updateStatusBar should be callable without error', () => {
      renderer = new HeadlessRenderer();
      renderer.updateStatusBar({ status: 'Working...' });
      expect(output.logs.length).toBe(0);
    });

    test('setWelcomeMenu should be callable without error', () => {
      renderer = new HeadlessRenderer();
      renderer.setWelcomeMenu([{ key: '1', label: 'Option 1', action: 'action1' }]);
      expect(output.logs.length).toBe(0);
    });

    test('setAgentState should be callable without error', () => {
      renderer = new HeadlessRenderer();
      renderer.setAgentState({ phase: 'thinking', startedAt: Date.now() });
      renderer.setAgentState({ phase: 'idle' });
      expect(output.logs.length).toBe(0);
    });
  });

  describe('requestUserAnswers', () => {
    test('should auto-select first option in quiet mode', async () => {
      renderer = new HeadlessRenderer({ quiet: true });
      renderer.start({});

      const answers = await renderer.requestUserAnswers({
        questions: [
          {
            question: 'What do you prefer?',
            header: 'Preference',
            options: [
              { label: 'Option A', description: 'First option' },
              { label: 'Option B', description: 'Second option' },
            ],
          },
        ],
      });

      expect(answers['What do you prefer?']).toBe('Option A');
    });

    test('should auto-select first option in denyAll mode', async () => {
      renderer = new HeadlessRenderer({ denyAll: true });
      renderer.start({});

      const answers = await renderer.requestUserAnswers({
        questions: [
          {
            question: 'Choose one',
            header: 'Choice',
            options: [{ label: 'First' }, { label: 'Second' }],
          },
        ],
      });

      expect(answers['Choose one']).toBe('First');
    });

    test('should output JSON in json+quiet mode', async () => {
      renderer = new HeadlessRenderer({ json: true, quiet: true });
      renderer.start({});

      await renderer.requestUserAnswers({
        questions: [
          {
            question: 'Test question',
            header: 'Test',
            options: [{ label: 'Yes' }, { label: 'No' }],
          },
        ],
      });

      const jsonOutput = output.logs.find((log) => {
        try {
          const parsed = JSON.parse(log);
          return parsed.type === 'questions';
        } catch {
          return false;
        }
      });

      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput!);
      expect(parsed.mode).toBe('auto');
      expect(parsed.answers['Test question']).toBe('Yes');
    });
  });

  describe('chunk type handling', () => {
    test('should output error chunks to stderr', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      renderer.renderChunk({
        type: 'error',
        content: 'Something went wrong',
        level: 'normal',
        timestamp: new Date().toISOString(),
      });

      expect(output.errors.some((e) => e.includes('Something went wrong'))).toBe(true);
    });

    test('should output finding chunks with prefix', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      renderer.renderChunk({
        type: 'finding',
        content: 'Found issue in config',
        level: 'normal',
        timestamp: new Date().toISOString(),
      });

      expect(output.logs.some((l) => l.includes('[finding]'))).toBe(true);
      expect(output.logs.some((l) => l.includes('Found issue in config'))).toBe(true);
    });

    test('should output phase_change chunks with prefix', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      renderer.renderChunk({
        type: 'phase_change',
        content: 'Analyzing',
        level: 'normal',
        timestamp: new Date().toISOString(),
      });

      expect(output.logs.some((l) => l.includes('[phase]'))).toBe(true);
    });

    test('should suppress phase_change in quiet mode', () => {
      renderer = new HeadlessRenderer({ quiet: true });
      renderer.start({});

      renderer.renderChunk({
        type: 'phase_change',
        content: 'Analyzing',
        level: 'normal',
        timestamp: new Date().toISOString(),
      });

      expect(output.logs.length).toBe(0);
    });

    test('should output tool_result with success status', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      renderer.renderChunk({
        type: 'tool_result',
        content: 'result',
        level: 'normal',
        timestamp: new Date().toISOString(),
        metadata: { toolName: 'read_file', success: true },
      });

      expect(output.logs.some((l) => l.includes('[result]'))).toBe(true);
      expect(output.logs.some((l) => l.includes('success'))).toBe(true);
    });

    test('should output tool_result with failed status', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      renderer.renderChunk({
        type: 'tool_result',
        content: 'error',
        level: 'normal',
        timestamp: new Date().toISOString(),
        metadata: { toolName: 'write_file', success: false },
      });

      expect(output.logs.some((l) => l.includes('failed'))).toBe(true);
    });

    test('should output status chunks with prefix', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      renderer.renderChunk({
        type: 'status',
        content: 'Processing...',
        level: 'normal',
        timestamp: new Date().toISOString(),
      });

      expect(output.logs.some((l) => l.includes('[status]'))).toBe(true);
    });

    test('should output checkpoint only in verbose mode', () => {
      renderer = new HeadlessRenderer({ verbose: true });
      renderer.start({});

      renderer.renderChunk({
        type: 'checkpoint',
        content: 'Checkpoint saved',
        level: 'normal',
        timestamp: new Date().toISOString(),
      });

      expect(output.logs.some((l) => l.includes('[checkpoint]'))).toBe(true);
    });

    test('should suppress checkpoint in non-verbose mode', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      renderer.renderChunk({
        type: 'checkpoint',
        content: 'Checkpoint saved',
        level: 'normal',
        timestamp: new Date().toISOString(),
      });

      expect(output.logs.length).toBe(0);
    });

    test('should output user_question chunks', () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      renderer.renderChunk({
        type: 'user_question',
        content: 'What would you like to do?',
        level: 'normal',
        timestamp: new Date().toISOString(),
      });

      expect(output.logs.some((l) => l.includes('[question]'))).toBe(true);
    });
  });

  describe('permission logging', () => {
    test('should log auto-approved permission in plain text mode', async () => {
      renderer = new HeadlessRenderer();
      renderer.start({});

      await renderer.requestPermission({
        tool: 'read_file',
        description: 'Read a file',
      });

      expect(output.logs.some((l) => l.includes('[permission]'))).toBe(true);
      expect(output.logs.some((l) => l.includes('auto-approved'))).toBe(true);
    });

    test('should log auto-denied permission in plain text mode', async () => {
      renderer = new HeadlessRenderer({ denyAll: true });
      renderer.start({});

      await renderer.requestPermission({
        tool: 'execute',
        description: 'Execute command',
      });

      expect(output.logs.some((l) => l.includes('auto-denied'))).toBe(true);
    });

    test('should not log permission in quiet mode', async () => {
      renderer = new HeadlessRenderer({ quiet: true });
      renderer.start({});

      await renderer.requestPermission({
        tool: 'read_file',
        description: 'Read a file',
      });

      expect(output.logs.length).toBe(0);
    });

    test('should output JSON for permission in json mode', async () => {
      renderer = new HeadlessRenderer({ json: true });
      renderer.start({});

      await renderer.requestPermission({
        tool: 'write_file',
        description: 'Write to file',
        pattern: '/tmp/*',
      });

      const jsonOutput = output.logs.find((log) => {
        try {
          const parsed = JSON.parse(log);
          return parsed.type === 'permission';
        } catch {
          return false;
        }
      });

      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput!);
      expect(parsed.request.tool).toBe('write_file');
      expect(parsed.decision.allowed).toBe(true);
    });
  });
});
