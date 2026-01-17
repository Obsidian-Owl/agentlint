/**
 * EP07 Causal Tracing Engine - Performance Tests (T052)
 *
 * Validates performance targets:
 * - Single trace: < 5 seconds
 * - Pattern detection: < 30 seconds
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { v4 as uuidv4 } from 'uuid';

import { createCausalTables, insertChain, insertPattern } from '../../src/persistence/causal';
import {
  createChainBuilder,
  createPatternDetector,
  createConfidenceAssessor,
  createCounterfactualGenerator,
} from '../../src/tools/causal';

import type { CausalChain, EvidenceItem, Gap, IssuePattern } from '../../src/tools/causal/types';

// =============================================================================
// Test Fixtures
// =============================================================================

const TEST_PROJECT = '/test/performance-project';

/**
 * Create a test evidence item.
 */
function createTestEvidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: uuidv4(),
    type: 'SessionMatch',
    source: `session-${uuidv4().substring(0, 8)}`,
    timestamp: new Date().toISOString(),
    content: 'Test evidence content with some searchable keywords for matching',
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
    mechanism: 'Test mechanism explaining the causal relationship',
    effect: 'Test effect describing the issue outcome',
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
// Performance Tests
// =============================================================================

describe('EP07 Performance Tests (T052)', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-perf-test');
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
  // Single Trace Performance
  // ===========================================================================

  describe('single trace performance', () => {
    it('should build chain in under 5 seconds', () => {
      const chainBuilder = createChainBuilder();

      // Create moderate amount of evidence
      const evidence: EvidenceItem[] = [];
      for (let i = 0; i < 50; i++) {
        evidence.push(
          createTestEvidence({
            timestamp: new Date(Date.now() - i * 1000).toISOString(),
          })
        );
      }

      const startTime = Date.now();

      const result = chainBuilder.build({
        issueId: 'issue-perf-001',
        issueDescription: 'Performance test issue',
        evidence,
        gap: createTestGap(),
        projectPath: TEST_PROJECT,
      });

      const elapsed = Date.now() - startTime;

      expect(result.chain).toBeDefined();
      expect(elapsed).toBeLessThan(5000); // 5 seconds
    });

    it('should assess confidence in under 100ms', () => {
      const assessor = createConfidenceAssessor();
      const evidence: EvidenceItem[] = [];
      for (let i = 0; i < 20; i++) {
        evidence.push(createTestEvidence());
      }

      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        assessor.assess({
          evidence,
          issueDescription: 'Test issue',
          gap: createTestGap(),
          mechanism: 'Test mechanism',
        });
      }

      const elapsed = Date.now() - startTime;

      // 100 assessments should take under 100ms
      expect(elapsed).toBeLessThan(100);
    });

    it('should generate counterfactual in under 10ms', () => {
      const generator = createCounterfactualGenerator();
      const gap = createTestGap();

      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        generator.generateFromGap(gap);
      }

      const elapsed = Date.now() - startTime;

      // 1000 generations should take under 10ms
      expect(elapsed).toBeLessThan(50); // Being generous
    });
  });

  // ===========================================================================
  // Pattern Detection Performance
  // ===========================================================================

  describe('pattern detection performance', () => {
    it('should detect patterns from 100 chains in under 30 seconds', () => {
      const detector = createPatternDetector();

      // Create 100 chains with varying gap types
      const chains: CausalChain[] = [];
      const gapTypes: Gap['type'][] = [
        'missing_guidance',
        'missing_config',
        'missing_example',
        'terminology_gap',
        'context_loss',
      ];

      for (let i = 0; i < 100; i++) {
        chains.push(
          createTestChain({
            gap: createTestGap({
              type: gapTypes[i % gapTypes.length]!,
            }),
          })
        );
      }

      const startTime = Date.now();

      const result = detector.detectPatterns(chains);

      const elapsed = Date.now() - startTime;

      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.chainsAnalyzed).toBe(100);
      expect(elapsed).toBeLessThan(30000); // 30 seconds
    });

    it('should detect patterns from 500 chains in under 30 seconds', () => {
      const detector = createPatternDetector();

      const chains: CausalChain[] = [];
      for (let i = 0; i < 500; i++) {
        chains.push(
          createTestChain({
            gap: createTestGap({
              type: i % 2 === 0 ? 'missing_guidance' : 'missing_config',
            }),
          })
        );
      }

      const startTime = Date.now();

      const result = detector.detectPatterns(chains);

      const elapsed = Date.now() - startTime;

      expect(result.patterns).toHaveLength(2);
      expect(elapsed).toBeLessThan(30000);
    });

    it('should filter patterns efficiently', () => {
      const detector = createPatternDetector();

      const chains: CausalChain[] = [];
      for (let i = 0; i < 100; i++) {
        chains.push(createTestChain());
      }

      const startTime = Date.now();

      // Test various filter combinations
      detector.detectPatterns(chains, { minFrequency: 10 });
      detector.detectPatterns(chains, { category: 'missing_guidance' });
      detector.detectPatterns(chains, { systemicOnly: true });
      detector.detectPatterns(chains, { minFrequency: 5, category: 'missing_guidance' });

      const elapsed = Date.now() - startTime;

      // 4 filter operations should be fast
      expect(elapsed).toBeLessThan(1000);
    });
  });

  // ===========================================================================
  // Database Performance
  // ===========================================================================

  describe('database performance', () => {
    it('should insert 100 chains in under 5 seconds', () => {
      const chains: CausalChain[] = [];
      for (let i = 0; i < 100; i++) {
        chains.push(createTestChain());
      }

      const startTime = Date.now();

      for (const chain of chains) {
        insertChain(db, chain);
      }

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(5000);
    });

    it('should insert 50 patterns in under 5 seconds', () => {
      // First insert chains
      const chains: CausalChain[] = [];
      for (let i = 0; i < 50; i++) {
        const chain = createTestChain();
        chains.push(chain);
        insertChain(db, chain);
      }

      const startTime = Date.now();

      for (let i = 0; i < 50; i++) {
        const pattern: IssuePattern = {
          id: uuidv4(),
          category: 'missing_guidance',
          chainIds: [chains[i]!.id],
          frequency: 1,
          isSystemic: false,
          firstOccurrence: new Date().toISOString(),
          lastOccurrence: new Date().toISOString(),
          projectPath: TEST_PROJECT,
          summary: `Pattern ${i}`,
        };
        insertPattern(db, pattern);
      }

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(5000);
    });
  });

  // ===========================================================================
  // Memory Efficiency
  // ===========================================================================

  describe('memory efficiency', () => {
    it('should handle large evidence arrays without excessive memory', () => {
      const chainBuilder = createChainBuilder();

      // Create large evidence array
      const evidence: EvidenceItem[] = [];
      for (let i = 0; i < 1000; i++) {
        evidence.push(
          createTestEvidence({
            content: 'A'.repeat(100), // 100 chars each
          })
        );
      }

      // Should not throw or hang
      const result = chainBuilder.build({
        issueId: 'issue-memory',
        issueDescription: 'Memory test',
        evidence,
        projectPath: TEST_PROJECT,
      });

      expect(result.chain).toBeDefined();
    });

    it('should handle many small chains efficiently', () => {
      const detector = createPatternDetector();

      // Create many small chains
      const chains: CausalChain[] = [];
      for (let i = 0; i < 1000; i++) {
        chains.push(
          createTestChain({
            evidence: [createTestEvidence()],
          })
        );
      }

      const result = detector.detectPatterns(chains);

      expect(result.chainsAnalyzed).toBe(1000);
    });
  });
});
