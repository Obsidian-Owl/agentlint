/**
 * Unit tests for create_recommendation tool
 *
 * Tests the create_recommendation SDK tool that creates new recommendation cases
 * with traced origins and initial 'created' events.
 *
 * @module recommendations/__tests__/create-recommendation.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createRecommendationTool, createRecommendation } from '../tools/create-recommendation';
import { loadRecommendation } from '../storage';
import type { CreateRecommendationInput } from '../types';

// =============================================================================
// Test Setup
// =============================================================================

let testDir: string;
let recommendationsDir: string;

function createValidInput(
  overrides: Partial<CreateRecommendationInput> = {}
): CreateRecommendationInput {
  return {
    type: 'preventive',
    action: 'Add error handling guidance to CLAUDE.md',
    target: 'CLAUDE.md',
    rationale: 'Session logs show repeated errors. Adding guidance prevents recurrence.',
    priority: 'high',
    tracedOrigin: {
      sessionId: 'session-123',
      configGap: 'Missing error handling instructions',
    },
    ...overrides,
  };
}

beforeEach(() => {
  testDir = join(tmpdir(), `agentlint-create-rec-test-${Date.now()}`);
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

describe('recommendations/tools/create-recommendation', () => {
  describe('tool definition', () => {
    it('should be named create_recommendation', () => {
      const toolDef = createRecommendationTool as unknown as { name: string };
      expect(toolDef.name).toBe('create_recommendation');
    });

    it('should have a comprehensive description', () => {
      const toolDef = createRecommendationTool as unknown as { description: string };
      expect(toolDef.description).toContain('recommendation');
      expect(toolDef.description).toContain('traced origin');
    });

    it('should be defined', () => {
      expect(createRecommendationTool).toBeDefined();
    });
  });

  describe('createRecommendation function', () => {
    describe('happy path', () => {
      it('should create recommendation with valid input', async () => {
        const input = createValidInput();
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.success).toBe(true);
        expect(result.recommendation).toBeDefined();
        expect(result.recommendation?.id).toBeDefined();
        expect(result.recommendation?.type).toBe('preventive');
      });

      it('should generate UUID v4 for recommendation ID', async () => {
        const input = createValidInput();
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(result.recommendation?.id).toMatch(uuidRegex);
      });

      it('should set createdAt to current timestamp', async () => {
        const before = new Date().toISOString();
        const input = createValidInput();
        const result = await createRecommendation(input, { baseDir: recommendationsDir });
        const after = new Date().toISOString();

        expect(result.recommendation?.createdAt).toBeDefined();
        expect(result.recommendation!.createdAt >= before).toBe(true);
        expect(result.recommendation!.createdAt <= after).toBe(true);
      });

      it('should set initial status to open', async () => {
        const input = createValidInput();
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.recommendation?.status).toBe('open');
      });

      it('should create initial created event', async () => {
        const input = createValidInput();
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.recommendation?.events).toHaveLength(1);
        expect(result.recommendation?.events[0]?.type).toBe('created');
      });

      it('should include action in created event content', async () => {
        const input = createValidInput({ action: 'Test action' });
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.recommendation?.events[0]?.content).toContain('Test action');
      });

      it('should persist recommendation to storage', async () => {
        const input = createValidInput();
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        const loaded = await loadRecommendation(result.recommendation!.id, {
          baseDir: recommendationsDir,
        });
        expect(loaded).toBeDefined();
        expect(loaded?.id).toBe(result.recommendation?.id);
      });
    });

    describe('recommendation types', () => {
      it('should accept symptomatic type', async () => {
        const input = createValidInput({ type: 'symptomatic' });
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.recommendation?.type).toBe('symptomatic');
      });

      it('should accept preventive type', async () => {
        const input = createValidInput({ type: 'preventive' });
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.recommendation?.type).toBe('preventive');
      });

      it('should accept systemic type', async () => {
        const input = createValidInput({ type: 'systemic' });
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.recommendation?.type).toBe('systemic');
      });
    });

    describe('priority levels', () => {
      it('should accept high priority', async () => {
        const input = createValidInput({ priority: 'high' });
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.recommendation?.priority).toBe('high');
      });

      it('should accept medium priority', async () => {
        const input = createValidInput({ priority: 'medium' });
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.recommendation?.priority).toBe('medium');
      });

      it('should accept low priority', async () => {
        const input = createValidInput({ priority: 'low' });
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.recommendation?.priority).toBe('low');
      });
    });

    describe('traced origin', () => {
      it('should preserve traced origin with findingId', async () => {
        const findingId = crypto.randomUUID();
        const input = createValidInput({
          tracedOrigin: { findingId },
        });
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.recommendation?.tracedOrigin.findingId).toBe(findingId);
      });

      it('should preserve traced origin with sessionId', async () => {
        const input = createValidInput({
          tracedOrigin: { sessionId: 'session-456' },
        });
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.recommendation?.tracedOrigin.sessionId).toBe('session-456');
      });

      it('should preserve traced origin with configGap', async () => {
        const input = createValidInput({
          tracedOrigin: { configGap: 'Missing configuration section' },
        });
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.recommendation?.tracedOrigin.configGap).toBe('Missing configuration section');
      });

      it('should preserve traced origin with pattern', async () => {
        const input = createValidInput({
          tracedOrigin: { pattern: 'Recurring error pattern' },
        });
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.recommendation?.tracedOrigin.pattern).toBe('Recurring error pattern');
      });
    });

    describe('validation errors', () => {
      it('should fail for empty action', async () => {
        const input = createValidInput({ action: '' });
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.success).toBe(false);
        expect(result.error).toContain('action');
      });

      it('should fail for empty target', async () => {
        const input = createValidInput({ target: '' });
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.success).toBe(false);
        expect(result.error).toContain('target');
      });

      it('should fail for empty rationale', async () => {
        const input = createValidInput({ rationale: '' });
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.success).toBe(false);
        expect(result.error).toContain('rationale');
      });

      it('should fail for empty traced origin', async () => {
        const input = createValidInput({
          tracedOrigin: {} as CreateRecommendationInput['tracedOrigin'],
        });
        const result = await createRecommendation(input, { baseDir: recommendationsDir });

        expect(result.success).toBe(false);
        expect(result.error).toContain('traced origin');
      });
    });
  });
});
