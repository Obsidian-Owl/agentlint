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
import { loadConfig, type ResolvedOrchestratorConfig } from '../orchestration/config';
import { OpencodeServerManager } from './server';
import { AgentlintOpencodeClient } from './client';
import { HybridSessionManager } from './sessions';
import { StreamAdapter, type OpencodeEvent } from './streaming';

export class OpencodeOrchestrator implements IOrchestrator {
  public readonly config: ResolvedOrchestratorConfig;
  public readonly toolRegistry: IToolRegistry;
  private _sessionState: SessionState | null = null;
  private _isActive = false;
  private readonly server: OpencodeServerManager;
  private readonly client: AgentlintOpencodeClient;
  private readonly sessionManager: HybridSessionManager;
  private readonly streamAdapter: StreamAdapter;

  constructor(config: OrchestratorConfig, toolRegistry: IToolRegistry) {
    this.config = loadConfig(config);
    this.toolRegistry = toolRegistry;
    this.server = new OpencodeServerManager({ port: 4096 });
    this.client = new AgentlintOpencodeClient({ baseUrl: 'http://localhost:4096' });
    this.sessionManager = new HybridSessionManager(this.client);
    this.streamAdapter = new StreamAdapter();
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

    try {
      await this.server.start();
      yield this.createChunk('status', 'normal', 'Server started');

      await this.client.connect();

      const session = await this.sessionManager.startSession(task);
      this._sessionState = this.createInitialState(task, session.sessionId);

      await this.client.prompt(session.sessionId, task);

      const events = this.client.subscribe() as AsyncIterable<OpencodeEvent>;
      for await (const chunk of this.streamAdapter.adaptStream(events)) {
        yield chunk;
      }
    } finally {
      this._isActive = false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await, require-yield
  public async *resume(sessionId: string): AsyncGenerator<StreamChunk, void, unknown> {
    void sessionId;
    throw new Error('Not implemented - will be added in next step');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async interrupt(): Promise<void> {
    throw new Error('Not implemented - will be added in next step');
  }

  public canSpawnSubagent(): boolean {
    return false;
  }

  public getSubagentConfig(): OrchestratorConfig {
    throw new Error('Not implemented - will be added in next step');
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
