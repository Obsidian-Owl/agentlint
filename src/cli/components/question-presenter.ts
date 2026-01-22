/**
 * Interactive Question Presenter
 *
 * Presents clarifying questions to users and collects their answers.
 * Used for human-in-the-loop confirmation in the analyse command.
 *
 * @module cli/components/question-presenter
 */

import * as readline from 'node:readline';
import type { ClarifyingQuestion } from '../../recommendations/types';
import { bold, dim, colorByStatus } from '../utils/colors';

// =============================================================================
// Types
// =============================================================================

/**
 * Answer collected from a user for a question.
 */
export interface QuestionAnswer {
  /** The original question */
  question: string;
  /** The user's answer (option label or free text) */
  answer: string;
  /** The index of the selected option, if applicable */
  selectedOptionIndex?: number;
}

/**
 * Options for presenting questions.
 */
export interface PresentQuestionsOptions {
  /** Whether to allow skipping questions */
  allowSkip?: boolean;
  /** Default answer to use if user skips */
  defaultOnSkip?: string;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Present a single question to the user and collect their answer.
 *
 * @param question - The clarifying question to present
 * @param rl - Readline interface
 * @param options - Presentation options
 * @returns The user's answer
 */
async function presentQuestion(
  question: ClarifyingQuestion,
  rl: readline.Interface,
  options: PresentQuestionsOptions = {}
): Promise<QuestionAnswer> {
  return new Promise((resolve) => {
    // Print the question
    console.log('');
    console.log(colorByStatus('Question:', 'info'));
    console.log(bold(question.question));

    // Print context if available
    if (question.context) {
      console.log(dim(`Context: ${question.context}`));
    }

    // Print options if available
    if (question.options && question.options.length > 0) {
      console.log('');
      console.log('Options:');
      question.options.forEach((opt, i) => {
        console.log(`  ${i + 1}. ${opt.label}`);
        if (opt.description) {
          console.log(dim(`     ${opt.description}`));
        }
      });

      // Add skip option if allowed
      if (options.allowSkip) {
        console.log(`  ${question.options.length + 1}. ${dim('[Skip - use default]')}`);
      }

      console.log('');

      rl.question('Enter choice (number): ', (input) => {
        const trimmed = input.trim();
        const choice = parseInt(trimmed, 10);

        // Handle skip
        if (options.allowSkip && choice === question.options!.length + 1) {
          resolve({
            question: question.question,
            answer: question.defaultAnswer ?? options.defaultOnSkip ?? 'skipped',
          });
          return;
        }

        // Handle valid option selection
        if (choice >= 1 && choice <= question.options!.length) {
          const selectedOption = question.options?.[choice - 1];
          if (selectedOption) {
            resolve({
              question: question.question,
              answer: selectedOption.label,
              selectedOptionIndex: choice - 1,
            });
            return;
          }
        }

        // Invalid input - treat as free text
        resolve({
          question: question.question,
          answer: trimmed || question.defaultAnswer || 'no answer',
        });
      });
    } else {
      // Free-form question (no options)
      const defaultHint = question.defaultAnswer ? ` [${question.defaultAnswer}]` : '';
      rl.question(`Your answer${defaultHint}: `, (input) => {
        const trimmed = input.trim();
        resolve({
          question: question.question,
          answer: trimmed || question.defaultAnswer || 'no answer',
        });
      });
    }
  });
}

/**
 * Present multiple clarifying questions interactively.
 *
 * @param questions - Array of questions to present
 * @param options - Presentation options
 * @returns Map of question text to user's answer
 */
export async function presentQuestionsInteractive(
  questions: ClarifyingQuestion[],
  options: PresentQuestionsOptions = {}
): Promise<Map<string, QuestionAnswer>> {
  const answers = new Map<string, QuestionAnswer>();

  if (questions.length === 0) {
    return answers;
  }

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log('');
    console.log(colorByStatus('='.repeat(50), 'info'));
    console.log(colorByStatus(`The agent has ${questions.length} question(s) for you:`, 'info'));
    console.log(colorByStatus('='.repeat(50), 'info'));

    for (const question of questions) {
      const answer = await presentQuestion(question, rl, options);
      answers.set(question.question, answer);
    }

    console.log('');
    console.log(colorByStatus('Thank you! Continuing analysis...', 'success'));
    console.log('');
  } finally {
    rl.close();
  }

  return answers;
}

/**
 * Present a simple yes/no confirmation question.
 *
 * @param prompt - The prompt to show
 * @param defaultValue - Default value if user just presses enter
 * @returns true for yes, false for no
 */
export async function confirmPrompt(prompt: string, defaultValue = true): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const defaultHint = defaultValue ? '[Y/n]' : '[y/N]';
    rl.question(`${prompt} ${defaultHint}: `, (input) => {
      rl.close();
      const trimmed = input.trim().toLowerCase();

      if (trimmed === '') {
        resolve(defaultValue);
      } else if (trimmed === 'y' || trimmed === 'yes') {
        resolve(true);
      } else if (trimmed === 'n' || trimmed === 'no') {
        resolve(false);
      } else {
        // Invalid input, use default
        resolve(defaultValue);
      }
    });
  });
}
