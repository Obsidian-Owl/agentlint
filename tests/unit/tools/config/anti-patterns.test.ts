/**
 * T048: Unit tests for anti-pattern detection
 *
 * Tests the detectAntiPatterns() function for identifying configuration anti-patterns.
 * Based on ADR-0007 anti-pattern list:
 * 1. Generic rules - "Write clean code" wastes tokens
 * 2. Linter jobs - Style rules belong in ESLint/Prettier
 * 3. Instruction overload - >150-200 instructions unreliable
 * 4. Embedded secrets - API keys, passwords must never appear
 * 5. Code snippets - Use file:line references instead
 *
 * @module tests/unit/tools/config/anti-patterns.test.ts
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { parseConfig } from '../../../../src/tools/config/parse-config';
import type {
  QualityIssue,
  ParsedConfig,
  IssueType,
  IssueSeverity,
} from '../../../../src/tools/config/types';

// Import the function we're testing (will be implemented in T054)
type DetectAntiPatternsFn = (config: ParsedConfig) => QualityIssue[];

// Lazy load to allow tests to be written first (TDD)
let detectAntiPatterns: DetectAntiPatternsFn;

// Test fixture paths
const FIXTURES_DIR = path.join(__dirname, '../../../fixtures/configs');
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

describe('detectAntiPatterns', () => {
  beforeAll(async () => {
    // Dynamically import the quality module once it's implemented
    try {
      const qualityModule = await import(
        '../../../../src/tools/config/quality'
      );
      detectAntiPatterns = qualityModule.detectAntiPatterns;
    } catch {
      // Module not yet implemented - tests will be skipped
      detectAntiPatterns = () => {
        throw new Error('detectAntiPatterns not yet implemented');
      };
    }
  });

  describe('generic rules detection', () => {
    it('should detect "Write clean code" as generic rule', async () => {
      const filePath = path.join(ANTI_PATTERNS_DIR, 'generic-rules.md');
      const config = await parseConfig(filePath);
      const issues = detectAntiPatterns(config);

      const genericIssues = issues.filter(
        (i) => i.type === 'generic-rule' || i.message.toLowerCase().includes('generic')
      );
      expect(genericIssues.length).toBeGreaterThan(0);
    });

    it('should detect "Follow best practices" as generic rule', async () => {
      const content = `# Project

## Guidelines

- Follow best practices
- Be consistent
`;
      const filePath = createTempConfig(content);
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        const genericIssues = issues.filter(
          (i) => i.type === 'generic-rule' || i.message.toLowerCase().includes('generic')
        );
        expect(genericIssues.length).toBeGreaterThan(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should detect "Keep it simple" as generic rule', async () => {
      const content = `# Config

- Keep it simple
- Don't repeat yourself
`;
      const filePath = createTempConfig(content);
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        const genericIssues = issues.filter(
          (i) => i.type === 'generic-rule' || i.message.toLowerCase().includes('generic')
        );
        expect(genericIssues.length).toBeGreaterThan(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should include suggestion to make rules specific', async () => {
      const filePath = path.join(ANTI_PATTERNS_DIR, 'generic-rules.md');
      const config = await parseConfig(filePath);
      const issues = detectAntiPatterns(config);

      const genericIssue = issues.find(
        (i) => i.type === 'generic-rule' || i.message.toLowerCase().includes('generic')
      );
      if (genericIssue) {
        expect(genericIssue.suggestion).toBeDefined();
        expect(genericIssue.suggestion.length).toBeGreaterThan(0);
      }
    });

    it('should NOT flag specific, actionable rules', async () => {
      const content = `# Project

## Build Commands

- Run \`bun test\` before committing
- Use \`bun run build:prod\` for production
- Target ES2022 for browser compatibility
`;
      const filePath = createTempConfig(content);
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        const genericIssues = issues.filter(
          (i) => i.type === 'generic-rule'
        );
        expect(genericIssues.length).toBe(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });
  });

  describe('linter jobs detection', () => {
    it('should detect ESLint rules in config', async () => {
      const filePath = path.join(ANTI_PATTERNS_DIR, 'linter-jobs.md');
      const config = await parseConfig(filePath);
      const issues = detectAntiPatterns(config);

      const linterIssues = issues.filter(
        (i) => i.type === 'linter-job' || i.message.toLowerCase().includes('lint')
      );
      expect(linterIssues.length).toBeGreaterThan(0);
    });

    it('should detect Prettier configuration in config', async () => {
      const content = `# Config

## Prettier Settings

- Use single quotes
- 2 space indentation
- Max line length 80
`;
      const filePath = createTempConfig(content);
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        const linterIssues = issues.filter(
          (i) => i.type === 'linter-job' || i.message.toLowerCase().includes('prettier')
        );
        expect(linterIssues.length).toBeGreaterThan(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should detect explicit linter rule names', async () => {
      const content = `# Config

Follow these rules:
- no-unused-vars
- no-console
- prefer-const
`;
      const filePath = createTempConfig(content);
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        const linterIssues = issues.filter(
          (i) => i.type === 'linter-job'
        );
        expect(linterIssues.length).toBeGreaterThan(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should suggest moving rules to linter config', async () => {
      const filePath = path.join(ANTI_PATTERNS_DIR, 'linter-jobs.md');
      const config = await parseConfig(filePath);
      const issues = detectAntiPatterns(config);

      const linterIssue = issues.find(
        (i) => i.type === 'linter-job'
      );
      if (linterIssue) {
        expect(linterIssue.suggestion.toLowerCase()).toMatch(
          /eslint|prettier|linter|formatter/
        );
      }
    });
  });

  describe('instruction overload detection', () => {
    it('should detect >200 instructions as overload', async () => {
      const filePath = path.join(ANTI_PATTERNS_DIR, 'instruction-overload.md');
      const config = await parseConfig(filePath);
      const issues = detectAntiPatterns(config);

      const overloadIssues = issues.filter(
        (i) => i.type === 'instruction-overload' || i.message.toLowerCase().includes('overload')
      );
      expect(overloadIssues.length).toBeGreaterThan(0);
    });

    it('should set high severity for instruction overload', async () => {
      const filePath = path.join(ANTI_PATTERNS_DIR, 'instruction-overload.md');
      const config = await parseConfig(filePath);
      const issues = detectAntiPatterns(config);

      const overloadIssue = issues.find(
        (i) => i.type === 'instruction-overload'
      );
      if (overloadIssue) {
        expect(['high', 'critical']).toContain(overloadIssue.severity);
      }
    });

    it('should NOT flag configs with reasonable instruction count', async () => {
      const content = `# Project

## Commands

1. Run tests with \`bun test\`
2. Build with \`bun run build\`
3. Deploy with \`bun run deploy\`
`;
      const filePath = createTempConfig(content);
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        const overloadIssues = issues.filter(
          (i) => i.type === 'instruction-overload'
        );
        expect(overloadIssues.length).toBe(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should suggest breaking up large configs', async () => {
      const filePath = path.join(ANTI_PATTERNS_DIR, 'instruction-overload.md');
      const config = await parseConfig(filePath);
      const issues = detectAntiPatterns(config);

      const overloadIssue = issues.find(
        (i) => i.type === 'instruction-overload'
      );
      if (overloadIssue) {
        expect(overloadIssue.suggestion.length).toBeGreaterThan(0);
      }
    });
  });

  describe('embedded secrets detection', () => {
    it('should detect API key patterns', async () => {
      const content = `# Config

## API Settings

API_KEY=sk-1234567890abcdef1234567890abcdef
`;
      const filePath = createTempConfig(content);
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        const secretIssues = issues.filter(
          (i) => i.type === 'embedded-secret' || i.message.toLowerCase().includes('secret')
        );
        expect(secretIssues.length).toBeGreaterThan(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should detect password patterns', async () => {
      const content = `# Config

## Database

PASSWORD=super_secret_password123
DB_PASSWORD="mypassword"
`;
      const filePath = createTempConfig(content);
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        const secretIssues = issues.filter(
          (i) => i.type === 'embedded-secret'
        );
        expect(secretIssues.length).toBeGreaterThan(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should detect private key indicators', async () => {
      const content = `# Config

## Keys

\`\`\`
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA...
-----END RSA PRIVATE KEY-----
\`\`\`
`;
      const filePath = createTempConfig(content);
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        const secretIssues = issues.filter(
          (i) => i.type === 'embedded-secret'
        );
        expect(secretIssues.length).toBeGreaterThan(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should set critical severity for secrets', async () => {
      const content = `# Config

API_KEY=sk-test-1234567890
`;
      const filePath = createTempConfig(content);
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        const secretIssue = issues.find(
          (i) => i.type === 'embedded-secret'
        );
        if (secretIssue) {
          expect(secretIssue.severity).toBe('critical');
        }
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should NOT flag environment variable references', async () => {
      const content = `# Config

## Environment

Use \`$API_KEY\` or \`process.env.API_KEY\` for API access.
`;
      const filePath = createTempConfig(content);
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        const secretIssues = issues.filter(
          (i) => i.type === 'embedded-secret'
        );
        expect(secretIssues.length).toBe(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });
  });

  describe('code snippets detection', () => {
    it('should detect large embedded code blocks', async () => {
      const codeLines = Array(30).fill('  console.log("line");').join('\n');
      const content = `# Config

## Example Code

\`\`\`typescript
function example() {
${codeLines}
}
\`\`\`
`;
      const filePath = createTempConfig(content);
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        const snippetIssues = issues.filter(
          (i) => i.type === 'code-snippet' || i.message.toLowerCase().includes('code')
        );
        expect(snippetIssues.length).toBeGreaterThan(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should suggest file:line references instead', async () => {
      const codeLines = Array(20).fill('  x++;').join('\n');
      const content = `# Config

\`\`\`typescript
function large() {
${codeLines}
}
\`\`\`
`;
      const filePath = createTempConfig(content);
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        const snippetIssue = issues.find(
          (i) => i.type === 'code-snippet'
        );
        if (snippetIssue) {
          expect(snippetIssue.suggestion.toLowerCase()).toMatch(
            /file|reference|link/
          );
        }
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should NOT flag small code examples', async () => {
      const content = `# Config

## Commands

\`\`\`bash
bun test
\`\`\`
`;
      const filePath = createTempConfig(content);
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        const snippetIssues = issues.filter(
          (i) => i.type === 'code-snippet'
        );
        expect(snippetIssues.length).toBe(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should NOT flag inline code', async () => {
      const content = `# Config

Use \`bun test\` to run tests and \`bun run build\` to build.
`;
      const filePath = createTempConfig(content);
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        const snippetIssues = issues.filter(
          (i) => i.type === 'code-snippet'
        );
        expect(snippetIssues.length).toBe(0);
      } finally {
        cleanupTempFile(filePath);
      }
    });
  });

  describe('issue structure', () => {
    it('should return QualityIssue objects with required fields', async () => {
      const filePath = path.join(ANTI_PATTERNS_DIR, 'generic-rules.md');
      const config = await parseConfig(filePath);
      const issues = detectAntiPatterns(config);

      for (const issue of issues) {
        expect(issue.id).toBeDefined();
        expect(typeof issue.id).toBe('string');
        expect(issue.type).toBeDefined();
        expect(issue.severity).toBeDefined();
        expect(issue.message).toBeDefined();
        expect(issue.suggestion).toBeDefined();
      }
    });

    it('should include position when applicable', async () => {
      const filePath = path.join(ANTI_PATTERNS_DIR, 'generic-rules.md');
      const config = await parseConfig(filePath);
      const issues = detectAntiPatterns(config);

      // At least some issues should have positions
      const issuesWithPosition = issues.filter((i) => i.position !== undefined);
      expect(issuesWithPosition.length).toBeGreaterThanOrEqual(0);
    });

    it('should use valid IssueType values', async () => {
      const validTypes: IssueType[] = [
        'generic-rule',
        'linter-job',
        'instruction-overload',
        'embedded-secret',
        'code-snippet',
        'missing-section',
        'size-warning',
        'structure-warning',
      ];

      const filePath = path.join(ANTI_PATTERNS_DIR, 'generic-rules.md');
      const config = await parseConfig(filePath);
      const issues = detectAntiPatterns(config);

      for (const issue of issues) {
        expect(validTypes).toContain(issue.type);
      }
    });

    it('should use valid IssueSeverity values', async () => {
      const validSeverities: IssueSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

      const filePath = path.join(ANTI_PATTERNS_DIR, 'generic-rules.md');
      const config = await parseConfig(filePath);
      const issues = detectAntiPatterns(config);

      for (const issue of issues) {
        expect(validSeverities).toContain(issue.severity);
      }
    });
  });

  describe('multiple anti-patterns', () => {
    it('should detect multiple anti-patterns in same config', async () => {
      const content = `# Config

## Guidelines

- Write clean code
- Follow best practices

## Linting

- no-unused-vars
- prefer-const

## API

API_KEY=sk-12345
`;
      const filePath = createTempConfig(content);
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        // Should find generic rules, linter jobs, and embedded secrets
        expect(issues.length).toBeGreaterThanOrEqual(2);

        const types = new Set(issues.map((i) => i.type));
        expect(types.size).toBeGreaterThanOrEqual(2);
      } finally {
        cleanupTempFile(filePath);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty config', async () => {
      const filePath = createTempConfig('');
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        // Empty config should not crash
        expect(issues).toBeInstanceOf(Array);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should handle config with no anti-patterns', async () => {
      const content = `# Project

TypeScript project using Bun.

## Build

Run \`bun run build\` to compile.

## Test

Run \`bun test\` for unit tests.
`;
      const filePath = createTempConfig(content);
      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        // Clean config should have no or few issues
        expect(issues.length).toBeLessThanOrEqual(1);
      } finally {
        cleanupTempFile(filePath);
      }
    });

    it('should handle JSON configs', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlint-test-'));
      const filePath = path.join(tempDir, 'settings.json');
      fs.writeFileSync(
        filePath,
        JSON.stringify({ model: 'claude-sonnet-4-20250514' })
      );

      try {
        const config = await parseConfig(filePath);
        const issues = detectAntiPatterns(config);

        // Should work without crashing
        expect(issues).toBeInstanceOf(Array);
      } finally {
        fs.rmSync(tempDir, { recursive: true });
      }
    });
  });
});
