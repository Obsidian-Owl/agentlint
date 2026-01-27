/**
 * Analysis Prompt Builder
 *
 * Builds the system prompt for orchestrated analysis sessions.
 * Delegates to PromptKit analysis module, adding async recommendation loading.
 *
 * @module cli/commands/analyse-prompt
 */

import { resolve } from 'node:path';
import type { ScanResult } from './scan';
import type { AnalyseOptions } from './analyse';
import {
  loadRecommendationsForContext,
  getRecommendationsDir,
} from '../../recommendations/storage';
import type { RecommendationSummary } from '../../recommendations/types';
import { analysisPromptV1 } from '../../prompts/analysis';
import type { AnalysisContext } from '../../prompts/analysis';

export { buildContinuationPrompt } from '../../prompts/analysis';

const DEBUG_RECS = process.env['DEBUG']?.includes('agentlint:recs') ?? false;
function debugLog(message: string, data?: unknown): void {
  if (DEBUG_RECS) {
    const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : '';
    console.error(`[DEBUG:recs] ${message}${dataStr}`);
  }
}

async function buildExistingRecommendationsContext(directory: string): Promise<string> {
  const errors: string[] = [];
  const resolvedDir = resolve(directory);
  debugLog('Building recommendations context', { directory, resolvedDir });

  const dirsToCheck = [getRecommendationsDir(resolvedDir), getRecommendationsDir(process.cwd())];
  const uniqueDirs = [...new Set(dirsToCheck)];
  debugLog('Checking recommendation directories', { dirs: uniqueDirs });

  let summaries: RecommendationSummary[] = [];
  for (const baseDir of uniqueDirs) {
    try {
      debugLog('Loading from directory', { baseDir });
      const loaded = await loadRecommendationsForContext({
        baseDir,
        status: 'open',
        tokenBudget: 4000,
      });
      debugLog('Loaded recommendations', { baseDir, count: loaded.length });
      if (loaded.length > 0) {
        summaries = loaded;
        break;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`${baseDir}: ${errorMsg}`);
      debugLog('Error loading recommendations', { baseDir, error: errorMsg });
    }
  }

  if (summaries.length === 0) {
    const errorContext =
      errors.length > 0 ? `\n\n_Note: Failed to load from: ${errors.join(', ')}_` : '';

    debugLog('No recommendations found', { errors });
    return `## Existing Recommendations

No open recommendations found. Create new ones as needed, but avoid duplicating the same issue.${errorContext}`;
  }

  debugLog('Building recommendations table', { count: summaries.length });

  const lines: string[] = [
    `## Existing Open Recommendations (${summaries.length})`,
    '',
    '**Review these BEFORE creating new recommendations.** Use `get_recommendation` for full details.',
    '',
    '| ID | Type/Priority | Target | Action (summary) |',
    '|-----|---------------|--------|------------------|',
  ];

  for (const summary of summaries) {
    const shortId = summary.id.slice(0, 8);
    const typePriority = `${summary.type}/${summary.priority}`;
    const shortTarget =
      summary.target.length > 25 ? '...' + summary.target.slice(-22) : summary.target;
    const shortAction =
      summary.actionSummary.length > 40
        ? summary.actionSummary.slice(0, 37) + '...'
        : summary.actionSummary;
    lines.push(`| ${shortId} | ${typePriority} | \`${shortTarget}\` | ${shortAction} |`);
  }

  return lines.join('\n');
}

export async function buildAnalysisPrompt(
  directory: string,
  scanResult: ScanResult,
  options: AnalyseOptions & { promptVersion?: string }
): Promise<string> {
  const existingRecsContext = await buildExistingRecommendationsContext(directory);

  const ctx: AnalysisContext = {
    directory,
    scanResult,
    options,
    existingRecsContext,
  };

  const messages = analysisPromptV1.render(ctx);
  return messages[0]?.content ?? '';
}

export function buildFocusInstructions(options: AnalyseOptions): string {
  if (options.configOnly) {
    return `## Analysis Focus

You are running in **config-only mode**. Focus exclusively on configuration files.
Do not analyze session logs or git history.`;
  }

  if (options.sessionsOnly) {
    return `## Analysis Focus

You are running in **sessions-only mode**. Focus exclusively on session logs.
Do not analyze configuration files.`;
  }

  if (options.skills) {
    return `## Analysis Focus: Skills Effectiveness (EP14)

You are running in **skills-focused mode**. Analyze skill usage patterns and effectiveness.

**Primary Questions to Answer:**
1. Which skills are defined but rarely/never used?
2. Which sessions could have benefited from skill usage but didn't use any?
3. Are skill descriptions accurate and discoverable?
4. What patterns exist in skill invocation contexts?

**Workflow:**
1. Use \`get_skill_inventory\` to discover defined skills
2. Use \`index_skill_invocations\` to index skill usage from session logs
3. Use \`get_skill_invocations\` to query usage patterns
4. Use \`get_session_summaries\` to identify sessions without skill usage

**Key Metrics to Report:**
- Total skills defined vs. skills with invocations
- Invocation frequency per skill
- Sessions with/without skill usage
- User prompt patterns that trigger skill invocations

Per Constitution Principle VII: Tools return data, you reason about effectiveness.
The tools provide facts (counts, timestamps, patterns). You determine meaning.`;
  }

  return `## Analysis Focus

Analyze both configuration files and available session data.
Consider how configurations impact session effectiveness.`;
}
