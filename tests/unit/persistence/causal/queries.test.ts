/**
 * Unit tests for causal queries
 *
 * Tests CRUD operations for causal chains and issue patterns.
 *
 * @module tests/unit/persistence/causal/queries.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { v4 as uuidv4 } from 'uuid';
import {
  insertChain,
  getChainById,
  getChainsByProject,
  countChainsByProject,
  deleteChain,
  insertPattern,
  getPatternById,
  getPatternsByProject,
  getAllPatterns,
  addChainToPattern,
  deletePattern,
} from '../../../../src/persistence/causal/queries';
import { createCausalTables, dropCausalTables } from '../../../../src/persistence/causal/schema';
import type { CausalChain, IssuePattern, EvidenceItem } from '../../../../src/tools/causal/types';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockEvidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: uuidv4(),
    type: 'SessionMatch',
    source: 'test-session',
    timestamp: new Date().toISOString(),
    content: 'Test evidence content',
    position: {
      filePath: 'test.ts',
      line: 10,
      column: 5,
      snippet: 'const x = 1;',
    },
    metadata: { key: 'value' },
    ...overrides,
  };
}

function createMockChain(overrides: Partial<CausalChain> = {}): CausalChain {
  return {
    id: uuidv4(),
    issueId: uuidv4(),
    trigger: createMockEvidence(),
    gap: {
      type: 'missing_config',
      location: 'project_config',
      expectedGuidance: 'Should have config',
      counterfactual: 'Would have worked',
    },
    mechanism: 'Missing configuration led to error',
    effect: 'Build failed',
    confidence: {
      specificity: true,
      temporal: true,
      mechanistic: true,
      evidenceQuality: true,
      reproducibility: false,
      alternatives: false,
      overall: 'high',
    },
    evidence: [createMockEvidence()],
    depth: 1,
    depthLimitReached: false,
    projectPath: '/test/project',
    createdAt: new Date().toISOString(),
    counterfactual: 'If config existed, build would succeed',
    ...overrides,
  };
}

function createMockPattern(
  chainIds: string[],
  overrides: Partial<IssuePattern> = {}
): IssuePattern {
  return {
    id: uuidv4(),
    category: 'missing_config',
    chainIds,
    frequency: chainIds.length,
    isSystemic: chainIds.length >= 3,
    firstOccurrence: new Date().toISOString(),
    lastOccurrence: new Date().toISOString(),
    projectPath: '/test/project',
    summary: 'Recurring config issue',
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('causal/queries', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createCausalTables(db);
  });

  afterEach(() => {
    dropCausalTables(db);
    db.close();
  });

  describe('Chain Operations', () => {
    describe('insertChain', () => {
      it('should insert a chain with evidence', () => {
        const chain = createMockChain();
        const chainId = insertChain(db, chain);

        expect(chainId).toBe(chain.id);

        // Verify in database
        const row = db
          .query<{ id: string }, [string]>('SELECT id FROM causal_chains WHERE id = ?')
          .get(chainId);
        expect(row).not.toBeNull();
      });

      it('should insert multiple evidence items', () => {
        const chain = createMockChain({
          evidence: [
            createMockEvidence({ id: 'ev1', type: 'SessionMatch' }),
            createMockEvidence({ id: 'ev2', type: 'GitCorrelation' }),
            createMockEvidence({ id: 'ev3', type: 'ConfigGap' }),
          ],
        });

        insertChain(db, chain);

        const count = db
          .query<
            { count: number },
            [string]
          >('SELECT COUNT(*) as count FROM evidence_items WHERE chain_id = ?')
          .get(chain.id);

        expect(count?.count).toBe(3);
      });

      it('should handle chain without gap', () => {
        const chain = createMockChain({ gap: undefined });
        const chainId = insertChain(db, chain);

        expect(chainId).toBe(chain.id);

        const row = db
          .query<
            { gap_type: string | null },
            [string]
          >('SELECT gap_type FROM causal_chains WHERE id = ?')
          .get(chainId);

        expect(row?.gap_type).toBeNull();
      });

      it('should generate ID if not provided', () => {
        const chain = createMockChain();
        // Remove id to test ID generation
        const chainWithoutId = { ...chain, id: '' };
        const chainId = insertChain(db, chainWithoutId);

        expect(chainId).toBeTruthy();
        expect(chainId.length).toBeGreaterThan(0);
      });
    });

    describe('getChainById', () => {
      it('should retrieve a chain with evidence', () => {
        const chain = createMockChain();
        insertChain(db, chain);

        const retrieved = getChainById(db, chain.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(chain.id);
        expect(retrieved!.issueId).toBe(chain.issueId);
        expect(retrieved!.mechanism).toBe(chain.mechanism);
        expect(retrieved!.evidence.length).toBe(chain.evidence.length);
      });

      it('should return null for non-existent chain', () => {
        const retrieved = getChainById(db, 'non-existent-id');
        expect(retrieved).toBeNull();
      });

      it('should reconstruct confidence object correctly', () => {
        const chain = createMockChain({
          confidence: {
            specificity: true,
            temporal: false,
            mechanistic: true,
            evidenceQuality: false,
            reproducibility: true,
            alternatives: false,
            overall: 'medium',
          },
        });
        insertChain(db, chain);

        const retrieved = getChainById(db, chain.id);

        expect(retrieved!.confidence.specificity).toBe(true);
        expect(retrieved!.confidence.temporal).toBe(false);
        expect(retrieved!.confidence.mechanistic).toBe(true);
        expect(retrieved!.confidence.overall).toBe('medium');
      });

      it('should reconstruct gap object correctly', () => {
        const chain = createMockChain({
          gap: {
            type: 'missing_example',
            location: 'global_config',
            expectedGuidance: 'Example needed',
            counterfactual: 'Would have helped',
          },
        });
        insertChain(db, chain);

        const retrieved = getChainById(db, chain.id);

        expect(retrieved!.gap).toBeDefined();
        expect(retrieved!.gap!.type).toBe('missing_example');
        expect(retrieved!.gap!.location).toBe('global_config');
      });
    });

    describe('getChainsByProject', () => {
      it('should retrieve chains for a project', () => {
        const projectPath = '/test/my-project';
        const chain1 = createMockChain({ projectPath });
        const chain2 = createMockChain({ projectPath });
        const chain3 = createMockChain({ projectPath: '/other/project' });

        insertChain(db, chain1);
        insertChain(db, chain2);
        insertChain(db, chain3);

        const chains = getChainsByProject(db, projectPath);

        expect(chains.length).toBe(2);
        expect(chains.every((c) => c.projectPath === projectPath)).toBe(true);
      });

      it('should support limit and offset', () => {
        const projectPath = '/test/project';
        for (let i = 0; i < 5; i++) {
          insertChain(db, createMockChain({ projectPath }));
        }

        const page1 = getChainsByProject(db, projectPath, { limit: 2, offset: 0 });
        const page2 = getChainsByProject(db, projectPath, { limit: 2, offset: 2 });

        expect(page1.length).toBe(2);
        expect(page2.length).toBe(2);
      });

      it('should support ordering by depth', () => {
        const projectPath = '/test/project';
        insertChain(db, createMockChain({ projectPath, depth: 1 }));
        insertChain(db, createMockChain({ projectPath, depth: 3 }));
        insertChain(db, createMockChain({ projectPath, depth: 2 }));

        const chains = getChainsByProject(db, projectPath, {
          orderBy: 'depth',
          order: 'DESC',
        });

        expect(chains[0]!.depth).toBe(3);
        expect(chains[1]!.depth).toBe(2);
        expect(chains[2]!.depth).toBe(1);
      });
    });

    describe('countChainsByProject', () => {
      it('should count chains for a project', () => {
        const projectPath = '/test/project';
        insertChain(db, createMockChain({ projectPath }));
        insertChain(db, createMockChain({ projectPath }));
        insertChain(db, createMockChain({ projectPath: '/other' }));

        const count = countChainsByProject(db, projectPath);
        expect(count).toBe(2);
      });

      it('should return 0 for empty project', () => {
        const count = countChainsByProject(db, '/non-existent');
        expect(count).toBe(0);
      });
    });

    describe('deleteChain', () => {
      it('should delete a chain and its evidence', () => {
        const chain = createMockChain();
        insertChain(db, chain);

        const deleted = deleteChain(db, chain.id);

        expect(deleted).toBe(true);
        expect(getChainById(db, chain.id)).toBeNull();

        // Evidence should also be deleted (cascade)
        const evidenceCount = db
          .query<
            { count: number },
            [string]
          >('SELECT COUNT(*) as count FROM evidence_items WHERE chain_id = ?')
          .get(chain.id);
        expect(evidenceCount?.count).toBe(0);
      });

      it('should return false for non-existent chain', () => {
        const deleted = deleteChain(db, 'non-existent');
        expect(deleted).toBe(false);
      });
    });
  });

  describe('Pattern Operations', () => {
    describe('insertPattern', () => {
      it('should insert a pattern with chain links', () => {
        // First insert chains
        const chain1 = createMockChain();
        const chain2 = createMockChain();
        insertChain(db, chain1);
        insertChain(db, chain2);

        const pattern = createMockPattern([chain1.id, chain2.id]);
        const patternId = insertPattern(db, pattern);

        expect(patternId).toBe(pattern.id);

        // Verify chain links
        const links = db
          .query<
            { chain_id: string },
            [string]
          >('SELECT chain_id FROM chain_patterns WHERE pattern_id = ?')
          .all(patternId);

        expect(links.length).toBe(2);
      });

      it('should update chain pattern_id references', () => {
        const chain = createMockChain();
        insertChain(db, chain);

        const pattern = createMockPattern([chain.id]);
        const patternId = insertPattern(db, pattern);

        const row = db
          .query<
            { pattern_id: string },
            [string]
          >('SELECT pattern_id FROM causal_chains WHERE id = ?')
          .get(chain.id);

        expect(row?.pattern_id).toBe(patternId);
      });
    });

    describe('getPatternById', () => {
      it('should retrieve a pattern with chain IDs', () => {
        const chain = createMockChain();
        insertChain(db, chain);

        const pattern = createMockPattern([chain.id], {
          category: 'missing_guidance',
          isSystemic: true,
        });
        insertPattern(db, pattern);

        const retrieved = getPatternById(db, pattern.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(pattern.id);
        expect(retrieved!.category).toBe('missing_guidance');
        expect(retrieved!.isSystemic).toBe(true);
        expect(retrieved!.chainIds).toContain(chain.id);
      });

      it('should return null for non-existent pattern', () => {
        const retrieved = getPatternById(db, 'non-existent');
        expect(retrieved).toBeNull();
      });
    });

    describe('getPatternsByProject', () => {
      it('should retrieve patterns for a project', () => {
        const chain1 = createMockChain({ projectPath: '/test/project' });
        const chain2 = createMockChain({ projectPath: '/other/project' });
        insertChain(db, chain1);
        insertChain(db, chain2);

        const pattern1 = createMockPattern([chain1.id], { projectPath: '/test/project' });
        const pattern2 = createMockPattern([chain2.id], { projectPath: '/other/project' });
        insertPattern(db, pattern1);
        insertPattern(db, pattern2);

        const patterns = getPatternsByProject(db, '/test/project');

        expect(patterns.length).toBe(1);
        expect(patterns[0]!.projectPath).toBe('/test/project');
      });

      it('should filter by minimum frequency', () => {
        const chains = [createMockChain(), createMockChain(), createMockChain()];
        chains.forEach((c) => insertChain(db, c));

        const pattern1 = createMockPattern(
          chains.slice(0, 1).map((c) => c.id),
          { frequency: 1 }
        );
        const pattern2 = createMockPattern(
          chains.slice(0, 3).map((c) => c.id),
          { frequency: 3 }
        );
        insertPattern(db, pattern1);
        insertPattern(db, pattern2);

        const patterns = getPatternsByProject(db, null, { minFrequency: 2 });

        expect(patterns.length).toBe(1);
        expect(patterns[0]!.frequency).toBe(3);
      });

      it('should filter by category', () => {
        const chain1 = createMockChain();
        const chain2 = createMockChain();
        insertChain(db, chain1);
        insertChain(db, chain2);

        const pattern1 = createMockPattern([chain1.id], { category: 'missing_config' });
        const pattern2 = createMockPattern([chain2.id], { category: 'missing_example' });
        insertPattern(db, pattern1);
        insertPattern(db, pattern2);

        const patterns = getPatternsByProject(db, null, { category: 'missing_config' });

        expect(patterns.length).toBe(1);
        expect(patterns[0]!.category).toBe('missing_config');
      });

      it('should filter by systemic only', () => {
        const chains = [createMockChain(), createMockChain()];
        chains.forEach((c) => insertChain(db, c));

        const pattern1 = createMockPattern([chains[0]!.id], { isSystemic: false });
        const pattern2 = createMockPattern([chains[1]!.id], { isSystemic: true });
        insertPattern(db, pattern1);
        insertPattern(db, pattern2);

        const patterns = getPatternsByProject(db, null, { onlySystemic: true });

        expect(patterns.length).toBe(1);
        expect(patterns[0]!.isSystemic).toBe(true);
      });
    });

    describe('getAllPatterns', () => {
      it('should retrieve all patterns across projects', () => {
        const chain1 = createMockChain({ projectPath: '/project1' });
        const chain2 = createMockChain({ projectPath: '/project2' });
        insertChain(db, chain1);
        insertChain(db, chain2);

        insertPattern(db, createMockPattern([chain1.id], { projectPath: '/project1' }));
        insertPattern(db, createMockPattern([chain2.id], { projectPath: '/project2' }));

        const patterns = getAllPatterns(db);

        expect(patterns.length).toBe(2);
      });

      it('should respect limit', () => {
        const chains = Array.from({ length: 5 }, () => createMockChain());
        chains.forEach((c) => insertChain(db, c));
        chains.forEach((c) => insertPattern(db, createMockPattern([c.id])));

        const patterns = getAllPatterns(db, { limit: 3 });

        expect(patterns.length).toBe(3);
      });
    });

    describe('addChainToPattern', () => {
      it('should add a chain to an existing pattern', () => {
        const chain1 = createMockChain();
        const chain2 = createMockChain();
        insertChain(db, chain1);
        insertChain(db, chain2);

        const pattern = createMockPattern([chain1.id], { frequency: 1 });
        insertPattern(db, pattern);

        addChainToPattern(db, pattern.id, chain2.id, new Date().toISOString());

        const updated = getPatternById(db, pattern.id);

        expect(updated!.chainIds).toContain(chain2.id);
        expect(updated!.frequency).toBe(2);
      });

      it('should mark pattern as systemic when frequency reaches 3', () => {
        const chains = Array.from({ length: 3 }, () => createMockChain());
        chains.forEach((c) => insertChain(db, c));

        const pattern = createMockPattern([chains[0]!.id], {
          frequency: 1,
          isSystemic: false,
        });
        insertPattern(db, pattern);

        addChainToPattern(db, pattern.id, chains[1]!.id, new Date().toISOString());
        addChainToPattern(db, pattern.id, chains[2]!.id, new Date().toISOString());

        const updated = getPatternById(db, pattern.id);

        expect(updated!.isSystemic).toBe(true);
        expect(updated!.frequency).toBe(3);
      });
    });

    describe('deletePattern', () => {
      it('should delete a pattern and clear chain references', () => {
        const chain = createMockChain();
        insertChain(db, chain);

        const pattern = createMockPattern([chain.id]);
        insertPattern(db, pattern);

        const deleted = deletePattern(db, pattern.id);

        expect(deleted).toBe(true);
        expect(getPatternById(db, pattern.id)).toBeNull();

        // Chain's pattern_id should be cleared
        const row = db
          .query<
            { pattern_id: string | null },
            [string]
          >('SELECT pattern_id FROM causal_chains WHERE id = ?')
          .get(chain.id);

        expect(row?.pattern_id).toBeNull();
      });

      it('should return false for non-existent pattern', () => {
        const deleted = deletePattern(db, 'non-existent');
        expect(deleted).toBe(false);
      });
    });
  });

  describe('Evidence handling', () => {
    it('should preserve evidence order (sequence)', () => {
      const chain = createMockChain({
        evidence: [
          createMockEvidence({ content: 'First' }),
          createMockEvidence({ content: 'Second' }),
          createMockEvidence({ content: 'Third' }),
        ],
      });
      insertChain(db, chain);

      const retrieved = getChainById(db, chain.id);

      expect(retrieved!.evidence[0]!.content).toBe('First');
      expect(retrieved!.evidence[1]!.content).toBe('Second');
      expect(retrieved!.evidence[2]!.content).toBe('Third');
    });

    it('should handle evidence without position', () => {
      const chain = createMockChain({
        evidence: [createMockEvidence({ position: undefined })],
      });
      insertChain(db, chain);

      const retrieved = getChainById(db, chain.id);
      expect(retrieved!.evidence[0]!.position).toBeUndefined();
    });

    it('should handle evidence with metadata', () => {
      const metadata = { custom: 'data', nested: { value: 123 } };
      const chain = createMockChain({
        evidence: [createMockEvidence({ metadata })],
      });
      insertChain(db, chain);

      const retrieved = getChainById(db, chain.id);

      expect(retrieved!.evidence[0]!.metadata).toEqual(metadata);
    });
  });
});
