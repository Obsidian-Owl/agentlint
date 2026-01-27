/**
 * Opencode Server Lifecycle Manager
 *
 * Manages the lifecycle of the Opencode server process, including startup,
 * shutdown, health checks, and crash recovery.
 *
 * @module opencode/server
 */

/**
 * Configuration for OpencodeServerManager
 */
export interface OpencodeServerConfig {
  port?: number;
  healthCheckUrl?: string;
  healthCheckIntervalMs?: number;
  maxRetries?: number;
}

/**
 * Interface for managing Opencode server lifecycle
 */
export interface IServerManager {
  /**
   * Start the Opencode server
   */
  start(): Promise<void>;

  /**
   * Stop the Opencode server
   */
  stop(): Promise<void>;

  /**
   * Check if the server is currently running
   */
  isRunning(): boolean;

  /**
   * Get the port the server is running on
   */
  getPort(): number;
}

/**
 * Manages the lifecycle of the Opencode server process
 *
 * Handles startup, shutdown, health checks, and crash recovery.
 */
export class OpencodeServerManager implements IServerManager {
  private readonly config: OpencodeServerConfig;

  constructor(config: OpencodeServerConfig = {}) {
    this.config = {
      port: 4096,
      healthCheckUrl: 'http://localhost:4096/health',
      healthCheckIntervalMs: 5000,
      maxRetries: 3,
      ...config,
    };
    // Config will be used in T02b-c implementation
    void this.config;
  }

  async start(): Promise<void> {
    return Promise.reject(new Error('Not implemented - will be added in T02b-c'));
  }

  async stop(): Promise<void> {
    return Promise.reject(new Error('Not implemented - will be added in T02b-c'));
  }

  isRunning(): boolean {
    throw new Error('Not implemented - will be added in T02b-c');
  }

  getPort(): number {
    throw new Error('Not implemented - will be added in T02b-c');
  }
}
