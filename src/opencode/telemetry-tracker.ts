/**
 * Opencode Telemetry Tracker
 *
 * Encapsulated telemetry tracking for the Opencode orchestrator.
 * Tracks tool executions and LLM usage, dispatching to the telemetry client.
 * Uses FIFO queue per tool name for correlation (Opencode SDK has no toolId).
 *
 * @module opencode/telemetry-tracker
 */

import type { IOrchestratorTelemetryClient } from '../orchestration/types';
import type { INamespacedLogger } from '../debug/types';
import type { GenAIProvider } from '../observability/types';
import {
  truncateToolOutput,
  truncateToolInput,
  extractErrorMessage,
} from '../orchestration/telemetry-utils';
import { redact } from '../debug/redaction';
import { MAX_PENDING_TOOLS, TOOL_TRACKING_TTL_MS } from '../telemetry/constants';
import { traceContextProvider } from '../observability/trace-context';
import {
  isContentCaptureEnabled,
  captureToolCallContent,
  type ToolCallContent,
} from '../observability/content-capture';
import { generateEventId } from '../telemetry/events';

// =============================================================================
// Constants
// =============================================================================

// Clean up every N onToolStart calls (local to this module)
const CLEANUP_INTERVAL = 10;

// =============================================================================
// Types
// =============================================================================

export interface TelemetryTrackerConfig {
  telemetryClient: IOrchestratorTelemetryClient;
  sessionId: string;
  parentEventId?: string;
  model: string;
  logger: INamespacedLogger;
}

export interface LLMUsageData {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  cost?: number;
  finishReason?: string;
  providerID?: string;
}

/** Tool metadata extracted from SDK */
export interface ToolMetadata {
  metadata?: Record<string, unknown>;
  title?: string;
  attachmentCount?: number;
}

/** Session path context from SDK */
export interface SessionPathContext {
  workingDirectory?: string;
  projectRoot?: string;
}

/** Enhanced error information from SDK */
export interface ErrorDetails {
  statusCode?: number;
  isRetryable?: boolean;
  category: 'auth' | 'api' | 'rate_limit' | 'timeout' | 'unknown';
}

/** Session-level totals */
export interface SessionTotals {
  totalCostUSD: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalReasoningTokens: number;
}

/**
 * Extended tool tracking options with additional properties
 * beyond the base IOrchestratorTelemetryClient interface.
 */
interface ExtendedToolOptions extends NonNullable<
  Parameters<NonNullable<IOrchestratorTelemetryClient['trackToolEx']>>[1]
> {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  toolMetadata?: Record<string, unknown>;
  toolTitle?: string;
  attachmentCount?: number;
  errorStatusCode?: number;
  errorIsRetryable?: boolean;
  errorCategory?: ErrorDetails['category'];
}

/**
 * Extended LLM tracking options with additional properties
 * beyond the base IOrchestratorTelemetryClient interface.
 */
interface ExtendedLLMOptions extends NonNullable<
  Parameters<NonNullable<IOrchestratorTelemetryClient['trackLLMEx']>>[1]
> {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  reasoningTokens?: number;
  workingDirectory?: string;
  projectRoot?: string;
}

interface PendingTool {
  startTime: number;
  input?: Record<string, unknown>;
  metadata?: ToolMetadata;
  capturedContent?: ToolCallContent;
}

// =============================================================================
// TelemetryTracker
// =============================================================================

export class TelemetryTracker {
  private readonly telemetryClient: IOrchestratorTelemetryClient;
  private readonly sessionId: string;
  private readonly parentEventId: string | undefined;
  private readonly model: string;
  private readonly logger: INamespacedLogger;

  /**
   * Pending tool tracking: Map<toolName, PendingTool[]>
   * Uses FIFO queue per tool name since Opencode SDK has no toolId.
   * Multiple concurrent calls to same tool are correlated in order.
   */
  private readonly pendingTools = new Map<string, PendingTool[]>();
  private toolCleanupCounter = 0;

  private turnCount = 0;
  private turnStartTime: number | undefined;

  // Session-level totals tracking
  private sessionTotals: SessionTotals = {
    totalCostUSD: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalReasoningTokens: 0,
  };

  // TEL-003: LLM call count per session
  private llmCallCount = 0;

  // TEL-005: Context window utilization tracking
  private contextWindowTracking = {
    maxContextTokens: 0, // Track peak context size
    peakUtilization: 0, // Peak utilization as percentage
    compressionCount: 0, // Number of compression events
  };

  // Session path context
  private sessionPath: SessionPathContext = {};

  // Retry tracking
  private retryStats = new Map<
    string,
    {
      totalAttempts: number;
      successes: number;
      failures: number;
      totalRetryTimeMs: number;
    }
  >();

  /** Current LLM event ID for tool parent hierarchy (T028) */
  private currentLLMEventId: string | undefined;

  constructor(config: TelemetryTrackerConfig) {
    this.telemetryClient = config.telemetryClient;
    this.sessionId = config.sessionId;
    this.parentEventId = config.parentEventId;
    this.model = config.model;
    this.logger = config.logger;
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Record start of a tool execution.
   * Stores start time and truncated input for later correlation.
   */
  onToolStart(toolName: string, input?: Record<string, unknown>, metadata?: ToolMetadata): void {
    this.toolCleanupCounter++;
    if (this.toolCleanupCounter % CLEANUP_INTERVAL === 0) {
      this.cleanupOrphanedEntries();
    }

    // Enforce memory bounds
    this.enforceMemoryBounds();

    const pending: PendingTool = {
      startTime: Date.now(),
    };

    if (input) {
      // Redact secrets before truncation to prevent sensitive data in telemetry
      const redactedInput: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        redactedInput[key] = typeof value === 'string' ? redact(value) : value;
      }
      pending.input = truncateToolInput(redactedInput);
    }

    if (metadata) {
      pending.metadata = metadata;
    }

    // Capture tool call content if enabled
    if (isContentCaptureEnabled()) {
      const captured = captureToolCallContent(input);
      if (captured) {
        pending.capturedContent = captured;
        this.logger.debug('Tool call content captured', {
          toolName,
          callId: captured.callId,
        });
      }
    }

    // Add to FIFO queue for this tool name
    const queue = this.pendingTools.get(toolName) ?? [];
    queue.push(pending);
    this.pendingTools.set(toolName, queue);

    this.logger.debug('Tool started', { toolName, pendingCount: this.getTotalPendingCount() });
  }

  /**
   * Record completion of a tool execution.
   * Correlates with the earliest pending start for this tool name (FIFO).
   */
  onToolComplete(
    toolName: string,
    output?: unknown,
    isError?: boolean,
    errorDetails?: ErrorDetails
  ): void {
    const endTime = Date.now();
    const queue = this.pendingTools.get(toolName);
    const pending = queue?.shift(); // FIFO: take earliest

    // Clean up empty queues
    if (queue && queue.length === 0) {
      this.pendingTools.delete(toolName);
    }

    if (!pending) {
      this.logger.warn('Tool complete without matching start', { toolName });
      return;
    }

    const durationMs = endTime - pending.startTime;
    const success = !isError;
    const redactedOutput = typeof output === 'string' ? redact(output) : output;
    const truncatedOutput = truncateToolOutput(redactedOutput, 5000);

    // Merge captured output content if enabled
    if (isContentCaptureEnabled() && pending.capturedContent) {
      const outputCapture = captureToolCallContent(undefined, output);
      if (outputCapture && outputCapture.result !== undefined) {
        // Merge output into existing captured content (preserving callId from start)
        // Build new object with exactOptionalPropertyTypes compliance
        const mergedContent: ToolCallContent = {
          callId: pending.capturedContent.callId,
        };
        if (pending.capturedContent.arguments !== undefined) {
          mergedContent.arguments = pending.capturedContent.arguments;
        }
        mergedContent.result = outputCapture.result;

        pending.capturedContent = mergedContent;
        this.logger.debug('Tool call output captured', {
          toolName,
          callId: pending.capturedContent.callId,
        });
      }
    }

    // Build trackToolEx options with exactOptionalPropertyTypes compliance
    const options: ExtendedToolOptions = {
      tool: toolName,
      durationMs,
      success,
    };

    // Only set optional fields when values are defined
    if (pending.startTime !== undefined) {
      options.startTime = pending.startTime;
    }
    if (endTime !== undefined) {
      options.endTime = endTime;
    }
    // T029: Use current LLM event ID as parent for tool hierarchy
    if (this.currentLLMEventId !== undefined) {
      options.parentEventId = this.currentLLMEventId;
    } else if (this.parentEventId !== undefined) {
      // Fallback to session parent if no LLM turn is active
      options.parentEventId = this.parentEventId;
    }
    if (pending.input !== undefined) {
      options.toolInput = pending.input;
    }
    if (truncatedOutput !== undefined && truncatedOutput !== null) {
      options.toolOutput = truncatedOutput;
    }
    if (isError) {
      const errorMsg = extractErrorMessage(output);
      if (errorMsg !== undefined) {
        options.errorMessage = errorMsg;
      }
    }

    // T032: Add trace context to telemetry events
    const traceContext = traceContextProvider.getContext();
    if (traceContext) {
      options.traceId = traceContext.traceId;
      options.spanId = traceContext.spanId;
      if (traceContext.parentSpanId) {
        options.parentSpanId = traceContext.parentSpanId;
      }
    }

    // T025n: Add tool metadata if available
    if (pending.metadata) {
      if (pending.metadata.metadata !== undefined) {
        options.toolMetadata = pending.metadata.metadata;
      }
      if (pending.metadata.title !== undefined) {
        options.toolTitle = pending.metadata.title;
      }
      if (pending.metadata.attachmentCount !== undefined) {
        options.attachmentCount = pending.metadata.attachmentCount;
      }
    }

    // T025q: Add error enrichment
    if (isError && errorDetails) {
      if (errorDetails.statusCode !== undefined) {
        options.errorStatusCode = errorDetails.statusCode;
      }
      if (errorDetails.isRetryable !== undefined) {
        options.errorIsRetryable = errorDetails.isRetryable;
      }
      options.errorCategory = errorDetails.category;
    }

    // T012: Wire captured content to telemetry
    if (pending.capturedContent) {
      if (pending.capturedContent.arguments !== undefined) {
        options.toolInputJson = pending.capturedContent.arguments;
      }
      if (pending.capturedContent.result !== undefined) {
        options.toolOutputJson = pending.capturedContent.result;
      }
      if (pending.capturedContent.callId !== undefined) {
        options.callId = pending.capturedContent.callId;
      }
    }

    this.telemetryClient.trackToolEx?.(this.sessionId, options);

    this.logger.debug('Tool tracked', {
      toolName,
      durationMs,
      success,
    });
  }

  /**
   * Record LLM usage data from a message.updated event.
   */
  onLLMUsage(data: LLMUsageData): void {
    // TEL-003: Increment LLM call count
    this.llmCallCount++;

    // TEL-005: Track context window utilization
    const totalTokens = data.inputTokens + data.outputTokens;
    if (totalTokens > this.contextWindowTracking.maxContextTokens) {
      this.contextWindowTracking.maxContextTokens = totalTokens;
      // Estimate peak utilization (assuming 200k context limit for Claude)
      this.contextWindowTracking.peakUtilization = (totalTokens / 200000) * 100;
    }

    const latencyMs =
      this.turnStartTime !== undefined ? Date.now() - this.turnStartTime : undefined;

    // T028: Generate and store LLM event ID for tool parent hierarchy
    this.currentLLMEventId = generateEventId();

    // Build trackLLMEx options with exactOptionalPropertyTypes compliance
    const options: ExtendedLLMOptions = {
      model: this.model,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
    };

    // Only set optional fields when values are defined
    if (latencyMs !== undefined) {
      options.latencyMs = latencyMs;
    }
    if (this.parentEventId !== undefined) {
      options.parentEventId = this.parentEventId;
    }
    if (data.cost !== undefined) {
      options.cost = data.cost;
    }
    if (data.finishReason !== undefined) {
      options.stopReason = data.finishReason;
    }
    if (data.cacheReadTokens !== undefined) {
      options.cacheReadTokens = data.cacheReadTokens;
    }
    if (data.cacheWriteTokens !== undefined) {
      options.cacheCreationTokens = data.cacheWriteTokens;
    }

    // T025j, T025k: Track reasoning tokens
    if (data.reasoningTokens !== undefined) {
      options.reasoningTokens = data.reasoningTokens;
    }

    // T025i: Extract provider from SDK instead of hardcoding
    options.provider = this.mapProviderID(data.providerID);

    // T032: Add trace context to telemetry events
    const traceContext = traceContextProvider.getContext();
    if (traceContext) {
      options.traceId = traceContext.traceId;
      options.spanId = traceContext.spanId;
      if (traceContext.parentSpanId) {
        options.parentSpanId = traceContext.parentSpanId;
      }
    }

    // T025o: Add session path context if available
    if (this.sessionPath.workingDirectory !== undefined) {
      options.workingDirectory = this.sessionPath.workingDirectory;
    }
    if (this.sessionPath.projectRoot !== undefined) {
      options.projectRoot = this.sessionPath.projectRoot;
    }

    // T011: Content capture for LLM prompts and completions
    // NOTE: The Opencode SDK doesn't provide prompt/completion content in message.updated events.
    // Text content flows through separate streaming events (message.part.updated).
    // To capture this, we would need to:
    // 1. Track text chunks during streaming in orchestrator.ts
    // 2. Pass accumulated prompt/completion to onLLMUsage via LLMUsageData
    // For now, we wire the fields but leave them undefined since data isn't available.
    if (isContentCaptureEnabled()) {
      // TODO: Capture prompt content when SDK provides it or we track it from streaming
      // options.promptContent = data.promptContent ? sanitizeContent(data.promptContent) : undefined;
      // TODO: Capture completion content when SDK provides it or we track it from streaming
      // options.completionContent = data.completionContent ? sanitizeContent(data.completionContent) : undefined;
    }

    this.telemetryClient.trackLLMEx?.(this.sessionId, options);

    // T025p: Update session totals
    this.sessionTotals.totalInputTokens += data.inputTokens;
    this.sessionTotals.totalOutputTokens += data.outputTokens;
    if (data.reasoningTokens) {
      this.sessionTotals.totalReasoningTokens += data.reasoningTokens;
    }
    if (data.cost) {
      this.sessionTotals.totalCostUSD += data.cost;
    }

    this.logger.debug('LLM usage tracked', {
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      reasoningTokens: data.reasoningTokens,
      latencyMs,
    });
  }

  /**
   * Record start of a new turn (prompt/response cycle).
   */
  onTurnStart(): void {
    this.turnCount++;
    this.turnStartTime = Date.now();
    this.logger.debug('Turn started', { turnCount: this.turnCount });
  }

  /**
   * Update session path context (working directory and project root).
   * T025o: Extract from SDK AssistantMessage.path
   */
  updateSessionPath(pathContext: SessionPathContext): void {
    if (pathContext.workingDirectory) {
      this.sessionPath.workingDirectory = pathContext.workingDirectory;
    }
    if (pathContext.projectRoot) {
      this.sessionPath.projectRoot = pathContext.projectRoot;
    }
  }

  /**
   * Get session totals accumulated during the session.
   * T025p: Report at session end
   */
  getSessionTotals(): Readonly<SessionTotals> {
    return { ...this.sessionTotals };
  }

  /**
   * Get LLM call count for this session.
   * TEL-003: Support continuous improvement analysis.
   */
  getLLMCallCount(): number {
    return this.llmCallCount;
  }

  /**
   * Get context window utilization metrics.
   * TEL-005: Track peak context usage and compression events.
   */
  getContextWindowMetrics(): Readonly<{
    maxContextTokens: number;
    peakUtilization: number;
    compressionCount: number;
  }> {
    return { ...this.contextWindowTracking };
  }

  /**
   * Record a compression event.
   * TEL-005: Track when context is compressed to manage window size.
   */
  onCompressionEvent(): void {
    this.contextWindowTracking.compressionCount++;
    this.logger.debug('Compression event recorded', {
      totalCompressions: this.contextWindowTracking.compressionCount,
    });
  }

  /**
   * Record a retry attempt for an operation.
   *
   * @param operationType - Type of operation being retried (e.g., 'llm_call', 'tool_execution')
   * @param attemptNumber - Current attempt number (1-indexed)
   * @param success - Whether this attempt succeeded
   * @param retryTimeMs - Time spent in this retry (including backoff delay)
   */
  trackRetryAttempt(
    operationType: string,
    attemptNumber: number,
    success: boolean,
    retryTimeMs: number
  ): void {
    const stats = this.retryStats.get(operationType) ?? {
      totalAttempts: 0,
      successes: 0,
      failures: 0,
      totalRetryTimeMs: 0,
    };

    stats.totalAttempts++;
    if (success) {
      stats.successes++;
    } else {
      stats.failures++;
    }
    stats.totalRetryTimeMs += retryTimeMs;

    this.retryStats.set(operationType, stats);

    this.logger.debug('Retry attempt tracked', {
      operationType,
      attemptNumber,
      success,
      retryTimeMs,
      totalAttempts: stats.totalAttempts,
    });
  }

  /**
   * Get retry statistics for all operations.
   *
   * @returns Map of operation type to retry statistics
   */
  getRetryStats(): ReadonlyMap<
    string,
    Readonly<{
      totalAttempts: number;
      successes: number;
      failures: number;
      totalRetryTimeMs: number;
    }>
  > {
    return this.retryStats;
  }

  /**
   * Get retry statistics for a specific operation type.
   *
   * @param operationType - Type of operation
   * @returns Retry statistics or undefined if no retries recorded
   */
  getRetryStatsForOperation(operationType: string):
    | Readonly<{
        totalAttempts: number;
        successes: number;
        failures: number;
        totalRetryTimeMs: number;
      }>
    | undefined {
    const stats = this.retryStats.get(operationType);
    return stats ? { ...stats } : undefined;
  }

  /**
   * Map SDK providerID to GenAIProvider type.
   * T025i: Extract provider from SDK instead of hardcoding 'anthropic'
   */
  private mapProviderID(providerID?: string): GenAIProvider {
    if (!providerID) {
      return 'unknown';
    }

    const normalized = providerID.toLowerCase();

    // Direct matches
    const directMatches: Record<string, GenAIProvider> = {
      anthropic: 'anthropic',
      openai: 'openai',
      google: 'google',
      bedrock: 'bedrock',
      azure: 'azure',
      groq: 'groq',
      openrouter: 'openrouter',
      ollama: 'ollama',
      deepseek: 'deepseek',
      xai: 'xai',
      together: 'together',
      github: 'github',
    };

    const match = directMatches[normalized];
    if (match) {
      return match;
    }

    // Partial matches for common variations
    if (normalized.includes('anthropic')) return 'anthropic';
    if (normalized.includes('openai')) return 'openai';
    if (normalized.includes('google') || normalized.includes('gemini')) return 'google';
    if (normalized.includes('bedrock')) return 'bedrock';
    if (normalized.includes('azure')) return 'azure';
    if (normalized.includes('groq')) return 'groq';
    if (normalized.includes('openrouter')) return 'openrouter';
    if (normalized.includes('ollama')) return 'ollama';
    if (normalized.includes('deepseek')) return 'deepseek';
    if (normalized.includes('xai') || normalized.includes('grok')) return 'xai';
    if (normalized.includes('together')) return 'together';
    if (normalized.includes('github')) return 'github';

    // Unknown provider - log for visibility
    this.logger.debug('Unknown provider ID', { providerID });
    return 'custom';
  }

  /**
   * Categorize error based on SDK error details.
   * T025q: Error enrichment
   */
  categorizeError(error: unknown): ErrorDetails {
    // Type guard for SDK ApiError with message
    const isApiError = (
      err: unknown
    ): err is { statusCode?: number; isRetryable?: boolean; message?: string } => {
      return (
        typeof err === 'object' &&
        err !== null &&
        ('statusCode' in err || 'isRetryable' in err || 'message' in err)
      );
    };

    if (!isApiError(error)) {
      return { category: 'unknown' };
    }

    const statusCode = error.statusCode;
    const isRetryable = error.isRetryable;

    // Categorize based on status code
    let category: ErrorDetails['category'] = 'unknown';

    if (statusCode !== undefined) {
      if (statusCode === 401 || statusCode === 403) {
        category = 'auth';
      } else if (statusCode === 429) {
        category = 'rate_limit';
      } else if (statusCode >= 500) {
        category = 'api';
      } else if (statusCode >= 400) {
        category = 'api';
      }
    }

    // Timeout detection (SDK might not set statusCode)
    if (statusCode === undefined && error.message?.toLowerCase().includes('timeout')) {
      category = 'timeout';
    }

    // Build result with exactOptionalPropertyTypes compliance
    const result: ErrorDetails = { category };
    if (statusCode !== undefined) {
      result.statusCode = statusCode;
    }
    if (isRetryable !== undefined) {
      result.isRetryable = isRetryable;
    }

    return result;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private getTotalPendingCount(): number {
    let count = 0;
    for (const queue of this.pendingTools.values()) {
      count += queue.length;
    }
    return count;
  }

  /**
   * Enforce MAX_PENDING_TOOLS limit by evicting oldest entries.
   */
  private enforceMemoryBounds(): void {
    while (this.getTotalPendingCount() >= MAX_PENDING_TOOLS) {
      // Find the oldest entry across all queues
      let oldestToolName: string | null = null;
      let oldestTime = Infinity;

      for (const [toolName, queue] of this.pendingTools) {
        if (queue.length > 0 && queue[0]!.startTime < oldestTime) {
          oldestTime = queue[0]!.startTime;
          oldestToolName = toolName;
        }
      }

      if (oldestToolName) {
        const queue = this.pendingTools.get(oldestToolName)!;
        queue.shift(); // Remove oldest
        if (queue.length === 0) {
          this.pendingTools.delete(oldestToolName);
        }
        this.logger.debug('Evicted oldest pending tool', { toolName: oldestToolName });
      } else {
        break;
      }
    }
  }

  /**
   * Clean up entries older than TTL to prevent memory leaks.
   */
  private cleanupOrphanedEntries(): void {
    const now = Date.now();

    for (const [toolName, queue] of this.pendingTools) {
      const remaining = queue.filter((p) => now - p.startTime <= TOOL_TRACKING_TTL_MS);
      if (remaining.length === 0) {
        this.pendingTools.delete(toolName);
      } else if (remaining.length < queue.length) {
        this.pendingTools.set(toolName, remaining);
      }
    }
  }
}
