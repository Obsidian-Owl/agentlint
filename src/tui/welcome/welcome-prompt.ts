/**
 * Welcome Prompt Generator
 *
 * Generates prompts for LLM-powered welcome messages based on context.
 * Personality: observant detective with dry wit - professional with understated humor.
 *
 * @module tui/welcome/welcome-prompt
 */

import type { WelcomeContext } from './types';

// =============================================================================
// Public API
// =============================================================================

/**
 * Generate the system prompt for welcome message generation.
 *
 * Establishes the personality and tone for the welcome agent.
 */
export function getWelcomeSystemPrompt(): string {
  return `You are the agentlint welcome assistant. Your job is to greet the user with a brief, personalized welcome message based on their current project state.

PERSONALITY:
- Observant detective with dry wit - you notice things and comment wryly
- Professional but not stiff - occasional understated humor is welcome
- Concise - 2-3 sentences max, no fluff
- Helpful - if there's something actionable (like incomplete session), mention it

TONE EXAMPLES:
- "Back on main with a clean slate. Ready when you are."
- "Three recommendations sitting patient. Feature branch looking busy - 12 changes pending."
- "First time here? Let's see what we're working with."
- "Looks like we got interrupted mid-analysis. Pick up where we left off?"

DO NOT:
- Use exclamation marks excessively
- Be overly enthusiastic or fake
- Use phrases like "Great to see you!" or "Welcome back!"
- Write more than 3 sentences
- Use emojis`;
}

/**
 * Generate the user prompt with context for welcome message.
 *
 * @param context - The loaded welcome context
 * @returns Prompt string for the LLM
 */
export function getWelcomeUserPrompt(context: WelcomeContext): string {
  const parts: string[] = ['Generate a brief welcome message based on this context:'];

  if (context.isFirstRun) {
    parts.push('- FIRST RUN: User has never run agentlint before');
  }

  if (context.daysSinceLastBaseline !== null) {
    if (context.daysSinceLastBaseline === 0) {
      parts.push('- Baseline captured today');
    } else if (context.daysSinceLastBaseline === 1) {
      parts.push('- Last baseline: yesterday');
    } else {
      parts.push(`- Last baseline: ${context.daysSinceLastBaseline} days ago`);
    }
  } else if (!context.isFirstRun) {
    parts.push('- No baseline captured yet');
  }

  if (context.openRecommendationCount > 0) {
    parts.push(`- Open recommendations: ${context.openRecommendationCount}`);
  }

  if (context.gitSummary) {
    const git = context.gitSummary;
    parts.push(`- Git branch: ${git.branch}`);
    if (git.uncommittedChanges > 0) {
      parts.push(`- Uncommitted changes: ${git.uncommittedChanges}`);
    }
    if (git.hasUnpushedCommits) {
      parts.push('- Has unpushed commits');
    }
    if (git.timeSinceLastCommit) {
      parts.push(`- Last commit: ${git.timeSinceLastCommit}`);
    }
  }

  if (context.incompleteSession) {
    const session = context.incompleteSession;
    parts.push(`- INCOMPLETE SESSION: Analysis was interrupted in "${session.phase}" phase`);
    parts.push(`  - Found ${session.findingCount} findings before interruption`);
    parts.push('  - Consider offering to resume');
  }

  parts.push('');
  parts.push('Remember: 2-3 sentences max, dry wit, no fluff.');

  return parts.join('\n');
}

/**
 * Format context into a human-readable summary for display.
 * Used as fallback when LLM is unavailable.
 *
 * @param context - The loaded welcome context
 * @returns Formatted summary string
 */
export function formatContextSummary(context: WelcomeContext): string {
  const parts: string[] = [];

  if (context.isFirstRun) {
    return "First time here. Let's see what we're working with.";
  }

  if (context.incompleteSession) {
    return `Previous analysis was interrupted in "${context.incompleteSession.phase}" phase. Resume or start fresh?`;
  }

  if (context.gitSummary) {
    const git = context.gitSummary;
    if (git.uncommittedChanges > 0) {
      parts.push(`${git.branch} with ${git.uncommittedChanges} uncommitted changes`);
    } else {
      parts.push(`On ${git.branch}`);
    }
  }

  if (context.openRecommendationCount > 0) {
    parts.push(`${context.openRecommendationCount} open recommendations`);
  }

  if (context.daysSinceLastBaseline !== null) {
    if (context.daysSinceLastBaseline > 7) {
      parts.push(`baseline ${context.daysSinceLastBaseline} days old`);
    }
  }

  if (parts.length === 0) {
    return 'Ready.';
  }

  return parts.join('. ') + '.';
}
