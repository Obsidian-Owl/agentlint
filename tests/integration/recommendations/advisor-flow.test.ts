/**
 * VCR Integration Test for Recommendation Advisor Flow
 *
 * Tests the complete advisor workflow using VCR recordings
 * for deterministic integration testing per ADR-0011.
 *
 * @module tests/integration/recommendations/advisor-flow.test
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { VCR } from '../../lib/vcr';
import { buildRecommendationAdvisorAgent } from '../../../src/recommendations/subagent/recommendation-advisor';
import { createRecommendation } from '../../../src/recommendations/tools/create-recommendation';
import { getRecommendation } from '../../../src/recommendations/tools/get-recommendation';
import {
  RecommendationSchema,
  TracedOriginSchema,
} from '../../../src/recommendations/schemas';
import type { Recommendation, TracedOrigin, CreateRecommendationInput } from '../../../src/recommendations/types';

// =============================================================================
// VCR Setup
// =============================================================================

const vcr = new VCR();
const CASSETTE_PATH = 'tests/integration/recordings/recommendations/advisor-simple-finding.json';

// =============================================================================
// Test Setup
// =============================================================================

let testDir: string;
let recommendationsDir: string;

beforeAll(async () => {
  await vcr.load(CASSETTE_PATH);
  vcr.setupMocks();
});

afterAll(() => {
  vcr.cleanup();
});

beforeEach(async () => {
  // Create isolated test directory
  testDir = await mkdtemp(join(tmpdir(), 'agentlint-advisor-flow-'));
  recommendationsDir = join(testDir, '.agentlint', 'recommendations');
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

// =============================================================================
// Tests
// =============================================================================

describe('Recommendation Advisor Flow Integration', () => {
  describe('Agent Definition', () => {
    it('should build a valid agent definition', () => {
      const agentDef = buildRecommendationAdvisorAgent();

      expect(agentDef).toBeDefined();
      expect(agentDef.description).toContain('recommendation');
      expect(agentDef.prompt).toContain('ROLE IDENTITY');
      expect(agentDef.tools).toBeDefined();
      expect(Array.isArray(agentDef.tools)).toBe(true);
      expect(agentDef.tools?.length).toBeGreaterThan(0);
    });

    it('should NOT include Task tool (single-depth constraint)', () => {
      const agentDef = buildRecommendationAdvisorAgent();

      // Per Constitution C8: Single subagent depth limit
      expect(agentDef.tools).not.toContain('Task');
    });

    it('should include all required recommendation tools', () => {
      const agentDef = buildRecommendationAdvisorAgent();

      const expectedTools = [
        'create_recommendation',
        'get_recommendation',
        'list_recommendations',
        'get_recommendation_summary',
        'add_recommendation_event',
        'update_recommendation_status',
        'refine_recommendation',
        'complete_recommendation',
      ];

      for (const tool of expectedTools) {
        expect(agentDef.tools).toContain(tool);
      }
    });
  });

  describe('Simple Finding → Recommendation', () => {
    it('should create recommendation with traced origin from finding', async () => {
      // Given: A simple finding from EP05 config analysis
      const findingId = crypto.randomUUID();
      const finding = {
        id: findingId,
        type: 'config_gap',
        severity: 'high',
        message: 'Missing error handling guidance in CLAUDE.md',
        location: 'CLAUDE.md',
        suggestion: 'Add error handling section',
      };

      const tracedOrigin: TracedOrigin = {
        findingId: finding.id,
        configGap: 'No error handling guidance in developer documentation',
      };

      // When: Creating a recommendation based on the finding
      const input: CreateRecommendationInput = {
        type: 'preventive',
        action: 'Add error handling section to CLAUDE.md with common patterns',
        target: 'CLAUDE.md',
        rationale:
          'Without error handling guidance, agents may implement inconsistent error recovery, leading to harder-to-debug issues.',
        priority: 'high',
        tracedOrigin,
      };

      const result = await createRecommendation(input, {
        baseDir: recommendationsDir,
      });

      // Then: Result should be successful with valid recommendation
      expect(result.success).toBe(true);
      expect(result.recommendation).toBeDefined();

      const recommendation = result.recommendation!;
      expect(recommendation.id).toBeDefined();
      expect(recommendation.type).toBe('preventive');
      expect(recommendation.status).toBe('open');

      // Verify traced origin is preserved
      expect(recommendation.tracedOrigin.findingId).toBe(finding.id);
      expect(recommendation.tracedOrigin.configGap).toBeDefined();

      // Verify recommendation validates against schema
      const validationResult = RecommendationSchema.safeParse(recommendation);
      expect(validationResult.success).toBe(true);
    });

    it('should retrieve recommendation by ID', async () => {
      // Given: An existing recommendation
      const tracedOrigin: TracedOrigin = {
        findingId: crypto.randomUUID(),
        sessionId: 'session-abc',
      };

      const input: CreateRecommendationInput = {
        type: 'symptomatic',
        action: 'Fix typo in config file',
        target: '.agentlint/config.json',
        rationale: 'Typo causing parse error',
        priority: 'low',
        tracedOrigin,
      };

      const createResult = await createRecommendation(input, {
        baseDir: recommendationsDir,
      });

      expect(createResult.success).toBe(true);
      expect(createResult.recommendation).toBeDefined();
      const created = createResult.recommendation!;

      // When: Retrieving by ID
      const getResult = await getRecommendation(created.id, {
        baseDir: recommendationsDir,
      });

      // Then: Should match original
      expect(getResult.success).toBe(true);
      expect(getResult.recommendation).toBeDefined();

      const retrieved = getResult.recommendation!;
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.action).toBe(input.action);
      expect(retrieved.tracedOrigin.findingId).toBe(tracedOrigin.findingId);
      expect(retrieved.tracedOrigin.sessionId).toBe(tracedOrigin.sessionId);
    });

    it('should return error for non-existent recommendation', async () => {
      const result = await getRecommendation(crypto.randomUUID(), {
        baseDir: recommendationsDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Traced Origin Validation', () => {
    it('should require at least one origin field', () => {
      // Empty traced origin should fail validation
      const emptyOrigin = {};
      const result = TracedOriginSchema.safeParse(emptyOrigin);

      expect(result.success).toBe(false);
    });

    it('should accept traced origin with only findingId', () => {
      const origin = { findingId: crypto.randomUUID() };
      const result = TracedOriginSchema.safeParse(origin);

      expect(result.success).toBe(true);
    });

    it('should accept traced origin with only pattern', () => {
      const origin = { pattern: 'repeated-failure' };
      const result = TracedOriginSchema.safeParse(origin);

      expect(result.success).toBe(true);
    });

    it('should accept traced origin with multiple fields', () => {
      const origin: TracedOrigin = {
        findingId: crypto.randomUUID(),
        sessionId: 'session-456',
        configGap: 'Missing guidance for error handling',
        pattern: 'repeated-failures-in-builds',
      };
      const result = TracedOriginSchema.safeParse(origin);

      expect(result.success).toBe(true);
    });
  });

  describe('Prioritization Logic', () => {
    it('should support all priority levels', async () => {
      const priorities = ['high', 'medium', 'low'] as const;
      const recommendations: Recommendation[] = [];

      for (const priority of priorities) {
        const input: CreateRecommendationInput = {
          type: 'preventive',
          action: `Test action for ${priority} priority`,
          target: 'test.ts',
          rationale: 'Test rationale',
          priority,
          tracedOrigin: { pattern: `pattern-${priority}` },
        };

        const result = await createRecommendation(input, {
          baseDir: recommendationsDir,
        });
        expect(result.success).toBe(true);
        expect(result.recommendation).toBeDefined();
        recommendations.push(result.recommendation!);
      }

      // Verify all priorities are correctly stored
      expect(recommendations[0]?.priority).toBe('high');
      expect(recommendations[1]?.priority).toBe('medium');
      expect(recommendations[2]?.priority).toBe('low');
    });

    it('should create recommendation with correct type based on causal depth', async () => {
      // Symptomatic: immediate fix, no root cause
      const symptomaticResult = await createRecommendation(
        {
          type: 'symptomatic',
          action: 'Clear cache',
          target: '.agentlint/cache/',
          rationale: 'Cache corrupted, need immediate fix',
          priority: 'medium',
          tracedOrigin: { sessionId: 'session-corrupt' },
        },
        { baseDir: recommendationsDir }
      );

      // Preventive: prevents recurrence
      const preventiveResult = await createRecommendation(
        {
          type: 'preventive',
          action: 'Add cache validation on startup',
          target: 'src/cache/index.ts',
          rationale: 'Prevents cache corruption from causing future issues',
          priority: 'medium',
          tracedOrigin: { findingId: crypto.randomUUID(), pattern: 'cache-corruption' },
        },
        { baseDir: recommendationsDir }
      );

      // Systemic: architectural change
      const systemicResult = await createRecommendation(
        {
          type: 'systemic',
          action: 'Redesign caching layer to be immutable',
          target: 'src/cache/',
          rationale: 'Immutable cache design eliminates corruption class of bugs',
          priority: 'high',
          tracedOrigin: { pattern: 'multiple-cache-issues' },
        },
        { baseDir: recommendationsDir }
      );

      expect(symptomaticResult.success).toBe(true);
      expect(preventiveResult.success).toBe(true);
      expect(systemicResult.success).toBe(true);

      expect(symptomaticResult.recommendation?.type).toBe('symptomatic');
      expect(preventiveResult.recommendation?.type).toBe('preventive');
      expect(systemicResult.recommendation?.type).toBe('systemic');
    });
  });

  describe('Event Log (Append-Only)', () => {
    it('should have created event in new recommendation', async () => {
      const result = await createRecommendation(
        {
          type: 'preventive',
          action: 'Test action',
          target: 'test.ts',
          rationale: 'Test rationale',
          priority: 'medium',
          tracedOrigin: { findingId: crypto.randomUUID() },
        },
        { baseDir: recommendationsDir }
      );

      expect(result.success).toBe(true);
      expect(result.recommendation).toBeDefined();

      const rec = result.recommendation!;
      expect(rec.events).toHaveLength(1);
      expect(rec.events[0]?.type).toBe('created');
      expect(rec.events[0]?.content).toContain('created');
    });
  });
});
