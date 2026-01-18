/**
 * VCR Test Fixtures for Temporal Analysis Integration Tests
 *
 * Provides sample baselines, expected outputs, and factory functions
 * for deterministic integration testing per ADR-0011.
 *
 * @module tests/lib/fixtures
 */

import type { Baseline, BaselineMetrics } from '../../src/persistence/types';
import type { Finding } from '../../src/orchestration/types';
import type { DeltaSummary, MetricChange } from '../../src/temporal/types';

// =============================================================================
// Baseline Fixtures
// =============================================================================

/**
 * Create a test baseline with configurable values.
 *
 * @param overrides - Partial baseline values to override defaults
 * @returns A complete Baseline object
 */
export function createTestBaseline(overrides: Partial<Baseline> = {}): Baseline {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? crypto.randomUUID(),
    version: '1.0.0',
    createdAt: now,
    projectPath: '/test/project',
    actType: 'claude-code',
    configPath: null,
    gitCommit: null,
    metrics: createTestMetrics(overrides.metrics),
    findings: overrides.findings ?? [],
    label: null,
    notes: null,
    ...overrides,
  };
}

/**
 * Create test baseline metrics with configurable values.
 *
 * @param overrides - Partial metrics values to override defaults
 * @returns Complete BaselineMetrics object
 */
export function createTestMetrics(overrides: Partial<BaselineMetrics> = {}): BaselineMetrics {
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

/**
 * Create a test finding with configurable values.
 *
 * @param overrides - Partial finding values to override defaults
 * @returns Complete Finding object
 */
export function createTestFinding(overrides: Partial<Finding> = {}): Finding {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? 'finding-' + Math.random().toString(36).slice(2, 10),
    type: 'config_gap',
    severity: 'medium',
    title: 'Test Finding',
    description: 'Test finding description',
    location: { file: '/test/file.md', line: 1 },
    origin: null,
    recommendations: [],
    detectedAt: now,
    detectedInPhase: 'analysis',
    ...overrides,
  };
}

// =============================================================================
// Sample Data Sets
// =============================================================================

/**
 * Sample baseline representing a "before refactor" state.
 * Higher finding counts, lower quality scores.
 */
export const SAMPLE_BASELINE_BEFORE: Baseline = {
  id: 'baseline-before-refactor',
  version: '1.0.0',
  createdAt: '2026-01-15T10:00:00.000Z',
  projectPath: '/test/project',
  actType: 'claude-code',
  configPath: '/test/project/CLAUDE.md',
  gitCommit: 'abc1234567890',
  metrics: {
    findingsCount: 25,
    criticalCount: 3,
    highCount: 7,
    mediumCount: 10,
    lowCount: 5,
    infoCount: 0,
    avgTokensPerSession: 5000,
    avgIterationsPerSession: 8,
    sessionCount: 15,
    errorRate: 0.12,
    configTokens: 2500,
    configLines: 150,
    warningCount: 8,
    sectionCount: 4,
    coverageScore: 65,
  },
  findings: [
    {
      id: 'finding-1',
      type: 'config_antipattern',
      severity: 'critical',
      title: 'Generic rule with no context',
      description: 'Configuration contains generic rules without project-specific context',
      location: { file: '/test/project/CLAUDE.md', line: 15 },
      origin: null,
      recommendations: [],
      detectedAt: '2026-01-15T10:00:00.000Z',
      detectedInPhase: 'analysis',
    },
    {
      id: 'finding-2',
      type: 'config_gap',
      severity: 'high',
      title: 'Missing testing guidance',
      description: 'No testing instructions found in configuration',
      location: { file: '/test/project/CLAUDE.md', line: 42 },
      origin: null,
      recommendations: [],
      detectedAt: '2026-01-15T10:00:00.000Z',
      detectedInPhase: 'analysis',
    },
    {
      id: 'finding-3',
      type: 'session_pattern',
      severity: 'high',
      title: 'High iteration count detected',
      description: 'Sessions show excessive iteration patterns',
      location: null,
      origin: null,
      recommendations: [],
      detectedAt: '2026-01-15T10:00:00.000Z',
      detectedInPhase: 'analysis',
    },
  ],
  label: 'before-refactor',
  notes: 'Captured before major config cleanup',
};

/**
 * Sample baseline representing an "after refactor" state.
 * Lower finding counts, higher quality scores.
 */
export const SAMPLE_BASELINE_AFTER: Baseline = {
  id: 'baseline-after-refactor',
  version: '1.0.0',
  createdAt: '2026-01-16T14:00:00.000Z',
  projectPath: '/test/project',
  actType: 'claude-code',
  configPath: '/test/project/CLAUDE.md',
  gitCommit: 'def7890123456',
  metrics: {
    findingsCount: 8,
    criticalCount: 0,
    highCount: 2,
    mediumCount: 4,
    lowCount: 2,
    infoCount: 0,
    avgTokensPerSession: 3500,
    avgIterationsPerSession: 5,
    sessionCount: 20,
    errorRate: 0.05,
    configTokens: 3200,
    configLines: 180,
    warningCount: 2,
    sectionCount: 6,
    coverageScore: 85,
  },
  findings: [
    {
      id: 'finding-4',
      type: 'quality_issue',
      severity: 'medium',
      title: 'Consider adding more examples',
      description: 'Configuration would benefit from additional examples',
      location: { file: '/test/project/CLAUDE.md', line: 88 },
      origin: null,
      recommendations: [],
      detectedAt: '2026-01-16T14:00:00.000Z',
      detectedInPhase: 'analysis',
    },
    {
      id: 'finding-5',
      type: 'quality_issue',
      severity: 'low',
      title: 'Formatting suggestion',
      description: 'Minor formatting improvements possible',
      location: { file: '/test/project/CLAUDE.md', line: 120 },
      origin: null,
      recommendations: [],
      detectedAt: '2026-01-16T14:00:00.000Z',
      detectedInPhase: 'analysis',
    },
  ],
  label: 'after-refactor',
  notes: 'Captured after config cleanup and restructure',
};

/**
 * Sample baseline for regression testing (metrics got worse).
 */
export const SAMPLE_BASELINE_REGRESSION: Baseline = {
  id: 'baseline-regression',
  version: '1.0.0',
  createdAt: '2026-01-17T09:00:00.000Z',
  projectPath: '/test/project',
  actType: 'claude-code',
  configPath: '/test/project/CLAUDE.md',
  gitCommit: 'ghi4567890123',
  metrics: {
    findingsCount: 15,
    criticalCount: 2,
    highCount: 4,
    mediumCount: 6,
    lowCount: 3,
    infoCount: 0,
    avgTokensPerSession: 4200,
    avgIterationsPerSession: 7,
    sessionCount: 25,
    errorRate: 0.08,
    configTokens: 2800,
    configLines: 160,
    warningCount: 5,
    sectionCount: 5,
    coverageScore: 72,
  },
  findings: [],
  label: 'regression',
  notes: 'New issues introduced after rushed changes',
};

// =============================================================================
// Expected Outputs
// =============================================================================

/**
 * Create a MetricChange object with all required fields.
 * Per ADR-0019, isImprovement was removed - agent interprets meaning.
 */
function createMetricChange(name: string, from: number, to: number): MetricChange {
  const change = to - from;
  const percentChange = from === 0 ? (to === 0 ? 0 : 100) : ((to - from) / from) * 100;
  let direction: '↑' | '↓' | '→';
  if (change > 0) {
    direction = '↑';
  } else if (change < 0) {
    direction = '↓';
  } else {
    direction = '→';
  }
  return { name, from, to, change, percentChange, direction };
}

/**
 * Expected delta summary when comparing BEFORE → AFTER baselines.
 * Shows metric changes (agent interprets meaning per ADR-0019).
 */
export const EXPECTED_DELTA_BEFORE_TO_AFTER: DeltaSummary = {
  changeCounts: { increased: 1, decreased: 6, unchanged: 0 },
  metricsChanged: [
    createMetricChange('findingsCount', 25, 8),
    createMetricChange('criticalCount', 3, 0),
    createMetricChange('highCount', 7, 2),
    createMetricChange('avgTokensPerSession', 5000, 3500),
    createMetricChange('avgIterationsPerSession', 8, 5),
    createMetricChange('errorRate', 0.12, 0.05),
    createMetricChange('coverageScore', 65, 85),
  ],
  warningsAdded: [],
  warningsResolved: ['Generic rule with no context'],
  recommendationsAdded: [],
  recommendationsResolved: [],
  trendIndicators: [
    { metric: 'findingsCount', indicator: '↓', label: 'Findings decreased' },
    { metric: 'criticalCount', indicator: '↓', label: 'Critical issues eliminated' },
  ],
};

/**
 * Expected delta summary when comparing AFTER → REGRESSION baselines.
 * Should show regression (increasing findings, worse metrics).
 */
export const EXPECTED_DELTA_AFTER_TO_REGRESSION: DeltaSummary = {
  changeCounts: { increased: 4, decreased: 1, unchanged: 0 },
  metricsChanged: [
    createMetricChange('findingsCount', 8, 15),
    createMetricChange('criticalCount', 0, 2),
    createMetricChange('avgTokensPerSession', 3500, 4200),
    createMetricChange('errorRate', 0.05, 0.08),
    createMetricChange('coverageScore', 85, 72),
  ],
  warningsAdded: ['New critical issues detected'],
  warningsResolved: [],
  recommendationsAdded: [],
  recommendationsResolved: [],
  trendIndicators: [
    { metric: 'findingsCount', indicator: '↑', label: 'Findings increased' },
    { metric: 'criticalCount', indicator: '↑', label: 'Critical issues reintroduced' },
  ],
};

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a series of baselines representing progression over time.
 *
 * @param count - Number of baselines to generate
 * @param trend - Overall trend direction
 * @returns Array of baselines with sequential timestamps
 */
export function createBaselineSeries(
  count: number,
  trend: 'improving' | 'regressing' | 'stable' = 'stable'
): Baseline[] {
  const baselines: Baseline[] = [];
  const startDate = new Date('2026-01-01T00:00:00.000Z');

  for (let i = 0; i < count; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    let findingsCount: number;

    switch (trend) {
      case 'improving':
        findingsCount = Math.max(5, 25 - i * 2);
        break;
      case 'regressing':
        findingsCount = 5 + i * 3;
        break;
      default:
        findingsCount = 15 + Math.floor(Math.random() * 4) - 2;
    }

    baselines.push(
      createTestBaseline({
        id: `baseline-${i + 1}`,
        createdAt: date.toISOString(),
        label: `day-${i + 1}`,
        metrics: createTestMetrics({
          findingsCount,
          criticalCount: Math.floor(findingsCount * 0.1),
          highCount: Math.floor(findingsCount * 0.2),
          mediumCount: Math.floor(findingsCount * 0.3),
          lowCount: Math.floor(findingsCount * 0.3),
          infoCount: Math.floor(findingsCount * 0.1),
        }),
      })
    );
  }

  return baselines;
}

/**
 * Create expected VCR recording for a store_baseline operation.
 *
 * @param baseline - The baseline being stored
 * @returns VCR recording object
 */
export function createStoreBaselineRecording(baseline: Baseline): {
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: unknown;
  };
  timestamp: string;
} {
  return {
    request: {
      url: 'agentlint://store_baseline',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { baseline },
    },
    response: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: { success: true, id: baseline.id },
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create expected VCR recording for a calculate_delta operation.
 *
 * @param fromBaseline - Source baseline
 * @param toBaseline - Target baseline
 * @param summary - Expected delta summary
 * @returns VCR recording object
 */
export function createDeltaRecording(
  fromBaseline: Baseline,
  toBaseline: Baseline,
  summary: DeltaSummary
): {
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: unknown;
  };
  timestamp: string;
} {
  return {
    request: {
      url: 'agentlint://calculate_delta',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { fromId: fromBaseline.id, toId: toBaseline.id },
    },
    response: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        success: true,
        delta: {
          fromId: fromBaseline.id,
          toId: toBaseline.id,
          fromTimestamp: fromBaseline.createdAt,
          toTimestamp: toBaseline.createdAt,
          summary,
        },
      },
    },
    timestamp: new Date().toISOString(),
  };
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Check if a baseline matches expected structure.
 *
 * @param baseline - Baseline to validate
 * @returns True if valid, throws if invalid
 */
export function isValidBaseline(baseline: unknown): baseline is Baseline {
  if (typeof baseline !== 'object' || baseline === null) {
    return false;
  }

  const b = baseline as Record<string, unknown>;

  return (
    typeof b.id === 'string' &&
    typeof b.version === 'string' &&
    typeof b.createdAt === 'string' &&
    typeof b.projectPath === 'string' &&
    typeof b.actType === 'string' &&
    typeof b.metrics === 'object' &&
    b.metrics !== null &&
    Array.isArray(b.findings)
  );
}

/**
 * Check if a delta summary has the expected structure.
 *
 * @param summary - Summary to validate
 * @returns True if valid
 */
export function isValidDeltaSummary(summary: unknown): summary is DeltaSummary {
  if (typeof summary !== 'object' || summary === null) {
    return false;
  }

  const s = summary as Record<string, unknown>;

  // Per ADR-0019, uses changeCounts instead of overallTrend
  const hasValidChangeCounts =
    typeof s.changeCounts === 'object' &&
    s.changeCounts !== null &&
    typeof (s.changeCounts as Record<string, unknown>).increased === 'number' &&
    typeof (s.changeCounts as Record<string, unknown>).decreased === 'number' &&
    typeof (s.changeCounts as Record<string, unknown>).unchanged === 'number';

  return (
    hasValidChangeCounts &&
    Array.isArray(s.metricsChanged) &&
    Array.isArray(s.warningsAdded) &&
    Array.isArray(s.warningsResolved) &&
    Array.isArray(s.trendIndicators)
  );
}

/**
 * Compare two baselines for equality (ignoring volatile fields).
 *
 * @param a - First baseline
 * @param b - Second baseline
 * @returns True if baselines are equivalent
 */
export function baselinesEqual(a: Baseline, b: Baseline): boolean {
  return (
    a.id === b.id &&
    a.projectPath === b.projectPath &&
    a.actType === b.actType &&
    a.metrics.findingsCount === b.metrics.findingsCount &&
    a.metrics.criticalCount === b.metrics.criticalCount &&
    a.findings.length === b.findings.length
  );
}
