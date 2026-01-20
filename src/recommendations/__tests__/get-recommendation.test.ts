/**
 * Unit tests for get_recommendation tool
 *
 * Tests the get_recommendation SDK tool that retrieves full recommendation cases
 * with all events.
 *
 * @module recommendations/__tests__/get-recommendation.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { getRecommendationTool, getRecommendation } from '../tools/get-recommendation';
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
    rationale: 'Session logs show repeated errors. Adding guidance prevents recurrence.',
    priority: 'high',
    tracedOrigin: {
      sessionId: 'session-123',
      configGap: 'Missing error handling instructions',
    },
    status: 'open',
    events: [createTestEvent()],
    ...overrides,
  };
}

beforeEach(() => {
  testDir = join(tmpdir(), `agentlint-get-rec-test-${Date.now()}`);
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

describe('recommendations/tools/get-recommendation', () => {
  describe('tool definition', () => {
    it('should be named get_recommendation', () => {
      const toolDef = getRecommendationTool as unknown as { name: string };
      expect(toolDef.name).toBe('get_recommendation');
    });

    it('should have a comprehensive description', () => {
      const toolDef = getRecommendationTool as unknown as { description: string };
      expect(toolDef.description).toContain('recommendation');
      expect(toolDef.description).toContain('events');
    });

    it('should be defined', () => {
      expect(getRecommendationTool).toBeDefined();
    });
  });

  describe('getRecommendation function', () => {
    describe('happy path', () => {
      it('should retrieve existing recommendation by ID', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendation(rec.id, { baseDir: recommendationsDir });

        expect(result.success).toBe(true);
        expect(result.recommendation?.id).toBe(rec.id);
      });

      it('should return full recommendation with all fields', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendation(rec.id, { baseDir: recommendationsDir });

        expect(result.recommendation?.type).toBe(rec.type);
        expect(result.recommendation?.action).toBe(rec.action);
        expect(result.recommendation?.target).toBe(rec.target);
        expect(result.recommendation?.rationale).toBe(rec.rationale);
        expect(result.recommendation?.priority).toBe(rec.priority);
        expect(result.recommendation?.status).toBe(rec.status);
      });

      it('should include all events', async () => {
        const events = [
          createTestEvent({ type: 'created', content: 'Created' }),
          createTestEvent({ type: 'observation', content: 'Observed change' }),
          createTestEvent({ type: 'evidence', content: 'Added evidence' }),
        ];
        const rec = createTestRecommendation({ events });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendation(rec.id, { baseDir: recommendationsDir });

        expect(result.recommendation?.events).toHaveLength(3);
        expect(result.recommendation?.events[0]?.type).toBe('created');
        expect(result.recommendation?.events[1]?.type).toBe('observation');
        expect(result.recommendation?.events[2]?.type).toBe('evidence');
      });

      it('should include traced origin', async () => {
        const rec = createTestRecommendation({
          tracedOrigin: {
            findingId: crypto.randomUUID(),
            sessionId: 'session-456',
            configGap: 'Missing config',
            pattern: 'Recurring pattern',
          },
        });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendation(rec.id, { baseDir: recommendationsDir });

        expect(result.recommendation?.tracedOrigin).toEqual(rec.tracedOrigin);
      });
    });

    describe('recommendation not found', () => {
      it('should return success false for non-existent ID', async () => {
        const result = await getRecommendation('non-existent-id', { baseDir: recommendationsDir });

        expect(result.success).toBe(false);
        expect(result.recommendation).toBeUndefined();
      });

      it('should include error message for non-existent ID', async () => {
        const result = await getRecommendation('non-existent-id', { baseDir: recommendationsDir });

        expect(result.error).toContain('not found');
      });
    });

    describe('different statuses', () => {
      it('should retrieve open recommendation', async () => {
        const rec = createTestRecommendation({ status: 'open' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendation(rec.id, { baseDir: recommendationsDir });

        expect(result.recommendation?.status).toBe('open');
      });

      it('should retrieve pending_confirmation recommendation', async () => {
        const rec = createTestRecommendation({ status: 'pending_confirmation' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendation(rec.id, { baseDir: recommendationsDir });

        expect(result.recommendation?.status).toBe('pending_confirmation');
      });

      it('should retrieve implemented recommendation', async () => {
        const rec = createTestRecommendation({ status: 'implemented' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendation(rec.id, { baseDir: recommendationsDir });

        expect(result.recommendation?.status).toBe('implemented');
      });

      it('should retrieve monitoring recommendation', async () => {
        const rec = createTestRecommendation({ status: 'monitoring' });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendation(rec.id, { baseDir: recommendationsDir });

        expect(result.recommendation?.status).toBe('monitoring');
      });
    });

    describe('completed recommendations', () => {
      it('should include completedAt for completed recommendations', async () => {
        const completedAt = new Date().toISOString();
        const rec = createTestRecommendation({
          completedAt,
          completionReason: 'implemented',
        });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendation(rec.id, { baseDir: recommendationsDir });

        expect(result.recommendation?.completedAt).toBe(completedAt);
        expect(result.recommendation?.completionReason).toBe('implemented');
      });

      it('should include supersededBy when applicable', async () => {
        const supersededBy = crypto.randomUUID();
        const rec = createTestRecommendation({
          completedAt: new Date().toISOString(),
          completionReason: 'superseded',
          supersededBy,
        });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendation(rec.id, { baseDir: recommendationsDir });

        expect(result.recommendation?.supersededBy).toBe(supersededBy);
      });
    });

    describe('event context fields', () => {
      it('should preserve event baselineId', async () => {
        const baselineId = crypto.randomUUID();
        const events = [createTestEvent({ type: 'evidence', content: 'Evidence', baselineId })];
        const rec = createTestRecommendation({ events });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendation(rec.id, { baseDir: recommendationsDir });

        expect(result.recommendation?.events[0]?.baselineId).toBe(baselineId);
      });

      it('should preserve event sessionId', async () => {
        const events = [
          createTestEvent({ type: 'observation', content: 'Observed', sessionId: 'session-789' }),
        ];
        const rec = createTestRecommendation({ events });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendation(rec.id, { baseDir: recommendationsDir });

        expect(result.recommendation?.events[0]?.sessionId).toBe('session-789');
      });

      it('should preserve event commitHash', async () => {
        const events = [
          createTestEvent({
            type: 'implementation_signal',
            content: 'Signal',
            commitHash: 'abc123',
          }),
        ];
        const rec = createTestRecommendation({ events });
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await getRecommendation(rec.id, { baseDir: recommendationsDir });

        expect(result.recommendation?.events[0]?.commitHash).toBe('abc123');
      });
    });
  });
});
