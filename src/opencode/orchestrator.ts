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

  public async *run(task: string): AsyncGenerator<StreamChunk, void, unknown> {
    if (this._isActive) {
      throw new OrchestrationError(
        'Cannot start a new run while another is in progress. Call interrupt() first.'
      );
    }
    this._isActive = true;
    this.logger.debug('Starting run', { taskLength: task.length });

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

      this.telemetryTracker?.onTurnStart();

      // Use instance abort controller so interrupt()/dispose() can cancel the stream
      this.streamAbortController = new AbortController();
      const timeoutId = setTimeout(() => {
        this.logger.warn('Stream timeout reached', { timeoutMs: STREAM_TIMEOUT_MS });
        this.streamAbortController?.abort();
      }, STREAM_TIMEOUT_MS);

      try {
        // CRITICAL: Establish SSE connection BEFORE sending prompt
        // subscribeEager() awaits the connection, unlike subscribe() which is lazy
        const events = (await this.client.subscribeEager()) as AsyncIterable<OpencodeEvent>;
        this.logger.debug('SSE connection established');

        // Send prompt asynchronously (doesn't block, returns immediately)
        // Events will be captured by the SSE connection we just established
        await this.client.promptAsync(session.sessionId, task);
        this.logger.debug('Prompt sent (async)');

        // Now iterate over events - this establishes the SSE connection
        // and processes events as they arrive
        for await (const chunk of this.streamAdapter.adaptStream(events)) {
          if (this.streamAbortController?.signal.aborted) {
            this.logger.debug('Stream aborted');
            break;
          }
          yield chunk;

          // Forward telemetry-relevant chunks to tracker
          this.forwardToTelemetry(chunk);
        }
      } finally {
        clearTimeout(timeoutId);
        this.streamAbortController = null;
      }

      this.logger.debug('Stream complete');
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

          this.telemetryTracker.onLLMUsage(usageData);
        }
        break;
      }
      default:
        break;
    }
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
