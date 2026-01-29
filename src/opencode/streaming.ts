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
  properties?: unknown;
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
    const text = extractText(event.properties);
    return {
      type: 'text',
      level: 'normal' as VerbosityLevel,
      content: text,
      timestamp,
    };
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
}
