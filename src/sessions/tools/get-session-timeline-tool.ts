/**
 * EP15 Session Intelligence - get_session_timeline Tool
 *
 * SDK tool definition for extracting session timeline, intent, and outcome.
 * Uses extraction functions to process session entries.
 *
 * Per Constitution Principle VII: Returns data (timeline, signals),
 * agent provides interpretation.
 *
 * @module sessions/tools/get-session-timeline-tool
 */

import { adaptTool } from '../../opencode/tool-adapter';
import { z } from 'zod';
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { SessionEntry } from '../../tools/sessions/types';
import type { SessionTimeline } from '../types';
import { extractSessionTimeline } from '../extraction/timeline';
import { extractCompressionEvents } from '../extraction/compressions';
import { parseSessionLine } from '../../tools/sessions/parser';
import { resolveSessionIdentifier } from './session-resolver';

// =============================================================================
// Types
// =============================================================================

/**
 * Error details for session timeline extraction.
 */
export interface SessionTimelineError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** File path if applicable */
  filePath?: string;
  /** Suggestion for resolution */
  suggestion?: string;
}

/**
 * Input for getSessionTimeline function.
 */
export interface GetSessionTimelineInput {
  /** Path to session JSONL file */
  filePath: string;
  /** Decoded project path */
  projectPath: string;
}

/**
 * Result from getSessionTimeline function.
 */
export interface GetSessionTimelineResult {
  /** Whether extraction succeeded */
  success: boolean;
  /** The extracted timeline (if success) */
  timeline?: SessionTimeline;
  /** Error details (if failed) */
  error?: SessionTimelineError;
}

// =============================================================================
// Core Function
// =============================================================================

/**
 * Extract session timeline from a JSONL file.
 *
 * Parses the session file and extracts:
 * - Intent (first user prompt)
 * - Outcome signals (completion hints, errors)
 * - Token metrics
 * - Compression events
 *
 * @param input - File path and project path
 * @returns Timeline extraction result
 */
export async function getSessionTimeline(
  input: GetSessionTimelineInput
): Promise<GetSessionTimelineResult> {
  const { filePath, projectPath } = input;

  // Check file exists
  try {
    await access(filePath, constants.R_OK);
  } catch {
    return {
      success: false,
      error: {
        code: 'SESSION_FILE_NOT_FOUND',
        message: `Session file not found: ${filePath}`,
        filePath,
        suggestion: 'Verify the session ID is correct and the file has not been deleted.',
      },
    };
  }

  // Parse session file
  const entries: SessionEntry[] = [];
  let sessionId = 'unknown';
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let cacheTokens = 0;

  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const result = parseSessionLine(line, i + 1);
      if (result.success) {
        const entry = result.entry;
        entry.filePath = filePath;
        entry.lineNumber = i + 1;
        entries.push(entry);

        // Capture session ID from first entry
        if (entry.sessionId && sessionId === 'unknown') {
          sessionId = entry.sessionId;
        }

        // Aggregate token usage
        if (entry.message?.usage) {
          const usage = entry.message.usage;
          totalInputTokens += usage.input_tokens ?? 0;
          totalOutputTokens += usage.output_tokens ?? 0;
          cacheTokens += usage.cache_read_input_tokens ?? 0;
          cacheTokens += usage.cache_creation_input_tokens ?? 0;
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SESSION_FILE_UNREADABLE',
        message: `Failed to read session file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        suggestion: 'Check file permissions and ensure the file is valid JSONL.',
      },
    };
  }

  // Count compression events
  const compressionEvents = extractCompressionEvents(entries, sessionId);
  const compressionCount = compressionEvents.length;

  // Extract timeline using our extraction functions
  const timeline = extractSessionTimeline(entries, {
    sessionId,
    projectPath,
    totalInputTokens,
    totalOutputTokens,
    cacheTokens,
    compressionCount,
  });

  return {
    success: true,
    timeline,
  };
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Input schema for get_session_timeline tool.
 */
const getSessionTimelineInputSchema = {
  sessionIdentifier: z
    .string()
    .describe(
      'Session identifier: file path, session UUID (e.g., "session-abc123..."), or numeric ID'
    ),
};

/**
 * Format timeline for tool output.
 */
function formatToolOutput(timeline: SessionTimeline): string {
  const lines: string[] = [];

  lines.push(`## Session Timeline\n`);

  // Session info
  lines.push(`### Session Info\n`);
  lines.push(`- **Session ID**: ${timeline.sessionId}`);
  lines.push(`- **Project**: ${timeline.projectPath}`);
  lines.push(`- **Start**: ${timeline.startTime}`);
  lines.push(`- **End**: ${timeline.endTime}`);
  lines.push(`- **Duration**: ${formatDuration(timeline.duration)}`);
  lines.push(`- **Turns**: ${timeline.turnCount}`);
  lines.push('');

  // Intent
  lines.push(`### Intent\n`);
  if (timeline.intent.firstUserPrompt) {
    const prompt = timeline.intent.firstUserPrompt;
    const truncated = prompt.length > 200 ? prompt.slice(0, 200) + '...' : prompt;
    lines.push(`> ${truncated}`);
    lines.push('');
    lines.push(`- **Length**: ${timeline.intent.promptLength} characters`);
    lines.push(`- **Timestamp**: ${timeline.intent.timestamp}`);
  } else {
    lines.push('*No user prompt found*');
  }
  lines.push('');

  // Outcome
  lines.push(`### Outcome Signals\n`);
  const signals = timeline.outcome.signals;
  lines.push(`- **Contains thanks**: ${signals.containsThanks ? '✓' : '✗'}`);
  lines.push(`- **Contains done**: ${signals.containsDone ? '✓' : '✗'}`);
  lines.push(`- **Ends with error**: ${signals.endsWithError ? '✓' : '✗'}`);
  lines.push(`- **Has unresolved error**: ${signals.hasUnresolvedError ? '✓' : '✗'}`);
  lines.push(`- **Has commit activity**: ${timeline.outcome.hasCommitActivity ? '✓' : '✗'}`);

  if (timeline.outcome.lastToolCall) {
    lines.push('');
    lines.push(
      `**Last tool**: ${timeline.outcome.lastToolCall.name} (${timeline.outcome.lastToolCall.success ? 'success' : 'error'})`
    );
  }
  lines.push('');

  // Metrics
  lines.push(`### Token Metrics\n`);
  lines.push(`- **Input tokens**: ${formatNumber(timeline.metrics.inputTokens)}`);
  lines.push(`- **Output tokens**: ${formatNumber(timeline.metrics.outputTokens)}`);
  lines.push(`- **Cache tokens**: ${formatNumber(timeline.metrics.cacheTokens)}`);
  lines.push(`- **Compressions**: ${timeline.metrics.compressionCount}`);

  return lines.join('\n');
}

/**
 * Format duration in human-readable form.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Format large numbers with thousands separators.
 */
function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * get_session_timeline tool definition.
 *
 * Extracts session timeline, intent, and outcome signals from a session.
 *
 * @example
 * ```typescript
 * import { getSessionTimelineTool } from './sessions/tools/get-session-timeline-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(getSessionTimelineTool);
 * ```
 */
export const getSessionTimelineTool = adaptTool({
  name: 'get_session_timeline',
  description: `Extract session timeline, intent, and outcome signals from a Claude Code session.

Returns:
- **Intent**: First user prompt with timestamp and length
- **Outcome signals**: Hints for session completion (thanks, done, errors, commits)
- **Token metrics**: Input/output tokens, cache usage, compressions
- **Timeline**: Start/end times, duration, turn count

Use this tool to understand what a session was trying to accomplish and
whether it appears to have succeeded. The outcome signals are DATA for
your interpretation - you decide what they mean in context.

Example signals interpretation:
- containsThanks + containsDone → likely successful
- endsWithError + hasUnresolvedError → likely failed/abandoned
- hasCommitActivity → session produced code changes`,
  schema: getSessionTimelineInputSchema,
  handler: async (args: unknown) => {
    const typedArgs = args as { sessionIdentifier?: string };
    try {
      if (!typedArgs.sessionIdentifier) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: sessionIdentifier is required.',
            },
          ],
          isError: true,
        };
      }

      // Resolve session identifier to file path
      const resolved = resolveSessionIdentifier(typedArgs.sessionIdentifier);
      if (!resolved.success || !resolved.filePath) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error resolving session: ${resolved.error ?? 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }

      const result = await getSessionTimeline({
        filePath: resolved.filePath,
        projectPath: 'unknown', // TODO: Extract from file path or database
      });

      if (!result.success || !result.timeline) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Timeline extraction error: ${result.error?.message ?? 'Unknown error'}`,
            },
          ],
          isError: true,
          _rawData: result,
        };
      }

      const output = formatToolOutput(result.timeline);

      return {
        content: [
          {
            type: 'text' as const,
            text: output,
          },
        ],
        _rawData: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Error extracting session timeline: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  },
});
