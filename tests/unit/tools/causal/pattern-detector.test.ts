/**
 * Unit tests for pattern-detector.ts
 *
 * Tests for the PatternDetector class that identifies recurring
 * issue patterns across causal chains.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { v4 as uuidv4 } from 'uuid';

import type {
  CausalChain,
  EvidenceItem,
  Gap,
  IssuePattern,
  GapType,
} from '../../../../src/tools/causal/types';
import {
  createCausalTables,
  insertChain,
  insertPattern,
  getPatternById,
} from '../../../../src/persistence/causal';
import {
  PatternDetector,
  createPatternDetector,
  SYSTEMIC_THRESHOLD,
} from '../../../../src/tools/causal/pattern-detector';

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
function createTestPattern(overrides: Partial<IssuePattern> = {}): IssuePattern {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    category: 'missing_guidance',
    chainIds: [uuidv4()],
    frequency: 1,
    isSystemic: false,
    firstOccurrence: now,
    lastOccurrence: now,
    projectPath: '/test/project',
    summary: 'Recurring missing guidance pattern',
    ...overrides,
  };
}

// =============================================================================
// Test Suite: Pattern Detection (T035)
// =============================================================================

describe('PatternDetector', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-pattern-detector');
  let testDbPath: string;

  beforeEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
    mkdirSync(testBaseDir, { recursive: true });
    testDbPath = join(testBaseDir, 'test-sessions.db');
  });

  afterEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  describe('pattern detection (T035)', () => {
    it('should detect pattern from multiple chains with same gap type', () => {
      // Create chains with same gap type
      const chains = [
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
      ];

      // Group chains by gap type
      const chainsByGapType = new Map<GapType, CausalChain[]>();
      for (const chain of chains) {
        if (chain.gap) {
          const existing = chainsByGapType.get(chain.gap.type) ?? [];
          existing.push(chain);
          chainsByGapType.set(chain.gap.type, existing);
        }
      }

      expect(chainsByGapType.get('missing_guidance')?.length).toBe(3);
    });

    it('should create pattern with correct structure', () => {
      const chainIds = [uuidv4(), uuidv4(), uuidv4()];
      const now = new Date().toISOString();

      const pattern: IssuePattern = {
        id: uuidv4(),
        category: 'missing_guidance',
        chainIds,
        frequency: chainIds.length,
        isSystemic: chainIds.length >= 3,
        firstOccurrence: now,
        lastOccurrence: now,
        projectPath: '/test/project',
        summary: 'Missing guidance pattern detected in 3 chains',
      };

      expect(pattern.category).toBe('missing_guidance');
      expect(pattern.chainIds).toHaveLength(3);
      expect(pattern.frequency).toBe(3);
      expect(pattern.isSystemic).toBe(true);
    });

    it('should group chains by gap category', () => {
      const chains = [
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_config' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_example' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_config' }) }),
      ];

      const groups = new Map<GapType, CausalChain[]>();
      for (const chain of chains) {
        if (chain.gap) {
          const existing = groups.get(chain.gap.type) ?? [];
          existing.push(chain);
          groups.set(chain.gap.type, existing);
        }
      }

      expect(groups.get('missing_guidance')?.length).toBe(2);
      expect(groups.get('missing_config')?.length).toBe(2);
      expect(groups.get('missing_example')?.length).toBe(1);
    });

    it('should handle chains without gaps', () => {
      const chains = [
        createTestChain({ gap: undefined }),
        createTestChain({ gap: createTestGap() }),
        createTestChain({ gap: undefined }),
      ];

      const chainsWithGaps = chains.filter((c) => c.gap !== undefined);

      expect(chainsWithGaps.length).toBe(1);
    });

    it('should filter patterns by project path', () => {
      const patterns = [
        createTestPattern({ projectPath: '/project/a', frequency: 3 }),
        createTestPattern({ projectPath: '/project/b', frequency: 2 }),
        createTestPattern({ projectPath: '/project/a', frequency: 1 }),
      ];

      const projectAPatterns = patterns.filter(
        (p) => p.projectPath === '/project/a'
      );

      expect(projectAPatterns.length).toBe(2);
    });

    it('should generate pattern summary from chains', () => {
      const gap = createTestGap({
        type: 'missing_guidance',
        expectedGuidance: 'Error handling patterns',
      });

      const summary = `Recurring ${gap.type.replace(/_/g, ' ')}: ${gap.expectedGuidance}`;

      expect(summary).toContain('missing guidance');
      expect(summary).toContain('Error handling patterns');
    });

    it('should track first and last occurrence', () => {
      const times = [
        '2024-01-01T10:00:00Z',
        '2024-01-02T10:00:00Z',
        '2024-01-03T10:00:00Z',
      ];

      const chains = times.map((t) => createTestChain({ createdAt: t }));

      const sortedTimes = chains.map((c) => c.createdAt).sort();
      const firstOccurrence = sortedTimes[0]!;
      const lastOccurrence = sortedTimes[sortedTimes.length - 1]!;

      expect(firstOccurrence).toBe('2024-01-01T10:00:00Z');
      expect(lastOccurrence).toBe('2024-01-03T10:00:00Z');
    });

    it('should persist pattern to database', () => {
      const db = new Database(testDbPath);
      createCausalTables(db);

      // First insert a chain that the pattern will reference
      const chain = createTestChain();
      insertChain(db, chain);

      // Now create and insert the pattern with the chain's ID
      const pattern = createTestPattern({ chainIds: [chain.id] });
      insertPattern(db, pattern);

      const retrieved = getPatternById(db, pattern.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(pattern.id);
      expect(retrieved!.category).toBe(pattern.category);

      db.close();
    });

    it('should link chains to patterns', () => {
      const patternId = uuidv4();
      const chains = [
        createTestChain({ patternId }),
        createTestChain({ patternId }),
        createTestChain({ patternId: undefined }),
      ];

      const linkedChains = chains.filter((c) => c.patternId === patternId);

      expect(linkedChains.length).toBe(2);
    });
  });

  // ===========================================================================
  // Test Suite: Systemic Classification (T036)
  // ===========================================================================

  describe('systemic classification (T036)', () => {
    it('should classify as systemic when frequency >= 3', () => {
      const pattern = createTestPattern({ frequency: 3 });
      pattern.isSystemic = pattern.frequency >= 3;

      expect(pattern.isSystemic).toBe(true);
    });

    it('should not classify as systemic when frequency < 3', () => {
      const pattern = createTestPattern({ frequency: 2 });
      pattern.isSystemic = pattern.frequency >= 3;

      expect(pattern.isSystemic).toBe(false);
    });

    it('should handle exactly 3 occurrences', () => {
      const pattern = createTestPattern({ frequency: 3 });
      pattern.isSystemic = pattern.frequency >= 3;

      expect(pattern.isSystemic).toBe(true);
      expect(pattern.frequency).toBe(3);
    });

    it('should handle single occurrence', () => {
      const pattern = createTestPattern({ frequency: 1 });
      pattern.isSystemic = pattern.frequency >= 3;

      expect(pattern.isSystemic).toBe(false);
    });

    it('should handle high frequency patterns', () => {
      const pattern = createTestPattern({ frequency: 10 });
      pattern.isSystemic = pattern.frequency >= 3;

      expect(pattern.isSystemic).toBe(true);
    });

    it('should update systemic flag when frequency changes', () => {
      const pattern = createTestPattern({ frequency: 2, isSystemic: false });

      // Simulate adding another chain
      pattern.frequency += 1;
      pattern.isSystemic = pattern.frequency >= 3;

      expect(pattern.frequency).toBe(3);
      expect(pattern.isSystemic).toBe(true);
    });

    it('should classify all gap types as potentially systemic', () => {
      const gapTypes: GapType[] = [
        'missing_config',
        'missing_example',
        'missing_guidance',
        'terminology_gap',
        'context_loss',
        'other',
      ];

      for (const category of gapTypes) {
        const pattern = createTestPattern({ category, frequency: 5 });
        pattern.isSystemic = pattern.frequency >= 3;

        expect(pattern.isSystemic).toBe(true);
      }
    });

    it('should separate systemic from non-systemic patterns', () => {
      const patterns = [
        createTestPattern({ frequency: 5, isSystemic: true }),
        createTestPattern({ frequency: 2, isSystemic: false }),
        createTestPattern({ frequency: 3, isSystemic: true }),
        createTestPattern({ frequency: 1, isSystemic: false }),
      ];

      const systemicPatterns = patterns.filter((p) => p.isSystemic);
      const nonSystemicPatterns = patterns.filter((p) => !p.isSystemic);

      expect(systemicPatterns.length).toBe(2);
      expect(nonSystemicPatterns.length).toBe(2);
    });
  });

  // ===========================================================================
  // Test Suite: Pattern Aggregation
  // ===========================================================================

  describe('pattern aggregation', () => {
    it('should aggregate chains into existing pattern', () => {
      const existingPattern = createTestPattern({
        chainIds: ['chain-1', 'chain-2'],
        frequency: 2,
      });

      // Add new chain
      const newChainId = 'chain-3';
      existingPattern.chainIds.push(newChainId);
      existingPattern.frequency = existingPattern.chainIds.length;
      existingPattern.isSystemic = existingPattern.frequency >= 3;

      expect(existingPattern.chainIds).toHaveLength(3);
      expect(existingPattern.frequency).toBe(3);
      expect(existingPattern.isSystemic).toBe(true);
    });

    it('should create new pattern when no existing match', () => {
      const existingPatterns = [
        createTestPattern({ category: 'missing_config' }),
        createTestPattern({ category: 'missing_example' }),
      ];

      const newChain = createTestChain({
        gap: createTestGap({ type: 'terminology_gap' }),
      });

      const hasMatchingPattern = existingPatterns.some(
        (p) => p.category === newChain.gap?.type
      );

      expect(hasMatchingPattern).toBe(false);

      // Would create new pattern
      const newPattern: IssuePattern = {
        id: uuidv4(),
        category: newChain.gap!.type,
        chainIds: [newChain.id],
        frequency: 1,
        isSystemic: false,
        firstOccurrence: newChain.createdAt,
        lastOccurrence: newChain.createdAt,
        projectPath: newChain.projectPath,
        summary: `Pattern: ${newChain.gap!.type}`,
      };

      expect(newPattern.category).toBe('terminology_gap');
    });

    it('should merge patterns with same category', () => {
      const pattern1 = createTestPattern({
        category: 'missing_guidance',
        chainIds: ['a', 'b'],
        frequency: 2,
      });
      const pattern2 = createTestPattern({
        category: 'missing_guidance',
        chainIds: ['c'],
        frequency: 1,
      });

      // Merge patterns
      const mergedChainIds = [...pattern1.chainIds, ...pattern2.chainIds];
      const mergedPattern: IssuePattern = {
        ...pattern1,
        chainIds: mergedChainIds,
        frequency: mergedChainIds.length,
        isSystemic: mergedChainIds.length >= 3,
      };

      expect(mergedPattern.chainIds).toHaveLength(3);
      expect(mergedPattern.frequency).toBe(3);
      expect(mergedPattern.isSystemic).toBe(true);
    });

    it('should update lastOccurrence when adding chain', () => {
      const oldTime = '2024-01-01T10:00:00Z';
      const newTime = '2024-01-15T10:00:00Z';

      const pattern = createTestPattern({
        firstOccurrence: oldTime,
        lastOccurrence: oldTime,
      });

      // Add new chain with later timestamp
      const newChain = createTestChain({ createdAt: newTime });
      pattern.chainIds.push(newChain.id);
      pattern.lastOccurrence = newTime;

      expect(pattern.firstOccurrence).toBe(oldTime);
      expect(pattern.lastOccurrence).toBe(newTime);
    });

    it('should preserve firstOccurrence when adding chains', () => {
      const pattern = createTestPattern({
        firstOccurrence: '2024-01-01T10:00:00Z',
        lastOccurrence: '2024-01-01T10:00:00Z',
      });

      const originalFirst = pattern.firstOccurrence;

      // Add chains with later times
      pattern.chainIds.push('new-chain');
      pattern.lastOccurrence = '2024-01-10T10:00:00Z';

      expect(pattern.firstOccurrence).toBe(originalFirst);
    });
  });

  // ===========================================================================
  // Test Suite: Pattern Querying
  // ===========================================================================

  describe('pattern querying', () => {
    it('should filter patterns by minimum frequency', () => {
      const patterns = [
        createTestPattern({ frequency: 1 }),
        createTestPattern({ frequency: 3 }),
        createTestPattern({ frequency: 5 }),
        createTestPattern({ frequency: 2 }),
      ];

      const minFrequency = 3;
      const filtered = patterns.filter((p) => p.frequency >= minFrequency);

      expect(filtered.length).toBe(2);
    });

    it('should filter patterns by category', () => {
      const patterns = [
        createTestPattern({ category: 'missing_guidance' }),
        createTestPattern({ category: 'missing_config' }),
        createTestPattern({ category: 'missing_guidance' }),
      ];

      const guidancePatterns = patterns.filter(
        (p) => p.category === 'missing_guidance'
      );

      expect(guidancePatterns.length).toBe(2);
    });

    it('should sort patterns by frequency descending', () => {
      const patterns = [
        createTestPattern({ frequency: 2 }),
        createTestPattern({ frequency: 5 }),
        createTestPattern({ frequency: 1 }),
        createTestPattern({ frequency: 3 }),
      ];

      const sorted = [...patterns].sort((a, b) => b.frequency - a.frequency);

      expect(sorted[0]!.frequency).toBe(5);
      expect(sorted[1]!.frequency).toBe(3);
      expect(sorted[2]!.frequency).toBe(2);
      expect(sorted[3]!.frequency).toBe(1);
    });

    it('should find patterns by chain ID', () => {
      const targetChainId = 'target-chain-id';
      const patterns = [
        createTestPattern({ chainIds: ['chain-1', 'chain-2'] }),
        createTestPattern({ chainIds: [targetChainId, 'chain-3'] }),
        createTestPattern({ chainIds: ['chain-4'] }),
      ];

      const matching = patterns.filter((p) =>
        p.chainIds.includes(targetChainId)
      );

      expect(matching.length).toBe(1);
    });

    it('should count total patterns', () => {
      const patterns = [
        createTestPattern(),
        createTestPattern(),
        createTestPattern(),
      ];

      expect(patterns.length).toBe(3);
    });
  });

  // ===========================================================================
  // Test Suite: Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle empty chain list', () => {
      const chains: CausalChain[] = [];

      const patterns = chains.reduce((acc, chain) => {
        if (chain.gap) {
          // Would create pattern
        }
        return acc;
      }, [] as IssuePattern[]);

      expect(patterns.length).toBe(0);
    });

    it('should handle all chains without gaps', () => {
      const chains = [
        createTestChain({ gap: undefined }),
        createTestChain({ gap: undefined }),
      ];

      const chainsWithGaps = chains.filter((c) => c.gap);

      expect(chainsWithGaps.length).toBe(0);
    });

    it('should handle pattern with very long summary', () => {
      const longSummary = 'Pattern: '.repeat(100);
      const pattern = createTestPattern({ summary: longSummary });

      expect(pattern.summary.length).toBeGreaterThan(500);
    });

    it('should handle pattern spanning long time period', () => {
      const pattern = createTestPattern({
        firstOccurrence: '2020-01-01T00:00:00Z',
        lastOccurrence: '2024-12-31T23:59:59Z',
      });

      const firstDate = new Date(pattern.firstOccurrence);
      const lastDate = new Date(pattern.lastOccurrence);
      const daysDiff =
        (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);

      expect(daysDiff).toBeGreaterThan(365 * 4);
    });

    it('should handle many chains in single pattern', () => {
      const chainIds = Array.from({ length: 100 }, () => uuidv4());
      const pattern = createTestPattern({
        chainIds,
        frequency: chainIds.length,
        isSystemic: true,
      });

      expect(pattern.chainIds.length).toBe(100);
      expect(pattern.frequency).toBe(100);
    });

    it('should handle special characters in summary', () => {
      const pattern = createTestPattern({
        summary: 'Pattern: <script>alert("XSS")</script> & "quotes"',
      });

      expect(pattern.summary).toContain('<script>');
      expect(pattern.summary).toContain('&');
    });
  });

  // ===========================================================================
  // Test Suite: PatternDetector Class Implementation
  // ===========================================================================

  describe('PatternDetector class implementation', () => {
    let detector: PatternDetector;

    beforeEach(() => {
      detector = createPatternDetector();
    });

    it('should detect patterns from chains', () => {
      const chains = [
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_config' }) }),
      ];

      const result = detector.detectPatterns(chains);

      expect(result.patterns).toHaveLength(2);
      expect(result.chainsAnalyzed).toBe(3);
    });

    it('should filter by minimum frequency', () => {
      const chains = [
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_config' }) }),
      ];

      const result = detector.detectPatterns(chains, { minFrequency: 2 });

      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0]!.category).toBe('missing_guidance');
    });

    it('should filter by category', () => {
      const chains = [
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_config' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
      ];

      const result = detector.detectPatterns(chains, {
        category: 'missing_config',
      });

      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0]!.category).toBe('missing_config');
    });

    it('should filter systemic only', () => {
      const chains = [
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_config' }) }),
      ];

      const result = detector.detectPatterns(chains, { systemicOnly: true });

      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0]!.isSystemic).toBe(true);
    });

    it('should sort patterns by frequency', () => {
      const chains = [
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_config' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_config' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_config' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
      ];

      const result = detector.detectPatterns(chains);

      expect(result.patterns[0]!.frequency).toBe(3); // missing_config
      expect(result.patterns[1]!.frequency).toBe(2); // missing_guidance
    });

    it('should classify systemic patterns correctly', () => {
      expect(detector.isSystemic(1)).toBe(false);
      expect(detector.isSystemic(2)).toBe(false);
      expect(detector.isSystemic(3)).toBe(true);
      expect(detector.isSystemic(10)).toBe(true);
    });

    it('should generate pattern summary', () => {
      const summary = detector.generateSummary(
        'missing_guidance',
        3,
        'Error handling patterns'
      );

      expect(summary).toContain('missing guidance');
      expect(summary).toContain('3');
      expect(summary).toContain('Error handling');
    });

    it('should add chain to existing pattern', () => {
      const existingChain = createTestChain({
        gap: createTestGap({ type: 'missing_guidance' }),
      });
      const existingPattern = createTestPattern({ chainIds: [existingChain.id] });
      const existingPatterns = [existingPattern];

      const newChain = createTestChain({
        gap: createTestGap({ type: 'missing_guidance' }),
      });

      const updatedPattern = detector.addChainToPattern(
        newChain,
        existingPatterns,
        '/test/project'
      );

      expect(updatedPattern.chainIds).toHaveLength(2);
      expect(updatedPattern.frequency).toBe(2);
    });

    it('should create new pattern when no match', () => {
      const existingPattern = createTestPattern({
        category: 'missing_config',
        chainIds: ['existing-chain'],
      });

      const newChain = createTestChain({
        gap: createTestGap({ type: 'terminology_gap' }),
      });

      const newPattern = detector.addChainToPattern(
        newChain,
        [existingPattern],
        '/test/project'
      );

      expect(newPattern.category).toBe('terminology_gap');
      expect(newPattern.chainIds).toHaveLength(1);
    });

    it('should match chain to pattern', () => {
      const pattern = createTestPattern({ category: 'missing_guidance' });
      const matchingChain = createTestChain({
        gap: createTestGap({ type: 'missing_guidance' }),
      });
      const nonMatchingChain = createTestChain({
        gap: createTestGap({ type: 'missing_config' }),
      });
      const noGapChain = createTestChain({ gap: undefined });

      expect(detector.matchesPattern(matchingChain, pattern)).toBe(true);
      expect(detector.matchesPattern(nonMatchingChain, pattern)).toBe(false);
      expect(detector.matchesPattern(noGapChain, pattern)).toBe(false);
    });

    it('should track grouped counts', () => {
      const chains = [
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_config' }) }),
        createTestChain({ gap: undefined }),
      ];

      const result = detector.detectPatterns(chains);

      expect(result.groupedCounts.get('missing_guidance')).toBe(2);
      expect(result.groupedCounts.get('missing_config')).toBe(1);
    });

    it('should handle empty chains', () => {
      const result = detector.detectPatterns([]);

      expect(result.patterns).toHaveLength(0);
      expect(result.chainsAnalyzed).toBe(0);
    });

    it('should track first and last occurrence', () => {
      const chains = [
        createTestChain({
          createdAt: '2024-01-01T10:00:00Z',
          gap: createTestGap({ type: 'missing_guidance' }),
        }),
        createTestChain({
          createdAt: '2024-01-15T10:00:00Z',
          gap: createTestGap({ type: 'missing_guidance' }),
        }),
        createTestChain({
          createdAt: '2024-01-10T10:00:00Z',
          gap: createTestGap({ type: 'missing_guidance' }),
        }),
      ];

      const result = detector.detectPatterns(chains);
      const pattern = result.patterns[0]!;

      expect(pattern.firstOccurrence).toBe('2024-01-01T10:00:00Z');
      expect(pattern.lastOccurrence).toBe('2024-01-15T10:00:00Z');
    });
  });
});
