/**
 * T053: Unit tests for CompareView component
 *
 * Tests US-006: Compare Against Baseline
 * Tests FR-009: Show delta with +/- indicators
 */

import { describe, test, expect } from 'bun:test';
import { render } from 'ink-testing-library';
import { CompareView, type ComparisonData } from '../../../../src/cli/components/CompareView';

// Helper to create test comparison data
function createComparisonData(overrides: Partial<ComparisonData> = {}): ComparisonData {
  return {
    from: {
      id: 'baseline-1',
      label: 'before',
      createdAt: '2024-01-01T00:00:00Z',
      metrics: {
        findingsCount: 10,
        criticalCount: 1,
        highCount: 2,
        mediumCount: 3,
        lowCount: 2,
        infoCount: 2,
      },
    },
    to: {
      id: 'baseline-2',
      label: 'after',
      createdAt: '2024-01-02T00:00:00Z',
      metrics: {
        findingsCount: 5,
        criticalCount: 0,
        highCount: 1,
        mediumCount: 2,
        lowCount: 1,
        infoCount: 1,
      },
    },
    delta: {
      findingsCount: -5,
      criticalCount: -1,
      highCount: -1,
      mediumCount: -1,
      lowCount: -1,
      infoCount: -1,
    },
    trend: 'improved',
    ...overrides,
  };
}

describe('CompareView component', () => {
  describe('rendering', () => {
    test('renders without crashing', () => {
      const data = createComparisonData();
      const { lastFrame } = render(<CompareView comparison={data} />);
      expect(lastFrame()).toBeDefined();
    });

    test('displays comparison title', () => {
      const data = createComparisonData();
      const { lastFrame } = render(<CompareView comparison={data} />);
      const frame = lastFrame()?.toLowerCase() ?? '';
      expect(
        frame.includes('comparison') || frame.includes('compare') || frame.includes('delta')
      ).toBe(true);
    });
  });

  describe('delta indicators', () => {
    test('shows negative delta with down arrow for improvements', () => {
      const data = createComparisonData({
        delta: {
          findingsCount: -5,
          criticalCount: -1,
          highCount: -1,
          mediumCount: -1,
          lowCount: -1,
          infoCount: -1,
        },
        trend: 'improved',
      });
      const { lastFrame } = render(<CompareView comparison={data} />);
      const frame = lastFrame() ?? '';
      // Should show decrease indicator (↓ or - or similar)
      expect(frame.includes('↓') || frame.includes('-5') || frame.includes('-1')).toBe(true);
    });

    test('shows positive delta with up arrow for regressions', () => {
      const data = createComparisonData({
        to: {
          id: 'baseline-2',
          label: 'after',
          createdAt: '2024-01-02T00:00:00Z',
          metrics: {
            findingsCount: 15,
            criticalCount: 2,
            highCount: 3,
            mediumCount: 5,
            lowCount: 3,
            infoCount: 2,
          },
        },
        delta: {
          findingsCount: 5,
          criticalCount: 1,
          highCount: 1,
          mediumCount: 2,
          lowCount: 1,
          infoCount: 0,
        },
        trend: 'regressed',
      });
      const { lastFrame } = render(<CompareView comparison={data} />);
      const frame = lastFrame() ?? '';
      // Should show increase indicator (↑ or + or similar)
      expect(frame.includes('↑') || frame.includes('+5') || frame.includes('+1')).toBe(true);
    });

    test('shows no change indicator for unchanged metrics', () => {
      const data = createComparisonData({
        to: {
          id: 'baseline-2',
          label: 'after',
          createdAt: '2024-01-02T00:00:00Z',
          metrics: {
            findingsCount: 10,
            criticalCount: 1,
            highCount: 2,
            mediumCount: 3,
            lowCount: 2,
            infoCount: 2,
          },
        },
        delta: {
          findingsCount: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          infoCount: 0,
        },
        trend: 'unchanged',
      });
      const { lastFrame } = render(<CompareView comparison={data} />);
      const frame = lastFrame()?.toLowerCase() ?? '';
      // Should indicate no change
      expect(frame.includes('unchanged') || frame.includes('0') || frame.includes('same')).toBe(
        true
      );
    });
  });

  describe('baseline labels', () => {
    test('displays from baseline label', () => {
      const data = createComparisonData({
        from: {
          id: 'baseline-1',
          label: 'pre-refactor',
          createdAt: '2024-01-01T00:00:00Z',
          metrics: {
            findingsCount: 10,
            criticalCount: 1,
            highCount: 2,
            mediumCount: 3,
            lowCount: 2,
            infoCount: 2,
          },
        },
      });
      const { lastFrame } = render(<CompareView comparison={data} />);
      expect(lastFrame()).toContain('pre-refactor');
    });

    test('displays to baseline label', () => {
      const data = createComparisonData({
        to: {
          id: 'baseline-2',
          label: 'post-refactor',
          createdAt: '2024-01-02T00:00:00Z',
          metrics: {
            findingsCount: 5,
            criticalCount: 0,
            highCount: 1,
            mediumCount: 2,
            lowCount: 1,
            infoCount: 1,
          },
        },
      });
      const { lastFrame } = render(<CompareView comparison={data} />);
      expect(lastFrame()).toContain('post-refactor');
    });

    test('shows baseline IDs when no labels provided', () => {
      const data = createComparisonData({
        from: {
          id: 'abc123',
          label: null,
          createdAt: '2024-01-01T00:00:00Z',
          metrics: {
            findingsCount: 10,
            criticalCount: 1,
            highCount: 2,
            mediumCount: 3,
            lowCount: 2,
            infoCount: 2,
          },
        },
      });
      const { lastFrame } = render(<CompareView comparison={data} />);
      expect(lastFrame()).toContain('abc123');
    });
  });

  describe('metrics display', () => {
    test('displays findings count', () => {
      const data = createComparisonData();
      const { lastFrame } = render(<CompareView comparison={data} />);
      const frame = lastFrame()?.toLowerCase() ?? '';
      expect(frame.includes('finding') || frame.includes('total')).toBe(true);
    });

    test('displays severity breakdown', () => {
      const data = createComparisonData();
      const { lastFrame } = render(<CompareView comparison={data} />);
      const frame = lastFrame()?.toLowerCase() ?? '';
      // Should show at least some severity levels
      const hasSeverity =
        frame.includes('critical') ||
        frame.includes('high') ||
        frame.includes('medium') ||
        frame.includes('low');
      expect(hasSeverity).toBe(true);
    });
  });

  describe('trend classification', () => {
    test('shows improved status for positive trend', () => {
      const data = createComparisonData({ trend: 'improved' });
      const { lastFrame } = render(<CompareView comparison={data} />);
      const frame = lastFrame()?.toLowerCase() ?? '';
      expect(frame.includes('improved') || frame.includes('better') || frame.includes('↓')).toBe(
        true
      );
    });

    test('shows regressed status for negative trend', () => {
      const data = createComparisonData({
        delta: {
          findingsCount: 5,
          criticalCount: 1,
          highCount: 1,
          mediumCount: 1,
          lowCount: 1,
          infoCount: 1,
        },
        trend: 'regressed',
      });
      const { lastFrame } = render(<CompareView comparison={data} />);
      const frame = lastFrame()?.toLowerCase() ?? '';
      expect(frame.includes('regressed') || frame.includes('worse') || frame.includes('↑')).toBe(
        true
      );
    });

    test('shows unchanged status when no change', () => {
      const data = createComparisonData({
        delta: {
          findingsCount: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          infoCount: 0,
        },
        trend: 'unchanged',
      });
      const { lastFrame } = render(<CompareView comparison={data} />);
      const frame = lastFrame()?.toLowerCase() ?? '';
      expect(
        frame.includes('unchanged') || frame.includes('same') || frame.includes('no change')
      ).toBe(true);
    });
  });

  describe('compact mode', () => {
    test('renders in compact mode', () => {
      const data = createComparisonData();
      const { lastFrame } = render(<CompareView comparison={data} compact={true} />);
      expect(lastFrame()).toBeDefined();
    });

    test('compact mode shows less detail', () => {
      const data = createComparisonData();
      const fullFrame = render(<CompareView comparison={data} compact={false} />).lastFrame() ?? '';
      const compactFrame =
        render(<CompareView comparison={data} compact={true} />).lastFrame() ?? '';
      expect(compactFrame.length).toBeLessThanOrEqual(fullFrame.length);
    });
  });

  describe('timestamps', () => {
    test('shows timestamps when showTimestamps is true', () => {
      const data = createComparisonData();
      const { lastFrame } = render(<CompareView comparison={data} showTimestamps={true} />);
      const frame = lastFrame() ?? '';
      // Should show date information
      expect(frame.includes('2024') || frame.includes('Jan')).toBe(true);
    });
  });
});
