/**
 * EP15 Session Intelligence - Quality Signal Extraction
 *
 * Extracts test, build, and lint outputs from Bash tool results.
 * Detects pass/fail/indeterminate status using pattern matching.
 *
 * Per Constitution Principle VII: Returns data (signals, raw output).
 * Agent interprets whether patterns indicate quality issues.
 *
 * @module sessions/extraction/quality-signals
 */

import type { SessionEntry, ContentBlock } from '../../tools/sessions/types';
import type { QualitySignalRecord, QualitySignalType, QualitySignalsSummary } from '../types';

// =============================================================================
// Pattern Definitions
// =============================================================================

/**
 * Command patterns to detect quality-related commands.
 */
const COMMAND_PATTERNS = {
  test: [
    /\bbun\s+(run\s+)?test\b/i,
    /\bnpm\s+(run\s+)?test\b/i,
    /\byarn\s+(run\s+)?test\b/i,
    /\bpnpm\s+(run\s+)?test\b/i,
    /\bpytest\b/i,
    /\bvitest\b/i,
    /\bjest\b/i,
    /\bmocha\b/i,
    /\bava\b/i,
    /\btape\b/i,
    /\bgo\s+test\b/i,
    /\bcargo\s+test\b/i,
  ],
  build: [
    /\btsc\b/i,
    /\bnpm\s+(run\s+)?build\b/i,
    /\byarn\s+(run\s+)?build\b/i,
    /\bpnpm\s+(run\s+)?build\b/i,
    /\bbun\s+(run\s+)?build\b/i,
    /\bvite\s+build\b/i,
    /\bwebpack\b/i,
    /\besbuild\b/i,
    /\brollup\b/i,
    /\bgo\s+build\b/i,
    /\bcargo\s+build\b/i,
    /\bmake\b/i,
  ],
  lint: [
    /\beslint\b/i,
    /\bbiome\s+(check|lint)\b/i,
    /\bprettier\s+--check\b/i,
    /\bpylint\b/i,
    /\bflake8\b/i,
    /\bruff\b/i,
    /\bgolangci-lint\b/i,
    /\bcargo\s+clippy\b/i,
    /\bnpm\s+(run\s+)?lint\b/i,
    /\byarn\s+(run\s+)?lint\b/i,
    /\bpnpm\s+(run\s+)?lint\b/i,
    /\bbun\s+(run\s+)?lint\b/i,
  ],
} as const;

/**
 * Output patterns to determine pass/fail status.
 */
const OUTPUT_PATTERNS = {
  test: {
    pass: [
      /\d+\s+pass/i, // bun, jest: "5 pass"
      /Tests:\s+\d+\s+passed/i, // jest: "Tests: 5 passed"
      /Test Files\s+\d+\s+passed/i, // vitest
      /\d+\s+passed\s+in/i, // pytest: "5 passed in 0.12s"
      /PASS\s+\S+/i, // jest: "PASS src/test.ts"
      /All tests passed/i,
      /\bOK\b.*\d+\s+tests?/i, // go: "OK  1 test"
      /test result: ok/i, // rust
    ],
    fail: [
      /[1-9]\d*\s+fail/i, // bun, jest: "1 fail" (not "0 fail")
      /Tests:\s+[1-9]\d*\s+failed/i, // jest
      /Test Files\s+[1-9]\d*\s+failed/i, // vitest
      /[1-9]\d*\s+failed\s+(,\s*\d+\s+passed\s+)?in/i, // pytest: "1 failed in" or "1 failed, 4 passed in"
      /FAIL\s+\S+/i, // jest: "FAIL src/test.ts"
      /AssertionError/i,
      /test result: FAILED/i, // rust
      /\bFAILED\b/i,
    ],
  },
  build: {
    pass: [
      /^$/m, // Empty output often means tsc success
      /Build\s+complete/i,
      /Successfully\s+compiled/i,
      /Compiled\s+successfully/i,
      /bundle\s+\d+\s+modules/i, // bun build
      /Done\s+in\s+[\d.]+/i, // yarn
      /built\s+in/i,
    ],
    fail: [
      /error\s+TS\d+/i, // TypeScript errors
      /Found\s+\d+\s+errors?/i,
      /npm\s+ERR!/i,
      /error:\s+could not compile/i, // rust
      /Build\s+failed/i,
      /Compilation\s+failed/i,
      /ERROR\s+in/i, // webpack
    ],
  },
  lint: {
    pass: [
      /^$/m, // Empty output often means lint success
      /No\s+fixes\s+needed/i, // biome
      /All\s+matched\s+files\s+use\s+Prettier/i,
      /No\s+issues\s+found/i,
      /0\s+errors?/i,
      /Checked\s+\d+\s+files.*No/i,
    ],
    fail: [
      /\d+\s+problems?\s*\(/i, // eslint: "2 problems (2 errors)"
      /\d+\s+errors?/i,
      /Code\s+style\s+issues\s+found/i, // prettier
      /Some\s+fixes\s+needed/i, // biome
      /lint\/\w+\/\w+/i, // biome rule paths
    ],
  },
} as const;

// =============================================================================
// Command Detection
// =============================================================================

/**
 * Detect if a command is a quality-related command.
 *
 * @param command - Bash command string
 * @returns Signal type if detected, undefined otherwise
 */
function detectCommandType(command: string): QualitySignalType | undefined {
  // Check in priority order: test > build > lint
  for (const pattern of COMMAND_PATTERNS.test) {
    if (pattern.test(command)) {
      return 'test';
    }
  }

  for (const pattern of COMMAND_PATTERNS.build) {
    if (pattern.test(command)) {
      return 'build';
    }
  }

  for (const pattern of COMMAND_PATTERNS.lint) {
    if (pattern.test(command)) {
      return 'lint';
    }
  }

  return undefined;
}

// =============================================================================
// Output Analysis
// =============================================================================

/**
 * Determine pass/fail status from command output.
 *
 * @param output - Command output text
 * @param signalType - Type of quality signal
 * @param isToolError - Whether tool_result had is_error=true
 * @returns true=passed, false=failed, null=indeterminate
 */
function analyzeOutput(
  output: string | undefined,
  signalType: QualitySignalType,
  isToolError: boolean
): boolean | null {
  // If tool returned with error flag, likely failed
  if (isToolError) {
    return false;
  }

  // No output - could be success (like tsc success) or pending
  if (!output || output.trim() === '') {
    // For build/lint, empty output typically means success
    if (signalType === 'build' || signalType === 'lint') {
      return true;
    }
    // For test, we need positive output
    return null;
  }

  const patterns = OUTPUT_PATTERNS[signalType];

  // For test outputs specifically, check for explicit "0 fail" pattern which indicates success
  if (signalType === 'test') {
    // "0 fail" means no failures - this is a pass
    if (/\b0\s+fail\b/i.test(output)) {
      // Also verify we have pass count
      if (/\d+\s+pass/i.test(output)) {
        return true;
      }
    }
  }

  // Check for pass patterns first
  for (const pattern of patterns.pass) {
    if (pattern.test(output)) {
      return true;
    }
  }

  // Check for failure patterns
  for (const pattern of patterns.fail) {
    if (pattern.test(output)) {
      return false;
    }
  }

  // Could not determine - return null for agent to interpret
  return null;
}

// =============================================================================
// Quality Signal Extraction
// =============================================================================

/**
 * Extract quality signals from session entries.
 *
 * Scans Bash tool calls for test/build/lint commands and analyzes
 * their outputs to determine pass/fail status.
 *
 * Per Constitution Principle VII: Returns raw output for agent
 * interpretation, not just pass/fail judgments.
 *
 * @param entries - Session entries from JSONL
 * @param sessionId - Session UUID
 * @returns Array of quality signal records
 *
 * @example
 * ```typescript
 * const signals = extractQualitySignals(entries, 'session-123');
 * // Returns: [{ signalType: 'test', passed: true, rawOutput: '5 pass' }]
 * ```
 */
export function extractQualitySignals(
  entries: SessionEntry[],
  sessionId: string
): QualitySignalRecord[] {
  const signals: QualitySignalRecord[] = [];

  // Build a map of tool_use_id -> tool result for matching
  const toolResults = new Map<string, { content: string; isError: boolean }>();
  for (const entry of entries) {
    if (entry.type === 'tool_result' && entry.toolResult) {
      const content =
        typeof entry.toolResult.content === 'string'
          ? entry.toolResult.content
          : JSON.stringify(entry.toolResult.content);
      toolResults.set(entry.toolResult.toolUseId, {
        content,
        isError: entry.toolResult.isError ?? false,
      });
    }
  }

  // Scan for Bash tool calls
  for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
    const entry = entries[entryIndex]!;

    if (entry.type !== 'assistant' || !entry.message?.content) {
      continue;
    }

    // Find Bash tool uses
    const bashBlocks = entry.message.content.filter(
      (
        block
      ): block is ContentBlock & {
        type: 'tool_use';
        name: 'Bash';
        input: Record<string, unknown>;
      } => block.type === 'tool_use' && block.name === 'Bash'
    );

    for (const block of bashBlocks) {
      const input = block.input ?? {};
      const command = typeof input.command === 'string' ? input.command : '';

      // Detect signal type from command
      const signalType = detectCommandType(command);
      if (!signalType) {
        continue;
      }

      // Get tool result if available
      const toolId = block.id ?? '';
      const result = toolResults.get(toolId);
      const rawOutput = result?.content;
      const isToolError = result?.isError ?? false;

      // Analyze output for pass/fail
      const passed = analyzeOutput(rawOutput, signalType, isToolError);

      // Create signal record
      const signal: QualitySignalRecord = {
        sessionId,
        signalType,
        timestamp: entry.timestamp,
        passed,
      };

      // Only add optional properties if they have values
      if (rawOutput !== undefined) {
        signal.rawOutput = rawOutput;
      }
      if (entry.filePath) {
        signal.filePath = entry.filePath;
      }
      if (entry.lineNumber !== undefined) {
        signal.lineNumber = entry.lineNumber;
      }

      signals.push(signal);
    }
  }

  return signals;
}

// =============================================================================
// Quality Signal Aggregation
// =============================================================================

/**
 * Aggregate quality signals into summary counts.
 *
 * Per Constitution Principle VII: Returns counts as data.
 * Agent interprets whether patterns indicate quality issues.
 *
 * @param signals - Quality signals from extractQualitySignals
 * @returns Aggregated summary counts
 *
 * @example
 * ```typescript
 * const summary = aggregateQualitySignals(signals);
 * // Returns: { testsPassed: 5, testsFailed: 1, testsIndeterminate: 0, ... }
 * ```
 */
export function aggregateQualitySignals(signals: QualitySignalRecord[]): QualitySignalsSummary {
  const summary: QualitySignalsSummary = {
    testsPassed: 0,
    testsFailed: 0,
    testsIndeterminate: 0,
    buildsPassed: 0,
    buildsFailed: 0,
    buildsIndeterminate: 0,
    lintsPassed: 0,
    lintsFailed: 0,
    lintsIndeterminate: 0,
  };

  for (const signal of signals) {
    switch (signal.signalType) {
      case 'test':
        if (signal.passed === true) {
          summary.testsPassed++;
        } else if (signal.passed === false) {
          summary.testsFailed++;
        } else {
          summary.testsIndeterminate++;
        }
        break;
      case 'build':
        if (signal.passed === true) {
          summary.buildsPassed++;
        } else if (signal.passed === false) {
          summary.buildsFailed++;
        } else {
          summary.buildsIndeterminate++;
        }
        break;
      case 'lint':
        if (signal.passed === true) {
          summary.lintsPassed++;
        } else if (signal.passed === false) {
          summary.lintsFailed++;
        } else {
          summary.lintsIndeterminate++;
        }
        break;
    }
  }

  return summary;
}
