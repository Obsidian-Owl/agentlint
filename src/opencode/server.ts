/**
 * Opencode Server Lifecycle Manager
 *
 * Manages the lifecycle of the Opencode server process, including startup,
 * shutdown, health checks, and crash recovery.
 *
 * @module opencode/server
 */

export interface IServerManager {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

export class OpencodeServerManager implements IServerManager {
  async start(): Promise<void> {
    throw new Error('Not implemented - T02');
  }

  async stop(): Promise<void> {
    throw new Error('Not implemented - T02');
  }

  isRunning(): boolean {
    throw new Error('Not implemented - T02');
  }
}
