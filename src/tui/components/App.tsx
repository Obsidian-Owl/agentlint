/**
 * App Component - Root TUI Application
 *
 * The main application component that composes all sub-components
 * and provides the AppContext to the component tree.
 *
 * @module tui/components
 */

import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { Box, Text, useInput, useApp as useInkApp } from 'ink';

import { AppProvider, useAppState, useAppDispatch } from '../state/app-context';
import { AgentOutput } from './AgentOutput';
import { InputField } from './InputField';
import { Breadcrumbs } from './Breadcrumbs';
import { DialogOverlay } from './DialogOverlay';
import { PermissionDialog } from './PermissionDialog';
import { RecommendationDialog } from './RecommendationDialog';
import { QuestionDialog } from './QuestionDialog';
import { Progress } from './Progress';
import { FindingsList } from './FindingsList';
import { Summary } from './Summary';
import { StatusBar } from './StatusBar';
import { LoadingProgress } from './LoadingProgress';
import { ConversationHistory } from './ConversationHistory';
import type {
  AppProps,
  AppState,
  PermissionDecision,
  ExplorationStep,
  StreamState,
  DialogType,
  UserQuestion,
} from '../types';
import { createInitialState } from '../types';

// =============================================================================
// Inner App Component (uses context)
// =============================================================================

interface InnerAppProps {
  onInput?: ((input: string) => void) | undefined;
  onStart?: (() => void) | undefined;
  onExit?: (() => void) | undefined;
  streamState?: StreamState;
  propsPendingPermission?: { tool: string; description: string; pattern?: string } | null;
  propsPendingQuestions?: UserQuestion[] | null;
  propsViewStack?: DialogType[];
  onPermissionDecision?: (decision: PermissionDecision) => void;
  onQuestionAnswers?: (answers: Record<string, string>) => void;
}

function InnerApp({
  onInput,
  onExit,
  streamState,
  propsPendingPermission,
  propsPendingQuestions,
  propsViewStack,
  onPermissionDecision,
  onQuestionAnswers,
}: InnerAppProps): React.ReactElement {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { exit } = useInkApp();

  const [inputValue, setInputValue] = useState('');

  const [startTime] = useState(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);

  const { explorationPath, recommendations } = state;

  const streamBuffer = streamState?.streamBuffer ?? state.streamBuffer;
  const isStreaming = streamState?.isStreaming ?? state.isStreaming;
  const analysisPhase = streamState?.analysisPhase ?? state.analysisPhase;
  const findings = streamState?.findings ?? state.findings;
  const pendingPermission = propsPendingPermission ?? state.pendingPermission;
  const pendingQuestions = propsPendingQuestions ?? state.pendingQuestions;
  const viewStack = propsViewStack ?? state.viewStack;

  // Update elapsed time during streaming
  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(() => setElapsedMs(Date.now() - startTime), 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isStreaming, startTime]);

  // Current dialog type (top of stack)
  const currentDialog = viewStack.length > 0 ? viewStack[viewStack.length - 1] : null;

  /**
   * Handle input submission.
   */
  const handleInputSubmit = useCallback(
    (value: string) => {
      if (value.trim()) {
        onInput?.(value);
        setInputValue('');
        dispatch({ type: 'CLEAR_INPUT_BUFFER' });
      }
    },
    [onInput, dispatch]
  );

  /**
   * Handle input change.
   */
  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      dispatch({ type: 'UPDATE_INPUT_BUFFER', payload: { input: value } });
    },
    [dispatch]
  );

  /**
   * Handle breadcrumb navigation.
   */
  const handleBreadcrumbNavigate = useCallback(
    (_stepId: string) => {
      // Pop back to that step
      dispatch({ type: 'POP_EXPLORATION' });
    },
    [dispatch]
  );

  const handlePermissionDecision = useCallback(
    (decision: PermissionDecision) => {
      const key = decision.pattern ? `${decision.tool}:${decision.pattern}` : decision.tool;
      dispatch({ type: 'CACHE_PERMISSION', payload: { key, decision } });
      dispatch({ type: 'SET_PENDING_PERMISSION', payload: { permission: null } });
      dispatch({ type: 'POP_DIALOG' });
      onPermissionDecision?.(decision);
    },
    [dispatch, onPermissionDecision]
  );

  /**
   * Handle recommendation action.
   */
  const handleRecommendationAction = useCallback(
    (_action: 'accept' | 'dismiss' | 'defer') => {
      // Pop the dialog
      dispatch({ type: 'POP_DIALOG' });
    },
    [dispatch]
  );

  const handleQuestionSubmit = useCallback(
    (answers: Record<string, string>) => {
      dispatch({ type: 'SET_PENDING_QUESTIONS', payload: { questions: null } });
      dispatch({ type: 'POP_DIALOG' });
      onQuestionAnswers?.(answers);
    },
    [dispatch, onQuestionAnswers]
  );

  /**
   * Handle question cancel.
   */
  const handleQuestionCancel = useCallback(() => {
    // Clear pending questions
    dispatch({ type: 'SET_PENDING_QUESTIONS', payload: { questions: null } });
    // Pop the dialog
    dispatch({ type: 'POP_DIALOG' });
  }, [dispatch]);

  /**
   * Handle global keyboard input.
   */
  useInput(
    useCallback(
      (input: string, key: { escape?: boolean }) => {
        // Don't handle input when dialog is open
        if (currentDialog) return;

        // Exit on 'q'
        if (input === 'q') {
          onExit?.();
          exit();
          return;
        }

        // Escape dismisses current view
        if (key.escape) {
          if (explorationPath.length > 0) {
            dispatch({ type: 'POP_EXPLORATION' });
          }
        }
      },
      [currentDialog, explorationPath.length, onExit, exit, dispatch]
    )
  );

  // Get current recommendation for dialog
  const currentRecommendation = recommendations.length > 0 ? recommendations[0] : null;

  /**
   * Handle finding selection for exploration.
   */
  const handleFindingSelect = useCallback(
    (finding: { id: string; title: string; type: string }) => {
      const step: ExplorationStep = {
        id: crypto.randomUUID(),
        topic: finding.title,
        context: finding.type,
        timestamp: new Date().toISOString(),
        parentId: null,
      };
      dispatch({
        type: 'ADD_EXPLORATION_STEP',
        payload: { step },
      });
    },
    [dispatch]
  );

  const { statusBar } = state;

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
        <Text bold color="cyan">
          ⌬ agentlint
        </Text>
        {statusBar.model && <Text dimColor>{statusBar.model}</Text>}
      </Box>

      {/* Main content area */}
      <Box flexDirection="column" flexGrow={1} padding={1}>
        {/* Loading Progress (during initial context loading) */}
        {state.tuiState === 'loading' && state.loadingSteps.length > 0 && (
          <Box marginBottom={1}>
            <LoadingProgress steps={state.loadingSteps} title="Gathering context..." />
          </Box>
        )}

        {/* Breadcrumbs */}
        {explorationPath.length > 0 && (
          <Box marginBottom={1}>
            <Breadcrumbs steps={explorationPath} onNavigate={handleBreadcrumbNavigate} />
          </Box>
        )}

        {/* Progress (during scanning) */}
        {analysisPhase === 'scanning' && isStreaming && (
          <Box marginBottom={1}>
            <Progress phase={analysisPhase} isActive={true} elapsedMs={elapsedMs} />
          </Box>
        )}

        {/* Conversation History (when conversing or has history) */}
        {state.conversationHistory.length > 0 && (
          <ConversationHistory messages={state.conversationHistory} />
        )}

        {/* Agent Output */}
        <Box flexGrow={1} marginBottom={1}>
          <AgentOutput chunks={streamBuffer} isStreaming={isStreaming} />
        </Box>

        {/* Findings List (when presenting or exploring) */}
        {(analysisPhase === 'presenting' || analysisPhase === 'exploring') &&
          findings.length > 0 && (
            <Box marginBottom={1}>
              <FindingsList
                findings={findings}
                compact={analysisPhase !== 'exploring'}
                interactive={analysisPhase === 'exploring'}
                onSelect={handleFindingSelect}
              />
            </Box>
          )}

        {/* Summary (after analysis complete) */}
        {analysisPhase === 'presenting' && !isStreaming && findings.length > 0 && (
          <Box marginBottom={1}>
            <Summary findings={findings} elapsedMs={elapsedMs} success={true} />
          </Box>
        )}

        {/* Input Field */}
        <InputField
          value={inputValue}
          onChange={handleInputChange}
          onSubmit={handleInputSubmit}
          disabled={isStreaming}
          placeholder="Type your question or press q to quit..."
        />

        {/* Permission Dialog */}
        {currentDialog === 'permission' && pendingPermission && (
          <DialogOverlay title="Permission Required">
            <PermissionDialog
              tool={pendingPermission.tool}
              description={pendingPermission.description}
              {...(pendingPermission.pattern ? { pattern: pendingPermission.pattern } : {})}
              onDecision={handlePermissionDecision}
            />
          </DialogOverlay>
        )}

        {/* Recommendation Dialog */}
        {currentDialog === 'recommendation' && currentRecommendation && (
          <DialogOverlay title="Recommendation">
            <RecommendationDialog
              recommendation={currentRecommendation}
              onAction={handleRecommendationAction}
            />
          </DialogOverlay>
        )}

        {/* Question Dialog */}
        {currentDialog === 'question' && pendingQuestions && pendingQuestions.length > 0 && (
          <DialogOverlay title="Questions">
            <QuestionDialog
              questions={pendingQuestions}
              onSubmit={handleQuestionSubmit}
              onCancel={handleQuestionCancel}
            />
          </DialogOverlay>
        )}
      </Box>

      {/* Status Bar */}
      <StatusBar context={statusBar} />
    </Box>
  );
}

// =============================================================================
// App Component (provides context)
// =============================================================================

export function App({
  initialState,
  streamState,
  pendingPermission,
  pendingQuestions,
  viewStack,
  onInput,
  onStart: _onStart,
  onExit,
  onPermissionDecision,
  onQuestionAnswers,
}: AppProps): React.ReactElement {
  const mergedInitialState = useMemo(() => {
    const defaultState = createInitialState();
    return {
      ...defaultState,
      ...initialState,
    } as AppState;
  }, [initialState]);

  const innerProps: InnerAppProps = {};
  if (onInput) innerProps.onInput = onInput;
  if (onExit) innerProps.onExit = onExit;
  if (streamState) innerProps.streamState = streamState;
  if (pendingPermission !== undefined) innerProps.propsPendingPermission = pendingPermission;
  if (pendingQuestions !== undefined) innerProps.propsPendingQuestions = pendingQuestions;
  if (viewStack) innerProps.propsViewStack = viewStack;
  if (onPermissionDecision) innerProps.onPermissionDecision = onPermissionDecision;
  if (onQuestionAnswers) innerProps.onQuestionAnswers = onQuestionAnswers;

  return (
    <AppProvider initialState={mergedInitialState}>
      <InnerApp {...innerProps} />
    </AppProvider>
  );
}
