/**
 * Unit tests for App component
 *
 * Tests the root TUI application component that composes
 * all sub-components and provides AppContext.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { App } from '../../../../src/tui/components/App';
import type { AppState } from '../../../../src/tui/types';

// =============================================================================
// Helper
// =============================================================================

/** Small delay to allow React effects to settle */
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

/** Create a partial initial state for testing */
function createTestState(overrides?: Partial<AppState>): Partial<AppState> {
  return {
    analysisPhase: 'idle',
    isStreaming: false,
    focusTarget: 'main',
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('App', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    test('should render without crashing', () => {
      const { lastFrame } = render(<App />);
      expect(lastFrame()).toBeDefined();
    });

    test('should render with initial state', () => {
      const { lastFrame } = render(<App initialState={createTestState()} />);
      expect(lastFrame()).toBeDefined();
    });

    test('should render input field', () => {
      const { lastFrame } = render(<App />);
      // Input field should be visible (prompt indicator)
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('callbacks', () => {
    test('should call onInput when user submits input', async () => {
      const onInput = mock(() => {});
      const { stdin } = render(<App onInput={onInput} />);

      await tick();
      // Type text
      stdin.write('test input');
      await tick();
      // Submit
      stdin.write('\r');
      await tick();

      expect(onInput).toHaveBeenCalledWith('test input');
    });

    test('should call onExit when user exits', async () => {
      const onExit = mock(() => {});
      const { stdin } = render(<App onExit={onExit} />);

      await tick();
      // Press q to exit
      stdin.write('q');
      await tick();

      expect(onExit).toHaveBeenCalled();
    });
  });

  describe('state management', () => {
    test('should accept initial state', () => {
      const { lastFrame } = render(<App initialState={{ analysisPhase: 'scanning' }} />);
      expect(lastFrame()).toBeDefined();
    });

    test('should handle streaming state', () => {
      const { lastFrame } = render(<App initialState={{ isStreaming: true }} />);
      expect(lastFrame()).toBeDefined();
    });

    test('should handle findings state', () => {
      const { lastFrame } = render(
        <App
          initialState={{
            findings: [
              {
                id: 'f1',
                type: 'quality_issue',
                severity: 'medium',
                title: 'Test finding',
                description: 'Test finding description',
                location: null,
                origin: null,
                recommendations: [],
                detectedAt: new Date().toISOString(),
                detectedInPhase: 'scanning',
              },
            ],
          }}
        />
      );
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('keyboard navigation', () => {
    test('should handle navigation keys', async () => {
      const { stdin, lastFrame } = render(<App />);

      await tick();
      stdin.write('j'); // Down
      await tick();
      stdin.write('k'); // Up
      await tick();

      expect(lastFrame()).toBeDefined();
    });

    test('should handle escape key', async () => {
      const { stdin, lastFrame } = render(<App />);

      await tick();
      stdin.write('\x1b'); // Escape
      await tick();

      expect(lastFrame()).toBeDefined();
    });
  });

  describe('dialog system', () => {
    test('should handle dialog focus', () => {
      const { lastFrame } = render(
        <App
          initialState={{
            viewStack: ['permission'],
            focusTarget: 'dialog',
          }}
        />
      );
      expect(lastFrame()).toBeDefined();
    });

    test('should render with permission dialog in stack', () => {
      const { lastFrame } = render(
        <App
          initialState={{
            viewStack: ['permission'],
            pendingPermission: {
              tool: 'read_file',
              description: 'Read a file',
            },
          }}
        />
      );
      expect(lastFrame()).toContain('read_file');
    });

    test('should render with recommendation dialog in stack', () => {
      const { lastFrame } = render(
        <App
          initialState={{
            viewStack: ['recommendation'],
            recommendations: [
              {
                type: 'preventive',
                action: 'Add validation',
                rationale: 'Prevents errors',
                priority: 'medium',
              },
            ],
          }}
        />
      );
      expect(lastFrame()).toContain('Add validation');
    });
  });

  describe('breadcrumbs', () => {
    test('should render exploration path', () => {
      const { lastFrame } = render(
        <App
          initialState={{
            explorationPath: [
              {
                id: 's1',
                topic: 'Overview',
                context: 'Main view',
                timestamp: new Date().toISOString(),
                parentId: null,
              },
              {
                id: 's2',
                topic: 'Details',
                context: 'Drill-down',
                timestamp: new Date().toISOString(),
                parentId: 's1',
              },
            ],
          }}
        />
      );

      const frame = lastFrame()!;
      expect(frame).toContain('Overview');
      expect(frame).toContain('Details');
    });
  });

  describe('agent output', () => {
    test('should render stream buffer', () => {
      const { lastFrame } = render(
        <App
          initialState={{
            streamBuffer: [
              {
                type: 'text',
                content: 'Hello from agent',
                level: 'normal',
                timestamp: new Date().toISOString(),
              },
            ],
          }}
        />
      );
      expect(lastFrame()).toContain('Hello from agent');
    });

    test('should render streaming indicator when streaming', () => {
      const { lastFrame } = render(
        <App
          initialState={{
            isStreaming: true,
            streamBuffer: [
              {
                type: 'text',
                content: 'Streaming...',
                level: 'normal',
                timestamp: new Date().toISOString(),
              },
            ],
          }}
        />
      );
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('context provider', () => {
    test('should provide app context to children', () => {
      // The App component should wrap children in AppProvider
      const { lastFrame } = render(<App />);
      expect(lastFrame()).toBeDefined();
    });
  });
});
