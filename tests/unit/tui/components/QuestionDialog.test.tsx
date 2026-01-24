/**
 * Unit tests for QuestionDialog component
 *
 * Tests the multi-choice question dialog from AskUserQuestion tool.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { QuestionDialog } from '../../../../src/tui/components/QuestionDialog';
import type { UserQuestion } from '../../../../src/tui/types';

// =============================================================================
// Helper
// =============================================================================

/** Small delay to allow React effects to settle */
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

/** Extract first call argument from mock, cast through unknown for type safety */
function getFirstCallArg<T>(mockFn: ReturnType<typeof mock>): T {
  const calls = mockFn.mock.calls as unknown[][];
  return calls[0]![0] as T;
}

// =============================================================================
// Test Data
// =============================================================================

const singleQuestion: UserQuestion[] = [
  {
    question: 'Which package manager do you prefer?',
    header: 'Package Manager',
    options: [
      { label: 'npm', description: 'Node Package Manager' },
      { label: 'yarn', description: 'Fast, reliable dependency management' },
      { label: 'pnpm', description: 'Performant npm alternative' },
    ],
    multiSelect: false,
  },
];

const multipleQuestions: UserQuestion[] = [
  {
    question: 'Which framework?',
    header: 'Framework',
    options: [{ label: 'React' }, { label: 'Vue' }],
  },
  {
    question: 'Which testing library?',
    header: 'Testing',
    options: [{ label: 'Jest' }, { label: 'Vitest' }],
  },
];

const multiSelectQuestion: UserQuestion[] = [
  {
    question: 'Which features do you need?',
    header: 'Features',
    options: [
      { label: 'TypeScript', description: 'Type safety' },
      { label: 'ESLint', description: 'Code linting' },
      { label: 'Prettier', description: 'Code formatting' },
    ],
    multiSelect: true,
  },
];

// =============================================================================
// Tests
// =============================================================================

describe('QuestionDialog', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    test('should render question text', () => {
      const { lastFrame } = render(
        <QuestionDialog questions={singleQuestion} onSubmit={() => {}} />
      );

      expect(lastFrame()).toContain('Which package manager do you prefer?');
    });

    test('should render question header', () => {
      const { lastFrame } = render(
        <QuestionDialog questions={singleQuestion} onSubmit={() => {}} />
      );

      expect(lastFrame()).toContain('Package Manager');
    });

    test('should render all options', () => {
      const { lastFrame } = render(
        <QuestionDialog questions={singleQuestion} onSubmit={() => {}} />
      );

      const frame = lastFrame()!;
      expect(frame).toContain('npm');
      expect(frame).toContain('yarn');
      expect(frame).toContain('pnpm');
    });

    test('should render option descriptions', () => {
      const { lastFrame } = render(
        <QuestionDialog questions={singleQuestion} onSubmit={() => {}} />
      );

      expect(lastFrame()).toContain('Node Package Manager');
    });

    test('should show question count', () => {
      const { lastFrame } = render(
        <QuestionDialog questions={multipleQuestions} onSubmit={() => {}} />
      );

      expect(lastFrame()).toContain('1/2');
    });

    test('should render option numbers', () => {
      const { lastFrame } = render(
        <QuestionDialog questions={singleQuestion} onSubmit={() => {}} />
      );

      const frame = lastFrame()!;
      expect(frame).toContain('[1]');
      expect(frame).toContain('[2]');
      expect(frame).toContain('[3]');
    });
  });

  describe('navigation', () => {
    test('should highlight first option by default', () => {
      const { lastFrame } = render(
        <QuestionDialog questions={singleQuestion} onSubmit={() => {}} />
      );

      // The first option should have a selection indicator
      const frame = lastFrame()!;
      expect(frame).toContain('>');
    });

    test('should navigate down with j key', async () => {
      const { stdin, lastFrame } = render(
        <QuestionDialog questions={singleQuestion} onSubmit={() => {}} />
      );

      await tick();
      stdin.write('j');
      await tick();

      // After pressing j, the selection should have moved
      expect(lastFrame()).toBeDefined();
    });

    test('should navigate up with k key', async () => {
      const { stdin, lastFrame } = render(
        <QuestionDialog questions={singleQuestion} onSubmit={() => {}} />
      );

      await tick();
      // First go down, then up
      stdin.write('j');
      await tick();
      stdin.write('k');
      await tick();

      expect(lastFrame()).toBeDefined();
    });
  });

  describe('number key selection', () => {
    test('should select option with number key', async () => {
      const onSubmit = mock(() => {});
      const { stdin } = render(<QuestionDialog questions={singleQuestion} onSubmit={onSubmit} />);

      await tick();
      // Press '2' to select yarn, then Enter to confirm
      stdin.write('2');
      await tick();
      stdin.write('\r');
      await tick();

      expect(onSubmit).toHaveBeenCalled();
      const answers = getFirstCallArg<Record<string, string>>(onSubmit);
      expect(answers['Which package manager do you prefer?']).toBe('yarn');
    });
  });

  describe('single select', () => {
    test('should submit selected option on Enter', async () => {
      const onSubmit = mock(() => {});
      const { stdin } = render(<QuestionDialog questions={singleQuestion} onSubmit={onSubmit} />);

      await tick();
      // Press Enter to confirm first (default) option
      stdin.write('\r');
      await tick();

      expect(onSubmit).toHaveBeenCalled();
      const answers = getFirstCallArg<Record<string, string>>(onSubmit);
      expect(answers['Which package manager do you prefer?']).toBe('npm');
    });
  });

  describe('multi-select', () => {
    test('should show checkbox indicators for multi-select', () => {
      const { lastFrame } = render(
        <QuestionDialog questions={multiSelectQuestion} onSubmit={() => {}} />
      );

      // Should show checkbox-style indicators
      expect(lastFrame()).toContain('[ ]');
    });

    test('should toggle selection with space', async () => {
      const { stdin, lastFrame } = render(
        <QuestionDialog questions={multiSelectQuestion} onSubmit={() => {}} />
      );

      await tick();
      // Press space to toggle first option
      stdin.write(' ');
      await tick();

      // Should now show checked indicator
      expect(lastFrame()).toContain('[x]');
    });

    test('should submit all selected options', async () => {
      const onSubmit = mock(() => {});
      const { stdin } = render(
        <QuestionDialog questions={multiSelectQuestion} onSubmit={onSubmit} />
      );

      await tick();
      // Select first option
      stdin.write(' ');
      await tick();
      // Move down and select second
      stdin.write('j');
      await tick();
      stdin.write(' ');
      await tick();
      // Confirm
      stdin.write('\r');
      await tick();

      expect(onSubmit).toHaveBeenCalled();
      const answers = getFirstCallArg<Record<string, string>>(onSubmit);
      // Should have both selected
      expect(answers['Which features do you need?']).toContain('TypeScript');
      expect(answers['Which features do you need?']).toContain('ESLint');
    });
  });

  describe('multiple questions', () => {
    test('should advance to next question on Enter', async () => {
      const { stdin, lastFrame } = render(
        <QuestionDialog questions={multipleQuestions} onSubmit={() => {}} />
      );

      await tick();
      // Confirm first question
      stdin.write('\r');
      await tick();

      // Should now show second question
      expect(lastFrame()).toContain('2/2');
      expect(lastFrame()).toContain('Which testing library?');
    });

    test('should submit all answers after last question', async () => {
      const onSubmit = mock(() => {});
      const { stdin } = render(
        <QuestionDialog questions={multipleQuestions} onSubmit={onSubmit} />
      );

      await tick();
      // Answer first question (default)
      stdin.write('\r');
      await tick();
      // Answer second question (default)
      stdin.write('\r');
      await tick();

      expect(onSubmit).toHaveBeenCalled();
      const answers = getFirstCallArg<Record<string, string>>(onSubmit);
      expect(answers['Which framework?']).toBe('React');
      expect(answers['Which testing library?']).toBe('Jest');
    });
  });

  describe('cancel', () => {
    test('should call onCancel on Escape', async () => {
      const onCancel = mock(() => {});
      const { stdin } = render(
        <QuestionDialog questions={singleQuestion} onSubmit={() => {}} onCancel={onCancel} />
      );

      await tick();
      // Press Escape
      stdin.write('\u001B');
      await tick();

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    test('should handle empty questions array', () => {
      const { lastFrame } = render(<QuestionDialog questions={[]} onSubmit={() => {}} />);

      expect(lastFrame()).toContain('No questions');
    });

    test('should handle options without descriptions', () => {
      const questionsWithoutDesc: UserQuestion[] = [
        {
          question: 'Simple question?',
          header: 'Simple',
          options: [{ label: 'Yes' }, { label: 'No' }],
        },
      ];

      const { lastFrame } = render(
        <QuestionDialog questions={questionsWithoutDesc} onSubmit={() => {}} />
      );

      expect(lastFrame()).toContain('Yes');
      expect(lastFrame()).toContain('No');
    });
  });
});
