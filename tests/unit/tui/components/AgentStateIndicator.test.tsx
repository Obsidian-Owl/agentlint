/**
 * Unit tests for AgentStateIndicator component
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { AgentStateIndicator } from '../../../../src/tui/components/AgentStateIndicator';
import type { AgentWorkState } from '../../../../src/tui/state/agent-state';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('AgentStateIndicator', () => {
  afterEach(() => {
    cleanup();
  });

  describe('idle phase', () => {
    test('should render nothing when idle', async () => {
      const state: AgentWorkState = { phase: 'idle' };
      const { lastFrame } = render(<AgentStateIndicator state={state} />);

      await tick();

      expect(lastFrame()).toBe('');
    });
  });

  describe('thinking phase', () => {
    test('should render thinking message', async () => {
      const state: AgentWorkState = { phase: 'thinking', startedAt: Date.now() };
      const { lastFrame } = render(<AgentStateIndicator state={state} />);

      await tick();

      expect(lastFrame()).toContain('Thinking...');
    });

    test('should show elapsed time when enabled', async () => {
      const state: AgentWorkState = { phase: 'thinking', startedAt: Date.now() - 5000 };
      const { lastFrame } = render(<AgentStateIndicator state={state} showElapsed={true} />);

      await tick();

      expect(lastFrame()).toContain('5s');
    });

    test('should hide elapsed time when disabled', async () => {
      const state: AgentWorkState = { phase: 'thinking', startedAt: Date.now() - 5000 };
      const { lastFrame } = render(<AgentStateIndicator state={state} showElapsed={false} />);

      await tick();

      expect(lastFrame()).toContain('Thinking...');
      expect(lastFrame()).not.toContain('5s');
    });
  });

  describe('calling_tool phase', () => {
    test('should render calling tool message with tool name', async () => {
      const state: AgentWorkState = {
        phase: 'calling_tool',
        tool: 'ReadFile',
        startedAt: Date.now(),
      };
      const { lastFrame } = render(<AgentStateIndicator state={state} />);

      await tick();

      expect(lastFrame()).toContain('Calling ReadFile...');
    });

    test('should show elapsed time for tool call', async () => {
      const state: AgentWorkState = {
        phase: 'calling_tool',
        tool: 'ReadFile',
        startedAt: Date.now() - 3000,
      };
      const { lastFrame } = render(<AgentStateIndicator state={state} showElapsed={true} />);

      await tick();

      expect(lastFrame()).toContain('3s');
    });
  });

  describe('waiting_response phase', () => {
    test('should render waiting message with tool name', async () => {
      const state: AgentWorkState = {
        phase: 'waiting_response',
        tool: 'ExecuteCommand',
        startedAt: Date.now(),
      };
      const { lastFrame } = render(<AgentStateIndicator state={state} />);

      await tick();

      expect(lastFrame()).toContain('Waiting for ExecuteCommand...');
    });
  });

  describe('streaming phase', () => {
    test('should render generating message', async () => {
      const state: AgentWorkState = { phase: 'streaming', startedAt: Date.now() };
      const { lastFrame } = render(<AgentStateIndicator state={state} />);

      await tick();

      expect(lastFrame()).toContain('Generating...');
    });
  });

  describe('error phase', () => {
    test('should render error message', async () => {
      const state: AgentWorkState = { phase: 'error', message: 'Connection failed' };
      const { lastFrame } = render(<AgentStateIndicator state={state} />);

      await tick();

      expect(lastFrame()).toContain('Error: Connection failed');
    });

    test('should not show spinner for error state', async () => {
      const state: AgentWorkState = { phase: 'error', message: 'Failed' };
      const { lastFrame } = render(<AgentStateIndicator state={state} />);

      await tick();

      expect(lastFrame()).toContain('Error:');
    });
  });

  describe('complete phase', () => {
    test('should render done message with duration', async () => {
      const state: AgentWorkState = { phase: 'complete', durationMs: 1500 };
      const { lastFrame } = render(<AgentStateIndicator state={state} />);

      await tick();

      expect(lastFrame()).toContain('Done (1500ms)');
    });

    test('should not show spinner for complete state', async () => {
      const state: AgentWorkState = { phase: 'complete', durationMs: 1000 };
      const { lastFrame } = render(<AgentStateIndicator state={state} />);

      await tick();

      expect(lastFrame()).toContain('Done');
    });
  });

  describe('spinner visibility', () => {
    test('should show spinner for thinking phase', async () => {
      const state: AgentWorkState = { phase: 'thinking', startedAt: Date.now() };
      const { lastFrame } = render(<AgentStateIndicator state={state} />);

      await tick();

      expect(lastFrame()).toBeDefined();
    });

    test('should show spinner for calling_tool phase', async () => {
      const state: AgentWorkState = { phase: 'calling_tool', tool: 'Test', startedAt: Date.now() };
      const { lastFrame } = render(<AgentStateIndicator state={state} />);

      await tick();

      expect(lastFrame()).toBeDefined();
    });

    test('should show spinner for waiting_response phase', async () => {
      const state: AgentWorkState = {
        phase: 'waiting_response',
        tool: 'Test',
        startedAt: Date.now(),
      };
      const { lastFrame } = render(<AgentStateIndicator state={state} />);

      await tick();

      expect(lastFrame()).toBeDefined();
    });

    test('should show spinner for streaming phase', async () => {
      const state: AgentWorkState = { phase: 'streaming', startedAt: Date.now() };
      const { lastFrame } = render(<AgentStateIndicator state={state} />);

      await tick();

      expect(lastFrame()).toBeDefined();
    });
  });

  describe('default props', () => {
    test('should show elapsed by default', async () => {
      const state: AgentWorkState = { phase: 'thinking', startedAt: Date.now() - 2000 };
      const { lastFrame } = render(<AgentStateIndicator state={state} />);

      await tick();

      expect(lastFrame()).toContain('2s');
    });
  });
});
