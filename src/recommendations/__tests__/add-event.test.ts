/**
 * Unit tests for add_recommendation_event tool
 *
 * Tests the add_recommendation_event SDK tool that appends events to
 * recommendation cases with validation.
 *
 * @module recommendations/__tests__/add-event.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { addRecommendationEventTool, addRecommendationEvent } from '../tools/add-event';
import { saveRecommendation, loadRecommendation } from '../storage';
import type { Recommendation, RecommendationEvent, AddEventInput } from '../types';

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
  testDir = join(tmpdir(), `agentlint-add-event-test-${Date.now()}`);
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

describe('recommendations/tools/add-event', () => {
  describe('tool definition', () => {
    it('should be named add_recommendation_event', () => {
      const toolDef = addRecommendationEventTool as unknown as { name: string };
      expect(toolDef.name).toBe('add_recommendation_event');
    });

    it('should have a comprehensive description', () => {
      const toolDef = addRecommendationEventTool as unknown as { description: string };
      expect(toolDef.description).toContain('event');
      expect(toolDef.description).toContain('recommendation');
    });

    it('should be defined', () => {
      expect(addRecommendationEventTool).toBeDefined();
    });
  });

  describe('addRecommendationEvent function', () => {
    describe('happy path', () => {
      it('should append event to existing recommendation', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const input: AddEventInput = {
          recommendationId: rec.id,
          type: 'observation',
          content: 'Observed related change in codebase',
        };

        const result = await addRecommendationEvent(input, { baseDir: recommendationsDir });

        expect(result.success).toBe(true);
        expect(result.recommendation?.events).toHaveLength(2);
        expect(result.recommendation?.events[1]?.type).toBe('observation');
      });

      it('should generate UUID for new event', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const input: AddEventInput = {
          recommendationId: rec.id,
          type: 'observation',
          content: 'Test observation',
        };

        const result = await addRecommendationEvent(input, { baseDir: recommendationsDir });
        const newEvent = result.recommendation?.events[1];

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(newEvent?.id).toMatch(uuidRegex);
      });

      it('should set timestamp to current time', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const before = new Date().toISOString();
        const input: AddEventInput = {
          recommendationId: rec.id,
          type: 'observation',
          content: 'Test observation',
        };

        const result = await addRecommendationEvent(input, { baseDir: recommendationsDir });
        const after = new Date().toISOString();

        const newEvent = result.recommendation?.events[1];
        expect(newEvent?.timestamp).toBeDefined();
        expect(newEvent!.timestamp >= before).toBe(true);
        expect(newEvent!.timestamp <= after).toBe(true);
      });

      it('should persist event to storage', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const input: AddEventInput = {
          recommendationId: rec.id,
          type: 'observation',
          content: 'Persisted observation',
        };

        await addRecommendationEvent(input, { baseDir: recommendationsDir });

        const loaded = await loadRecommendation(rec.id, { baseDir: recommendationsDir });
        expect(loaded?.events).toHaveLength(2);
        expect(loaded?.events[1]?.content).toBe('Persisted observation');
      });
    });

    describe('event types', () => {
      it('should accept observation type', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await addRecommendationEvent(
          { recommendationId: rec.id, type: 'observation', content: 'Test' },
          { baseDir: recommendationsDir }
        );

        expect(result.recommendation?.events[1]?.type).toBe('observation');
      });

      it('should accept refinement type', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await addRecommendationEvent(
          { recommendationId: rec.id, type: 'refinement', content: 'Test' },
          { baseDir: recommendationsDir }
        );

        expect(result.recommendation?.events[1]?.type).toBe('refinement');
      });

      it('should accept user_feedback type', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await addRecommendationEvent(
          { recommendationId: rec.id, type: 'user_feedback', content: 'Test' },
          { baseDir: recommendationsDir }
        );

        expect(result.recommendation?.events[1]?.type).toBe('user_feedback');
      });

      it('should accept evidence type', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await addRecommendationEvent(
          { recommendationId: rec.id, type: 'evidence', content: 'Test' },
          { baseDir: recommendationsDir }
        );

        expect(result.recommendation?.events[1]?.type).toBe('evidence');
      });

      it('should accept implementation_signal type', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await addRecommendationEvent(
          { recommendationId: rec.id, type: 'implementation_signal', content: 'Test' },
          { baseDir: recommendationsDir }
        );

        expect(result.recommendation?.events[1]?.type).toBe('implementation_signal');
      });

      it('should accept status_change type', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await addRecommendationEvent(
          { recommendationId: rec.id, type: 'status_change', content: 'Test' },
          { baseDir: recommendationsDir }
        );

        expect(result.recommendation?.events[1]?.type).toBe('status_change');
      });
    });

    describe('200 character limit', () => {
      it('should accept content at exactly 200 characters', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const content = 'a'.repeat(200);
        const result = await addRecommendationEvent(
          { recommendationId: rec.id, type: 'observation', content },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(true);
        expect(result.recommendation?.events[1]?.content).toBe(content);
      });

      it('should reject content exceeding 200 characters', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const content = 'a'.repeat(201);
        const result = await addRecommendationEvent(
          { recommendationId: rec.id, type: 'observation', content },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('200');
      });
    });

    describe('non-existent recommendation', () => {
      it('should fail for non-existent recommendation ID', async () => {
        const result = await addRecommendationEvent(
          { recommendationId: 'non-existent-id', type: 'observation', content: 'Test' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });

    describe('optional context fields', () => {
      it('should accept baselineId context', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const baselineId = crypto.randomUUID();
        const result = await addRecommendationEvent(
          { recommendationId: rec.id, type: 'evidence', content: 'Evidence', baselineId },
          { baseDir: recommendationsDir }
        );

        expect(result.recommendation?.events[1]?.baselineId).toBe(baselineId);
      });

      it('should accept sessionId context', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await addRecommendationEvent(
          { recommendationId: rec.id, type: 'observation', content: 'Observed', sessionId: 'session-456' },
          { baseDir: recommendationsDir }
        );

        expect(result.recommendation?.events[1]?.sessionId).toBe('session-456');
      });

      it('should accept commitHash context', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await addRecommendationEvent(
          { recommendationId: rec.id, type: 'implementation_signal', content: 'Signal', commitHash: 'abc123def' },
          { baseDir: recommendationsDir }
        );

        expect(result.recommendation?.events[1]?.commitHash).toBe('abc123def');
      });

      it('should accept all context fields together', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const baselineId = crypto.randomUUID();
        const result = await addRecommendationEvent(
          {
            recommendationId: rec.id,
            type: 'evidence',
            content: 'Full context',
            baselineId,
            sessionId: 'session-789',
            commitHash: 'commit123',
          },
          { baseDir: recommendationsDir }
        );

        const newEvent = result.recommendation?.events[1];
        expect(newEvent?.baselineId).toBe(baselineId);
        expect(newEvent?.sessionId).toBe('session-789');
        expect(newEvent?.commitHash).toBe('commit123');
      });
    });

    describe('system-generated event types', () => {
      it('should reject created type (system-generated only)', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await addRecommendationEvent(
          { recommendationId: rec.id, type: 'created' as AddEventInput['type'], content: 'Test' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('system-generated');
      });

      it('should reject completed type (system-generated only)', async () => {
        const rec = createTestRecommendation();
        await saveRecommendation(rec, { baseDir: recommendationsDir });

        const result = await addRecommendationEvent(
          { recommendationId: rec.id, type: 'completed' as AddEventInput['type'], content: 'Test' },
          { baseDir: recommendationsDir }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('system-generated');
      });
    });
  });
});
