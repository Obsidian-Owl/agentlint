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

import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { IToolRegistry } from './tool-registry';
import type {
  OrchestratorConfig,
  SessionState,
  StreamChunk,
  VerbosityLevel,
  IOrchestratorTelemetryClient,
} from './types';
import { loadConfig, MAX_SUBAGENT_DEPTH, type ResolvedOrchestratorConfig } from './config';
import { SubagentDepthError } from '../errors';
import { buildACTSubagents } from '../act/index.js';
import { getDefaultLogger } from '../debug/logger';
import { DEBUG_NAMESPACES } from '../debug/namespaces';
import { createCanUseToolCallback } from './can-use-tool';
import type { INamespacedLogger } from '../debug/types';

// =============================================================================
// IOrchestrator Interface
// =============================================================================

/**
 * Interface for the Orchestrator.
 */
export interface IOrchestrator {
  /** Current configuration (with defaults applied) */
  readonly config: ResolvedOrchestratorConfig;

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
  public readonly config: ResolvedOrchestratorConfig;

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

  /** Map toolId -> toolName for correlating tool_result with tool_start */
  private readonly toolIdToName = new Map<string, string>();

  /** Map toolId -> start time for duration calculation */
  private readonly toolStartTimes = new Map<string, number>();

  /** Map toolId -> tool input arguments for telemetry */
  private readonly toolInputs = new Map<string, Record<string, unknown>>();

  /** Maximum pending tool entries to prevent unbounded memory growth */
  private static readonly MAX_PENDING_TOOLS = 100;

  /** Maximum time to keep orphaned tool tracking entries (5 minutes) */
  private static readonly TOOL_TRACKING_TTL_MS = 5 * 60 * 1000;

  /** Telemetry client (if provided) */
  private readonly telemetry: IOrchestratorTelemetryClient | null;

  /** Telemetry session ID for event correlation */
  private readonly telemetrySessionId: string | undefined;

  /** Parent event ID for trace hierarchy */
  private readonly telemetryParentEventId: string | undefined;

  /** Turn counter for LLM tracking */
  private turnCount = 0;

  /** Start time of current turn for latency tracking */
  private turnStartTime: number | null = null;

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

    // Initialize telemetry from config
    this.telemetry = config.telemetryClient ?? null;
    this.telemetrySessionId = config.telemetrySessionId;
    this.telemetryParentEventId = config.telemetryParentEventId;

    // Validate depth limit (T050)
    if (this.config.depth > MAX_SUBAGENT_DEPTH) {
      throw new SubagentDepthError(this.config.depth, MAX_SUBAGENT_DEPTH);
    }

    this.logger.debug('Orchestrator created', {
      model: this.config.model,
      depth: this.config.depth,
      verbosity: this.config.verbosity,
      telemetryEnabled: this.telemetry?.isEnabled() ?? false,
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

      // ADR-0021: Create canUseTool callback for human-in-the-loop interactions
      // Use custom canUseTool from config if provided (e.g., TuiPermissionHandler),
      // otherwise fall back to the default readline-based handler
      const canUseTool =
        this.config.canUseTool ??
        createCanUseToolCallback({
          nonInteractive: this.config.nonInteractive,
          verbose: this.config.verbosity === 'verbose' || this.config.verbosity === 'debug',
          log: (msg) => this.logger.debug(msg),
        });

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
        // ADR-0021: Enable human-in-the-loop via canUseTool callback
        canUseTool,
        // Path to Claude Code CLI - required for bundled builds where the SDK's
        // relative path resolution breaks (it defaults to finding cli.js relative
        // to the SDK's location, which in bundled builds points to our own CLI)
        pathToClaudeCodeExecutable: this.resolveClaudeCodePath(),
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

        // DEBUG: Log all message types to understand SDK message flow
        if (process.env['AGENTLINT_TELEMETRY_DEBUG'] === '1') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          const msgType = (message as any).type;
          console.error(`[ORCH DEBUG] msg.type=${String(msgType)}`);
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
   * Truncate tool output for telemetry to prevent excessive payload sizes.
   * Handles strings, objects, and arrays.
   *
   * @param output - Raw tool output
   * @param maxLength - Maximum length in characters (default 5000)
   * @returns Truncated output suitable for telemetry
   */
  private truncateToolOutput(output: unknown, maxLength = 5000): unknown {
    if (output === null || output === undefined) {
      return output;
    }

    // Handle strings
    if (typeof output === 'string') {
      if (output.length <= maxLength) {
        return output;
      }
      return output.slice(0, maxLength) + '... [truncated]';
    }

    // Handle arrays - truncate long arrays
    if (Array.isArray(output)) {
      const stringified = JSON.stringify(output);
      if (stringified.length <= maxLength) {
        return output;
      }
      // Return first few items with truncation notice
      const truncated = output.slice(0, 3);
      return {
        items: truncated,
        _truncated: true,
        _totalItems: output.length,
      };
    }

    // Handle objects - stringify and truncate
    if (typeof output === 'object') {
      const stringified = JSON.stringify(output);
      if (stringified.length <= maxLength) {
        return output;
      }
      return {
        _summary: stringified.slice(0, maxLength) + '... [truncated]',
        _truncated: true,
      };
    }

    // Return primitives as-is
    return output;
  }

  /**
   * Truncate tool input for telemetry to prevent excessive payload sizes.
   * Mirrors the output truncation pattern for consistency.
   *
   * @param input - Raw tool input
   * @param maxLength - Maximum length in characters (default 5000)
   * @returns Truncated input suitable for telemetry
   */
  private truncateToolInput(
    input: Record<string, unknown>,
    maxLength = 5000
  ): Record<string, unknown> {
    const stringified = JSON.stringify(input);

    if (stringified.length <= maxLength) {
      return input;
    }

    const truncated: Record<string, unknown> = {};
    let currentLength = 2; // Account for {}

    for (const [key, value] of Object.entries(input)) {
      const valueStr = JSON.stringify(value);

      if (currentLength + key.length + valueStr.length + 4 > maxLength) {
        // Truncate large string values, mark others as truncated
        if (typeof value === 'string' && value.length > 100) {
          truncated[key] = value.slice(0, 100) + '... [truncated]';
        } else {
          truncated[key] = '[truncated]';
        }
      } else {
        truncated[key] = value;
        currentLength += key.length + valueStr.length + 4;
      }
    }

    truncated._inputTruncated = true;
    truncated._originalSize = stringified.length;

    return truncated;
  }

  /**
   * Store tool input with bounds checking.
   * Evicts oldest entry if map exceeds MAX_PENDING_TOOLS.
   *
   * @param toolId - The tool use ID
   * @param input - The tool input to store (will be truncated)
   */
  private storeToolInput(toolId: string, input: Record<string, unknown>): void {
    // Evict oldest entry if at capacity
    if (this.toolInputs.size >= Orchestrator.MAX_PENDING_TOOLS) {
      const firstKey = this.toolInputs.keys().next().value;
      if (firstKey) {
        this.toolInputs.delete(firstKey);
      }
    }

    // Truncate and store
    const truncatedInput = this.truncateToolInput(input);
    this.toolInputs.set(toolId, truncatedInput);
  }

  /**
   * Clean up orphaned tool tracking entries older than TTL.
   * Called before adding new tool entries to prevent memory leaks
   * when tool execution fails without a tool_result message.
   */
  private cleanupOrphanedToolEntries(): void {
    const now = Date.now();
    const ttl = Orchestrator.TOOL_TRACKING_TTL_MS;

    for (const [toolId, startTime] of this.toolStartTimes) {
      if (now - startTime > ttl) {
        this.toolIdToName.delete(toolId);
        this.toolStartTimes.delete(toolId);
        this.toolInputs.delete(toolId);
        this.logger.debug('Cleaned up orphaned tool entry', { toolId, ageMs: now - startTime });
      }
    }
  }

  /**
   * Extract error message from tool output.
   * Handles various error formats from SDK.
   *
   * @param output - Raw tool output (usually error content)
   * @returns Extracted error message string
   */
  private extractErrorMessage(output: unknown): string | undefined {
    if (typeof output === 'string') {
      return output.slice(0, 500); // Limit error message length
    }

    if (Array.isArray(output) && output.length > 0) {
      // SDK often returns array with text content blocks
      const firstBlock = output[0] as unknown;
      if (typeof firstBlock === 'object' && firstBlock !== null && 'text' in firstBlock) {
        const textBlock = firstBlock as { text: unknown };
        return String(textBlock.text).slice(0, 500);
      }
      if (typeof firstBlock === 'string') {
        return firstBlock.slice(0, 500);
      }
    }

    if (typeof output === 'object' && output !== null) {
      // Try common error fields
      const obj = output as Record<string, unknown>;
      if ('message' in obj && typeof obj.message === 'string') {
        return obj.message.slice(0, 500);
      }
      if ('error' in obj && typeof obj.error === 'string') {
        return obj.error.slice(0, 500);
      }
      if ('text' in obj && typeof obj.text === 'string') {
        return obj.text.slice(0, 500);
      }
    }

    return undefined;
  }

  /**
   * Resolve the path to Claude Code executable.
   *
   * Search order:
   * 1. CLAUDE_CODE_PATH environment variable
   * 2. Common installation locations (macOS, Linux)
   * 3. PATH lookup via `which claude`
   *
   * @returns Path to Claude Code executable
   * @throws Error if Claude Code is not found
   */
  private resolveClaudeCodePath(): string {
    // 1. Environment variable override
    const envPath = process.env['CLAUDE_CODE_PATH'];
    if (envPath && existsSync(envPath)) {
      return envPath;
    }

    // 2. Common installation locations
    const home = homedir();
    const commonPaths = [
      join(home, '.local', 'bin', 'claude'), // npm global install
      join(home, '.claude', 'local', 'claude'), // native installer
      '/usr/local/bin/claude', // system-wide
      '/opt/homebrew/bin/claude', // Homebrew on Apple Silicon
      '/usr/bin/claude', // Linux system
    ];

    for (const p of commonPaths) {
      if (existsSync(p)) {
        return p;
      }
    }

    // 3. PATH lookup
    try {
      const whichResult = execSync('which claude', { encoding: 'utf-8' }).trim();
      if (whichResult && existsSync(whichResult)) {
        return whichResult;
      }
    } catch {
      // `which` failed, continue to error
    }

    // Not found - provide helpful error
    throw new Error(
      'Claude Code CLI not found. Please install Claude Code or set CLAUDE_CODE_PATH environment variable.\n' +
        'Install: https://claude.ai/download'
    );
  }

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
        // Skip empty or whitespace-only text chunks to reduce noise (AGE-671)
        if (text && text.trim()) {
          chunks.push(this.createChunk('text', 'normal', text));
        }
      }
      // Also detect tool_use blocks starting in stream events
      if (event?.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
        const toolBlock = event.content_block;
        this.logger.info('Tool invocation starting (stream)', { tool: toolBlock.name });
        // Clean up orphaned entries before adding new ones (P2 memory leak fix)
        this.cleanupOrphanedToolEntries();
        // Track toolId -> toolName for later correlation with tool_result
        this.toolIdToName.set(toolBlock.id, toolBlock.name);
        // Track start time for duration calculation
        this.toolStartTimes.set(toolBlock.id, Date.now());
        // Track tool input arguments for telemetry (may be populated in subsequent delta events)
        const toolInput = (toolBlock.input as Record<string, unknown>) ?? {};
        this.storeToolInput(toolBlock.id, toolInput);
        chunks.push(
          this.createChunk('tool_start', 'verbose', `Calling tool: ${toolBlock.name}`, {
            toolName: toolBlock.name,
            toolId: toolBlock.id,
            arguments: toolInput, // Include arguments in chunk metadata
          })
        );
      }

      // Track turn start for LLM latency
      if (event?.type === 'message_start') {
        this.turnCount++;
        this.turnStartTime = Date.now();
        this.logger.debug('LLM turn starting', { turn: this.turnCount });
      }

      return chunks;
    }

    if (msg.type === 'assistant' && msg.message?.content) {
      // Assistant message - content is inside msg.message per SDK types
      // Text and tool_use blocks are already emitted via stream events (content_block_delta
      // and content_block_start). We only log here for debugging, don't emit duplicate chunks.
      this.logger.debug('Processing assistant message', {
        blockCount: msg.message.content?.length ?? 0,
      });
      for (const block of msg.message.content) {
        if (block.type === 'text') {
          // Text already emitted via content_block_delta stream events (AGE-672)
          this.logger.debug('Text block in assistant message (already emitted via stream)', {
            length: block.text.length,
          });
        } else if (block.type === 'tool_use') {
          // Tool_use blocks are already emitted via content_block_start stream events
          // But the FULL input is only available here (stream sends input incrementally)
          // Update the toolInputs map with the complete input for telemetry
          if (block.id && block.input) {
            this.storeToolInput(block.id, block.input as Record<string, unknown>);
            this.logger.debug('Tool input captured from assistant message', {
              tool: block.name,
              inputKeys: Object.keys(block.input as Record<string, unknown>),
            });
          }
        } else {
          this.logger.debug('Unknown block type', { blockType: block.type });
        }
      }
    } else if (msg.type === 'user') {
      // User messages may contain tool results
      // The SDK sends tool results as user messages with content array
      const content = msg.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_result') {
            const toolId = block.tool_use_id;
            const toolName = this.toolIdToName.get(toolId);
            const startTime = this.toolStartTimes.get(toolId);
            const toolInput = this.toolInputs.get(toolId);
            const endTime = Date.now();
            const durationMs = startTime ? endTime - startTime : 0;

            // Extract tool output (truncate if too large for telemetry)
            const rawOutput = block.content;
            const toolOutput = this.truncateToolOutput(rawOutput, 5000);

            // Extract error message if tool failed
            const errorMessage = block.is_error ? this.extractErrorMessage(rawOutput) : undefined;

            this.logger.info('Tool completed (from user message)', {
              toolId,
              toolName,
              durationMs,
            });

            // Direct telemetry tracking (more reliable than chunk observation)
            if (this.telemetry?.isEnabled() && this.telemetrySessionId && toolName) {
              // Build options object, only including optional fields when defined
              // (exactOptionalPropertyTypes compliance)
              const trackOptions: Parameters<NonNullable<typeof this.telemetry.trackToolEx>>[1] = {
                tool: toolName,
                durationMs,
                success: !block.is_error,
                endTime,
              };
              if (startTime !== undefined) trackOptions.startTime = startTime;
              if (this.telemetryParentEventId)
                trackOptions.parentEventId = this.telemetryParentEventId;
              if (toolInput) trackOptions.toolInput = toolInput;
              if (toolOutput !== undefined) trackOptions.toolOutput = toolOutput;
              if (errorMessage) trackOptions.errorMessage = errorMessage;
              this.telemetry.trackToolEx?.(this.telemetrySessionId, trackOptions);
            }

            chunks.push(
              this.createChunk('tool_result', 'verbose', 'Tool completed', {
                toolId,
                toolName,
                durationMs,
                result: block.content,
              })
            );
            // Clean up mappings to prevent memory growth
            this.toolIdToName.delete(toolId);
            this.toolStartTimes.delete(toolId);
            this.toolInputs.delete(toolId);
          }
        }
      }
    } else if (msg.type === 'tool_result') {
      // Legacy path: Tool result as direct message type (may not be used by SDK)
      const toolId = msg.tool_use_id;
      const toolName = this.toolIdToName.get(toolId);
      const startTime = this.toolStartTimes.get(toolId);
      const toolInput = this.toolInputs.get(toolId);
      const endTime = Date.now();
      const durationMs = startTime ? endTime - startTime : 0;

      // Extract tool output (truncate if too large for telemetry)
      const rawOutput = msg.content;
      const toolOutput = this.truncateToolOutput(rawOutput, 5000);

      // Extract error message if tool failed
      const errorMessage = msg.is_error ? this.extractErrorMessage(rawOutput) : undefined;

      this.logger.info('Tool completed', {
        toolId,
        toolName,
        durationMs,
      });

      // Direct telemetry tracking (more reliable than chunk observation)
      if (this.telemetry?.isEnabled() && this.telemetrySessionId && toolName) {
        // Build options object, only including optional fields when defined
        // (exactOptionalPropertyTypes compliance)
        const trackOptions: Parameters<NonNullable<typeof this.telemetry.trackToolEx>>[1] = {
          tool: toolName,
          durationMs,
          success: !msg.is_error,
          endTime,
        };
        if (startTime !== undefined) trackOptions.startTime = startTime;
        if (this.telemetryParentEventId) trackOptions.parentEventId = this.telemetryParentEventId;
        if (toolInput) trackOptions.toolInput = toolInput;
        if (toolOutput !== undefined) trackOptions.toolOutput = toolOutput;
        if (errorMessage) trackOptions.errorMessage = errorMessage;
        this.telemetry.trackToolEx?.(this.telemetrySessionId, trackOptions);
      }

      chunks.push(
        this.createChunk('tool_result', 'verbose', 'Tool completed', {
          toolId,
          toolName, // Include for CLI rendering
          durationMs,
          result: msg.content,
        })
      );
      // Clean up mappings to prevent memory growth
      this.toolIdToName.delete(toolId);
      this.toolStartTimes.delete(toolId);
      this.toolInputs.delete(toolId);

      // Check for clarifying questions in tool result (human-in-the-loop)
      // Tool results may be a JSON string or an object with clarifyingQuestions
      const toolContent = msg.content;
      if (toolContent && typeof toolContent === 'object' && 'clarifyingQuestions' in toolContent) {
        const questions = (toolContent as { clarifyingQuestions?: unknown[] }).clarifyingQuestions;
        if (Array.isArray(questions) && questions.length > 0) {
          this.logger.info('Clarifying questions detected', { count: questions.length });
          chunks.push(
            this.createChunk('user_question', 'normal', 'Agent has questions for you', {
              questions,
              toolId: msg.tool_use_id,
            })
          );
        }
      }
    } else if (msg.type === 'tool_progress') {
      // Real-time progress for long-running tools
      this.logger.debug('Tool progress', {
        tool: msg.tool_name,
        elapsed: msg.elapsed_time_seconds,
      });
      chunks.push(
        this.createChunk(
          'tool_start',
          'verbose',
          `Tool running: ${msg.tool_name} (${msg.elapsed_time_seconds}s)`,
          {
            toolName: msg.tool_name,
            toolId: msg.tool_use_id,
            elapsedSeconds: msg.elapsed_time_seconds,
          }
        )
      );
    } else if (msg.type === 'result') {
      // Final result - also log LLM call metrics
      const endTime = Date.now();
      const inputTokens = msg.input_tokens as number;
      const outputTokens = msg.output_tokens as number;
      const latencyMs = msg.duration_api_ms as number | undefined;
      // Extract stop_reason if available (SDK may provide this)
      const stopReason = (msg as Record<string, unknown>).stop_reason as string | undefined;
      // Extract cache tokens if available (prompt caching)
      const cacheReadTokens = (msg as Record<string, unknown>).cache_read_input_tokens as
        | number
        | undefined;
      const cacheCreationTokens = (msg as Record<string, unknown>).cache_creation_input_tokens as
        | number
        | undefined;

      this.logger.info('Session result', {
        sessionId: msg.session_id,
        inputTokens,
        outputTokens,
        stopReason,
        cacheReadTokens,
        cacheCreationTokens,
      });
      this.llmLogger.info('LLM call completed', {
        model: this.config.model,
        inputTokens,
        outputTokens,
        latencyMs,
        stopReason,
        cacheReadTokens,
        cacheCreationTokens,
      });

      // Direct telemetry tracking for LLM usage
      // Include model config parameters for HoneyHive observability
      if (this.telemetry?.isEnabled() && this.telemetrySessionId) {
        // Extract config with type assertion for optional fields
        const configWithOptionals = this.config as Record<string, unknown>;

        // Build options object, only including optional fields when defined
        // (exactOptionalPropertyTypes compliance)
        const llmOptions: Parameters<NonNullable<typeof this.telemetry.trackLLMEx>>[1] = {
          model: this.config.model,
          inputTokens,
          outputTokens,
          startTime: this.turnStartTime ?? endTime - (latencyMs ?? 0),
          endTime,
          provider: 'anthropic',
        };
        if (latencyMs !== undefined) llmOptions.latencyMs = latencyMs;
        if (this.telemetryParentEventId) llmOptions.parentEventId = this.telemetryParentEventId;
        // Model parameters from config (if set)
        const configTemp = configWithOptionals.temperature as number | undefined;
        const configMaxTokens = configWithOptionals.maxTokens as number | undefined;
        if (configTemp !== undefined) llmOptions.temperature = configTemp;
        if (configMaxTokens !== undefined) llmOptions.maxTokens = configMaxTokens;
        // Stop reason from result
        if (stopReason) llmOptions.stopReason = stopReason;
        // Cache tokens (prompt caching)
        if (cacheReadTokens !== undefined) llmOptions.cacheReadTokens = cacheReadTokens;
        if (cacheCreationTokens !== undefined) llmOptions.cacheCreationTokens = cacheCreationTokens;
        this.telemetry.trackLLMEx?.(this.telemetrySessionId, llmOptions);
      }

      chunks.push(
        this.createChunk('status', 'normal', 'Session completed', {
          sessionId: msg.session_id,
          inputTokens,
          outputTokens,
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
