/**
 * T049: Integration tests for quality assessment pipeline
 *
 * Tests the end-to-end quality assessment flow:
 * discovery → parsing → metrics → quality assessment
 *
 * Based on FR-009 (quality scoring) and FR-010 (anti-pattern detection).
 *
 * @module tests/integration/tools/config/quality.test.ts
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { discoverConfigs } from '../../../../src/tools/config/discovery';
import { parseConfig } from '../../../../src/tools/config/parse-config';
import type {
  QualityAssessment,
  ParsedConfig,
} from '../../../../src/tools/config/types';

// Lazy load quality module (TDD - not yet implemented)
type AssessQualityFn = (config: ParsedConfig) => QualityAssessment;
let assessQuality: AssessQualityFn;

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/configs');
const VALID_DIR = path.join(FIXTURES_DIR, 'valid');
const ANTI_PATTERNS_DIR = path.join(FIXTURES_DIR, 'anti-patterns');
const HIERARCHY_DIR = path.join(FIXTURES_DIR, 'hierarchy');

describe('Quality Assessment Pipeline Integration', () => {
  beforeAll(async () => {
    try {
      const qualityModule = await import(
        '../../../../src/tools/config/quality'
      );
      assessQuality = qualityModule.assessQuality;
    } catch {
      assessQuality = () => {
        throw new Error('assessQuality not yet implemented');
      };
    }
  });

  describe('discovery → parse → assess flow', () => {
    it('should assess quality of discovered configs', async () => {
      // Discover configs in valid fixtures
      const result = await discoverConfigs({
        cwd: VALID_DIR,
        maxDepth: 1,
      });

      // Should find at least one config
      expect(result.files.length).toBeGreaterThan(0);

      // Parse and assess each config
      for (const configFile of result.files) {
        const parsed = await parseConfig(configFile.path);
        const assessment = assessQuality(parsed);

        // Verify assessment structure
        expect(assessment.score).toBeGreaterThanOrEqual(0);
        expect(assessment.score).toBeLessThanOrEqual(100);
        expect(['A', 'B', 'C', 'D', 'F']).toContain(assessment.grade);
        expect(assessment.dimensions).toBeDefined();
        expect(assessment.recommendations).toBeInstanceOf(Array);
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
        expect(assessment.score).toBeDefined();
        expect(assessment.grade).toBeDefined();
      }
    });
  });

  describe('quality scoring consistency', () => {
    it('should score well-structured configs higher than anti-patterns', async () => {
      // Parse a good config
      const goodPath = path.join(VALID_DIR, 'claude-complex.md');
      const goodConfig = await parseConfig(goodPath);
      const goodAssessment = assessQuality(goodConfig);

      // Parse an anti-pattern config
      const badPath = path.join(ANTI_PATTERNS_DIR, 'generic-rules.md');
      const badConfig = await parseConfig(badPath);
      const badAssessment = assessQuality(badConfig);

      // Good config should score higher
      expect(goodAssessment.score).toBeGreaterThan(badAssessment.score);
    });

    it('should penalize instruction overload configs', async () => {
      const overloadPath = path.join(ANTI_PATTERNS_DIR, 'instruction-overload.md');
      if (fs.existsSync(overloadPath)) {
        const config = await parseConfig(overloadPath);
        const assessment = assessQuality(config);

        // Should have penalty and issues
        expect(assessment.dimensions.antiPatternPenalty).toBeGreaterThan(0);
        expect(assessment.issues.length).toBeGreaterThan(0);

        // Grade should reflect issues
        expect(['C', 'D', 'F']).toContain(assessment.grade);
      }
    });

    it('should be deterministic (same input = same output)', async () => {
      const filePath = path.join(VALID_DIR, 'claude-simple.md');
      const config = await parseConfig(filePath);

      const assessment1 = assessQuality(config);
      const assessment2 = assessQuality(config);

      expect(assessment1.score).toBe(assessment2.score);
      expect(assessment1.grade).toBe(assessment2.grade);
      expect(assessment1.dimensions).toEqual(assessment2.dimensions);
    });
  });

  describe('metrics integration', () => {
    it('should use parsed metrics in quality calculation', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const config = await parseConfig(filePath);
      const assessment = assessQuality(config);

      // Assessment should be influenced by metrics
      // (Token count, section count, etc.)
      expect(config.metrics.tokenEstimate).toBeGreaterThan(0);
      expect(assessment.dimensions.size).toBeDefined();

      // Size scoring should correlate with token count
      if (config.metrics.tokenEstimate < 3000) {
        expect(assessment.dimensions.size).toBeGreaterThan(50);
      }
    });

    it('should factor section structure into assessment', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const config = await parseConfig(filePath);
      const assessment = assessQuality(config);

      // Config with good section structure should score well
      if (config.metrics.sectionCount > 2) {
        expect(assessment.dimensions.structure).toBeGreaterThan(40);
      }
    });
  });

  describe('recommendations generation', () => {
    it('should generate actionable recommendations', async () => {
      const badPath = path.join(ANTI_PATTERNS_DIR, 'generic-rules.md');
      const config = await parseConfig(badPath);
      const assessment = assessQuality(config);

      // Should have recommendations for issues
      if (assessment.issues.length > 0) {
        expect(assessment.recommendations.length).toBeGreaterThan(0);

        // Recommendations should be strings
        for (const rec of assessment.recommendations) {
          expect(typeof rec).toBe('string');
          expect(rec.length).toBeGreaterThan(0);
        }
      }
    });

    it('should not generate excessive recommendations for good configs', async () => {
      const goodPath = path.join(VALID_DIR, 'claude-complex.md');
      const config = await parseConfig(goodPath);
      const assessment = assessQuality(config);

      // High-scoring config should have few recommendations
      if (assessment.score >= 80) {
        expect(assessment.recommendations.length).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('hierarchy integration', () => {
    it('should assess configs at different hierarchy levels', async () => {
      // Check if hierarchy fixtures exist
      const projectDir = path.join(HIERARCHY_DIR, 'project');
      const localDir = path.join(HIERARCHY_DIR, 'local');

      if (fs.existsSync(projectDir) && fs.existsSync(localDir)) {
        // Discover configs at different levels
        const result = await discoverConfigs({
          cwd: HIERARCHY_DIR,
          maxDepth: 10,
        });

        // Parse and assess each
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
          expect(assessment.score).toBeGreaterThanOrEqual(0);
          expect(assessment.grade).toBeDefined();
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
        expect(assessment.score).toBeDefined();
        expect(assessment.score).toBeLessThan(50); // Empty should score low
      } finally {
        fs.rmSync(tempDir, { recursive: true });
      }
    });

    it('should handle assessment of JSON configs', async () => {
      const settingsPath = path.join(VALID_DIR, 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const config = await parseConfig(settingsPath);
        const assessment = assessQuality(config);

        // JSON configs should be assessable
        expect(assessment.score).toBeDefined();
        expect(assessment.grade).toBeDefined();
      }
    });
  });

  describe('performance characteristics', () => {
    it('should assess large configs without timeout', async () => {
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

        // Large config should have size penalty
        expect(assessment.dimensions.size).toBeLessThan(60);
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
