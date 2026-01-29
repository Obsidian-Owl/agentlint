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
import {
  formatContextSummary,
  generateMenuOptions,
  getWelcomeSystemPrompt,
  getWelcomeUserPrompt,
} from '../../tui/welcome/welcome-prompt';
import { OpencodeOrchestrator } from '../../opencode/orchestrator.js';
import { createToolRegistry } from '../../orchestration/tool-registry.js';

export interface WelcomeFlowOptions {
  projectPath?: string;
  gitTimeout?: number;
  useLlmGreeting?: boolean; // Opt-in: use LLM for greeting (default: false)
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

  let welcomeMessage: string;

  if (options.useLlmGreeting) {
    try {
      welcomeMessage = await generateLlmGreeting(context);
    } catch {
      // Fallback to static greeting on any error
      welcomeMessage = formatContextSummary(context);
    }
  } else {
    welcomeMessage = formatContextSummary(context);
  }
  const menuOptions = generateMenuOptions(context);

  tuiRenderer.setWelcomeMenu(menuOptions);
  tuiRenderer.setTuiState('welcome');
  tuiRenderer.addConversationMessage({
    role: 'assistant',
    content: welcomeMessage,
    timestamp: new Date().toISOString(),
  });

  return { context, welcomeMessage };
}

async function generateLlmGreeting(context: WelcomeContext): Promise<string> {
  const toolRegistry = createToolRegistry();
  const orchestrator = new OpencodeOrchestrator(
    { cwd: context.projectPath ?? process.cwd() },
    toolRegistry
  );

  const systemPrompt = getWelcomeSystemPrompt();
  const userPrompt = getWelcomeUserPrompt(context);

  let greeting = '';
  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
  }, 5000);

  try {
    // Pass system prompt separately to avoid it appearing in output
    for await (const chunk of orchestrator.run(userPrompt, { systemPrompt })) {
      if (timedOut) {
        break;
      }
      if (chunk.type === 'text') {
        greeting += chunk.content;
      }
    }

    if (timedOut) {
      throw new Error('Greeting timeout');
    }

    return greeting.trim() || formatContextSummary(context);
  } finally {
    clearTimeout(timeoutId);
    // CRITICAL: Always dispose orchestrator to prevent port conflicts
    orchestrator.dispose();
  }
}
