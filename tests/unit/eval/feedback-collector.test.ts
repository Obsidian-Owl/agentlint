/**
 * EP11 Quality & Security - FeedbackCollector Unit Tests
 *
 * Tests the FeedbackCollector implementation for recommendation
 * outcome tracking and feedback collection.
 *
 * @module tests/unit/eval/feedback-collector
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { randomUUID } from 'crypto';
import { FeedbackCollector, createFeedbackCollector } from '../../../src/eval/feedback';
import { OutcomeStorage } from '../../../src/persistence/outcome-storage';
import type { RecommendationType } from '../../../specs/ep11-quality-security/contracts/outcome';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestRecommendations(
  count: number
): Array<{ id: string; summary: string; type: RecommendationType }> {
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

let storage: OutcomeStorage;
let collector: FeedbackCollector;

beforeEach(() => {
  storage = new OutcomeStorage(':memory:');
  collector = createFeedbackCollector(storage, { collectFeedback: true });
  collector.startSession(`session-${randomUUID()}`);
});

afterEach(() => {
  collector.endSession();
  storage.close();
});

// =============================================================================
// Test Suite
// =============================================================================

describe('FeedbackCollector', () => {
  describe('Configuration', () => {
    test('is disabled by default', () => {
      const disabledCollector = createFeedbackCollector(storage);
      expect(disabledCollector.isEnabled()).toBe(false);
    });

    test('can be enabled via config', () => {
      expect(collector.isEnabled()).toBe(true);
    });

    test('shouldPrompt returns true when enabled and under limit', async () => {
      expect(await collector.shouldPrompt()).toBe(true);
    });

    test('shouldPrompt returns false when disabled', async () => {
      const disabledCollector = createFeedbackCollector(storage);
      expect(await disabledCollector.shouldPrompt()).toBe(false);
    });
  });

  describe('getPromptsForSession', () => {
    test('generates prompts for recommendations', () => {
      const recommendations = createTestRecommendations(5);
      const prompts = collector.getPromptsForSession(recommendations);

      expect(prompts).toHaveLength(3); // Default max is 3
      expect(prompts[0]!.recommendationId).toBe('REC-001');
      expect(prompts[0]!.summary).toBe('Test recommendation 1');
    });

    test('returns empty array when disabled', () => {
      const disabledCollector = createFeedbackCollector(storage);
      const recommendations = createTestRecommendations(5);
      const prompts = disabledCollector.getPromptsForSession(recommendations);

      expect(prompts).toHaveLength(0);
    });

    test('respects maxPromptsPerSession', () => {
      const limitedCollector = createFeedbackCollector(storage, {
        collectFeedback: true,
        maxPromptsPerSession: 1,
      });

      const recommendations = createTestRecommendations(5);
      const prompts = limitedCollector.getPromptsForSession(recommendations);

      expect(prompts).toHaveLength(1);
    });

    test('reduces available prompts as feedback is recorded', async () => {
      const recommendations = createTestRecommendations(5);

      // Get initial prompts
      const prompts1 = collector.getPromptsForSession(recommendations);
      expect(prompts1).toHaveLength(3);

      // Record feedback for one
      prompts1[0]!.response = 'will_implement';
      await collector.recordFeedback(prompts1[0]!);

      // Get new prompts - should have 2 remaining
      const prompts2 = collector.getPromptsForSession(recommendations);
      expect(prompts2).toHaveLength(2);
    });
  });

  describe('recordFeedback', () => {
    test('creates outcome for will_implement response', async () => {
      const recommendations = createTestRecommendations(1);
      const prompts = collector.getPromptsForSession(recommendations);

      prompts[0]!.response = 'will_implement';
      await collector.recordFeedback(prompts[0]!);

      const outcomes = await storage.getOutcomesByRecommendation('REC-001');
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]!.implemented).toBe(true);
    });

    test('creates outcome for not_relevant response', async () => {
      const recommendations = createTestRecommendations(1);
      const prompts = collector.getPromptsForSession(recommendations);

      prompts[0]!.response = 'not_relevant';
      await collector.recordFeedback(prompts[0]!);

      const outcomes = await storage.getOutcomesByRecommendation('REC-001');
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]!.implemented).toBe(false);
    });

    test('creates outcome for already_done response', async () => {
      const recommendations = createTestRecommendations(1);
      const prompts = collector.getPromptsForSession(recommendations);

      prompts[0]!.response = 'already_done';
      await collector.recordFeedback(prompts[0]!);

      const outcomes = await storage.getOutcomesByRecommendation('REC-001');
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]!.implemented).toBe(true);
    });

    test('creates outcome for maybe_later response with null implemented', async () => {
      const recommendations = createTestRecommendations(1);
      const prompts = collector.getPromptsForSession(recommendations);

      prompts[0]!.response = 'maybe_later';
      await collector.recordFeedback(prompts[0]!);

      const outcomes = await storage.getOutcomesByRecommendation('REC-001');
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]!.implemented).toBeNull();
    });

    test('does not record when no response', async () => {
      const recommendations = createTestRecommendations(1);
      const prompts = collector.getPromptsForSession(recommendations);

      // No response set
      await collector.recordFeedback(prompts[0]!);

      const outcomes = await storage.getOutcomesByRecommendation('REC-001');
      expect(outcomes).toHaveLength(0);
    });

    test('preserves recommendation type from getPromptsForSession', async () => {
      const recommendations = createTestRecommendations(3);
      const prompts = collector.getPromptsForSession(recommendations);

      // Record all three
      for (const prompt of prompts) {
        prompt.response = 'will_implement';
        await collector.recordFeedback(prompt);
      }

      const symptomatic = await storage.getOutcomesByRecommendation('REC-001');
      const preventive = await storage.getOutcomesByRecommendation('REC-002');
      const systemic = await storage.getOutcomesByRecommendation('REC-003');

      expect(symptomatic[0]!.recommendationType).toBe('symptomatic');
      expect(preventive[0]!.recommendationType).toBe('preventive');
      expect(systemic[0]!.recommendationType).toBe('systemic');
    });
  });

  describe('Follow-up Flow', () => {
    test('getPendingFollowUps returns implemented outcomes', async () => {
      // Create an implemented outcome directly
      await storage.createOutcome({
        sessionId: 'session-old',
        recommendationId: 'REC-100',
        recommendationType: 'preventive',
        recommendationSummary: 'Old recommendation',
        implemented: true,
        implementationDate: new Date().toISOString(),
        helped: null,
        outcomeNotes: null,
        configChangedAfter: null,
        similarIssueRecurred: null,
      });

      // Use 0 delay for testing
      const testCollector = createFeedbackCollector(storage, {
        collectFeedback: true,
        followUpDelayDays: 0,
      });

      const pending = await testCollector.getPendingFollowUps();

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

  describe('Session Management', () => {
    test('startSession sets session ID', () => {
      const newCollector = createFeedbackCollector(storage, { collectFeedback: true });
      expect(newCollector.getSessionId()).toBeNull();

      newCollector.startSession('test-session');
      expect(newCollector.getSessionId()).toBe('test-session');
    });

    test('endSession clears session state', () => {
      collector.endSession();

      expect(collector.getSessionId()).toBeNull();
      expect(collector.getPromptCount()).toBe(0);
    });

    test('session ID is used in created outcomes', async () => {
      const testCollector = createFeedbackCollector(storage, { collectFeedback: true });
      testCollector.startSession('my-session-123');

      const recommendations = createTestRecommendations(1);
      const prompts = testCollector.getPromptsForSession(recommendations);
      prompts[0]!.response = 'will_implement';
      await testCollector.recordFeedback(prompts[0]!);

      const outcomes = await storage.getOutcomesByRecommendation('REC-001');
      expect(outcomes[0]!.sessionId).toBe('my-session-123');

      testCollector.endSession();
    });
  });

  describe('Factory Function', () => {
    test('createFeedbackCollector returns FeedbackCollector instance', () => {
      const instance = createFeedbackCollector(storage);
      expect(instance).toBeInstanceOf(FeedbackCollector);
    });

    test('accepts partial config', () => {
      const instance = createFeedbackCollector(storage, {
        collectFeedback: true,
      });
      expect(instance.isEnabled()).toBe(true);
    });
  });
});
