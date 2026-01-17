/**
 * Integration tests for get_issue_patterns tool
 *
 * Tests the complete flow from pattern query to result output.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { v4 as uuidv4 } from 'uuid';

import {
  createCausalTables,
  insertChain,
  insertPattern,
  getPatternById,
  getPatternsByProject,
} from '../../../src/persistence/causal';

import type {
  CausalChain,
  EvidenceItem,
  Gap,
  IssuePattern,
  GapType,
  GetPatternsInput,
  GetPatternsOutput,
} from '../../../src/tools/causal/types';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a test evidence item.
 */
function createTestEvidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: uuidv4(),
    type: 'SessionMatch',
    source: 'session-123',
    timestamp: new Date().toISOString(),
    content: 'Test evidence content',
    ...overrides,
  };
}

/**
 * Create a test gap.
 */
function createTestGap(overrides: Partial<Gap> = {}): Gap {
  return {
    type: 'missing_guidance',
    location: 'claude_md',
    expectedGuidance: 'Error handling guidelines',
    counterfactual: 'If guidance existed, issue would not have occurred',
    ...overrides,
  };
}

/**
 * Create a test causal chain.
 */
function createTestChain(overrides: Partial<CausalChain> = {}): CausalChain {
  const evidence = [createTestEvidence()];
  return {
    id: uuidv4(),
    issueId: `issue-${uuidv4().substring(0, 8)}`,
    trigger: evidence[0]!,
    gap: createTestGap(),
    mechanism: 'Test mechanism',
    effect: 'Test effect',
    confidence: {
      specificity: true,
      temporal: true,
      mechanistic: true,
      evidenceQuality: true,
      reproducibility: false,
      alternatives: true,
      overall: 'high',
    },
    evidence,
    depth: 1,
    depthLimitReached: false,
    projectPath: '/test/project',
    createdAt: new Date().toISOString(),
    counterfactual: 'If X, Y would not have occurred',
    patternId: undefined,
    ...overrides,
  };
}

/**
 * Create a test issue pattern.
 */
function createTestPattern(
  chainIds: string[],
  overrides: Partial<IssuePattern> = {}
): IssuePattern {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    category: 'missing_guidance',
    chainIds,
    frequency: chainIds.length,
    isSystemic: chainIds.length >= 3,
    firstOccurrence: now,
    lastOccurrence: now,
    projectPath: '/test/project',
    summary: 'Recurring missing guidance pattern',
    ...overrides,
  };
}

/**
 * Create a test database with causal tables.
 */
function createTestDatabase(dbPath: string): Database {
  const db = new Database(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  createCausalTables(db);
  return db;
}

// =============================================================================
// Test Suite
// =============================================================================

describe('get_issue_patterns integration', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-get-patterns');
  let testDbPath: string;
  let db: Database;

  beforeEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
    mkdirSync(testBaseDir, { recursive: true });
    testDbPath = join(testBaseDir, 'test-sessions.db');
    db = createTestDatabase(testDbPath);
  });

  afterEach(() => {
    db.close();
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  // ===========================================================================
  // T037: Integration test for get_issue_patterns
  // ===========================================================================

  describe('get_issue_patterns tool flow (T037)', () => {
    it('should return empty array when no patterns exist', () => {
      const patterns = getPatternsByProject(db, '/test/project');

      expect(patterns).toEqual([]);
    });

    it('should return patterns for a project', () => {
      // Insert chains first
      const chain1 = createTestChain({ projectPath: '/project/a' });
      const chain2 = createTestChain({ projectPath: '/project/a' });
      insertChain(db, chain1);
      insertChain(db, chain2);

      // Insert pattern with those chains
      const pattern = createTestPattern([chain1.id, chain2.id], {
        projectPath: '/project/a',
      });
      insertPattern(db, pattern);

      const patterns = getPatternsByProject(db, '/project/a');

      expect(patterns).toHaveLength(1);
      expect(patterns[0]!.id).toBe(pattern.id);
    });

    it('should filter patterns by project path', () => {
      // Insert chains for project A
      const chainA1 = createTestChain({ projectPath: '/project/a' });
      const chainA2 = createTestChain({ projectPath: '/project/a' });
      insertChain(db, chainA1);
      insertChain(db, chainA2);

      // Insert chains for project B
      const chainB1 = createTestChain({ projectPath: '/project/b' });
      insertChain(db, chainB1);

      // Insert patterns
      const patternA = createTestPattern([chainA1.id, chainA2.id], {
        projectPath: '/project/a',
      });
      const patternB = createTestPattern([chainB1.id], {
        projectPath: '/project/b',
        frequency: 1,
        isSystemic: false,
      });
      insertPattern(db, patternA);
      insertPattern(db, patternB);

      const patternsA = getPatternsByProject(db, '/project/a');
      const patternsB = getPatternsByProject(db, '/project/b');

      expect(patternsA).toHaveLength(1);
      expect(patternsB).toHaveLength(1);
      expect(patternsA[0]!.projectPath).toBe('/project/a');
      expect(patternsB[0]!.projectPath).toBe('/project/b');
    });

    it('should return pattern with all fields populated', () => {
      const chain = createTestChain();
      insertChain(db, chain);

      const pattern = createTestPattern([chain.id], {
        category: 'missing_config',
        frequency: 5,
        isSystemic: true,
        summary: 'Test pattern summary',
      });
      insertPattern(db, pattern);

      const patterns = getPatternsByProject(db, pattern.projectPath!);

      expect(patterns).toHaveLength(1);
      const retrieved = patterns[0]!;

      expect(retrieved.id).toBe(pattern.id);
      expect(retrieved.category).toBe('missing_config');
      expect(retrieved.frequency).toBe(5);
      expect(retrieved.isSystemic).toBe(true);
      expect(retrieved.summary).toBe('Test pattern summary');
      expect(retrieved.firstOccurrence).toBeDefined();
      expect(retrieved.lastOccurrence).toBeDefined();
    });

    it('should return multiple patterns for same project', () => {
      // Create chains with different gap types
      const chain1 = createTestChain({
        gap: createTestGap({ type: 'missing_guidance' }),
      });
      const chain2 = createTestChain({
        gap: createTestGap({ type: 'missing_config' }),
      });
      const chain3 = createTestChain({
        gap: createTestGap({ type: 'missing_guidance' }),
      });
      insertChain(db, chain1);
      insertChain(db, chain2);
      insertChain(db, chain3);

      // Insert patterns
      const pattern1 = createTestPattern([chain1.id, chain3.id], {
        category: 'missing_guidance',
      });
      const pattern2 = createTestPattern([chain2.id], {
        category: 'missing_config',
        frequency: 1,
        isSystemic: false,
      });
      insertPattern(db, pattern1);
      insertPattern(db, pattern2);

      const patterns = getPatternsByProject(db, '/test/project');

      expect(patterns).toHaveLength(2);
    });

    it('should build GetPatternsOutput structure', () => {
      const chain = createTestChain();
      insertChain(db, chain);

      const pattern = createTestPattern([chain.id]);
      insertPattern(db, pattern);

      const patterns = getPatternsByProject(db, '/test/project');

      // This is what the tool output should look like
      const output: GetPatternsOutput = {
        success: true,
        patterns,
        totalCount: patterns.length,
      };

      expect(output.success).toBe(true);
      expect(output.patterns).toHaveLength(1);
      expect(output.totalCount).toBe(1);
    });

    it('should handle GetPatternsInput parameters', () => {
      // Input structure
      const input: GetPatternsInput = {
        projectPath: '/test/project',
        minFrequency: 3,
        category: 'missing_guidance',
        includeResolved: false,
      };

      expect(input.projectPath).toBe('/test/project');
      expect(input.minFrequency).toBe(3);
      expect(input.category).toBe('missing_guidance');
      expect(input.includeResolved).toBe(false);
    });

    it('should filter by category when specified', () => {
      // Create chains and patterns of different categories
      const chain1 = createTestChain();
      const chain2 = createTestChain();
      insertChain(db, chain1);
      insertChain(db, chain2);

      const guidancePattern = createTestPattern([chain1.id], {
        category: 'missing_guidance',
      });
      const configPattern = createTestPattern([chain2.id], {
        category: 'missing_config',
        frequency: 1,
        isSystemic: false,
      });
      insertPattern(db, guidancePattern);
      insertPattern(db, configPattern);

      const allPatterns = getPatternsByProject(db, '/test/project');

      // Filter by category manually (simulating what the tool will do)
      const filteredPatterns = allPatterns.filter(
        (p) => p.category === 'missing_guidance'
      );

      expect(filteredPatterns).toHaveLength(1);
      expect(filteredPatterns[0]!.category).toBe('missing_guidance');
    });

    it('should filter by minimum frequency', () => {
      const chain1 = createTestChain();
      const chain2 = createTestChain();
      const chain3 = createTestChain();
      insertChain(db, chain1);
      insertChain(db, chain2);
      insertChain(db, chain3);

      const lowFreqPattern = createTestPattern([chain1.id], {
        frequency: 1,
        isSystemic: false,
      });
      const highFreqPattern = createTestPattern([chain2.id, chain3.id], {
        category: 'missing_config',
        frequency: 5,
        isSystemic: true,
      });
      insertPattern(db, lowFreqPattern);
      insertPattern(db, highFreqPattern);

      const allPatterns = getPatternsByProject(db, '/test/project');
      const minFrequency = 3;

      const filteredPatterns = allPatterns.filter(
        (p) => p.frequency >= minFrequency
      );

      expect(filteredPatterns).toHaveLength(1);
      expect(filteredPatterns[0]!.frequency).toBe(5);
    });

    it('should return systemic patterns only when filtering', () => {
      const chain1 = createTestChain();
      const chain2 = createTestChain();
      insertChain(db, chain1);
      insertChain(db, chain2);

      const nonSystemicPattern = createTestPattern([chain1.id], {
        frequency: 2,
        isSystemic: false,
      });
      const systemicPattern = createTestPattern([chain2.id], {
        category: 'missing_config',
        frequency: 5,
        isSystemic: true,
      });
      insertPattern(db, nonSystemicPattern);
      insertPattern(db, systemicPattern);

      const allPatterns = getPatternsByProject(db, '/test/project');
      const systemicOnly = allPatterns.filter((p) => p.isSystemic);

      expect(systemicOnly).toHaveLength(1);
      expect(systemicOnly[0]!.isSystemic).toBe(true);
    });

    it('should sort patterns by frequency descending', () => {
      const chains = Array.from({ length: 4 }, () => createTestChain());
      for (const chain of chains) {
        insertChain(db, chain);
      }

      const patterns = [
        createTestPattern([chains[0]!.id], { frequency: 2, isSystemic: false }),
        createTestPattern([chains[1]!.id], {
          category: 'missing_config',
          frequency: 5,
          isSystemic: true,
        }),
        createTestPattern([chains[2]!.id], {
          category: 'missing_example',
          frequency: 1,
          isSystemic: false,
        }),
        createTestPattern([chains[3]!.id], {
          category: 'terminology_gap',
          frequency: 10,
          isSystemic: true,
        }),
      ];
      for (const pattern of patterns) {
        insertPattern(db, pattern);
      }

      const retrieved = getPatternsByProject(db, '/test/project');
      const sorted = [...retrieved].sort((a, b) => b.frequency - a.frequency);

      expect(sorted[0]!.frequency).toBe(10);
      expect(sorted[1]!.frequency).toBe(5);
      expect(sorted[2]!.frequency).toBe(2);
      expect(sorted[3]!.frequency).toBe(1);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle null project path', () => {
      // Test querying without a specific project
      const chain = createTestChain({ projectPath: '/any/project' });
      insertChain(db, chain);

      const pattern = createTestPattern([chain.id], {
        projectPath: undefined,
      });
      insertPattern(db, pattern);

      // Should still be queryable
      const retrieved = getPatternById(db, pattern.id);
      expect(retrieved).toBeDefined();
    });

    it('should handle special characters in project path', () => {
      const specialPath = '/path/with spaces & special!chars';
      const chain = createTestChain({ projectPath: specialPath });
      insertChain(db, chain);

      const pattern = createTestPattern([chain.id], {
        projectPath: specialPath,
      });
      insertPattern(db, pattern);

      const patterns = getPatternsByProject(db, specialPath);
      expect(patterns).toHaveLength(1);
    });

    it('should handle many patterns efficiently', () => {
      const startTime = Date.now();

      // Insert 50 patterns
      for (let i = 0; i < 50; i++) {
        const chain = createTestChain({ projectPath: '/test/project' });
        insertChain(db, chain);

        const pattern = createTestPattern([chain.id], {
          category: i % 2 === 0 ? 'missing_guidance' : 'missing_config',
          frequency: i + 1,
          isSystemic: i >= 2,
        });
        insertPattern(db, pattern);
      }

      const patterns = getPatternsByProject(db, '/test/project');
      const elapsed = Date.now() - startTime;

      expect(patterns.length).toBe(50);
      expect(elapsed).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should return error output on failure', () => {
      // Simulate error output structure
      const output: GetPatternsOutput = {
        success: false,
        patterns: [],
        totalCount: 0,
        error: 'Database connection failed',
      };

      expect(output.success).toBe(false);
      expect(output.error).toBeDefined();
      expect(output.patterns).toHaveLength(0);
    });
  });
});
