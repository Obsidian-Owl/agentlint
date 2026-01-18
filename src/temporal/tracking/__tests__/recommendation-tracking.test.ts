/**
 * Unit tests for recommendation tracking (T049 - AGE-511)
 *
 * This test file explicitly verifies the T049 acceptance criteria:
 * 1. Tests for status transitions
 * 2. Tests for extraction from findings
 * 3. Tests for delta inclusion
 *
 * Note: These tests complement the existing tests in:
 * - api.test.ts (status transitions via updateRecommendationStatus)
 * - detector.test.ts (extraction from config diffs)
 * - summarizer.test.ts (delta inclusion)
 *
 * @module temporal/tracking/__tests__/recommendation-tracking.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { updateRecommendationStatus, listRecommendations, getRecommendation } from '../api';
import { saveTracking } from '../../../persistence/tracking';
import { extractMatchEvidence, createConfigDiff } from '../detector';
import { createDeltaSummary } from '../../delta/summarizer';
import { calculateDelta } from '../../delta/calculator';
import type { RecommendationTracking } from '../../types';
import type { Baseline } from '../../../persistence/types';
import type {
  Finding,
  Recommendation as OrchestratorRecommendation,
} from '../../../orchestration/types';

// =============================================================================
// Test Setup
// =============================================================================

let testDir: string;
let trackingDir: string;

function createTestTracking(
  overrides: Partial<RecommendationTracking> = {}
): RecommendationTracking {
  return {
    id: crypto.randomUUID(),
    recommendationId: 'REC-001',
    recommendationText: 'Add better error handling',
    status: 'pending',
    detectedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createTestBaseline(overrides: Partial<Baseline> = {}): Baseline {
  return {
    id: crypto.randomUUID(),
    version: '1.0.0',
    createdAt: '2026-01-15T12:00:00.000Z',
    projectPath: '/test/project',
    actType: 'claude-code',
    configPath: null,
    gitCommit: null,
    metrics: {
      findingsCount: 10,
      criticalCount: 1,
      highCount: 2,
      mediumCount: 3,
      lowCount: 4,
      infoCount: 0,
    },
    findings: [],
    label: null,
    notes: null,
    ...overrides,
  };
}

function createFinding(recommendations: OrchestratorRecommendation[]): Finding {
  return {
    id: crypto.randomUUID(),
    type: 'config_gap',
    severity: 'medium',
    title: 'Test Finding',
    description: 'A test finding',
    location: null,
    origin: null,
    recommendations,
    detectedAt: new Date().toISOString(),
    detectedInPhase: 'analyze',
  };
}

function createOrchestratorRecommendation(action: string): OrchestratorRecommendation {
  return {
    type: 'preventive',
    action,
    rationale: 'Test rationale',
    priority: 'medium',
  };
}

beforeEach(() => {
  testDir = join(tmpdir(), `agentlint-tracking-test-${Date.now()}`);
  trackingDir = join(testDir, '.agentlint', 'tracking');
  mkdirSync(trackingDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

// =============================================================================
// T049 Acceptance Criteria Tests
// =============================================================================

describe('T049: Recommendation Tracking Tests', () => {
  describe('Acceptance Criteria 1: Status Transitions', () => {
    it('should transition from pending to detected_pending_confirm', async () => {
      const tracking = createTestTracking({ status: 'pending' });
      await saveTracking(tracking, { baseDir: trackingDir });

      const updated = await updateRecommendationStatus(
        tracking.id,
        { status: 'detected_pending_confirm' },
        { baseDir: trackingDir }
      );

      expect(updated.status).toBe('detected_pending_confirm');
    });

    it('should transition from detected_pending_confirm to implemented', async () => {
      const tracking = createTestTracking({ status: 'detected_pending_confirm' });
      await saveTracking(tracking, { baseDir: trackingDir });

      const updated = await updateRecommendationStatus(
        tracking.id,
        {
          status: 'implemented',
          confirmedAt: new Date().toISOString(),
          effectivenessScore: 85,
        },
        { baseDir: trackingDir }
      );

      expect(updated.status).toBe('implemented');
      expect(updated.confirmedAt).toBeDefined();
      expect(updated.effectivenessScore).toBe(85);
    });

    it('should transition to rejected status', async () => {
      const tracking = createTestTracking({ status: 'detected_pending_confirm' });
      await saveTracking(tracking, { baseDir: trackingDir });

      const updated = await updateRecommendationStatus(
        tracking.id,
        { status: 'rejected', notes: 'Not applicable to our use case' },
        { baseDir: trackingDir }
      );

      expect(updated.status).toBe('rejected');
      expect(updated.notes).toBe('Not applicable to our use case');
    });

    it('should transition to partial status', async () => {
      const tracking = createTestTracking({ status: 'pending' });
      await saveTracking(tracking, { baseDir: trackingDir });

      const updated = await updateRecommendationStatus(
        tracking.id,
        { status: 'partial', notes: 'Only implemented half of the recommendation' },
        { baseDir: trackingDir }
      );

      expect(updated.status).toBe('partial');
    });

    it('should transition to ineffective status', async () => {
      const tracking = createTestTracking({ status: 'implemented', effectivenessScore: 20 });
      await saveTracking(tracking, { baseDir: trackingDir });

      const updated = await updateRecommendationStatus(
        tracking.id,
        { status: 'ineffective', notes: 'Did not achieve expected results' },
        { baseDir: trackingDir }
      );

      expect(updated.status).toBe('ineffective');
    });

    it('should update baselines during transition', async () => {
      const tracking = createTestTracking({ preBaselineId: 'baseline-1' });
      await saveTracking(tracking, { baseDir: trackingDir });

      const updated = await updateRecommendationStatus(
        tracking.id,
        { postBaselineId: 'baseline-2', status: 'implemented' },
        { baseDir: trackingDir }
      );

      expect(updated.preBaselineId).toBe('baseline-1');
      expect(updated.postBaselineId).toBe('baseline-2');
    });

    it('should persist transitions across reloads', async () => {
      const tracking = createTestTracking({ status: 'pending' });
      await saveTracking(tracking, { baseDir: trackingDir });

      await updateRecommendationStatus(
        tracking.id,
        { status: 'implemented', effectivenessScore: 90 },
        { baseDir: trackingDir }
      );

      // Reload from disk
      const reloaded = await getRecommendation(tracking.id, { baseDir: trackingDir });

      expect(reloaded?.status).toBe('implemented');
      expect(reloaded?.effectivenessScore).toBe(90);
    });
  });

  describe('Acceptance Criteria 2: Extraction from Findings', () => {
    it('should extract keyword evidence from config changes', () => {
      const recommendation = {
        id: 'rec-001',
        summary: 'Add error handling guidance',
        keywords: ['error', 'handling', 'exception'],
        targetFiles: ['CLAUDE.md'],
      };

      const diff = createConfigDiff(
        ['# Claude Instructions'],
        ['# Claude Instructions', 'Always handle errors gracefully'],
        'CLAUDE.md'
      );

      const evidence = extractMatchEvidence(recommendation, diff);

      expect(evidence.keywordMatches.length).toBeGreaterThan(0);
      expect(evidence.totalWeight).toBeGreaterThan(0);
    });

    it('should extract file match evidence', () => {
      const recommendation = {
        id: 'rec-002',
        summary: 'Update CLAUDE.md',
        keywords: ['test'],
        targetFiles: ['CLAUDE.md', 'AGENTS.md'],
      };

      const diff = createConfigDiff(['old'], ['new'], 'CLAUDE.md');

      const evidence = extractMatchEvidence(recommendation, diff);

      expect(evidence.fileMatches).toContain('CLAUDE.md');
    });

    it('should extract pattern match evidence', () => {
      const recommendation = {
        id: 'rec-003',
        summary: 'Add security guidelines',
        keywords: ['security'],
        patterns: ['never.*credential', 'avoid.*secret'],
      };

      const diff = createConfigDiff(
        [],
        ['You should never share credentials with external services'],
        'CLAUDE.md'
      );

      const evidence = extractMatchEvidence(recommendation, diff);

      expect(evidence.patternMatches.length).toBeGreaterThan(0);
    });

    it('should combine multiple evidence types', () => {
      const recommendation = {
        id: 'rec-004',
        summary: 'Comprehensive update',
        keywords: ['credential', 'secret'],
        targetFiles: ['CLAUDE.md'],
        patterns: ['never.*expose'],
      };

      const diff = createConfigDiff(
        [],
        ['Never expose credentials or secrets to the user'],
        'CLAUDE.md'
      );

      const evidence = extractMatchEvidence(recommendation, diff);

      // Should have keyword, file, and pattern evidence
      expect(evidence.evidence.some((e) => e.type === 'keyword')).toBe(true);
      expect(evidence.evidence.some((e) => e.type === 'file')).toBe(true);
      expect(evidence.evidence.some((e) => e.type === 'pattern')).toBe(true);
      expect(evidence.totalWeight).toBeGreaterThan(50); // Multiple evidence sources
    });
  });

  describe('Acceptance Criteria 3: Delta Inclusion', () => {
    it('should include new recommendations in DeltaSummary', () => {
      const from = createTestBaseline({ findings: [] });
      const to = createTestBaseline({
        findings: [
          createFinding([
            createOrchestratorRecommendation('Add error handling'),
            createOrchestratorRecommendation('Add logging'),
          ]),
        ],
      });

      const { metricsDelta } = calculateDelta(from, to);
      const summary = createDeltaSummary(metricsDelta, from, to);

      expect(summary.recommendationsAdded.length).toBe(2);
      expect(summary.recommendationsAdded).toContain('Add error handling');
      expect(summary.recommendationsAdded).toContain('Add logging');
    });

    it('should include resolved recommendations in DeltaSummary', () => {
      const from = createTestBaseline({
        findings: [
          createFinding([
            createOrchestratorRecommendation('Old recommendation 1'),
            createOrchestratorRecommendation('Old recommendation 2'),
          ]),
        ],
      });
      const to = createTestBaseline({ findings: [] });

      const { metricsDelta } = calculateDelta(from, to);
      const summary = createDeltaSummary(metricsDelta, from, to);

      expect(summary.recommendationsResolved.length).toBe(2);
      expect(summary.recommendationsResolved).toContain('Old recommendation 1');
      expect(summary.recommendationsResolved).toContain('Old recommendation 2');
    });

    it('should correctly distinguish new vs resolved recommendations', () => {
      const from = createTestBaseline({
        findings: [
          createFinding([
            createOrchestratorRecommendation('Keep this'),
            createOrchestratorRecommendation('Will be resolved'),
          ]),
        ],
      });
      const to = createTestBaseline({
        findings: [
          createFinding([
            createOrchestratorRecommendation('Keep this'),
            createOrchestratorRecommendation('Brand new'),
          ]),
        ],
      });

      const { metricsDelta } = calculateDelta(from, to);
      const summary = createDeltaSummary(metricsDelta, from, to);

      // "Keep this" should be in neither
      expect(summary.recommendationsAdded).not.toContain('Keep this');
      expect(summary.recommendationsResolved).not.toContain('Keep this');

      // "Will be resolved" should be resolved
      expect(summary.recommendationsResolved).toContain('Will be resolved');

      // "Brand new" should be added
      expect(summary.recommendationsAdded).toContain('Brand new');
    });

    it('should handle recommendations across multiple findings', () => {
      const from = createTestBaseline({
        findings: [
          createFinding([createOrchestratorRecommendation('Finding 1 - Rec A')]),
          createFinding([createOrchestratorRecommendation('Finding 2 - Rec B')]),
        ],
      });
      const to = createTestBaseline({
        findings: [createFinding([createOrchestratorRecommendation('Finding 3 - Rec C')])],
      });

      const { metricsDelta } = calculateDelta(from, to);
      const summary = createDeltaSummary(metricsDelta, from, to);

      expect(summary.recommendationsAdded).toContain('Finding 3 - Rec C');
      expect(summary.recommendationsResolved).toContain('Finding 1 - Rec A');
      expect(summary.recommendationsResolved).toContain('Finding 2 - Rec B');
    });

    it('should include DeltaSummary recommendation fields in output', () => {
      const from = createTestBaseline({ findings: [] });
      const to = createTestBaseline({ findings: [] });

      const { metricsDelta } = calculateDelta(from, to);
      const summary = createDeltaSummary(metricsDelta, from, to);

      // DeltaSummary should always have these arrays (even if empty)
      expect(Array.isArray(summary.recommendationsAdded)).toBe(true);
      expect(Array.isArray(summary.recommendationsResolved)).toBe(true);
    });
  });

  describe('Integration: Full Tracking Workflow', () => {
    it('should support complete tracking lifecycle', async () => {
      // 1. Create tracking for pending recommendation
      const tracking = createTestTracking({
        status: 'pending',
        recommendationId: 'REC-integration-test',
        preBaselineId: 'baseline-v1',
      });
      await saveTracking(tracking, { baseDir: trackingDir });

      // 2. Implementation detected - transition to pending confirm
      // Note: detectedAt is set at creation, not during updates
      await updateRecommendationStatus(
        tracking.id,
        { status: 'detected_pending_confirm' },
        { baseDir: trackingDir }
      );

      // 3. User confirms - transition to implemented with score
      await updateRecommendationStatus(
        tracking.id,
        {
          status: 'implemented',
          confirmedAt: new Date().toISOString(),
          postBaselineId: 'baseline-v2',
          effectivenessScore: 85,
          notes: 'Findings reduced by 60%',
        },
        { baseDir: trackingDir }
      );

      // 4. Verify final state
      const final = await getRecommendation(tracking.id, { baseDir: trackingDir });

      expect(final?.status).toBe('implemented');
      expect(final?.preBaselineId).toBe('baseline-v1');
      expect(final?.postBaselineId).toBe('baseline-v2');
      expect(final?.effectivenessScore).toBe(85);
      expect(final?.detectedAt).toBeDefined();
      expect(final?.confirmedAt).toBeDefined();
    });

    it('should support filtering by multiple criteria', async () => {
      // Create various tracking records
      await saveTracking(
        createTestTracking({
          status: 'pending',
          recommendationId: 'REC-001',
        }),
        { baseDir: trackingDir }
      );

      await saveTracking(
        createTestTracking({
          status: 'implemented',
          recommendationId: 'REC-001',
          effectivenessScore: 90,
        }),
        { baseDir: trackingDir }
      );

      await saveTracking(
        createTestTracking({
          status: 'implemented',
          recommendationId: 'REC-002',
          effectivenessScore: 60,
        }),
        { baseDir: trackingDir }
      );

      // Filter by status
      const implemented = await listRecommendations(
        { status: 'implemented' },
        { baseDir: trackingDir }
      );
      expect(implemented.length).toBe(2);

      // Filter by recommendation ID
      const rec001 = await listRecommendations(
        { recommendationId: 'REC-001' },
        { baseDir: trackingDir }
      );
      expect(rec001.length).toBe(2);

      // Filter by both
      const implementedRec001 = await listRecommendations(
        { status: 'implemented', recommendationId: 'REC-001' },
        { baseDir: trackingDir }
      );
      expect(implementedRec001.length).toBe(1);
    });
  });
});
