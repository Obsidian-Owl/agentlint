/**
 * Unit tests for get_recommendation_summary tool
 *
 * Tests the get_recommendation_summary SDK tool that returns
 * compressed recommendation views.
 *
 * @module recommendations/__tests__/get-summary.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { getRecommendationSummaryTool, getRecommendationSummary } from '../tools/get-recommendation-summary';
import { saveRecommendation } from '../storage';
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
    action: 'Add error handling guidance to CLAUDE.md',
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
  testDir = join(tmpdir(), `agentlint-summary-test-${Date.now()}`);
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

describe('recommendations/tools/get-recommendation-summary', () => {
  describe('tool definition', () => {
    it('should be named get_recommendation_summary', () => {
      const toolDef = getRecommendationSummaryTool as unknown as { name: string };
      expect(toolDef.name).toBe('get_recommendation_summary');
    });

    it('should have a comprehensive description', () => {
      const toolDef = getRecommendationSummaryTool as unknown as { description: string };
      expect(toolDef.description).toContain('summary');
      expect(toolDef.description).toContain('compressed');
    });

    it('should be defined', () => {
      expect(getRecommendationSummaryTool).toBeDefined();
    });
  });

  describe('getRecommendationSummary function', () => {
    describe('happy path', () => {
      it('should return summary for existing recommendation', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendationSummary(rec.id, { baseDir: recommendationsDir });

        expect(result.success).toBe(true);
        expect(result.summary).toBeDefined();
        expect(result.summary?.id).toBe(rec.id);
      });

      it('should include all summary fields', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendationSummary(rec.id, { baseDir: recommendationsDir });

        expect(result.summary?.type).toBe(rec.type);
        expect(result.summary?.status).toBe(rec.status);
        expect(result.summary?.target).toBe(rec.target);
        expect(result.summary?.priority).toBe(rec.priority);
        expect(result.summary?.eventCount).toBe(1);
      });

      it('should truncate action to actionSummary', async () => {
        const longAction = 'a'.repeat(150);
        const rec = createTestRecommendation({ action: longAction });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendationSummary(rec.id, { baseDir: recommendationsDir });

        expect(result.summary?.actionSummary.length).toBeLessThanOrEqual(103); // 100 + "..."
      });

      it('should include milestones', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendationSummary(rec.id, { baseDir: recommendationsDir });

        expect(result.summary?.milestones.created).toBe(rec.createdAt);
      });
    });

    describe('recommendation not found', () => {
      it('should return success false for non-existent ID', async () => {
        const result = await getRecommendationSummary('non-existent-id', { baseDir: recommendationsDir });

        expect(result.success).toBe(false);
        expect(result.summary).toBeUndefined();
      });

      it('should include error message for non-existent ID', async () => {
        const result = await getRecommendationSummary('non-existent-id', { baseDir: recommendationsDir });

        expect(result.error).toContain('not found');
      });
    });

    describe('event compression', () => {
      it('should show verbatim events for ≤3 events', async () => {
        const events = [
          createTestEvent({ type: 'created', content: 'Created' }),
          createTestEvent({ type: 'observation', content: 'Observed' }),
          createTestEvent({ type: 'evidence', content: 'Evidence' }),
        ];
        const rec = createTestRecommendation({ events });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendationSummary(rec.id, { baseDir: recommendationsDir });

        expect(result.summary?.eventCount).toBe(3);
        expect(result.summary?.recentActivity).toContain('Created');
        expect(result.summary?.recentActivity).toContain('Observed');
        expect(result.summary?.recentActivity).toContain('Evidence');
      });

      it('should show count for 4-10 events', async () => {
        const events = Array.from({ length: 7 }, (_, i) =>
          createTestEvent({ type: 'observation', content: `Event ${i + 1}` })
        );
        events[0] = createTestEvent({ type: 'created', content: 'Created' });

        const rec = createTestRecommendation({ events });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendationSummary(rec.id, { baseDir: recommendationsDir });

        expect(result.summary?.eventCount).toBe(7);
        expect(result.summary?.recentActivity).toContain('+4 earlier events');
      });

      it('should show summary message for >10 events', async () => {
        const events = Array.from({ length: 15 }, (_, i) =>
          createTestEvent({ type: 'observation', content: `Event ${i + 1}` })
        );
        events[0] = createTestEvent({ type: 'created', content: 'Created' });

        const rec = createTestRecommendation({ events });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendationSummary(rec.id, { baseDir: recommendationsDir });

        expect(result.summary?.eventCount).toBe(15);
        expect(result.summary?.recentActivity).toContain('summarized');
      });
    });

    describe('summary size', () => {
      it('should produce summary under 500 chars', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendationSummary(rec.id, { baseDir: recommendationsDir });

        const serialized = JSON.stringify(result.summary);
        expect(serialized.length).toBeLessThan(500);
      });
    });

    describe('lastEventAt and lastEventType', () => {
      it('should populate lastEventAt from most recent event', async () => {
        const events = [
          createTestEvent({ type: 'created', content: 'Created', timestamp: '2026-01-01T00:00:00Z' }),
          createTestEvent({ type: 'observation', content: 'Observed', timestamp: '2026-01-15T00:00:00Z' }),
        ];
        const rec = createTestRecommendation({ events });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendationSummary(rec.id, { baseDir: recommendationsDir });

        expect(result.summary?.lastEventAt).toBe('2026-01-15T00:00:00Z');
        expect(result.summary?.lastEventType).toBe('observation');
      });
    });
  });
});
