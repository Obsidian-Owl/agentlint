/**
 * QuestionDialog Component
 *
 * Displays questions from the AskUserQuestion tool with multi-choice options.
 * Supports keyboard navigation (arrow keys, j/k, 1-9) and multi-select.
 *
 * @module tui/components
 */

import React, { useCallback, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { QuestionDialogProps } from '../types';
import { useKeyHandler } from '../hooks/useKeyHandler';

// =============================================================================
// Types
// =============================================================================

interface QuestionState {
  /** Currently selected option index per question */
  selectedIndices: number[];
  /** For multi-select: set of selected option indices per question */
  multiSelectedIndices: Set<number>[];
  /** Current question being answered */
  currentQuestionIndex: number;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Question dialog component for AskUserQuestion tool.
 *
 * Displays one question at a time with option selection.
 * Supports keyboard shortcuts: j/k or arrows for navigation, 1-9 for quick select,
 * space for multi-select toggle, enter to confirm.
 *
 * @param props - Dialog properties
 * @returns React element
 */
export function QuestionDialog({
  questions,
  onSubmit,
  onCancel,
}: QuestionDialogProps): React.ReactElement {
  // Track state for all questions
  const [state, setState] = useState<QuestionState>(() => ({
    selectedIndices: questions.map(() => 0),
    multiSelectedIndices: questions.map(() => new Set<number>()),
    currentQuestionIndex: 0,
  }));

  // Track collected answers
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const currentQuestion = questions[state.currentQuestionIndex];
  const isLastQuestion = state.currentQuestionIndex === questions.length - 1;
  const isMultiSelect = currentQuestion?.multiSelect ?? false;

  /**
   * Move selection up.
   */
  const moveUp = useCallback(() => {
    setState((prev) => {
      const newIndices = [...prev.selectedIndices];
      const question = questions[prev.currentQuestionIndex];
      if (!question) return prev;

      const current = newIndices[prev.currentQuestionIndex] ?? 0;
      const optionCount = question.options.length;
      newIndices[prev.currentQuestionIndex] = current > 0 ? current - 1 : optionCount - 1;
      return { ...prev, selectedIndices: newIndices };
    });
  }, [questions]);

  /**
   * Move selection down.
   */
  const moveDown = useCallback(() => {
    setState((prev) => {
      const newIndices = [...prev.selectedIndices];
      const question = questions[prev.currentQuestionIndex];
      if (!question) return prev;

      const current = newIndices[prev.currentQuestionIndex] ?? 0;
      const optionCount = question.options.length;
      newIndices[prev.currentQuestionIndex] = current < optionCount - 1 ? current + 1 : 0;
      return { ...prev, selectedIndices: newIndices };
    });
  }, [questions]);

  /**
   * Select option by number (1-9).
   */
  const selectByNumber = useCallback(
    (num: number) => {
      const question = questions[state.currentQuestionIndex];
      if (!question) return;

      const optionCount = question.options.length;
      if (num >= 1 && num <= optionCount) {
        setState((prev) => {
          const newIndices = [...prev.selectedIndices];
          newIndices[prev.currentQuestionIndex] = num - 1;
          return { ...prev, selectedIndices: newIndices };
        });
      }
    },
    [questions, state.currentQuestionIndex]
  );

  /**
   * Toggle multi-select for current option.
   */
  const toggleMultiSelect = useCallback(() => {
    if (!isMultiSelect) return;

    setState((prev) => {
      const newMultiSelected = [...prev.multiSelectedIndices];
      const currentSet = new Set(newMultiSelected[prev.currentQuestionIndex] ?? new Set<number>());
      const currentIndex = prev.selectedIndices[prev.currentQuestionIndex] ?? 0;

      if (currentSet.has(currentIndex)) {
        currentSet.delete(currentIndex);
      } else {
        currentSet.add(currentIndex);
      }

      newMultiSelected[prev.currentQuestionIndex] = currentSet;
      return { ...prev, multiSelectedIndices: newMultiSelected };
    });
  }, [isMultiSelect]);

  /**
   * Confirm current question and move to next or submit.
   */
  const confirmSelection = useCallback(() => {
    const question = questions[state.currentQuestionIndex];
    if (!question) return;

    let answer: string;
    const selectedIndex = state.selectedIndices[state.currentQuestionIndex] ?? 0;

    if (isMultiSelect) {
      // For multi-select, join selected option labels
      const selectedSet =
        state.multiSelectedIndices[state.currentQuestionIndex] ?? new Set<number>();
      if (selectedSet.size === 0) {
        // If nothing selected, use the highlighted option
        const option = question.options[selectedIndex];
        answer = option?.label ?? 'default';
      } else {
        answer = Array.from(selectedSet)
          .sort((a, b) => a - b)
          .map((i) => question.options[i]?.label ?? '')
          .filter(Boolean)
          .join(', ');
      }
    } else {
      // Single select - use highlighted option
      const option = question.options[selectedIndex];
      answer = option?.label ?? 'default';
    }

    // Store answer keyed by question text
    const newAnswers = { ...answers, [question.question]: answer };
    setAnswers(newAnswers);

    if (isLastQuestion) {
      // All questions answered, submit
      onSubmit(newAnswers);
    } else {
      // Move to next question
      setState((prev) => ({
        ...prev,
        currentQuestionIndex: prev.currentQuestionIndex + 1,
      }));
    }
  }, [questions, state, isMultiSelect, isLastQuestion, answers, onSubmit]);

  // Handle common keyboard input via useKeyHandler
  useKeyHandler({
    onNavigate: (direction) => (direction === 'up' ? moveUp() : moveDown()),
    onSelect: (index) => selectByNumber(index + 1), // useKeyHandler is 0-indexed, selectByNumber expects 1-indexed
    onSubmit: confirmSelection,
    ...(onCancel && { onEscape: onCancel }),
    itemCount: currentQuestion?.options.length ?? 0,
  });

  // Handle space key for multi-select toggle (not covered by useKeyHandler)
  useInput((input) => {
    if (input === ' ' && isMultiSelect) {
      toggleMultiSelect();
    }
  });

  if (!currentQuestion) {
    return (
      <Box>
        <Text>No questions to display</Text>
      </Box>
    );
  }

  const currentSelected = state.selectedIndices[state.currentQuestionIndex] ?? 0;
  const multiSelected = state.multiSelectedIndices[state.currentQuestionIndex] ?? new Set<number>();

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Question {state.currentQuestionIndex + 1}/{questions.length}
        </Text>
        {currentQuestion.header && <Text dimColor> - {currentQuestion.header}</Text>}
      </Box>

      {/* Question text */}
      <Box marginBottom={1}>
        <Text bold>{currentQuestion.question}</Text>
      </Box>

      {/* Options */}
      <Box flexDirection="column" marginBottom={1}>
        {currentQuestion.options.map((option, index) => {
          const isHighlighted = index === currentSelected;
          const isSelected = isMultiSelect && multiSelected.has(index);

          return (
            <Box key={index} flexDirection="column">
              <Box>
                {/* Selection indicator */}
                {isMultiSelect ? (
                  <Text color={isSelected ? 'green' : 'white'}>{isSelected ? '[x]' : '[ ]'} </Text>
                ) : (
                  <Text color={isHighlighted ? 'cyan' : 'white'}>{isHighlighted ? '>' : ' '} </Text>
                )}

                {/* Option number */}
                <Text bold color={isHighlighted ? 'cyan' : 'yellow'}>
                  [{index + 1}]
                </Text>
                <Text> </Text>

                {/* Option label */}
                {isHighlighted ? (
                  <Text bold color="cyan">
                    {option.label}
                  </Text>
                ) : (
                  <Text>{option.label}</Text>
                )}
              </Box>

              {/* Option description (if present) */}
              {option.description && (
                <Box marginLeft={5}>
                  <Text dimColor>{option.description}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Instructions */}
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text dimColor>
            {isMultiSelect
              ? '[j/k] Navigate  [1-9] Select  [space] Toggle  [enter] Confirm'
              : '[j/k] Navigate  [1-9] Select  [enter] Confirm'}
          </Text>
        </Box>
        {onCancel && (
          <Box>
            <Text dimColor>[esc] Cancel</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
