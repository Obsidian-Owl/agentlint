/**
 * Opencode Client Wrapper
 *
 * Wraps the Opencode SDK client with connection management, session creation,
 * and streaming capabilities.
 *
 * @module opencode/client
 */

export interface IOpencodeClient {
  connect(): Promise<void>;
  createSession(options: { title: string }): Promise<{ id: string }>;
  prompt(sessionId: string, message: string): Promise<string>;
  subscribe(sessionId: string): AsyncIterable<unknown>;
}

export class OpencodeClient implements IOpencodeClient {
  async connect(): Promise<void> {
    throw new Error('Not implemented - T03');
  }

  async createSession(_options: { title: string }): Promise<{ id: string }> {
    throw new Error('Not implemented - T03');
  }

  async prompt(_sessionId: string, _message: string): Promise<string> {
    throw new Error('Not implemented - T03');
  }

  async *subscribe(_sessionId: string): AsyncIterable<unknown> {
    throw new Error('Not implemented - T03');
  }
}
