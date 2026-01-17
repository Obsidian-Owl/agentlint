/**
 * EP07 Causal Tracing Engine - Type Contracts
 *
 * Zod schemas and TypeScript types for causal chain entities.
 * These are design contracts - implementation will be in src/tools/causal/types.ts
 *
 * @module specs/ep07-causal-tracing-engine/contracts/types
 */

import { z } from 'zod';

// =============================================================================
// Enums
// =============================================================================

/**
 * Types of evidence that can support a causal chain.
 */
export const EvidenceTypeSchema = z.enum([
  'SessionMatch', // FTS5 search result from session logs
  'GitCorrelation', // git blame/pickaxe result
  'ConfigGap', // Missing configuration analysis
  'TemporalMarker', // Timestamp correlation evidence
  'ToolTrace', // Tool call pattern evidence
]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

/**
 * Categories of configuration gaps.
 */
export const GapTypeSchema = z.enum([
  'missing_config', // Configuration file or section missing
  'missing_example', // Example code/usage missing
  'missing_guidance', // Behavioral guidance missing
  'terminology_gap', // Domain terminology undefined
  'context_loss', // Context not preserved across sessions
  'other', // Unclassified gap
]);
export type GapType = z.infer<typeof GapTypeSchema>;

/**
 * Locations where configuration guidance can exist.
 */
export const GapLocationSchema = z.enum([
  'claude_md', // CLAUDE.md file
  'global_config', // ~/.claude/settings.json
  'project_config', // .claude/settings.json
  'mcp_config', // .mcp.json
  'skill', // .claude/skills/
  'other', // Other location
]);
export type GapLocation = z.infer<typeof GapLocationSchema>;

/**
 * Overall confidence level for a causal chain.
 */
export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

/**
 * How complete the trace is.
 */
export const TraceCompletenessSchema = z.enum(['full', 'partial']);
export type TraceCompleteness = z.infer<typeof TraceCompletenessSchema>;

// =============================================================================
// Position
// =============================================================================

/**
 * File location for evidence or issue.
 */
export const PositionSchema = z.object({
  /** Absolute or relative file path */
  filePath: z.string().min(1),
  /** Line number (1-indexed) */
  line: z.number().int().positive().optional(),
  /** Column number (1-indexed) */
  column: z.number().int().positive().optional(),
  /** Code/content snippet */
  snippet: z.string().optional(),
});
export type Position = z.infer<typeof PositionSchema>;

// =============================================================================
// EvidenceItem
// =============================================================================

/**
 * A single piece of evidence supporting a causal chain.
 */
export const EvidenceItemSchema = z.object({
  /** Unique identifier */
  id: z.string().uuid(),
  /** Category of evidence */
  type: EvidenceTypeSchema,
  /** Origin reference (session ID, commit hash, etc.) */
  source: z.string().min(1),
  /** When the evidence was created */
  timestamp: z.string().datetime().optional(),
  /** Relevant content snippet */
  content: z.string().optional(),
  /** File location if applicable */
  position: PositionSchema.optional(),
  /** Additional context */
  metadata: z.record(z.unknown()).optional(),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

// =============================================================================
// Gap
// =============================================================================

/**
 * A missing configuration element that enabled an issue.
 */
export const GapSchema = z.object({
  /** Category of gap */
  type: GapTypeSchema,
  /** Where guidance should exist */
  location: GapLocationSchema,
  /** What guidance was missing */
  expectedGuidance: z.string().min(1),
  /** "If X, Y wouldn't have occurred" */
  counterfactual: z.string().min(1),
});
export type Gap = z.infer<typeof GapSchema>;

// =============================================================================
// ConfidenceScore
// =============================================================================

/**
 * Validation checklist result for a causal chain.
 */
export const ConfidenceScoreSchema = z.object({
  /** Issue clearly links to specific trigger */
  specificity: z.boolean(),
  /** Timing supports causal relationship */
  temporal: z.boolean(),
  /** Plausible mechanism explains causation */
  mechanistic: z.boolean(),
  /** Evidence is direct, not inferred */
  evidenceQuality: z.boolean(),
  /** Pattern seen multiple times */
  reproducibility: z.boolean(),
  /** Alternative causes considered */
  alternatives: z.boolean(),
  /** Computed overall confidence */
  overall: ConfidenceLevelSchema,
});
export type ConfidenceScore = z.infer<typeof ConfidenceScoreSchema>;

/**
 * Compute overall confidence from factors.
 */
export function computeConfidenceLevel(factors: Omit<ConfidenceScore, 'overall'>): ConfidenceLevel {
  const score = [
    factors.specificity,
    factors.temporal,
    factors.mechanistic,
    factors.evidenceQuality,
    factors.reproducibility,
    factors.alternatives,
  ].filter(Boolean).length;

  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

// =============================================================================
// CausalChain
// =============================================================================

/**
 * The primary entity representing a traced causal path from issue to origin.
 */
export const CausalChainSchema = z.object({
  /** Unique identifier for the chain */
  id: z.string().uuid(),
  /** Reference to the detected issue (Finding.id) */
  issueId: z.string().min(1),
  /** The originating action/prompt */
  trigger: EvidenceItemSchema,
  /** Configuration gap that enabled the issue */
  gap: GapSchema.optional(),
  /** How the gap led to the issue */
  mechanism: z.string().min(1),
  /** The detected issue description */
  effect: z.string().min(1),
  /** Validation assessment */
  confidence: ConfidenceScoreSchema,
  /** All collected evidence (min 1) */
  evidence: z.array(EvidenceItemSchema).min(1),
  /** Number of traversal steps */
  depth: z.number().int().min(0).max(5),
  /** Whether max depth was hit */
  depthLimitReached: z.boolean(),
  /** Project where issue was detected */
  projectPath: z.string().min(1),
  /** When chain was created */
  createdAt: z.string().datetime(),
  /** "If X, then Y wouldn't have occurred" */
  counterfactual: z.string().optional(),
  /** Reference to associated IssuePattern */
  patternId: z.string().uuid().optional(),
});
export type CausalChain = z.infer<typeof CausalChainSchema>;

// =============================================================================
// IssuePattern
// =============================================================================

/**
 * Recurring issue type detected across sessions.
 */
export const IssuePatternSchema = z.object({
  /** Unique identifier */
  id: z.string().uuid(),
  /** Root cause category */
  category: GapTypeSchema,
  /** References to related CausalChains */
  chainIds: z.array(z.string().uuid()).min(1),
  /** Number of occurrences */
  frequency: z.number().int().positive(),
  /** true if frequency >= 3 */
  isSystemic: z.boolean(),
  /** Earliest chain timestamp */
  firstOccurrence: z.string().datetime(),
  /** Latest chain timestamp */
  lastOccurrence: z.string().datetime(),
  /** Scoped to project (null = global) */
  projectPath: z.string().optional(),
  /** Human-readable pattern description */
  summary: z.string().min(1),
});
export type IssuePattern = z.infer<typeof IssuePatternSchema>;

// =============================================================================
// TracedIssue
// =============================================================================

/**
 * An issue with its complete causal analysis (output structure).
 */
export const TracedIssueSchema = z.object({
  /** Reference to Finding.id */
  issueId: z.string().min(1),
  /** The traced causal chain */
  chain: CausalChainSchema,
  /** Preventive analysis */
  counterfactual: z.string().optional(),
  /** Linked pattern if recurring */
  patternId: z.string().uuid().optional(),
  /** Whether all evidence found */
  traceCompleteness: TraceCompletenessSchema,
  /** What couldn't be traced */
  limitations: z.array(z.string()).optional(),
});
export type TracedIssue = z.infer<typeof TracedIssueSchema>;

// =============================================================================
// Tool Input/Output Schemas
// =============================================================================

/**
 * Input schema for trace_issue_origin tool.
 */
export const TraceIssueInputSchema = z.object({
  /** Description of the issue to trace */
  issueDescription: z.string().min(1).describe('What the issue is'),
  /** Where the issue was detected */
  issueLocation: PositionSchema.optional().describe('File and line where issue was found'),
  /** Hints for session search */
  searchContext: z
    .object({
      /** Keywords to search for in sessions */
      keywords: z.array(z.string()),
      /** Only search sessions after this date */
      since: z.string().datetime().optional(),
      /** Only search sessions before this date */
      until: z.string().datetime().optional(),
    })
    .optional()
    .describe('Hints to narrow session search'),
  /** Maximum depth for chain traversal */
  maxDepth: z.number().int().min(1).max(5).optional().describe('Max traversal depth (default: 5)'),
});
export type TraceIssueInput = z.infer<typeof TraceIssueInputSchema>;

/**
 * Output schema for trace_issue_origin tool.
 */
export const TraceIssueOutputSchema = z.object({
  /** Whether tracing succeeded */
  success: z.boolean(),
  /** The traced issue with chain */
  result: TracedIssueSchema.optional(),
  /** Error message if failed */
  error: z.string().optional(),
});
export type TraceIssueOutput = z.infer<typeof TraceIssueOutputSchema>;

/**
 * Input schema for get_issue_patterns tool.
 */
export const GetPatternsInputSchema = z.object({
  /** Filter to specific project path */
  projectPath: z.string().optional().describe('Filter patterns to this project'),
  /** Minimum occurrences to include (default: 2) */
  minFrequency: z.number().int().min(1).optional().describe('Minimum pattern frequency'),
  /** Filter by root cause category */
  category: GapTypeSchema.optional().describe('Filter by gap category'),
  /** Whether to include resolved patterns */
  includeResolved: z.boolean().optional().describe('Include resolved patterns'),
});
export type GetPatternsInput = z.infer<typeof GetPatternsInputSchema>;

/**
 * Output schema for get_issue_patterns tool.
 */
export const GetPatternsOutputSchema = z.object({
  /** Whether query succeeded */
  success: z.boolean(),
  /** Matching patterns */
  patterns: z.array(IssuePatternSchema),
  /** Total pattern count (before filters) */
  totalCount: z.number().int(),
  /** Error message if failed */
  error: z.string().optional(),
});
export type GetPatternsOutput = z.infer<typeof GetPatternsOutputSchema>;
