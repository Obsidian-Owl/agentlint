/**
 * EP15 Session Intelligence - get_quality_signals Tool
 *
 * SDK tool definition for extracting quality signals (test/build/lint) from sessions.
 *
 * Per Constitution Principle VII: Returns data (signals, counts, raw output),
 * agent interprets whether quality patterns indicate issues.
 *
 * @module sessions/tools/get-quality-signals-tool
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { SessionEntry } from '../../tools/sessions/types';
import type { GetQualitySignalsOutput, QualitySignalType } from '../types';
import { extractQualitySignals, aggregateQualitySignals } from '../extraction/quality-signals';
import { parseSessionLine } from '../../tools/sessions/parser';

// =============================================================================
// Types
// =============================================================================

/**
 * Error details for quality signals extraction.
 */
export interface QualitySignalsError {
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
 * Input for getQualitySignals function.
 */
export interface GetQualitySignalsInput {
  /** Path to session JSONL file */
  filePath: string;
  /** Filter by signal type */
  signalType?: QualitySignalType;
}

/**
 * Result from getQualitySignals function.
 */
export interface GetQualitySignalsResult {
  /** Whether extraction succeeded */
  success: boolean;
  /** The extracted data (if success) */
  data?: GetQualitySignalsOutput;
  /** Error details (if failed) */
  error?: QualitySignalsError;
}

// =============================================================================
// Core Function
// =============================================================================

/**
 * Extract quality signals from a JSONL file.
 *
 * Parses the session file and extracts test/build/lint outputs:
 * - Signal type (test, build, lint)
 * - Pass/fail/indeterminate status
 * - Raw output for agent interpretation
 *
 * @param input - File path and query parameters
 * @returns Quality signals extraction result
 */
export async function getQualitySignals(
  input: GetQualitySignalsInput
): Promise<GetQualitySignalsResult> {
  const { filePath, signalType } = input;

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

  // Extract quality signals
  let signals = extractQualitySignals(entries, sessionId);

  // Apply filter
  if (signalType) {
    signals = signals.filter((s) => s.signalType === signalType);
  }

  // Aggregate
  const summary = aggregateQualitySignals(signals);

  return {
    success: true,
    data: {
      signals,
      summary,
    },
  };
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Input schema for get_quality_signals tool.
 */
const getQualitySignalsInputSchema = {
  sessionId: z.string().describe('The session UUID to analyze'),
  filePath: z
    .string()
    .optional()
    .describe('Direct path to session JSONL file (alternative to sessionId lookup)'),
  signalType: z.enum(['test', 'build', 'lint']).optional().describe('Filter by signal type'),
};

/**
 * Format quality signals for tool output.
 */
function formatToolOutput(data: GetQualitySignalsOutput): string {
  const lines: string[] = [];

  lines.push(`## Quality Signals\n`);

  // Summary
  lines.push(`### Summary\n`);

  const { summary } = data;
  const totalTests = summary.testsPassed + summary.testsFailed + summary.testsIndeterminate;
  const totalBuilds = summary.buildsPassed + summary.buildsFailed + summary.buildsIndeterminate;
  const totalLints = summary.lintsPassed + summary.lintsFailed + summary.lintsIndeterminate;

  if (totalTests > 0) {
    lines.push(
      `- **Tests**: ${summary.testsPassed} passed, ${summary.testsFailed} failed, ${summary.testsIndeterminate} indeterminate`
    );
  }
  if (totalBuilds > 0) {
    lines.push(
      `- **Builds**: ${summary.buildsPassed} passed, ${summary.buildsFailed} failed, ${summary.buildsIndeterminate} indeterminate`
    );
  }
  if (totalLints > 0) {
    lines.push(
      `- **Lint**: ${summary.lintsPassed} passed, ${summary.lintsFailed} failed, ${summary.lintsIndeterminate} indeterminate`
    );
  }

  if (totalTests === 0 && totalBuilds === 0 && totalLints === 0) {
    lines.push('*No quality signals detected*');
  }
  lines.push('');

  // Signals table
  lines.push(`### Signals (${data.signals.length})\n`);

  if (data.signals.length === 0) {
    lines.push('*No quality signals found*');
  } else {
    lines.push('| Type | Status | Output Preview |');
    lines.push('|------|--------|----------------|');

    for (const signal of data.signals) {
      const status =
        signal.passed === true ? '✓ passed' : signal.passed === false ? '✗ failed' : '? unclear';
      const preview = signal.rawOutput
        ? signal.rawOutput.length > 50
          ? signal.rawOutput.slice(0, 50).replace(/\n/g, ' ') + '...'
          : signal.rawOutput.replace(/\n/g, ' ')
        : '*no output*';
      lines.push(`| ${signal.signalType} | ${status} | ${preview} |`);
    }
  }
  lines.push('');

  // Failed signals detail
  const failures = data.signals.filter((s) => s.passed === false);
  if (failures.length > 0) {
    lines.push(`### Failed Signals (${failures.length})\n`);
    lines.push(`*Failed signals may indicate quality issues requiring attention.*\n`);

    for (const failure of failures) {
      lines.push(`#### ${failure.signalType.toUpperCase()} failure\n`);
      if (failure.rawOutput) {
        // Truncate to 500 chars max
        const truncated =
          failure.rawOutput.length > 500
            ? failure.rawOutput.slice(0, 500) + '\n...(truncated)'
            : failure.rawOutput;
        lines.push('```');
        lines.push(truncated);
        lines.push('```');
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * get_quality_signals tool definition.
 *
 * Extracts test, build, and lint outputs from a session.
 *
 * @example
 * ```typescript
 * import { getQualitySignalsTool } from './sessions/tools/get-quality-signals-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(getQualitySignalsTool);
 * ```
 */
export const getQualitySignalsTool = tool(
  'get_quality_signals',
  `Extract quality signals (test/build/lint outputs) from a Claude Code session.

Returns:
- **Signals**: Each Bash command that ran tests, builds, or linting
- **Status**: passed (true), failed (false), or indeterminate (null)
- **Raw output**: Full command output for your interpretation
- **Summary**: Counts by type and outcome

Use this tool to understand quality verification during a session.
Quality patterns are DATA for your interpretation:
- Failed tests may indicate regression or incomplete work
- Build failures suggest type or compilation issues
- Lint failures may indicate code style problems
- Multiple retries might indicate debugging iteration

Filter options:
- \`signalType\`: Focus on "test", "build", or "lint"`,
  getQualitySignalsInputSchema,
  async (args) => {
    try {
      // For now, require direct file path
      // TODO: Add session ID lookup via database
      if (!args.filePath) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: filePath is required. Session ID lookup not yet implemented.',
            },
          ],
          isError: true,
        };
      }

      // Build input conditionally to satisfy exactOptionalPropertyTypes
      const input: GetQualitySignalsInput = {
        filePath: args.filePath,
      };
      if (args.signalType !== undefined) {
        input.signalType = args.signalType;
      }

      const result = await getQualitySignals(input);

      if (!result.success || !result.data) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Quality signals extraction error: ${result.error?.message ?? 'Unknown error'}`,
            },
          ],
          isError: true,
          _rawData: result,
        };
      }

      const output = formatToolOutput(result.data);

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
            text: `Error extracting quality signals: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);
