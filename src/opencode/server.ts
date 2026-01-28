import { createOpencodeServer } from '@opencode-ai/sdk';
import type { AgentConfig } from '@opencode-ai/sdk';
import { buildOpencodeAgents } from '../act/index.js';

export interface OpencodeServerConfig {
  port?: number;
  hostname?: string;
  timeout?: number;
}

export interface IServerManager {
  start(): Promise<void>;
  stop(): void;
  isRunning(): boolean;
  getPort(): number;
  getUrl(): string;
}

export class OpencodeServerManager implements IServerManager {
  private readonly config: Required<OpencodeServerConfig>;
  private server: { url: string; close(): void } | null = null;
  private running = false;

  constructor(config: OpencodeServerConfig = {}) {
    this.config = {
      port: config.port ?? 4096,
      hostname: config.hostname ?? '127.0.0.1',
      timeout: config.timeout ?? 5000,
    };
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Server is already running');
    }

    // Check if port is available before binding
    const portAvailable = await this.checkPortAvailable();
    if (!portAvailable) {
      throw new Error(
        `Port ${this.config.port} is already in use. Is another agentlint instance running?`
      );
    }

    this.server = await createOpencodeServer({
      port: this.config.port,
      hostname: this.config.hostname,
      timeout: this.config.timeout,
      config: {
        agent: buildOpencodeAgents() as Record<string, AgentConfig>,
      },
    });

    this.running = true;
  }

  stop(): void {
    if (!this.server || !this.running) {
      return;
    }

    const serverToClose = this.server;
    this.server = null;
    this.running = false;
    try {
      serverToClose.close();
    } catch {
      // Server close failure is non-fatal — process is shutting down
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getPort(): number {
    if (!this.server) {
      return this.config.port;
    }
    const url = new URL(this.server.url);
    return parseInt(url.port, 10);
  }

  getUrl(): string {
    if (!this.server) {
      throw new Error('Server is not running');
    }
    return this.server.url;
  }

  private async checkPortAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`http://${this.config.hostname}:${this.config.port}/health`, {
        signal: AbortSignal.timeout(1000),
      });
      // If we get a response, something is already listening
      return !response.ok;
    } catch {
      // Connection refused = port is available
      return true;
    }
  }
}
