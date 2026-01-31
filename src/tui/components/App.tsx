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
import { QuitDialog } from './QuitDialog';
import { Progress } from './Progress';
import { FindingsList } from './FindingsList';
import { Summary } from './Summary';
import { StatusBar } from './StatusBar';
import { LoadingProgress } from './LoadingProgress';
import { ConversationHistory } from './ConversationHistory';
import { ActionMenu } from './ActionMenu';
import { AgentStateIndicator } from './AgentStateIndicator';
import { SessionSummary } from './SessionSummary';
import { TopRecommendation } from './TopRecommendation';
import { FeedbackPrompt } from './FeedbackPrompt';
import { ProgressStats } from './ProgressStats';
import { formatMenuSubtitle } from '../welcome/welcome-prompt';
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
  onInput?: ((input: string) => void | Promise<void>) | undefined;
  onStart?: (() => void) | undefined;
  onExit?: (() => void | Promise<void>) | undefined;
  onMenuSelect?: ((action: string) => void) | undefined;
  streamState?: StreamState;
  propsPendingPermission?: { tool: string; description: string; pattern?: string } | null;
  propsPendingQuestions?: UserQuestion[] | null;
  propsViewStack?: DialogType[];
  propsTuiState?: AppState['tuiState'];
  propsWelcomeMenuOptions?: AppState['welcomeMenuOptions'];
  propsLoadingSteps?: AppState['loadingSteps'];
  propsConversationHistory?: AppState['conversationHistory'];
  propsStatusBar?: AppState['statusBar'];
  onPermissionDecision?: (decision: PermissionDecision) => void;
  onQuestionAnswers?: (answers: Record<string, string>) => void;
  onRecommendationAction?: (
    recommendationId: string,
    action: 'accept' | 'dismiss' | 'defer'
  ) => void;
}

function InnerApp({
  onInput,
  onExit,
  onMenuSelect,
  streamState,
  propsPendingPermission,
  propsPendingQuestions,
  propsViewStack,
  propsTuiState,
  propsWelcomeMenuOptions,
  propsLoadingSteps,
  propsConversationHistory,
  propsStatusBar,
  onPermissionDecision,
  onQuestionAnswers,
  onRecommendationAction,
}: InnerAppProps): React.ReactElement {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { exit } = useInkApp();

  const [inputValue, setInputValue] = useState('');
  const [showQuitDialog, setShowQuitDialog] = useState(false);

  const [startTime] = useState(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);

  const { explorationPath, recommendations } = state;

  // Props override internal state (for controlled rendering from InkRenderer)
  const tuiState = propsTuiState ?? state.tuiState;
  const welcomeMenuOptions = propsWelcomeMenuOptions ?? state.welcomeMenuOptions;
  const loadingSteps = propsLoadingSteps ?? state.loadingSteps;
  const conversationHistory = propsConversationHistory ?? state.conversationHistory;
  const statusBar = propsStatusBar ?? state.statusBar;

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

  // Auto-flush queued input when streaming stops
  useEffect(() => {
    if (!isStreaming && state.queuedInput) {
      const queued = state.queuedInput;
      dispatch({ type: 'FLUSH_QUEUED_INPUT' });
      void onInput?.(queued);
    }
  }, [isStreaming, state.queuedInput, onInput, dispatch]);

  // Current dialog type (top of stack)
  const currentDialog = viewStack.length > 0 ? viewStack[viewStack.length - 1] : null;

  /**
   * Handle input submission.
   */
  const handleInputSubmit = useCallback(
    (value: string) => {
      if (value.trim()) {
        if (isStreaming) {
          // Queue input to be sent after agent completes
          dispatch({ type: 'QUEUE_INPUT', payload: { input: value } });
          setInputValue('');
        } else {
          void onInput?.(value);
          setInputValue('');
          dispatch({ type: 'CLEAR_INPUT_BUFFER' });
        }
      }
    },
    [isStreaming, onInput, dispatch]
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
   * TEL-001: Emit telemetry for recommendation acceptance/rejection.
   */
  const handleRecommendationAction = useCallback(
    (action: 'accept' | 'dismiss' | 'defer') => {
      // Find the current recommendation
      const currentRecommendation = recommendations[0];
      if (currentRecommendation) {
        // Generate deterministic ID from recommendation content
        const recommendationId = `${currentRecommendation.type}-${currentRecommendation.action.slice(0, 30).replace(/\s+/g, '-')}`;
        onRecommendationAction?.(recommendationId, action);
      }

      // Pop the dialog
      dispatch({ type: 'POP_DIALOG' });
    },
    [dispatch, recommendations, onRecommendationAction]
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
        // Don't handle input when dialog is open (except quit dialog which handles its own input)
        if (currentDialog) return;
        if (showQuitDialog) return;

        if (input.toLowerCase() === 'q') {
          setShowQuitDialog(true);
          return;
        }

        // Escape dismisses current view
        if (key.escape) {
          if (explorationPath.length > 0) {
            dispatch({ type: 'POP_EXPLORATION' });
          }
        }
      },
      [currentDialog, showQuitDialog, explorationPath.length, dispatch]
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

  return (
    <Box flexDirection="column">
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
        {tuiState === 'loading' && loadingSteps.length > 0 && (
          <Box marginBottom={1}>
            <LoadingProgress steps={loadingSteps} title="Gathering context..." />
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
        {conversationHistory.length > 0 && <ConversationHistory messages={conversationHistory} />}

        {/* Welcome screen with visual hierarchy */}
        {tuiState === 'welcome' && (
          <>
            {/* Top Recommendation - HERO SECTION (most prominent) */}
            {state.topRecommendation && (
              <Box marginBottom={2}>
                <TopRecommendation
                  recommendation={state.topRecommendation}
                  onApply={(id) => onMenuSelect?.(`apply-recommendation:${id}`)}
                  onDismiss={(id) => onMenuSelect?.(`dismiss-recommendation:${id}`)}
                  onDetails={(id) => onMenuSelect?.(`recommendation-details:${id}`)}
                  disabled={isStreaming}
                />
              </Box>
            )}

            {/* Context Bar - compact inline (session + progress) */}
            {(state.lastSession || state.progressStats) && (
              <Box flexDirection="column" marginBottom={1}>
                {state.lastSession && (
                  <SessionSummary
                    lastSession={state.lastSession}
                    gitSummary={null}
                    openRecommendations={statusBar.openRecommendations}
                  />
                )}
                {state.progressStats && <ProgressStats stats={state.progressStats} />}
              </Box>
            )}

            {/* Action Menu - simplified (reduced visual weight) */}
            {welcomeMenuOptions.length > 0 && (
              <Box marginBottom={1}>
                <ActionMenu
                  title="agentlint"
                  subtitle={formatMenuSubtitle({
                    isFirstRun: false,
                    daysSinceLastBaseline: null,
                    openRecommendationCount: statusBar.openRecommendations,
                    gitSummary: null,
                    incompleteSession: null,
                    projectPath: statusBar.projectPath,
                    modelName: statusBar.model,
                  })}
                  options={welcomeMenuOptions}
                  onSelect={(action) => {
                    if (onMenuSelect) {
                      onMenuSelect(action);
                    }
                  }}
                  disabled={isStreaming}
                />
              </Box>
            )}
          </>
        )}

        {/* Agent State Indicator (during analysis) */}
        {state.agentWorkState.phase !== 'idle' && (
          <Box marginBottom={1}>
            <AgentStateIndicator state={state.agentWorkState} />
          </Box>
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

        {/* Feedback Prompt (after analysis, when pending) */}
        {state.pendingFeedback && !isStreaming && (
          <Box marginBottom={1}>
            <FeedbackPrompt
              recommendationTitle={state.pendingFeedback.recommendationTitle}
              recommendationId={state.pendingFeedback.recommendationId}
              onHelpful={(id) => {
                dispatch({ type: 'SET_PENDING_FEEDBACK', payload: { feedback: null } });
                onMenuSelect?.(`feedback-helpful:${id}`);
              }}
              onNotHelpful={(id) => {
                dispatch({ type: 'SET_PENDING_FEEDBACK', payload: { feedback: null } });
                onMenuSelect?.(`feedback-not-helpful:${id}`);
              }}
              onSkip={(id) => {
                dispatch({ type: 'SET_PENDING_FEEDBACK', payload: { feedback: null } });
                onMenuSelect?.(`feedback-skip:${id}`);
              }}
              disabled={isStreaming}
            />
          </Box>
        )}

        {/* Input Field */}
        <InputField
          value={inputValue}
          onChange={handleInputChange}
          onSubmit={handleInputSubmit}
          disabled={tuiState === 'welcome' && welcomeMenuOptions.length > 0}
          placeholder="Type your question or press q to quit..."
          disabledPlaceholder={
            tuiState === 'welcome' && welcomeMenuOptions.length > 0
              ? 'Use number keys to select an option...'
              : 'Agent is working, please wait...'
          }
          queuedInput={state.queuedInput}
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

        {/* Quit Confirmation Dialog */}
        {showQuitDialog && (
          <DialogOverlay title="Confirm Quit">
            <QuitDialog
              onConfirm={() => {
                // Wait for cleanup to complete before exiting
                // onExit may be async (saves session, stops orchestrator)
                const exitPromise = Promise.resolve(onExit?.());
                void exitPromise
                  .then(() => {
                    exit();
                    // Fallback: force exit if Ink's exit doesn't work
                    setTimeout(() => process.exit(0), 100);
                  })
                  .catch(() => {
                    exit();
                    setTimeout(() => process.exit(1), 100);
                  });
              }}
              onCancel={() => setShowQuitDialog(false)}
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
  tuiState,
  welcomeMenuOptions,
  loadingSteps,
  conversationHistory,
  statusBar,
  onInput,
  onStart: _onStart,
  onExit,
  onMenuSelect,
  onPermissionDecision,
  onQuestionAnswers,
  onRecommendationAction,
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
  if (tuiState) innerProps.propsTuiState = tuiState;
  if (welcomeMenuOptions) innerProps.propsWelcomeMenuOptions = welcomeMenuOptions;
  if (loadingSteps) innerProps.propsLoadingSteps = loadingSteps;
  if (conversationHistory) innerProps.propsConversationHistory = conversationHistory;
  if (statusBar) innerProps.propsStatusBar = statusBar;
  if (onPermissionDecision) innerProps.onPermissionDecision = onPermissionDecision;
  if (onQuestionAnswers) innerProps.onQuestionAnswers = onQuestionAnswers;
  if (onMenuSelect) innerProps.onMenuSelect = onMenuSelect;
  if (onRecommendationAction) innerProps.onRecommendationAction = onRecommendationAction;

  return (
    <AppProvider initialState={mergedInitialState}>
      <InnerApp {...innerProps} />
    </AppProvider>
  );
}
