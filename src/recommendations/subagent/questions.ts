/**
 * EP10 Recommendation Advisor - Clarifying Questions
 *
 * Utilities for creating, validating, and formatting clarifying questions
 * that the subagent can return for orchestrator to present to users.
 *
 * @module recommendations/subagent/questions
 */

import type { ClarifyingQuestion, QuestionOption, AdvisorOutput } from '../types';

// =============================================================================
// Question Creation
// =============================================================================

/**
 * Create a clarifying question with proper structure.
 */
export function createClarifyingQuestion(params: {
  question: string;
  context: string;
  options?: QuestionOption[];
  defaultAnswer?: string;
}): ClarifyingQuestion {
  const result: ClarifyingQuestion = {
    question: params.question,
    context: params.context,
  };

  if (params.options && params.options.length > 0) {
    result.options = params.options;
  }

  if (params.defaultAnswer) {
    result.defaultAnswer = params.defaultAnswer;
  }

  return result;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a clarifying question has required fields.
 */
export function validateClarifyingQuestion(question: ClarifyingQuestion): boolean {
  // Question text must be non-empty
  if (!question.question || question.question.trim().length === 0) {
    return false;
  }

  // Context must be non-empty
  if (!question.context || question.context.trim().length === 0) {
    return false;
  }

  // If options provided, each must have a label
  if (question.options) {
    for (const option of question.options) {
      if (!option.label || option.label.trim().length === 0) {
        return false;
      }
    }
  }

  return true;
}

// =============================================================================
// Formatting
// =============================================================================

/**
 * Format a clarifying question for display.
 */
export function formatClarifyingQuestion(question: ClarifyingQuestion): string {
  const lines: string[] = [];

  lines.push(`**Question**: ${question.question}`);
  lines.push('');
  lines.push(`**Context**: ${question.context}`);

  if (question.options && question.options.length > 0) {
    lines.push('');
    lines.push('**Options**:');
    for (const option of question.options) {
      lines.push(`- **${option.label}**: ${option.description}`);
    }
  }

  if (question.defaultAnswer) {
    lines.push('');
    lines.push(`**Default**: ${question.defaultAnswer}`);
  }

  return lines.join('\n');
}

/**
 * Format AdvisorOutput for display.
 */
export function formatAdvisorOutput(output: AdvisorOutput): string {
  const lines: string[] = [];

  // Recommendations summary
  const recCount = output.recommendations.length;
  lines.push(`## Advisor Output`);
  lines.push('');
  lines.push(`**${recCount} recommendation${recCount !== 1 ? 's' : ''}** generated.`);

  // Clarifying questions
  if (output.clarifyingQuestions && output.clarifyingQuestions.length > 0) {
    lines.push('');
    lines.push(`### Clarifying Questions (${output.clarifyingQuestions.length})`);
    lines.push('');
    lines.push('The following question(s) need your input:');
    lines.push('');
    for (const q of output.clarifyingQuestions) {
      lines.push(formatClarifyingQuestion(q));
      lines.push('');
    }
  }

  // Assumptions
  if (output.assumptions && output.assumptions.length > 0) {
    lines.push('');
    lines.push('### Assumptions Made');
    lines.push('');
    lines.push('The following assumptions were made (no clarifying questions asked):');
    lines.push('');
    for (const assumption of output.assumptions) {
      lines.push(`- ${assumption}`);
    }
  }

  return lines.join('\n');
}

// =============================================================================
// Parsing
// =============================================================================

/**
 * Parse clarifying questions from subagent output.
 * The subagent returns questions in a structured format.
 */
export function parseClarifyingQuestions(rawOutput: unknown): ClarifyingQuestion[] | undefined {
  if (!rawOutput || typeof rawOutput !== 'object') {
    return undefined;
  }

  const output = rawOutput as Record<string, unknown>;

  if (!Array.isArray(output.clarifyingQuestions)) {
    return undefined;
  }

  const questions: ClarifyingQuestion[] = [];

  for (const raw of output.clarifyingQuestions) {
    if (typeof raw === 'object' && raw !== null) {
      const q = raw as Record<string, unknown>;
      if (typeof q.question === 'string' && typeof q.context === 'string') {
        const question: ClarifyingQuestion = {
          question: q.question,
          context: q.context,
        };

        if (Array.isArray(q.options)) {
          question.options = q.options
            .filter(
              (opt): opt is { label: string; description: string } =>
                typeof opt === 'object' &&
                opt !== null &&
                typeof (opt as Record<string, unknown>).label === 'string' &&
                typeof (opt as Record<string, unknown>).description === 'string'
            )
            .map((opt) => ({ label: opt.label, description: opt.description }));
        }

        if (typeof q.defaultAnswer === 'string') {
          question.defaultAnswer = q.defaultAnswer;
        }

        if (validateClarifyingQuestion(question)) {
          questions.push(question);
        }
      }
    }
  }

  return questions.length > 0 ? questions : undefined;
}

/**
 * Parse assumptions from subagent output.
 */
export function parseAssumptions(rawOutput: unknown): string[] | undefined {
  if (!rawOutput || typeof rawOutput !== 'object') {
    return undefined;
  }

  const output = rawOutput as Record<string, unknown>;

  if (!Array.isArray(output.assumptions)) {
    return undefined;
  }

  const assumptions = output.assumptions.filter(
    (a): a is string => typeof a === 'string' && a.trim().length > 0
  );

  return assumptions.length > 0 ? assumptions : undefined;
}
