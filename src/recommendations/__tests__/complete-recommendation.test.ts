/**
 * Unit tests for complete_recommendation tool
 *
 * Tests the complete_recommendation SDK tool that soft-closes
 * recommendations with completion reason.
 *
 * @module recommendations/__tests__/complete-recommendation.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { completeRecommendationTool, completeRecommendation } from '../tools/complete-recommendation';
import { saveRecommendation, loadRecommendation } from '../storage';
import type { Recommendation, RecommendationEvent } from '../types';

// =============================================================================
// Test Setup
// =============================================================================

let testDir: string;
let recommendationsDir: string;

function createTestEvent(overrides: Partial<RecommendationEvent> = {}): RecommendationEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'created',
    content: 'Initial recommendation created',
    ...overrides,
  };
}

function createTestRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: crypto.randomUUID(),
    projectPath: '/test/project',
    createdAt: new Date().toISOString(),
    type: 'preventive',
    action: 'Add error handling guidance',
    target: 'CLAUDE.md',
    rationale: 'Session logs show repeated errors.',
    priority: 'high',
    tracedOrigin: {
      sessionId: 'session-123',
      configGap: 'Missing error handling',
    },
    status: 'open',
    events: [createTestEvent()],
    ...overrides,
  };
}

beforeEach(() => {
  testDir = join(tmpdir(), `agentlint-complete-rec-test-${Date.now()}`);
  recommendationsDir = join(testDir, '.agentlint', 'recommendations');
  mkdirSync(recommendationsDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

// =============================================================================
// Tests
// =============================================================================

describe('recommendations/tools/complete-recommendation', () => {
  describe('tool definition', () => {
    it('should be named complete_recommendation', () => {
      const toolDef = completeRecommendationTool as unknown as { name: string };
      expect(toolDef.name).toBe('complete_recommendation');
    });

    it('should have a comprehensive description', () => {
      const toolDef = completeRecommendationTool as unknown as { description: string };
      expect(toolDef.description).toContain('complete');
      expect(toolDef.description).toContain('close');
    });

    it('should be defined', () => {
      expect(completeRecommendationTool).toBeDefined();
    });
  });

  describe('completeRecommendation function', () => {
    describe('happy path - implemented', () => {
      it('should set completedAt timestamp', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const beforeComplete = Date.now();
        const result = await completeRecommendation(
          { recommendationId: rec.id, reason: 'implemented' },
          { baseDir: recommendationsDir }
        );
        const afterComplete = Date.now();

        expect(result.success).toBe(true);
        const completedAt = new Date(result.recommendation!.completedAt!).getTime();
        expect(completedAt).toBeGreaterThanOrEqual(beforeComplete);
        expect(completedAt).toBeLessThanOrEqual(afterComplete);
      });

      it('should set completionReason to implemented', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await completeRecommendation(
          { recommendationId: rec.id, reason: 'implemented' },
          { baseDir: recommendationsDir }
        );

        expect(result.recommendation?.completionReason).toBe('implemented');
      });

      it('should create completed event', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        await completeRecommendation(
          { recommendationId: rec.id, reason: 'implemented' },
          { baseDir: recommendationsDir }
        );

        const updated = await loadRecommendation(rec.id, { baseDir: recommendationsDir });
        const completedEvent = updated?.events.find((e) => e.type === 'completed');

        expect(completedEvent).toBeDefined();
        expect(completedEvent?.content).toContain('implemented');
      });
    });

    describe('completion reasons', () => {
      it('should accept superseded reason', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await completeRecommendation(
          { recommendationId: rec.id, reason: 'superseded' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(true);
        expect(result.recommendation?.completionReason).toBe('superseded');
      });

      it('should accept obsolete reason', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await completeRecommendation(
          { recommendationId: rec.id, reason: 'obsolete' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(true);
        expect(result.recommendation?.completionReason).toBe('obsolete');
      });

      it('should accept rejected reason', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await completeRecommendation(
          { recommendationId: rec.id, reason: 'rejected' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(true);
        expect(result.recommendation?.completionReason).toBe('rejected');
      });
    });

    describe('supersededBy link', () => {
      it('should set supersededBy when provided', async () => {
        const rec = createTestRecommendation();
        const newRec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });
        await saveRecommendation(newRec, { baseDir: recommendationsDir });

        const result = await completeRecommendation(
          { recommendationId: rec.id, reason: 'superseded', supersededBy: newRec.id },
          { baseDir: recommendationsDir }
        );

        expect(result.recommendation?.supersededBy).toBe(newRec.id);
      });

      it('should include supersededBy in completed event', async () => {
        const rec = createTestRecommendation();
        const newRec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });
        await saveRecommendation(newRec, { baseDir: recommendationsDir });

        await completeRecommendation(
          { recommendationId: rec.id, reason: 'superseded', supersededBy: newRec.id },
          { baseDir: recommendationsDir }
        );

        const updated = await loadRecommendation(rec.id, { baseDir: recommendationsDir });
        const completedEvent = updated?.events.find((e) => e.type === 'completed');

        expect(completedEvent?.content).toContain(newRec.id.slice(0, 8));
      });
    });

    describe('recommendation not found', () => {
      it('should return success false for non-existent ID', async () => {
        const result = await completeRecommendation(
          { recommendationId: 'non-existent-id', reason: 'implemented' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(false);
        expect(result.recommendation).toBeUndefined();
      });

      it('should include error message for non-existent ID', async () => {
        const result = await completeRecommendation(
          { recommendationId: 'non-existent-id', reason: 'implemented' },
          { baseDir: recommendationsDir }
        );

        expect(result.error).toContain('not found');
      });
    });

    describe('already completed', () => {
      it('should reject completing an already completed recommendation', async () => {
        const rec = createTestRecommendation({
          completedAt: new Date().toISOString(),
          completionReason: 'implemented',
        });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await completeRecommendation(
          { recommendationId: rec.id, reason: 'rejected' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('already completed');
      });
    });

    describe('persistence', () => {
      it('should persist completion to storage', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        await completeRecommendation(
          { recommendationId: rec.id, reason: 'implemented' },
          { baseDir: recommendationsDir }
        );

        const persisted = await loadRecommendation(rec.id, { baseDir: recommendationsDir });
        expect(persisted?.completedAt).toBeDefined();
        expect(persisted?.completionReason).toBe('implemented');
      });
    });

    describe('filter behavior', () => {
      it('should set completedAt which excludes from open filter', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await completeRecommendation(
          { recommendationId: rec.id, reason: 'implemented' },
          { baseDir: recommendationsDir }
        );

        // completedAt being set is what list_recommendations uses to filter
        expect(result.recommendation?.completedAt).toBeDefined();
      });
    });
  });
});
