import { createOpencodeServer } from '@opencode-ai/sdk';

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

    this.server = await createOpencodeServer({
      port: this.config.port,
      hostname: this.config.hostname,
      timeout: this.config.timeout,
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
    serverToClose.close();
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
}
