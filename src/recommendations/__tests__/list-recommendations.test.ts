/**
 * Unit tests for list_recommendations tool
 *
 * Tests the list_recommendations SDK tool that queries recommendations
 * with filters and limits.
 *
 * @module recommendations/__tests__/list-recommendations.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { listRecommendationsTool, listRecommendations } from '../tools/list-recommendations';
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
  testDir = join(tmpdir(), `agentlint-list-recs-test-${Date.now()}`);
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

describe('recommendations/tools/list-recommendations', () => {
  describe('tool definition', () => {
    it('should be named list_recommendations', () => {
      const toolDef = listRecommendationsTool as unknown as { name: string };
      expect(toolDef.name).toBe('list_recommendations');
    });

    it('should have a comprehensive description', () => {
      const toolDef = listRecommendationsTool as unknown as { description: string };
      expect(toolDef.description).toContain('filter');
      expect(toolDef.description).toContain('recommendation');
    });

    it('should be defined', () => {
      expect(listRecommendationsTool).toBeDefined();
    });
  });

  describe('listRecommendations function', () => {
    describe('basic listing', () => {
      it('should return empty array for empty directory', async () => {
        const result = await listRecommendations({}, { baseDir: recommendationsDir });

        expect(result.success).toBe(true);
        expect(result.recommendations).toEqual([]);
      });

      it('should return all recommendations when no filters', async () => {
        const rec1 = createTestRecommendation();
        const rec2 = createTestRecommendation();
        await saveRecommendation(rec1, { baseDir: recommendationsDir });
        await saveRecommendation(rec2, { baseDir: recommendationsDir });

        const result = await listRecommendations({}, { baseDir: recommendationsDir });

        expect(result.success).toBe(true);
        expect(result.recommendations).toHaveLength(2);
      });

      it('should return recommendations sorted newest-first', async () => {
        const rec1 = createTestRecommendation({ createdAt: '2026-01-01T00:00:00Z' });
        const rec2 = createTestRecommendation({ createdAt: '2026-01-15T00:00:00Z' });
        await saveRecommendation(rec1, { baseDir: recommendationsDir });
        await saveRecommendation(rec2, { baseDir: recommendationsDir });

        const result = await listRecommendations({}, { baseDir: recommendationsDir });

        expect(result.recommendations[0]?.createdAt).toBe('2026-01-15T00:00:00Z');
        expect(result.recommendations[1]?.createdAt).toBe('2026-01-01T00:00:00Z');
      });
    });

    describe('status filter', () => {
      it('should filter by open status', async () => {
        const openRec = createTestRecommendation({ status: 'open' });
        const implementedRec = createTestRecommendation({ status: 'implemented' });
        await saveRecommendation(openRec, { baseDir: recommendationsDir });
        await saveRecommendation(implementedRec, { baseDir: recommendationsDir });

        const result = await listRecommendations({ status: 'open' }, { baseDir: recommendationsDir });

        expect(result.recommendations).toHaveLength(1);
        expect(result.recommendations[0]?.status).toBe('open');
      });

      it('should filter by implemented status', async () => {
        const openRec = createTestRecommendation({ status: 'open' });
        const implementedRec = createTestRecommendation({ status: 'implemented' });
        await saveRecommendation(openRec, { baseDir: recommendationsDir });
        await saveRecommendation(implementedRec, { baseDir: recommendationsDir });

        const result = await listRecommendations({ status: 'implemented' }, { baseDir: recommendationsDir });

        expect(result.recommendations).toHaveLength(1);
        expect(result.recommendations[0]?.status).toBe('implemented');
      });
    });

    describe('type filter', () => {
      it('should filter by preventive type', async () => {
        const preventiveRec = createTestRecommendation({ type: 'preventive' });
        const symptomaticRec = createTestRecommendation({ type: 'symptomatic' });
        await saveRecommendation(preventiveRec, { baseDir: recommendationsDir });
        await saveRecommendation(symptomaticRec, { baseDir: recommendationsDir });

        const result = await listRecommendations({ type: 'preventive' }, { baseDir: recommendationsDir });

        expect(result.recommendations).toHaveLength(1);
        expect(result.recommendations[0]?.type).toBe('preventive');
      });

      it('should filter by systemic type', async () => {
        const preventiveRec = createTestRecommendation({ type: 'preventive' });
        const systemicRec = createTestRecommendation({ type: 'systemic' });
        await saveRecommendation(preventiveRec, { baseDir: recommendationsDir });
        await saveRecommendation(systemicRec, { baseDir: recommendationsDir });

        const result = await listRecommendations({ type: 'systemic' }, { baseDir: recommendationsDir });

        expect(result.recommendations).toHaveLength(1);
        expect(result.recommendations[0]?.type).toBe('systemic');
      });
    });

    describe('priority filter', () => {
      it('should filter by high priority', async () => {
        const highRec = createTestRecommendation({ priority: 'high' });
        const lowRec = createTestRecommendation({ priority: 'low' });
        await saveRecommendation(highRec, { baseDir: recommendationsDir });
        await saveRecommendation(lowRec, { baseDir: recommendationsDir });

        const result = await listRecommendations({ priority: 'high' }, { baseDir: recommendationsDir });

        expect(result.recommendations).toHaveLength(1);
        expect(result.recommendations[0]?.priority).toBe('high');
      });

      it('should filter by medium priority', async () => {
        const highRec = createTestRecommendation({ priority: 'high' });
        const mediumRec = createTestRecommendation({ priority: 'medium' });
        await saveRecommendation(highRec, { baseDir: recommendationsDir });
        await saveRecommendation(mediumRec, { baseDir: recommendationsDir });

        const result = await listRecommendations({ priority: 'medium' }, { baseDir: recommendationsDir });

        expect(result.recommendations).toHaveLength(1);
        expect(result.recommendations[0]?.priority).toBe('medium');
      });
    });

    describe('limit parameter', () => {
      it('should respect limit parameter', async () => {
        for (let i = 0; i < 5; i++) {
          await saveRecommendation(createTestRecommendation(), { baseDir: recommendationsDir });
        }

        const result = await listRecommendations({ limit: 3 }, { baseDir: recommendationsDir });

        expect(result.recommendations).toHaveLength(3);
      });

      it('should return all if limit exceeds count', async () => {
        await saveRecommendation(createTestRecommendation(), { baseDir: recommendationsDir });
        await saveRecommendation(createTestRecommendation(), { baseDir: recommendationsDir });

        const result = await listRecommendations({ limit: 10 }, { baseDir: recommendationsDir });

        expect(result.recommendations).toHaveLength(2);
      });
    });

    describe('combined filters', () => {
      it('should combine status and priority filters', async () => {
        const openHigh = createTestRecommendation({ status: 'open', priority: 'high' });
        const openLow = createTestRecommendation({ status: 'open', priority: 'low' });
        const implementedHigh = createTestRecommendation({ status: 'implemented', priority: 'high' });
        await saveRecommendation(openHigh, { baseDir: recommendationsDir });
        await saveRecommendation(openLow, { baseDir: recommendationsDir });
        await saveRecommendation(implementedHigh, { baseDir: recommendationsDir });

        const result = await listRecommendations(
          { status: 'open', priority: 'high' },
          { baseDir: recommendationsDir }
        );

        expect(result.recommendations).toHaveLength(1);
        expect(result.recommendations[0]?.status).toBe('open');
        expect(result.recommendations[0]?.priority).toBe('high');
      });

      it('should combine type and status filters', async () => {
        const preventiveOpen = createTestRecommendation({ type: 'preventive', status: 'open' });
        const systemicOpen = createTestRecommendation({ type: 'systemic', status: 'open' });
        const preventiveImpl = createTestRecommendation({ type: 'preventive', status: 'implemented' });
        await saveRecommendation(preventiveOpen, { baseDir: recommendationsDir });
        await saveRecommendation(systemicOpen, { baseDir: recommendationsDir });
        await saveRecommendation(preventiveImpl, { baseDir: recommendationsDir });

        const result = await listRecommendations(
          { type: 'preventive', status: 'open' },
          { baseDir: recommendationsDir }
        );

        expect(result.recommendations).toHaveLength(1);
        expect(result.recommendations[0]?.type).toBe('preventive');
        expect(result.recommendations[0]?.status).toBe('open');
      });
    });

    describe('includeCompleted parameter', () => {
      it('should exclude completed by default', async () => {
        const openRec = createTestRecommendation({ status: 'open' });
        const completedRec = createTestRecommendation({
          completedAt: new Date().toISOString(),
          completionReason: 'implemented',
        });
        await saveRecommendation(openRec, { baseDir: recommendationsDir });
        await saveRecommendation(completedRec, { baseDir: recommendationsDir });

        const result = await listRecommendations({ includeCompleted: false }, { baseDir: recommendationsDir });

        expect(result.recommendations).toHaveLength(1);
        expect(result.recommendations[0]?.completedAt).toBeUndefined();
      });

      it('should include completed when requested', async () => {
        const openRec = createTestRecommendation({ status: 'open' });
        const completedRec = createTestRecommendation({
          completedAt: new Date().toISOString(),
          completionReason: 'implemented',
        });
        await saveRecommendation(openRec, { baseDir: recommendationsDir });
        await saveRecommendation(completedRec, { baseDir: recommendationsDir });

        const result = await listRecommendations({ includeCompleted: true }, { baseDir: recommendationsDir });

        expect(result.recommendations).toHaveLength(2);
      });
    });
  });
});
