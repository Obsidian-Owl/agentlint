/**
 * Unit tests for ClarifyingQuestion output format
 *
 * Tests the ClarifyingQuestion type and AdvisorOutput structure
 * for structured questions and assumptions tracking.
 *
 * @module recommendations/__tests__/questions.test
 */

import { describe, it, expect } from 'bun:test';

import type {
  ClarifyingQuestion,
  QuestionOption,
  AdvisorOutput,
  Recommendation,
} from '../types';
import {
  formatClarifyingQuestion,
  formatAdvisorOutput,
  validateClarifyingQuestion,
  createClarifyingQuestion,
} from '../subagent/questions';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestRecommendation(): Recommendation {
  return {
    id: crypto.randomUUID(),
    projectPath: '/test/project',
    createdAt: new Date().toISOString(),
    type: 'preventive',
    action: 'Add error handling guidance',
    target: 'CLAUDE.md',
    rationale: 'Session logs show repeated errors.',
    priority: 'high',
    tracedOrigin: {
      sessionId: 'session-123',
      configGap: 'Missing error handling',
    },
    status: 'open',
    events: [
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: 'created',
        content: 'Initial recommendation created',
      },
    ],
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('recommendations/subagent/questions', () => {
  describe('ClarifyingQuestion type', () => {
    it('should accept a valid question with options', () => {
      const question: ClarifyingQuestion = {
        question: 'Which error handling approach do you prefer?',
        options: [
          { label: 'Try-catch blocks', description: 'Wrap code in try-catch for explicit handling' },
          { label: 'Result types', description: 'Use Result<T, E> pattern for functional approach' },
        ],
        context: 'This affects how errors are surfaced to users.',
        defaultAnswer: 'Try-catch blocks',
      };

      expect(question.question).toBeDefined();
      expect(question.options).toHaveLength(2);
      expect(question.context).toBeDefined();
      expect(question.defaultAnswer).toBeDefined();
    });

    it('should accept a question without options (free-form)', () => {
      const question: ClarifyingQuestion = {
        question: 'What is the primary use case for this feature?',
        context: 'Understanding the use case helps prioritize recommendations.',
      };

      expect(question.question).toBeDefined();
      expect(question.options).toBeUndefined();
    });

    it('should accept a question without default answer', () => {
      const question: ClarifyingQuestion = {
        question: 'Should error messages be user-facing or logged only?',
        options: [
          { label: 'User-facing', description: 'Show errors to users' },
          { label: 'Logged only', description: 'Log errors without user notification' },
        ],
        context: 'This determines error visibility.',
      };

      expect(question.defaultAnswer).toBeUndefined();
    });
  });

  describe('QuestionOption type', () => {
    it('should have label and description', () => {
      const option: QuestionOption = {
        label: 'Option A',
        description: 'Description of option A',
      };

      expect(option.label).toBe('Option A');
      expect(option.description).toBe('Description of option A');
    });
  });

  describe('AdvisorOutput type', () => {
    it('should accept output with recommendations only', () => {
      const output: AdvisorOutput = {
        recommendations: [createTestRecommendation()],
      };

      expect(output.recommendations).toHaveLength(1);
      expect(output.clarifyingQuestions).toBeUndefined();
      expect(output.assumptions).toBeUndefined();
    });

    it('should accept output with clarifying questions', () => {
      const output: AdvisorOutput = {
        recommendations: [],
        clarifyingQuestions: [
          {
            question: 'Which approach do you prefer?',
            context: 'Needed to proceed with recommendation.',
          },
        ],
      };

      expect(output.clarifyingQuestions).toHaveLength(1);
    });

    it('should accept output with assumptions', () => {
      const output: AdvisorOutput = {
        recommendations: [createTestRecommendation()],
        assumptions: [
          'Assuming TypeScript is the primary language',
          'Assuming errors should be user-facing',
        ],
      };

      expect(output.assumptions).toHaveLength(2);
    });

    it('should accept output with both questions and assumptions', () => {
      const output: AdvisorOutput = {
        recommendations: [createTestRecommendation()],
        clarifyingQuestions: [
          {
            question: 'Should we add logging?',
            context: 'For debugging purposes.',
          },
        ],
        assumptions: ['Assuming production environment'],
      };

      expect(output.clarifyingQuestions).toHaveLength(1);
      expect(output.assumptions).toHaveLength(1);
    });
  });

  describe('createClarifyingQuestion', () => {
    it('should create a valid clarifying question', () => {
      const question = createClarifyingQuestion({
        question: 'Which framework should we use?',
        context: 'Framework choice affects implementation.',
      });

      expect(question.question).toBe('Which framework should we use?');
      expect(question.context).toBe('Framework choice affects implementation.');
    });

    it('should create a question with options', () => {
      const question = createClarifyingQuestion({
        question: 'Which framework?',
        context: 'For frontend development.',
        options: [
          { label: 'React', description: 'Popular component library' },
          { label: 'Vue', description: 'Progressive framework' },
        ],
      });

      expect(question.options).toHaveLength(2);
    });

    it('should create a question with default answer', () => {
      const question = createClarifyingQuestion({
        question: 'Which framework?',
        context: 'For frontend development.',
        defaultAnswer: 'React',
      });

      expect(question.defaultAnswer).toBe('React');
    });
  });

  describe('validateClarifyingQuestion', () => {
    it('should return true for valid question', () => {
      const question: ClarifyingQuestion = {
        question: 'Valid question?',
        context: 'Valid context.',
      };

      expect(validateClarifyingQuestion(question)).toBe(true);
    });

    it('should return false for empty question', () => {
      const question: ClarifyingQuestion = {
        question: '',
        context: 'Valid context.',
      };

      expect(validateClarifyingQuestion(question)).toBe(false);
    });

    it('should return false for empty context', () => {
      const question: ClarifyingQuestion = {
        question: 'Valid question?',
        context: '',
      };

      expect(validateClarifyingQuestion(question)).toBe(false);
    });

    it('should return false for options without labels', () => {
      const question: ClarifyingQuestion = {
        question: 'Valid question?',
        context: 'Valid context.',
        options: [{ label: '', description: 'Description' }],
      };

      expect(validateClarifyingQuestion(question)).toBe(false);
    });
  });

  describe('formatClarifyingQuestion', () => {
    it('should format question for display', () => {
      const question: ClarifyingQuestion = {
        question: 'Which approach do you prefer?',
        context: 'This affects implementation.',
      };

      const formatted = formatClarifyingQuestion(question);

      expect(formatted).toContain('Which approach do you prefer?');
      expect(formatted).toContain('This affects implementation.');
    });

    it('should include options when present', () => {
      const question: ClarifyingQuestion = {
        question: 'Which approach?',
        options: [
          { label: 'Option A', description: 'First option' },
          { label: 'Option B', description: 'Second option' },
        ],
        context: 'Context here.',
      };

      const formatted = formatClarifyingQuestion(question);

      expect(formatted).toContain('Option A');
      expect(formatted).toContain('Option B');
    });

    it('should include default answer when present', () => {
      const question: ClarifyingQuestion = {
        question: 'Which approach?',
        context: 'Context here.',
        defaultAnswer: 'Default choice',
      };

      const formatted = formatClarifyingQuestion(question);

      expect(formatted).toContain('Default choice');
    });
  });

  describe('formatAdvisorOutput', () => {
    it('should format output with recommendations', () => {
      const output: AdvisorOutput = {
        recommendations: [createTestRecommendation()],
      };

      const formatted = formatAdvisorOutput(output);

      expect(formatted).toContain('1 recommendation');
    });

    it('should indicate when questions need answers', () => {
      const output: AdvisorOutput = {
        recommendations: [],
        clarifyingQuestions: [
          {
            question: 'Which approach?',
            context: 'Needed to proceed.',
          },
        ],
      };

      const formatted = formatAdvisorOutput(output);

      expect(formatted).toContain('question');
    });

    it('should list assumptions when present', () => {
      const output: AdvisorOutput = {
        recommendations: [createTestRecommendation()],
        assumptions: ['Assumption 1', 'Assumption 2'],
      };

      const formatted = formatAdvisorOutput(output);

      expect(formatted).toContain('Assumption 1');
      expect(formatted).toContain('Assumption 2');
    });
  });
});
