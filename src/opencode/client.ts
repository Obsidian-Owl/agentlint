import { createOpencodeClient, type OpencodeClient as SDKClient } from '@opencode-ai/sdk';

export interface OpencodeClientConfig {
  baseUrl?: string;
}

export interface PromptOptions {
  /** The user message content */
  message: string;
  /** Optional system prompt (sent via body.system, not shown to user) */
  systemPrompt?: string;
}

export interface IOpencodeClient {
  connect(): Promise<void>;
  createSession(options: { title: string }): Promise<{ id: string }>;
  prompt(sessionId: string, message: string): Promise<string>;
  promptAsync(
    sessionId: string,
    message: string,
    options?: { systemPrompt?: string }
  ): Promise<void>;
  subscribe(): AsyncIterable<unknown>;
  subscribeEager(): Promise<AsyncIterable<unknown>>;
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

  /**
   * Send a prompt asynchronously without blocking.
   * Returns immediately after sending the message.
   * Events are delivered via the subscribe() SSE stream.
   *
   * @param sessionId - The session ID to send the prompt to
   * @param message - The user message content
   * @param options - Optional settings including systemPrompt
   */
  async promptAsync(
    sessionId: string,
    message: string,
    options?: { systemPrompt?: string }
  ): Promise<void> {
    this.ensureConnected();

    if (!this.client) {
      throw new Error('Client is not initialized');
    }

    // Build the request body with optional system prompt
    const body: {
      parts: Array<{ type: 'text'; text: string }>;
      system?: string;
    } = {
      parts: [{ type: 'text' as const, text: message }],
    };

    // Add system prompt if provided (SDK uses body.system)
    if (options?.systemPrompt) {
      body.system = options.systemPrompt;
    }

    const result = await this.client.session.promptAsync({
      path: { id: sessionId },
      body,
    });

    if (result.error) {
      const errorMsg: string =
        'message' in result.error ? String(result.error.message) : JSON.stringify(result.error);
      throw new Error(`Prompt async failed: ${errorMsg}`);
    }
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

  /**
   * Establish SSE connection and return the event stream.
   * Unlike subscribe(), this eagerly connects and returns the stream object.
   * Use this when you need to ensure connection before sending a prompt.
   */
  async subscribeEager(): Promise<AsyncIterable<unknown>> {
    this.ensureConnected();

    if (!this.client) {
      throw new Error('Client is not initialized');
    }

    const events = await this.client.event.subscribe();
    return events.stream;
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
