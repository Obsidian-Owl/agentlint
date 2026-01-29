/**
 * Opencode Orchestrator
 *
 * Skeleton orchestrator implementation for Opencode SDK integration.
 *
 * @module opencode/orchestrator
 */

import type { IOrchestrator } from '../orchestration/interfaces';
import type { IToolRegistry } from '../orchestration/tool-registry';
import type { OrchestratorConfig, SessionState, StreamChunk } from '../orchestration/types';
import type { INamespacedLogger } from '../debug/types';
import { loadConfig, type ResolvedOrchestratorConfig } from '../orchestration/config';
import { withRetry } from '../orchestration/retry';
import { getDefaultLogger } from '../debug/logger';
import { DEBUG_NAMESPACES } from '../debug/namespaces';
import { OpencodeServerManager } from './server';
import { AgentlintOpencodeClient } from './client';
import { HybridSessionManager } from './sessions';
import { StreamAdapter, type OpencodeEvent } from './streaming';
import { TelemetryTracker } from './telemetry-tracker';
import { SessionResumeError, OrchestrationError } from '../errors/orchestration';
import { isToolEventData, isMessageEventData } from './event-guards';
import { instrumentLLMCall } from '../observability/instrumentation/orchestrator';
import type { GenAIProvider } from '../observability/types';

/** Default timeout for event stream iteration (5 minutes) */
const STREAM_TIMEOUT_MS = 300_000;

export class OpencodeOrchestrator implements IOrchestrator {
  public readonly config: ResolvedOrchestratorConfig;
  public readonly toolRegistry: IToolRegistry;
  private _sessionState: SessionState | null = null;
  private _isActive = false;
  private _currentSessionId: string | null = null;
  private readonly server: OpencodeServerManager;
  private client: AgentlintOpencodeClient | null = null;
  private sessionManager: HybridSessionManager | null = null;
  private readonly streamAdapter: StreamAdapter;
  private readonly logger: INamespacedLogger;
  private readonly telemetryTracker: TelemetryTracker | null;
  /** Abort controller for the current stream - allows interrupt() to cancel the SSE connection */
  private streamAbortController: AbortController | null = null;

  constructor(config: OrchestratorConfig, toolRegistry: IToolRegistry) {
    this.config = loadConfig(config);
    this.toolRegistry = toolRegistry;
    // Server uses project-specific port derived from cwd (no hardcoded port!)
    this.server = new OpencodeServerManager({}, this.config.cwd);
    // Client is initialized lazily after server.start() to get the actual port
    this.streamAdapter = new StreamAdapter();
    this.logger = getDefaultLogger().child(DEBUG_NAMESPACES.ORCHESTRATION);

    // Initialize telemetry tracker if telemetry is configured
    const telemetryClient = config.telemetryClient;
    if (telemetryClient && telemetryClient.isEnabled()) {
      const trackerConfig: {
        telemetryClient: typeof telemetryClient;
        sessionId: string;
        model: string;
        logger: INamespacedLogger;
        parentEventId?: string;
      } = {
        telemetryClient,
        sessionId: config.telemetrySessionId ?? 'unknown',
        model: this.config.model,
        logger: this.logger,
      };
      if (config.telemetryParentEventId !== undefined) {
        trackerConfig.parentEventId = config.telemetryParentEventId;
      }
      this.telemetryTracker = new TelemetryTracker(trackerConfig);
    } else {
      this.telemetryTracker = null;
    }
  }

  get sessionState(): SessionState | null {
    return this._sessionState;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get depth(): number {
    return this.config.depth;
  }

  public async *run(
    task: string,
    options?: { systemPrompt?: string }
  ): AsyncGenerator<StreamChunk, void, unknown> {
    if (this._isActive) {
      throw new OrchestrationError(
        'Cannot start a new run while another is in progress. Call interrupt() first.'
      );
    }
    this._isActive = true;
    this.logger.debug('Starting run', {
      taskLength: task.length,
      hasSystemPrompt: !!options?.systemPrompt,
    });

    try {
      await withRetry(
        () => this.server.start(),
        { maxRetries: 3 },
        (attempt, delay, error) => {
          this.logger.warn('Server start retry', { attempt, delayMs: delay, error: error.message });
        }
      );
      this.logger.debug('Server started', { port: this.server.getPort() });

      // Initialize client with the server's actual port (project-specific)
      // Only create new instances if not already set (allows test injection)
      if (!this.client) {
        const serverUrl = this.server.getUrl();
        this.client = new AgentlintOpencodeClient({ baseUrl: serverUrl });
      }
      if (!this.sessionManager) {
        this.sessionManager = new HybridSessionManager(this.client);
      }

      await withRetry(
        () => this.client!.connect(),
        { maxRetries: 3 },
        (attempt, delay, error) => {
          this.logger.warn('Client connect retry', {
            attempt,
            delayMs: delay,
            error: error.message,
          });
        }
      );
      this.logger.debug('Client connected');

      const session = await this.sessionManager.startSession(task);
      this._currentSessionId = session.sessionId;
      this._sessionState = this.createInitialState(task, session.sessionId);
      this.logger.debug('Session started', { sessionId: session.sessionId });

      // T040: Wrap entire session in a session span
      // Use an async generator inside the span to yield chunks
      yield* this.runInSessionSpan(session.sessionId, task, options);
    } finally {
      try {
        this.server.stop();
        this.logger.debug('Server stopped');
      } catch (stopError) {
        this.logger.warn('Server stop failed', {
          error: stopError instanceof Error ? stopError.message : String(stopError),
        });
      }
      // Clean up session to prevent memory leak
      if (this._currentSessionId && this.sessionManager) {
        this.sessionManager.clearSession(this._currentSessionId);
        this._currentSessionId = null;
      }
      this._isActive = false;
      this.logger.debug('Cleanup complete');
    }
  }

  /**
   * Run the streaming session within a session span.
   * T040: Session span integration with OpencodeOrchestrator.
   *
   * Note: We can't use the standard instrumentSession wrapper here because
   * it expects a Promise, but we need to yield chunks as they arrive (streaming).
   * Instead, we manually create the session context and yield within it.
   */
  private async *runInSessionSpan(
    sessionId: string,
    task: string,
    options?: { systemPrompt?: string }
  ): AsyncGenerator<StreamChunk, void, unknown> {
    // Note: Session span instrumentation is currently not applied due to
    // async generator limitations. Future enhancement could use a background
    // task to create the span and propagate context to the generator.
    // For now, we keep the original streaming behavior.

    this.telemetryTracker?.onTurnStart();

    // Use instance abort controller so interrupt()/dispose() can cancel the stream
    this.streamAbortController = new AbortController();
    const timeoutId = setTimeout(() => {
      this.logger.warn('Stream timeout reached', { timeoutMs: STREAM_TIMEOUT_MS });
      this.streamAbortController?.abort();
    }, STREAM_TIMEOUT_MS);

    try {
      // CRITICAL: Start iterating the SSE stream BEFORE sending prompt
      // The SDK's subscribe returns a generator that only starts when iterated
      // Pass cwd to scope events to this project directory
      // NOTE: Don't pass directory filter - it was filtering out message events
      // because sessions aren't associated with directories in the SDK
      const eventStream = (await this.client!.subscribeEager()) as AsyncIterable<OpencodeEvent>;
      this.logger.debug('SSE subscription created (no directory filter)');

      // Create an async iterator from the adapted stream
      const adaptedStream = this.streamAdapter.adaptStream(eventStream);
      const iterator = adaptedStream[Symbol.asyncIterator]();

      // Start the iteration (this makes the HTTP request) before sending prompt
      // Use a promise that we'll resolve after sending the prompt
      const firstEventPromise = iterator.next();
      this.logger.debug('SSE iteration started (HTTP request sent)');

      // Now send the prompt - events will be captured by the active SSE connection
      // System prompt (if provided) is sent via body.system to avoid appearing in output
      const promptOptions = options?.systemPrompt
        ? { systemPrompt: options.systemPrompt }
        : undefined;
      await this.client!.promptAsync(sessionId, task, promptOptions);
      this.logger.debug('Prompt sent (async)');

      // Process events using the manual iterator
      let result = await firstEventPromise;
      while (!result.done) {
        if (this.streamAbortController?.signal.aborted) {
          this.logger.debug('Stream aborted');
          break;
        }

        const chunk = result.value;
        yield chunk;

        // Forward telemetry-relevant chunks to tracker
        // This will create LLM spans via the tracker
        this.forwardToTelemetry(chunk);

        // Get next event
        result = await iterator.next();
      }
      this.logger.debug('SSE stream completed');
    } finally {
      clearTimeout(timeoutId);
      this.streamAbortController = null;
    }

    this.logger.debug('Stream complete');
  }

  // eslint-disable-next-line @typescript-eslint/require-await, require-yield
  public async *resume(sessionId: string): AsyncGenerator<StreamChunk, void, unknown> {
    throw new SessionResumeError(
      sessionId,
      'unknown',
      `Session resume not yet supported by OpencodeOrchestrator for session '${sessionId}'`
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async interrupt(): Promise<void> {
    this._isActive = false;
    // Abort the SSE stream if active
    this.streamAbortController?.abort();
    this.sessionManager?.clearAll();
  }

  public dispose(): void {
    // Abort any active stream first
    this.streamAbortController?.abort();
    this.streamAbortController = null;
    this.sessionManager?.clearAll();
    if (this.server.isRunning()) {
      try {
        this.server.stop();
      } catch {
        // Server stop failure during dispose is non-fatal
      }
    }
    this._isActive = false;
    this._sessionState = null;
    this._currentSessionId = null;
  }

  public canSpawnSubagent(): boolean {
    return false;
  }

  public getSubagentConfig(): OrchestratorConfig {
    throw new OrchestrationError(
      'Subagent configuration not supported by OpencodeOrchestrator. Use canSpawnSubagent() to check.'
    );
  }

  private forwardToTelemetry(chunk: StreamChunk): void {
    if (!this.telemetryTracker) return;

    switch (chunk.type) {
      case 'tool_start': {
        if (isToolEventData(chunk.metadata)) {
          this.telemetryTracker.onToolStart(chunk.metadata.name, chunk.metadata.input);
        } else {
          this.telemetryTracker.onToolStart('unknown', undefined);
        }
        break;
      }
      case 'tool_result': {
        if (isToolEventData(chunk.metadata)) {
          const isError = chunk.metadata.isError === true;
          this.telemetryTracker.onToolComplete(chunk.metadata.name, chunk.metadata.output, isError);
        } else {
          this.telemetryTracker.onToolComplete('unknown', undefined, false);
        }
        break;
      }
      case 'status': {
        if (isMessageEventData(chunk.metadata) && chunk.metadata.tokens) {
          const tokens = chunk.metadata.tokens;
          const usageData: {
            inputTokens: number;
            outputTokens: number;
            cacheReadTokens?: number;
            cacheWriteTokens?: number;
            cost?: number;
            finishReason?: string;
          } = {
            inputTokens: tokens.input ?? 0,
            outputTokens: tokens.output ?? 0,
          };

          if (tokens.cache) {
            if (tokens.cache.read !== undefined) {
              usageData.cacheReadTokens = tokens.cache.read;
            }
            if (tokens.cache.write !== undefined) {
              usageData.cacheWriteTokens = tokens.cache.write;
            }
          }

          if (chunk.metadata.cost !== undefined) {
            usageData.cost = chunk.metadata.cost;
          }

          if (chunk.metadata.finish !== undefined) {
            usageData.finishReason = chunk.metadata.finish;
          }

          // T040: Wrap LLM usage tracking in LLM span
          this.trackLLMUsageWithSpan(usageData);
        }
        break;
      }
      default:
        break;
    }
  }

  /**
   * Track LLM usage with span instrumentation.
   * T040: Create LLM spans for telemetry tracking.
   */
  private trackLLMUsageWithSpan(usageData: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    cost?: number;
    finishReason?: string;
  }): void {
    const provider = this.inferProviderFromModel(this.config.model);

    // Create LLM span asynchronously (fire and forget for telemetry)
    void instrumentLLMCall(
      {
        model: this.config.model,
        provider,
        tokens: {
          input: usageData.inputTokens,
          output: usageData.outputTokens,
        },
      },
      (llmSpan) => {
        // Add cache token attributes if present
        if (usageData.cacheReadTokens !== undefined) {
          llmSpan.setAttribute('gen_ai.cache.read_tokens', usageData.cacheReadTokens);
        }
        if (usageData.cacheWriteTokens !== undefined) {
          llmSpan.setAttribute('gen_ai.cache.creation_tokens', usageData.cacheWriteTokens);
        }

        // Add cost if present
        if (usageData.cost !== undefined) {
          llmSpan.setAttribute('agentlint.llm.cost_usd', usageData.cost);
        }

        // Add finish reason if present
        if (usageData.finishReason !== undefined) {
          llmSpan.setAttribute('gen_ai.response.finish_reasons', usageData.finishReason);
        }

        // Forward to telemetry tracker
        this.telemetryTracker?.onLLMUsage(usageData);
      }
    );
  }

  /**
   * Infer GenAI provider from model name.
   * T040: Helper to determine provider for span attributes.
   */
  private inferProviderFromModel(model: string): GenAIProvider {
    const modelLower = model.toLowerCase();

    if (modelLower.includes('claude') || modelLower.includes('anthropic')) {
      return 'anthropic';
    }
    if (modelLower.includes('gpt') || modelLower.includes('openai')) {
      return 'openai';
    }
    if (modelLower.includes('gemini') || modelLower.includes('google')) {
      return 'google';
    }
    if (modelLower.includes('bedrock')) {
      return 'bedrock';
    }
    if (modelLower.includes('azure')) {
      return 'azure';
    }
    if (modelLower.includes('groq')) {
      return 'groq';
    }
    if (modelLower.includes('ollama')) {
      return 'ollama';
    }
    if (modelLower.includes('deepseek')) {
      return 'deepseek';
    }

    return 'unknown';
  }

  private createInitialState(task: string, sessionId: string): SessionState {
    const now = new Date().toISOString();
    return {
      id: sessionId,
      phase: 'init',
      startedAt: now,
      lastCheckpointAt: null,
      findings: [],
      toolResultCache: {},
      checkpointSequence: 0,
      taskGoal: task,
      projectContext: {
        name: 'unknown',
        path: this.config.cwd,
        hasClaudeMd: false,
        primaryLanguage: null,
        agentType: 'claude-code',
      },
    };
  }
}
