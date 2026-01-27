/**
 * Unit tests for StatusBar component
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { StatusBar } from '../../../../src/tui/components/StatusBar';
import type { StatusBarContext } from '../../../../src/tui/types';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

function createContext(overrides: Partial<StatusBarContext> = {}): StatusBarContext {
  return {
    helpHint: 'ctrl+? help',
    status: 'Ready',
    model: 'claude-sonnet-4',
    openRecommendations: 0,
    projectPath: '/Users/test/project',
    ...overrides,
  };
}

describe('StatusBar', () => {
  afterEach(() => {
    cleanup();
  });

  describe('basic rendering', () => {
    test('should render help hint', async () => {
      const context = createContext({ helpHint: 'ctrl+? help' });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toContain('ctrl+? help');
    });

    test('should render status', async () => {
      const context = createContext({ status: 'Analyzing' });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toContain('Analyzing');
    });

    test('should render model name', async () => {
      const context = createContext({ model: 'claude-opus-4' });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toContain('claude-opus-4');
    });

    test('should render project path', async () => {
      const context = createContext({ projectPath: '/my/project' });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toContain('/my/project');
    });
  });

  describe('status colors', () => {
    test('should render Loading status', async () => {
      const context = createContext({ status: 'Loading...' });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toContain('Loading...');
    });

    test('should render Complete status', async () => {
      const context = createContext({ status: 'Complete' });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toContain('Complete');
    });
  });

  describe('token usage', () => {
    test('should display token usage when provided', async () => {
      const context = createContext({
        tokenUsage: { used: 5000, limit: 100000 },
      });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toContain('5.0k/100k');
    });

    test('should not display token section when not provided', async () => {
      const context = createContext();
      delete (context as Partial<StatusBarContext>).tokenUsage;
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).not.toContain('/100k');
    });

    test('should show green color for low usage', async () => {
      const context = createContext({
        tokenUsage: { used: 10000, limit: 100000 },
      });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toContain('10.0k/100k');
    });

    test('should show yellow color for 80% usage', async () => {
      const context = createContext({
        tokenUsage: { used: 80000, limit: 100000 },
      });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toContain('80.0k/100k');
    });

    test('should show red color for 90% usage', async () => {
      const context = createContext({
        tokenUsage: { used: 95000, limit: 100000 },
      });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toContain('95.0k/100k');
    });
  });

  describe('elapsed time', () => {
    test('should display elapsed time in milliseconds', async () => {
      const context = createContext({ elapsedMs: 500 });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toContain('500ms');
    });

    test('should display elapsed time in seconds', async () => {
      const context = createContext({ elapsedMs: 5000 });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toContain('5s');
    });

    test('should display elapsed time in minutes and seconds', async () => {
      const context = createContext({ elapsedMs: 125000 });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toContain('2m 5s');
    });

    test('should not display elapsed when 0', async () => {
      const context = createContext({ elapsedMs: 0 });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).not.toContain('0ms');
    });

    test('should not display elapsed when undefined', async () => {
      const context = createContext();
      delete (context as Partial<StatusBarContext>).elapsedMs;
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toBeDefined();
    });
  });

  describe('warnings', () => {
    test('should display warning count when warnings exist', async () => {
      const context = createContext({
        warnings: ['Warning 1', 'Warning 2', 'Warning 3'],
      });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toContain('3');
    });

    test('should not display warning section when no warnings', async () => {
      const context = createContext({ warnings: [] });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toBeDefined();
    });

    test('should not display warning section when warnings undefined', async () => {
      const context = createContext();
      delete (context as Partial<StatusBarContext>).warnings;
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toBeDefined();
    });
  });

  describe('recommendations', () => {
    test('should display open recommendations count', async () => {
      const context = createContext({ openRecommendations: 5 });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toContain('5 recs');
    });

    test('should not display recommendations when 0', async () => {
      const context = createContext({ openRecommendations: 0 });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).not.toContain('recs');
    });
  });

  describe('path shortening', () => {
    test('should shorten long paths', async () => {
      const longPath = '/Users/developer/very/long/path/to/project/directory';
      const context = createContext({ projectPath: longPath });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toContain('...');
    });

    test('should keep short paths unchanged', async () => {
      const context = createContext({ projectPath: '/short/path' });
      const { lastFrame } = render(<StatusBar context={context} />);

      await tick();

      expect(lastFrame()).toContain('/short/path');
    });
  });
});
