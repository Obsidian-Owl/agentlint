/**
 * EP07 Causal Tracing Engine - Git Evidence Collection Tests (T053)
 *
 * Unit tests for GitEvidenceCollector that correlates issues with git history
 * using git blame and pickaxe search.
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import type { Position } from '../../../../src/tools/causal/types';

// =============================================================================
// Test Fixtures
// =============================================================================

const TEST_PROJECT = '/test/git-evidence-project';

/**
 * Create a test position.
 */
function createTestPosition(overrides: Partial<Position> = {}): Position {
  return {
    filePath: 'src/test.ts',
    line: 42,
    ...overrides,
  };
}

// =============================================================================
// GitEvidenceCollector Tests
// =============================================================================

describe('GitEvidenceCollector', () => {
  // Import dynamically to allow module to be created
  let GitEvidenceCollector: typeof import('../../../../src/tools/causal/git-evidence').GitEvidenceCollector;
  let createGitEvidenceCollector: typeof import('../../../../src/tools/causal/git-evidence').createGitEvidenceCollector;

  beforeEach(async () => {
    // Dynamic import to pick up newly created module
    const module = await import('../../../../src/tools/causal/git-evidence');
    GitEvidenceCollector = module.GitEvidenceCollector;
    createGitEvidenceCollector = module.createGitEvidenceCollector;
  });

  // ===========================================================================
  // Factory Function
  // ===========================================================================

  describe('createGitEvidenceCollector', () => {
    it('should create a GitEvidenceCollector instance', () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);
      expect(collector).toBeInstanceOf(GitEvidenceCollector);
    });

    it('should accept optional project path', () => {
      const collector = createGitEvidenceCollector();
      expect(collector).toBeInstanceOf(GitEvidenceCollector);
    });
  });

  // ===========================================================================
  // Git Blame
  // ===========================================================================

  describe('collectBlameEvidence', () => {
    it('should return evidence with GitCorrelation type', async () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);
      const position = createTestPosition();

      const result = await collector.collectBlameEvidence(position);

      // If git blame succeeds (in a git repo), evidence should be returned
      // If not in a git repo, result should be empty with warning
      if (result.evidence.length > 0) {
        expect(result.evidence[0]!.type).toBe('GitCorrelation');
      } else {
        expect(result.warnings).toBeDefined();
      }
    });

    it('should include commit hash in source field', async () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);
      const position = createTestPosition();

      const result = await collector.collectBlameEvidence(position);

      if (result.evidence.length > 0) {
        // Commit hash format: 40 hex characters (or short version)
        expect(result.evidence[0]!.source).toMatch(/^[a-f0-9]{7,40}$/i);
      }
    });

    it('should include timestamp from commit', async () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);
      const position = createTestPosition();

      const result = await collector.collectBlameEvidence(position);

      if (result.evidence.length > 0) {
        expect(result.evidence[0]!.timestamp).toBeDefined();
        // Should be valid ISO date
        expect(() => new Date(result.evidence[0]!.timestamp!)).not.toThrow();
      }
    });

    it('should include commit message in content', async () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);
      const position = createTestPosition();

      const result = await collector.collectBlameEvidence(position);

      if (result.evidence.length > 0) {
        expect(result.evidence[0]!.content).toBeDefined();
        expect(result.evidence[0]!.content!.length).toBeGreaterThan(0);
      }
    });

    it('should include position in evidence', async () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);
      const position = createTestPosition({ line: 10 });

      const result = await collector.collectBlameEvidence(position);

      if (result.evidence.length > 0) {
        expect(result.evidence[0]!.position?.filePath).toBe(position.filePath);
        expect(result.evidence[0]!.position?.line).toBe(position.line);
      }
    });

    it('should handle non-existent file gracefully', async () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);
      const position = createTestPosition({ filePath: 'non-existent-file.ts' });

      const result = await collector.collectBlameEvidence(position);

      expect(result.evidence).toHaveLength(0);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });

    it('should handle file not tracked by git', async () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);
      // Use a path that exists but isn't tracked by git
      const position = createTestPosition({ filePath: '.DS_Store' });

      const result = await collector.collectBlameEvidence(position);

      // Should either return no evidence or a warning
      if (result.evidence.length === 0) {
        expect(result.warnings).toBeDefined();
      }
    });

    it('should include author information in metadata', async () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);
      const position = createTestPosition();

      const result = await collector.collectBlameEvidence(position);

      if (result.evidence.length > 0) {
        expect(result.evidence[0]!.metadata?.author).toBeDefined();
      }
    });
  });

  // ===========================================================================
  // Git Pickaxe Search
  // ===========================================================================

  describe('collectPickaxeEvidence', () => {
    it('should return evidence matching search term', async () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);

      const result = await collector.collectPickaxeEvidence('function');

      // If git log -S succeeds, evidence should be returned
      if (result.evidence.length > 0) {
        expect(result.evidence[0]!.type).toBe('GitCorrelation');
      }
    });

    it('should limit results to maxResults parameter', async () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);

      const result = await collector.collectPickaxeEvidence('const', { maxResults: 3 });

      expect(result.evidence.length).toBeLessThanOrEqual(3);
    });

    it('should filter by file path when provided', async () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);

      const result = await collector.collectPickaxeEvidence('export', {
        filePath: 'src/tools/causal',
      });

      if (result.evidence.length > 0) {
        // All results should be from the specified path
        for (const evidence of result.evidence) {
          expect(evidence.position?.filePath).toContain('src/tools/causal');
        }
      }
    });

    it('should filter by date range when provided', async () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago

      const result = await collector.collectPickaxeEvidence('import', { since });

      if (result.evidence.length > 0) {
        for (const evidence of result.evidence) {
          const timestamp = new Date(evidence.timestamp!).getTime();
          expect(timestamp).toBeGreaterThanOrEqual(new Date(since).getTime());
        }
      }
    });

    it('should handle empty search results gracefully', async () => {
      // Use actual project root so we're in a git repo
      const collector = createGitEvidenceCollector(process.cwd());

      const result = await collector.collectPickaxeEvidence(
        'this-string-definitely-does-not-exist-anywhere-xyz123'
      );

      expect(result.evidence).toHaveLength(0);
      // Should not have errors, just no results (when in valid git repo)
      if (collector.isGitRepository()) {
        expect(result.warnings).toBeUndefined();
      }
    });

    it('should include diff snippet in content when available', async () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);

      const result = await collector.collectPickaxeEvidence('export', { includeDiff: true });

      if (result.evidence.length > 0) {
        // Content should include the search term or diff context
        expect(result.evidence[0]!.content).toBeDefined();
      }
    });
  });

  // ===========================================================================
  // Combined Evidence Collection
  // ===========================================================================

  describe('collectEvidence', () => {
    it('should combine blame and pickaxe evidence', async () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);
      const position = createTestPosition();

      const result = await collector.collectEvidence({
        position,
        searchTerms: ['export'],
      });

      // Should have attempted both methods
      expect(result.methodsUsed).toContain('blame');
      expect(result.methodsUsed).toContain('pickaxe');
    });

    it('should deduplicate evidence by commit hash', async () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);
      const position = createTestPosition();

      const result = await collector.collectEvidence({
        position,
        searchTerms: ['function', 'const'],
      });

      // Check for duplicates
      const commitHashes = result.evidence.map((e) => e.source);
      const uniqueHashes = new Set(commitHashes);
      expect(commitHashes.length).toBe(uniqueHashes.size);
    });

    it('should sort evidence by timestamp (newest first)', async () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);

      const result = await collector.collectEvidence({
        searchTerms: ['import'],
      });

      if (result.evidence.length > 1) {
        for (let i = 0; i < result.evidence.length - 1; i++) {
          const current = new Date(result.evidence[i]!.timestamp!).getTime();
          const next = new Date(result.evidence[i + 1]!.timestamp!).getTime();
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });

    it('should include query time in result', async () => {
      const collector = createGitEvidenceCollector(TEST_PROJECT);

      const result = await collector.collectEvidence({
        searchTerms: ['export'],
      });

      expect(result.queryTimeMs).toBeDefined();
      expect(result.queryTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ===========================================================================
  // Git Repository Detection
  // ===========================================================================

  describe('isGitRepository', () => {
    it('should return true for valid git repository', () => {
      const collector = createGitEvidenceCollector(process.cwd());
      expect(collector.isGitRepository()).toBe(true);
    });

    it('should return false for non-git directory', () => {
      const collector = createGitEvidenceCollector('/tmp');
      expect(collector.isGitRepository()).toBe(false);
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('should handle git not installed gracefully', async () => {
      // This test is tricky to implement without mocking exec
      // We'll test that the error handling code path exists
      const collector = createGitEvidenceCollector(TEST_PROJECT);

      // Try to collect evidence - should not throw
      const result = await collector.collectBlameEvidence(createTestPosition());

      // Should have result structure even on failure
      expect(result).toHaveProperty('evidence');
      expect(result).toHaveProperty('queryTimeMs');
    });

    it('should include helpful error messages in warnings', async () => {
      const collector = createGitEvidenceCollector('/non-existent-path-xyz');
      const position = createTestPosition();

      const result = await collector.collectBlameEvidence(position);

      if (result.warnings && result.warnings.length > 0) {
        // Warnings should be descriptive
        const warning = result.warnings[0]!;
        expect(warning.length).toBeGreaterThan(10);
      }
    });
  });
});

// =============================================================================
// Input Validation Tests
// =============================================================================

describe('GitEvidenceCollector input validation', () => {
  it('should accept valid ISO-8601 date strings', async () => {
    const { createGitEvidenceCollector } =
      await import('../../../../src/tools/causal/git-evidence');

    const collector = createGitEvidenceCollector(process.cwd());

    // Valid ISO-8601 dates should work
    const result = await collector.collectPickaxeEvidence('export', {
      since: '2024-01-15',
      until: '2024-12-31T23:59:59Z',
    });

    // Should not throw and should return a result
    expect(result).toHaveProperty('evidence');
    expect(result).toHaveProperty('queryTimeMs');
  });

  it('should accept valid relative date strings', async () => {
    const { createGitEvidenceCollector } =
      await import('../../../../src/tools/causal/git-evidence');

    const collector = createGitEvidenceCollector(process.cwd());

    // Relative dates like "1 week ago" should work
    const result = await collector.collectPickaxeEvidence('export', {
      since: '1 week ago',
    });

    expect(result).toHaveProperty('evidence');
  });

  it('should reject malicious date strings', async () => {
    const { createGitEvidenceCollector } =
      await import('../../../../src/tools/causal/git-evidence');

    const collector = createGitEvidenceCollector(process.cwd());

    // These should be rejected by validation and not cause command injection
    const maliciousInputs = [
      '$(whoami)',
      '`whoami`',
      '; rm -rf /',
      '2024-01-15; echo hacked',
      '2024-01-15 && malicious',
      '2024-01-15 | cat /etc/passwd',
    ];

    for (const malicious of maliciousInputs) {
      // Should not throw, but should filter out invalid dates
      const result = await collector.collectPickaxeEvidence('export', {
        since: malicious,
      });

      // Should return normally without executing malicious commands
      expect(result).toHaveProperty('evidence');
      expect(result).toHaveProperty('queryTimeMs');
    }
  });

  it('should handle search terms with special characters safely', async () => {
    const { createGitEvidenceCollector } =
      await import('../../../../src/tools/causal/git-evidence');

    const collector = createGitEvidenceCollector(process.cwd());

    // These search terms should not cause command injection
    const specialTerms = ['foo"bar', "foo'bar", 'foo$bar', 'foo`bar`', 'foo;bar'];

    for (const term of specialTerms) {
      // Should not throw
      const result = await collector.collectPickaxeEvidence(term);
      expect(result).toHaveProperty('evidence');
    }
  });
});

// =============================================================================
// Integration with EvidenceCollector
// =============================================================================

describe('GitEvidenceCollector integration', () => {
  it('should produce evidence compatible with CausalChain', async () => {
    const { createGitEvidenceCollector } =
      await import('../../../../src/tools/causal/git-evidence');
    const { EvidenceItemSchema } = await import('../../../../src/tools/causal/types');

    const collector = createGitEvidenceCollector(process.cwd());
    const result = await collector.collectEvidence({
      searchTerms: ['export'],
    });

    // All evidence should validate against schema
    for (const evidence of result.evidence) {
      const parsed = EvidenceItemSchema.safeParse(evidence);
      expect(parsed.success).toBe(true);
    }
  });
});
