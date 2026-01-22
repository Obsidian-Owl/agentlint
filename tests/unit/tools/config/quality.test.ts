/**
 * T047: Unit tests for quality analysis
 *
 * Tests the assessQuality() function for analyzing configuration quality.
 * Per ADR-0019, tests verify raw metrics extraction, not scoring.
 *
 * @module tests/unit/tools/config/quality.test.ts
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { parseConfig } from '../../../../src/tools/config/parse-config';
import type { QualityAssessment, ParsedConfig } from '../../../../src/tools/config/types';

// Import the function we're testing
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
    // Dynamically import the quality module
    const qualityModule = await import('../../../../src/tools/config/quality');
    assessQuality = qualityModule.assessQuality;
  });

  describe('basic output structure', () => {
    it('should return raw metrics without scores', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);
      const result = assessQuality(config);

      // Per ADR-0019, should return raw metrics not scores
      expect(result.metrics).toBeDefined();
      expect(result.structure).toBeDefined();
      expect(result.sizeAnalysis).toBeDefined();
      expect(result.completeness).toBeDefined();
      expect(result.issues).toBeInstanceOf(Array);
      expect(result.assessedAt).toBeInstanceOf(Date);
    });

    it('should include assessment timestamp', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);
      const before = new Date();
      const result = assessQuality(config);
      const after = new Date();

      expect(result.assessedAt).toBeDefined();
      expect(result.assessedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.assessedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('structure analysis', () => {
    it('should return factual structure observations', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);
      const result = assessQuality(config);

      expect(typeof result.structure.sectionCount).toBe('number');
      expect(typeof result.structure.maxHeadingDepth).toBe('number');
      expect(typeof result.structure.hasNestedSections).toBe('boolean');
      expect(typeof result.structure.isEmpty).toBe('boolean');
      expect(typeof result.structure.hasStructure).toBe('boolean');
    });

    it('should detect well-structured configs', async () => {
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

        expect(result.structure.hasStructure).toBe(true);
        expect(result.structure.sectionCount).toBeGreaterThan(0);
        expect(result.structure.hasNestedSections).toBe(true);
        expect(result.structure.isEmpty).toBe(false);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should detect flat structure (no headings)', async () => {
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

        expect(result.structure.hasStructure).toBe(false);
        expect(result.structure.sectionCount).toBe(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should report heading depth', async () => {
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

        expect(result.structure.maxHeadingDepth).toBeGreaterThanOrEqual(3);
      } finally {
        cleanupTempFile(filePath);
      }
    });
  });

  describe('size analysis', () => {
    it('should return factual size metrics', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);
      const result = assessQuality(config);

      expect(typeof result.sizeAnalysis.lineCount).toBe('number');
      expect(typeof result.sizeAnalysis.tokenEstimate).toBe('number');
      expect(typeof result.sizeAnalysis.exceedsOptimalLines).toBe('boolean');
      expect(typeof result.sizeAnalysis.exceedsMaxLines).toBe('boolean');
      expect(typeof result.sizeAnalysis.exceedsLightweightTokens).toBe('boolean');
      expect(typeof result.sizeAnalysis.exceedsProblematicTokens).toBe('boolean');
    });

    it('should flag configs under 60 lines as not exceeding optimal', async () => {
      const shortConfig = `# Project

Brief config under 60 lines.

## Commands

- \`npm test\`
`;
      const filePath = createTempConfig(shortConfig);
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        expect(result.sizeAnalysis.exceedsOptimalLines).toBe(false);
        expect(result.sizeAnalysis.exceedsMaxLines).toBe(false);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should flag configs over 300 lines as exceeding max', async () => {
      // Create a very long config
      const lines = ['# Large Config', ''];
      for (let i = 0; i < 350; i++) {
        lines.push(`Line ${i}: Some content to pad the file.`);
      }
      const filePath = createTempConfig(lines.join('\n'));
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        expect(result.sizeAnalysis.exceedsMaxLines).toBe(true);
        expect(result.sizeAnalysis.exceedsOptimalLines).toBe(true);
      } finally {
        cleanupTempFile(filePath);
      }
    });
  });

  describe('completeness analysis', () => {
    it('should return factual completeness metrics', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);
      const result = assessQuality(config);

      expect(result.completeness.presentSections).toBeInstanceOf(Array);
      expect(result.completeness.missingSections).toBeInstanceOf(Array);
      expect(typeof result.completeness.totalRecommendedSections).toBe('number');
    });

    it('should detect present recommended sections', async () => {
      // Create config with recommended sections
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

        expect(result.completeness.presentSections.length).toBeGreaterThan(0);
        // Should find 'overview', 'project', 'technology', 'development', 'architecture'
        expect(result.completeness.presentSections).toContain('overview');
        expect(result.completeness.presentSections).toContain('development');
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should detect missing recommended sections', async () => {
      const minimalConfig = `# Project

Just a title and nothing else.
`;
      const filePath = createTempConfig(minimalConfig);
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        expect(result.completeness.missingSections.length).toBeGreaterThan(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });
  });

  describe('anti-pattern detection', () => {
    it('should detect anti-patterns and return issues', async () => {
      const genericRulesPath = path.join(ANTI_PATTERNS_DIR, 'generic-rules.md');
      if (fs.existsSync(genericRulesPath)) {
        const config = await parseConfig(genericRulesPath);
        const result = assessQuality(config);

        expect(result.issues.length).toBeGreaterThan(0);
      }
    });

    it('should detect generic rules', async () => {
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

        const genericIssues = result.issues.filter((i) => i.type === 'generic-rule');
        expect(genericIssues.length).toBeGreaterThan(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should detect embedded secrets', async () => {
      const configWithSecret = `# Project

## API

api_key=sk-abcdefghijklmnopqrstuvwxyz1234567890
`;
      const filePath = createTempConfig(configWithSecret);
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        const secretIssues = result.issues.filter((i) => i.type === 'embedded-secret');
        expect(secretIssues.length).toBeGreaterThan(0);
        expect(secretIssues[0]?.severity).toBe('critical');
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should detect instruction overload', async () => {
      // Create config with >300 lines (exceeds LINES_MAX)
      const lines = ['# Large Config', ''];
      for (let i = 0; i < 350; i++) {
        lines.push(`- Instruction ${i}`);
      }
      const filePath = createTempConfig(lines.join('\n'));
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        const overloadIssues = result.issues.filter((i) => i.type === 'instruction-overload');
        expect(overloadIssues.length).toBeGreaterThan(0);
      } finally {
        cleanupTempFile(filePath);
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
        expect(result.metrics).toBeDefined();
        expect(result.sizeAnalysis).toBeDefined();
      }
    });

    it('should handle JSON configs without markdown sections', async () => {
      const settingsPath = path.join(VALID_DIR, 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const config = await parseConfig(settingsPath);
        const result = assessQuality(config);

        // JSON has no markdown sections - completeness N/A
        expect(result.completeness.totalRecommendedSections).toBe(0);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty config', async () => {
      const filePath = createTempConfig('');
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        expect(result.structure.isEmpty).toBe(true);
        expect(result.structure.hasStructure).toBe(false);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should handle config with only whitespace', async () => {
      const filePath = createTempConfig('   \n\n   \n');
      try {
        const config = await parseConfig(filePath);
        const result = assessQuality(config);

        expect(result.structure.isEmpty).toBe(true);
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
        expect(result.metrics).toBeDefined();
        // Large config should be flagged
        expect(result.sizeAnalysis.exceedsMaxLines).toBe(true);
      } finally {
        cleanupTempFile(filePath);
      }
    });
  });

  describe('determinism', () => {
    it('should be deterministic (same input = same output)', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);

      const result1 = assessQuality(config);
      const result2 = assessQuality(config);

      expect(result1.structure).toEqual(result2.structure);
      expect(result1.sizeAnalysis).toEqual(result2.sizeAnalysis);
      expect(result1.completeness).toEqual(result2.completeness);
      expect(result1.issues.length).toBe(result2.issues.length);
    });
  });
});
