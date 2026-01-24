/**
 * EP17 TUI Hooks - Stream Buffer
 *
 * Hook for buffering user input during agent streaming.
 * Input is captured while the agent is outputting, then
 * processed when streaming pauses or stops.
 *
 * @module tui/hooks/useStreamBuffer
 */

import { useState, useCallback, useEffect, useRef } from 'react';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for the useStreamBuffer hook.
 */
export interface StreamBufferOptions {
  /** Whether the agent is currently streaming output */
  isStreaming: boolean;
  /** Callback when input is submitted (flushed) */
  onSubmit?: (input: string) => void;
  /** Callback when buffer changes */
  onBufferChange?: (buffer: string) => void;
  /** Automatically flush buffer when streaming stops */
  autoFlushOnPause?: boolean;
}

/**
 * Return value of useStreamBuffer hook.
 */
export interface StreamBufferResult {
  /** Current buffer contents */
  buffer: string;
  /** Append text to the buffer */
  append: (text: string) => void;
  /** Clear the buffer without submitting */
  clear: () => void;
  /** Submit the buffer contents and clear */
  flush: () => void;
  /** Whether the buffer is empty */
  isEmpty: boolean;
  /** Current buffer length */
  length: number;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for buffering user input during streaming.
 *
 * While the agent is streaming output, user input is captured
 * in a buffer. When streaming pauses or the user explicitly
 * submits, the buffer is flushed.
 *
 * @example
 * ```tsx
 * const { buffer, append, flush, isEmpty } = useStreamBuffer({
 *   isStreaming: state.isStreaming,
 *   onSubmit: (input) => sendToAgent(input),
 *   autoFlushOnPause: true,
 * });
 *
 * // In input handler:
 * if (key.return && !isEmpty) {
 *   flush();
 * } else {
 *   append(input);
 * }
 * ```
 */
export function useStreamBuffer(options: StreamBufferOptions): StreamBufferResult {
  const { isStreaming, onSubmit, onBufferChange, autoFlushOnPause = false } = options;

  const [buffer, setBuffer] = useState('');

  // Track previous streaming state for auto-flush
  const wasStreamingRef = useRef(isStreaming);

  // Keep refs to current values to avoid stale closures
  const bufferRef = useRef(buffer);
  const onSubmitRef = useRef(onSubmit);
  const onBufferChangeRef = useRef(onBufferChange);

  // Update refs when values change
  bufferRef.current = buffer;
  onSubmitRef.current = onSubmit;
  onBufferChangeRef.current = onBufferChange;

  // Append text to the buffer
  const append = useCallback((text: string) => {
    setBuffer((prev) => {
      const newBuffer = prev + text;
      onBufferChangeRef.current?.(newBuffer);
      return newBuffer;
    });
  }, []);

  // Clear the buffer without submitting
  const clear = useCallback(() => {
    setBuffer('');
    onBufferChangeRef.current?.('');
  }, []);

  // Submit the buffer contents and clear
  const flush = useCallback(() => {
    const currentBuffer = bufferRef.current;
    if (currentBuffer.length === 0) {
      return;
    }

    onSubmitRef.current?.(currentBuffer);
    setBuffer('');
    onBufferChangeRef.current?.('');
  }, []);

  // Auto-flush when streaming stops (if enabled)
  useEffect(() => {
    if (autoFlushOnPause && wasStreamingRef.current && !isStreaming && buffer.length > 0) {
      onSubmitRef.current?.(buffer);
      setBuffer('');
      onBufferChangeRef.current?.('');
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, autoFlushOnPause, buffer]);

  return {
    buffer,
    append,
    clear,
    flush,
    isEmpty: buffer.length === 0,
    length: buffer.length,
  };
}

// =============================================================================
// Exports
// =============================================================================

export default useStreamBuffer;
