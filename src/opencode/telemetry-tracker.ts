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
import {
  truncateToolOutput,
  truncateToolInput,
  extractErrorMessage,
} from '../orchestration/telemetry-utils';
import { redact } from '../debug/redaction';
import { MAX_PENDING_TOOLS, TOOL_TRACKING_TTL_MS } from '../telemetry/constants';

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
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  cost?: number;
  finishReason?: string;
}

interface PendingTool {
  startTime: number;
  input?: Record<string, unknown>;
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
  onToolStart(toolName: string, input?: Record<string, unknown>): void {
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
  onToolComplete(toolName: string, output?: unknown, isError?: boolean): void {
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

    // Build trackToolEx options with exactOptionalPropertyTypes compliance
    const options: Parameters<NonNullable<IOrchestratorTelemetryClient['trackToolEx']>>[1] = {
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
    if (this.parentEventId !== undefined) {
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
    const latencyMs =
      this.turnStartTime !== undefined ? Date.now() - this.turnStartTime : undefined;

    // Build trackLLMEx options with exactOptionalPropertyTypes compliance
    const options: Parameters<NonNullable<IOrchestratorTelemetryClient['trackLLMEx']>>[1] = {
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

    // Always set provider for agentlint
    options.provider = 'anthropic';

    this.telemetryClient.trackLLMEx?.(this.sessionId, options);

    this.logger.debug('LLM usage tracked', {
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
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
