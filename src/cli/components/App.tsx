/**
 * EP04 CLI Interface - App Root Component
 *
 * Root component for the Ink-based terminal UI.
 * Orchestrates the display of progress, findings, and summary.
 *
 * @module cli/components/App
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { Finding, StreamChunk } from '../../orchestration';
import { Progress } from './Progress';
import { FindingsList } from './FindingsList';
import { Summary } from './Summary';
import { useColors } from '../utils/colors';

/**
 * Analysis state for the App component.
 */
export interface AnalysisState {
  /** Current phase of analysis */
  phase: string;
  /** Whether analysis is currently running */
  isRunning: boolean;
  /** Accumulated findings */
  findings: Finding[];
  /** Progress message */
  message?: string;
  /** Progress percentage (0-100) */
  percent?: number;
  /** Elapsed time in milliseconds */
  elapsedMs?: number;
  /** Error if analysis failed */
  error?: string;
  /** Whether analysis completed successfully */
  completed: boolean;
}

/**
 * Props for the App component.
 */
export interface AppProps {
  /** Current analysis state */
  state: AnalysisState;
  /** Whether to show compact output */
  compact?: boolean;
  /** Whether to show recommendations */
  showRecommendations?: boolean;
}

/**
 * Initial state for a new analysis.
 */
export function createInitialState(): AnalysisState {
  return {
    phase: 'init',
    isRunning: false,
    findings: [],
    completed: false,
  };
}

/**
 * Update state from a stream chunk.
 *
 * @param state - Current state
 * @param chunk - Stream chunk to process
 * @returns Updated state
 */
export function updateStateFromChunk(state: AnalysisState, chunk: StreamChunk): AnalysisState {
  switch (chunk.type) {
    case 'phase_change':
      return {
        ...state,
        phase: (chunk.metadata?.['newPhase'] as string) ?? state.phase,
      };

    case 'finding': {
      const finding = chunk.metadata?.['finding'] as Finding | undefined;
      if (finding) {
        return {
          ...state,
          findings: [...state.findings, finding],
        };
      }
      return state;
    }

    case 'status':
      return {
        ...state,
        message: chunk.content,
      };

    case 'error':
      return {
        ...state,
        error: chunk.content,
        isRunning: false,
      };

    default:
      return state;
  }
}

/**
 * App root component for terminal UI.
 *
 * Displays:
 * - Progress spinner and current phase while running
 * - Findings as they are discovered
 * - Summary when analysis completes
 *
 * @example
 * ```tsx
 * const [state, setState] = useState(createInitialState());
 *
 * // Update state from orchestrator stream
 * for await (const chunk of orchestrator.run(task)) {
 *   setState(s => updateStateFromChunk(s, chunk));
 * }
 *
 * render(<App state={state} />);
 * ```
 */
export function App({
  state,
  compact = false,
  showRecommendations = false,
}: AppProps): React.ReactElement {
  const colors = useColors();

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={colors.info} bold>
          agentlint
        </Text>
      </Box>

      {/* Progress indicator while running */}
      {state.isRunning && (
        <Progress
          phase={state.phase}
          message={state.message}
          isActive={true}
          percent={state.percent}
          elapsedMs={state.elapsedMs}
        />
      )}

      {/* Findings list */}
      {state.findings.length > 0 && (
        <Box marginTop={1}>
          <FindingsList
            findings={state.findings}
            compact={compact}
            showRecommendations={showRecommendations}
          />
        </Box>
      )}

      {/* Summary when completed */}
      {state.completed && (
        <Summary
          findings={state.findings}
          elapsedMs={state.elapsedMs}
          success={!state.error}
          error={state.error}
        />
      )}
    </Box>
  );
}

export default App;
