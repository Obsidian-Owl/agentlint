/**
 * EP17 TUI Components - Agent Output
 *
 * Displays streaming agent output with markdown rendering.
 *
 * @module tui/components/AgentOutput
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { AgentOutputProps } from '../types';
import type { StreamChunk } from '../../orchestration/types';
import { renderMarkdown } from '../utils/markdown';

// =============================================================================
// Chunk Renderer
// =============================================================================

interface ChunkRendererProps {
  chunk: StreamChunk;
}

function ChunkRenderer({ chunk }: ChunkRendererProps): React.ReactElement {
  const { type, content, level } = chunk;

  // Handle empty content
  if (!content || content.trim() === '') {
    return <Text> </Text>;
  }

  // Determine styling based on chunk type
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
        return <Text dimColor>{renderMarkdown(content)}</Text>;
      }
      return <Text wrap="wrap">{renderMarkdown(content)}</Text>;
  }
}

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
  return (
    <Box flexDirection="column">
      {chunks.map((chunk, index) => (
        <Box key={`${chunk.timestamp}-${chunk.type}-${index}`} marginBottom={1}>
          <ChunkRenderer chunk={chunk} />
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
