/**
 * Unit tests for recommendations/storage/compression.ts
 *
 * Tests token estimation, recommendation compression, and context loading.
 *
 * @module recommendations/__tests__/compression.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  estimateTokens,
  compressRecommendation,
  formatEventsVerbatim,
  loadRecommendationsForContext,
  TOKEN_BUDGET,
  CHARS_PER_TOKEN,
} from '../storage/compression';
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
  testDir = join(tmpdir(), `agentlint-compression-test-${Date.now()}`);
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

describe('recommendations/compression', () => {
  describe('constants', () => {
    it('should have 8K token budget', () => {
      expect(TOKEN_BUDGET).toBe(8000);
    });

    it('should use 4 chars per token approximation', () => {
      expect(CHARS_PER_TOKEN).toBe(4);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      const text = 'a'.repeat(400); // 400 chars = 100 tokens at 4 chars/token
      const tokens = estimateTokens(text);
      expect(tokens).toBe(100);
    });

    it('should handle empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should round up partial tokens', () => {
      const text = 'abc'; // 3 chars = 0.75 tokens, rounds to 1
      expect(estimateTokens(text)).toBe(1);
    });

    it('should estimate tokens for JSON objects', () => {
      const obj = { id: '123', action: 'test action', status: 'open' };
      const tokens = estimateTokens(obj);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('formatEventsVerbatim', () => {
    it('should format single event', () => {
      const events = [createTestEvent({ type: 'created', content: 'Initial creation' })];
      const formatted = formatEventsVerbatim(events);

      expect(formatted).toContain('created');
      expect(formatted).toContain('Initial creation');
    });

    it('should format multiple events', () => {
      const events = [
        createTestEvent({ type: 'created', content: 'Created' }),
        createTestEvent({ type: 'observation', content: 'Observed change' }),
        createTestEvent({ type: 'evidence', content: 'Added evidence' }),
      ];
      const formatted = formatEventsVerbatim(events);

      expect(formatted).toContain('created');
      expect(formatted).toContain('observation');
      expect(formatted).toContain('evidence');
    });

    it('should handle empty array', () => {
      const formatted = formatEventsVerbatim([]);
      expect(formatted).toBe('');
    });
  });

  describe('compressRecommendation', () => {
    it('should create summary with correct fields', () => {
      const rec = createTestRecommendation();
      const summary = compressRecommendation(rec);

      expect(summary.id).toBe(rec.id);
      expect(summary.type).toBe(rec.type);
      expect(summary.status).toBe(rec.status);
      expect(summary.target).toBe(rec.target);
      expect(summary.priority).toBe(rec.priority);
      expect(summary.eventCount).toBe(1);
    });

    it('should truncate action to 100 chars', () => {
      const longAction = 'a'.repeat(150);
      const rec = createTestRecommendation({ action: longAction });
      const summary = compressRecommendation(rec);

      expect(summary.actionSummary.length).toBeLessThanOrEqual(103); // 100 + "..."
      expect(summary.actionSummary).toContain('...');
    });

    it('should include events verbatim for ≤3 events', () => {
      const events = [
        createTestEvent({ type: 'created', content: 'Created' }),
        createTestEvent({ type: 'observation', content: 'Observed' }),
        createTestEvent({ type: 'evidence', content: 'Evidence' }),
      ];
      const rec = createTestRecommendation({ events });
      const summary = compressRecommendation(rec);

      expect(summary.recentActivity).toContain('Created');
      expect(summary.recentActivity).toContain('Observed');
      expect(summary.recentActivity).toContain('Evidence');
      expect(summary.recentActivity).not.toContain('+');
    });

    it('should show count for 4-10 events', () => {
      const events = Array.from({ length: 7 }, (_, i) =>
        createTestEvent({ type: 'observation', content: `Event ${i + 1}` })
      );
      events[0] = createTestEvent({ type: 'created', content: 'Created' });

      const rec = createTestRecommendation({ events });
      const summary = compressRecommendation(rec);

      expect(summary.eventCount).toBe(7);
      expect(summary.recentActivity).toContain('+4 earlier events');
      expect(summary.recentActivity).toContain('Event 7'); // Last event
    });

    it('should show summary message for >10 events', () => {
      const events = Array.from({ length: 15 }, (_, i) =>
        createTestEvent({ type: 'observation', content: `Event ${i + 1}` })
      );
      events[0] = createTestEvent({ type: 'created', content: 'Created' });

      const rec = createTestRecommendation({ events });
      const summary = compressRecommendation(rec);

      expect(summary.eventCount).toBe(15);
      expect(summary.recentActivity).toContain('summarized');
      expect(summary.recentActivity).toContain('get_recommendation');
    });

    it('should include milestones', () => {
      const rec = createTestRecommendation();
      const summary = compressRecommendation(rec);

      expect(summary.milestones.created).toBe(rec.createdAt);
    });

    it('should populate lastEventAt and lastEventType', () => {
      const events = [
        createTestEvent({ type: 'created', content: 'Created' }),
        createTestEvent({ type: 'observation', content: 'Observed' }),
      ];
      const rec = createTestRecommendation({ events });
      const summary = compressRecommendation(rec);

      expect(summary.lastEventAt).toBe(events[1]!.timestamp);
      expect(summary.lastEventType).toBe('observation');
    });

    it('should produce summary under 500 chars', () => {
      const rec = createTestRecommendation();
      const summary = compressRecommendation(rec);
      const serialized = JSON.stringify(summary);

      expect(serialized.length).toBeLessThan(500);
    });
  });

  describe('loadRecommendationsForContext', () => {
    it('should return empty array for empty directory', async () => {
      const summaries = await loadRecommendationsForContext({
        baseDir: recommendationsDir,
      });
      expect(summaries).toEqual([]);
    });

    it('should load and compress recommendations', async () => {
      const rec1 = createTestRecommendation();
      const rec2 = createTestRecommendation();
      await saveRecommendation(rec1, { baseDir: recommendationsDir });
      await saveRecommendation(rec2, { baseDir: recommendationsDir });

      const summaries = await loadRecommendationsForContext({
        baseDir: recommendationsDir,
      });

      expect(summaries.length).toBe(2);
      expect(summaries.every((s) => 'actionSummary' in s)).toBe(true);
    });

    it('should load newest first', async () => {
      const rec1 = createTestRecommendation({
        createdAt: '2026-01-01T00:00:00Z',
      });
      const rec2 = createTestRecommendation({
        createdAt: '2026-01-15T00:00:00Z',
      });
      await saveRecommendation(rec1, { baseDir: recommendationsDir });
      await saveRecommendation(rec2, { baseDir: recommendationsDir });

      const summaries = await loadRecommendationsForContext({
        baseDir: recommendationsDir,
      });

      // Newest should be first
      expect(summaries.length).toBe(2);
      expect(summaries[0]?.milestones.created).toBe('2026-01-15T00:00:00Z');
      expect(summaries[1]?.milestones.created).toBe('2026-01-01T00:00:00Z');
    });

    it('should respect token budget', async () => {
      // Create many recommendations to exceed budget
      const recs: Recommendation[] = [];
      for (let i = 0; i < 100; i++) {
        recs.push(
          createTestRecommendation({
            action: `Action ${i}: ${'x'.repeat(100)}`, // Make each one substantial
            rationale: `Rationale ${i}: ${'y'.repeat(200)}`,
          })
        );
      }

      for (const rec of recs) {
        await saveRecommendation(rec, { baseDir: recommendationsDir });
      }

      const summaries = await loadRecommendationsForContext({
        baseDir: recommendationsDir,
      });

      // Should not load all 100 due to budget
      expect(summaries.length).toBeLessThan(100);
      expect(summaries.length).toBeGreaterThan(0);

      // Total tokens should be under budget
      const totalTokens = summaries.reduce((sum, s) => sum + estimateTokens(s), 0);
      expect(totalTokens).toBeLessThanOrEqual(TOKEN_BUDGET);
    });

    it('should filter by status when provided', async () => {
      const openRec = createTestRecommendation({ status: 'open' });
      const implementedRec = createTestRecommendation({ status: 'implemented' });
      await saveRecommendation(openRec, { baseDir: recommendationsDir });
      await saveRecommendation(implementedRec, { baseDir: recommendationsDir });

      const openSummaries = await loadRecommendationsForContext({
        baseDir: recommendationsDir,
        status: 'open',
      });

      expect(openSummaries.length).toBe(1);
      expect(openSummaries[0]?.status).toBe('open');
    });
  });
});
