/**
 * Unit tests for LLMJudgeGrader
 *
 * Tests the LLM-as-judge evaluation grader that wraps TruLens subprocess.
 *
 * @module tests/unit/eval/llm-judge.test.ts
 */

import { describe, it, expect } from 'bun:test';
import {
  LLMJudgeGrader,
  createLLMJudgeGrader,
  createTestLLMJudgeGrader,
} from '../../../src/eval/graders/llm-judge';
import type { GoldenScenario } from '../../../src/eval/types';

// =============================================================================
// Test Fixtures
// =============================================================================

const mockScenario: GoldenScenario = {
  id: 'test-scenario-1',
  version: '1.0',
  source: 'dogfood',
  input: {
    claudeMd: '# CLAUDE.md\n\n## Guidelines\n\nSome guidelines here.',
    projectType: 'typescript',
  },
  expectedProperties: {
    shouldDetect: ['missing-guidelines'],
    shouldNotDetect: ['hallucinated-issue'],
    recommendationTypes: ['preventive'],
  },
  rubricWeights: {
    actionability: 0.4,
    causalAccuracy: 0.3,
    relevance: 0.3,
  },
  metadata: {
    addedAt: '2024-01-01',
    difficulty: 'medium',
    tags: ['test'],
  },
};

const mockOutput = {
  format_version: '1.0',
  command: 'analyze',
  timestamp: new Date().toISOString(),
  success: true,
  findings: [
    {
      id: 'finding-1',
      type: 'missing-section',
      severity: 'medium',
      description: 'Missing error handling section',
      origin: 'config-analysis',
    },
  ],
  recommendations: [
    {
      id: 'rec-1',
      title: 'Add error handling section',
      priority: 'medium',
      description: 'Add a section documenting error handling patterns',
      findingIds: ['finding-1'],
    },
  ],
};

// =============================================================================
// Tests
// =============================================================================

describe('LLMJudgeGrader', () => {
  describe('constructor', () => {
    it('should create grader with default options', () => {
      const grader = new LLMJudgeGrader();
      expect(grader).toBeInstanceOf(LLMJudgeGrader);
    });

    it('should accept custom options', () => {
      const grader = new LLMJudgeGrader({
        timeoutMs: 30000,
        retryCount: 3,
        retryDelayMs: 500,
        fallbackOnUnavailable: true,
      });
      expect(grader).toBeInstanceOf(LLMJudgeGrader);
    });
  });

  describe('grade with fallback', () => {
    it('should return fallback scores when TruLens unavailable', async () => {
      const grader = new LLMJudgeGrader({
        runnerPath: '/nonexistent/path/runner.py',
        fallbackOnUnavailable: true,
        retryCount: 0,
      });

      const grade = await grader.grade(mockScenario, mockOutput);

      expect(grade.actionability).toBe(0.5);
      expect(grade.causalAccuracy).toBe(0.5);
      expect(grade.relevance).toBe(0.5);
      expect(grade.reasoning.actionability).toContain('not found');
    });

    it('should throw when TruLens unavailable and fallback disabled', async () => {
      const grader = new LLMJudgeGrader({
        runnerPath: '/nonexistent/path/runner.py',
        fallbackOnUnavailable: false,
        retryCount: 0,
      });

      await expect(grader.grade(mockScenario, mockOutput)).rejects.toThrow('not found');
    });
  });

  describe('isAvailable', () => {
    it('should return false when runner does not exist', async () => {
      const grader = new LLMJudgeGrader({
        runnerPath: '/nonexistent/path/runner.py',
      });

      const available = await grader.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('grade structure', () => {
    it('should return valid LLMJudgeGrade structure', async () => {
      const grader = createTestLLMJudgeGrader();
      const grade = await grader.grade(mockScenario, mockOutput);

      // Verify structure
      expect(grade).toHaveProperty('actionability');
      expect(grade).toHaveProperty('causalAccuracy');
      expect(grade).toHaveProperty('relevance');
      expect(grade).toHaveProperty('reasoning');

      // Verify types
      expect(typeof grade.actionability).toBe('number');
      expect(typeof grade.causalAccuracy).toBe('number');
      expect(typeof grade.relevance).toBe('number');
      expect(typeof grade.reasoning.actionability).toBe('string');
      expect(typeof grade.reasoning.causalAccuracy).toBe('string');
      expect(typeof grade.reasoning.relevance).toBe('string');

      // Verify score ranges
      expect(grade.actionability).toBeGreaterThanOrEqual(0);
      expect(grade.actionability).toBeLessThanOrEqual(1);
      expect(grade.causalAccuracy).toBeGreaterThanOrEqual(0);
      expect(grade.causalAccuracy).toBeLessThanOrEqual(1);
      expect(grade.relevance).toBeGreaterThanOrEqual(0);
      expect(grade.relevance).toBeLessThanOrEqual(1);
    });
  });
});

describe('createLLMJudgeGrader', () => {
  it('should create grader with default options', () => {
    const grader = createLLMJudgeGrader();
    expect(grader).toBeInstanceOf(LLMJudgeGrader);
  });

  it('should create grader with custom options', () => {
    const grader = createLLMJudgeGrader({
      timeoutMs: 10000,
      retryCount: 1,
    });
    expect(grader).toBeInstanceOf(LLMJudgeGrader);
  });
});

describe('createTestLLMJudgeGrader', () => {
  it('should create grader with fallback enabled', async () => {
    const grader = createTestLLMJudgeGrader();
    expect(grader).toBeInstanceOf(LLMJudgeGrader);

    // Should not throw even with invalid runner
    const grade = await grader.grade(mockScenario, mockOutput);
    expect(grade.actionability).toBeGreaterThanOrEqual(0);
  });
});
