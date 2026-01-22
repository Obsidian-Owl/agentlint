/**
 * EP11 Code-Based Grader Unit Tests
 *
 * Tests for the code-based grading tier of the evaluation framework.
 * Code-based checks validate output structure and format before
 * LLM-as-judge evaluation runs.
 *
 * @module tests/unit/eval/code-based
 */

import { describe, test, expect } from 'bun:test';
import { CodeBasedGrader } from '../../../src/eval/graders/code-based';
import type { GoldenScenario } from '../../../src/eval/types';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a minimal valid scenario for testing.
 */
function createTestScenario(overrides: Partial<GoldenScenario> = {}): GoldenScenario {
  return {
    id: 'test-scenario-001',
    version: '1.0.0',
    source: 'dogfood',
    input: {
      claudeMd: '# CLAUDE.md\n\nTest project.',
      projectType: 'typescript',
    },
    expectedProperties: {
      shouldDetect: ['missing-overview'],
      shouldNotDetect: [],
      recommendationTypes: ['preventive'],
    },
    rubricWeights: {
      actionability: 0.4,
      causalAccuracy: 0.3,
      relevance: 0.3,
    },
    metadata: {
      addedAt: '2026-01-20T00:00:00Z',
      difficulty: 'easy',
      tags: ['test'],
    },
    ...overrides,
  };
}

/**
 * Create a valid analysis output for testing.
 */
function createValidOutput() {
  return {
    format_version: '1.0',
    command: 'analyse',
    timestamp: '2026-01-20T00:00:00Z',
    success: true,
    findings: [
      {
        id: 'FND-001',
        type: 'missing-section',
        severity: 'medium',
        description: 'Missing Project Overview section',
        location: {
          file: 'CLAUDE.md',
          line: 1,
        },
        origin: {
          type: 'detection',
          description: 'Detected during config analysis',
        },
      },
    ],
    recommendations: [
      {
        id: 'REC-001',
        title: 'Add Project Overview',
        priority: 'high',
        description: 'Add a comprehensive Project Overview section',
        findingIds: ['FND-001'],
      },
    ],
    metrics: {
      findingsCount: 1,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 1,
      lowCount: 0,
      infoCount: 0,
    },
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('CodeBasedGrader', () => {
  const grader = new CodeBasedGrader();

  describe('Output Format Validation', () => {
    test('passes for valid output format', () => {
      const scenario = createTestScenario();
      const output = createValidOutput();

      const grade = grader.grade(scenario, output);

      expect(grade.checks.outputFormatValid).toBe(true);
    });

    test('fails for null output', () => {
      const scenario = createTestScenario();

      const grade = grader.grade(scenario, null);

      expect(grade.checks.outputFormatValid).toBe(false);
      expect(grade.passed).toBe(false);
    });

    test('fails for non-object output', () => {
      const scenario = createTestScenario();

      const grade = grader.grade(scenario, 'string output');

      expect(grade.checks.outputFormatValid).toBe(false);
      expect(grade.passed).toBe(false);
    });

    test('fails for output missing format_version', () => {
      const scenario = createTestScenario();
      const output = createValidOutput();
      const { format_version: _, ...outputWithoutVersion } = output;

      const grade = grader.grade(scenario, outputWithoutVersion);

      expect(grade.checks.outputFormatValid).toBe(false);
    });

    test('fails for output with non-boolean success', () => {
      const scenario = createTestScenario();
      const output = { ...createValidOutput(), success: 'yes' };

      const grade = grader.grade(scenario, output);

      expect(grade.checks.outputFormatValid).toBe(false);
    });
  });

  describe('Required Fields Check', () => {
    test('passes when all required fields present', () => {
      const scenario = createTestScenario();
      const output = createValidOutput();

      const grade = grader.grade(scenario, output);

      expect(grade.checks.requiredFieldsPresent).toBe(true);
    });

    test('fails when missing command field', () => {
      const scenario = createTestScenario();
      const output = createValidOutput();
      const { command: _, ...outputWithoutCommand } = output;

      const grade = grader.grade(scenario, outputWithoutCommand);

      expect(grade.checks.requiredFieldsPresent).toBe(false);
    });

    test('fails when missing timestamp field', () => {
      const scenario = createTestScenario();
      const output = createValidOutput();
      const { timestamp: _, ...outputWithoutTimestamp } = output;

      const grade = grader.grade(scenario, outputWithoutTimestamp);

      expect(grade.checks.requiredFieldsPresent).toBe(false);
    });
  });

  describe('Causal Chain Completeness', () => {
    test('passes when all findings have origins', () => {
      const scenario = createTestScenario();
      const output = createValidOutput();

      const grade = grader.grade(scenario, output);

      expect(grade.checks.causalChainComplete).toBe(true);
    });

    test('passes when there are no findings', () => {
      const scenario = createTestScenario();
      const output = { ...createValidOutput(), findings: [] };

      const grade = grader.grade(scenario, output);

      expect(grade.checks.causalChainComplete).toBe(true);
    });

    test('fails when finding is missing origin', () => {
      const scenario = createTestScenario();
      const output = createValidOutput();
      // Remove origin from first finding
      const modifiedOutput = {
        ...output,
        findings: output.findings.map(({ origin: _origin, ...f }) => f),
      };

      const grade = grader.grade(scenario, modifiedOutput);

      expect(grade.checks.causalChainComplete).toBe(false);
    });
  });

  describe('Hallucinated Files Check', () => {
    test('passes when all file references are valid', () => {
      const scenario = createTestScenario();
      const output = createValidOutput();

      const grade = grader.grade(scenario, output);

      expect(grade.checks.noHallucinatedFiles).toBe(true);
    });

    test('passes when there are no findings', () => {
      const scenario = createTestScenario();
      const output = { ...createValidOutput(), findings: undefined };

      const grade = grader.grade(scenario, output);

      expect(grade.checks.noHallucinatedFiles).toBe(true);
    });
  });

  describe('Overall Grade', () => {
    test('passed is true when all checks pass', () => {
      const scenario = createTestScenario();
      const output = createValidOutput();

      const grade = grader.grade(scenario, output);

      expect(grade.passed).toBe(true);
      expect(grade.checks.outputFormatValid).toBe(true);
      expect(grade.checks.requiredFieldsPresent).toBe(true);
      expect(grade.checks.noHallucinatedFiles).toBe(true);
      expect(grade.checks.causalChainComplete).toBe(true);
    });

    test('passed is false when any check fails', () => {
      const scenario = createTestScenario();
      const output = { ...createValidOutput(), success: 'invalid' };

      const grade = grader.grade(scenario, output);

      expect(grade.passed).toBe(false);
    });

    test('passed is false for invalid output', () => {
      const scenario = createTestScenario();

      const grade = grader.grade(scenario, {});

      expect(grade.passed).toBe(false);
    });
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('CodeBasedGrader Edge Cases', () => {
  const grader = new CodeBasedGrader();

  test('handles output with extra fields gracefully', () => {
    const scenario = createTestScenario();
    const output = {
      ...createValidOutput(),
      extraField: 'should not cause issues',
      anotherExtra: { nested: true },
    };

    const grade = grader.grade(scenario, output);

    expect(grade.passed).toBe(true);
  });

  test('handles deeply nested output structures', () => {
    const scenario = createTestScenario();
    const output = createValidOutput();
    // Add deeply nested structure
    const complexOutput = {
      ...output,
      nested: {
        level1: {
          level2: {
            level3: 'deep value',
          },
        },
      },
    };

    const grade = grader.grade(scenario, complexOutput);

    expect(grade.passed).toBe(true);
  });

  test('handles findings with minimal structure', () => {
    const scenario = createTestScenario();
    const output = {
      ...createValidOutput(),
      findings: [
        {
          id: 'FND-001',
          type: 'test',
          severity: 'low',
          description: 'Test finding',
          origin: { type: 'test' },
          // No location field
        },
      ],
    };

    const grade = grader.grade(scenario, output);

    expect(grade.checks.causalChainComplete).toBe(true);
  });
});
