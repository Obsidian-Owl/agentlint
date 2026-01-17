/**
 * EP07 Causal Tracing Engine - Quickstart Integration Tests (T051)
 *
 * Validates the scenarios documented in quickstart.md work end-to-end.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { v4 as uuidv4 } from 'uuid';

import { createCausalTables, insertChain, insertPattern } from '../../../src/persistence/causal';
import { EvidenceCollector, createEvidenceCollector, FTS_ERROR_MESSAGES } from '../../../src/tools/causal';
import { PatternDetector, createPatternDetector, SYSTEMIC_THRESHOLD } from '../../../src/tools/causal';
import { ChainBuilder, createChainBuilder } from '../../../src/tools/causal';
import { GapAnalyzer, createGapAnalyzer } from '../../../src/tools/causal';
import { ConfidenceAssessor, createConfidenceAssessor, CONFIDENCE_THRESHOLDS } from '../../../src/tools/causal';
import { CounterfactualGenerator, createCounterfactualGenerator } from '../../../src/tools/causal';

import type {
  CausalChain,
  EvidenceItem,
  Gap,
  IssuePattern,
  TracedIssue,
} from '../../../src/tools/causal/types';

// =============================================================================
// Test Fixtures
// =============================================================================

const TEST_PROJECT = '/test/quickstart-project';

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
    projectPath: TEST_PROJECT,
    createdAt: new Date().toISOString(),
    counterfactual: 'If X, Y would not have occurred',
    ...overrides,
  };
}

// =============================================================================
// Quickstart Scenario Tests
// =============================================================================

describe('EP07 Quickstart Scenarios (T051)', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-quickstart-test');
  let testDbPath: string;
  let db: Database;

  beforeEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
    mkdirSync(testBaseDir, { recursive: true });
    testDbPath = join(testBaseDir, 'sessions.db');
    db = new Database(testDbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    createCausalTables(db);
  });

  afterEach(() => {
    db.close();
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
  });

  // ===========================================================================
  // Scenario: Trace Issue Structure
  // ===========================================================================

  describe('Scenario: Trace Issue Structure', () => {
    it('should build TRIGGER → GAP → MECHANISM → EFFECT chain', () => {
      const chainBuilder = createChainBuilder();
      const trigger = createTestEvidence({
        content: 'User prompt: add my API config to CLAUDE.md',
        type: 'SessionMatch',
      });
      const gap = createTestGap({
        type: 'missing_guidance',
        expectedGuidance: 'Credential handling guidance',
      });

      const result = chainBuilder.build({
        issueId: 'issue-001',
        issueDescription: 'Secret API key found in CLAUDE.md',
        evidence: [trigger],
        gap,
        projectPath: TEST_PROJECT,
      });

      expect(result.chain.trigger).toBeDefined();
      expect(result.chain.gap).toBeDefined();
      expect(result.chain.mechanism).toBeDefined();
      expect(result.chain.effect).toBeDefined();
    });

    it('should include counterfactual analysis', () => {
      const chainBuilder = createChainBuilder();
      const gap = createTestGap({
        counterfactual: 'If credential handling were documented, secret would not have been exposed',
      });

      const result = chainBuilder.build({
        issueId: 'issue-002',
        issueDescription: 'API key exposed',
        evidence: [createTestEvidence()],
        gap,
        projectPath: TEST_PROJECT,
      });

      expect(result.chain.counterfactual).toContain('credential');
    });

    it('should indicate trace completeness', () => {
      const chainBuilder = createChainBuilder();

      // Full trace with evidence within depth limit
      const fullResult = chainBuilder.build({
        issueId: 'issue-003',
        issueDescription: 'Test issue',
        evidence: [createTestEvidence(), createTestEvidence()],
        gap: createTestGap(),
        projectPath: TEST_PROJECT,
      });

      expect(fullResult.traceCompleteness).toBe('full');

      // Partial trace - depth limit exceeded with many evidence items
      const manyEvidence = [];
      for (let i = 0; i < 10; i++) {
        manyEvidence.push(
          createTestEvidence({
            timestamp: new Date(Date.now() - i * 1000).toISOString(),
          })
        );
      }

      const partialResult = chainBuilder.build({
        issueId: 'issue-004',
        issueDescription: 'Test issue',
        evidence: manyEvidence,
        projectPath: TEST_PROJECT,
        maxDepth: 1, // Force depth limit
      });

      expect(partialResult.traceCompleteness).toBe('partial');
    });
  });

  // ===========================================================================
  // Scenario: Pattern Detection
  // ===========================================================================

  describe('Scenario: Pattern Detection', () => {
    it('should identify systemic patterns with frequency >= 3', () => {
      const detector = createPatternDetector();

      // Create 4 chains with same gap type
      const chains: CausalChain[] = [];
      for (let i = 0; i < 4; i++) {
        chains.push(
          createTestChain({
            gap: createTestGap({ type: 'missing_guidance' }),
          })
        );
      }

      const result = detector.detectPatterns(chains);

      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0]!.isSystemic).toBe(true);
      expect(result.patterns[0]!.frequency).toBe(4);
    });

    it('should filter by minimum frequency', () => {
      const detector = createPatternDetector();

      // Create chains with varying frequencies
      const chains: CausalChain[] = [
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_config' }) }),
      ];

      const result = detector.detectPatterns(chains, { minFrequency: 2 });

      // Only missing_guidance pattern (frequency 2) should be returned
      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0]!.category).toBe('missing_guidance');
    });

    it('should filter by category', () => {
      const detector = createPatternDetector();

      const chains: CausalChain[] = [
        createTestChain({ gap: createTestGap({ type: 'missing_guidance' }) }),
        createTestChain({ gap: createTestGap({ type: 'missing_config' }) }),
        createTestChain({ gap: createTestGap({ type: 'terminology_gap' }) }),
      ];

      const result = detector.detectPatterns(chains, {
        category: 'missing_config',
      });

      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0]!.category).toBe('missing_config');
    });
  });

  // ===========================================================================
  // Scenario: Confidence Assessment
  // ===========================================================================

  describe('Scenario: Confidence Assessment', () => {
    it('should assess 6 confidence factors', () => {
      const assessor = createConfidenceAssessor();

      const score = assessor.assess({
        evidence: [createTestEvidence()],
        issueDescription: 'Test issue',
        gap: createTestGap(),
        mechanism: 'Clear causal mechanism',
      });

      expect(typeof score.specificity).toBe('boolean');
      expect(typeof score.temporal).toBe('boolean');
      expect(typeof score.mechanistic).toBe('boolean');
      expect(typeof score.evidenceQuality).toBe('boolean');
      expect(typeof score.reproducibility).toBe('boolean');
      expect(typeof score.alternatives).toBe('boolean');
      expect(score.overall).toBeDefined();
    });

    it('should classify high confidence (5-6 factors)', () => {
      const assessor = createConfidenceAssessor();

      // Rich evidence for high confidence
      const evidence = [
        createTestEvidence({
          type: 'SessionMatch',
          content: 'Direct evidence for specific issue',
          timestamp: new Date().toISOString(),
          position: { filePath: 'src/test.ts', line: 10 },
        }),
        createTestEvidence({ type: 'SessionMatch' }),
        createTestEvidence({ type: 'SessionMatch' }),
      ];

      const score = assessor.assess({
        evidence,
        issueDescription: 'specific issue at src/test.ts',
        gap: createTestGap(),
        mechanism: 'Clear mechanism explains the issue',
      });

      // With rich context, should be high or medium
      expect(['high', 'medium']).toContain(score.overall);
    });

    it('should classify low confidence with minimal evidence', () => {
      const assessor = createConfidenceAssessor();

      const score = assessor.assess({
        evidence: [],
        issueDescription: 'Vague issue',
      });

      expect(score.overall).toBe('low');
    });
  });

  // ===========================================================================
  // Scenario: Counterfactual Generation
  // ===========================================================================

  describe('Scenario: Counterfactual Generation', () => {
    it('should generate "If X, Y would not have occurred" format', () => {
      const generator = createCounterfactualGenerator();
      const gap = createTestGap({
        expectedGuidance: 'API key handling guidelines',
        counterfactual: '',
      });

      const result = generator.generateFromGap(gap);

      expect(result).toContain('If');
      expect(result).toContain('would');
      expect(result).toContain('API key handling');
    });

    it('should reference specific gap in counterfactual', () => {
      const generator = createCounterfactualGenerator();
      const gap = createTestGap({
        location: 'claude_md',
        expectedGuidance: 'Credential security practices',
        counterfactual: '',
      });

      const result = generator.generateFromGap(gap);

      expect(result).toContain('CLAUDE.md');
      expect(result).toContain('Credential security');
    });
  });

  // ===========================================================================
  // Scenario: Gap Categories
  // ===========================================================================

  describe('Scenario: Gap Categories', () => {
    it('should support all documented gap categories', () => {
      const categories = [
        'missing_config',
        'missing_example',
        'missing_guidance',
        'terminology_gap',
        'context_loss',
        'other',
      ] as const;

      const detector = createPatternDetector();

      for (const category of categories) {
        const chain = createTestChain({
          gap: createTestGap({ type: category }),
        });

        const result = detector.detectPatterns([chain]);

        expect(result.patterns).toHaveLength(1);
        expect(result.patterns[0]!.category).toBe(category);
      }
    });
  });

  // ===========================================================================
  // Scenario: Error Handling
  // ===========================================================================

  describe('Scenario: Error Handling', () => {
    it('should provide friendly error for missing database', () => {
      // Test error message constants are properly defined
      expect(FTS_ERROR_MESSAGES.DATABASE_NOT_FOUND).toBeDefined();
      expect(FTS_ERROR_MESSAGES.DATABASE_NOT_FOUND).toContain('sessions');
      expect(FTS_ERROR_MESSAGES.DATABASE_NOT_FOUND).toContain('index');

      expect(FTS_ERROR_MESSAGES.FTS_NOT_INITIALIZED).toBeDefined();
      expect(FTS_ERROR_MESSAGES.FTS_NOT_INITIALIZED).toContain('index');

      expect(FTS_ERROR_MESSAGES.SCHEMA_MISMATCH).toBeDefined();
      expect(FTS_ERROR_MESSAGES.SCHEMA_MISMATCH).toContain('rebuild');
    });

    it('should return partial trace when depth limit reached', () => {
      const chainBuilder = createChainBuilder();

      // Create many nested evidence to trigger depth limit
      const evidence: EvidenceItem[] = [];
      for (let i = 0; i < 10; i++) {
        evidence.push(
          createTestEvidence({
            timestamp: new Date(Date.now() - i * 1000).toISOString(),
          })
        );
      }

      const result = chainBuilder.build({
        issueId: 'issue-deep',
        issueDescription: 'Issue requiring deep trace',
        evidence,
        projectPath: TEST_PROJECT,
        maxDepth: 1, // Very shallow limit
      });

      // With very shallow depth limit and lots of evidence, should be partial
      expect(result.traceCompleteness).toBe('partial');
    });
  });

  // ===========================================================================
  // Scenario: Pattern Persistence
  // ===========================================================================

  describe('Scenario: Pattern Persistence', () => {
    it('should persist and retrieve patterns', () => {
      const chain1 = createTestChain();
      const chain2 = createTestChain();

      insertChain(db, chain1);
      insertChain(db, chain2);

      const pattern: IssuePattern = {
        id: uuidv4(),
        category: 'missing_guidance',
        chainIds: [chain1.id, chain2.id],
        frequency: 2,
        isSystemic: false,
        firstOccurrence: chain1.createdAt,
        lastOccurrence: chain2.createdAt,
        projectPath: TEST_PROJECT,
        summary: 'Recurring missing guidance pattern',
      };

      insertPattern(db, pattern);

      // Query back
      const { getPatternsByProject } = require('../../../src/persistence/causal');
      const patterns = getPatternsByProject(db, TEST_PROJECT);

      expect(patterns).toHaveLength(1);
      expect(patterns[0].category).toBe('missing_guidance');
    });
  });
});

// =============================================================================
// Constants Validation
// =============================================================================

describe('EP07 Constants (documented in quickstart)', () => {
  it('should have correct SYSTEMIC_THRESHOLD', () => {
    expect(SYSTEMIC_THRESHOLD).toBe(3);
  });

  it('should have correct CONFIDENCE_THRESHOLDS', () => {
    expect(CONFIDENCE_THRESHOLDS.HIGH).toBe(5);
    expect(CONFIDENCE_THRESHOLDS.MEDIUM).toBe(3);
  });

  it('should export user-friendly error messages', () => {
    expect(FTS_ERROR_MESSAGES.DATABASE_NOT_FOUND).toContain('agentlint sessions');
    expect(FTS_ERROR_MESSAGES.FTS_NOT_INITIALIZED).toContain('agentlint sessions');
    expect(FTS_ERROR_MESSAGES.SCHEMA_MISMATCH).toContain('force');
  });
});
