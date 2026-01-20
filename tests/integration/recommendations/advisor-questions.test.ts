/**
 * VCR Integration Test for Recommendation Advisor Questions
 *
 * Tests clarifying question flow when context is ambiguous.
 * Uses VCR recordings per ADR-0011.
 *
 * @module tests/integration/recommendations/advisor-questions.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

import { VCR } from '../../lib/vcr';
import {
  createClarifyingQuestion,
  validateClarifyingQuestion,
  formatClarifyingQuestion,
  formatAdvisorOutput,
  parseClarifyingQuestions,
  parseAssumptions,
} from '../../../src/recommendations/subagent/questions';
import type {
  ClarifyingQuestion,
  QuestionOption,
  AdvisorOutput,
} from '../../../src/recommendations/types';

// =============================================================================
// VCR Setup
// =============================================================================

const vcr = new VCR();
const CASSETTE_PATH =
  'tests/integration/recordings/recommendations/advisor-clarifying-questions.json';

beforeAll(async () => {
  await vcr.load(CASSETTE_PATH);
  vcr.setupMocks();
});

afterAll(() => {
  vcr.cleanup();
});

// =============================================================================
// Tests
// =============================================================================

describe('Recommendation Advisor Questions Integration', () => {
  describe('Question Creation', () => {
    it('should create clarifying question with required fields', () => {
      const question = createClarifyingQuestion({
        question: 'Which area should be prioritized for improvement?',
        context: 'Multiple improvement areas identified, need to prioritize',
      });

      expect(question.question).toBeDefined();
      expect(question.context).toBeDefined();
      expect(validateClarifyingQuestion(question)).toBe(true);
    });

    it('should create clarifying question with options', () => {
      const options: QuestionOption[] = [
        {
          label: 'Error handling',
          description: 'Focus on error recovery and messaging',
        },
        {
          label: 'Performance',
          description: 'Focus on response time and efficiency',
        },
      ];

      const question = createClarifyingQuestion({
        question: 'Which area should be prioritized for improvement?',
        context: 'Multiple improvement areas identified, need to prioritize',
        options,
      });

      expect(question.options).toHaveLength(2);
      expect(question.options?.[0]?.label).toBe('Error handling');
      expect(question.options?.[1]?.label).toBe('Performance');
    });

    it('should create clarifying question with default answer', () => {
      const question = createClarifyingQuestion({
        question: 'Which area should be prioritized for improvement?',
        context: 'Multiple improvement areas identified, need to prioritize',
        defaultAnswer: 'Error handling (most impactful based on findings)',
      });

      expect(question.defaultAnswer).toBe('Error handling (most impactful based on findings)');
    });

    it('should create complete clarifying question', () => {
      const question = createClarifyingQuestion({
        question: 'Which area should be prioritized for improvement?',
        context: 'Multiple improvement areas identified, need to prioritize',
        options: [
          {
            label: 'Error handling',
            description: 'Focus on error recovery and messaging',
          },
          {
            label: 'Performance',
            description: 'Focus on response time and efficiency',
          },
          {
            label: 'Documentation',
            description: 'Focus on improving guidance in CLAUDE.md',
          },
        ],
        defaultAnswer: 'Error handling (most impactful based on findings)',
      });

      expect(validateClarifyingQuestion(question)).toBe(true);
      expect(question.question).toBeDefined();
      expect(question.context).toBeDefined();
      expect(question.options).toHaveLength(3);
      expect(question.defaultAnswer).toBeDefined();
    });
  });

  describe('Question Validation', () => {
    it('should reject question with empty question text', () => {
      const question: ClarifyingQuestion = {
        question: '',
        context: 'Some context',
      };

      expect(validateClarifyingQuestion(question)).toBe(false);
    });

    it('should reject question with empty context', () => {
      const question: ClarifyingQuestion = {
        question: 'What should we do?',
        context: '',
      };

      expect(validateClarifyingQuestion(question)).toBe(false);
    });

    it('should reject question with whitespace-only fields', () => {
      const question: ClarifyingQuestion = {
        question: '   ',
        context: '   ',
      };

      expect(validateClarifyingQuestion(question)).toBe(false);
    });

    it('should reject question with empty option label', () => {
      const question: ClarifyingQuestion = {
        question: 'What to prioritize?',
        context: 'Need to choose',
        options: [{ label: '', description: 'Some desc' }],
      };

      expect(validateClarifyingQuestion(question)).toBe(false);
    });

    it('should accept valid question without options', () => {
      const question: ClarifyingQuestion = {
        question: 'How should we proceed?',
        context: 'Ambiguous situation requires guidance',
      };

      expect(validateClarifyingQuestion(question)).toBe(true);
    });

    it('should accept valid question with options', () => {
      const question: ClarifyingQuestion = {
        question: 'Which approach?',
        context: 'Two valid paths exist',
        options: [
          { label: 'A', description: 'First approach' },
          { label: 'B', description: 'Second approach' },
        ],
      };

      expect(validateClarifyingQuestion(question)).toBe(true);
    });
  });

  describe('Question Formatting', () => {
    it('should format question for display', () => {
      const question: ClarifyingQuestion = {
        question: 'Which area should be prioritized?',
        context: 'Multiple areas need improvement',
      };

      const formatted = formatClarifyingQuestion(question);

      expect(formatted).toContain('**Question**:');
      expect(formatted).toContain('Which area should be prioritized?');
      expect(formatted).toContain('**Context**:');
      expect(formatted).toContain('Multiple areas need improvement');
    });

    it('should format question with options', () => {
      const question: ClarifyingQuestion = {
        question: 'Which area?',
        context: 'Need to choose',
        options: [
          { label: 'Error handling', description: 'Focus on errors' },
          { label: 'Performance', description: 'Focus on speed' },
        ],
      };

      const formatted = formatClarifyingQuestion(question);

      expect(formatted).toContain('**Options**:');
      expect(formatted).toContain('**Error handling**:');
      expect(formatted).toContain('**Performance**:');
    });

    it('should format question with default answer', () => {
      const question: ClarifyingQuestion = {
        question: 'Which area?',
        context: 'Need to choose',
        defaultAnswer: 'Error handling is recommended',
      };

      const formatted = formatClarifyingQuestion(question);

      expect(formatted).toContain('**Default**:');
      expect(formatted).toContain('Error handling is recommended');
    });
  });

  describe('AdvisorOutput Formatting', () => {
    it('should format output with recommendations only', () => {
      const output: AdvisorOutput = {
        recommendations: [
          {
            id: 'rec-001',
            projectPath: '/test',
            createdAt: new Date().toISOString(),
            type: 'preventive',
            action: 'Add error handling',
            target: 'CLAUDE.md',
            rationale: 'Prevents errors',
            priority: 'high',
            status: 'open',
            tracedOrigin: { findingId: 'f-001' },
            events: [],
          },
        ],
      };

      const formatted = formatAdvisorOutput(output);

      expect(formatted).toContain('## Advisor Output');
      expect(formatted).toContain('**1 recommendation** generated');
    });

    it('should format output with multiple recommendations', () => {
      const output: AdvisorOutput = {
        recommendations: [
          {
            id: 'rec-001',
            projectPath: '/test',
            createdAt: new Date().toISOString(),
            type: 'preventive',
            action: 'Action 1',
            target: 'target1',
            rationale: 'Rationale 1',
            priority: 'high',
            status: 'open',
            tracedOrigin: { findingId: 'f-001' },
            events: [],
          },
          {
            id: 'rec-002',
            projectPath: '/test',
            createdAt: new Date().toISOString(),
            type: 'symptomatic',
            action: 'Action 2',
            target: 'target2',
            rationale: 'Rationale 2',
            priority: 'medium',
            status: 'open',
            tracedOrigin: { findingId: 'f-002' },
            events: [],
          },
        ],
      };

      const formatted = formatAdvisorOutput(output);

      expect(formatted).toContain('**2 recommendations** generated');
    });

    it('should format output with clarifying questions', () => {
      const output: AdvisorOutput = {
        recommendations: [],
        clarifyingQuestions: [
          {
            question: 'Which area to prioritize?',
            context: 'Multiple areas identified',
          },
        ],
      };

      const formatted = formatAdvisorOutput(output);

      expect(formatted).toContain('### Clarifying Questions (1)');
      expect(formatted).toContain('Which area to prioritize?');
    });

    it('should format output with assumptions', () => {
      const output: AdvisorOutput = {
        recommendations: [],
        assumptions: ['Assuming error handling is the priority'],
      };

      const formatted = formatAdvisorOutput(output);

      expect(formatted).toContain('### Assumptions Made');
      expect(formatted).toContain('Assuming error handling is the priority');
    });
  });

  describe('Question Parsing', () => {
    it('should parse clarifying questions from raw output', () => {
      const rawOutput = {
        clarifyingQuestions: [
          {
            question: 'Which area to focus on?',
            context: 'Multiple areas need work',
            options: [
              { label: 'A', description: 'First' },
              { label: 'B', description: 'Second' },
            ],
            defaultAnswer: 'A is recommended',
          },
        ],
      };

      const questions = parseClarifyingQuestions(rawOutput);

      expect(questions).toBeDefined();
      expect(questions).toHaveLength(1);
      expect(questions?.[0]?.question).toBe('Which area to focus on?');
      expect(questions?.[0]?.options).toHaveLength(2);
      expect(questions?.[0]?.defaultAnswer).toBe('A is recommended');
    });

    it('should return undefined for empty input', () => {
      expect(parseClarifyingQuestions(null)).toBeUndefined();
      expect(parseClarifyingQuestions(undefined)).toBeUndefined();
      expect(parseClarifyingQuestions({})).toBeUndefined();
    });

    it('should filter out invalid questions', () => {
      const rawOutput = {
        clarifyingQuestions: [
          { question: '', context: 'Valid context' }, // Invalid: empty question
          { question: 'Valid question', context: '' }, // Invalid: empty context
          { question: 'Valid', context: 'Also valid' }, // Valid
        ],
      };

      const questions = parseClarifyingQuestions(rawOutput);

      expect(questions).toHaveLength(1);
      expect(questions?.[0]?.question).toBe('Valid');
    });

    it('should parse assumptions from raw output', () => {
      const rawOutput = {
        assumptions: [
          'Assuming user prefers error handling focus',
          'Assuming TypeScript is the primary language',
        ],
      };

      const assumptions = parseAssumptions(rawOutput);

      expect(assumptions).toHaveLength(2);
      expect(assumptions?.[0]).toContain('error handling');
    });

    it('should filter empty assumptions', () => {
      const rawOutput = {
        assumptions: ['Valid assumption', '', '   ', 'Another valid'],
      };

      const assumptions = parseAssumptions(rawOutput);

      expect(assumptions).toHaveLength(2);
    });
  });

  describe('Non-Leading Question Validation', () => {
    it('should support questions that do not suggest expected answers', () => {
      // Good: Open-ended question
      const goodQuestion = createClarifyingQuestion({
        question: 'How would you describe changes in workflow efficiency?',
        context: 'Need to understand user perception of workflow changes',
      });

      expect(validateClarifyingQuestion(goodQuestion)).toBe(true);
      expect(goodQuestion.question).not.toContain('improved');
      expect(goodQuestion.question).not.toContain('better');
    });

    it('should support balanced options without bias', () => {
      const question = createClarifyingQuestion({
        question: 'Which implementation approach would you prefer?',
        context: 'Multiple valid approaches exist with different tradeoffs',
        options: [
          {
            label: 'Incremental',
            description: 'Smaller changes over time, lower risk',
          },
          {
            label: 'Comprehensive',
            description: 'All changes at once, faster completion',
          },
        ],
      });

      // Both options should have neutral descriptions
      const descriptions = question.options?.map((o) => o.description) ?? [];
      for (const desc of descriptions) {
        expect(desc).not.toContain('recommended');
        expect(desc).not.toContain('best');
        expect(desc).not.toContain('should');
      }
    });
  });
});
