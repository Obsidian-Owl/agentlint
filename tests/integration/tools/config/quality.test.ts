/**
 * T049: Integration tests for quality assessment pipeline
 *
 * Tests the end-to-end quality assessment flow:
 * discovery → parsing → metrics → quality analysis
 *
 * Per ADR-0019, tests verify raw metrics extraction, not scoring.
 *
 * @module tests/integration/tools/config/quality.test.ts
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { discoverConfigs } from '../../../../src/tools/config/discovery';
import { parseConfig } from '../../../../src/tools/config/parse-config';
import type { QualityAssessment, ParsedConfig } from '../../../../src/tools/config/types';

// Lazy load quality module
type AssessQualityFn = (config: ParsedConfig) => QualityAssessment;
let assessQuality: AssessQualityFn;

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/configs');
const VALID_DIR = path.join(FIXTURES_DIR, 'valid');
const ANTI_PATTERNS_DIR = path.join(FIXTURES_DIR, 'anti-patterns');
const HIERARCHY_DIR = path.join(FIXTURES_DIR, 'hierarchy');

describe('Quality Assessment Pipeline Integration', () => {
  beforeAll(async () => {
    const qualityModule = await import('../../../../src/tools/config/quality');
    assessQuality = qualityModule.assessQuality;
  });

  describe('discovery → parse → assess flow', () => {
    it('should analyze quality of discovered configs', async () => {
      // Discover configs in valid fixtures
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        maxDepth: 1,
      });

      // Should find at least one config
      expect(result.files.length).toBeGreaterThan(0);

      // Parse and analyze each config
      for (const configFile of result.files) {
        const parsed = await parseConfig(configFile.path);
        const assessment = assessQuality(parsed);

        // Verify assessment structure (raw metrics, not scores)
        expect(assessment.metrics).toBeDefined();
        expect(assessment.structure).toBeDefined();
        expect(assessment.sizeAnalysis).toBeDefined();
        expect(assessment.completeness).toBeDefined();
        expect(assessment.issues).toBeInstanceOf(Array);
      }
    });

    it('should process multiple configs efficiently', async () => {
      const result = await discoverConfigs({
        cwd: FIXTURES_DIR,
        maxDepth: 10,
      });

      const start = performance.now();

      const assessments = await Promise.all(
        result.files.map(async (configFile) => {
          const parsed = await parseConfig(configFile.path);
          return assessQuality(parsed);
        })
      );

      const elapsed = performance.now() - start;

      // Should complete reasonably fast (< 5s for all fixtures)
      expect(elapsed).toBeLessThan(5000);

      // All assessments should be valid
      for (const assessment of assessments) {
        expect(assessment.metrics).toBeDefined();
        expect(assessment.structure).toBeDefined();
      }
    });
  });

  describe('quality analysis consistency', () => {
    it('should detect more issues in anti-pattern configs than well-structured ones', async () => {
      // Parse a good config
      const goodPath = path.join(VALID_DIR, 'claude-complex.md');
      const goodConfig = await parseConfig(goodPath);
      const goodAssessment = assessQuality(goodConfig);

      // Parse an anti-pattern config
      const badPath = path.join(ANTI_PATTERNS_DIR, 'generic-rules.md');
      const badConfig = await parseConfig(badPath);
      const badAssessment = assessQuality(badConfig);

      // Anti-pattern config should have more issues
      expect(badAssessment.issues.length).toBeGreaterThan(goodAssessment.issues.length);
    });

    it('should flag instruction overload configs', async () => {
      const overloadPath = path.join(ANTI_PATTERNS_DIR, 'instruction-overload.md');
      if (fs.existsSync(overloadPath)) {
        const config = await parseConfig(overloadPath);
        const assessment = assessQuality(config);

        // Should have instruction-overload issue
        const overloadIssues = assessment.issues.filter((i) => i.type === 'instruction-overload');
        expect(overloadIssues.length).toBeGreaterThan(0);
      }
    });

    it('should be deterministic (same input = same output)', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);

      const assessment1 = assessQuality(config);
      const assessment2 = assessQuality(config);

      expect(assessment1.structure).toEqual(assessment2.structure);
      expect(assessment1.sizeAnalysis).toEqual(assessment2.sizeAnalysis);
      expect(assessment1.completeness).toEqual(assessment2.completeness);
      expect(assessment1.issues.length).toBe(assessment2.issues.length);
    });
  });

  describe('metrics integration', () => {
    it('should include parsed metrics in quality assessment', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const config = await parseConfig(filePath);
      const assessment = assessQuality(config);

      // Assessment should include metrics from parsing
      expect(assessment.metrics.tokenEstimate).toBeGreaterThan(0);
      expect(assessment.metrics.lineCount).toBeGreaterThan(0);
    });

    it('should report structure observations based on sections', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const config = await parseConfig(filePath);
      const assessment = assessQuality(config);

      // Config with sections should show structure
      if (config.metrics.sectionCount > 2) {
        expect(assessment.structure.hasStructure).toBe(true);
        expect(assessment.structure.sectionCount).toBeGreaterThan(0);
      }
    });
  });

  describe('issue detection', () => {
    it('should detect issues in problematic configs', async () => {
      const badPath = path.join(ANTI_PATTERNS_DIR, 'generic-rules.md');
      const config = await parseConfig(badPath);
      const assessment = assessQuality(config);

      // Should have issues
      expect(assessment.issues.length).toBeGreaterThan(0);

      // Issues should have required fields
      for (const issue of assessment.issues) {
        expect(issue.id).toBeDefined();
        expect(issue.type).toBeDefined();
        expect(issue.severity).toBeDefined();
        expect(issue.message).toBeDefined();
      }
    });

    it('should have minimal issues for well-structured configs', async () => {
      const goodPath = path.join(VALID_DIR, 'claude-complex.md');
      const config = await parseConfig(goodPath);
      const assessment = assessQuality(config);

      // Well-structured config should have fewer issues
      expect(assessment.issues.length).toBeLessThan(10);
    });
  });

  describe('hierarchy integration', () => {
    it('should analyze configs at different hierarchy levels', async () => {
      // Check if hierarchy fixtures exist
      const projectDir = path.join(HIERARCHY_DIR, 'project');
      const localDir = path.join(HIERARCHY_DIR, 'local');

      if (fs.existsSync(projectDir) && fs.existsSync(localDir)) {
        // Discover configs at different levels
        const result = await discoverConfigs({
          cwd: HIERARCHY_DIR,
          maxDepth: 10,
        });

        // Parse and analyze each
        const assessments = await Promise.all(
          result.files.map(async (configFile) => {
            const parsed = await parseConfig(configFile.path);
            return {
              level: parsed.file.level,
              assessment: assessQuality(parsed),
            };
          })
        );

        // All levels should produce valid assessments
        for (const { assessment } of assessments) {
          expect(assessment.metrics).toBeDefined();
          expect(assessment.structure).toBeDefined();
        }
      }
    });
  });

  describe('error handling', () => {
    it('should handle assessment of empty configs gracefully', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-test-'));
      const filePath = path.join(tempDir, 'CLAUDE.md');
      fs.writeFileSync(filePath, '');

      try {
        const config = await parseConfig(filePath);
        const assessment = assessQuality(config);

        // Should return valid assessment, not crash
        expect(assessment.structure.isEmpty).toBe(true);
        expect(assessment.structure.hasStructure).toBe(false);
      } finally {
        fs.rmSync(tempDir, { recursive: true });
      }
    });

    it('should handle assessment of JSON configs', async () => {
      const settingsPath = path.join(VALID_DIR, 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const config = await parseConfig(settingsPath);
        const assessment = assessQuality(config);

        // JSON configs should be analyzable
        expect(assessment.metrics).toBeDefined();
        expect(assessment.sizeAnalysis).toBeDefined();
      }
    });
  });

  describe('performance characteristics', () => {
    it('should analyze large configs without timeout', async () => {
      // Create a large config
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-test-'));
      const filePath = path.join(tempDir, 'CLAUDE.md');

      const lines = ['# Large Config', ''];
      for (let i = 0; i < 300; i++) {
        lines.push(`## Section ${i}`);
        lines.push(`Content for section ${i} with some detail.`);
        lines.push('');
      }
      fs.writeFileSync(filePath, lines.join('\n'));

      try {
        const start = performance.now();
        const config = await parseConfig(filePath);
        const assessment = assessQuality(config);
        const elapsed = performance.now() - start;

        // Should complete in reasonable time
        expect(elapsed).toBeLessThan(2000);

        // Large config should be flagged
        expect(assessment.sizeAnalysis.exceedsMaxLines).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true });
      }
    });

    it('should not allocate excessive memory', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const config = await parseConfig(filePath);

      // Get baseline memory
      const baselineMemory = process.memoryUsage().heapUsed;

      // Run assessment multiple times
      for (let i = 0; i < 100; i++) {
        assessQuality(config);
      }

      // Check memory didn't grow excessively
      const finalMemory = process.memoryUsage().heapUsed;
      const growth = finalMemory - baselineMemory;

      // Growth should be reasonable (< 10MB for 100 assessments)
      expect(growth).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
