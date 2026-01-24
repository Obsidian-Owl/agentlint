/**
 * Unit tests for useStreamBuffer hook
 *
 * Tests input buffering during streaming.
 * The hook buffers user input while the agent is streaming,
 * then processes it when streaming pauses or stops.
 */

import React, { useState } from 'react';
import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { Text } from 'ink';
import { useStreamBuffer } from '../../../../src/tui/hooks/useStreamBuffer';

// =============================================================================
// Helper
// =============================================================================

/** Small delay to allow React effects to settle */
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

// =============================================================================
// Test Components
// =============================================================================

interface TestComponentProps {
  initialIsStreaming?: boolean;
  onSubmit?: (input: string) => void;
  onBufferChange?: (buffer: string) => void;
}

function TestComponent({
  initialIsStreaming = false,
  onSubmit,
  onBufferChange,
}: TestComponentProps): React.ReactElement {
  const [isStreaming, setIsStreaming] = useState(initialIsStreaming);

  const { buffer, append, clear, flush, isEmpty, length } = useStreamBuffer({
    isStreaming,
    ...(onSubmit && { onSubmit }),
    ...(onBufferChange && { onBufferChange }),
  });

  // Expose functions globally for testing
  (globalThis as Record<string, unknown>).__testAppend = append;
  (globalThis as Record<string, unknown>).__testClear = clear;
  (globalThis as Record<string, unknown>).__testFlush = flush;
  (globalThis as Record<string, unknown>).__testSetStreaming = setIsStreaming;

  return (
    <Text>
      Buffer: "{buffer}", Empty: {String(isEmpty)}, Length: {length}, Streaming:{' '}
      {String(isStreaming)}
    </Text>
  );
}

function AutoFlushComponent({
  onSubmit,
}: {
  onSubmit?: (input: string) => void;
}): React.ReactElement {
  const [isStreaming, setIsStreaming] = useState(true);

  const { buffer, append, isEmpty } = useStreamBuffer({
    isStreaming,
    ...(onSubmit && { onSubmit }),
    autoFlushOnPause: true,
  });

  // Expose functions for testing
  (globalThis as Record<string, unknown>).__testAppend = append;
  (globalThis as Record<string, unknown>).__testSetStreaming = setIsStreaming;

  return (
    <Text>
      Buffer: "{buffer}", Empty: {String(isEmpty)}, Streaming: {String(isStreaming)}
    </Text>
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('useStreamBuffer', () => {
  afterEach(() => {
    cleanup();
    delete (globalThis as Record<string, unknown>).__testAppend;
    delete (globalThis as Record<string, unknown>).__testClear;
    delete (globalThis as Record<string, unknown>).__testFlush;
    delete (globalThis as Record<string, unknown>).__testSetStreaming;
  });

  describe('initial state', () => {
    test('should start with empty buffer', () => {
      const { lastFrame } = render(<TestComponent />);

      expect(lastFrame()).toContain('Buffer: ""');
      expect(lastFrame()).toContain('Empty: true');
      expect(lastFrame()).toContain('Length: 0');
    });

    test('should reflect isStreaming state', () => {
      const { lastFrame } = render(<TestComponent initialIsStreaming={true} />);

      expect(lastFrame()).toContain('Streaming: true');
    });
  });

  describe('append', () => {
    test('should append text to buffer', async () => {
      const { lastFrame } = render(<TestComponent />);

      await tick();

      const appendFn = (globalThis as Record<string, unknown>).__testAppend as (
        text: string
      ) => void;
      appendFn('hello');

      await tick();

      expect(lastFrame()).toContain('Buffer: "hello"');
      expect(lastFrame()).toContain('Empty: false');
      expect(lastFrame()).toContain('Length: 5');
    });

    test('should append multiple times', async () => {
      const { lastFrame } = render(<TestComponent />);

      await tick();

      const appendFn = (globalThis as Record<string, unknown>).__testAppend as (
        text: string
      ) => void;
      appendFn('hello');
      await tick();
      appendFn(' world');
      await tick();

      expect(lastFrame()).toContain('Buffer: "hello world"');
      expect(lastFrame()).toContain('Length: 11');
    });

    test('should call onBufferChange when buffer changes', async () => {
      const onBufferChange = mock(() => {});
      render(<TestComponent onBufferChange={onBufferChange} />);

      await tick();

      const appendFn = (globalThis as Record<string, unknown>).__testAppend as (
        text: string
      ) => void;
      appendFn('test');

      await tick();

      expect(onBufferChange).toHaveBeenCalledWith('test');
    });
  });

  describe('clear', () => {
    test('should clear the buffer', async () => {
      const { lastFrame } = render(<TestComponent />);

      await tick();

      const appendFn = (globalThis as Record<string, unknown>).__testAppend as (
        text: string
      ) => void;
      const clearFn = (globalThis as Record<string, unknown>).__testClear as () => void;

      appendFn('hello');
      await tick();

      expect(lastFrame()).toContain('Buffer: "hello"');

      clearFn();
      await tick();

      expect(lastFrame()).toContain('Buffer: ""');
      expect(lastFrame()).toContain('Empty: true');
    });
  });

  describe('flush', () => {
    test('should call onSubmit with buffer contents', async () => {
      const onSubmit = mock(() => {});
      render(<TestComponent onSubmit={onSubmit} />);

      await tick();

      const appendFn = (globalThis as Record<string, unknown>).__testAppend as (
        text: string
      ) => void;
      const flushFn = (globalThis as Record<string, unknown>).__testFlush as () => void;

      appendFn('hello world');
      await tick();
      flushFn();
      await tick();

      expect(onSubmit).toHaveBeenCalledWith('hello world');
    });

    test('should clear buffer after flush', async () => {
      const { lastFrame } = render(<TestComponent />);

      await tick();

      const appendFn = (globalThis as Record<string, unknown>).__testAppend as (
        text: string
      ) => void;
      const flushFn = (globalThis as Record<string, unknown>).__testFlush as () => void;

      appendFn('hello');
      await tick();
      flushFn();
      await tick();

      expect(lastFrame()).toContain('Buffer: ""');
      expect(lastFrame()).toContain('Empty: true');
    });

    test('should not call onSubmit if buffer is empty', async () => {
      const onSubmit = mock(() => {});
      render(<TestComponent onSubmit={onSubmit} />);

      await tick();

      const flushFn = (globalThis as Record<string, unknown>).__testFlush as () => void;
      flushFn();

      await tick();

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('buffering during streaming', () => {
    test('should buffer input while streaming', async () => {
      const onSubmit = mock(() => {});
      const { lastFrame } = render(<TestComponent initialIsStreaming={true} onSubmit={onSubmit} />);

      await tick();

      const appendFn = (globalThis as Record<string, unknown>).__testAppend as (
        text: string
      ) => void;
      appendFn('buffered input');

      await tick();

      // Buffer should hold the input
      expect(lastFrame()).toContain('Buffer: "buffered input"');
      expect(lastFrame()).toContain('Streaming: true');
    });

    test('should allow flushing even during streaming', async () => {
      const onSubmit = mock(() => {});
      render(<TestComponent initialIsStreaming={true} onSubmit={onSubmit} />);

      await tick();

      const appendFn = (globalThis as Record<string, unknown>).__testAppend as (
        text: string
      ) => void;
      const flushFn = (globalThis as Record<string, unknown>).__testFlush as () => void;

      appendFn('urgent');
      await tick();
      flushFn();
      await tick();

      expect(onSubmit).toHaveBeenCalledWith('urgent');
    });
  });

  describe('autoFlushOnPause', () => {
    test('should auto-flush when streaming stops', async () => {
      const onSubmit = mock(() => {});
      const { lastFrame } = render(<AutoFlushComponent onSubmit={onSubmit} />);

      await tick();

      // Append while streaming
      const appendFn = (globalThis as Record<string, unknown>).__testAppend as (
        text: string
      ) => void;
      appendFn('auto flush me');

      await tick();

      expect(lastFrame()).toContain('Buffer: "auto flush me"');
      expect(lastFrame()).toContain('Streaming: true');
      expect(onSubmit).not.toHaveBeenCalled();

      // Stop streaming - should auto-flush
      const setStreamingFn = (globalThis as Record<string, unknown>).__testSetStreaming as (
        s: boolean
      ) => void;
      setStreamingFn(false);

      await tick();

      expect(onSubmit).toHaveBeenCalledWith('auto flush me');
    });

    test('should not auto-flush if buffer is empty when streaming stops', async () => {
      const onSubmit = mock(() => {});
      render(<AutoFlushComponent onSubmit={onSubmit} />);

      await tick();

      // Don't append anything, just stop streaming
      const setStreamingFn = (globalThis as Record<string, unknown>).__testSetStreaming as (
        s: boolean
      ) => void;
      setStreamingFn(false);

      await tick();

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('isEmpty and length', () => {
    test('should track isEmpty correctly', async () => {
      const { lastFrame } = render(<TestComponent />);

      await tick();

      expect(lastFrame()).toContain('Empty: true');

      const appendFn = (globalThis as Record<string, unknown>).__testAppend as (
        text: string
      ) => void;
      appendFn('x');
      await tick();

      expect(lastFrame()).toContain('Empty: false');

      const clearFn = (globalThis as Record<string, unknown>).__testClear as () => void;
      clearFn();
      await tick();

      expect(lastFrame()).toContain('Empty: true');
    });

    test('should track length correctly', async () => {
      const { lastFrame } = render(<TestComponent />);

      await tick();

      const appendFn = (globalThis as Record<string, unknown>).__testAppend as (
        text: string
      ) => void;

      appendFn('abc');
      await tick();
      expect(lastFrame()).toContain('Length: 3');

      appendFn('de');
      await tick();
      expect(lastFrame()).toContain('Length: 5');
    });
  });
});
