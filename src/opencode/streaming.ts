/**
 * Opencode SDK Migration - Streaming Adapter
 *
 * Converts Opencode SSE events to agentlint StreamChunk format.
 * Maintains compatibility with existing TUI components.
 *
 * @module opencode/streaming
 */

import type { StreamChunk, VerbosityLevel } from '../orchestration/types';

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
    const text = this.extractText(event.data);
    return {
      type: 'text',
      level: 'normal' as VerbosityLevel,
      content: text,
      timestamp,
    };
  }

  private handleToolStartEvent(event: OpencodeEvent, timestamp: string): StreamChunk {
    const toolName = this.extractToolName(event.data);
    return {
      type: 'tool_start',
      level: 'verbose' as VerbosityLevel,
      content: `Calling tool: ${toolName}`,
      timestamp,
      metadata: event.data as Record<string, unknown>,
    };
  }

  private handleToolResultEvent(event: OpencodeEvent, timestamp: string): StreamChunk {
    const toolName = this.extractToolName(event.data);
    const data = event.data as Record<string, unknown> | undefined;

    const metadata: Record<string, unknown> = { ...(data ?? {}) };

    // Extract timing data if present
    const time = data?.time as Record<string, unknown> | undefined;
    if (time) {
      metadata.time = time;
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
    const status = this.extractStatus(event.data);
    return {
      type: 'status',
      level: 'normal' as VerbosityLevel,
      content: status,
      timestamp,
    };
  }

  private handleMessageUpdatedEvent(event: OpencodeEvent, timestamp: string): StreamChunk | null {
    const data = event.data as Record<string, unknown> | undefined;
    if (!data) return null;

    const metadata: Record<string, unknown> = {};

    const tokens = data.tokens as Record<string, unknown> | undefined;
    if (tokens) {
      metadata.tokens = tokens;
    }

    if (typeof data.cost === 'number') {
      metadata.cost = data.cost;
    }

    if (typeof data.finish === 'string') {
      metadata.finish = data.finish;
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
    const data = event.data as Record<string, unknown> | undefined;
    const errorMessage =
      data && typeof data.message === 'string' ? data.message : 'Unknown session error';

    const chunk: StreamChunk = {
      type: 'error',
      level: 'normal' as VerbosityLevel,
      content: errorMessage,
      timestamp,
    };

    if (data) {
      chunk.metadata = data;
    }

    return chunk;
  }

  private extractText(data: unknown): string {
    if (data && typeof data === 'object' && 'text' in data) {
      return String((data as { text: unknown }).text);
    }
    return '';
  }

  private extractToolName(data: unknown): string {
    if (data && typeof data === 'object' && 'name' in data) {
      return String((data as { name: unknown }).name);
    }
    return 'unknown';
  }

  private extractStatus(data: unknown): string {
    if (data && typeof data === 'object' && 'status' in data) {
      return String((data as { status: unknown }).status);
    }
    return 'status update';
  }
}
