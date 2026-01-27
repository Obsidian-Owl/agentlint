/**
 * Welcome Context Types
 *
 * Types for the context gathered during welcome flow loading.
 * This context is used to generate a personalized LLM welcome message.
 *
 * @module tui/welcome/types
 */

// =============================================================================
// Welcome Context
// =============================================================================

/**
 * Git repository status summary for welcome context.
 */
export interface GitSummary {
  /** Current branch name */
  branch: string;
  /** Number of uncommitted changes (staged + unstaged) */
  uncommittedChanges: number;
  /** Whether there are unpushed commits */
  hasUnpushedCommits: boolean;
  /** Last commit message (truncated) */
  lastCommitMessage?: string | undefined;
  /** Time since last commit (human readable) */
  timeSinceLastCommit?: string | undefined;
}

/**
 * Context gathered during loading phase for welcome message generation.
 */
export interface WelcomeContext {
  /** Whether this is the first run (no config exists) */
  isFirstRun: boolean;

  /** Days since last baseline was captured (null if never) */
  daysSinceLastBaseline: number | null;

  /** Number of open (pending) recommendations */
  openRecommendationCount: number;

  /** Git repository summary (null if not a git repo or error) */
  gitSummary: GitSummary | null;

  /** Incomplete session from crash recovery (null if none) */
  incompleteSession: IncompleteSessionSummary | null;

  /** Project path being analyzed */
  projectPath: string;

  /** Configured model name */
  modelName: string;
}

/**
 * Summary of an incomplete session for crash recovery.
 */
export interface IncompleteSessionSummary {
  /** Session ID */
  id: string;
  /** When the session started */
  startedAt: string;
  /** Last checkpoint time */
  lastCheckpointAt: string;
  /** Phase when interrupted */
  phase: string;
  /** Number of findings so far */
  findingCount: number;
}

// =============================================================================
// Loading Progress
// =============================================================================

/**
 * IDs for loading steps (used for tracking and updates).
 */
export type LoadingStepId = 'config' | 'baseline' | 'recommendations' | 'git' | 'session';

/**
 * Result of a single context loading operation.
 */
export interface LoadingResult<T> {
  /** The loaded data (or null on error/skip) */
  data: T | null;
  /** Error message if loading failed */
  error?: string;
  /** Whether this step was skipped (vs failed) */
  skipped?: boolean;
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Callback for loading step progress updates.
 */
export type LoadingProgressCallback = (
  stepId: LoadingStepId,
  status: 'loading' | 'complete' | 'error' | 'skipped',
  detail?: string
) => void;

/**
 * Options for context loading.
 */
export interface ContextLoaderOptions {
  /** Project path (default: process.cwd()) */
  projectPath?: string;
  /** Timeout for git operations in ms (default: 500) */
  gitTimeout?: number;
  /** Callback for progress updates */
  onProgress?: LoadingProgressCallback;
}
