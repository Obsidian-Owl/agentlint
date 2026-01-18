/**
 * EP09 Temporal Analysis - conduct_review Tool
 *
 * SDK tool definition for facilitating structured qualitative review sessions.
 * Uses the Claude Agent SDK's tool() pattern per ADR-0005.
 *
 * The conduct_review tool supports two modes:
 * 1. Initiation: Returns prompts for the agent to present to the user
 * 2. Completion: Accepts responses and stores the completed review
 *
 * @module temporal/tools/conduct-review
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { saveReview } from '../../persistence/reviews/storage';
import { getReviewIndexDb, indexReview } from '../../persistence/reviews/indexer';
import { loadBaseline, getLatestBaseline } from '../../persistence/baselines/storage';
import type { QualitativeReview, ReviewDimension, ReviewDimensionName } from '../types';
import { getDimension, getDimensionNames } from '../qualitative/dimensions';
import { calculateOverallSentiment } from '../qualitative/sentiment';
import { TOOL_DESCRIPTIONS } from './descriptions';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Schema for dimension response input.
 */
const dimensionResponseSchema = z.object({
  name: z.enum([
    'perceivedFriction',
    'trustCalibration',
    'taskFit',
    'configurationConfidence',
    'improvementAttribution',
    'workflowSatisfaction',
  ]),
  response: z.string().describe("User's response text"),
  sentiment: z
    .number()
    .min(-2)
    .max(2)
    .describe('Rating from -2 (very negative) to +2 (very positive)'),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .optional()
    .describe("User's confidence in their assessment"),
});

/**
 * Input schema for conduct_review tool.
 * Matches ConductReviewInputSchema from contracts/temporal-tools.ts
 */
const conductReviewInputSchema = {
  baselineId: z.string().optional().describe('Baseline to attach review to (default: latest)'),
  dimensions: z
    .array(
      z.enum([
        'perceivedFriction',
        'trustCalibration',
        'taskFit',
        'configurationConfidence',
        'improvementAttribution',
        'workflowSatisfaction',
      ])
    )
    .optional()
    .describe('Specific dimensions to cover (default: all)'),
  triggerReason: z
    .enum(['scheduled', 'triggered', 'manual'])
    .optional()
    .default('manual')
    .describe('Why this review is being conducted'),
  mode: z
    .enum(['initiate', 'complete'])
    .optional()
    .default('initiate')
    .describe('initiate = get prompts, complete = submit responses'),
  responses: z
    .array(dimensionResponseSchema)
    .optional()
    .describe('Dimension responses (required when mode=complete)'),
  freeformNotes: z.string().optional().describe('Optional additional notes from user'),
  themes: z.array(z.string()).optional().describe('Themes extracted from responses by the agent'),
};

// =============================================================================
// Types
// =============================================================================

/**
 * Single dimension prompt for agent to present.
 */
interface ReviewPrompt {
  dimension: ReviewDimensionName;
  displayName: string;
  promptText: string;
  probeText: string;
  sentimentScale: string;
}

/**
 * Result from conduct_review tool.
 */
interface ConductReviewResult {
  success: boolean;
  review?: QualitativeReview;
  prompts?: ReviewPrompt[];
  status: 'prompting' | 'complete' | 'error';
  baselineId?: string;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

const SENTIMENT_SCALE_DESCRIPTION = `
Rate from -2 to +2:
  -2: Very Negative
  -1: Negative
   0: Neutral
  +1: Positive
  +2: Very Positive
`.trim();

// =============================================================================
// Tool Implementation
// =============================================================================

// =============================================================================
// Formatting Helpers
// =============================================================================

/**
 * Format the result for human-readable output.
 */
function formatToolOutput(result: ConductReviewResult): string {
  if (!result.success) {
    return `## Error\n\n${result.error ?? 'Unknown error'}`;
  }

  if (result.status === 'prompting' && result.prompts) {
    const lines: string[] = [
      '## Qualitative Review Session\n',
      `**Baseline**: ${result.baselineId}`,
      '\nPlease ask the user about each dimension below. For each dimension:',
      '1. Present the prompt question',
      '2. Record their response',
      '3. Ask them to rate their sentiment (-2 to +2)',
      '4. Note their confidence level if they provide it\n',
      '### Dimensions to Cover\n',
    ];

    for (const prompt of result.prompts) {
      lines.push(`**${prompt.displayName}**`);
      lines.push(`> ${prompt.promptText}`);
      lines.push(`_Probe if needed_: ${prompt.probeText}`);
      lines.push(`_Scale_: ${prompt.sentimentScale.split('\n').join(', ')}\n`);
    }

    lines.push('\n---');
    lines.push(
      'When complete, call `conduct_review` again with `mode: "complete"` and the responses array.'
    );

    return lines.join('\n');
  }

  if (result.status === 'complete' && result.review) {
    const review = result.review;
    const lines: string[] = [
      '## Review Completed Successfully\n',
      `**Review ID**: ${review.id}`,
      `**Baseline**: ${review.baselineId}`,
      `**Overall Sentiment**: ${formatSentiment(review.overallSentiment)}`,
      `**Trigger**: ${review.triggerReason ?? 'manual'}`,
    ];

    if (review.themes.length > 0) {
      lines.push(`**Themes**: ${review.themes.join(', ')}`);
    }

    lines.push('\n### Dimension Ratings\n');
    for (const dim of review.dimensions) {
      const definition = getDimension(dim.name);
      lines.push(`- **${definition?.displayName ?? dim.name}**: ${formatSentiment(dim.sentiment)}`);
    }

    return lines.join('\n');
  }

  return 'Review session status: ' + result.status;
}

/**
 * Format sentiment value for display.
 */
function formatSentiment(value: number): string {
  const labels: Record<string, string> = {
    '-2': 'Very Negative (-2)',
    '-1': 'Negative (-1)',
    '0': 'Neutral (0)',
    '1': 'Positive (+1)',
    '2': 'Very Positive (+2)',
  };
  const rounded = Math.round(value);
  return labels[String(rounded)] ?? `${value.toFixed(1)}`;
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * conduct_review tool definition.
 *
 * Facilitates structured qualitative review sessions covering 6 dimensions.
 */
export const conductReviewTool = tool(
  'conduct_review',
  TOOL_DESCRIPTIONS.conduct_review,
  conductReviewInputSchema,
  async (args) => {
    try {
      // Resolve baseline
      let baselineId = args.baselineId;
      if (!baselineId) {
        const latestBaseline = await getLatestBaseline();
        if (!latestBaseline) {
          const result: ConductReviewResult = {
            success: false,
            status: 'error',
            error: 'No baseline found. Run store_baseline first to create a baseline.',
          };
          return {
            content: [{ type: 'text' as const, text: formatToolOutput(result) }],
            _rawData: result,
          };
        }
        baselineId = latestBaseline.id;
      } else {
        // Verify baseline exists
        const baseline = await loadBaseline(baselineId);
        if (!baseline) {
          const result: ConductReviewResult = {
            success: false,
            status: 'error',
            error: `Baseline not found: ${baselineId}`,
          };
          return {
            content: [{ type: 'text' as const, text: formatToolOutput(result) }],
            _rawData: result,
          };
        }
      }

      // Get dimensions to review
      const dimensionsToReview: ReviewDimensionName[] =
        args.dimensions ?? (getDimensionNames() as ReviewDimensionName[]);

      let result: ConductReviewResult;

      if (args.mode === 'complete') {
        // Complete mode: store the review
        // Map responses to handle optional confidence properly
        const mappedResponses = (args.responses ?? []).map((r) => {
          const mapped: {
            name: ReviewDimensionName;
            response: string;
            sentiment: number;
            confidence?: 'high' | 'medium' | 'low';
          } = {
            name: r.name as ReviewDimensionName,
            response: r.response,
            sentiment: r.sentiment,
          };
          if (r.confidence) {
            mapped.confidence = r.confidence;
          }
          return mapped;
        });

        result = await completeReview(
          baselineId,
          dimensionsToReview,
          mappedResponses,
          args.triggerReason ?? 'manual',
          args.freeformNotes,
          args.themes ?? []
        );
      } else {
        // Initiate mode: return prompts
        result = initiateReview(baselineId, dimensionsToReview);
      }

      return {
        content: [{ type: 'text' as const, text: formatToolOutput(result) }],
        _rawData: result,
      };
    } catch (error) {
      const result: ConductReviewResult = {
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      return {
        content: [{ type: 'text' as const, text: formatToolOutput(result) }],
        _rawData: result,
      };
    }
  }
);

/**
 * Initiate a review session by returning prompts.
 */
function initiateReview(
  baselineId: string,
  dimensions: ReviewDimensionName[]
): ConductReviewResult {
  const prompts: ReviewPrompt[] = [];

  for (const dimName of dimensions) {
    const definition = getDimension(dimName);
    if (definition) {
      prompts.push({
        dimension: dimName,
        displayName: definition.displayName,
        promptText: definition.promptText,
        probeText: definition.probeText,
        sentimentScale: SENTIMENT_SCALE_DESCRIPTION,
      });
    }
  }

  return {
    success: true,
    status: 'prompting',
    baselineId,
    prompts,
  };
}

/**
 * Complete a review by storing responses.
 */
async function completeReview(
  baselineId: string,
  expectedDimensions: ReviewDimensionName[],
  responses: Array<{
    name: ReviewDimensionName;
    response: string;
    sentiment: number;
    confidence?: 'high' | 'medium' | 'low';
  }>,
  triggerReason: 'scheduled' | 'triggered' | 'manual',
  freeformNotes?: string,
  themes?: string[]
): Promise<ConductReviewResult> {
  // Validate we have responses for expected dimensions
  const responseNames = new Set(responses.map((r) => r.name));
  const missingDimensions = expectedDimensions.filter((d) => !responseNames.has(d));

  if (missingDimensions.length > 0) {
    return {
      success: false,
      status: 'error',
      error: `Missing responses for dimensions: ${missingDimensions.join(', ')}`,
    };
  }

  // Build review dimensions
  const reviewDimensions: ReviewDimension[] = responses.map((r) => {
    const definition = getDimension(r.name);
    const dimension: ReviewDimension = {
      name: r.name,
      promptText: definition?.promptText ?? '',
      response: r.response,
      sentiment: clampSentiment(r.sentiment),
    };
    if (r.confidence) {
      dimension.confidence = r.confidence;
    }
    return dimension;
  });

  // Calculate overall sentiment
  const overallSentiment = calculateOverallSentiment(reviewDimensions);

  // Create the review
  const review: QualitativeReview = {
    id: uuidv4(),
    baselineId,
    createdAt: new Date().toISOString(),
    dimensions: reviewDimensions,
    overallSentiment,
    themes: themes ?? [],
    triggerReason,
  };

  if (freeformNotes) {
    review.freeformNotes = freeformNotes;
  }

  // Save to file storage
  const filePath = await saveReview(review);

  // Index in SQLite
  const db = await getReviewIndexDb();
  indexReview(db, review, filePath);
  db.close();

  return {
    success: true,
    status: 'complete',
    review,
    baselineId,
  };
}

/**
 * Clamp sentiment to valid Likert scale values.
 */
function clampSentiment(value: number): -2 | -1 | 0 | 1 | 2 {
  const rounded = Math.round(value);
  if (rounded <= -2) return -2;
  if (rounded >= 2) return 2;
  return rounded as -2 | -1 | 0 | 1 | 2;
}
