/**
 * EP11 Quality & Security - Evaluation Type Definitions
 *
 * TypeScript interfaces for LLM-as-judge evaluation.
 *
 * @module eval/types
 */

// =============================================================================
// Golden Dataset
// =============================================================================

/**
 * Input data for a golden scenario.
 */
export interface GoldenInput {
  /** CLAUDE.md content */
  claudeMd: string;

  /** Project type (e.g., 'typescript', 'python-ml') */
  projectType: string;

  /** Optional session log excerpts */
  sessionLogs?: string;
}

/**
 * Expected properties for evaluation.
 */
export interface ExpectedProperties {
  /** Issues that MUST be detected */
  shouldDetect: string[];

  /** False positives to AVOID */
  shouldNotDetect: string[];

  /** Expected recommendation types */
  recommendationTypes: ('symptomatic' | 'preventive' | 'systemic')[];
}

/**
 * Weights for evaluation metrics.
 */
export interface RubricWeights {
  /** Weight for actionability (0-1) */
  actionability: number;

  /** Weight for causal accuracy (0-1) */
  causalAccuracy: number;

  /** Weight for relevance (0-1) */
  relevance: number;
}

/**
 * Scenario metadata.
 */
export interface ScenarioMetadata {
  /** When this scenario was added */
  addedAt: string;

  /** Original source URL (if from public repo) */
  sourceUrl?: string;

  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard';

  /** Descriptive tags */
  tags: string[];
}

/**
 * A test case for the evaluation framework.
 */
export interface GoldenScenario {
  /** Unique identifier */
  id: string;

  /** Schema version */
  version: string;

  /** Where this scenario came from */
  source: 'public-repo' | 'dogfood' | 'production-failure';

  /** Input data */
  input: GoldenInput;

  /** Expected properties */
  expectedProperties: ExpectedProperties;

  /** Metric weights */
  rubricWeights: RubricWeights;

  /** Additional metadata */
  metadata: ScenarioMetadata;
}

// =============================================================================
// Golden Dataset Manifest
// =============================================================================

/**
 * Manifest for the golden dataset.
 */
export interface GoldenManifest {
  /** Manifest version */
  version: string;

  /** Last update timestamp */
  updatedAt: string;

  /** Scenario files */
  scenarios: Array<{
    id: string;
    path: string;
    source: GoldenScenario['source'];
    difficulty: ScenarioMetadata['difficulty'];
    tags: string[];
  }>;

  /** Statistics */
  stats: {
    total: number;
    bySource: Record<string, number>;
    byDifficulty: Record<string, number>;
  };
}

// =============================================================================
// Evaluation Grades
// =============================================================================

/**
 * Code-based check results.
 */
export interface CodeBasedGrade {
  /** Whether all checks passed */
  passed: boolean;

  /** Individual check results */
  checks: {
    /** Output format is valid JSON */
    outputFormatValid: boolean;

    /** Required fields are present */
    requiredFieldsPresent: boolean;

    /** No hallucinated file references */
    noHallucinatedFiles: boolean;

    /** Each finding has a traced origin */
    causalChainComplete: boolean;
  };

  /** Additional check details */
  details?: Record<string, string>;
}

/**
 * LLM-as-judge evaluation results.
 */
export interface LLMJudgeGrade {
  /** Actionability score (0-1) */
  actionability: number;

  /** Causal accuracy score (0-1) */
  causalAccuracy: number;

  /** Relevance score (0-1) */
  relevance: number;

  /** Reasoning for each metric */
  reasoning: {
    actionability: string;
    causalAccuracy: string;
    relevance: string;
  };
}

/**
 * Combined evaluation grades.
 */
export interface EvaluationGrades {
  /** Code-based checks (always run) */
  codeBased: CodeBasedGrade;

  /** LLM-as-judge (only if code-based passes) */
  llmJudge?: LLMJudgeGrade;
}

// =============================================================================
// Evaluation Result
// =============================================================================

/**
 * Result of evaluating a single scenario.
 */
export interface EvaluationResult {
  /** Unique result identifier */
  id: string;

  /** Reference to the scenario */
  scenarioId: string;

  /** Evaluation timestamp */
  timestamp: string;

  /** Tier-by-tier grades */
  grades: EvaluationGrades;

  /** Overall weighted score (0-1) */
  overallScore: number;

  /** Whether the evaluation passed (>= threshold) */
  passed: boolean;

  /** Analysis output that was evaluated */
  analysisOutputSummary?: string;
}

/**
 * Aggregated evaluation results.
 */
export interface EvaluationSummary {
  /** Total scenarios evaluated */
  totalScenarios: number;

  /** Number that passed */
  passedScenarios: number;

  /** Pass rate (0-1) */
  passRate: number;

  /** Average scores by metric */
  averageScores: {
    actionability: number;
    causalAccuracy: number;
    relevance: number;
    overall: number;
  };

  /** Individual results */
  results: EvaluationResult[];

  /** Evaluation timestamp */
  timestamp: string;
}

// =============================================================================
// Thresholds
// =============================================================================

/**
 * Evaluation thresholds.
 */
export const EVAL_THRESHOLDS = {
  /** Minimum overall score to pass (70%) */
  PASS_THRESHOLD: 0.7,

  /** Target score for dogfooding (95%) */
  DOGFOOD_TARGET: 0.95,

  /** Default weights */
  DEFAULT_WEIGHTS: {
    actionability: 0.4,
    causalAccuracy: 0.3,
    relevance: 0.3,
  } satisfies RubricWeights,
} as const;

// =============================================================================
// Evaluation Runner Interface
// =============================================================================

/**
 * Interface for the evaluation runner.
 */
export interface IEvaluationRunner {
  /**
   * Load the golden dataset.
   */
  loadGoldenDataset(path: string): Promise<GoldenScenario[]>;

  /**
   * Evaluate a single scenario.
   */
  evaluateScenario(scenario: GoldenScenario, analysisOutput: unknown): Promise<EvaluationResult>;

  /**
   * Evaluate all scenarios in the dataset.
   */
  evaluateAll(
    scenarios: GoldenScenario[],
    analysisFn: (input: GoldenInput) => Promise<unknown>
  ): Promise<EvaluationSummary>;

  /**
   * Check if evaluation passes the release gate.
   */
  checkReleaseGate(summary: EvaluationSummary): boolean;
}

/**
 * Interface for code-based grader.
 */
export interface ICodeBasedGrader {
  /**
   * Run code-based checks.
   */
  grade(scenario: GoldenScenario, output: unknown): CodeBasedGrade;
}

/**
 * Interface for LLM-as-judge grader.
 */
export interface ILLMJudgeGrader {
  /**
   * Run LLM-as-judge evaluation.
   */
  grade(scenario: GoldenScenario, output: unknown): Promise<LLMJudgeGrade>;
}

// =============================================================================
// TruLens Integration
// =============================================================================

/**
 * TruLens subprocess configuration.
 */
export interface TruLensConfig {
  /** Path to Python executable */
  pythonPath: string;

  /** Path to TruLens config file */
  configPath: string;

  /** Database path for results */
  databasePath: string;

  /** Timeout in milliseconds */
  timeoutMs: number;
}

/**
 * TruLens evaluation request.
 */
export interface TruLensRequest {
  /** Scenario to evaluate */
  scenario: GoldenScenario;

  /** Analysis output */
  output: unknown;
}

/**
 * TruLens evaluation response.
 */
export interface TruLensResponse {
  /** Evaluation scores */
  scores: {
    actionability: number;
    causalAccuracy: number;
    relevance: number;
  };

  /** Reasoning */
  reasoning: Record<string, string>;

  /** Trace ID for debugging */
  traceId?: string;
}
