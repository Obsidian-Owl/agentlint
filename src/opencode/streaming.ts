/**
 * Opencode SDK Migration - Streaming Adapter
 *
 * Converts Opencode SSE events to agentlint StreamChunk format.
 * Maintains compatibility with existing TUI components.
 *
 * @module opencode/streaming
 */

import type { StreamChunk, VerbosityLevel } from '../orchestration/types';
import {
  isToolEventData,
  isMessageEventData,
  isErrorEventData,
  extractToolName,
  extractText,
  extractStatus,
  extractPartType,
} from './event-guards';
import { createDebugLogger } from '../debug/logger.js';
import { DEBUG_NAMESPACES } from '../debug/namespaces.js';
import { traceContextProvider } from '../observability/trace-context';
import {
  recordFirstToken,
  recordStreamComplete,
  type StreamStats,
} from '../observability/instrumentation/streaming';
import { spanFactory } from '../observability/span-factory';

export interface OpencodeEvent {
  type: string;
  properties?: unknown;
}

/**
 * Patterns for oh-my-claudecode injected mode blocks that should be filtered.
 * These are injected by user's global hooks and shouldn't appear in agentlint output.
 */
const OMC_MODE_PATTERNS = [
  /\[(analyze-mode|search-mode|ultrawork-mode|think-mode)\][^]*?(?:\n---\n|\n<\/\1>)/gi,
  /<(analyze-mode|search-mode|ultrawork-mode|think-mode)>[^]*?<\/\1>/gi,
  /\[(analyze-mode|search-mode|ultrawork-mode|think-mode)\]\n/gi,
];

export class StreamAdapter {
  private partTextState: Map<string, string> = new Map();

  private readonly logger = createDebugLogger({
    namespaces: [DEBUG_NAMESPACES.STREAMING],
  }).child(DEBUG_NAMESPACES.STREAMING);

  private filterOMCModeBlocks(text: string): string {
    let filtered = text;
    for (const pattern of OMC_MODE_PATTERNS) {
      filtered = filtered.replace(pattern, '');
    }
    return filtered;
  }

  async *adaptStream(events: AsyncIterable<OpencodeEvent>): AsyncIterable<StreamChunk> {
    const streamId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const context = traceContextProvider.getContext();

    if (!context) {
      for await (const event of events) {
        const chunk = this.convertEvent(event);
        if (chunk) {
          yield chunk;
        }
      }
      return;
    }

    yield* this.instrumentedStream(streamId, events);
  }

  private async *instrumentedStream(
    streamId: string,
    events: AsyncIterable<OpencodeEvent>
  ): AsyncIterable<StreamChunk> {
    const chunks: StreamChunk[] = [];
    let chunkCount = 0;
    const streamStartTime = Date.now();
    let firstTokenTime: number | undefined;

    // Consume all events and collect chunks
    for await (const event of events) {
      const chunk = this.convertEvent(event);
      if (chunk) {
        // Track first token timing
        if (chunk.type === 'text' && firstTokenTime === undefined) {
          firstTokenTime = Date.now();
        }
        if (chunk.type === 'text') {
          chunkCount++;
        }
        chunks.push(chunk);
      }
    }

    // T042, T043, T044: Create stream span and record events
    await spanFactory.createStreamSpan({ streamId }, (span): Promise<void> => {
      // T043: Record first_token event when first chunk was received
      if (firstTokenTime !== undefined) {
        recordFirstToken(span, firstTokenTime - streamStartTime);
      }

      // T044: Record stream_complete event with chunk count
      const stats: StreamStats = {
        chunkCount,
        durationMs: Date.now() - streamStartTime,
      };
      recordStreamComplete(span, stats);

      return Promise.resolve();
    });

    // Yield all collected chunks
    for (const chunk of chunks) {
      yield chunk;
    }
  }

  private convertEvent(event: OpencodeEvent): StreamChunk | null {
    const timestamp = new Date().toISOString();
    this.logger.debug('SSE event received', { type: event.type });

    switch (event.type) {
      case 'message.part.updated':
        return this.handleTextEvent(event, timestamp);
      case 'tool.call.started':
        return this.handleToolStartEvent(event, timestamp);
      case 'tool.call.completed':
        return this.handleToolResultEvent(event, timestamp);
      case 'status.updated':
        return this.handleStatusEvent(event, timestamp);
      case 'message.updated':
        return this.handleMessageUpdatedEvent(event, timestamp);
      case 'session.error':
        return this.handleSessionErrorEvent(event, timestamp);
      case 'question.asked':
        return this.handleQuestionAskedEvent(event, timestamp);
      default:
        return null;
    }
  }

  private handleTextEvent(event: OpencodeEvent, timestamp: string): StreamChunk | null {
    const partType = extractPartType(event.properties);

    if (partType === 'reasoning' || partType === 'thinking') {
      return null;
    }

    const partId = this.extractPartId(event.properties) ?? 'default';
    const fullText = extractText(event.properties);
    const previousText = this.partTextState.get(partId) ?? '';

    let delta = fullText.startsWith(previousText) ? fullText.slice(previousText.length) : fullText;

    this.partTextState.set(partId, fullText);

    delta = this.filterOMCModeBlocks(delta);

    this.logger.debug('Text delta', { partId, deltaLength: delta.length });

    if (!delta || !delta.trim()) return null;

    return {
      type: 'text',
      level: 'normal' as VerbosityLevel,
      content: delta,
      timestamp,
    };
  }

  private extractPartId(data: unknown): string | null {
    if (typeof data !== 'object' || data === null) return null;
    const obj = data as Record<string, unknown>;
    if (obj.part && typeof obj.part === 'object') {
      const part = obj.part as Record<string, unknown>;
      return typeof part.id === 'string' ? part.id : null;
    }
    return null;
  }

  private handleToolStartEvent(event: OpencodeEvent, timestamp: string): StreamChunk {
    const props = event.properties;
    const toolName = extractToolName(props);
    const metadata: Record<string, unknown> = {};

    if (isToolEventData(props)) {
      metadata.name = props.name;
      if (props.input !== undefined) {
        metadata.input = props.input;
      }
      if (props.output !== undefined) {
        metadata.output = props.output;
      }
      if (props.isError !== undefined) {
        metadata.isError = props.isError;
      }
    }

    return {
      type: 'tool_start',
      level: 'verbose' as VerbosityLevel,
      content: `Calling tool: ${toolName}`,
      timestamp,
      metadata,
    };
  }

  private handleToolResultEvent(event: OpencodeEvent, timestamp: string): StreamChunk {
    const props = event.properties;
    const toolName = extractToolName(props);
    const metadata: Record<string, unknown> = {};

    if (isToolEventData(props)) {
      metadata.name = props.name;
      if (props.input !== undefined) {
        metadata.input = props.input;
      }
      if (props.output !== undefined) {
        metadata.output = props.output;
      }
      if (props.isError !== undefined) {
        metadata.isError = props.isError;
      }
    }

    return {
      type: 'tool_result',
      level: 'verbose' as VerbosityLevel,
      content: `Tool completed: ${toolName}`,
      timestamp,
      metadata,
    };
  }

  private handleStatusEvent(event: OpencodeEvent, timestamp: string): StreamChunk {
    const status = extractStatus(event.properties);
    return {
      type: 'status',
      level: 'normal' as VerbosityLevel,
      content: status,
      timestamp,
    };
  }

  private handleMessageUpdatedEvent(event: OpencodeEvent, timestamp: string): StreamChunk | null {
    if (!isMessageEventData(event.properties)) return null;

    const metadata: Record<string, unknown> = {};

    if (event.properties.tokens) {
      metadata.tokens = event.properties.tokens;
    }

    if (typeof event.properties.cost === 'number') {
      metadata.cost = event.properties.cost;
    }

    if (typeof event.properties.finish === 'string') {
      metadata.finish = event.properties.finish;
    }

    if (Object.keys(metadata).length === 0) return null;

    return {
      type: 'status',
      level: 'verbose' as VerbosityLevel,
      content: 'message updated',
      timestamp,
      metadata,
    };
  }

  private handleSessionErrorEvent(event: OpencodeEvent, timestamp: string): StreamChunk {
    const errorMessage =
      isErrorEventData(event.properties) && typeof event.properties.message === 'string'
        ? event.properties.message
        : 'Unknown session error';

    const chunk: StreamChunk = {
      type: 'error',
      level: 'normal' as VerbosityLevel,
      content: errorMessage,
      timestamp,
    };

    if (isErrorEventData(event.properties)) {
      chunk.metadata = {};
      if (typeof event.properties.message === 'string') {
        chunk.metadata.message = event.properties.message;
      }
    }

    return chunk;
  }

  private handleQuestionAskedEvent(event: OpencodeEvent, timestamp: string): StreamChunk {
    const props = event.properties as
      | {
          id?: string;
          sessionID?: string;
          questions?: Array<{
            question: string;
            header: string;
            options: Array<{ label: string; description: string }>;
            multiple?: boolean;
            custom?: boolean;
          }>;
        }
      | undefined;

    const requestId = props?.id ?? '';
    const sessionId = props?.sessionID ?? '';
    const questions = props?.questions ?? [];
    const firstQuestion = questions[0];

    this.logger.debug('Question asked', { requestId, questionCount: questions.length });

    return {
      type: 'user_question',
      level: 'normal' as VerbosityLevel,
      content: firstQuestion?.question ?? 'Question from agent',
      timestamp,
      metadata: {
        requestId,
        sessionId,
        questions: questions.map((q) => ({
          question: q.question,
          header: q.header,
          options: q.options,
          multiSelect: q.multiple ?? false,
        })),
      },
    };
  }
}
