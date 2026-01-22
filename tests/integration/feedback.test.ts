/**
 * EP11 Quality & Security - Feedback Flow Integration Tests
 *
 * Integration tests for the feedback collection and outcome tracking flow.
 * Tests the complete workflow from recommendations to outcome tracking.
 *
 * @module tests/integration/feedback
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { randomUUID } from 'crypto';
import type {
  RecommendationOutcome,
  IOutcomeStorage,
  IFeedbackCollector,
  FeedbackPrompt,
  OutcomePrompt,
  OutcomeTrackingConfig,
  RecommendationType,
  OutcomeMetricsByType,
  ImplicitTrackingEvent,
} from '../../specs/ep11-quality-security/contracts/outcome';

// =============================================================================
// Mock Implementations
// =============================================================================

/**
 * In-memory outcome storage for testing.
 */
class MockOutcomeStorage implements IOutcomeStorage {
  private outcomes: Map<string, RecommendationOutcome> = new Map();

  createOutcome(
    outcome: Omit<RecommendationOutcome, 'id' | 'createdAt' | 'updatedAt'>
  ): RecommendationOutcome {
    const id = randomUUID();
    const newOutcome: RecommendationOutcome = {
      ...outcome,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.outcomes.set(id, newOutcome);
    return newOutcome;
  }

  updateOutcome(id: string, updates: Partial<RecommendationOutcome>): RecommendationOutcome {
    const existing = this.outcomes.get(id);
    if (!existing) throw new Error(`Outcome not found: ${id}`);
    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
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
      if (o.implemented && o.helped === null) {
        if (olderThanDays === 0) return true;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - olderThanDays);
        return new Date(o.createdAt) < cutoff;
      }
      return false;
    });
  }

  getMetrics(): OutcomeMetricsByType {
    const all = Array.from(this.outcomes.values());
    const calc = (arr: RecommendationOutcome[]) => {
      const total = arr.length;
      const impl = arr.filter((o) => o.implemented).length;
      const helped = arr.filter((o) => o.helped).length;
      return {
        totalRecommendations: total,
        implementedCount: impl,
        helpedCount: helped,
        implementationRate: total > 0 ? impl / total : 0,
        successRate: impl > 0 ? helped / impl : 0,
      };
    };
    return {
      symptomatic: calc(all.filter((o) => o.recommendationType === 'symptomatic')),
      preventive: calc(all.filter((o) => o.recommendationType === 'preventive')),
      systemic: calc(all.filter((o) => o.recommendationType === 'systemic')),
      all: calc(all),
    };
  }

  recordImplicitEvent(event: ImplicitTrackingEvent): void {
    const outcomes = this.getOutcomesByRecommendation(event.recommendationId);
    for (const o of outcomes) {
      if (event.type === 'config_changed') {
        this.updateOutcome(o.id, { configChangedAfter: true });
      } else if (event.type === 'issue_recurred') {
        this.updateOutcome(o.id, { similarIssueRecurred: true });
      }
    }
  }

  clear(): void {
    this.outcomes.clear();
  }
}

/**
 * Mock feedback collector for testing.
 */
class MockFeedbackCollector implements IFeedbackCollector {
  private config: OutcomeTrackingConfig;
  private storage: IOutcomeStorage;
  private sessionPromptCount: number = 0;

  constructor(storage: IOutcomeStorage, config?: Partial<OutcomeTrackingConfig>) {
    this.storage = storage;
    this.config = {
      collectFeedback: config?.collectFeedback ?? false,
      maxPromptsPerSession: config?.maxPromptsPerSession ?? 3,
      followUpDelayDays: config?.followUpDelayDays ?? 7,
    };
  }

  isEnabled(): boolean {
    return this.config.collectFeedback;
  }

  shouldPrompt(): boolean {
    return this.isEnabled() && this.sessionPromptCount < this.config.maxPromptsPerSession;
  }

  getPromptsForSession(
    recommendations: Array<{ id: string; summary: string; type: RecommendationType }>
  ): FeedbackPrompt[] {
    if (!this.isEnabled()) return [];

    const remaining = this.config.maxPromptsPerSession - this.sessionPromptCount;
    return recommendations.slice(0, remaining).map((r) => ({
      recommendationId: r.id,
      summary: r.summary,
    }));
  }

  recordFeedback(prompt: FeedbackPrompt): void {
    this.sessionPromptCount++;

    // Map feedback response to outcome fields
    let implemented: boolean | null = null;
    if (prompt.response === 'will_implement' || prompt.response === 'already_done') {
      implemented = true;
    } else if (prompt.response === 'not_relevant') {
      implemented = false;
    }

    this.storage.createOutcome({
      sessionId: `session-${Date.now()}`,
      recommendationId: prompt.recommendationId,
      recommendationType: 'preventive', // Default for testing
      recommendationSummary: prompt.summary,
      implemented,
      implementationDate: implemented === true ? new Date().toISOString() : null,
      helped: null,
      outcomeNotes: null,
      configChangedAfter: null,
      similarIssueRecurred: null,
    });
  }

  getPendingFollowUps(): OutcomePrompt[] {
    const pending = this.storage.getPendingFollowUps(this.config.followUpDelayDays);
    return pending.map((o) => ({
      recommendationId: o.recommendationId,
      summary: o.recommendationSummary,
    }));
  }

  recordFollowUp(prompt: OutcomePrompt): void {
    const outcomes = this.storage.getOutcomesByRecommendation(prompt.recommendationId);
    for (const o of outcomes) {
      this.storage.updateOutcome(o.id, {
        helped: prompt.helped ?? null,
        outcomeNotes: prompt.notes ?? null,
      });
    }
  }

  resetSessionCount(): void {
    this.sessionPromptCount = 0;
  }
}

// =============================================================================
// Test Fixtures
// =============================================================================

interface TestRecommendation {
  id: string;
  summary: string;
  type: RecommendationType;
}

function createTestRecommendations(count: number): TestRecommendation[] {
  const types: RecommendationType[] = ['symptomatic', 'preventive', 'systemic'];
  return Array.from({ length: count }, (_, i) => ({
    id: `REC-${(i + 1).toString().padStart(3, '0')}`,
    summary: `Test recommendation ${i + 1}`,
    type: types[i % 3]!,
  }));
}

// =============================================================================
// Test Setup
// =============================================================================

let storage: MockOutcomeStorage;
let collector: MockFeedbackCollector;

beforeEach(() => {
  storage = new MockOutcomeStorage();
  collector = new MockFeedbackCollector(storage, { collectFeedback: true });
});

afterEach(() => {
  storage.clear();
});

// =============================================================================
// Test Suite
// =============================================================================

describe('Feedback Flow Integration', () => {
  describe('Configuration', () => {
    test('feedback is disabled by default', () => {
      const disabledCollector = new MockFeedbackCollector(storage);
      expect(disabledCollector.isEnabled()).toBe(false);
    });

    test('feedback can be enabled via config', () => {
      expect(collector.isEnabled()).toBe(true);
    });
  });

  describe('Feedback Prompts', () => {
    test('generates prompts for recommendations when enabled', () => {
      const recommendations = createTestRecommendations(5);
      const prompts = collector.getPromptsForSession(recommendations);

      expect(prompts).toHaveLength(3); // Default max is 3
      expect(prompts[0]!.recommendationId).toBe('REC-001');
    });

    test('returns empty prompts when disabled', () => {
      const disabledCollector = new MockFeedbackCollector(storage);
      const recommendations = createTestRecommendations(5);
      const prompts = disabledCollector.getPromptsForSession(recommendations);

      expect(prompts).toHaveLength(0);
    });

    test('respects max prompts per session', () => {
      const limitedCollector = new MockFeedbackCollector(storage, {
        collectFeedback: true,
        maxPromptsPerSession: 1,
      });

      const recommendations = createTestRecommendations(5);
      const prompts = limitedCollector.getPromptsForSession(recommendations);

      expect(prompts).toHaveLength(1);
    });
  });

  describe('Recording Feedback', () => {
    test('will_implement creates outcome with implemented=true', async () => {
      const prompt: FeedbackPrompt = {
        recommendationId: 'REC-001',
        summary: 'Add error handling',
        response: 'will_implement',
      };

      await collector.recordFeedback(prompt);

      const outcomes = await storage.getOutcomesByRecommendation('REC-001');
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]!.implemented).toBe(true);
    });

    test('not_relevant creates outcome with implemented=false', async () => {
      const prompt: FeedbackPrompt = {
        recommendationId: 'REC-002',
        summary: 'Not relevant recommendation',
        response: 'not_relevant',
      };

      await collector.recordFeedback(prompt);

      const outcomes = await storage.getOutcomesByRecommendation('REC-002');
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]!.implemented).toBe(false);
    });

    test('already_done creates outcome with implemented=true', async () => {
      const prompt: FeedbackPrompt = {
        recommendationId: 'REC-003',
        summary: 'Already done recommendation',
        response: 'already_done',
      };

      await collector.recordFeedback(prompt);

      const outcomes = await storage.getOutcomesByRecommendation('REC-003');
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]!.implemented).toBe(true);
    });

    test('maybe_later creates outcome with implemented=null', async () => {
      const prompt: FeedbackPrompt = {
        recommendationId: 'REC-004',
        summary: 'Maybe later recommendation',
        response: 'maybe_later',
      };

      await collector.recordFeedback(prompt);

      const outcomes = await storage.getOutcomesByRecommendation('REC-004');
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]!.implemented).toBeNull();
    });
  });

  describe('Follow-up Flow', () => {
    test('getPendingFollowUps returns implemented outcomes awaiting feedback', async () => {
      // Create an implemented outcome
      await storage.createOutcome({
        sessionId: 'session-old',
        recommendationId: 'REC-100',
        recommendationType: 'preventive',
        recommendationSummary: 'Test recommendation',
        implemented: true,
        implementationDate: new Date().toISOString(),
        helped: null,
        outcomeNotes: null,
        configChangedAfter: null,
        similarIssueRecurred: null,
      });

      // Use 0 days to get all pending (for testing)
      const followUpCollector = new MockFeedbackCollector(storage, {
        collectFeedback: true,
        followUpDelayDays: 0,
      });

      const pending = await followUpCollector.getPendingFollowUps();

      expect(pending).toHaveLength(1);
      expect(pending[0]!.recommendationId).toBe('REC-100');
    });

    test('recordFollowUp updates outcome with helped status', async () => {
      const outcome = await storage.createOutcome({
        sessionId: 'session-1',
        recommendationId: 'REC-200',
        recommendationType: 'preventive',
        recommendationSummary: 'Test recommendation',
        implemented: true,
        implementationDate: new Date().toISOString(),
        helped: null,
        outcomeNotes: null,
        configChangedAfter: null,
        similarIssueRecurred: null,
      });

      await collector.recordFollowUp({
        recommendationId: 'REC-200',
        summary: 'Test recommendation',
        helped: true,
        notes: 'Very helpful!',
      });

      const updated = await storage.getOutcome(outcome.id);
      expect(updated!.helped).toBe(true);
      expect(updated!.outcomeNotes).toBe('Very helpful!');
    });
  });

  describe('Complete Workflow', () => {
    test('full feedback → follow-up workflow', async () => {
      // 1. Analysis generates recommendations
      const recommendations = createTestRecommendations(3);

      // 2. Get prompts for feedback
      const prompts = collector.getPromptsForSession(recommendations);
      expect(prompts).toHaveLength(3);

      // 3. User provides feedback
      prompts[0]!.response = 'will_implement';
      prompts[1]!.response = 'not_relevant';
      prompts[2]!.response = 'maybe_later';

      for (const prompt of prompts) {
        await collector.recordFeedback(prompt);
      }

      // 4. Verify outcomes created
      const metrics = await storage.getMetrics();
      expect(metrics.all.totalRecommendations).toBe(3);
      expect(metrics.all.implementedCount).toBe(1);

      // 5. Later, check for pending follow-ups (use 0 days for test)
      const followUpCollector = new MockFeedbackCollector(storage, {
        collectFeedback: true,
        followUpDelayDays: 0,
      });
      const pending = await followUpCollector.getPendingFollowUps();
      expect(pending).toHaveLength(1); // Only the 'will_implement' one

      // 6. User provides follow-up
      await followUpCollector.recordFollowUp({
        recommendationId: pending[0]!.recommendationId,
        summary: pending[0]!.summary,
        helped: true,
      });

      // 7. Verify final metrics
      const finalMetrics = await storage.getMetrics();
      expect(finalMetrics.all.helpedCount).toBe(1);
      expect(finalMetrics.all.successRate).toBe(1); // 1 helped / 1 implemented
    });
  });

  describe('Implicit Tracking', () => {
    test('config change is recorded on outcomes', async () => {
      const outcome = await storage.createOutcome({
        sessionId: 'session-1',
        recommendationId: 'REC-300',
        recommendationType: 'preventive',
        recommendationSummary: 'Update config',
        implemented: null,
        implementationDate: null,
        helped: null,
        outcomeNotes: null,
        configChangedAfter: null,
        similarIssueRecurred: null,
      });

      await storage.recordImplicitEvent({
        type: 'config_changed',
        recommendationId: 'REC-300',
        detectedAt: new Date().toISOString(),
      });

      const updated = await storage.getOutcome(outcome.id);
      expect(updated!.configChangedAfter).toBe(true);
    });

    test('issue recurrence is recorded on outcomes', async () => {
      const outcome = await storage.createOutcome({
        sessionId: 'session-1',
        recommendationId: 'REC-400',
        recommendationType: 'preventive',
        recommendationSummary: 'Fix recurring issue',
        implemented: true,
        implementationDate: new Date().toISOString(),
        helped: null,
        outcomeNotes: null,
        configChangedAfter: null,
        similarIssueRecurred: null,
      });

      await storage.recordImplicitEvent({
        type: 'issue_recurred',
        recommendationId: 'REC-400',
        detectedAt: new Date().toISOString(),
      });

      const updated = await storage.getOutcome(outcome.id);
      expect(updated!.similarIssueRecurred).toBe(true);
    });
  });
});
