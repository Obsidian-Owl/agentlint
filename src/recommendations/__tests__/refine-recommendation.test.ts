/**
 * Unit tests for refine_recommendation tool
 *
 * Tests the refine_recommendation SDK tool that updates recommendation
 * fields with audit trail events.
 *
 * @module recommendations/__tests__/refine-recommendation.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { refineRecommendationTool, refineRecommendation } from '../tools/refine-recommendation';
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
  testDir = join(tmpdir(), `agentlint-refine-rec-test-${Date.now()}`);
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

describe('recommendations/tools/refine-recommendation', () => {
  describe('tool definition', () => {
    it('should be named refine_recommendation', () => {
      const toolDef = refineRecommendationTool as unknown as { name: string };
      expect(toolDef.name).toBe('refine_recommendation');
    });

    it('should have a comprehensive description', () => {
      const toolDef = refineRecommendationTool as unknown as { description: string };
      expect(toolDef.description).toContain('Refine');
      expect(toolDef.description).toContain('updating');
    });

    it('should be defined', () => {
      expect(refineRecommendationTool).toBeDefined();
    });
  });

  describe('refineRecommendation function', () => {
    describe('happy path - action update', () => {
      it('should update action field', async () => {
        const rec = createTestRecommendation({ action: 'Old action' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await refineRecommendation(
          { recommendationId: rec.id, action: 'New action' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(true);
        expect(result.recommendation?.action).toBe('New action');
      });

      it('should create refinement event for action change', async () => {
        const rec = createTestRecommendation({ action: 'Old action' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        await refineRecommendation(
          { recommendationId: rec.id, action: 'New action' },
          { baseDir: recommendationsDir }
        );

        const updated = await loadRecommendation(rec.id, { baseDir: recommendationsDir });
        const refinementEvent = updated?.events.find((e) => e.type === 'refinement');

        expect(refinementEvent).toBeDefined();
        expect(refinementEvent?.content).toContain('Action:');
        expect(refinementEvent?.content).toContain('Old action');
        expect(refinementEvent?.content).toContain('New action');
      });

      it('should use arrow format for action change', async () => {
        const rec = createTestRecommendation({ action: 'Old action' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        await refineRecommendation(
          { recommendationId: rec.id, action: 'New action' },
          { baseDir: recommendationsDir }
        );

        const updated = await loadRecommendation(rec.id, { baseDir: recommendationsDir });
        const refinementEvent = updated?.events.find((e) => e.type === 'refinement');

        expect(refinementEvent?.content).toContain('→');
      });
    });

    describe('happy path - target update', () => {
      it('should update target field', async () => {
        const rec = createTestRecommendation({ target: 'CLAUDE.md' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await refineRecommendation(
          { recommendationId: rec.id, target: '.cursor/rules' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(true);
        expect(result.recommendation?.target).toBe('.cursor/rules');
      });

      it('should create refinement event for target change', async () => {
        const rec = createTestRecommendation({ target: 'CLAUDE.md' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        await refineRecommendation(
          { recommendationId: rec.id, target: '.cursor/rules' },
          { baseDir: recommendationsDir }
        );

        const updated = await loadRecommendation(rec.id, { baseDir: recommendationsDir });
        const refinementEvent = updated?.events.find((e) => e.type === 'refinement');

        expect(refinementEvent?.content).toContain('Target:');
        expect(refinementEvent?.content).toContain('CLAUDE.md');
        expect(refinementEvent?.content).toContain('.cursor/rules');
      });
    });

    describe('happy path - priority update', () => {
      it('should update priority field', async () => {
        const rec = createTestRecommendation({ priority: 'low' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await refineRecommendation(
          { recommendationId: rec.id, priority: 'high' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(true);
        expect(result.recommendation?.priority).toBe('high');
      });

      it('should create refinement event for priority change', async () => {
        const rec = createTestRecommendation({ priority: 'low' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        await refineRecommendation(
          { recommendationId: rec.id, priority: 'high' },
          { baseDir: recommendationsDir }
        );

        const updated = await loadRecommendation(rec.id, { baseDir: recommendationsDir });
        const refinementEvent = updated?.events.find((e) => e.type === 'refinement');

        expect(refinementEvent?.content).toContain('Priority:');
        expect(refinementEvent?.content).toContain('low');
        expect(refinementEvent?.content).toContain('high');
      });
    });

    describe('multiple field updates', () => {
      it('should update multiple fields at once', async () => {
        const rec = createTestRecommendation({
          action: 'Old action',
          target: 'CLAUDE.md',
          priority: 'low',
        });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await refineRecommendation(
          {
            recommendationId: rec.id,
            action: 'New action',
            target: '.cursor/rules',
            priority: 'high',
          },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(true);
        expect(result.recommendation?.action).toBe('New action');
        expect(result.recommendation?.target).toBe('.cursor/rules');
        expect(result.recommendation?.priority).toBe('high');
      });

      it('should create single refinement event for multiple changes', async () => {
        const rec = createTestRecommendation({
          action: 'Old action',
          priority: 'low',
        });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        await refineRecommendation(
          {
            recommendationId: rec.id,
            action: 'New action',
            priority: 'high',
          },
          { baseDir: recommendationsDir }
        );

        const updated = await loadRecommendation(rec.id, { baseDir: recommendationsDir });
        const refinementEvents = updated?.events.filter((e) => e.type === 'refinement');

        // Single event for all changes
        expect(refinementEvents).toHaveLength(1);
        expect(refinementEvents?.[0]?.content).toContain('Action:');
        expect(refinementEvents?.[0]?.content).toContain('Priority:');
      });
    });

    describe('recommendation not found', () => {
      it('should return success false for non-existent ID', async () => {
        const result = await refineRecommendation(
          { recommendationId: 'non-existent-id', action: 'New action' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(false);
        expect(result.recommendation).toBeUndefined();
      });

      it('should include error message for non-existent ID', async () => {
        const result = await refineRecommendation(
          { recommendationId: 'non-existent-id', action: 'New action' },
          { baseDir: recommendationsDir }
        );

        expect(result.error).toContain('not found');
      });
    });

    describe('completed recommendation validation', () => {
      it('should reject refinement of completed recommendations', async () => {
        const rec = createTestRecommendation({
          completedAt: new Date().toISOString(),
          completionReason: 'implemented',
        });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await refineRecommendation(
          { recommendationId: rec.id, action: 'New action' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('completed');
      });

      it('should not modify completed recommendation', async () => {
        const originalAction = 'Original action';
        const rec = createTestRecommendation({
          action: originalAction,
          completedAt: new Date().toISOString(),
          completionReason: 'implemented',
        });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        await refineRecommendation(
          { recommendationId: rec.id, action: 'New action' },
          { baseDir: recommendationsDir }
        );

        const unchanged = await loadRecommendation(rec.id, { baseDir: recommendationsDir });
        expect(unchanged?.action).toBe(originalAction);
      });
    });

    describe('no changes provided', () => {
      it('should return success with unchanged recommendation when no fields provided', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await refineRecommendation(
          { recommendationId: rec.id },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(true);
        expect(result.recommendation?.action).toBe(rec.action);
      });

      it('should not create refinement event when no changes', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });
        const originalEventCount = rec.events.length;

        await refineRecommendation({ recommendationId: rec.id }, { baseDir: recommendationsDir });

        const unchanged = await loadRecommendation(rec.id, { baseDir: recommendationsDir });
        expect(unchanged?.events.length).toBe(originalEventCount);
      });
    });

    describe('same value update', () => {
      it('should not create event when value unchanged', async () => {
        const rec = createTestRecommendation({ action: 'Same action' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });
        const originalEventCount = rec.events.length;

        await refineRecommendation(
          { recommendationId: rec.id, action: 'Same action' },
          { baseDir: recommendationsDir }
        );

        const unchanged = await loadRecommendation(rec.id, { baseDir: recommendationsDir });
        expect(unchanged?.events.length).toBe(originalEventCount);
      });
    });

    describe('persistence', () => {
      it('should persist changes to storage', async () => {
        const rec = createTestRecommendation({ action: 'Old action' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        await refineRecommendation(
          { recommendationId: rec.id, action: 'New action' },
          { baseDir: recommendationsDir }
        );

        const persisted = await loadRecommendation(rec.id, { baseDir: recommendationsDir });
        expect(persisted?.action).toBe('New action');
      });
    });
  });
});
