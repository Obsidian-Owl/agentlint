/**
 * Opencode Orchestrator
 *
 * Skeleton orchestrator implementation for Opencode SDK integration.
 *
 * @module opencode/orchestrator
 */

import type { IOrchestrator } from '../orchestration/interfaces';
import type { IToolRegistry } from '../orchestration/tool-registry';
import type {
  OrchestratorConfig,
  SessionState,
  StreamChunk,
  VerbosityLevel,
} from '../orchestration/types';
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
  private readonly server: OpencodeServerManager;
  private readonly client: AgentlintOpencodeClient;
  private readonly sessionManager: HybridSessionManager;
  private readonly streamAdapter: StreamAdapter;
  private readonly logger: INamespacedLogger;
  private readonly telemetryTracker: TelemetryTracker | null;

  constructor(config: OrchestratorConfig, toolRegistry: IToolRegistry) {
    this.config = loadConfig(config);
    this.toolRegistry = toolRegistry;
    this.server = new OpencodeServerManager({ port: 4096 });
    this.client = new AgentlintOpencodeClient({ baseUrl: 'http://localhost:4096' });
    this.sessionManager = new HybridSessionManager(this.client);
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
      this.logger.debug('Server started');
      yield this.createChunk('status', 'normal', 'Server started');

      await withRetry(
        () => this.client.connect(),
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
      this._sessionState = this.createInitialState(task, session.sessionId);
      this.logger.debug('Session started', { sessionId: session.sessionId });

      await this.client.prompt(session.sessionId, task);

      this.telemetryTracker?.onTurnStart();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        this.logger.warn('Stream timeout reached', { timeoutMs: STREAM_TIMEOUT_MS });
        controller.abort();
      }, STREAM_TIMEOUT_MS);

      try {
        const events = this.client.subscribe() as AsyncIterable<OpencodeEvent>;
        for await (const chunk of this.streamAdapter.adaptStream(events)) {
          if (controller.signal.aborted) {
            this.logger.debug('Stream aborted due to timeout');
            break;
          }
          yield chunk;

          // Forward telemetry-relevant chunks to tracker
          this.forwardToTelemetry(chunk);
        }
      } finally {
        clearTimeout(timeoutId);
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

  private createChunk(
    type: StreamChunk['type'],
    level: VerbosityLevel,
    content: string,
    metadata?: Record<string, unknown>
  ): StreamChunk {
    const chunk: StreamChunk = {
      type,
      level,
      content,
      timestamp: new Date().toISOString(),
    };
    if (metadata) {
      chunk.metadata = metadata;
    }
    return chunk;
  }
}
