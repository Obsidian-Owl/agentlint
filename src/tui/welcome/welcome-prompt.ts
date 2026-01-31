/**
 * Welcome Prompt Generator
 *
 * Generates prompts for LLM-powered welcome messages based on context.
 *
 * @module tui/welcome/welcome-prompt
 */

import type { WelcomeContext } from './types';
import { buildPersonaBlock } from '../../prompts/components/persona';

// =============================================================================
// Menu Option Types
// =============================================================================

export interface WelcomeMenuOption {
  key: string;
  label: string;
  action: string;
}

// =============================================================================
// Menu Option Types (kept for type compatibility, agent generates options dynamically)
// =============================================================================

export function formatMenuSubtitle(context: WelcomeContext): string {
  const parts: string[] = [];

  if (context.gitSummary) {
    parts.push(context.gitSummary.branch);
    if (context.gitSummary.uncommittedChanges > 0) {
      parts.push(`${context.gitSummary.uncommittedChanges} uncommitted changes`);
    }
  }

  if (context.daysSinceLastBaseline !== null && context.daysSinceLastBaseline > 0) {
    const days = context.daysSinceLastBaseline;
    parts.push(`Last run: ${days} day${days === 1 ? '' : 's'} ago`);
  }

  if (context.openRecommendationCount > 0) {
    parts.push(`${context.openRecommendationCount} open recommendations`);
  }

  return parts.join(' • ');
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Generate the system prompt for welcome message generation.
 *
 * Establishes the personality and tone for the welcome agent.
 */
export function getWelcomeSystemPrompt(): string {
  return `You are the agentlint welcome assistant. Your job is to greet the user briefly and help them choose what to do next.

${buildPersonaBlock()}

ROLE BOUNDARIES - CRITICAL:

WHAT AGENTLINT DOES:
- Analyze session logs from past AI coding sessions
- Identify patterns in tool usage, skill effectiveness, and workflow
- Recommend configuration and workflow improvements
- Track recommendation outcomes and continuous improvement

WHAT AGENTLINT DOES NOT DO:
- Write, modify, or review code
- Fix lint errors, bugs, or tests
- Act as a coding assistant
- Review git diffs or uncommitted changes
- Debug application logic

IMPORTANT: After your brief greeting (1-2 sentences), you MUST use the AskUserQuestion tool to offer the user choices. Do NOT just list options in text - use the tool so the user can select interactively.

DECISION FREEDOM: You decide what options to present based on the context. Consider:
- Does the user have session logs to analyze? Offer session analysis.
- Are there open recommendations? Offer to review them.
- Is there an interrupted session? Offer to resume.
- Is this a first run? Offer a full baseline analysis.
- Is the configuration incomplete? Offer a config health check.

Present 2-4 relevant options based on what you discover in the context. You are NOT limited to a fixed list - adapt to what makes sense for this user's current state.`;
}

/**
 * Generate the user prompt with context for welcome message.
 *
 * @param context - The loaded welcome context
 * @returns Prompt string for the LLM
 */
export function getWelcomeUserPrompt(context: WelcomeContext): string {
  const parts: string[] = ['## Current Project State', '', 'Context:'];

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
    parts.push('  - Offer to resume as an option');
  }

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
