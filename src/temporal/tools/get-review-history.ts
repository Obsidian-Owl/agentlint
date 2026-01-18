/**
 * EP09 Temporal Analysis - get_review_history Tool
 *
 * SDK tool definition for retrieving qualitative review history.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * @module temporal/tools/get-review-history
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import {
  getReviewIndexDb,
  queryReviews,
  countReviews,
  type ReviewQueryOptions,
} from '../../persistence/reviews/indexer';
import { loadReview } from '../../persistence/reviews/storage';
import type { ReviewDimensionName } from '../types';
import { getDimension } from '../qualitative/dimensions';
import { TOOL_DESCRIPTIONS } from './descriptions';

// Note: getSentimentLabel was removed per ADR-0019.
// The agent interprets sentiment values directly.

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Input schema for get_review_history tool.
 * Matches GetReviewHistoryInputSchema from contracts/temporal-tools.ts
 */
const getReviewHistoryInputSchema = {
  baselineId: z.string().optional().describe('Filter reviews by baseline'),
  afterDate: z.string().optional().describe('Reviews after this ISO-8601 date'),
  beforeDate: z.string().optional().describe('Reviews before this ISO-8601 date'),
  dimension: z
    .enum([
      'perceivedFriction',
      'trustCalibration',
      'taskFit',
      'configurationConfidence',
      'improvementAttribution',
      'workflowSatisfaction',
    ])
    .optional()
    .describe('Filter by dimension'),
  limit: z.number().optional().default(20).describe('Maximum reviews to return'),
  includeResponses: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include full dimension responses (larger output)'),
};

// =============================================================================
// Types
// =============================================================================

/**
 * Single review in the history result.
 */
interface ReviewHistoryItem {
  id: string;
  baselineId: string;
  createdAt: string;
  overallSentiment: number;
  themes: string[];
  triggerReason?: string;
  dimensionSentiments?: Record<string, number>;
  responses?: Array<{
    dimension: string;
    response: string;
    sentiment: number;
  }>;
}

/**
 * Result from get_review_history tool.
 */
interface GetReviewHistoryResult {
  success: boolean;
  reviews: ReviewHistoryItem[];
  total: number;
  hasMore: boolean;
  filter?: {
    baselineId?: string;
    afterDate?: string;
    beforeDate?: string;
    dimension?: string;
  };
  error?: string;
}

// =============================================================================
// Formatting Helpers
// =============================================================================

/**
 * Format the result for human-readable output.
 */
function formatToolOutput(result: GetReviewHistoryResult): string {
  if (!result.success) {
    return `## Error\n\n${result.error ?? 'Unknown error'}`;
  }

  const lines: string[] = ['## Review History\n'];

  // Summary
  lines.push(`**Total Reviews**: ${result.total}`);
  lines.push(`**Showing**: ${result.reviews.length}`);
  if (result.hasMore) {
    lines.push('*(More reviews available, increase limit to see more)*');
  }

  // Active filters
  if (result.filter) {
    const filters: string[] = [];
    if (result.filter.baselineId) {
      filters.push(`baseline: ${result.filter.baselineId}`);
    }
    if (result.filter.afterDate) {
      filters.push(`after: ${result.filter.afterDate}`);
    }
    if (result.filter.beforeDate) {
      filters.push(`before: ${result.filter.beforeDate}`);
    }
    if (result.filter.dimension) {
      filters.push(`dimension: ${result.filter.dimension}`);
    }
    if (filters.length > 0) {
      lines.push(`**Filters**: ${filters.join(', ')}`);
    }
  }

  // Reviews
  if (result.reviews.length === 0) {
    lines.push('\n*No reviews found matching criteria.*');
  } else {
    lines.push('\n### Reviews\n');

    for (const review of result.reviews) {
      // Per ADR-0019, return raw sentiment value. Agent interprets meaning.
      const sentimentValue = review.overallSentiment >= 0 ? `+${review.overallSentiment}` : `${review.overallSentiment}`;
      lines.push(
        `**${formatDate(review.createdAt)}** - Sentiment: ${sentimentValue}`
      );
      lines.push(`- ID: ${review.id.slice(0, 8)}...`);
      lines.push(`- Baseline: ${review.baselineId.slice(0, 8)}...`);

      if (review.triggerReason) {
        lines.push(`- Trigger: ${review.triggerReason}`);
      }

      if (review.themes.length > 0) {
        lines.push(`- Themes: ${review.themes.join(', ')}`);
      }

      if (review.dimensionSentiments) {
        const dims = Object.entries(review.dimensionSentiments)
          .map(([name, sentiment]) => {
            const def = getDimension(name as ReviewDimensionName);
            return `${def?.displayName ?? name}: ${formatSentimentCompact(sentiment)}`;
          })
          .join(', ');
        lines.push(`- Dimensions: ${dims}`);
      }

      if (review.responses) {
        lines.push('\n  **Responses:**');
        for (const resp of review.responses) {
          const def = getDimension(resp.dimension as ReviewDimensionName);
          lines.push(
            `  - **${def?.displayName ?? resp.dimension}** [${formatSentimentCompact(resp.sentiment)}]`
          );
          lines.push(`    > ${truncateResponse(resp.response)}`);
        }
      }

      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Format date for display.
 */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format sentiment compactly.
 */
function formatSentimentCompact(value: number): string {
  if (value <= -1.5) return '😢';
  if (value <= -0.5) return '😕';
  if (value < 0.5) return '😐';
  if (value < 1.5) return '🙂';
  return '😊';
}

/**
 * Truncate long responses.
 */
function truncateResponse(text: string, maxLength = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * get_review_history tool definition.
 *
 * Retrieves qualitative review history with filtering.
 */
export const getReviewHistoryTool = tool(
  'get_review_history',
  TOOL_DESCRIPTIONS.get_review_history,
  getReviewHistoryInputSchema,
  async (args) => {
    try {
      const limit = args.limit ?? 20;

      // Build query options
      const queryOptions: ReviewQueryOptions = {
        limit: limit + 1, // Fetch one extra to check hasMore
        orderBy: 'createdAt',
        order: 'desc',
      };

      if (args.baselineId) {
        queryOptions.baselineId = args.baselineId;
      }
      if (args.afterDate) {
        queryOptions.after = args.afterDate;
      }
      if (args.beforeDate) {
        queryOptions.before = args.beforeDate;
      }

      // Open database and query
      const db = await getReviewIndexDb();
      const summaries = queryReviews(db, queryOptions);

      // Check if there are more results
      const hasMore = summaries.length > limit;
      const limitedSummaries = hasMore ? summaries.slice(0, limit) : summaries;

      // Get total count
      const countOptions = { ...queryOptions };
      delete (countOptions as Partial<ReviewQueryOptions>).limit;
      const total = countReviews(db, countOptions);

      // Convert to history items
      const reviews: ReviewHistoryItem[] = [];

      for (const summary of limitedSummaries) {
        const item: ReviewHistoryItem = {
          id: summary.id,
          baselineId: summary.baselineId,
          createdAt: summary.createdAt,
          overallSentiment: summary.overallSentiment,
          themes: summary.themes,
        };

        if (summary.triggerReason) {
          item.triggerReason = summary.triggerReason;
        }

        // If filtering by dimension or including responses, load full review
        if (args.dimension || args.includeResponses) {
          const fullReview = await loadReview(summary.id);
          if (fullReview) {
            // Build dimension sentiments map
            item.dimensionSentiments = {};
            for (const dim of fullReview.dimensions) {
              item.dimensionSentiments[dim.name] = dim.sentiment;
            }

            // Filter by dimension if specified
            if (args.dimension) {
              const matchingDim = fullReview.dimensions.find((d) => d.name === args.dimension);
              if (!matchingDim) {
                // Skip this review if it doesn't have the requested dimension
                continue;
              }
            }

            // Include full responses if requested
            if (args.includeResponses) {
              item.responses = fullReview.dimensions.map((d) => ({
                dimension: d.name,
                response: d.response,
                sentiment: d.sentiment,
              }));
            }
          }
        }

        reviews.push(item);
      }

      db.close();

      // Build result
      const result: GetReviewHistoryResult = {
        success: true,
        reviews,
        total,
        hasMore,
      };

      // Add active filters
      if (args.baselineId || args.afterDate || args.beforeDate || args.dimension) {
        result.filter = {};
        if (args.baselineId) result.filter.baselineId = args.baselineId;
        if (args.afterDate) result.filter.afterDate = args.afterDate;
        if (args.beforeDate) result.filter.beforeDate = args.beforeDate;
        if (args.dimension) result.filter.dimension = args.dimension;
      }

      return {
        content: [{ type: 'text' as const, text: formatToolOutput(result) }],
        _rawData: result,
      };
    } catch (error) {
      const result: GetReviewHistoryResult = {
        success: false,
        reviews: [],
        total: 0,
        hasMore: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      return {
        content: [{ type: 'text' as const, text: formatToolOutput(result) }],
        _rawData: result,
      };
    }
  }
);
