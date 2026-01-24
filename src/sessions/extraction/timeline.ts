/**
 * EP15 Session Intelligence - Timeline Extraction
 *
 * Extract session timeline, intent, and outcome signals from session entries.
 * Per Constitution Principle VII: Functions return data, agent provides judgment.
 *
 * @module sessions/extraction/timeline
 */

import type { SessionEntry } from '../../tools/sessions/types';
import type {
  Intent,
  SessionOutcome,
  SessionTimeline,
  OutcomeSignals,
  ToolCallSummary,
  SessionMetrics,
} from '../types';

/**
 * Metadata required for timeline extraction.
 */
export interface TimelineMetadata {
  /** Session UUID */
  sessionId: string;
  /** Decoded project path */
  projectPath: string;
  /** Total input tokens */
  totalInputTokens: number;
  /** Total output tokens */
  totalOutputTokens: number;
  /** Cache tokens */
  cacheTokens: number;
  /** Number of compressions */
  compressionCount: number;
}

/**
 * Extract user intent from the first user message.
 *
 * Intent is the first user prompt with timestamp and length.
 * Per Constitution VII: This is data extraction, not judgment about intent quality.
 */
export function extractIntent(entries: SessionEntry[]): Intent {
  // Find first user entry
  const firstUser = entries.find((e) => e.type === 'user' && e.message?.role === 'user');

  if (!firstUser || !firstUser.message?.content) {
    return {
      firstUserPrompt: '',
      timestamp: firstUser?.timestamp ?? '',
      promptLength: 0,
    };
  }

  // Extract text from content blocks
  const textBlocks = firstUser.message.content.filter(
    (block) => block.type === 'text' && block.text
  );
  const fullText = textBlocks.map((block) => block.text ?? '').join('');

  return {
    firstUserPrompt: fullText,
    timestamp: firstUser.timestamp,
    promptLength: fullText.length,
  };
}

/**
 * Extract outcome signals from session entries.
 *
 * Signals are data points the agent can use to determine session success.
 * Per Constitution VII: We return signals, agent interprets meaning.
 */
export function extractOutcome(entries: SessionEntry[]): SessionOutcome {
  // Find last user message
  const userEntries = entries.filter((e) => e.type === 'user' && e.message?.role === 'user');
  const lastUser = userEntries[userEntries.length - 1];

  let lastUserPrompt: string | null = null;
  if (lastUser?.message?.content) {
    const textBlocks = lastUser.message.content.filter(
      (block) => block.type === 'text' && block.text
    );
    lastUserPrompt = textBlocks.map((block) => block.text ?? '').join('') || null;
  }

  // Find last tool call
  const lastToolCall = findLastToolCall(entries);

  // Check for commit activity
  const hasCommitActivity = checkCommitActivity(entries);

  // Count turns (user + assistant entries)
  const turnCount = entries.filter((e) => e.type === 'user' || e.type === 'assistant').length;

  // Extract outcome signals
  const signals = extractOutcomeSignals(entries, lastUserPrompt);

  return {
    lastUserPrompt,
    lastToolCall,
    hasCommitActivity,
    turnCount,
    signals,
  };
}

/**
 * Extract complete session timeline from entries and metadata.
 */
export function extractSessionTimeline(
  entries: SessionEntry[],
  metadata: TimelineMetadata
): SessionTimeline {
  const intent = extractIntent(entries);
  const outcome = extractOutcome(entries);

  // Find start and end times
  const timestamps = entries
    .map((e) => e.timestamp)
    .filter((t) => t)
    .sort();

  const startTime = timestamps[0] ?? '';
  const endTime = timestamps[timestamps.length - 1] ?? '';

  // Calculate duration
  let duration = 0;
  if (startTime && endTime) {
    duration = new Date(endTime).getTime() - new Date(startTime).getTime();
  }

  const metrics: SessionMetrics = {
    inputTokens: metadata.totalInputTokens,
    outputTokens: metadata.totalOutputTokens,
    cacheTokens: metadata.cacheTokens,
    compressionCount: metadata.compressionCount,
  };

  return {
    sessionId: metadata.sessionId,
    projectPath: metadata.projectPath,
    startTime,
    endTime,
    duration,
    turnCount: outcome.turnCount,
    intent,
    outcome,
    metrics,
  };
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Find the last tool call and its result.
 */
function findLastToolCall(entries: SessionEntry[]): ToolCallSummary | null {
  // Find all assistant entries with tool_use blocks
  const toolCalls: Array<{ name: string; entryIndex: number; toolUseId?: string }> = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry?.type === 'assistant' && entry.message?.content) {
      for (const block of entry.message.content) {
        if (block.type === 'tool_use' && block.name) {
          const toolCall: { name: string; entryIndex: number; toolUseId?: string } = {
            name: block.name,
            entryIndex: i,
          };
          if (block.id) {
            toolCall.toolUseId = block.id;
          }
          toolCalls.push(toolCall);
        }
      }
    }
  }

  if (toolCalls.length === 0) {
    return null;
  }

  const lastToolCall = toolCalls[toolCalls.length - 1];
  if (!lastToolCall) {
    return null;
  }

  // Look for corresponding tool result
  let success = true;
  for (let i = lastToolCall.entryIndex + 1; i < entries.length; i++) {
    const entry = entries[i];
    if (entry?.type === 'tool_result' && entry.toolResult) {
      // Found a tool result - check if it's an error
      if (entry.toolResult.isError) {
        success = false;
      }
      break;
    }
  }

  return {
    name: lastToolCall.name,
    success,
  };
}

/**
 * Check if session has git commit/push activity.
 */
function checkCommitActivity(entries: SessionEntry[]): boolean {
  for (const entry of entries) {
    if (entry.type === 'assistant' && entry.message?.content) {
      for (const block of entry.message.content) {
        if (block.type === 'tool_use' && block.name === 'Bash') {
          const command = block.input?.command;
          if (typeof command === 'string') {
            if (command.includes('git commit') || command.includes('git push')) {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

/**
 * Extract outcome signals from entries.
 */
function extractOutcomeSignals(
  entries: SessionEntry[],
  lastUserPrompt: string | null
): OutcomeSignals {
  const containsThanks = checkContainsThanks(lastUserPrompt);
  const containsDone = checkContainsDone(lastUserPrompt);
  const endsWithError = checkEndsWithError(entries);
  const hasUnresolvedError = checkHasUnresolvedError(entries);

  return {
    containsThanks,
    containsDone,
    endsWithError,
    hasUnresolvedError,
  };
}

/**
 * Check if last user message contains thanks.
 */
function checkContainsThanks(lastUserPrompt: string | null): boolean {
  if (!lastUserPrompt) return false;
  const lower = lastUserPrompt.toLowerCase();
  return lower.includes('thanks') || lower.includes('thank you');
}

/**
 * Check if last user message indicates done.
 */
function checkContainsDone(lastUserPrompt: string | null): boolean {
  if (!lastUserPrompt) return false;
  const lower = lastUserPrompt.toLowerCase();
  return lower.includes('done') || lower.includes("that's it") || lower.includes('perfect');
}

/**
 * Check if session ends with error in last tool result.
 */
function checkEndsWithError(entries: SessionEntry[]): boolean {
  // Find last tool_result entry
  const toolResults = entries.filter((e) => e.type === 'tool_result');
  const lastResult = toolResults[toolResults.length - 1];
  return lastResult?.toolResult?.isError === true;
}

/**
 * Check if there's an unresolved error (error with no subsequent success).
 */
function checkHasUnresolvedError(entries: SessionEntry[]): boolean {
  let lastErrorIndex = -1;
  let lastSuccessIndex = -1;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry?.type === 'tool_result' && entry.toolResult) {
      if (entry.toolResult.isError) {
        lastErrorIndex = i;
      } else {
        lastSuccessIndex = i;
      }
    }
  }

  // Unresolved if there's an error after the last success
  return lastErrorIndex > lastSuccessIndex && lastErrorIndex !== -1;
}
