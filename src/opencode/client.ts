import { createOpencodeClient, type OpencodeClient as SDKClient } from '@opencode-ai/sdk';

export interface OpencodeClientConfig {
  baseUrl?: string;
}

export interface IOpencodeClient {
  connect(): Promise<void>;
  createSession(options: { title: string }): Promise<{ id: string }>;
  prompt(sessionId: string, message: string): Promise<string>;
  subscribe(): AsyncIterable<unknown>;
  isConnected(): boolean;
}

interface MessagePart {
  type: string;
  text?: string;
}

export class AgentlintOpencodeClient implements IOpencodeClient {
  private readonly config: Required<OpencodeClientConfig>;
  private client: SDKClient | null = null;
  private connected = false;

  constructor(config: OpencodeClientConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? 'http://localhost:4096',
    };
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    this.client = createOpencodeClient({ baseUrl: this.config.baseUrl });

    const response = await fetch(`${this.config.baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }

    this.connected = true;
  }

  async createSession(options: { title: string }): Promise<{ id: string }> {
    this.ensureConnected();

    if (!this.client) {
      throw new Error('Client is not initialized');
    }

    const result = await this.client.session.create({
      body: { title: options.title },
    });

    if (result.error) {
      const errorMsg: string =
        'message' in result.error ? String(result.error.message) : JSON.stringify(result.error);
      throw new Error(`Failed to create session: ${errorMsg}`);
    }

    return { id: result.data.id };
  }

  async prompt(sessionId: string, message: string): Promise<string> {
    this.ensureConnected();

    if (!this.client) {
      throw new Error('Client is not initialized');
    }

    const result = await this.client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: 'text', text: message }],
      },
    });

    if (result.error) {
      const errorMsg: string =
        'message' in result.error ? String(result.error.message) : JSON.stringify(result.error);
      throw new Error(`Prompt failed: ${errorMsg}`);
    }

    const textParts = (result.data.parts?.filter((p: MessagePart) => p.type === 'text') ??
      []) as MessagePart[];
    return textParts.map((p: MessagePart) => p.text ?? '').join('\n');
  }

  async *subscribe(): AsyncIterable<unknown> {
    this.ensureConnected();

    if (!this.client) {
      throw new Error('Client is not initialized');
    }

    const events = await this.client.event.subscribe();

    for await (const event of events.stream) {
      yield event;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  private ensureConnected(): void {
    if (!this.connected || !this.client) {
      throw new Error('Client is not connected. Call connect() first.');
    }
  }
}
