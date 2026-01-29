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
  /**
   * Track accumulated text per part ID to calculate deltas.
   * The Opencode SDK sends COMPLETE accumulated text in each event,
   * not incremental deltas.
   */
  private partTextState: Map<string, string> = new Map();

  async *adaptStream(events: AsyncIterable<OpencodeEvent>): AsyncIterable<StreamChunk> {
    console.error('[SSE DEBUG] Starting to iterate event stream');
    let eventCount = 0;
    for await (const event of events) {
      eventCount++;
      console.error(`[SSE DEBUG] Received event #${eventCount}: type=${event.type}`);
      const chunk = this.convertEvent(event);
      if (chunk) {
        console.error(
          `[SSE DEBUG] Yielding chunk: type=${chunk.type}, content length=${chunk.content.length}`
        );
        yield chunk;
      } else {
        console.error(`[SSE DEBUG] Event converted to null, skipping`);
      }
    }
    console.error(`[SSE DEBUG] Stream iteration complete, total events: ${eventCount}`);
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

  private handleTextEvent(event: OpencodeEvent, timestamp: string): StreamChunk | null {
    // Extract part ID and full accumulated text
    const partId = this.extractPartId(event.properties) ?? 'default';
    const fullText = extractText(event.properties);
    const previousText = this.partTextState.get(partId) ?? '';

    // Calculate delta - only the NEW text
    const delta = fullText.startsWith(previousText)
      ? fullText.slice(previousText.length)
      : fullText;

    // Update state
    this.partTextState.set(partId, fullText);

    // Skip if no new content
    if (!delta) return null;

    return {
      type: 'text',
      level: 'normal' as VerbosityLevel,
      content: delta,
      timestamp,
    };
  }

  /**
   * Extract part ID from event properties for tracking text state.
   * SDK structure: { part: { id?: string } }
   */
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
}
