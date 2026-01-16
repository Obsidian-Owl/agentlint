/**
 * EP04 CLI Interface - Contract Definitions
 *
 * This file defines the TypeScript interfaces for the CLI layer.
 * These types will be implemented in src/cli/ during implementation.
 *
 * @module specs/ep04-cli-interface/contracts
 */

import type {
  Finding,
  Recommendation,
  Severity,
  StreamChunk,
  VerbosityLevel,
} from '../../../src/orchestration/types';
import type { BaselineMetrics, BaselineSummary, Learning } from '../../../src/persistence/types';

// =============================================================================
// Output Format Types
// =============================================================================

/**
 * Output mode for CLI rendering.
 */
export type OutputMode = 'terminal' | 'json' | 'markdown' | 'plain';

/**
 * Output format configuration.
 */
export interface OutputFormat {
  /** Current output mode */
  mode: OutputMode;
  /** Whether stdout is a TTY */
  isTTY: boolean;
  /** Whether colors are supported */
  supportsColor: boolean;
  /** Terminal width in columns */
  terminalWidth: number;
}

/**
 * CLI configuration options.
 */
export interface CLIConfig {
  /** Output format settings */
  outputFormat: OutputFormat;
  /** Verbosity level (from EP02) */
  verbosity: VerbosityLevel;
  /** Exit with code 1 if findings present */
  failOnFindings: boolean;
  /** Working directory */
  cwd: string;
  /** Whether to use colors in output */
  colors: boolean;
}

// =============================================================================
// Command Types
// =============================================================================

/**
 * Common options available on all commands.
 */
export interface GlobalOptions {
  /** Output as JSON */
  json?: boolean;
  /** Output as Markdown */
  markdown?: boolean;
  /** Plain text output (no colors) */
  plain?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Exit 1 if findings present */
  failOnFindings?: boolean;
}

/**
 * Options for the analyse command.
 */
export interface AnalyseOptions extends GlobalOptions {
  /** Only analyze configuration */
  configOnly?: boolean;
  /** Only analyze sessions */
  sessionsOnly?: boolean;
}

/**
 * Options for the scan command.
 */
export interface ScanOptions extends GlobalOptions {
  /** Directory to scan (default: cwd) */
  directory?: string;
}

/**
 * Options for the baseline command.
 */
export interface BaselineOptions extends GlobalOptions {
  /** Label for the baseline */
  label?: string;
  /** Notes for the baseline */
  notes?: string;
}

/**
 * Options for the compare command.
 */
export interface CompareOptions extends GlobalOptions {
  /** Baseline ID or label to compare against */
  baseline?: string;
}

/**
 * Options for the trace command.
 */
export interface TraceOptions extends GlobalOptions {
  // Finding ID is a positional argument, not an option
}

/**
 * Options for the learn list subcommand.
 */
export interface LearnListOptions extends GlobalOptions {
  /** Filter by category */
  category?: 'patterns' | 'anti-patterns' | 'tools' | 'workflows';
  /** Filter by scope */
  scope?: 'project' | 'global';
}

/**
 * Options for the learn add subcommand.
 */
export interface LearnAddOptions extends GlobalOptions {
  /** Learning title */
  title: string;
  /** Learning content (Markdown) */
  content: string;
  /** Learning category */
  category: 'patterns' | 'anti-patterns' | 'tools' | 'workflows';
  /** Learning scope */
  scope?: 'project' | 'global';
}

/**
 * Options for the learn promote subcommand.
 */
export interface LearnPromoteOptions extends GlobalOptions {
  // Learning ID is a positional argument
}

// =============================================================================
// Progress & Display Types
// =============================================================================

/**
 * Analysis phases.
 */
export type AnalysisPhase =
  | 'init'
  | 'config'
  | 'sessions'
  | 'synthesis'
  | 'recommendations'
  | 'complete'
  | 'error';

/**
 * Progress state for UI display.
 */
export interface ProgressState {
  /** Current analysis phase */
  phase: AnalysisPhase;
  /** Index of current phase (0-based) */
  phaseIndex: number;
  /** Total number of phases */
  totalPhases: number;
  /** Progress percentage (0-100), undefined for indeterminate */
  percent?: number;
  /** Current status message */
  message: string;
  /** ISO-8601 start timestamp */
  startedAt: string;
  /** Elapsed time in milliseconds */
  elapsedMs: number;
}

/**
 * Finding formatted for terminal display.
 */
export interface FindingDisplay extends Finding {
  /** Emoji/icon for severity */
  severityIcon: string;
  /** ANSI color name for severity */
  severityColor: string;
  /** Formatted location string (file:line) */
  locationString?: string;
  /** Truncated description for narrow terminals */
  truncatedDescription?: string;
}

// =============================================================================
// Causal Tree Types
// =============================================================================

/**
 * A node in the causal chain tree.
 */
export interface CausalNode {
  /** Node type label (e.g., "Detected", "Origin") */
  label: string;
  /** Node content/description */
  content: string;
  /** Child nodes */
  children?: CausalNode[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Tree structure for trace visualization.
 */
export interface CausalTree {
  /** Root issue node */
  issue: CausalNode;
  /** Chain of origin nodes */
  originChain: CausalNode[];
  /** Final recommendation node */
  recommendation: CausalNode;
}

// =============================================================================
// Comparison Types
// =============================================================================

/**
 * Change in metrics between baseline and current.
 */
export interface DeltaMetrics {
  /** Change in total findings (+/-) */
  findingsCount: number;
  /** Change in critical findings */
  criticalCount: number;
  /** Change in high findings */
  highCount: number;
  /** Change in medium findings */
  mediumCount: number;
  /** Change in low findings */
  lowCount: number;
  /** Change in info findings */
  infoCount: number;
}

/**
 * Result of baseline comparison.
 */
export interface ComparisonResult {
  /** Reference baseline */
  baseline: BaselineSummary;
  /** Current metrics */
  current: BaselineMetrics;
  /** Difference metrics */
  delta: DeltaMetrics;
  /** Findings not in baseline */
  newFindings: Finding[];
  /** Findings in baseline but not current */
  resolvedFindings: Finding[];
  /** Overall status */
  status: 'improved' | 'regressed' | 'unchanged';
}

// =============================================================================
// JSON Output Types
// =============================================================================

/**
 * Schema for JSON output format.
 */
export interface JSONOutput {
  /** Output format version */
  format_version: '1.0';
  /** Command that was run */
  command: string;
  /** ISO-8601 execution timestamp */
  timestamp: string;
  /** Whether command succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Analysis findings */
  findings?: Finding[];
  /** Generated recommendations */
  recommendations?: Recommendation[];
  /** Aggregated metrics */
  metrics?: BaselineMetrics;
  /** Causal chain traces */
  causal_traces?: CausalTrace[];
}

/**
 * Causal trace in JSON output.
 */
export interface CausalTrace {
  /** Finding ID this trace belongs to */
  issue_id: string;
  /** Issue description */
  issue_description: string;
  /** Where the issue was detected */
  detected_at: {
    file: string;
    line?: number;
  };
  /** Chain of origin nodes */
  origin_trace: Array<{
    type: string;
    description: string;
    timestamp?: string;
  }>;
  /** IDs of associated recommendations */
  recommendation_ids: string[];
}

/**
 * Single line in JSON Lines streaming output.
 */
export type JSONStreamLine =
  | { type: 'progress'; timestamp: string; data: ProgressPayload }
  | { type: 'finding'; timestamp: string; data: Finding }
  | { type: 'error'; timestamp: string; data: ErrorPayload }
  | { type: 'complete'; timestamp: string; data: CompletePayload };

/**
 * Progress payload for JSON streaming.
 */
export interface ProgressPayload {
  phase: string;
  percent?: number;
  message: string;
}

/**
 * Error payload for JSON streaming.
 */
export interface ErrorPayload {
  message: string;
  code?: string;
}

/**
 * Complete payload for JSON streaming.
 */
export interface CompletePayload {
  findingsCount: number;
  duration: number;
  metrics: BaselineMetrics;
}

// =============================================================================
// Formatter Interfaces
// =============================================================================

/**
 * Interface for output formatters.
 */
export interface IOutputFormatter {
  /**
   * Format findings for output.
   */
  formatFindings(findings: Finding[]): string;

  /**
   * Format a single finding.
   */
  formatFinding(finding: Finding): string;

  /**
   * Format metrics summary.
   */
  formatMetrics(metrics: BaselineMetrics): string;

  /**
   * Format comparison result.
   */
  formatComparison(result: ComparisonResult): string;

  /**
   * Format causal tree.
   */
  formatCausalTree(tree: CausalTree): string;

  /**
   * Format error message.
   */
  formatError(error: Error): string;
}

/**
 * JSON formatter interface (extends base with streaming support).
 */
export interface IJSONFormatter extends IOutputFormatter {
  /**
   * Format a stream chunk as JSON Line.
   */
  formatStreamChunk(chunk: StreamChunk): string;

  /**
   * Format complete output as single JSON object.
   */
  formatComplete(output: JSONOutput): string;
}

// =============================================================================
// Command Handler Types
// =============================================================================

/**
 * Result from a command execution.
 */
export interface CommandResult {
  /** Whether command succeeded */
  success: boolean;
  /** Exit code to use */
  exitCode: number;
  /** Output data (for JSON mode) */
  data?: JSONOutput;
  /** Error if command failed */
  error?: Error;
}

/**
 * Interface for command handlers.
 */
export interface ICommandHandler<TOptions extends GlobalOptions = GlobalOptions> {
  /**
   * Execute the command.
   */
  execute(options: TOptions, args: string[]): Promise<CommandResult>;
}

// =============================================================================
// Ink Component Props
// =============================================================================

/**
 * Props for the main App component.
 */
export interface AppProps {
  /** Command being executed */
  command: string;
  /** CLI configuration */
  config: CLIConfig;
  /** Stream of chunks from orchestrator */
  chunks: AsyncIterable<StreamChunk>;
}

/**
 * Props for the Progress component.
 */
export interface ProgressProps {
  /** Current progress state */
  state: ProgressState;
}

/**
 * Props for the FindingsList component.
 */
export interface FindingsListProps {
  /** Findings to display */
  findings: FindingDisplay[];
  /** Maximum width for display */
  maxWidth: number;
}

/**
 * Props for the CausalTree component.
 */
export interface CausalTreeProps {
  /** Tree to render */
  tree: CausalTree;
  /** Maximum width for display */
  maxWidth: number;
}

/**
 * Props for the Summary component.
 */
export interface SummaryProps {
  /** Metrics to summarize */
  metrics: BaselineMetrics;
  /** Total analysis duration */
  duration: number;
}

/**
 * Props for the CompareView component.
 */
export interface CompareViewProps {
  /** Comparison result to display */
  result: ComparisonResult;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Severity icon mapping.
 */
export const SEVERITY_ICONS: Record<Severity, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🔵',
  info: '⚪',
};

/**
 * Severity color mapping (ANSI 4-bit colors).
 */
export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: 'red',
  high: 'yellow',
  medium: 'cyan',
  low: 'blue',
  info: 'white',
};

/**
 * Phase labels for display.
 */
export const PHASE_LABELS: Record<AnalysisPhase, string> = {
  init: 'Initializing',
  config: 'Analyzing configuration',
  sessions: 'Analyzing sessions',
  synthesis: 'Synthesizing findings',
  recommendations: 'Generating recommendations',
  complete: 'Analysis complete',
  error: 'Error occurred',
};
