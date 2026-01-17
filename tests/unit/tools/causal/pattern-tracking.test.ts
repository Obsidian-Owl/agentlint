/**
 * EP07 Causal Tracing Engine - Pattern Tracking Tests (T059)
 *
 * Unit tests for pattern tracking that monitors frequency and severity
 * of issue patterns over time.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { v4 as uuidv4 } from 'uuid';

import type { IssuePattern } from '../../../../src/tools/causal/types';

// =============================================================================
// Test Fixtures
// =============================================================================

const TEST_BASE_DIR = join(tmpdir(), 'agentlint-pattern-tracking-test');

/**
 * Create a test issue pattern.
 */
function createTestPattern(overrides: Partial<IssuePattern> = {}): IssuePattern {
  return {
    id: uuidv4(),
    category: 'missing_guidance',
    chainIds: [uuidv4()],
    frequency: 1,
    isSystemic: false,
    firstOccurrence: new Date().toISOString(),
    lastOccurrence: new Date().toISOString(),
    projectPath: '/test/project',
    summary: 'Test pattern',
    ...overrides,
  };
}

// =============================================================================
// PatternTracker Tests
// =============================================================================

describe('PatternTracker', () => {
  let PatternTracker: typeof import('../../../../src/tools/causal/pattern-tracking').PatternTracker;
  let createPatternTracker: typeof import('../../../../src/tools/causal/pattern-tracking').createPatternTracker;
  let SeverityLevel: typeof import('../../../../src/tools/causal/pattern-tracking').SeverityLevel;

  beforeEach(async () => {
    if (existsSync(TEST_BASE_DIR)) {
      rmSync(TEST_BASE_DIR, { recursive: true });
    }
    mkdirSync(TEST_BASE_DIR, { recursive: true });

    const module = await import('../../../../src/tools/causal/pattern-tracking');
    PatternTracker = module.PatternTracker;
    createPatternTracker = module.createPatternTracker;
    SeverityLevel = module.SeverityLevel;
  });

  afterEach(() => {
    if (existsSync(TEST_BASE_DIR)) {
      rmSync(TEST_BASE_DIR, { recursive: true });
    }
  });

  // ===========================================================================
  // Factory Function
  // ===========================================================================

  describe('createPatternTracker', () => {
    it('should create a PatternTracker instance', () => {
      const tracker = createPatternTracker();
      expect(tracker).toBeInstanceOf(PatternTracker);
    });
  });

  // ===========================================================================
  // Severity Assessment
  // ===========================================================================

  describe('assessSeverity', () => {
    it('should assess severity based on pattern frequency', () => {
      const tracker = createPatternTracker();

      // Low frequency = low severity
      const lowPattern = createTestPattern({ frequency: 1 });
      expect(tracker.assessSeverity(lowPattern)).toBe(SeverityLevel.LOW);

      // Medium frequency = medium severity
      const mediumPattern = createTestPattern({ frequency: 3 });
      expect(tracker.assessSeverity(mediumPattern)).toBe(SeverityLevel.MEDIUM);

      // High frequency = high severity
      const highPattern = createTestPattern({ frequency: 6 });
      expect(tracker.assessSeverity(highPattern)).toBe(SeverityLevel.HIGH);

      // Very high frequency = critical severity
      const criticalPattern = createTestPattern({ frequency: 10 });
      expect(tracker.assessSeverity(criticalPattern)).toBe(SeverityLevel.CRITICAL);
    });

    it('should consider pattern category in severity', () => {
      const tracker = createPatternTracker();

      // missing_config is more severe than missing_example
      const missingConfig = createTestPattern({
        frequency: 3,
        category: 'missing_config',
      });
      const missingExample = createTestPattern({
        frequency: 3,
        category: 'missing_example',
      });

      const configSeverity = tracker.assessSeverity(missingConfig);
      const exampleSeverity = tracker.assessSeverity(missingExample);

      // Config issues should be same or higher severity
      expect(configSeverity).toBeGreaterThanOrEqual(exampleSeverity);
    });

    it('should consider time span in severity', () => {
      const tracker = createPatternTracker();

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Same frequency, but recent pattern is more severe
      const recentPattern = createTestPattern({
        frequency: 5,
        firstOccurrence: oneWeekAgo.toISOString(),
        lastOccurrence: now.toISOString(),
      });

      const oldPattern = createTestPattern({
        frequency: 5,
        firstOccurrence: oneMonthAgo.toISOString(),
        lastOccurrence: oneMonthAgo.toISOString(),
      });

      const recentSeverity = tracker.assessSeverity(recentPattern);
      const oldSeverity = tracker.assessSeverity(oldPattern);

      // Recent issues are at least as severe
      expect(recentSeverity).toBeGreaterThanOrEqual(oldSeverity);
    });
  });

  // ===========================================================================
  // Frequency Tracking
  // ===========================================================================

  describe('trackFrequency', () => {
    it('should record frequency data point', () => {
      const tracker = createPatternTracker();
      const pattern = createTestPattern({ frequency: 3 });

      tracker.trackFrequency(pattern);
      const history = tracker.getFrequencyHistory(pattern.id);

      expect(history.length).toBe(1);
      expect(history[0]!.frequency).toBe(3);
    });

    it('should accumulate frequency history over time', () => {
      const tracker = createPatternTracker();
      const patternId = uuidv4();

      // Track multiple data points
      const pattern1 = createTestPattern({ id: patternId, frequency: 1 });
      tracker.trackFrequency(pattern1);

      const pattern2 = createTestPattern({ id: patternId, frequency: 2 });
      tracker.trackFrequency(pattern2);

      const pattern3 = createTestPattern({ id: patternId, frequency: 4 });
      tracker.trackFrequency(pattern3);

      const history = tracker.getFrequencyHistory(patternId);
      expect(history.length).toBe(3);
      expect(history[0]!.frequency).toBe(1);
      expect(history[2]!.frequency).toBe(4);
    });

    it('should include timestamp in frequency record', () => {
      const tracker = createPatternTracker();
      const pattern = createTestPattern();

      const before = new Date().toISOString();
      tracker.trackFrequency(pattern);
      const after = new Date().toISOString();

      const history = tracker.getFrequencyHistory(pattern.id);
      expect(history[0]!.timestamp).toBeDefined();
      expect(history[0]!.timestamp >= before).toBe(true);
      expect(history[0]!.timestamp <= after).toBe(true);
    });
  });

  // ===========================================================================
  // Trend Analysis
  // ===========================================================================

  describe('analyzeTrend', () => {
    it('should detect increasing trend', () => {
      const tracker = createPatternTracker();
      const patternId = uuidv4();

      // Increasing frequency
      for (let i = 1; i <= 5; i++) {
        tracker.trackFrequency(createTestPattern({ id: patternId, frequency: i }));
      }

      const trend = tracker.analyzeTrend(patternId);
      expect(trend.direction).toBe('increasing');
    });

    it('should detect decreasing trend', () => {
      const tracker = createPatternTracker();
      const patternId = uuidv4();

      // Decreasing frequency
      for (let i = 5; i >= 1; i--) {
        tracker.trackFrequency(createTestPattern({ id: patternId, frequency: i }));
      }

      const trend = tracker.analyzeTrend(patternId);
      expect(trend.direction).toBe('decreasing');
    });

    it('should detect stable trend', () => {
      const tracker = createPatternTracker();
      const patternId = uuidv4();

      // Stable frequency
      for (let i = 0; i < 5; i++) {
        tracker.trackFrequency(createTestPattern({ id: patternId, frequency: 3 }));
      }

      const trend = tracker.analyzeTrend(patternId);
      expect(trend.direction).toBe('stable');
    });

    it('should include rate of change in trend', () => {
      const tracker = createPatternTracker();
      const patternId = uuidv4();

      tracker.trackFrequency(createTestPattern({ id: patternId, frequency: 2 }));
      tracker.trackFrequency(createTestPattern({ id: patternId, frequency: 4 }));

      const trend = tracker.analyzeTrend(patternId);
      expect(trend.rateOfChange).toBeDefined();
      expect(trend.rateOfChange).toBeGreaterThan(0);
    });

    it('should handle insufficient data gracefully', () => {
      const tracker = createPatternTracker();
      const patternId = uuidv4();

      // Only one data point
      tracker.trackFrequency(createTestPattern({ id: patternId, frequency: 3 }));

      const trend = tracker.analyzeTrend(patternId);
      expect(trend.direction).toBe('unknown');
    });
  });

  // ===========================================================================
  // Severity History
  // ===========================================================================

  describe('trackSeverity', () => {
    it('should record severity alongside frequency', () => {
      const tracker = createPatternTracker();
      const pattern = createTestPattern({ frequency: 5 });

      tracker.trackFrequency(pattern);
      const history = tracker.getFrequencyHistory(pattern.id);

      expect(history[0]!.severity).toBeDefined();
    });

    it('should update severity as frequency changes', () => {
      const tracker = createPatternTracker();
      const patternId = uuidv4();

      // Low frequency = low severity
      tracker.trackFrequency(createTestPattern({ id: patternId, frequency: 1 }));

      // High frequency = higher severity
      tracker.trackFrequency(createTestPattern({ id: patternId, frequency: 10 }));

      const history = tracker.getFrequencyHistory(patternId);
      expect(history[0]!.severity).toBeLessThan(history[1]!.severity);
    });
  });

  // ===========================================================================
  // Pattern Summary
  // ===========================================================================

  describe('getPatternSummary', () => {
    it('should return summary with current state', () => {
      const tracker = createPatternTracker();
      const pattern = createTestPattern({ frequency: 5 });

      tracker.trackFrequency(pattern);
      const summary = tracker.getPatternSummary(pattern.id);

      expect(summary).toBeDefined();
      expect(summary!.currentFrequency).toBe(5);
      expect(summary!.currentSeverity).toBeDefined();
    });

    it('should include trend in summary', () => {
      const tracker = createPatternTracker();
      const patternId = uuidv4();

      for (let i = 1; i <= 3; i++) {
        tracker.trackFrequency(createTestPattern({ id: patternId, frequency: i }));
      }

      const summary = tracker.getPatternSummary(patternId);
      expect(summary!.trend).toBeDefined();
      expect(summary!.trend.direction).toBe('increasing');
    });

    it('should include first and last tracked times', () => {
      const tracker = createPatternTracker();
      const patternId = uuidv4();

      tracker.trackFrequency(createTestPattern({ id: patternId, frequency: 1 }));
      tracker.trackFrequency(createTestPattern({ id: patternId, frequency: 2 }));

      const summary = tracker.getPatternSummary(patternId);
      expect(summary!.firstTracked).toBeDefined();
      expect(summary!.lastTracked).toBeDefined();
      expect(summary!.firstTracked <= summary!.lastTracked).toBe(true);
    });

    it('should return undefined for unknown pattern', () => {
      const tracker = createPatternTracker();
      const summary = tracker.getPatternSummary('unknown-id');
      expect(summary).toBeUndefined();
    });
  });

  // ===========================================================================
  // Pattern Alerts
  // ===========================================================================

  describe('checkAlerts', () => {
    it('should generate alert for rapid frequency increase', () => {
      const tracker = createPatternTracker();
      const patternId = uuidv4();

      // Rapid increase in frequency
      tracker.trackFrequency(createTestPattern({ id: patternId, frequency: 1 }));
      tracker.trackFrequency(createTestPattern({ id: patternId, frequency: 5 }));
      tracker.trackFrequency(createTestPattern({ id: patternId, frequency: 10 }));

      const alerts = tracker.checkAlerts(patternId);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some((a) => a.type === 'rapid_increase')).toBe(true);
    });

    it('should generate alert when pattern becomes systemic', () => {
      const tracker = createPatternTracker();
      const patternId = uuidv4();

      // Becomes systemic at frequency 3
      tracker.trackFrequency(createTestPattern({ id: patternId, frequency: 2 }));
      tracker.trackFrequency(createTestPattern({ id: patternId, frequency: 3, isSystemic: true }));

      const alerts = tracker.checkAlerts(patternId);
      expect(alerts.some((a) => a.type === 'became_systemic')).toBe(true);
    });

    it('should generate alert for critical severity', () => {
      const tracker = createPatternTracker();
      const patternId = uuidv4();

      // High frequency = critical severity
      tracker.trackFrequency(createTestPattern({ id: patternId, frequency: 15 }));

      const alerts = tracker.checkAlerts(patternId);
      expect(alerts.some((a) => a.type === 'critical_severity')).toBe(true);
    });

    it('should return empty array when no alerts', () => {
      const tracker = createPatternTracker();
      const patternId = uuidv4();

      // Normal pattern
      tracker.trackFrequency(createTestPattern({ id: patternId, frequency: 1 }));

      const alerts = tracker.checkAlerts(patternId);
      expect(alerts).toEqual([]);
    });
  });

  // ===========================================================================
  // Bulk Operations
  // ===========================================================================

  describe('trackPatterns', () => {
    it('should track multiple patterns at once', () => {
      const tracker = createPatternTracker();

      const patterns = [
        createTestPattern({ frequency: 2 }),
        createTestPattern({ frequency: 5 }),
        createTestPattern({ frequency: 8 }),
      ];

      tracker.trackPatterns(patterns);

      for (const pattern of patterns) {
        const history = tracker.getFrequencyHistory(pattern.id);
        expect(history.length).toBe(1);
        expect(history[0]!.frequency).toBe(pattern.frequency);
      }
    });
  });

  describe('getAllTracked', () => {
    it('should return all tracked pattern IDs', () => {
      const tracker = createPatternTracker();

      const pattern1 = createTestPattern();
      const pattern2 = createTestPattern();

      tracker.trackFrequency(pattern1);
      tracker.trackFrequency(pattern2);

      const tracked = tracker.getAllTracked();
      expect(tracked.length).toBe(2);
      expect(tracked).toContain(pattern1.id);
      expect(tracked).toContain(pattern2.id);
    });
  });
});

// =============================================================================
// SeverityLevel Enum Tests
// =============================================================================

describe('SeverityLevel', () => {
  it('should have expected severity levels', async () => {
    const { SeverityLevel } = await import('../../../../src/tools/causal/pattern-tracking');

    expect(SeverityLevel.LOW).toBeDefined();
    expect(SeverityLevel.MEDIUM).toBeDefined();
    expect(SeverityLevel.HIGH).toBeDefined();
    expect(SeverityLevel.CRITICAL).toBeDefined();
  });

  it('should have numeric values for comparison', async () => {
    const { SeverityLevel } = await import('../../../../src/tools/causal/pattern-tracking');

    expect(SeverityLevel.LOW).toBeLessThan(SeverityLevel.MEDIUM);
    expect(SeverityLevel.MEDIUM).toBeLessThan(SeverityLevel.HIGH);
    expect(SeverityLevel.HIGH).toBeLessThan(SeverityLevel.CRITICAL);
  });
});
