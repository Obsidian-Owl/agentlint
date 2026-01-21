/**
 * EP02 Orchestration Core - Orchestrator
 *
 * Main orchestration class that wraps the Claude Agent SDK's query() function.
 * Provides the master loop for agentlint analysis sessions.
 *
 * Implementation tasks:
 * - T024: Create Orchestrator class skeleton
 * - T025: Implement Orchestrator.run() wrapping SDK query()
 * - T026: Wire ToolRegistry into Orchestrator via mcpServers option
 *
 * @module orchestration/orchestrator
 */

import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { IToolRegistry } from './tool-registry';
import type { OrchestratorConfig, SessionState, StreamChunk, VerbosityLevel } from './types';
import { loadConfig, MAX_SUBAGENT_DEPTH } from './config';
import { SubagentDepthError } from '../errors';
import { buildACTSubagents } from '../act/index.js';
import { getDefaultLogger } from '../debug/logger';
import { DEBUG_NAMESPACES } from '../debug/namespaces';
import type { INamespacedLogger } from '../debug/types';

// =============================================================================
// IOrchestrator Interface
// =============================================================================

/**
 * Interface for the Orchestrator.
 */
export interface IOrchestrator {
  /** Current configuration (with defaults applied) */
  readonly config: Required<OrchestratorConfig>;

  /** Tool registry */
  readonly toolRegistry: IToolRegistry;

  /** Current session state (null if not running) */
  readonly sessionState: SessionState | null;

  /** Whether orchestrator is currently running */
  readonly isActive: boolean;

  /** Current subagent depth level (0 = main, 1 = subagent) */
  readonly depth: number;

  /**
   * Execute an analysis task
   * @param task - The task description/prompt
   * @returns AsyncGenerator yielding StreamChunks
   */
  run(task: string): AsyncGenerator<StreamChunk, void, unknown>;

  /**
   * Resume a previous session
   * @param sessionId - The session ID to resume
   * @returns AsyncGenerator yielding StreamChunks
   */
  resume(sessionId: string): AsyncGenerator<StreamChunk, void, unknown>;

  /**
   * Interrupt the current execution
   */
  interrupt(): Promise<void>;

  /**
   * Check if this orchestrator can spawn a subagent
   * @returns true if depth < MAX_SUBAGENT_DEPTH
   */
  canSpawnSubagent(): boolean;

  /**
   * Get configuration for spawning a subagent
   * @returns Config with incremented depth
   */
  getSubagentConfig(): OrchestratorConfig;
}

// =============================================================================
// Orchestrator Implementation
// =============================================================================

/**
 * Main orchestrator class for agentlint analysis sessions.
 *
 * Wraps the Claude Agent SDK's query() function with:
 * - Tool registration via ToolRegistry
 * - Streaming output via StreamChunk
 * - Session state management
 * - Checkpoint handling
 *
 * @example
 * ```typescript
 * const registry = new ToolRegistry();
 * registry.register(analyzeConfigTool);
 *
 * const orchestrator = new Orchestrator({ verbosity: 'verbose' }, registry);
 *
 * for await (const chunk of orchestrator.run('Analyze my CLAUDE.md')) {
 *   console.log(chunk.content);
 * }
 * ```
 */
export class Orchestrator implements IOrchestrator {
  /** Configuration with defaults applied */
  public readonly config: Required<OrchestratorConfig>;

  /** Tool registry reference */
  public readonly toolRegistry: IToolRegistry;

  /** Current session state */
  private _sessionState: SessionState | null = null;

  /** Whether currently executing */
  private _isActive = false;

  /** Abort controller for interruption */
  private abortController: AbortController | null = null;

  /** Debug logger for orchestration */
  private readonly logger: INamespacedLogger;

  /** Debug logger for LLM calls */
  private readonly llmLogger: INamespacedLogger;

  /**
   * Create a new Orchestrator.
   *
   * @param config - Configuration options (merged with defaults)
   * @param toolRegistry - Registry of tools available to the agent
   * @throws SubagentDepthError if depth exceeds MAX_SUBAGENT_DEPTH
   */
  constructor(config: OrchestratorConfig, toolRegistry: IToolRegistry) {
    this.config = loadConfig(config);
    this.toolRegistry = toolRegistry;
    this.logger = getDefaultLogger().child(DEBUG_NAMESPACES.ORCHESTRATION);
    this.llmLogger = getDefaultLogger().child(DEBUG_NAMESPACES.LLM);

    // Validate depth limit (T050)
    if (this.config.depth > MAX_SUBAGENT_DEPTH) {
      throw new SubagentDepthError(this.config.depth, MAX_SUBAGENT_DEPTH);
    }

    this.logger.debug('Orchestrator created', {
      model: this.config.model,
      depth: this.config.depth,
      verbosity: this.config.verbosity,
    });
  }

  /**
   * Get current session state.
   */
  get sessionState(): SessionState | null {
    return this._sessionState;
  }

  /**
   * Check if orchestrator is currently running.
   */
  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Get current subagent depth level.
   */
  get depth(): number {
    return this.config.depth;
  }

  /**
   * Check if this orchestrator can spawn a subagent.
   * Returns true if current depth is less than MAX_SUBAGENT_DEPTH.
   */
  canSpawnSubagent(): boolean {
    return this.config.depth < MAX_SUBAGENT_DEPTH;
  }

  /**
   * Get configuration for spawning a subagent.
   * Returns a copy of the current config with depth incremented.
   */
  getSubagentConfig(): OrchestratorConfig {
    return {
      ...this.config,
      depth: this.config.depth + 1,
    };
  }

  /**
   * Execute an analysis task.
   *
   * Wraps SDK's query() function and yields StreamChunks for each SDK message.
   *
   * @param task - The task description/prompt
   * @yields StreamChunk for each piece of output
   */
  async *run(task: string): AsyncGenerator<StreamChunk, void, unknown> {
    if (this._isActive) {
      throw new Error('Orchestrator is already running');
    }

    this._isActive = true;
    this.abortController = new AbortController();

    this.logger.info('Starting orchestrator run', { task: task.substring(0, 100) });

    try {
      // Initialize session state
      this._sessionState = this.createInitialState(task);

      this.logger.debug('Session initialized', {
        sessionId: this._sessionState.id,
        phase: this._sessionState.phase,
      });

      // Yield session start status (don't dump the full prompt)
      yield this.createChunk('status', 'normal', `Starting analysis...`);

      // Get MCP server from tool registry
      const mcpServer = this.toolRegistry.toMcpServer();

      // Build query options
      // SDK types don't perfectly align with runtime behavior - use any for interop
      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
      const queryOptions: any = {
        model: this.config.model,
        maxTurns: 100, // Reasonable default for analysis
        cwd: this.config.cwd, // Scope file access to this directory
        settingSources: this.config.settingSources,
        mcpServers: { agentlint: mcpServer },
        abortController: this.abortController,
        // T030-T031: ACT subagents for specialized analysis (EP08)
        agents: buildACTSubagents(),
        // T032: Include 'Task' in allowedTools to enable subagent invocation
        allowedTools: this.config.allowedTools,
        // Enable real-time streaming of agent text (AGE-662)
        includePartialMessages: true,
      };

      // Only add systemPrompt if we have custom content
      if (this.config.systemPromptAppend) {
        queryOptions.systemPrompt = {
          type: 'preset',
          preset: 'claude_code',
          append: this.config.systemPromptAppend,
        };
      }
      // Call SDK query() with our configuration
      // Note: Retry logic (AGE-665) is available via withRetry() but not applied here
      // since query() returns an AsyncIterable. Network errors during streaming
      // would need to be handled at a higher level or with SDK support.
      // eslint-disable-next-line @typescript-eslint/await-thenable, @typescript-eslint/no-unsafe-assignment
      const response = await query({
        prompt: task,
        options: queryOptions,
      });
      /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

      // Process SDK messages and yield StreamChunks
      for await (const message of response) {
        // Check for abort
        if (this.abortController?.signal.aborted) {
          yield this.createChunk('status', 'normal', 'Execution interrupted');
          break;
        }

        // Convert SDK message to StreamChunk(s)
        const chunks = this.processMessage(message);
        for (const chunk of chunks) {
          yield chunk;
        }
      }

      // Yield completion status
      this.logger.info('Analysis complete', {
        sessionId: this._sessionState?.id,
      });
      yield this.createChunk('status', 'normal', 'Analysis complete');
    } catch (error) {
      // Yield error chunk
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Analysis failed', { error: errorMessage });
      yield this.createChunk('error', 'quiet', `Error: ${errorMessage}`);
      throw error;
    } finally {
      this._isActive = false;
      this.abortController = null;
    }
  }

  /**
   * Resume a previous session.
   *
   * @param sessionId - The session ID to resume
   * @yields StreamChunk for each piece of output
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async *resume(sessionId: string): AsyncGenerator<StreamChunk, void, unknown> {
    // Placeholder for Phase 6 implementation (T045)
    yield this.createChunk('status', 'normal', `Resuming session: ${sessionId}`);

    // TODO: Load session state and resume with SDK's resume option
    yield this.createChunk('error', 'quiet', 'Resume not yet implemented (Phase 6)');
  }

  /**
   * Interrupt the current execution.
   * Async for interface compatibility - will use await in Phase 6 implementation.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async interrupt(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
    this._isActive = false;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Create initial session state.
   */
  private createInitialState(task: string): SessionState {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      phase: 'init',
      startedAt: now,
      lastCheckpointAt: null,
      findings: [],
      toolResultCache: {},
      checkpointSequence: 0,
      taskGoal: task,
      projectContext: {
        name: 'unknown', // Will be populated during execution
        path: this.config.cwd,
        hasClaudeMd: false, // Will be checked during execution
        primaryLanguage: null,
        agentType: 'claude-code',
      },
    };
  }

  /**
   * Create a StreamChunk.
   */
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

  /**
   * Process an SDK message into StreamChunks.
   *
   * This is a basic implementation - full processing in Phase 4 (T030-T032).
   */
  private processMessage(message: SDKMessage): StreamChunk[] {
    const chunks: StreamChunk[] = [];

    // Handle different message types
    // SDK messages have various structures depending on type - disable strict checks for interop
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
    const msg = message as any;

    // Handle stream_event for real-time streaming (AGE-662)
    if (msg.type === 'stream_event') {
      const event = msg.event;
      if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const text = event.delta.text as string;
        if (text) {
          chunks.push(this.createChunk('text', 'normal', text));
        }
      }
      return chunks;
    }

    if (msg.type === 'assistant' && msg.content) {
      // Assistant text content
      for (const block of msg.content) {
        if (block.type === 'text') {
          chunks.push(this.createChunk('text', 'normal', block.text));
        } else if (block.type === 'tool_use') {
          this.logger.info('Tool invocation', {
            tool: block.name,
            // Input may contain secrets, rely on redaction
          });
          chunks.push(
            this.createChunk('tool_start', 'verbose', `Calling tool: ${block.name}`, {
              toolName: block.name,
              input: block.input,
            })
          );
        }
      }
    } else if (msg.type === 'tool_result') {
      // Tool result
      this.logger.info('Tool completed', {
        toolId: msg.tool_use_id,
      });
      chunks.push(
        this.createChunk('tool_result', 'verbose', 'Tool completed', {
          toolId: msg.tool_use_id,
          result: msg.content,
        })
      );
    } else if (msg.type === 'result') {
      // Final result - also log LLM call metrics
      this.logger.info('Session result', {
        sessionId: msg.session_id,
        inputTokens: msg.input_tokens,
        outputTokens: msg.output_tokens,
      });
      this.llmLogger.info('LLM call completed', {
        model: this.config.model,
        inputTokens: msg.input_tokens,
        outputTokens: msg.output_tokens,
      });
      chunks.push(
        this.createChunk('status', 'normal', 'Session completed', {
          sessionId: msg.session_id,
          inputTokens: msg.input_tokens,
          outputTokens: msg.output_tokens,
        })
      );
    }
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

    return chunks;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new Orchestrator.
 *
 * @param config - Configuration options
 * @param toolRegistry - Tool registry
 * @returns A new Orchestrator instance
 */
export function createOrchestrator(
  config: OrchestratorConfig,
  toolRegistry: IToolRegistry
): IOrchestrator {
  return new Orchestrator(config, toolRegistry);
}
