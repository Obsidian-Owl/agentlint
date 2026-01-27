/**
 * Welcome Flow Orchestrator
 *
 * Runs the welcome flow on TUI startup:
 * 1. Load context with progress updates
 * 2. Generate/display welcome message
 * 3. Transition to analysis state
 *
 * @module cli/commands/welcome-flow
 */

import type { ITuiRenderer, LoadingStep } from '../../tui/types';
import type { LoadingStepId, WelcomeContext } from '../../tui/welcome/types';
import { loadWelcomeContext } from '../../tui/welcome/context-loader';
import { formatContextSummary } from '../../tui/welcome/welcome-prompt';

export interface WelcomeFlowOptions {
  projectPath?: string;
  gitTimeout?: number;
}

export interface WelcomeFlowResult {
  context: WelcomeContext;
  welcomeMessage: string;
}

const STEP_LABELS: Record<LoadingStepId, string> = {
  config: 'Configuration',
  baseline: 'Baseline',
  recommendations: 'Recommendations',
  git: 'Git status',
  session: 'Sessions',
};

function createLoadingSteps(): LoadingStep[] {
  const stepIds: LoadingStepId[] = ['config', 'baseline', 'recommendations', 'git', 'session'];
  return stepIds.map((id) => ({
    id,
    label: STEP_LABELS[id],
    status: 'pending' as const,
  }));
}

export async function runWelcomeFlow(
  tuiRenderer: ITuiRenderer,
  options: WelcomeFlowOptions = {}
): Promise<WelcomeFlowResult> {
  tuiRenderer.setTuiState('loading');
  tuiRenderer.setLoadingSteps(createLoadingSteps());

  const loaderOptions: Parameters<typeof loadWelcomeContext>[0] = {
    onProgress: (stepId, status, detail) => {
      tuiRenderer.updateLoadingStep(stepId, status, detail);
    },
  };
  if (options.projectPath) loaderOptions.projectPath = options.projectPath;
  if (options.gitTimeout) loaderOptions.gitTimeout = options.gitTimeout;

  const context = await loadWelcomeContext(loaderOptions);

  tuiRenderer.updateStatusBar({
    model: context.modelName,
    openRecommendations: context.openRecommendationCount,
    projectPath: context.projectPath,
    status: 'Ready',
  });

  const welcomeMessage = formatContextSummary(context);

  tuiRenderer.setTuiState('welcome');
  tuiRenderer.addConversationMessage({
    role: 'assistant',
    content: welcomeMessage,
    timestamp: new Date().toISOString(),
  });

  return { context, welcomeMessage };
}
