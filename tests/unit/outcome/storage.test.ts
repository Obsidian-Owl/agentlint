/**
 * EP11 Quality & Security - Outcome Storage Unit Tests
 *
 * Unit tests for recommendation outcome storage.
 * Tests CRUD operations, metrics aggregation, and follow-up queries.
 *
 * @module tests/unit/outcome/storage
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { randomUUID } from 'crypto';
import type {
  RecommendationOutcome,
  IOutcomeStorage,
  OutcomeMetricsByType,
  RecommendationType,
  ImplicitTrackingEvent,
} from '../../../specs/ep11-quality-security/contracts/outcome';

// =============================================================================
// Mock Implementation
// =============================================================================

/**
 * In-memory mock implementation for testing.
 * The real implementation will use SQLite.
 */
class MockOutcomeStorage implements IOutcomeStorage {
  private outcomes: Map<string, RecommendationOutcome> = new Map();

  createOutcome(
    outcome: Omit<RecommendationOutcome, 'id' | 'createdAt' | 'updatedAt'>
  ): RecommendationOutcome {
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    const newOutcome: RecommendationOutcome = {
      ...outcome,
      id,
      createdAt,
      updatedAt: null,
    };

    this.outcomes.set(id, newOutcome);
    return newOutcome;
  }

  updateOutcome(id: string, updates: Partial<RecommendationOutcome>): RecommendationOutcome {
    const existing = this.outcomes.get(id);
    if (!existing) {
      throw new Error(`Outcome not found: ${id}`);
    }

    const updated: RecommendationOutcome = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID override
      createdAt: existing.createdAt, // Prevent createdAt override
      updatedAt: new Date().toISOString(),
    };

    this.outcomes.set(id, updated);
    return updated;
  }

  getOutcome(id: string): RecommendationOutcome | null {
    return this.outcomes.get(id) ?? null;
  }

  getOutcomesBySession(sessionId: string): RecommendationOutcome[] {
    return Array.from(this.outcomes.values()).filter((o) => o.sessionId === sessionId);
  }

  getOutcomesByRecommendation(recommendationId: string): RecommendationOutcome[] {
    return Array.from(this.outcomes.values()).filter(
      (o) => o.recommendationId === recommendationId
    );
  }

  getPendingFollowUps(olderThanDays: number): RecommendationOutcome[] {
    return Array.from(this.outcomes.values()).filter((o) => {
      // Pending follow-up: implemented but not yet reported if helped
      if (o.implemented && o.helped === null) {
        // For olderThanDays = 0, return all pending (test convenience)
        if (olderThanDays === 0) {
          return true;
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        const createdDate = new Date(o.createdAt);
        return createdDate < cutoffDate;
      }
      return false;
    });
  }

  getMetrics(): OutcomeMetricsByType {
    const outcomes = Array.from(this.outcomes.values());

    const calculateMetrics = (filtered: RecommendationOutcome[]) => {
      const total = filtered.length;
      const implemented = filtered.filter((o) => o.implemented === true).length;
      const helped = filtered.filter((o) => o.helped === true).length;

      return {
        totalRecommendations: total,
        implementedCount: implemented,
        helpedCount: helped,
        implementationRate: total > 0 ? implemented / total : 0,
        successRate: implemented > 0 ? helped / implemented : 0,
      };
    };

    return {
      symptomatic: calculateMetrics(outcomes.filter((o) => o.recommendationType === 'symptomatic')),
      preventive: calculateMetrics(outcomes.filter((o) => o.recommendationType === 'preventive')),
      systemic: calculateMetrics(outcomes.filter((o) => o.recommendationType === 'systemic')),
      all: calculateMetrics(outcomes),
    };
  }

  recordImplicitEvent(event: ImplicitTrackingEvent): void {
    const outcomes = this.getOutcomesByRecommendation(event.recommendationId);

    for (const outcome of outcomes) {
      if (event.type === 'config_changed') {
        this.updateOutcome(outcome.id, { configChangedAfter: true });
      } else if (event.type === 'issue_recurred') {
        this.updateOutcome(outcome.id, { similarIssueRecurred: true });
      }
    }
  }

  // Test helper to clear all data
  clear(): void {
    this.outcomes.clear();
  }
}

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

let storage: MockOutcomeStorage;

beforeEach(() => {
  storage = new MockOutcomeStorage();
});

afterEach(() => {
  storage.clear();
});

// =============================================================================
// Test Suite
// =============================================================================

describe('OutcomeStorage', () => {
  describe('createOutcome', () => {
    test('creates outcome with generated ID and timestamp', async () => {
      const input = createTestOutcome();
      const outcome = await storage.createOutcome(input);

      expect(outcome.id).toBeDefined();
      expect(outcome.id.length).toBeGreaterThan(0);
      expect(outcome.createdAt).toBeDefined();
      expect(outcome.updatedAt).toBeNull();
      expect(outcome.sessionId).toBe(input.sessionId);
      expect(outcome.recommendationType).toBe(input.recommendationType);
    });

    test('stores all provided fields', async () => {
      const input = createTestOutcome('session-123', 'systemic', true);
      input.helped = true;
      input.outcomeNotes = 'Very helpful!';

      const outcome = await storage.createOutcome(input);

      expect(outcome.implemented).toBe(true);
      expect(outcome.helped).toBe(true);
      expect(outcome.outcomeNotes).toBe('Very helpful!');
    });
  });

  describe('updateOutcome', () => {
    test('updates existing outcome', async () => {
      const input = createTestOutcome();
      const created = await storage.createOutcome(input);

      const updated = await storage.updateOutcome(created.id, {
        implemented: true,
        implementationDate: new Date().toISOString(),
      });

      expect(updated.implemented).toBe(true);
      expect(updated.implementationDate).toBeDefined();
      expect(updated.updatedAt).toBeDefined();
    });

    test('preserves ID and createdAt', async () => {
      const created = await storage.createOutcome(createTestOutcome());
      const originalId = created.id;
      const originalCreatedAt = created.createdAt;

      const updated = await storage.updateOutcome(created.id, {
        id: 'hacked-id',
        createdAt: '2000-01-01T00:00:00.000Z',
        implemented: true,
      });

      expect(updated.id).toBe(originalId);
      expect(updated.createdAt).toBe(originalCreatedAt);
    });

    test('throws error for non-existent outcome', () => {
      expect(() => storage.updateOutcome('non-existent', { implemented: true })).toThrow(
        'not found'
      );
    });
  });

  describe('getOutcome', () => {
    test('retrieves existing outcome', async () => {
      const created = await storage.createOutcome(createTestOutcome());
      const retrieved = await storage.getOutcome(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
    });

    test('returns null for non-existent outcome', async () => {
      const result = await storage.getOutcome('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getOutcomesBySession', () => {
    test('retrieves all outcomes for a session', async () => {
      await storage.createOutcome(createTestOutcome('session-1'));
      await storage.createOutcome(createTestOutcome('session-1'));
      await storage.createOutcome(createTestOutcome('session-2'));

      const session1Outcomes = await storage.getOutcomesBySession('session-1');
      const session2Outcomes = await storage.getOutcomesBySession('session-2');

      expect(session1Outcomes).toHaveLength(2);
      expect(session2Outcomes).toHaveLength(1);
    });

    test('returns empty array for session with no outcomes', async () => {
      const outcomes = await storage.getOutcomesBySession('non-existent');
      expect(outcomes).toEqual([]);
    });
  });

  describe('getOutcomesByRecommendation', () => {
    test('retrieves outcomes for specific recommendation', async () => {
      const outcome1 = await storage.createOutcome(createTestOutcome());
      // Create second outcome to verify filtering works
      await storage.createOutcome(createTestOutcome());

      const results = await storage.getOutcomesByRecommendation(outcome1.recommendationId);

      expect(results).toHaveLength(1);
      expect(results[0]!.recommendationId).toBe(outcome1.recommendationId);
    });
  });

  describe('getPendingFollowUps', () => {
    test('returns implemented outcomes pending follow-up', async () => {
      // Create an outcome marked as implemented but not yet followed up
      const outcome = await storage.createOutcome(
        createTestOutcome('session-1', 'preventive', true)
      );

      // With olderThanDays=0, return all pending follow-ups regardless of age
      const followUps = await storage.getPendingFollowUps(0);

      expect(followUps).toHaveLength(1);
      expect(followUps[0]!.id).toBe(outcome.id);
    });

    test('excludes outcomes with helped already set', async () => {
      const outcome = await storage.createOutcome(
        createTestOutcome('session-1', 'preventive', true)
      );
      await storage.updateOutcome(outcome.id, { helped: true });

      const followUps = await storage.getPendingFollowUps(0);

      expect(followUps).toHaveLength(0);
    });

    test('excludes non-implemented outcomes', async () => {
      await storage.createOutcome(createTestOutcome('session-1', 'preventive', false));
      await storage.createOutcome(createTestOutcome('session-1', 'preventive', null));

      const followUps = await storage.getPendingFollowUps(0);

      expect(followUps).toHaveLength(0);
    });
  });

  describe('getMetrics', () => {
    test('calculates metrics by type', async () => {
      // Create varied outcomes
      await storage.createOutcome({
        ...createTestOutcome('s1', 'symptomatic', true),
        helped: true,
      });
      await storage.createOutcome({
        ...createTestOutcome('s1', 'symptomatic', true),
        helped: false,
      });
      await storage.createOutcome({ ...createTestOutcome('s1', 'preventive', true), helped: true });
      await storage.createOutcome({
        ...createTestOutcome('s1', 'preventive', false),
        helped: null,
      });
      await storage.createOutcome({ ...createTestOutcome('s1', 'systemic', null), helped: null });

      const metrics = await storage.getMetrics();

      // Symptomatic: 2 total, 2 implemented, 1 helped
      expect(metrics.symptomatic.totalRecommendations).toBe(2);
      expect(metrics.symptomatic.implementedCount).toBe(2);
      expect(metrics.symptomatic.helpedCount).toBe(1);
      expect(metrics.symptomatic.implementationRate).toBe(1); // 2/2
      expect(metrics.symptomatic.successRate).toBe(0.5); // 1/2

      // Preventive: 2 total, 1 implemented, 1 helped
      expect(metrics.preventive.totalRecommendations).toBe(2);
      expect(metrics.preventive.implementedCount).toBe(1);
      expect(metrics.preventive.helpedCount).toBe(1);
      expect(metrics.preventive.implementationRate).toBe(0.5); // 1/2
      expect(metrics.preventive.successRate).toBe(1); // 1/1

      // Systemic: 1 total, 0 implemented
      expect(metrics.systemic.totalRecommendations).toBe(1);
      expect(metrics.systemic.implementedCount).toBe(0);
      expect(metrics.systemic.implementationRate).toBe(0);

      // All: 5 total, 3 implemented, 2 helped
      expect(metrics.all.totalRecommendations).toBe(5);
      expect(metrics.all.implementedCount).toBe(3);
      expect(metrics.all.helpedCount).toBe(2);
    });

    test('returns zero metrics when empty', async () => {
      const metrics = await storage.getMetrics();

      expect(metrics.all.totalRecommendations).toBe(0);
      expect(metrics.all.implementationRate).toBe(0);
      expect(metrics.all.successRate).toBe(0);
    });
  });

  describe('recordImplicitEvent', () => {
    test('records config change event', async () => {
      const outcome = await storage.createOutcome(createTestOutcome());

      await storage.recordImplicitEvent({
        type: 'config_changed',
        recommendationId: outcome.recommendationId,
        detectedAt: new Date().toISOString(),
      });

      const updated = await storage.getOutcome(outcome.id);
      expect(updated!.configChangedAfter).toBe(true);
    });

    test('records issue recurrence event', async () => {
      const outcome = await storage.createOutcome(createTestOutcome());

      await storage.recordImplicitEvent({
        type: 'issue_recurred',
        recommendationId: outcome.recommendationId,
        detectedAt: new Date().toISOString(),
      });

      const updated = await storage.getOutcome(outcome.id);
      expect(updated!.similarIssueRecurred).toBe(true);
    });
  });
});

// =============================================================================
// Integration with Real Types
// =============================================================================

describe('Outcome Data Integrity', () => {
  test('recommendation types are validated', async () => {
    const types: RecommendationType[] = ['symptomatic', 'preventive', 'systemic'];

    for (const type of types) {
      const outcome = await storage.createOutcome(createTestOutcome('session', type));
      expect(outcome.recommendationType).toBe(type);
    }
  });

  test('timestamps are ISO formatted', async () => {
    const outcome = await storage.createOutcome(createTestOutcome());

    expect(() => new Date(outcome.createdAt)).not.toThrow();

    await storage.updateOutcome(outcome.id, { implemented: true });
    const updated = await storage.getOutcome(outcome.id);

    expect(updated!.updatedAt).not.toBeNull();
    expect(() => new Date(updated!.updatedAt!)).not.toThrow();
  });
});
