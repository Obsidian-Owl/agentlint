/**
 * Unit tests for temporal/delta/summarizer.ts
 *
 * Tests delta summarization including:
 * - Metric change detection and formatting
 * - Recommendation tracking (T047: detect new/resolved recommendations)
 * - Warning tracking
 * - Trend indicators
 * - Change counts (per ADR-0019)
 *
 * @module temporal/delta/__tests__/summarizer.test
 */

import { describe, it, expect } from 'bun:test';

import { createDeltaSummary, formatDeltaSummary } from '../summarizer';
import { calculateDelta } from '../calculator';
import type { Baseline, BaselineMetrics } from '../../../persistence/types';
import type { Finding, Recommendation, Severity, FindingType } from '../../../orchestration/types';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestMetrics(overrides: Partial<BaselineMetrics> = {}): BaselineMetrics {
  return {
    findingsCount: 10,
    criticalCount: 1,
    highCount: 2,
    mediumCount: 3,
    lowCount: 4,
    infoCount: 0,
    ...overrides,
  };
}

function createTestRecommendation(
  action: string,
  overrides: Partial<Recommendation> = {}
): Recommendation {
  return {
    type: 'preventive',
    action,
    rationale: `Rationale for ${action}`,
    priority: 'medium',
    effort: 'small',
    ...overrides,
  };
}

function createTestFinding(
  id: string,
  recommendations: Recommendation[],
  overrides: Partial<Finding> = {}
): Finding {
  return {
    id,
    type: 'config_gap' as FindingType,
    severity: 'medium' as Severity,
    title: `Finding ${id}`,
    description: `Description for ${id}`,
    location: null,
    origin: null,
    recommendations,
    detectedAt: new Date().toISOString(),
    detectedInPhase: 'analyze',
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
    metrics: createTestMetrics(),
    findings: [],
    label: null,
    notes: null,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('temporal/delta/summarizer', () => {
  describe('createDeltaSummary', () => {
    describe('metric changes', () => {
      it('should detect increased metrics', () => {
        const from = createTestBaseline({
          metrics: createTestMetrics({ findingsCount: 5 }),
        });
        const to = createTestBaseline({
          metrics: createTestMetrics({ findingsCount: 10 }),
        });

        const { metricsDelta } = calculateDelta(from, to);
        const summary = createDeltaSummary(metricsDelta, from, to);

        expect(summary.changeCounts.increased).toBeGreaterThan(0);
        const findingsChange = summary.metricsChanged.find((c) => c.name === 'findingsCount');
        expect(findingsChange).toBeDefined();
        expect(findingsChange?.direction).toBe('↑');
        expect(findingsChange?.from).toBe(5);
        expect(findingsChange?.to).toBe(10);
      });

      it('should detect decreased metrics', () => {
        const from = createTestBaseline({
          metrics: createTestMetrics({ criticalCount: 5 }),
        });
        const to = createTestBaseline({
          metrics: createTestMetrics({ criticalCount: 2 }),
        });

        const { metricsDelta } = calculateDelta(from, to);
        const summary = createDeltaSummary(metricsDelta, from, to);

        expect(summary.changeCounts.decreased).toBeGreaterThan(0);
        const criticalChange = summary.metricsChanged.find((c) => c.name === 'criticalCount');
        expect(criticalChange).toBeDefined();
        expect(criticalChange?.direction).toBe('↓');
      });

      it('should handle unchanged metrics', () => {
        const from = createTestBaseline();
        const to = createTestBaseline();

        const { metricsDelta } = calculateDelta(from, to);
        const summary = createDeltaSummary(metricsDelta, from, to);

        expect(summary.metricsChanged.length).toBe(0);
        expect(summary.changeCounts.increased).toBe(0);
        expect(summary.changeCounts.decreased).toBe(0);
        expect(summary.changeCounts.unchanged).toBe(0);
      });

      it('should calculate percent change correctly', () => {
        const from = createTestBaseline({
          metrics: createTestMetrics({ findingsCount: 100 }),
        });
        const to = createTestBaseline({
          metrics: createTestMetrics({ findingsCount: 150 }),
        });

        const { metricsDelta } = calculateDelta(from, to);
        const summary = createDeltaSummary(metricsDelta, from, to);

        const findingsChange = summary.metricsChanged.find((c) => c.name === 'findingsCount');
        expect(findingsChange?.percentChange).toBe(50);
      });
    });

    describe('recommendation tracking (T047)', () => {
      it('should detect new recommendations', () => {
        const from = createTestBaseline({ findings: [] });
        const to = createTestBaseline({
          findings: [
            createTestFinding('f1', [
              createTestRecommendation('Add error handling'),
              createTestRecommendation('Add logging'),
            ]),
          ],
        });

        const { metricsDelta } = calculateDelta(from, to);
        const summary = createDeltaSummary(metricsDelta, from, to);

        expect(summary.recommendationsAdded.length).toBe(2);
        expect(summary.recommendationsAdded).toContain('Add error handling');
        expect(summary.recommendationsAdded).toContain('Add logging');
      });

      it('should detect resolved recommendations', () => {
        const from = createTestBaseline({
          findings: [
            createTestFinding('f1', [
              createTestRecommendation('Add error handling'),
              createTestRecommendation('Add logging'),
            ]),
          ],
        });
        const to = createTestBaseline({ findings: [] });

        const { metricsDelta } = calculateDelta(from, to);
        const summary = createDeltaSummary(metricsDelta, from, to);

        expect(summary.recommendationsResolved.length).toBe(2);
        expect(summary.recommendationsResolved).toContain('Add error handling');
        expect(summary.recommendationsResolved).toContain('Add logging');
      });

      it('should handle mixed recommendation changes', () => {
        const from = createTestBaseline({
          findings: [
            createTestFinding('f1', [
              createTestRecommendation('Add error handling'),
              createTestRecommendation('Add logging'),
            ]),
          ],
        });
        const to = createTestBaseline({
          findings: [
            createTestFinding('f2', [
              createTestRecommendation('Add logging'), // Still present
              createTestRecommendation('Add validation'), // New
            ]),
          ],
        });

        const { metricsDelta } = calculateDelta(from, to);
        const summary = createDeltaSummary(metricsDelta, from, to);

        // 'Add logging' still present - not in added or resolved
        // 'Add error handling' removed - in resolved
        // 'Add validation' added - in added
        expect(summary.recommendationsAdded).toContain('Add validation');
        expect(summary.recommendationsResolved).toContain('Add error handling');
        expect(summary.recommendationsAdded).not.toContain('Add logging');
        expect(summary.recommendationsResolved).not.toContain('Add logging');
      });

      it('should handle recommendations across multiple findings', () => {
        const from = createTestBaseline({
          findings: [
            createTestFinding('f1', [createTestRecommendation('Fix A')]),
            createTestFinding('f2', [createTestRecommendation('Fix B')]),
          ],
        });
        const to = createTestBaseline({
          findings: [createTestFinding('f3', [createTestRecommendation('Fix C')])],
        });

        const { metricsDelta } = calculateDelta(from, to);
        const summary = createDeltaSummary(metricsDelta, from, to);

        expect(summary.recommendationsAdded).toContain('Fix C');
        expect(summary.recommendationsResolved).toContain('Fix A');
        expect(summary.recommendationsResolved).toContain('Fix B');
      });

      it('should handle duplicate recommendation actions', () => {
        // Same action from different findings should only count once
        const from = createTestBaseline({
          findings: [
            createTestFinding('f1', [createTestRecommendation('Add tests')]),
            createTestFinding('f2', [createTestRecommendation('Add tests')]), // Same action
          ],
        });
        const to = createTestBaseline({ findings: [] });

        const { metricsDelta } = calculateDelta(from, to);
        const summary = createDeltaSummary(metricsDelta, from, to);

        // Should only appear once since we use Set for comparison
        expect(summary.recommendationsResolved.filter((r) => r === 'Add tests').length).toBe(1);
      });

      it('should include recommendations in DeltaSummary', () => {
        const from = createTestBaseline({ findings: [] });
        const to = createTestBaseline({
          findings: [createTestFinding('f1', [createTestRecommendation('New recommendation')])],
        });

        const { metricsDelta } = calculateDelta(from, to);
        const summary = createDeltaSummary(metricsDelta, from, to);

        // Verify structure per DeltaSummary interface
        expect(summary).toHaveProperty('recommendationsAdded');
        expect(summary).toHaveProperty('recommendationsResolved');
        expect(Array.isArray(summary.recommendationsAdded)).toBe(true);
        expect(Array.isArray(summary.recommendationsResolved)).toBe(true);
      });
    });

    describe('warning tracking', () => {
      it('should detect new warnings via warningCount', () => {
        const from = createTestBaseline({
          metrics: createTestMetrics({ warningCount: 0 }),
        });
        const to = createTestBaseline({
          metrics: createTestMetrics({ warningCount: 3 }),
        });

        const { metricsDelta } = calculateDelta(from, to);
        const summary = createDeltaSummary(metricsDelta, from, to);

        expect(summary.warningsAdded.length).toBe(1);
        expect(summary.warningsAdded[0]).toContain('3 new warning(s)');
      });

      it('should detect resolved warnings via warningCount', () => {
        const from = createTestBaseline({
          metrics: createTestMetrics({ warningCount: 5 }),
        });
        const to = createTestBaseline({
          metrics: createTestMetrics({ warningCount: 2 }),
        });

        const { metricsDelta } = calculateDelta(from, to);
        const summary = createDeltaSummary(metricsDelta, from, to);

        expect(summary.warningsResolved.length).toBe(1);
        expect(summary.warningsResolved[0]).toContain('3 warning(s) resolved');
      });
    });

    describe('trend indicators', () => {
      it('should generate trend indicators for significant changes', () => {
        const from = createTestBaseline({
          metrics: createTestMetrics({ findingsCount: 10 }),
        });
        const to = createTestBaseline({
          metrics: createTestMetrics({ findingsCount: 20 }),
        });

        const { metricsDelta } = calculateDelta(from, to);
        const summary = createDeltaSummary(metricsDelta, from, to);

        expect(summary.trendIndicators.length).toBeGreaterThan(0);
        const findingsTrend = summary.trendIndicators.find((t) => t.metric === 'findingsCount');
        expect(findingsTrend).toBeDefined();
        expect(findingsTrend?.indicator).toBe('↑');
      });
    });

    describe('ADR-0019 compliance', () => {
      it('should return changeCounts instead of overallTrend', () => {
        const from = createTestBaseline({
          metrics: createTestMetrics({ findingsCount: 10, criticalCount: 5 }),
        });
        const to = createTestBaseline({
          metrics: createTestMetrics({ findingsCount: 5, criticalCount: 10 }),
        });

        const { metricsDelta } = calculateDelta(from, to);
        const summary = createDeltaSummary(metricsDelta, from, to);

        // Should have changeCounts
        expect(summary.changeCounts).toBeDefined();
        expect(summary.changeCounts.increased).toBeGreaterThanOrEqual(0);
        expect(summary.changeCounts.decreased).toBeGreaterThanOrEqual(0);
        expect(summary.changeCounts.unchanged).toBeGreaterThanOrEqual(0);

        // Should NOT have overallTrend (judgment)
        expect(summary).not.toHaveProperty('overallTrend');
      });

      it('should not include isImprovement in metric changes', () => {
        const from = createTestBaseline({
          metrics: createTestMetrics({ findingsCount: 10 }),
        });
        const to = createTestBaseline({
          metrics: createTestMetrics({ findingsCount: 5 }),
        });

        const { metricsDelta } = calculateDelta(from, to);
        const summary = createDeltaSummary(metricsDelta, from, to);

        for (const change of summary.metricsChanged) {
          expect(change).not.toHaveProperty('isImprovement');
        }
      });
    });
  });

  describe('formatDeltaSummary', () => {
    it('should format change counts header', () => {
      const from = createTestBaseline({
        metrics: createTestMetrics({ findingsCount: 5, criticalCount: 10 }),
      });
      const to = createTestBaseline({
        metrics: createTestMetrics({ findingsCount: 10, criticalCount: 5 }),
      });

      const { metricsDelta } = calculateDelta(from, to);
      const summary = createDeltaSummary(metricsDelta, from, to);
      const formatted = formatDeltaSummary(summary);

      expect(formatted).toContain('## Delta Summary');
      expect(formatted).toContain('**Changes**:');
      expect(formatted).toContain('↑ increased');
      expect(formatted).toContain('↓ decreased');
    });

    it('should format metric changes', () => {
      const from = createTestBaseline({
        metrics: createTestMetrics({ findingsCount: 10 }),
      });
      const to = createTestBaseline({
        metrics: createTestMetrics({ findingsCount: 15 }),
      });

      const { metricsDelta } = calculateDelta(from, to);
      const summary = createDeltaSummary(metricsDelta, from, to);
      const formatted = formatDeltaSummary(summary);

      expect(formatted).toContain('### Metric Changes');
      expect(formatted).toContain('**findingsCount**');
      expect(formatted).toContain('10 → 15');
    });

    it('should format new warnings', () => {
      const from = createTestBaseline({
        metrics: createTestMetrics({ warningCount: 0 }),
      });
      const to = createTestBaseline({
        metrics: createTestMetrics({ warningCount: 2 }),
      });

      const { metricsDelta } = calculateDelta(from, to);
      const summary = createDeltaSummary(metricsDelta, from, to);
      const formatted = formatDeltaSummary(summary);

      expect(formatted).toContain('### New Warnings');
      expect(formatted).toContain('⚠️');
    });

    it('should format resolved warnings', () => {
      const from = createTestBaseline({
        metrics: createTestMetrics({ warningCount: 3 }),
      });
      const to = createTestBaseline({
        metrics: createTestMetrics({ warningCount: 1 }),
      });

      const { metricsDelta } = calculateDelta(from, to);
      const summary = createDeltaSummary(metricsDelta, from, to);
      const formatted = formatDeltaSummary(summary);

      expect(formatted).toContain('### Resolved Warnings');
      expect(formatted).toContain('✅');
    });

    it('should format new recommendations', () => {
      const from = createTestBaseline({ findings: [] });
      const to = createTestBaseline({
        findings: [createTestFinding('f1', [createTestRecommendation('Add error handling')])],
      });

      const { metricsDelta } = calculateDelta(from, to);
      const summary = createDeltaSummary(metricsDelta, from, to);
      const formatted = formatDeltaSummary(summary);

      expect(formatted).toContain('### New Recommendations');
      expect(formatted).toContain('💡');
      expect(formatted).toContain('Add error handling');
    });

    it('should format addressed recommendations', () => {
      const from = createTestBaseline({
        findings: [createTestFinding('f1', [createTestRecommendation('Add error handling')])],
      });
      const to = createTestBaseline({ findings: [] });

      const { metricsDelta } = calculateDelta(from, to);
      const summary = createDeltaSummary(metricsDelta, from, to);
      const formatted = formatDeltaSummary(summary);

      expect(formatted).toContain('### Addressed Recommendations');
      expect(formatted).toContain('✓');
      expect(formatted).toContain('Add error handling');
    });

    it('should handle empty summary gracefully', () => {
      const baseline = createTestBaseline();

      const { metricsDelta } = calculateDelta(baseline, baseline);
      const summary = createDeltaSummary(metricsDelta, baseline, baseline);
      const formatted = formatDeltaSummary(summary);

      expect(formatted).toContain('## Delta Summary');
      expect(formatted).not.toContain('### Metric Changes');
      expect(formatted).not.toContain('### New Warnings');
      expect(formatted).not.toContain('### Resolved Warnings');
    });
  });
});
