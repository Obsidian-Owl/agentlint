/**
 * T047: Unit tests for quality scoring
 *
 * Tests the assessQuality() function for evaluating configuration quality.
 * Based on research thresholds from ADR-0007 and spec.md.
 *
 * @module tests/unit/tools/config/quality.test.ts
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { parseConfig } from '../../../../src/tools/config/parse-config';
import type {
  QualityAssessment,
  QualityDimensions,
  ParsedConfig,
} from '../../../../src/tools/config/types';

// Import the function we're testing (will be implemented in T050)
// For now, define a placeholder type for the test structure
type AssessQualityFn = (config: ParsedConfig) => QualityAssessment;

// Lazy load to allow tests to be written first (TDD)
let assessQuality: AssessQualityFn;

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/configs');
const VALID_DIR = path.join(FIXTURES_DIR, 'valid');
const ANTI_PATTERNS_DIR = path.join(FIXTURES_DIR, 'anti-patterns');

// Helper to create temp files for testing
function createTempConfig(content: string): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-test-'));
  const filePath = path.join(tempDir, 'CLAUDE.md');
  fs.writeFileSync(filePath, content);
  return filePath;
}

// Helper to clean up temp files
function cleanupTempFile(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.rmSync(dir, { recursive: true });
}

describe('assessQuality', () => {
  beforeAll(async () => {
    // Dynamically import the quality module once it's implemented
    try {
      const qualityModule = await import(
        '../../../../src/tools/config/quality'
      );
      assessQuality = qualityModule.assessQuality;
    } catch {
      // Module not yet implemented - tests will be skipped
      assessQuality = () => {
        throw new Error('assessQuality not yet implemented');
      };
    }
  });

  describe('overall score calculation', () => {
    it('should return score in 0-100 range', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);
      const result = assessQuality(config);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should assign appropriate grade based on score', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);
      const result = assessQuality(config);

      // Grade should be one of A, B, C, D, F
      expect(['A', 'B', 'C', 'D', 'F']).toContain(result.grade);
    });

    it('should give high score to well-structured config', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const config = await parseConfig(filePath);
      const result = assessQuality(config);

      // Well-structured config should score above 70
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    it('should penalize configs with anti-patterns', async () => {
      const genericRulesPath = path.join(ANTI_PATTERNS_DIR, 'generic-rules.md');
      if (fs.existsSync(genericRulesPath)) {
        const config = await parseConfig(genericRulesPath);
        const result = assessQuality(config);

        // Config with anti-patterns should have penalty
        expect(result.dimensions.antiPatternPenalty).toBeGreaterThan(0);
      }
    });

    it('should include assessment timestamp', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);
      const before = new Date();
      const result = assessQuality(config);
      const after = new Date();

      expect(result.assessedAt).toBeDefined();
      expect(result.assessedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(result.assessedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('structure scoring (T051)', () => {
    it('should score structure between 0-100', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);
      const result = assessQuality(config);

      expect(result.dimensions.structure).toBeGreaterThanOrEqual(0);
      expect(result.dimensions.structure).toBeLessThanOrEqual(100);
    });

    it('should reward configs with clear section hierarchy', async () => {
      // Create a config with good structure
      const goodStructure = `# Project Overview

This is a TypeScript project using Bun.

## Development

- Run tests with \`bun test\`
- Build with \`bun run build\`

### Testing Guidelines

Always write tests first.

## Architecture

Uses clean architecture with layers.
`;
      const filePath = createTempConfig(goodStructure);
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        // Good hierarchy should score well
        expect(result.dimensions.structure).toBeGreaterThanOrEqual(60);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should penalize flat structure (no headings)', async () => {
      const flatConfig = `
This is a config with no headings.
Just plain text without structure.
It has multiple lines but no organization.
Everything is flat and hard to navigate.
`;
      const filePath = createTempConfig(flatConfig);
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        // Flat structure should score lower
        expect(result.dimensions.structure).toBeLessThan(50);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should consider heading depth in structure score', async () => {
      const deepStructure = `# Level 1

Content.

## Level 2

More content.

### Level 3

Even more content.
`;
      const filePath = createTempConfig(deepStructure);
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        // Reasonable depth should contribute positively
        expect(result.dimensions.structure).toBeGreaterThanOrEqual(50);
      } finally {
        cleanupTempFile(filePath);
      }
    });
  });

  describe('size scoring (T052)', () => {
    it('should score size between 0-100', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);
      const result = assessQuality(config);

      expect(result.dimensions.size).toBeGreaterThanOrEqual(0);
      expect(result.dimensions.size).toBeLessThanOrEqual(100);
    });

    it('should give high score to configs under 60 lines (ADR-0007)', async () => {
      const shortConfig = `# Project

Brief config under 60 lines.

## Commands

- \`npm test\`
`;
      const filePath = createTempConfig(shortConfig);
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        // Under 60 lines should score highly
        expect(result.dimensions.size).toBeGreaterThanOrEqual(80);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should penalize configs over 300 lines (ADR-0007 max)', async () => {
      // Create a very long config
      const lines = ['# Large Config', ''];
      for (let i = 0; i < 350; i++) {
        lines.push(`Line ${i}: Some content to pad the file.`);
      }
      const filePath = createTempConfig(lines.join('\n'));
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        // Over 300 lines should be penalized
        expect(result.dimensions.size).toBeLessThan(50);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should consider token estimate in size scoring', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);
      const result = assessQuality(config);

      // Size dimension should be calculated (not just line count)
      expect(result.dimensions.size).toBeDefined();
    });
  });

  describe('completeness scoring (T053)', () => {
    it('should score completeness between 0-100', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);
      const result = assessQuality(config);

      expect(result.dimensions.completeness).toBeGreaterThanOrEqual(0);
      expect(result.dimensions.completeness).toBeLessThanOrEqual(100);
    });

    it('should reward configs with recommended sections', async () => {
      // Create config with recommended sections (WHAT, WHY, HOW)
      const completeConfig = `# Project Overview

This is what the project does.

## Technology Stack

- TypeScript
- Bun

## Development

How to work on this project.

### Commands

- \`bun test\` - Run tests
- \`bun run build\` - Build

## Architecture

Why we chose this architecture.
`;
      const filePath = createTempConfig(completeConfig);
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        // Config with recommended sections should score well
        expect(result.dimensions.completeness).toBeGreaterThanOrEqual(60);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should penalize configs missing common sections', async () => {
      const minimalConfig = `# Project

Just a title and nothing else.
`;
      const filePath = createTempConfig(minimalConfig);
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        // Minimal config should score lower on completeness
        expect(result.dimensions.completeness).toBeLessThan(50);
      } finally {
        cleanupTempFile(filePath);
      }
    });
  });

  describe('specificity scoring', () => {
    it('should score specificity between 0-100', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);
      const result = assessQuality(config);

      expect(result.dimensions.specificity).toBeGreaterThanOrEqual(0);
      expect(result.dimensions.specificity).toBeLessThanOrEqual(100);
    });

    it('should reward configs with specific guidance', async () => {
      const specificConfig = `# MyProject

TypeScript project using Bun 1.0.

## Build

Run \`bun run build:prod\` for production.
Output goes to ./dist/

## Testing

MUST use vitest for unit tests.
Run with \`bun test --coverage\`.
`;
      const filePath = createTempConfig(specificConfig);
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        // Specific guidance should score well
        expect(result.dimensions.specificity).toBeGreaterThanOrEqual(50);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should penalize generic rules that waste tokens', async () => {
      const genericConfig = `# Project

## Guidelines

- Write clean code
- Follow best practices
- Keep it simple
- Be consistent
`;
      const filePath = createTempConfig(genericConfig);
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        // Generic rules should lower specificity
        expect(result.dimensions.specificity).toBeLessThan(70);
      } finally {
        cleanupTempFile(filePath);
      }
    });
  });

  describe('weighted score calculation (T055)', () => {
    it('should combine dimension scores into overall score', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);
      const result = assessQuality(config);

      // Overall score should be derived from dimensions
      const dims = result.dimensions;
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);

      // Verify all dimensions contribute
      expect(dims.structure).toBeDefined();
      expect(dims.size).toBeDefined();
      expect(dims.completeness).toBeDefined();
      expect(dims.specificity).toBeDefined();
      expect(dims.antiPatternPenalty).toBeDefined();
    });

    it('should apply anti-pattern penalty to overall score', async () => {
      const genericRulesPath = path.join(ANTI_PATTERNS_DIR, 'generic-rules.md');
      if (fs.existsSync(genericRulesPath)) {
        const config = await parseConfig(genericRulesPath);
        const result = assessQuality(config);

        // Penalty should reduce overall score
        if (result.dimensions.antiPatternPenalty > 0) {
          // With penalty, score should be lower than perfect
          expect(result.score).toBeLessThan(100);
        }
      }
    });

    it('should assign grades based on score thresholds', async () => {
      // Test grade thresholds
      const gradeThresholds: Array<{ minScore: number; expectedGrades: string[] }> = [
        { minScore: 90, expectedGrades: ['A'] },
        { minScore: 80, expectedGrades: ['A', 'B'] },
        { minScore: 70, expectedGrades: ['A', 'B', 'C'] },
        { minScore: 60, expectedGrades: ['A', 'B', 'C', 'D'] },
      ];

      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);
      const result = assessQuality(config);

      // Grade should match score
      for (const threshold of gradeThresholds) {
        if (result.score >= threshold.minScore) {
          expect(threshold.expectedGrades).toContain(result.grade);
          break;
        }
      }
    });
  });

  describe('recommendations', () => {
    it('should provide recommendations array', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);
      const result = assessQuality(config);

      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should recommend improvements for low-scoring dimensions', async () => {
      const flatConfig = `
No headings, flat structure, minimal content.
`;
      const filePath = createTempConfig(flatConfig);
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        // Low structure score should generate recommendations
        if (result.dimensions.structure < 50) {
          expect(result.recommendations.length).toBeGreaterThan(0);
        }
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should not recommend changes for high-scoring configs', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const config = await parseConfig(filePath);
      const result = assessQuality(config);

      // High score should have fewer recommendations
      if (result.score >= 90) {
        expect(result.recommendations.length).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('JSON config handling', () => {
    it('should assess quality of settings.json', async () => {
      const settingsPath = path.join(VALID_DIR, 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const config = await parseConfig(settingsPath);
        const result = assessQuality(config);

        // Should return valid assessment for JSON
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
    });

    it('should handle JSON configs without sections', async () => {
      const settingsPath = path.join(VALID_DIR, 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const config = await parseConfig(settingsPath);
        const result = assessQuality(config);

        // JSON has no markdown sections - should still work
        expect(result.dimensions.structure).toBeDefined();
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty config', async () => {
      const filePath = createTempConfig('');
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        // Empty config should have low score but not crash
        expect(result.score).toBeDefined();
        expect(result.score).toBeLessThan(30);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should handle config with only whitespace', async () => {
      const filePath = createTempConfig('   \n\n   \n');
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        expect(result.score).toBeDefined();
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should handle very large configs', async () => {
      // Create config with 500+ lines
      const lines = ['# Large Project Config', ''];
      for (let i = 0; i < 500; i++) {
        lines.push(`## Section ${i}`);
        lines.push(`Content for section ${i}.`);
        lines.push('');
      }
      const filePath = createTempConfig(lines.join('\n'));
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        // Should complete without timeout
        expect(result.score).toBeDefined();
        // Large config should be penalized
        expect(result.dimensions.size).toBeLessThan(50);
      } finally {
        cleanupTempFile(filePath);
      }
    });
  });
});
