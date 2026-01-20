/**
 * EP10 Recommendation Compression Utilities
 *
 * Provides token estimation, recommendation compression, and context loading
 * within the 8K token budget per NFR-002.
 *
 * @module recommendations/storage/compression
 */

import { listRecommendationIds, loadRecommendation } from './storage';
import type {
  Recommendation,
  RecommendationEvent,
  RecommendationSummary,
  RecommendationStatus,
  Milestones,
} from '../types';

// =============================================================================
// Constants
// =============================================================================

/** Token budget for recommendations context per NFR-002 */
export const TOKEN_BUDGET = 8000;

/** Approximate characters per token */
export const CHARS_PER_TOKEN = 4;

/** Maximum events to show verbatim */
const MAX_VERBATIM_EVENTS = 3;

/** Threshold for showing summary instead of count */
const EVENT_SUMMARY_THRESHOLD = 10;

/** Maximum action summary length */
const MAX_ACTION_SUMMARY_LENGTH = 100;

// =============================================================================
// Types
// =============================================================================

export interface LoadContextOptions {
  /** Base directory for recommendations */
  baseDir?: string;
  /** Filter by status */
  status?: RecommendationStatus;
  /** Custom token budget (default: 8000) */
  tokenBudget?: number;
}

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Estimate the number of tokens in a text or object.
 * Uses simple character count approximation (4 chars ≈ 1 token).
 *
 * @param input - String or object to estimate
 * @returns Estimated token count
 */
export function estimateTokens(input: string | object): number {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// =============================================================================
// Event Formatting
// =============================================================================

/**
 * Format events as a verbatim string.
 *
 * @param events - Events to format
 * @returns Formatted string
 */
export function formatEventsVerbatim(events: RecommendationEvent[]): string {
  if (events.length === 0) {
    return '';
  }

  return events.map((e) => `[${e.type}] ${e.content}`).join('\n');
}

/**
 * Generate recent activity string based on event count.
 * Per data-model.md compression rules:
 * - ≤3 events: Include all events verbatim
 * - 4-10 events: Last 3 verbatim, "[+N earlier events]" prefix
 * - >10 events: "[Events summarized - use get_recommendation for full history]"
 */
function formatRecentActivity(events: RecommendationEvent[]): string {
  if (events.length <= MAX_VERBATIM_EVENTS) {
    return formatEventsVerbatim(events);
  }

  if (events.length <= EVENT_SUMMARY_THRESHOLD) {
    const recentEvents = events.slice(-MAX_VERBATIM_EVENTS);
    const olderCount = events.length - MAX_VERBATIM_EVENTS;
    return `[+${olderCount} earlier events]\n${formatEventsVerbatim(recentEvents)}`;
  }

  return '[Events summarized - use get_recommendation for full history]';
}

// =============================================================================
// Recommendation Compression
// =============================================================================

/**
 * Compress a recommendation into a summary view for context loading.
 * Per NFR-001: Summary should be < 500 chars.
 *
 * @param recommendation - Full recommendation to compress
 * @returns Compressed summary
 */
export function compressRecommendation(recommendation: Recommendation): RecommendationSummary {
  const { events } = recommendation;
  const lastEvent = events[events.length - 1];

  // Truncate action to MAX_ACTION_SUMMARY_LENGTH
  let actionSummary = recommendation.action;
  if (actionSummary.length > MAX_ACTION_SUMMARY_LENGTH) {
    actionSummary = actionSummary.slice(0, MAX_ACTION_SUMMARY_LENGTH) + '...';
  }

  // Build milestones
  const milestones: Milestones = {
    created: recommendation.createdAt,
  };

  // Find first evidence event
  const evidenceEvent = events.find((e) => e.type === 'evidence');
  if (evidenceEvent) {
    milestones.firstEvidence = evidenceEvent.timestamp;
  }

  // Find implementation confirmation
  if (recommendation.status === 'implemented' || recommendation.status === 'monitoring') {
    const statusChangeEvent = events.find(
      (e) => e.type === 'status_change' && e.content.includes('implemented')
    );
    if (statusChangeEvent) {
      milestones.implemented = statusChangeEvent.timestamp;
    }
  }

  // Set completion milestone
  if (recommendation.completedAt) {
    milestones.completed = recommendation.completedAt;
  }

  return {
    id: recommendation.id,
    type: recommendation.type,
    status: recommendation.status,
    actionSummary,
    target: recommendation.target,
    priority: recommendation.priority,
    eventCount: events.length,
    lastEventAt: lastEvent?.timestamp ?? recommendation.createdAt,
    lastEventType: lastEvent?.type ?? 'created',
    recentActivity: formatRecentActivity(events),
    milestones,
  };
}

// =============================================================================
// Context Loading
// =============================================================================

/**
 * Load recommendations for context within token budget.
 * Loads newest-first until budget is exhausted per NFR-002/NFR-008.
 *
 * @param options - Loading options
 * @returns Array of compressed summaries
 */
export async function loadRecommendationsForContext(
  options: LoadContextOptions = {}
): Promise<RecommendationSummary[]> {
  const { baseDir, status, tokenBudget = TOKEN_BUDGET } = options;

  const storageOptions = baseDir ? { baseDir } : {};
  const ids = listRecommendationIds(storageOptions);
  if (ids.length === 0) {
    return [];
  }

  // Load all recommendations
  const recommendations: Recommendation[] = [];
  for (const id of ids) {
    const rec = await loadRecommendation(id, storageOptions);
    if (rec) {
      // Apply status filter if provided
      if (status && rec.status !== status) {
        continue;
      }
      recommendations.push(rec);
    }
  }

  // Sort by createdAt descending (newest first)
  recommendations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Compress and accumulate within budget
  const summaries: RecommendationSummary[] = [];
  let usedTokens = 0;

  for (const rec of recommendations) {
    const summary = compressRecommendation(rec);
    const tokens = estimateTokens(summary);

    if (usedTokens + tokens > tokenBudget) {
      break;
    }

    summaries.push(summary);
    usedTokens += tokens;
  }

  return summaries;
}
