/**
 * EP07 Causal Tracing Engine - Tools
 *
 * Public exports for causal tracing tools and types.
 *
 * @module src/tools/causal
 */

// Types and schemas
export {
  // Enums
  EvidenceTypeSchema,
  type EvidenceType,
  GapTypeSchema,
  type GapType,
  GapLocationSchema,
  type GapLocation,
  ConfidenceLevelSchema,
  type ConfidenceLevel,
  TraceCompletenessSchema,
  type TraceCompleteness,
  // Position
  PositionSchema,
  type Position,
  // Evidence
  EvidenceItemSchema,
  type EvidenceItem,
  // Gap
  GapSchema,
  type Gap,
  // Confidence
  ConfidenceScoreSchema,
  type ConfidenceScore,
  computeConfidenceLevel,
  // Chain
  CausalChainSchema,
  type CausalChain,
  // Pattern
  IssuePatternSchema,
  type IssuePattern,
  // Traced Issue
  TracedIssueSchema,
  type TracedIssue,
  // Tool I/O
  TraceIssueInputSchema,
  type TraceIssueInput,
  TraceIssueOutputSchema,
  type TraceIssueOutput,
  GetPatternsInputSchema,
  type GetPatternsInput,
  GetPatternsOutputSchema,
  type GetPatternsOutput,
} from './types.js';

// Evidence Collector
export {
  EvidenceCollector,
  createEvidenceCollector,
  FTS_ERROR_MESSAGES,
  classifySearchError,
  type CollectSessionEvidenceOptions,
  type CollectLocationEvidenceOptions,
  type CollectEvidenceResult,
} from './evidence-collector.js';

// Gap Analyzer
export {
  GapAnalyzer,
  createGapAnalyzer,
  type GapAnalysisOptions,
  type GapAnalysisResult,
} from './gap-analyzer.js';

// Chain Builder
export {
  ChainBuilder,
  createChainBuilder,
  buildCausalChain,
  DEFAULT_MAX_DEPTH,
  type ChainBuilderOptions,
  type ChainBuilderResult,
} from './chain-builder.js';

// Pattern Detector
export {
  PatternDetector,
  createPatternDetector,
  SYSTEMIC_THRESHOLD,
  type PatternDetectorOptions,
  type PatternDetectionResult,
} from './pattern-detector.js';

// Counterfactual Generator
export {
  CounterfactualGenerator,
  createCounterfactualGenerator,
  generateCounterfactual,
  type CounterfactualOptions,
} from './counterfactual.js';

// Confidence Assessor
export {
  ConfidenceAssessor,
  createConfidenceAssessor,
  assessConfidence,
  CONFIDENCE_THRESHOLDS,
  type AssessConfidenceInput,
} from './confidence.js';

// Git Evidence Collector
export {
  GitEvidenceCollector,
  createGitEvidenceCollector,
  type PickaxeOptions,
  type CollectEvidenceOptions,
  type GitEvidenceResult,
} from './git-evidence.js';

// Config Snapshot
export {
  ConfigSnapshot,
  createConfigSnapshot,
  captureConfigState,
  type ClaudeMdContent,
  type GuidanceItem,
  type ConfigChange,
  type ConfigDiff,
  type ConfigState,
} from './config-snapshot.js';

// Pattern Tracking
export {
  PatternTracker,
  createPatternTracker,
  SeverityLevel,
  type TrendDirection,
  type FrequencyRecord,
  type TrendAnalysis,
  type PatternAlert,
  type PatternSummary,
} from './pattern-tracking.js';

// SDK Tools
export { traceIssueOriginTool } from './trace-issue-tool.js';
export { getIssuePatternsTool } from './get-patterns-tool.js';
