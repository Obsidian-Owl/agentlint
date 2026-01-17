/**
 * Unit tests for persistence/causal/queries.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { v4 as uuidv4 } from 'uuid';

import { createCausalTables } from '../../../../src/persistence/causal/schema';
import {
  insertChain,
  getChainById,
  getChainsByProject,
  countChainsByProject,
  deleteChain,
  insertPattern,
  getPatternById,
  getPatternsByProject,
  addChainToPattern,
  deletePattern,
} from '../../../../src/persistence/causal/queries';

import type { CausalChain, IssuePattern } from '../../../../src/tools/causal/types';

describe('causal/queries', () => {
  const testBaseDir = join(tmpdir(), 'agentlint-test-causal-queries');
  let db: Database;

  // Helper to create a valid CausalChain
  const createTestChain = (overrides: Partial<CausalChain> = {}): CausalChain => ({
    id: uuidv4(),
    issueId: 'issue-' + uuidv4().slice(0, 8),
    trigger: {
      id: uuidv4(),
      type: 'SessionMatch',
      source: 'session-123',
      content: 'User prompt about config',
      timestamp: '2026-01-15T10:00:00Z',
    },
    gap: {
      type: 'missing_guidance',
      location: 'claude_md',
      expectedGuidance: 'Add credential handling guidance',
      counterfactual: 'If guidance existed, secret would not have been exposed',
    },
    mechanism: 'AI included credentials due to missing guidance',
    effect: 'Secret API key found in CLAUDE.md',
    confidence: {
      specificity: true,
      temporal: true,
      mechanistic: true,
      evidenceQuality: true,
      reproducibility: false,
      alternatives: true,
      overall: 'high',
    },
    evidence: [
      {
        id: uuidv4(),
        type: 'SessionMatch',
        source: 'session-123',
        content: 'User prompt about config',
        timestamp: '2026-01-15T10:00:00Z',
      },
      {
        id: uuidv4(),
        type: 'ConfigGap',
        source: 'config-analysis',
        content: 'Missing credential guidance',
      },
    ],
    depth: 2,
    depthLimitReached: false,
    projectPath: '/test/project',
    createdAt: '2026-01-17T12:00:00Z',
    counterfactual: 'If credential guidance existed, this would not have happened',
    ...overrides,
  });

  // Helper to create a valid IssuePattern
  const createTestPattern = (
    chainIds: string[],
    overrides: Partial<IssuePattern> = {}
  ): IssuePattern => ({
    id: uuidv4(),
    category: 'missing_guidance',
    chainIds,
    frequency: chainIds.length,
    isSystemic: chainIds.length >= 3,
    firstOccurrence: '2026-01-15T10:00:00Z',
    lastOccurrence: '2026-01-17T12:00:00Z',
    projectPath: '/test/project',
    summary: 'Recurring missing guidance pattern',
    ...overrides,
  });

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true });
    }
    mkdirSync(testBaseDir, { recursive: true });

    // Create a fresh database with causal tables
    const dbPath = join(testBaseDir, 'test.db');
    db = new Database(dbPath);
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

  describe('insertChain', () => {
    it('should insert a chain and return its ID', () => {
      const chain = createTestChain();
      const insertedId = insertChain(db, chain);

      expect(insertedId).toBe(chain.id);
    });

    it('should store all chain properties', () => {
      const chain = createTestChain();
      insertChain(db, chain);

      const retrieved = getChainById(db, chain.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.issueId).toBe(chain.issueId);
      expect(retrieved!.mechanism).toBe(chain.mechanism);
      expect(retrieved!.effect).toBe(chain.effect);
      expect(retrieved!.projectPath).toBe(chain.projectPath);
      expect(retrieved!.depth).toBe(chain.depth);
      expect(retrieved!.depthLimitReached).toBe(chain.depthLimitReached);
    });

    it('should store gap information', () => {
      const chain = createTestChain();
      insertChain(db, chain);

      const retrieved = getChainById(db, chain.id);
      expect(retrieved!.gap).toBeDefined();
      expect(retrieved!.gap!.type).toBe(chain.gap!.type);
      expect(retrieved!.gap!.location).toBe(chain.gap!.location);
      expect(retrieved!.gap!.expectedGuidance).toBe(chain.gap!.expectedGuidance);
    });

    it('should store confidence scores', () => {
      const chain = createTestChain();
      insertChain(db, chain);

      const retrieved = getChainById(db, chain.id);
      expect(retrieved!.confidence.specificity).toBe(true);
      expect(retrieved!.confidence.temporal).toBe(true);
      expect(retrieved!.confidence.reproducibility).toBe(false);
      expect(retrieved!.confidence.overall).toBe('high');
    });

    it('should store all evidence items', () => {
      const chain = createTestChain();
      insertChain(db, chain);

      const retrieved = getChainById(db, chain.id);
      expect(retrieved!.evidence.length).toBe(2);
      expect(retrieved!.evidence[0].type).toBe('SessionMatch');
      expect(retrieved!.evidence[1].type).toBe('ConfigGap');
    });

    it('should handle chain without gap', () => {
      const chain = createTestChain({ gap: undefined });
      insertChain(db, chain);

      const retrieved = getChainById(db, chain.id);
      expect(retrieved!.gap).toBeUndefined();
    });

    it('should generate UUID if not provided', () => {
      const chain = createTestChain();
      // Remove the ID to test auto-generation
      const chainWithoutId = { ...chain, id: '' } as unknown as CausalChain;

      const insertedId = insertChain(db, chainWithoutId);

      expect(insertedId).toBeTruthy();
      expect(insertedId.length).toBeGreaterThan(0);
    });
  });

  describe('getChainById', () => {
    it('should return null for non-existent chain', () => {
      const result = getChainById(db, 'non-existent-id');
      expect(result).toBeNull();
    });

    it('should return the chain with evidence', () => {
      const chain = createTestChain();
      insertChain(db, chain);

      const retrieved = getChainById(db, chain.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(chain.id);
      expect(retrieved!.evidence.length).toBe(2);
    });

    it('should reconstruct trigger from evidence', () => {
      const chain = createTestChain();
      insertChain(db, chain);

      const retrieved = getChainById(db, chain.id);
      expect(retrieved!.trigger.type).toBe('SessionMatch');
      expect(retrieved!.trigger.source).toBe('session-123');
    });
  });

  describe('getChainsByProject', () => {
    it('should return empty array for project with no chains', () => {
      const result = getChainsByProject(db, '/nonexistent/project');
      expect(result).toEqual([]);
    });

    it('should return chains for the specified project', () => {
      const chain1 = createTestChain({ projectPath: '/project/a' });
      const chain2 = createTestChain({ projectPath: '/project/a' });
      const chain3 = createTestChain({ projectPath: '/project/b' });

      insertChain(db, chain1);
      insertChain(db, chain2);
      insertChain(db, chain3);

      const projectAChains = getChainsByProject(db, '/project/a');
      expect(projectAChains.length).toBe(2);

      const projectBChains = getChainsByProject(db, '/project/b');
      expect(projectBChains.length).toBe(1);
    });

    it('should support pagination', () => {
      // Insert 5 chains
      for (let i = 0; i < 5; i++) {
        insertChain(db, createTestChain({ projectPath: '/project' }));
      }

      const page1 = getChainsByProject(db, '/project', { limit: 2, offset: 0 });
      expect(page1.length).toBe(2);

      const page2 = getChainsByProject(db, '/project', { limit: 2, offset: 2 });
      expect(page2.length).toBe(2);

      const page3 = getChainsByProject(db, '/project', { limit: 2, offset: 4 });
      expect(page3.length).toBe(1);
    });

    it('should support ordering', () => {
      const chain1 = createTestChain({
        projectPath: '/project',
        createdAt: '2026-01-15T10:00:00Z',
      });
      const chain2 = createTestChain({
        projectPath: '/project',
        createdAt: '2026-01-17T10:00:00Z',
      });

      insertChain(db, chain1);
      insertChain(db, chain2);

      const descOrder = getChainsByProject(db, '/project', {
        orderBy: 'created_at',
        order: 'DESC',
      });
      expect(descOrder[0].createdAt).toBe('2026-01-17T10:00:00Z');

      const ascOrder = getChainsByProject(db, '/project', {
        orderBy: 'created_at',
        order: 'ASC',
      });
      expect(ascOrder[0].createdAt).toBe('2026-01-15T10:00:00Z');
    });
  });

  describe('countChainsByProject', () => {
    it('should return 0 for project with no chains', () => {
      expect(countChainsByProject(db, '/nonexistent')).toBe(0);
    });

    it('should return correct count', () => {
      insertChain(db, createTestChain({ projectPath: '/project' }));
      insertChain(db, createTestChain({ projectPath: '/project' }));
      insertChain(db, createTestChain({ projectPath: '/other' }));

      expect(countChainsByProject(db, '/project')).toBe(2);
      expect(countChainsByProject(db, '/other')).toBe(1);
    });
  });

  describe('deleteChain', () => {
    it('should return false for non-existent chain', () => {
      expect(deleteChain(db, 'non-existent')).toBe(false);
    });

    it('should delete the chain and return true', () => {
      const chain = createTestChain();
      insertChain(db, chain);

      const result = deleteChain(db, chain.id);
      expect(result).toBe(true);
      expect(getChainById(db, chain.id)).toBeNull();
    });

    it('should cascade delete evidence items', () => {
      const chain = createTestChain();
      insertChain(db, chain);

      const evidenceBefore = db
        .query<{ count: number }, [string]>(
          'SELECT COUNT(*) as count FROM evidence_items WHERE chain_id = ?'
        )
        .get(chain.id);
      expect(evidenceBefore?.count).toBe(2);

      deleteChain(db, chain.id);

      const evidenceAfter = db
        .query<{ count: number }, [string]>(
          'SELECT COUNT(*) as count FROM evidence_items WHERE chain_id = ?'
        )
        .get(chain.id);
      expect(evidenceAfter?.count).toBe(0);
    });
  });

  describe('insertPattern', () => {
    it('should insert a pattern and return its ID', () => {
      const chain = createTestChain();
      insertChain(db, chain);

      const pattern = createTestPattern([chain.id]);
      const insertedId = insertPattern(db, pattern);

      expect(insertedId).toBe(pattern.id);
    });

    it('should link chains to pattern', () => {
      const chain1 = createTestChain();
      const chain2 = createTestChain();
      insertChain(db, chain1);
      insertChain(db, chain2);

      const pattern = createTestPattern([chain1.id, chain2.id]);
      insertPattern(db, pattern);

      const retrieved = getPatternById(db, pattern.id);
      expect(retrieved!.chainIds).toContain(chain1.id);
      expect(retrieved!.chainIds).toContain(chain2.id);
    });

    it('should update chain pattern_id', () => {
      const chain = createTestChain();
      insertChain(db, chain);

      const pattern = createTestPattern([chain.id]);
      insertPattern(db, pattern);

      const updatedChain = getChainById(db, chain.id);
      expect(updatedChain!.patternId).toBe(pattern.id);
    });
  });

  describe('getPatternById', () => {
    it('should return null for non-existent pattern', () => {
      expect(getPatternById(db, 'non-existent')).toBeNull();
    });

    it('should return pattern with chain IDs', () => {
      const chain = createTestChain();
      insertChain(db, chain);

      const pattern = createTestPattern([chain.id]);
      insertPattern(db, pattern);

      const retrieved = getPatternById(db, pattern.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.category).toBe(pattern.category);
      expect(retrieved!.summary).toBe(pattern.summary);
      expect(retrieved!.chainIds.length).toBe(1);
    });
  });

  describe('getPatternsByProject', () => {
    it('should return patterns for project', () => {
      const chain = createTestChain({ projectPath: '/project' });
      insertChain(db, chain);

      const pattern = createTestPattern([chain.id], { projectPath: '/project' });
      insertPattern(db, pattern);

      const patterns = getPatternsByProject(db, '/project');
      expect(patterns.length).toBe(1);
    });

    it('should include global patterns (null project_path)', () => {
      const chain = createTestChain();
      insertChain(db, chain);

      const globalPattern = createTestPattern([chain.id], {
        projectPath: undefined,
      });
      insertPattern(db, globalPattern);

      const patterns = getPatternsByProject(db, '/project');
      expect(patterns.length).toBe(1);
    });

    it('should filter by minimum frequency', () => {
      const chains = [
        createTestChain(),
        createTestChain(),
        createTestChain(),
      ];
      chains.forEach((c) => insertChain(db, c));

      const pattern1 = createTestPattern([chains[0].id], { frequency: 1 });
      const pattern2 = createTestPattern([chains[1].id, chains[2].id], {
        frequency: 2,
      });

      insertPattern(db, pattern1);
      insertPattern(db, pattern2);

      const filtered = getPatternsByProject(db, null, { minFrequency: 2 });
      expect(filtered.length).toBe(1);
      expect(filtered[0].frequency).toBe(2);
    });

    it('should filter by category', () => {
      const chain1 = createTestChain();
      const chain2 = createTestChain();
      insertChain(db, chain1);
      insertChain(db, chain2);

      insertPattern(
        db,
        createTestPattern([chain1.id], { category: 'missing_config' })
      );
      insertPattern(
        db,
        createTestPattern([chain2.id], { category: 'missing_guidance' })
      );

      const filtered = getPatternsByProject(db, null, {
        category: 'missing_config',
      });
      expect(filtered.length).toBe(1);
      expect(filtered[0].category).toBe('missing_config');
    });

    it('should filter by systemic only', () => {
      const chains = [
        createTestChain(),
        createTestChain(),
        createTestChain(),
        createTestChain(),
      ];
      chains.forEach((c) => insertChain(db, c));

      const nonSystemic = createTestPattern([chains[0].id], {
        frequency: 1,
        isSystemic: false,
      });
      const systemic = createTestPattern(
        [chains[1].id, chains[2].id, chains[3].id],
        { frequency: 3, isSystemic: true }
      );

      insertPattern(db, nonSystemic);
      insertPattern(db, systemic);

      const filtered = getPatternsByProject(db, null, { onlySystemic: true });
      expect(filtered.length).toBe(1);
      expect(filtered[0].isSystemic).toBe(true);
    });
  });

  describe('addChainToPattern', () => {
    it('should add chain to existing pattern', () => {
      const chains = [createTestChain(), createTestChain()];
      chains.forEach((c) => insertChain(db, c));

      const pattern = createTestPattern([chains[0].id], { frequency: 1 });
      insertPattern(db, pattern);

      addChainToPattern(db, pattern.id, chains[1].id, '2026-01-18T10:00:00Z');

      const updated = getPatternById(db, pattern.id);
      expect(updated!.chainIds.length).toBe(2);
      expect(updated!.frequency).toBe(2);
    });

    it('should update last_occurrence', () => {
      const chain1 = createTestChain();
      const chain2 = createTestChain();
      insertChain(db, chain1);
      insertChain(db, chain2);

      const pattern = createTestPattern([chain1.id], {
        lastOccurrence: '2026-01-15T10:00:00Z',
      });
      insertPattern(db, pattern);

      addChainToPattern(db, pattern.id, chain2.id, '2026-01-18T10:00:00Z');

      const updated = getPatternById(db, pattern.id);
      expect(updated!.lastOccurrence).toBe('2026-01-18T10:00:00Z');
    });

    it('should set isSystemic when frequency reaches 3', () => {
      const chains = [
        createTestChain(),
        createTestChain(),
        createTestChain(),
      ];
      chains.forEach((c) => insertChain(db, c));

      const pattern = createTestPattern([chains[0].id, chains[1].id], {
        frequency: 2,
        isSystemic: false,
      });
      insertPattern(db, pattern);

      addChainToPattern(db, pattern.id, chains[2].id, '2026-01-18T10:00:00Z');

      const updated = getPatternById(db, pattern.id);
      expect(updated!.frequency).toBe(3);
      expect(updated!.isSystemic).toBe(true);
    });
  });

  describe('deletePattern', () => {
    it('should return false for non-existent pattern', () => {
      expect(deletePattern(db, 'non-existent')).toBe(false);
    });

    it('should delete pattern and return true', () => {
      const chain = createTestChain();
      insertChain(db, chain);

      const pattern = createTestPattern([chain.id]);
      insertPattern(db, pattern);

      const result = deletePattern(db, pattern.id);
      expect(result).toBe(true);
      expect(getPatternById(db, pattern.id)).toBeNull();
    });

    it('should clear pattern_id from linked chains', () => {
      const chain = createTestChain();
      insertChain(db, chain);

      const pattern = createTestPattern([chain.id]);
      insertPattern(db, pattern);

      expect(getChainById(db, chain.id)!.patternId).toBe(pattern.id);

      deletePattern(db, pattern.id);

      expect(getChainById(db, chain.id)!.patternId).toBeUndefined();
    });
  });
});
