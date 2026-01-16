/**
 * EP02 Orchestration Core - Streaming
 *
 * Stream processing for SDK message to StreamChunk conversion.
 * Handles verbosity filtering and output formatting.
 *
 * Implementation tasks:
 * - T030: Create IStreamProcessor interface
 * - T031: Implement StreamProcessor.process()
 * - T032: Implement filterByVerbosity() helper
 *
 * @module orchestration/streaming
 */

import type { StreamChunk, StreamChunkType, VerbosityLevel } from './types';

// =============================================================================
// Verbosity Level Ordering
// =============================================================================

/**
 * Numeric ordering of verbosity levels for comparison.
 * Lower numbers = less verbose, higher numbers = more verbose.
 */
const VERBOSITY_ORDER: Record<VerbosityLevel, number> = {
  quiet: 0,
  normal: 1,
  verbose: 2,
  debug: 3,
};

// =============================================================================
// IStreamProcessor Interface (T030)
// =============================================================================

/**
 * Interface for processing SDK messages into StreamChunks.
 */
export interface IStreamProcessor {
  /**
   * Process an SDK message into StreamChunks.
   * @param message - The SDK message to process
   * @returns Array of StreamChunks (may be empty for unknown message types)
   */
  process(message: unknown): StreamChunk[];
}

// =============================================================================
// StreamProcessor Implementation (T031)
// =============================================================================

/**
 * Processes SDK messages into StreamChunks for display.
 *
 * Handles various SDK message types:
 * - assistant: Text and tool_use content blocks
 * - tool_result: Results from tool invocations
 * - result: Final session result with metrics
 *
 * @example
 * ```typescript
 * const processor = new StreamProcessor();
 *
 * for await (const message of sdkResponse) {
 *   const chunks = processor.process(message);
 *   for (const chunk of chunks) {
 *     console.log(`[${chunk.type}] ${chunk.content}`);
 *   }
 * }
 * ```
 */
export class StreamProcessor implements IStreamProcessor {
  /**
   * Process an SDK message into StreamChunks.
   *
   * @param message - The SDK message to process
   * @returns Array of StreamChunks extracted from the message
   */
  process(message: unknown): StreamChunk[] {
    const chunks: StreamChunk[] = [];

    // SDK messages have various structures - use type guard pattern
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
    const msg = message as any;

    if (msg.type === 'assistant' && msg.content) {
      // Process content blocks from assistant message
      for (const block of msg.content) {
        if (block.type === 'text') {
          chunks.push(createStreamChunk('text', 'normal', block.text as string));
        } else if (block.type === 'tool_use') {
          const toolName = block.name as string;
          chunks.push(
            createStreamChunk('tool_start', 'verbose', `Calling tool: ${toolName}`, {
              toolName,
              input: block.input,
            })
          );
        }
      }
    } else if (msg.type === 'tool_result') {
      // Tool result message
      chunks.push(
        createStreamChunk('tool_result', 'verbose', 'Tool completed', {
          toolId: msg.tool_use_id as string,
          result: msg.content,
        })
      );
    } else if (msg.type === 'result') {
      // Final session result
      chunks.push(
        createStreamChunk('status', 'normal', 'Session completed', {
          sessionId: msg.session_id as string,
          inputTokens: msg.input_tokens as number,
          outputTokens: msg.output_tokens as number,
        })
      );
    }
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

    return chunks;
  }
}

// =============================================================================
// Verbosity Filtering (T032)
// =============================================================================

/**
 * Filter chunks by verbosity level.
 *
 * Chunks with a level at or below the threshold are included.
 * For example, at 'normal' verbosity, 'quiet' and 'normal' chunks are shown,
 * but 'verbose' and 'debug' chunks are filtered out.
 *
 * @param chunks - Array of chunks to filter
 * @param verbosity - Maximum verbosity level to include
 * @returns Filtered array of chunks
 *
 * @example
 * ```typescript
 * const allChunks = processor.process(message);
 * const visibleChunks = filterByVerbosity(allChunks, 'normal');
 * ```
 */
export function filterByVerbosity(chunks: StreamChunk[], verbosity: VerbosityLevel): StreamChunk[] {
  return chunks.filter((chunk) => shouldDisplay(chunk.level, verbosity));
}

/**
 * Check if a chunk should be displayed at a given verbosity level.
 *
 * @param chunkLevel - The chunk's verbosity level
 * @param displayLevel - The current display verbosity setting
 * @returns True if the chunk should be displayed
 *
 * @example
 * ```typescript
 * if (shouldDisplay(chunk.level, config.verbosity)) {
 *   console.log(chunk.content);
 * }
 * ```
 */
export function shouldDisplay(chunkLevel: VerbosityLevel, displayLevel: VerbosityLevel): boolean {
  return VERBOSITY_ORDER[chunkLevel] <= VERBOSITY_ORDER[displayLevel];
}

// =============================================================================
// Chunk Creation Helper
// =============================================================================

/**
 * Create a StreamChunk with the current timestamp.
 *
 * @param type - Type of the chunk
 * @param level - Verbosity level of the chunk
 * @param content - Content of the chunk
 * @param metadata - Optional additional metadata
 * @returns A new StreamChunk
 *
 * @example
 * ```typescript
 * const chunk = createStreamChunk('finding', 'normal', 'Found config issue', {
 *   findingId: 'F001',
 *   severity: 'high',
 * });
 * ```
 */
export function createStreamChunk(
  type: StreamChunkType,
  level: VerbosityLevel,
  content: string,
  metadata?: Record<string, unknown>
): StreamChunk {
  const chunk: StreamChunk = {
    type,
    level,
    content,
    timestamp: new Date().toISOString(),
  };

  if (metadata) {
    chunk.metadata = metadata;
  }

  return chunk;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new StreamProcessor instance.
 *
 * @returns A new StreamProcessor
 */
export function createStreamProcessor(): IStreamProcessor {
  return new StreamProcessor();
}
