/**
 * T039-T041: Unit tests for configuration metrics extraction
 *
 * Tests the extractMetrics() function for extracting quantitative signals
 * from AI configuration files.
 *
 * @module tests/unit/tools/config/metrics.test.ts
 */

import { describe, it, expect } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

// Import will use metrics.ts once created, currently using parse-config
// import { extractMetrics } from '../../../../src/tools/config/metrics';
import { parseConfig } from '../../../../src/tools/config/parse-config';
import type { ConfigMetrics } from '../../../../src/tools/config/types';

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/configs');
const VALID_DIR = path.join(FIXTURES_DIR, 'valid');

// Helper to get metrics from a file
async function getMetrics(filePath: string): Promise<ConfigMetrics> {
  const result = await parseConfig(filePath);
  return result.metrics;
}

// Helper to create temp file with content
function createTempFile(content: string, filename = 'CLAUDE.md'): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-metrics-'));
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

// Helper to cleanup temp file
function cleanupTempFile(filePath: string): void {
  const tempDir = path.dirname(filePath);
  fs.unlinkSync(filePath);
  fs.rmdirSync(tempDir);
}

describe('extractMetrics', () => {
  // ===========================================================================
  // T039: Token Estimation Tests
  // ===========================================================================
  describe('token estimation (T039)', () => {
    it('should estimate tokens using char/4 ratio', async () => {
      const content = 'a'.repeat(1000); // 1000 chars
      const filePath = createTempFile(`# Test\n\n${content}`);

      try {
        const metrics = await getMetrics(filePath);
        // ~1008 chars total (header + newlines + content)
        // Expected: ~252 tokens
        expect(metrics.tokenEstimate).toBeGreaterThan(200);
        expect(metrics.tokenEstimate).toBeLessThan(300);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should return 0 tokens for empty file', async () => {
      const filePath = createTempFile('');

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.tokenEstimate).toBe(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should scale linearly with content size', async () => {
      const smallContent = 'x'.repeat(100);
      const largeContent = 'x'.repeat(1000);

      const smallFile = createTempFile(smallContent);
      const largeFile = createTempFile(largeContent);

      try {
        const smallMetrics = await getMetrics(smallFile);
        const largeMetrics = await getMetrics(largeFile);

        // Large should be ~10x small (within some margin)
        const ratio = largeMetrics.tokenEstimate / smallMetrics.tokenEstimate;
        expect(ratio).toBeGreaterThan(7);
        expect(ratio).toBeLessThan(13);
      } finally {
        cleanupTempFile(smallFile);
        cleanupTempFile(largeFile);
      }
    });

    it('should estimate tokens accurately for markdown', async () => {
      // Real CLAUDE.md content
      const content = `# Project Configuration

## Overview

This is a project configuration file.

## Commands

\`\`\`bash
npm install
npm test
\`\`\`

## Guidelines

- Follow coding standards
- Write tests
- Document changes
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        // Content is ~200 chars, expect ~50 tokens
        expect(metrics.tokenEstimate).toBeGreaterThan(30);
        expect(metrics.tokenEstimate).toBeLessThan(100);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should handle unicode characters', async () => {
      const content = '# Test\n\n🎉 Unicode: 日本語 한국어 العربية';
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.tokenEstimate).toBeGreaterThan(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should provide reasonable estimate for complex fixture', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const content = fs.readFileSync(filePath, 'utf-8');
      const metrics = await getMetrics(filePath);

      // Token estimate should be roughly char_count / 4
      const expectedRange = {
        min: Math.floor(content.length / 6), // Allow some variance
        max: Math.ceil(content.length / 3),
      };

      expect(metrics.tokenEstimate).toBeGreaterThanOrEqual(expectedRange.min);
      expect(metrics.tokenEstimate).toBeLessThanOrEqual(expectedRange.max);
    });
  });

  // ===========================================================================
  // T040: Section/Depth Metrics Tests
  // ===========================================================================
  describe('section and depth metrics (T040)', () => {
    it('should count line count accurately', async () => {
      const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.lineCount).toBe(5);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should count sections correctly', async () => {
      const content = `# Section 1

Content here.

## Section 2

More content.

## Section 3

Even more.
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        // Top-level sections (# headings that become root)
        expect(metrics.sectionCount).toBeGreaterThanOrEqual(1);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should track max heading depth', async () => {
      const content = `# Level 1

## Level 2

### Level 3

#### Level 4

Content at depth 4.
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.maxHeadingDepth).toBe(4);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should return 0 for max depth with no headings', async () => {
      const content = 'Just plain text without any headings.';
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.maxHeadingDepth).toBe(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should count code blocks', async () => {
      const content = `# Test

\`\`\`javascript
const x = 1;
\`\`\`

\`\`\`python
x = 1
\`\`\`

\`\`\`bash
echo "hello"
\`\`\`
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.codeBlockCount).toBe(3);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should collect code block languages', async () => {
      const content = `# Test

\`\`\`typescript
const x: number = 1;
\`\`\`

\`\`\`bash
npm install
\`\`\`

\`\`\`typescript
// Another TS block
\`\`\`
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.codeBlockLanguages).toContain('typescript');
        expect(metrics.codeBlockLanguages).toContain('bash');
        // Should dedupe languages
        expect(metrics.codeBlockLanguages.filter((l) => l === 'typescript').length).toBe(1);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should handle code blocks without language', async () => {
      const content = `# Test

\`\`\`
plain code
\`\`\`
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.codeBlockCount).toBe(1);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should count word count', async () => {
      const content = '# Title\n\nOne two three four five.';
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        // "Title", "One", "two", "three", "four", "five" = 6 words
        expect(metrics.wordCount).toBeGreaterThanOrEqual(5);
        expect(metrics.wordCount).toBeLessThanOrEqual(7);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should count links', async () => {
      const content = `# Test

Check [link 1](https://example.com) and [link 2](https://test.com).

Also see [another link](./local.md).
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.linkCount).toBe(3);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should validate metrics from complex fixture', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const metrics = await getMetrics(filePath);

      // claude-complex.md has known structure
      expect(metrics.lineCount).toBeGreaterThan(30);
      expect(metrics.sectionCount).toBeGreaterThanOrEqual(1);
      expect(metrics.maxHeadingDepth).toBeGreaterThanOrEqual(2);
      expect(metrics.codeBlockCount).toBeGreaterThanOrEqual(2);
      expect(metrics.codeBlockLanguages).toContain('typescript');
      expect(metrics.codeBlockLanguages).toContain('bash');
    });
  });

  // ===========================================================================
  // T041: Emphasis Marker Counting Tests
  // ===========================================================================
  describe('emphasis marker counting (T041)', () => {
    it('should count MUST occurrences', async () => {
      const content = `# Rules

You MUST follow these rules.
You MUST NOT ignore them.
This is a must-have feature.
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        // "MUST" appears twice (word boundary), "must-have" doesn't count
        expect(metrics.emphasisMarkerCount.must).toBe(2);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should count IMPORTANT occurrences', async () => {
      const content = `# Guidelines

IMPORTANT: Follow the style guide.
This is also IMPORTANT to note.
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.emphasisMarkerCount.important).toBe(2);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should count CRITICAL occurrences', async () => {
      const content = `# Warnings

CRITICAL: Do not skip tests.
This is CRITICAL for production.
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.emphasisMarkerCount.critical).toBe(2);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should count NEVER occurrences', async () => {
      const content = `# Don'ts

NEVER commit secrets.
You should NEVER skip code review.
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.emphasisMarkerCount.never).toBe(2);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should count ALWAYS occurrences', async () => {
      const content = `# Best Practices

ALWAYS write tests.
You should ALWAYS document your code.
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.emphasisMarkerCount.always).toBe(2);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should calculate total correctly', async () => {
      const content = `# Combined

MUST do this.
IMPORTANT: Note this.
CRITICAL: Watch out.
NEVER do that.
ALWAYS remember.
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.emphasisMarkerCount.must).toBe(1);
        expect(metrics.emphasisMarkerCount.important).toBe(1);
        expect(metrics.emphasisMarkerCount.critical).toBe(1);
        expect(metrics.emphasisMarkerCount.never).toBe(1);
        expect(metrics.emphasisMarkerCount.always).toBe(1);
        expect(metrics.emphasisMarkerCount.total).toBe(5);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should not count lowercase variations', async () => {
      const content = `# Case Sensitivity

You must follow rules.
This is important.
This is critical.
Never do this.
Always do that.
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        // Lowercase should not be counted
        expect(metrics.emphasisMarkerCount.total).toBe(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should handle no emphasis markers', async () => {
      const content = `# Simple

Just regular content without any emphasis markers.
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.emphasisMarkerCount.must).toBe(0);
        expect(metrics.emphasisMarkerCount.important).toBe(0);
        expect(metrics.emphasisMarkerCount.critical).toBe(0);
        expect(metrics.emphasisMarkerCount.never).toBe(0);
        expect(metrics.emphasisMarkerCount.always).toBe(0);
        expect(metrics.emphasisMarkerCount.total).toBe(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should count emphasis in complex fixture', async () => {
      const filePath = path.join(VALID_DIR, 'claude-complex.md');
      const metrics = await getMetrics(filePath);

      // claude-complex.md has MUST and CRITICAL in "IMPORTANT Guidelines" section
      expect(metrics.emphasisMarkerCount.must).toBeGreaterThanOrEqual(1);
      expect(metrics.emphasisMarkerCount.critical).toBeGreaterThanOrEqual(1);
      expect(metrics.emphasisMarkerCount.total).toBeGreaterThan(0);
    });

    it('should handle emphasis in code blocks', async () => {
      const content = `# Test

Some rules:

\`\`\`
// MUST is in a code block
// NEVER run in production
\`\`\`

Outside code: MUST do this.
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        // Currently counts all occurrences including in code blocks
        // This is acceptable behavior - code examples often show patterns
        expect(metrics.emphasisMarkerCount.must).toBeGreaterThanOrEqual(1);
      } finally {
        cleanupTempFile(filePath);
      }
    });
  });

  // ===========================================================================
  // JSON Config Metrics
  // ===========================================================================
  describe('JSON config metrics', () => {
    it('should return zero-ed metrics for sections and code blocks', async () => {
      const filePath = path.join(VALID_DIR, 'settings.json');
      const metrics = await getMetrics(filePath);

      expect(metrics.sectionCount).toBe(0);
      expect(metrics.maxHeadingDepth).toBe(0);
      expect(metrics.codeBlockCount).toBe(0);
      expect(metrics.codeBlockLanguages).toEqual([]);
    });

    it('should still count lines and tokens for JSON', async () => {
      const filePath = path.join(VALID_DIR, 'settings.json');
      const metrics = await getMetrics(filePath);

      expect(metrics.lineCount).toBeGreaterThan(0);
      expect(metrics.tokenEstimate).toBeGreaterThan(0);
    });

    it('should have zero emphasis markers for JSON', async () => {
      const filePath = path.join(VALID_DIR, 'settings.json');
      const metrics = await getMetrics(filePath);

      expect(metrics.emphasisMarkerCount.total).toBe(0);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================
  describe('edge cases', () => {
    it('should handle file with only whitespace', async () => {
      const content = '   \n\n   \t\t\n   ';
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.lineCount).toBeGreaterThan(0);
        expect(metrics.wordCount).toBe(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should handle file with only headings', async () => {
      const content = `# H1
## H2
### H3
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.maxHeadingDepth).toBe(3);
        expect(metrics.sectionCount).toBeGreaterThanOrEqual(1);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should handle deeply nested headings', async () => {
      const content = `# H1
## H2
### H3
#### H4
##### H5
###### H6
`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.maxHeadingDepth).toBe(6);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should handle very long lines', async () => {
      const longLine = 'x'.repeat(10000);
      const content = `# Test\n\n${longLine}`;
      const filePath = createTempFile(content);

      try {
        const metrics = await getMetrics(filePath);
        expect(metrics.tokenEstimate).toBeGreaterThan(2000);
      } finally {
        cleanupTempFile(filePath);
      }
    });
  });
});
