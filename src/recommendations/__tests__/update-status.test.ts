/**
 * Unit tests for update_recommendation_status tool
 *
 * Tests the update_recommendation_status SDK tool that transitions
 * recommendation status with validation.
 *
 * @module recommendations/__tests__/update-status.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { updateRecommendationStatusTool, updateRecommendationStatus } from '../tools/update-status';
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
  testDir = join(tmpdir(), `agentlint-update-status-test-${Date.now()}`);
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

describe('recommendations/tools/update-status', () => {
  describe('tool definition', () => {
    it('should be named update_recommendation_status', () => {
      const toolDef = updateRecommendationStatusTool as unknown as { name: string };
      expect(toolDef.name).toBe('update_recommendation_status');
    });

    it('should have a comprehensive description', () => {
      const toolDef = updateRecommendationStatusTool as unknown as { description: string };
      expect(toolDef.description).toContain('status');
      expect(toolDef.description).toContain('transition');
    });

    it('should be defined', () => {
      expect(updateRecommendationStatusTool).toBeDefined();
    });
  });

  describe('updateRecommendationStatus function', () => {
    describe('valid transitions', () => {
      it('should transition from open to pending_confirmation', async () => {
        const rec = createTestRecommendation({ status: 'open' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await updateRecommendationStatus(
          { recommendationId: rec.id, status: 'pending_confirmation' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(true);
        expect(result.recommendation?.status).toBe('pending_confirmation');
      });

      it('should transition from pending_confirmation to implemented', async () => {
        const rec = createTestRecommendation({ status: 'pending_confirmation' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await updateRecommendationStatus(
          { recommendationId: rec.id, status: 'implemented' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(true);
        expect(result.recommendation?.status).toBe('implemented');
      });

      it('should transition from implemented to monitoring', async () => {
        const rec = createTestRecommendation({ status: 'implemented' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await updateRecommendationStatus(
          { recommendationId: rec.id, status: 'monitoring' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(true);
        expect(result.recommendation?.status).toBe('monitoring');
      });

      it('should allow open to implemented (fast-track)', async () => {
        const rec = createTestRecommendation({ status: 'open' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await updateRecommendationStatus(
          { recommendationId: rec.id, status: 'implemented' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(true);
        expect(result.recommendation?.status).toBe('implemented');
      });

      it('should allow pending_confirmation back to open', async () => {
        const rec = createTestRecommendation({ status: 'pending_confirmation' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await updateRecommendationStatus(
          { recommendationId: rec.id, status: 'open' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(true);
        expect(result.recommendation?.status).toBe('open');
      });
    });

    describe('status_change event', () => {
      it('should create status_change event', async () => {
        const rec = createTestRecommendation({ status: 'open' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        await updateRecommendationStatus(
          { recommendationId: rec.id, status: 'pending_confirmation' },
          { baseDir: recommendationsDir }
        );

        const updated = await loadRecommendation(rec.id, { baseDir: recommendationsDir });
        const statusEvent = updated?.events.find((e) => e.type === 'status_change');

        expect(statusEvent).toBeDefined();
        expect(statusEvent?.content).toContain('open');
        expect(statusEvent?.content).toContain('pending_confirmation');
      });

      it('should use arrow format in status_change content', async () => {
        const rec = createTestRecommendation({ status: 'open' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        await updateRecommendationStatus(
          { recommendationId: rec.id, status: 'implemented' },
          { baseDir: recommendationsDir }
        );

        const updated = await loadRecommendation(rec.id, { baseDir: recommendationsDir });
        const statusEvent = updated?.events.find((e) => e.type === 'status_change');

        expect(statusEvent?.content).toContain('→');
      });
    });

    describe('recommendation not found', () => {
      it('should return success false for non-existent ID', async () => {
        const result = await updateRecommendationStatus(
          { recommendationId: 'non-existent-id', status: 'implemented' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(false);
        expect(result.recommendation).toBeUndefined();
      });

      it('should include error message for non-existent ID', async () => {
        const result = await updateRecommendationStatus(
          { recommendationId: 'non-existent-id', status: 'implemented' },
          { baseDir: recommendationsDir }
        );

        expect(result.error).toContain('not found');
      });
    });

    describe('completed recommendation', () => {
      it('should reject status change for completed recommendations', async () => {
        const rec = createTestRecommendation({
          completedAt: new Date().toISOString(),
          completionReason: 'implemented',
        });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await updateRecommendationStatus(
          { recommendationId: rec.id, status: 'monitoring' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('completed');
      });
    });

    describe('same status', () => {
      it('should return success but not create event when status unchanged', async () => {
        const rec = createTestRecommendation({ status: 'open' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });
        const originalEventCount = rec.events.length;

        const result = await updateRecommendationStatus(
          { recommendationId: rec.id, status: 'open' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(true);
        const unchanged = await loadRecommendation(rec.id, { baseDir: recommendationsDir });
        expect(unchanged?.events.length).toBe(originalEventCount);
      });
    });

    describe('persistence', () => {
      it('should persist status change to storage', async () => {
        const rec = createTestRecommendation({ status: 'open' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        await updateRecommendationStatus(
          { recommendationId: rec.id, status: 'implemented' },
          { baseDir: recommendationsDir }
        );

        const persisted = await loadRecommendation(rec.id, { baseDir: recommendationsDir });
        expect(persisted?.status).toBe('implemented');
      });
    });
  });
});
