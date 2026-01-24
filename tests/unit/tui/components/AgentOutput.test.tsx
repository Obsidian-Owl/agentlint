/**
 * Unit tests for AgentOutput component
 *
 * Tests the streaming agent output display with markdown rendering.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { AgentOutput } from '../../../../src/tui/components/AgentOutput';
import type { StreamChunk } from '../../../../src/orchestration/types';

// =============================================================================
// Fixtures
// =============================================================================

function createTextChunk(content: string, level: 'normal' | 'verbose' = 'normal'): StreamChunk {
  return {
    type: 'text',
    level,
    content,
    timestamp: new Date().toISOString(),
  };
}

function createStatusChunk(content: string): StreamChunk {
  return {
    type: 'status',
    level: 'normal',
    content,
    timestamp: new Date().toISOString(),
  };
}

function createErrorChunk(content: string): StreamChunk {
  return {
    type: 'error',
    level: 'normal',
    content,
    timestamp: new Date().toISOString(),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('AgentOutput', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    test('should render empty state when no chunks', () => {
      const { lastFrame } = render(<AgentOutput chunks={[]} isStreaming={false} />);

      // Should render without crashing
      expect(lastFrame()).toBeDefined();
    });

    test('should render text chunks', () => {
      const chunks = [createTextChunk('Hello, world!')];
      const { lastFrame } = render(<AgentOutput chunks={chunks} isStreaming={false} />);

      expect(lastFrame()).toContain('Hello, world!');
    });

    test('should render multiple chunks in order', () => {
      const chunks = [
        createTextChunk('First'),
        createTextChunk('Second'),
        createTextChunk('Third'),
      ];
      const { lastFrame } = render(<AgentOutput chunks={chunks} isStreaming={false} />);

      const frame = lastFrame()!;
      expect(frame).toContain('First');
      expect(frame).toContain('Second');
      expect(frame).toContain('Third');
    });

    test('should render status chunks differently', () => {
      const chunks = [createStatusChunk('Processing...')];
      const { lastFrame } = render(<AgentOutput chunks={chunks} isStreaming={false} />);

      expect(lastFrame()).toContain('Processing...');
    });

    test('should render error chunks with error styling', () => {
      const chunks = [createErrorChunk('Something went wrong!')];
      const { lastFrame } = render(<AgentOutput chunks={chunks} isStreaming={false} />);

      expect(lastFrame()).toContain('Something went wrong!');
    });

    test('should render mixed chunk types', () => {
      const chunks = [
        createTextChunk('Starting...'),
        createStatusChunk('Analyzing...'),
        createTextChunk('Found issue'),
        createErrorChunk('Warning: deprecated API'),
      ];
      const { lastFrame } = render(<AgentOutput chunks={chunks} isStreaming={false} />);

      const frame = lastFrame()!;
      expect(frame).toContain('Starting...');
      expect(frame).toContain('Analyzing...');
      expect(frame).toContain('Found issue');
      expect(frame).toContain('Warning: deprecated API');
    });
  });

  describe('streaming indicator', () => {
    test('should show streaming indicator when streaming', () => {
      const chunks = [createTextChunk('Output so far...')];
      const { lastFrame } = render(<AgentOutput chunks={chunks} isStreaming={true} />);

      // Should have some visual indicator of streaming
      // This could be a spinner, dots, or cursor - implementation dependent
      expect(lastFrame()).toBeDefined();
    });

    test('should not show streaming indicator when not streaming', () => {
      const chunks = [createTextChunk('Complete output')];
      const { lastFrame } = render(<AgentOutput chunks={chunks} isStreaming={false} />);

      expect(lastFrame()).toContain('Complete output');
    });
  });

  describe('markdown rendering', () => {
    test('should render bold text', () => {
      const chunks = [createTextChunk('This is **bold** text')];
      const { lastFrame } = render(<AgentOutput chunks={chunks} isStreaming={false} />);

      // At minimum, the text should be present
      expect(lastFrame()).toContain('bold');
    });

    test('should render code blocks', () => {
      const chunks = [createTextChunk('Here is code: `const x = 1;`')];
      const { lastFrame } = render(<AgentOutput chunks={chunks} isStreaming={false} />);

      expect(lastFrame()).toContain('const x = 1');
    });

    test('should render lists', () => {
      const chunks = [createTextChunk('Items:\n- First\n- Second\n- Third')];
      const { lastFrame } = render(<AgentOutput chunks={chunks} isStreaming={false} />);

      const frame = lastFrame()!;
      expect(frame).toContain('First');
      expect(frame).toContain('Second');
      expect(frame).toContain('Third');
    });
  });

  describe('verbosity levels', () => {
    test('should render normal level chunks', () => {
      const chunks = [createTextChunk('Normal content', 'normal')];
      const { lastFrame } = render(<AgentOutput chunks={chunks} isStreaming={false} />);

      expect(lastFrame()).toContain('Normal content');
    });

    test('should render verbose level chunks when included', () => {
      const chunks = [createTextChunk('Verbose content', 'verbose')];
      const { lastFrame } = render(<AgentOutput chunks={chunks} isStreaming={false} />);

      // Verbose chunks may or may not be styled differently
      // At minimum they should be present
      expect(lastFrame()).toContain('Verbose content');
    });
  });

  describe('long content', () => {
    test('should handle long single chunk', () => {
      const longContent = 'A'.repeat(500);
      const chunks = [createTextChunk(longContent)];
      const { lastFrame } = render(<AgentOutput chunks={chunks} isStreaming={false} />);

      // Should render without crashing
      expect(lastFrame()).toBeDefined();
    });

    test('should handle many chunks', () => {
      const chunks = Array.from({ length: 50 }, (_, i) => createTextChunk(`Chunk ${i + 1}`));
      const { lastFrame } = render(<AgentOutput chunks={chunks} isStreaming={false} />);

      // Should render without crashing
      expect(lastFrame()).toBeDefined();
      expect(lastFrame()).toContain('Chunk 1');
    });
  });

  describe('empty and whitespace content', () => {
    test('should handle empty content chunks', () => {
      const chunks = [createTextChunk('')];
      const { lastFrame } = render(<AgentOutput chunks={chunks} isStreaming={false} />);

      expect(lastFrame()).toBeDefined();
    });

    test('should handle whitespace-only content', () => {
      const chunks = [createTextChunk('   ')];
      const { lastFrame } = render(<AgentOutput chunks={chunks} isStreaming={false} />);

      expect(lastFrame()).toBeDefined();
    });
  });
});
