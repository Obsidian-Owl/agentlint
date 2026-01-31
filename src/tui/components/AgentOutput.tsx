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
 * Consolidate consecutive text chunks into groups.
 * This prevents line breaks between small streaming deltas.
 */
interface ChunkGroup {
  type: 'text' | 'other';
  chunks: StreamChunk[];
  startIndex: number;
}

function groupConsecutiveTextChunks(chunks: StreamChunk[]): ChunkGroup[] {
  const groups: ChunkGroup[] = [];
  let currentTextGroup: StreamChunk[] = [];
  let textGroupStartIndex = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    if (chunk.type === 'text') {
      if (currentTextGroup.length === 0) {
        textGroupStartIndex = i;
      }
      currentTextGroup.push(chunk);
    } else {
      // Flush any accumulated text group
      if (currentTextGroup.length > 0) {
        groups.push({ type: 'text', chunks: currentTextGroup, startIndex: textGroupStartIndex });
        currentTextGroup = [];
      }
      // Add the non-text chunk as its own group
      groups.push({ type: 'other', chunks: [chunk], startIndex: i });
    }
  }

  // Flush remaining text group
  if (currentTextGroup.length > 0) {
    groups.push({ type: 'text', chunks: currentTextGroup, startIndex: textGroupStartIndex });
  }

  return groups;
}

/**
 * Agent output display component.
 *
 * Renders streaming chunks from the agent with:
 * - Text, status, and error styling
 * - Streaming indicator when active
 * - Markdown-like formatting (basic)
 * - Consolidated consecutive text chunks (no line breaks between deltas)
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

  // Group consecutive text chunks to render them together without margins
  const chunkGroups = useMemo(() => groupConsecutiveTextChunks(chunks), [chunks]);

  return (
    <Box flexDirection="column">
      {chunkGroups.map((group) => {
        if (group.type === 'text' && group.chunks.length > 0) {
          // Render all text chunks in a single Box without margins between them
          const combinedContent = group.chunks.map((c) => c.content).join('');
          const firstChunk = group.chunks[0]!;
          return (
            <Box key={`text-group-${group.startIndex}`} marginBottom={1}>
              <ChunkRenderer chunk={{ ...firstChunk, content: combinedContent }} phase={null} />
            </Box>
          );
        } else if (group.chunks.length > 0) {
          // Non-text chunks render individually
          const chunk = group.chunks[0]!;
          return (
            <Box key={`${chunk.timestamp}-${chunk.type}-${group.startIndex}`} marginBottom={1}>
              <ChunkRenderer chunk={chunk} phase={chunkPhases[group.startIndex] ?? null} />
            </Box>
          );
        }
        return null;
      })}
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
