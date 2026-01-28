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
} from './event-guards';

export interface OpencodeEvent {
  type: string;
  data?: unknown;
}

export class StreamAdapter {
  async *adaptStream(events: AsyncIterable<OpencodeEvent>): AsyncIterable<StreamChunk> {
    for await (const event of events) {
      const chunk = this.convertEvent(event);
      if (chunk) {
        yield chunk;
      }
    }
  }

  private convertEvent(event: OpencodeEvent): StreamChunk | null {
    const timestamp = new Date().toISOString();

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
      default:
        return null;
    }
  }

  private handleTextEvent(event: OpencodeEvent, timestamp: string): StreamChunk {
    const text = extractText(event.data);
    return {
      type: 'text',
      level: 'normal' as VerbosityLevel,
      content: text,
      timestamp,
    };
  }

  private handleToolStartEvent(event: OpencodeEvent, timestamp: string): StreamChunk {
    const toolName = extractToolName(event.data);
    const metadata: Record<string, unknown> = {};

    if (isToolEventData(event.data)) {
      Object.assign(metadata, event.data);
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
    const toolName = extractToolName(event.data);
    const metadata: Record<string, unknown> = {};

    if (isToolEventData(event.data)) {
      Object.assign(metadata, event.data);
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
    const status = extractStatus(event.data);
    return {
      type: 'status',
      level: 'normal' as VerbosityLevel,
      content: status,
      timestamp,
    };
  }

  private handleMessageUpdatedEvent(event: OpencodeEvent, timestamp: string): StreamChunk | null {
    if (!isMessageEventData(event.data)) return null;

    const metadata: Record<string, unknown> = {};

    if (event.data.tokens) {
      metadata.tokens = event.data.tokens;
    }

    if (typeof event.data.cost === 'number') {
      metadata.cost = event.data.cost;
    }

    if (typeof event.data.finish === 'string') {
      metadata.finish = event.data.finish;
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
      isErrorEventData(event.data) && typeof event.data.message === 'string'
        ? event.data.message
        : 'Unknown session error';

    const chunk: StreamChunk = {
      type: 'error',
      level: 'normal' as VerbosityLevel,
      content: errorMessage,
      timestamp,
    };

    if (isErrorEventData(event.data)) {
      chunk.metadata = event.data;
    }

    return chunk;
  }
}
