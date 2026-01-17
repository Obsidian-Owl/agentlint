/**
 * EP06 Session Analysis Tools - Metrics Extraction
 *
 * Extracts token usage, tool distribution, and other metrics from session logs.
 *
 * @module src/tools/sessions/metrics
 */

import type { SessionEntry, SessionMetrics, ToolDistribution } from './types';
import { categorizeToolByName } from './utils';
import { parseSessionFile } from './parser';

// =============================================================================
// Types
// =============================================================================

/**
 * Aggregated token usage.
 */
export interface TokenUsageAggregate {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

// =============================================================================
// Token Usage Aggregation
// =============================================================================

/**
 * Aggregate token usage from session entries.
 *
 * @param entries - Session entries to aggregate
 * @returns Aggregated token counts
 */
export function aggregateTokenUsage(entries: SessionEntry[]): TokenUsageAggregate {
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;

  for (const entry of entries) {
    const usage = entry.message?.usage;
    if (usage) {
      inputTokens += usage.input_tokens || 0;
      outputTokens += usage.output_tokens || 0;
      cacheReadTokens += usage.cache_read_input_tokens || 0;
      cacheCreationTokens += usage.cache_creation_input_tokens || 0;
    }
  }

  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
  };
}

// =============================================================================
// Tool Distribution
// =============================================================================

/**
 * Calculate tool distribution from session entries.
 *
 * Categorizes each tool use into read/write/bash/search/other categories.
 *
 * @param entries - Session entries to analyze
 * @returns Tool distribution counts
 */
export function calculateToolDistribution(entries: SessionEntry[]): ToolDistribution {
  const distribution: ToolDistribution = {
    read: 0,
    write: 0,
    bash: 0,
    search: 0,
    other: 0,
    total: 0,
  };

  for (const entry of entries) {
    if (!entry.message?.content) continue;

    for (const block of entry.message.content) {
      if (block.type === 'tool_use' && block.name) {
        const category = categorizeToolByName(block.name);
        distribution[category]++;
        distribution.total++;
      }
    }
  }

  return distribution;
}

// =============================================================================
// Metrics Extraction
// =============================================================================

/**
 * Extract all metrics from session entries.
 *
 * @param entries - Parsed session entries
 * @param sessionId - Session identifier
 * @param projectPath - Project path for this session
 * @returns Complete session metrics
 */
export function extractMetrics(
  entries: SessionEntry[],
  sessionId: string,
  projectPath: string
): SessionMetrics {
  // Token usage
  const tokenUsage = aggregateTokenUsage(entries);

  // Tool distribution
  const toolDistribution = calculateToolDistribution(entries);

  // Count user/assistant turns and compressions
  let turnCount = 0;
  let compressionCount = 0;
  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;

  for (const entry of entries) {
    // Count conversation turns
    if (entry.type === 'user' || entry.type === 'assistant') {
      turnCount++;
    }

    // Count compression events (summaries)
    if (entry.type === 'summary') {
      compressionCount++;
    }

    // Track timestamps
    if (entry.timestamp) {
      if (!firstTimestamp) {
        firstTimestamp = entry.timestamp;
      }
      lastTimestamp = entry.timestamp;
    }
  }

  // Calculate duration if we have both timestamps
  let duration: number | null = null;
  if (firstTimestamp && lastTimestamp) {
    const start = new Date(firstTimestamp).getTime();
    const end = new Date(lastTimestamp).getTime();
    if (!isNaN(start) && !isNaN(end)) {
      duration = end - start;
    }
  }

  return {
    sessionId,
    projectPath,
    inputTokens: tokenUsage.inputTokens,
    outputTokens: tokenUsage.outputTokens,
    cacheReadTokens: tokenUsage.cacheReadTokens,
    cacheCreationTokens: tokenUsage.cacheCreationTokens,
    turnCount,
    duration,
    firstTimestamp: firstTimestamp || '',
    lastTimestamp: lastTimestamp || '',
    toolDistribution,
    errorCount: 0, // Errors are tracked during parsing, not metrics
    compressionCount,
  };
}

/**
 * Extract metrics from a session file.
 *
 * @param filePath - Path to the JSONL session file
 * @param projectPath - Project path for this session
 * @returns Session metrics
 */
export async function extractMetricsFromFile(
  filePath: string,
  projectPath: string
): Promise<SessionMetrics> {
  const parseResult = await parseSessionFile(filePath);

  const sessionId = parseResult.sessionId || extractSessionIdFromPath(filePath);

  return extractMetrics(parseResult.entries, sessionId, projectPath);
}

/**
 * Extract session ID from file path (fallback).
 */
function extractSessionIdFromPath(filePath: string): string {
  const match = filePath.match(/([0-9a-f-]{36})\.jsonl$/i);
  return match?.[1] ?? 'unknown';
}

// =============================================================================
// Batch Processing
// =============================================================================

/**
 * Options for batch metrics extraction.
 */
export interface BatchMetricsOptions {
  /** Maximum concurrent file processing */
  concurrency?: number;
  /** Callback for progress updates */
  onProgress?: (processed: number, total: number) => void;
}

/**
 * Extract metrics from multiple session files.
 *
 * @param files - Array of {path, projectPath} objects
 * @param options - Processing options
 * @returns Array of session metrics
 */
export async function extractMetricsBatch(
  files: Array<{ path: string; projectPath: string }>,
  options: BatchMetricsOptions = {}
): Promise<SessionMetrics[]> {
  const { concurrency = 4, onProgress } = options;
  const results: SessionMetrics[] = [];
  let processed = 0;

  // Process in batches for memory efficiency
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((file) => extractMetricsFromFile(file.path, file.projectPath))
    );

    results.push(...batchResults);
    processed += batch.length;

    if (onProgress) {
      onProgress(processed, files.length);
    }
  }

  return results;
}
