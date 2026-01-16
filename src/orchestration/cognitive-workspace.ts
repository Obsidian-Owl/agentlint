/**
 * EP02 Orchestration Core - Cognitive Workspace
 *
 * Builds hierarchical context structure for agent reasoning.
 * The cognitive workspace maintains essential context across
 * context compressions and provides structured information
 * for the system prompt.
 *
 * Implementation tasks:
 * - T051: Create cognitive-workspace.ts with buildCognitiveWorkspace()
 * - T052: Integrate into systemPrompt.append
 *
 * @module orchestration/cognitive-workspace
 */

import type {
  SessionState,
  CognitiveWorkspace,
  ProgressSummary,
  FindingSummary,
  BaselineAwareness,
  Finding,
} from './types';

// =============================================================================
// Build Cognitive Workspace (T051)
// =============================================================================

/**
 * Build a cognitive workspace from session state.
 *
 * The workspace provides hierarchical context for agent reasoning:
 * 1. Task goal - what we're trying to accomplish
 * 2. Project context - where we're working
 * 3. Progress - how far we've gotten
 * 4. Findings - what we've discovered
 * 5. Baseline - comparison to previous analysis
 * 6. Learnings - relevant global insights
 *
 * @param state - Current session state
 * @param baseline - Previous analysis context (optional)
 * @param globalLearnings - Relevant learnings from other sessions (optional)
 * @returns Structured cognitive workspace
 *
 * @example
 * ```typescript
 * const workspace = buildCognitiveWorkspace(sessionState);
 * const prompt = formatWorkspaceForPrompt(workspace);
 * orchestrator.config.systemPromptAppend = prompt;
 * ```
 */
export function buildCognitiveWorkspace(
  state: SessionState,
  baseline: BaselineAwareness | null = null,
  globalLearnings: string[] = []
): CognitiveWorkspace {
  return {
    taskGoal: state.taskGoal,
    projectContext: state.projectContext,
    progress: createProgressSummary(state),
    findings: compressFindingsToSummary(state.findings),
    baselineAwareness: baseline,
    globalLearnings,
  };
}

// =============================================================================
// Progress Summary
// =============================================================================

/**
 * Create a progress summary from session state.
 *
 * @param state - Current session state
 * @returns Progress summary
 */
export function createProgressSummary(state: SessionState): ProgressSummary {
  const startTime = new Date(state.startedAt).getTime();
  const elapsedMs = Date.now() - startTime;

  return {
    currentPhase: state.phase,
    toolsInvoked: Object.keys(state.toolResultCache).length,
    findingsCount: state.findings.length,
    elapsedMs,
  };
}

// =============================================================================
// Findings Compression
// =============================================================================

/**
 * Compress full findings to summaries for cognitive workspace.
 *
 * Removes verbose fields (description, recommendations, location)
 * to minimize token usage while preserving essential information.
 *
 * @param findings - Full finding objects
 * @returns Compressed finding summaries
 */
export function compressFindingsToSummary(findings: Finding[]): FindingSummary[] {
  return findings.map((f) => ({
    id: f.id,
    type: f.type,
    severity: f.severity,
    title: f.title,
  }));
}

// =============================================================================
// Format for System Prompt (T052)
// =============================================================================

/**
 * Format cognitive workspace for system prompt injection.
 *
 * Creates a structured text representation that provides
 * the agent with hierarchical context awareness.
 *
 * @param workspace - Cognitive workspace to format
 * @returns Formatted string for system prompt
 *
 * @example
 * ```typescript
 * const workspace = buildCognitiveWorkspace(state, baseline);
 * const formatted = formatWorkspaceForPrompt(workspace);
 * // Returns:
 * // [Cognitive Workspace]
 * // Task Goal: Analyze CLAUDE.md for quality
 * // ...
 * // [End Cognitive Workspace]
 * ```
 */
export function formatWorkspaceForPrompt(workspace: CognitiveWorkspace): string {
  const sections: string[] = [];

  // Header
  sections.push('[Cognitive Workspace]');

  // Task goal
  sections.push(`Task Goal: ${workspace.taskGoal}`);

  // Project context
  sections.push('');
  sections.push('Project:');
  sections.push(`  Name: ${workspace.projectContext.name}`);
  sections.push(`  Path: ${workspace.projectContext.path}`);
  sections.push(`  Language: ${workspace.projectContext.primaryLanguage ?? 'unknown'}`);
  sections.push(`  Has CLAUDE.md: ${workspace.projectContext.hasClaudeMd ? 'yes' : 'no'}`);

  // Progress
  sections.push('');
  sections.push('Progress:');
  sections.push(`  Phase: ${workspace.progress.currentPhase}`);
  sections.push(`  Tools: ${workspace.progress.toolsInvoked}`);
  sections.push(`  Findings: ${workspace.progress.findingsCount}`);
  sections.push(`  Elapsed: ${formatElapsedTime(workspace.progress.elapsedMs)}`);

  // Findings
  if (workspace.findings.length > 0) {
    sections.push('');
    sections.push('Current Findings:');
    for (const finding of workspace.findings) {
      sections.push(`  - [${finding.severity.toUpperCase()}] ${finding.title}`);
    }
  }

  // Baseline awareness (if available)
  if (workspace.baselineAwareness) {
    sections.push('');
    sections.push('Baseline:');
    sections.push(`  Last Analysis: ${workspace.baselineAwareness.lastAnalysisDate}`);
    if (workspace.baselineAwareness.previousScore !== undefined) {
      sections.push(`  Previous Score: ${workspace.baselineAwareness.previousScore}`);
    }
    sections.push(`  Delta: ${workspace.baselineAwareness.deltaFindings} findings`);
    if (workspace.baselineAwareness.improvementAreas.length > 0) {
      sections.push(`  Focus Areas: ${workspace.baselineAwareness.improvementAreas.join(', ')}`);
    }
  }

  // Global learnings (if available)
  if (workspace.globalLearnings.length > 0) {
    sections.push('');
    sections.push('Global Learnings:');
    for (const learning of workspace.globalLearnings) {
      sections.push(`  - ${learning}`);
    }
  }

  // Footer
  sections.push('');
  sections.push('[End Cognitive Workspace]');

  return sections.join('\n');
}

/**
 * Format elapsed time for display.
 */
function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
