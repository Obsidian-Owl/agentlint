/**
 * Welcome Context Loader
 *
 * Loads context in parallel for the welcome message generation.
 * Each context source has a timeout and graceful error handling.
 *
 * @module tui/welcome/context-loader
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import type {
  WelcomeContext,
  IncompleteSessionSummary,
  ContextLoaderOptions,
  LoadingProgressCallback,
  LoadingStepId,
} from './types';
import { getGitSummary } from './git-summary';
import { getErrorSummary } from '../errors';

// Persistence imports
import { getLatestBaseline } from '../../persistence/baselines/storage';
import { findIncomplete } from '../../persistence/sessions/storage';
import { loadTrackingByStatus } from '../../persistence/tracking/storage';
import { loadConfig } from '../../orchestration/config';

// =============================================================================
// Constants
// =============================================================================

/** Config directory path */
const CONFIG_DIR = join(homedir(), '.agentlint');

/** Config file path */
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/** Default git timeout */
const DEFAULT_GIT_TIMEOUT = 500;

// =============================================================================
// Public API
// =============================================================================

/**
 * Load all welcome context in parallel with progress updates.
 *
 * Each context source is loaded independently with error handling.
 * Progress callbacks are fired as each source completes.
 *
 * @param options - Loading options
 * @returns Fully populated WelcomeContext
 */
export async function loadWelcomeContext(
  options: ContextLoaderOptions = {}
): Promise<WelcomeContext> {
  const projectPath = options.projectPath ?? process.cwd();
  const gitTimeout = options.gitTimeout ?? DEFAULT_GIT_TIMEOUT;
  const onProgress = options.onProgress ?? ((): void => {});

  // Initialize loading steps
  const stepIds: LoadingStepId[] = ['config', 'baseline', 'recommendations', 'git', 'session'];
  for (const stepId of stepIds) {
    onProgress(stepId, 'loading');
  }

  // Load config first (needed for model name, and very fast)
  const configResult = loadConfigContext(onProgress);

  // Load all other sources in parallel
  const [baselineResult, recommendationsResult, gitResult, sessionResult] = await Promise.all([
    loadBaselineContext(onProgress),
    loadRecommendationsContext(projectPath, onProgress),
    loadGitContext(projectPath, gitTimeout, onProgress),
    loadSessionContext(onProgress),
  ]);

  return {
    isFirstRun: configResult.isFirstRun,
    daysSinceLastBaseline: baselineResult.daysSince,
    openRecommendationCount: recommendationsResult.count,
    gitSummary: gitResult.summary,
    incompleteSession: sessionResult.session,
    projectPath,
    modelName: configResult.modelName,
  };
}

// =============================================================================
// Individual Loaders
// =============================================================================

interface ConfigResult {
  isFirstRun: boolean;
  modelName: string;
}

function loadConfigContext(onProgress: LoadingProgressCallback): ConfigResult {
  try {
    const isFirstRun = !existsSync(CONFIG_FILE);
    const config = loadConfig();
    const modelName = config.model;

    onProgress('config', 'complete', isFirstRun ? 'First run detected' : undefined);

    return { isFirstRun, modelName };
  } catch (error) {
    onProgress('config', 'error', getErrorSummary(error));
    return { isFirstRun: true, modelName: 'claude-sonnet-4-20250514' };
  }
}

interface BaselineResult {
  daysSince: number | null;
}

async function loadBaselineContext(onProgress: LoadingProgressCallback): Promise<BaselineResult> {
  try {
    const baseline = await getLatestBaseline();

    if (!baseline) {
      onProgress('baseline', 'complete', 'No baseline yet');
      return { daysSince: null };
    }

    const createdAt = new Date(baseline.createdAt);
    const now = new Date();
    const daysSince = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    const detail = daysSince === 0 ? 'Today' : `${daysSince} days ago`;
    onProgress('baseline', 'complete', detail);

    return { daysSince };
  } catch (error) {
    onProgress('baseline', 'error', getErrorSummary(error));
    return { daysSince: null };
  }
}

interface RecommendationsResult {
  count: number;
}

async function loadRecommendationsContext(
  _projectPath: string,
  onProgress: LoadingProgressCallback
): Promise<RecommendationsResult> {
  try {
    // Load pending recommendations (uses global tracking dir, projectPath reserved for future)
    const pending = await loadTrackingByStatus('pending');

    const count = pending.length;
    onProgress('recommendations', 'complete', count === 0 ? 'None open' : `${count} open`);

    return { count };
  } catch (error) {
    onProgress('recommendations', 'error', getErrorSummary(error));
    return { count: 0 };
  }
}

interface GitResult {
  summary: WelcomeContext['gitSummary'];
}

async function loadGitContext(
  projectPath: string,
  timeout: number,
  onProgress: LoadingProgressCallback
): Promise<GitResult> {
  try {
    const summary = await getGitSummary(projectPath, timeout);

    if (!summary) {
      onProgress('git', 'skipped', 'Not a git repository');
      return { summary: null };
    }

    const detail =
      summary.uncommittedChanges > 0
        ? `${summary.branch}, ${summary.uncommittedChanges} changes`
        : summary.branch;
    onProgress('git', 'complete', detail);

    return { summary };
  } catch (error) {
    onProgress('git', 'error', getErrorSummary(error));
    return { summary: null };
  }
}

interface SessionResult {
  session: IncompleteSessionSummary | null;
}

async function loadSessionContext(onProgress: LoadingProgressCallback): Promise<SessionResult> {
  try {
    const incomplete = await findIncomplete();

    if (incomplete.length === 0) {
      onProgress('session', 'complete', 'No incomplete sessions');
      return { session: null };
    }

    const mostRecent = incomplete[0]!;
    const session: IncompleteSessionSummary = {
      id: mostRecent.sessionId,
      startedAt: mostRecent.state.startedAt,
      lastCheckpointAt: mostRecent.lastCheckpointAt ?? mostRecent.state.startedAt,
      phase: mostRecent.state.phase,
      findingCount: mostRecent.state.findings?.length ?? 0,
    };

    onProgress('session', 'complete', `Found incomplete session (${session.phase})`);

    return { session };
  } catch (error) {
    onProgress('session', 'error', getErrorSummary(error));
    return { session: null };
  }
}

// =============================================================================
// Exports
// =============================================================================

export type { WelcomeContext, IncompleteSessionSummary, ContextLoaderOptions } from './types';
