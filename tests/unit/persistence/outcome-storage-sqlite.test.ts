/**
 * EP11 Quality & Security - SQLite Outcome Storage Tests
 *
 * Tests the real SQLite-based OutcomeStorage implementation.
 * Uses in-memory database for fast, isolated tests.
 *
 * @module tests/unit/persistence/outcome-storage-sqlite
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { randomUUID } from 'crypto';
import {
  OutcomeStorage,
  createOutcomeStorage,
  getDefaultOutcomeDbPath,
} from '../../../src/persistence/outcome-storage';
import type {
  RecommendationOutcome,
  RecommendationType,
} from '../../../specs/ep11-quality-security/contracts/outcome';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestOutcome(
  sessionId: string = 'session-001',
  recommendationType: RecommendationType = 'preventive',
  implemented: boolean | null = null
): Omit<RecommendationOutcome, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    sessionId,
    recommendationId: `REC-${randomUUID().slice(0, 8)}`,
    recommendationType,
    recommendationSummary: `Test recommendation (${recommendationType})`,
    promptId: null,
    promptVersion: null,
    implemented,
    implementationDate: implemented ? new Date().toISOString() : null,
    helped: null,
    outcomeNotes: null,
    configChangedAfter: null,
    similarIssueRecurred: null,
  };
}

// =============================================================================
// Test Setup
// =============================================================================

let storage: OutcomeStorage;

beforeEach(() => {
  // Use in-memory database for each test
  storage = new OutcomeStorage(':memory:');
});

afterEach(() => {
  storage.close();
});

// =============================================================================
// Test Suite
// =============================================================================

describe('SQLite OutcomeStorage', () => {
  describe('Schema Initialization', () => {
    test('creates database schema on initialization', async () => {
      // If we can create an outcome, the schema was created successfully
      const outcome = await storage.createOutcome(createTestOutcome());
      expect(outcome.id).toBeDefined();
    });

    test('is idempotent - can be called multiple times', () => {
      // Creating a new storage with same path should not fail
      const storage2 = new OutcomeStorage(':memory:');
      expect(storage2).toBeInstanceOf(OutcomeStorage);
      storage2.close();
    });
  });

  describe('CRUD Operations', () => {
    test('creates outcome with generated UUID', async () => {
      const input = createTestOutcome();
      const outcome = await storage.createOutcome(input);

      expect(outcome.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(outcome.sessionId).toBe(input.sessionId);
      expect(outcome.createdAt).toBeDefined();
      expect(outcome.updatedAt).toBeNull();
    });

    test('stores and retrieves boolean fields correctly', async () => {
      const input = createTestOutcome('session-1', 'preventive', true);
      input.helped = true;
      input.configChangedAfter = false;
      input.similarIssueRecurred = null;

      const created = await storage.createOutcome(input);
      const retrieved = await storage.getOutcome(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.implemented).toBe(true);
      expect(retrieved!.helped).toBe(true);
      expect(retrieved!.configChangedAfter).toBe(false);
      expect(retrieved!.similarIssueRecurred).toBeNull();
    });

    test('updates outcome with partial data', async () => {
      const created = await storage.createOutcome(createTestOutcome());

      const updated = await storage.updateOutcome(created.id, {
        implemented: true,
        implementationDate: new Date().toISOString(),
      });

      expect(updated.implemented).toBe(true);
      expect(updated.implementationDate).toBeDefined();
      expect(updated.updatedAt).toBeDefined();
      // Original fields preserved
      expect(updated.sessionId).toBe(created.sessionId);
    });

    test('preserves id and createdAt on update', async () => {
      const created = await storage.createOutcome(createTestOutcome());

      // These fields should be ignored by updateOutcome even if passed
      const updated = await storage.updateOutcome(created.id, {
        implemented: true,
        id: 'hacked-id',
        createdAt: '1970-01-01T00:00:00.000Z',
      });

      expect(updated.id).toBe(created.id);
      expect(updated.createdAt).toBe(created.createdAt);
    });

    test('throws error when updating non-existent outcome', () => {
      expect(() => storage.updateOutcome('non-existent-id', { implemented: true })).toThrow(
        'not found'
      );
    });
  });

  describe('Query Operations', () => {
    test('getOutcomesBySession returns outcomes for specific session', async () => {
      await storage.createOutcome(createTestOutcome('session-1'));
      await storage.createOutcome(createTestOutcome('session-1'));
      await storage.createOutcome(createTestOutcome('session-2'));

      const session1 = await storage.getOutcomesBySession('session-1');
      const session2 = await storage.getOutcomesBySession('session-2');

      expect(session1).toHaveLength(2);
      expect(session2).toHaveLength(1);
    });

    test('getOutcomesByRecommendation returns matching outcomes', async () => {
      const outcome1 = await storage.createOutcome(createTestOutcome());
      await storage.createOutcome(createTestOutcome());

      const results = await storage.getOutcomesByRecommendation(outcome1.recommendationId);

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(outcome1.id);
    });

    test('getPendingFollowUps filters correctly', async () => {
      // Implemented, no helped feedback = pending
      await storage.createOutcome(createTestOutcome('session-1', 'preventive', true));

      // Not implemented = not pending
      await storage.createOutcome(createTestOutcome('session-1', 'preventive', false));

      // Implemented with helped = not pending
      const withHelped = await storage.createOutcome(
        createTestOutcome('session-1', 'preventive', true)
      );
      await storage.updateOutcome(withHelped.id, { helped: true });

      // Use 0 days to get all pending regardless of age
      const pending = await storage.getPendingFollowUps(0);

      expect(pending).toHaveLength(1);
      expect(pending[0]!.implemented).toBe(true);
      expect(pending[0]!.helped).toBeNull();
    });
  });

  describe('Metrics Aggregation', () => {
    test('calculates metrics by recommendation type', async () => {
      // Symptomatic: 2 implemented, 1 helped
      await storage.createOutcome({
        ...createTestOutcome('s1', 'symptomatic', true),
        helped: true,
      });
      await storage.createOutcome({
        ...createTestOutcome('s1', 'symptomatic', true),
        helped: false,
      });

      // Preventive: 1 implemented, 1 helped
      await storage.createOutcome({
        ...createTestOutcome('s1', 'preventive', true),
        helped: true,
      });

      // Systemic: 1 not implemented
      await storage.createOutcome(createTestOutcome('s1', 'systemic', false));

      const metrics = await storage.getMetrics();

      // Symptomatic
      expect(metrics.symptomatic.totalRecommendations).toBe(2);
      expect(metrics.symptomatic.implementedCount).toBe(2);
      expect(metrics.symptomatic.helpedCount).toBe(1);
      expect(metrics.symptomatic.implementationRate).toBe(1);
      expect(metrics.symptomatic.successRate).toBe(0.5);

      // Preventive
      expect(metrics.preventive.totalRecommendations).toBe(1);
      expect(metrics.preventive.implementedCount).toBe(1);
      expect(metrics.preventive.helpedCount).toBe(1);

      // Systemic
      expect(metrics.systemic.totalRecommendations).toBe(1);
      expect(metrics.systemic.implementedCount).toBe(0);

      // All
      expect(metrics.all.totalRecommendations).toBe(4);
      expect(metrics.all.implementedCount).toBe(3);
      expect(metrics.all.helpedCount).toBe(2);
    });

    test('returns zero metrics for empty database', async () => {
      const metrics = await storage.getMetrics();

      expect(metrics.all.totalRecommendations).toBe(0);
      expect(metrics.all.implementationRate).toBe(0);
      expect(metrics.symptomatic.totalRecommendations).toBe(0);
    });
  });

  describe('Implicit Event Recording', () => {
    test('records config_changed event', async () => {
      const outcome = await storage.createOutcome(createTestOutcome());

      await storage.recordImplicitEvent({
        type: 'config_changed',
        recommendationId: outcome.recommendationId,
        detectedAt: new Date().toISOString(),
      });

      const updated = await storage.getOutcome(outcome.id);
      expect(updated!.configChangedAfter).toBe(true);
    });

    test('records issue_recurred event', async () => {
      const outcome = await storage.createOutcome(createTestOutcome());

      await storage.recordImplicitEvent({
        type: 'issue_recurred',
        recommendationId: outcome.recommendationId,
        detectedAt: new Date().toISOString(),
      });

      const updated = await storage.getOutcome(outcome.id);
      expect(updated!.similarIssueRecurred).toBe(true);
    });

    test('updates all outcomes for recommendation', async () => {
      const recId = `REC-${randomUUID().slice(0, 8)}`;

      // Create multiple outcomes for same recommendation
      const outcome1 = await storage.createOutcome({
        ...createTestOutcome(),
        recommendationId: recId,
      });
      const outcome2 = await storage.createOutcome({
        ...createTestOutcome('session-2'),
        recommendationId: recId,
      });

      await storage.recordImplicitEvent({
        type: 'config_changed',
        recommendationId: recId,
        detectedAt: new Date().toISOString(),
      });

      const updated1 = await storage.getOutcome(outcome1.id);
      const updated2 = await storage.getOutcome(outcome2.id);

      expect(updated1!.configChangedAfter).toBe(true);
      expect(updated2!.configChangedAfter).toBe(true);
    });
  });

  describe('Factory Functions', () => {
    test('createOutcomeStorage returns IOutcomeStorage implementation', async () => {
      const factoryStorage = createOutcomeStorage(':memory:');

      // Should implement all interface methods
      expect(typeof factoryStorage.createOutcome).toBe('function');
      expect(typeof factoryStorage.updateOutcome).toBe('function');
      expect(typeof factoryStorage.getOutcome).toBe('function');
      expect(typeof factoryStorage.getOutcomesBySession).toBe('function');
      expect(typeof factoryStorage.getOutcomesByRecommendation).toBe('function');
      expect(typeof factoryStorage.getPendingFollowUps).toBe('function');
      expect(typeof factoryStorage.getMetrics).toBe('function');
      expect(typeof factoryStorage.recordImplicitEvent).toBe('function');

      (factoryStorage as OutcomeStorage).close();
    });

    test('getDefaultOutcomeDbPath returns valid path', () => {
      const path = getDefaultOutcomeDbPath();
      expect(path).toContain('.agentlint');
      expect(path).toContain('outcomes.db');
    });
  });
});
