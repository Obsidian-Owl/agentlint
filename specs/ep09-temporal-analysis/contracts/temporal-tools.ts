/**
 * EP09 Temporal Analysis - Tool Contracts
 *
 * Defines the interface for temporal analysis tools following
 * the Claude Agent SDK `tool()` pattern per ADR-0005.
 *
 * @module specs/ep09-temporal-analysis/contracts
 */

import { z } from 'zod';
import type {
  BaselineDelta,
  TrendAnalysis,
  QualitativeReview,
  ReviewDimensionName,
} from './temporal-types';

// =============================================================================
// Zod Schemas for Tool Inputs
// =============================================================================

/**
 * Schema for store_baseline tool input.
 */
export const StoreBaselineInputSchema = z.object({
  label: z
    .string()
    .optional()
    .describe('Optional label for this baseline (e.g., "Post-CLAUDE.md rewrite")'),
  notes: z.string().optional().describe('Optional notes about this baseline'),
  includeSessionMetrics: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include session metrics from EP06 analysis'),
});

export type StoreBaselineInput = z.infer<typeof StoreBaselineInputSchema>;

/**
 * Schema for query_baseline tool input.
 */
export const QueryBaselineInputSchema = z.object({
  id: z.string().optional().describe('Baseline UUID, or omit for "latest"'),
  includeFindings: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include full findings array (increases response size)'),
});

export type QueryBaselineInput = z.infer<typeof QueryBaselineInputSchema>;

/**
 * Schema for list_baselines tool input.
 */
export const ListBaselinesInputSchema = z.object({
  limit: z.number().optional().default(20).describe('Maximum number of baselines to return'),
  after: z.string().optional().describe('Only return baselines after this ISO-8601 date'),
  before: z.string().optional().describe('Only return baselines before this ISO-8601 date'),
  label: z.string().optional().describe('Filter by label (partial match)'),
  orderBy: z
    .enum(['createdAt', 'findingsCount'])
    .optional()
    .default('createdAt')
    .describe('Sort field'),
  order: z.enum(['asc', 'desc']).optional().default('desc').describe('Sort direction'),
});

export type ListBaselinesInput = z.infer<typeof ListBaselinesInputSchema>;

/**
 * Schema for calculate_delta tool input.
 */
export const CalculateDeltaInputSchema = z.object({
  fromId: z.string().describe('UUID of the older baseline'),
  toId: z.string().describe('UUID of the newer baseline (or "latest")'),
  includeGitCommits: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include git commits between baselines'),
  detailedDiff: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include full jsondiffpatch delta (verbose)'),
});

export type CalculateDeltaInput = z.infer<typeof CalculateDeltaInputSchema>;

/**
 * Schema for query_trends tool input.
 */
export const QueryTrendsInputSchema = z.object({
  metrics: z
    .array(z.string())
    .optional()
    .describe('Specific metrics to analyze (default: all)'),
  afterDate: z.string().optional().describe('Analyze baselines after this ISO-8601 date'),
  beforeDate: z.string().optional().describe('Analyze baselines before this ISO-8601 date'),
  minBaselines: z
    .number()
    .optional()
    .default(3)
    .describe('Minimum baselines required for trend analysis'),
  includeQualitative: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include qualitative review trends'),
  includeCorrelations: z
    .boolean()
    .optional()
    .default(true)
    .describe('Correlate trends with git commits'),
});

export type QueryTrendsInput = z.infer<typeof QueryTrendsInputSchema>;

/**
 * Schema for conduct_review tool input.
 */
export const ConductReviewInputSchema = z.object({
  baselineId: z
    .string()
    .optional()
    .describe('Baseline to attach review to (default: latest)'),
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
});

export type ConductReviewInput = z.infer<typeof ConductReviewInputSchema>;

/**
 * Schema for get_review_history tool input.
 */
export const GetReviewHistoryInputSchema = z.object({
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
});

export type GetReviewHistoryInput = z.infer<typeof GetReviewHistoryInputSchema>;

// =============================================================================
// Tool Result Types
// =============================================================================

/**
 * Result from store_baseline tool.
 */
export interface StoreBaselineResult {
  success: boolean;
  baselineId: string;
  createdAt: string;
  label?: string;
  metrics: {
    findingsCount: number;
    warningCount: number;
    avgTokensPerSession?: number;
  };
  message: string;
}

/**
 * Result from query_baseline tool.
 */
export interface QueryBaselineResult {
  found: boolean;
  baseline?: {
    id: string;
    createdAt: string;
    projectPath: string;
    actType: string;
    gitCommit?: string;
    label?: string;
    metrics: Record<string, number>;
    findingsCount: number;
    findings?: unknown[];
  };
  message?: string;
}

/**
 * Result from list_baselines tool.
 */
export interface ListBaselinesResult {
  baselines: Array<{
    id: string;
    createdAt: string;
    label?: string;
    gitCommit?: string;
    findingsCount: number;
    criticalCount: number;
    highCount: number;
  }>;
  total: number;
  hasMore: boolean;
}

/**
 * Result from calculate_delta tool.
 */
export interface CalculateDeltaResult {
  success: boolean;
  delta?: BaselineDelta;
  error?: string;
}

/**
 * Result from query_trends tool.
 */
export interface QueryTrendsResult {
  success: boolean;
  analysis?: TrendAnalysis;
  error?: string;
  insufficientData?: {
    baselines: number;
    required: number;
    message: string;
  };
}

/**
 * Partial result during conduct_review - represents a single dimension prompt.
 */
export interface ReviewPrompt {
  dimension: ReviewDimensionName;
  promptText: string;
  previousResponse?: string;
  sentimentScale: string;
}

/**
 * Result from conduct_review tool.
 */
export interface ConductReviewResult {
  success: boolean;
  review?: QualitativeReview;
  prompts?: ReviewPrompt[];
  status: 'prompting' | 'complete' | 'error';
  error?: string;
}

/**
 * Result from get_review_history tool.
 */
export interface GetReviewHistoryResult {
  reviews: Array<{
    id: string;
    baselineId: string;
    createdAt: string;
    overallSentiment: number;
    themes: string[];
    triggerReason?: string;
  }>;
  total: number;
  hasMore: boolean;
}

// =============================================================================
// Tool Descriptions (for SDK registration)
// =============================================================================

/**
 * Rich tool descriptions following ADR-0005 guidelines.
 * These are used when registering tools with the Claude Agent SDK.
 */
export const TOOL_DESCRIPTIONS = {
  store_baseline: `
Store a baseline snapshot of the current project state.

Use this tool when you need to:
- Capture a point-in-time snapshot for future comparison
- Mark a milestone (e.g., "before refactoring", "after config update")
- Establish a baseline for tracking improvement over time

The baseline includes:
- Analysis findings and metrics
- Configuration analysis results
- Session statistics (if available)
- Git commit reference for correlation

Returns the baseline ID for future reference.
  `.trim(),

  query_baseline: `
Retrieve a baseline snapshot by ID or get the latest baseline.

Use this tool when you need to:
- Get the most recent baseline for comparison
- Retrieve a specific historical baseline by ID
- Access baseline metrics for trend analysis

Returns structured baseline data with metrics.
Set includeFindings=true for full findings array (larger response).
  `.trim(),

  list_baselines: `
List available baseline snapshots with filtering and sorting.

Use this tool when you need to:
- See the history of baselines for a project
- Find baselines in a date range
- Look up baselines by label

Returns summary information without full findings.
Use query_baseline with specific ID for full details.
  `.trim(),

  calculate_delta: `
Calculate the difference between two baselines.

Use this tool when you need to:
- Compare current state to a previous baseline
- Identify what improved or regressed
- See the magnitude and direction of changes

Returns:
- Metric changes with direction indicators (↑ ↓ →)
- Warnings added/resolved
- Recommendations added/resolved
- Overall trend classification

Set includeGitCommits=true to see commits in the date range.
  `.trim(),

  query_trends: `
Analyze trends across multiple baselines over time.

Use this tool when you need to:
- See improvement trajectory over time
- Identify when trends changed direction (inflection points)
- Correlate changes with git commits
- Compare quantitative and qualitative trends

Requires at least 3 baselines (configurable via minBaselines).
Returns insufficient data message if not enough baselines exist.
  `.trim(),

  conduct_review: `
Facilitate a structured qualitative review session.

Use this tool when you need to:
- Capture user's subjective experience with AI-assisted workflow
- Gather context that metrics alone cannot reveal
- Build qualitative trend data over time

The review covers 6 dimensions:
1. Perceived Friction - Where friction occurs
2. Trust Calibration - How user verifies AI suggestions
3. Task Fit - What tasks work well/poorly
4. Configuration Confidence - Confidence in CLAUDE.md
5. Improvement Attribution - What changes made difference
6. Workflow Satisfaction - Overall satisfaction

Each dimension uses a Likert scale (-2 to +2).
Review is attached to a baseline for correlation.
  `.trim(),

  get_review_history: `
Retrieve qualitative review history for trend analysis.

Use this tool when you need to:
- See how sentiment has evolved over time
- Compare qualitative trends with quantitative metrics
- Find reviews for specific baselines or time ranges

Returns review summaries with sentiment and themes.
Use query_trends for integrated quantitative/qualitative analysis.
  `.trim(),
} as const;
