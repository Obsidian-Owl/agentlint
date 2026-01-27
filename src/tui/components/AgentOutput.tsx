/**
 * EP17 TUI Components - Agent Output
 *
 * Displays streaming agent output with markdown rendering.
 *
 * @module tui/components/AgentOutput
 */

import React, { memo, useMemo } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { AgentOutputProps } from '../types';
import type { StreamChunk } from '../../orchestration/types';
import { renderMarkdown } from '../utils/markdown';
import { ToolPhaseRenderer, type ToolPhase } from './ToolPhaseRenderer';

// =============================================================================
// Chunk Renderer
// =============================================================================

function deriveToolPhase(chunk: StreamChunk, chunks: StreamChunk[], index: number): ToolPhase {
  if (chunk.type === 'tool_result') {
    return 'complete';
  }
  const toolId = chunk.metadata?.toolId as string | undefined;
  if (toolId) {
    const hasResult = chunks
      .slice(index + 1)
      .some((c) => c.type === 'tool_result' && c.metadata?.toolId === toolId);
    if (hasResult) {
      return 'complete';
    }
  }
  return 'running';
}

interface ChunkRendererProps {
  chunk: StreamChunk;
  phase: ToolPhase | null;
}

const ChunkRenderer = memo(function ChunkRenderer({
  chunk,
  phase,
}: ChunkRendererProps): React.ReactElement {
  const { type, content, level } = chunk;

  if (type === 'tool_start' && phase) {
    return <ToolPhaseRenderer chunk={chunk} phase={phase} />;
  }

  if (type === 'tool_result') {
    return <ToolPhaseRenderer chunk={chunk} phase="complete" />;
  }

  if (!content || content.trim() === '') {
    return <Text> </Text>;
  }

  const rendered = useMemo(() => renderMarkdown(content), [content]);

  switch (type) {
    case 'error':
      return (
        <Text color="red" bold>
          {content}
        </Text>
      );

    case 'status':
      return (
        <Text color="blue" italic>
          {content}
        </Text>
      );

    case 'text':
    default:
      if (level === 'verbose') {
        return <Text dimColor>{rendered}</Text>;
      }
      return <Text wrap="wrap">{rendered}</Text>;
  }
});

// =============================================================================
// Component
// =============================================================================

/**
 * Agent output display component.
 *
 * Renders streaming chunks from the agent with:
 * - Text, status, and error styling
 * - Streaming indicator when active
 * - Markdown-like formatting (basic)
 *
 * @example
 * ```tsx
 * <AgentOutput chunks={state.streamBuffer} isStreaming={state.isStreaming} />
 * ```
 */
export function AgentOutput({ chunks, isStreaming }: AgentOutputProps): React.ReactElement {
  const chunkPhases = useMemo(() => {
    return chunks.map((chunk, index) => {
      if (chunk.type === 'tool_start') {
        return deriveToolPhase(chunk, chunks, index);
      }
      return null;
    });
  }, [chunks]);

  return (
    <Box flexDirection="column">
      {chunks.map((chunk, index) => (
        <Box key={`${chunk.timestamp}-${chunk.type}-${index}`} marginBottom={1}>
          <ChunkRenderer chunk={chunk} phase={chunkPhases[index] ?? null} />
        </Box>
      ))}
      {isStreaming && (
        <Box>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text color="cyan" dimColor>
            {' '}
            thinking...
          </Text>
        </Box>
      )}
    </Box>
  );
}

// =============================================================================
// Exports
// =============================================================================

export default AgentOutput;
