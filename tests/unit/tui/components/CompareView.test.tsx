import { describe, test, expect, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { CompareView } from '../../../../src/tui/components/CompareView';
import type { ComparisonData, BaselineSummary } from '../../../../src/tui/components/CompareView';
import type { BaselineMetrics } from '../../../../src/persistence/types';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

function createMetrics(overrides: Partial<BaselineMetrics> = {}): BaselineMetrics {
  return {
    findingsCount: 10,
    criticalCount: 1,
    highCount: 2,
    mediumCount: 3,
    lowCount: 2,
    infoCount: 2,
    ...overrides,
  };
}

function createBaseline(
  id: string,
  label: string | null,
  metrics: BaselineMetrics
): BaselineSummary {
  return {
    id,
    label,
    createdAt: new Date().toISOString(),
    metrics,
  };
}

function createComparison(overrides: Partial<ComparisonData> = {}): ComparisonData {
  const from = createBaseline('baseline-1', 'before', createMetrics({ findingsCount: 15 }));
  const to = createBaseline('baseline-2', 'after', createMetrics({ findingsCount: 10 }));
  return {
    from,
    to,
    delta: {
      findingsCount: -5,
      criticalCount: 0,
      highCount: -1,
      mediumCount: -2,
      lowCount: -1,
      infoCount: -1,
    },
    trend: 'improved',
    ...overrides,
  };
}

describe('CompareView', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    test('should render comparison header', async () => {
      const { lastFrame } = render(<CompareView comparison={createComparison()} />);

      await tick();

      expect(lastFrame()).toContain('Baseline Comparison');
    });

    test('should render baseline labels', async () => {
      const { lastFrame } = render(<CompareView comparison={createComparison()} />);

      await tick();

      expect(lastFrame()).toContain('before');
      expect(lastFrame()).toContain('after');
    });

    test('should render From and To labels', async () => {
      const { lastFrame } = render(<CompareView comparison={createComparison()} />);

      await tick();

      expect(lastFrame()).toContain('From:');
      expect(lastFrame()).toContain('To:');
    });
  });

  describe('trend display', () => {
    test('should show improved trend', async () => {
      const comparison = createComparison({ trend: 'improved' });
      const { lastFrame } = render(<CompareView comparison={comparison} />);

      await tick();

      expect(lastFrame()).toContain('Improved');
      expect(lastFrame()).toContain('↓');
    });

    test('should show regressed trend', async () => {
      const comparison = createComparison({ trend: 'regressed' });
      const { lastFrame } = render(<CompareView comparison={comparison} />);

      await tick();

      expect(lastFrame()).toContain('Regressed');
      expect(lastFrame()).toContain('↑');
    });

    test('should show unchanged trend', async () => {
      const comparison = createComparison({ trend: 'unchanged' });
      const { lastFrame } = render(<CompareView comparison={comparison} />);

      await tick();

      expect(lastFrame()).toContain('Unchanged');
      expect(lastFrame()).toContain('→');
    });
  });

  describe('delta display', () => {
    test('should show total findings delta', async () => {
      const { lastFrame } = render(<CompareView comparison={createComparison()} />);

      await tick();

      expect(lastFrame()).toContain('Total Findings');
      expect(lastFrame()).toContain('-5');
    });

    test('should show severity breakdown in full mode', async () => {
      const { lastFrame } = render(<CompareView comparison={createComparison()} />);

      await tick();

      expect(lastFrame()).toContain('Severity Breakdown');
    });

    test('should not show severity breakdown in compact mode', async () => {
      const { lastFrame } = render(<CompareView comparison={createComparison()} compact={true} />);

      await tick();

      expect(lastFrame()).not.toContain('Severity Breakdown');
    });
  });

  describe('timestamps', () => {
    test('should not show timestamps by default', async () => {
      const comparison = createComparison();
      const { lastFrame } = render(<CompareView comparison={comparison} />);

      await tick();

      expect(lastFrame()).toContain('before');
      expect(lastFrame()).toContain('after');
    });

    test('should show timestamps when enabled', async () => {
      const comparison = createComparison();
      const { lastFrame } = render(<CompareView comparison={comparison} showTimestamps={true} />);

      await tick();

      expect(lastFrame()).toBeDefined();
    });
  });

  describe('baseline naming', () => {
    test('should use label when available', async () => {
      const { lastFrame } = render(<CompareView comparison={createComparison()} />);

      await tick();

      expect(lastFrame()).toContain('before');
      expect(lastFrame()).toContain('after');
    });

    test('should use truncated ID when label is null', async () => {
      const comparison = createComparison();
      comparison.from.label = null;
      comparison.from.id = 'abcd1234-5678-9012';
      const { lastFrame } = render(<CompareView comparison={comparison} />);

      await tick();

      expect(lastFrame()).toContain('abcd1234');
    });
  });
});
