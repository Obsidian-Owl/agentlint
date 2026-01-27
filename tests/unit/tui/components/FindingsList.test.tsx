import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { FindingsList } from '../../../../src/tui/components/FindingsList';
import type { Finding, Severity } from '../../../../src/orchestration';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

function createFinding(severity: Severity, title: string): Finding {
  return {
    id: `finding-${Date.now()}-${Math.random()}`,
    type: 'quality_issue',
    severity,
    title,
    description: `Description for ${title}`,
    location: { file: 'test.ts', line: 10 },
    origin: null,
    recommendations: [
      {
        action: 'Fix the issue',
        rationale: 'To improve quality',
        type: 'symptomatic',
        priority: 'medium',
        effort: 'small',
      },
    ],
    detectedAt: new Date().toISOString(),
    detectedInPhase: 'scanning',
  };
}

describe('FindingsList', () => {
  afterEach(() => {
    cleanup();
  });

  describe('empty state', () => {
    test('should render empty box when no findings and showEmpty is false', async () => {
      const { lastFrame } = render(<FindingsList findings={[]} />);

      await tick();

      expect(lastFrame()).toBe('');
    });

    test('should show empty message when showEmpty is true', async () => {
      const { lastFrame } = render(<FindingsList findings={[]} showEmpty={true} />);

      await tick();

      expect(lastFrame()).toContain('No findings discovered');
    });
  });

  describe('findings display', () => {
    test('should render finding titles', async () => {
      const findings = [
        createFinding('high', 'First Finding'),
        createFinding('medium', 'Second Finding'),
      ];
      const { lastFrame } = render(<FindingsList findings={findings} />);

      await tick();

      expect(lastFrame()).toContain('First Finding');
      expect(lastFrame()).toContain('Second Finding');
    });

    test('should render severity indicators', async () => {
      const findings = [createFinding('critical', 'Critical Issue')];
      const { lastFrame } = render(<FindingsList findings={findings} />);

      await tick();

      expect(lastFrame()).toContain('[CRITICAL]');
    });

    test('should render location in full mode', async () => {
      const findings = [createFinding('high', 'Issue')];
      const { lastFrame } = render(<FindingsList findings={findings} />);

      await tick();

      expect(lastFrame()).toContain('test.ts:10');
    });
  });

  describe('compact mode', () => {
    test('should render compact severity symbol', async () => {
      const findings = [createFinding('critical', 'Critical Issue')];
      const { lastFrame } = render(<FindingsList findings={findings} compact={true} />);

      await tick();

      expect(lastFrame()).toContain('[!!!]');
    });

    test('should not render descriptions in compact mode', async () => {
      const findings = [createFinding('high', 'Issue')];
      const { lastFrame } = render(<FindingsList findings={findings} compact={true} />);

      await tick();

      expect(lastFrame()).not.toContain('Description for Issue');
    });
  });

  describe('severity symbols', () => {
    test('should render critical symbol', async () => {
      const findings = [createFinding('critical', 'Issue')];
      const { lastFrame } = render(<FindingsList findings={findings} compact={true} />);

      await tick();

      expect(lastFrame()).toContain('[!!!]');
    });

    test('should render high symbol', async () => {
      const findings = [createFinding('high', 'Issue')];
      const { lastFrame } = render(<FindingsList findings={findings} compact={true} />);

      await tick();

      expect(lastFrame()).toContain('[!!]');
    });

    test('should render medium symbol', async () => {
      const findings = [createFinding('medium', 'Issue')];
      const { lastFrame } = render(<FindingsList findings={findings} compact={true} />);

      await tick();

      expect(lastFrame()).toContain('[!]');
    });

    test('should render low symbol', async () => {
      const findings = [createFinding('low', 'Issue')];
      const { lastFrame } = render(<FindingsList findings={findings} compact={true} />);

      await tick();

      expect(lastFrame()).toContain('[~]');
    });

    test('should render info symbol', async () => {
      const findings = [createFinding('info', 'Issue')];
      const { lastFrame } = render(<FindingsList findings={findings} compact={true} />);

      await tick();

      expect(lastFrame()).toContain('[i]');
    });
  });

  describe('recommendations', () => {
    test('should not show recommendations by default', async () => {
      const findings = [createFinding('high', 'Issue')];
      const { lastFrame } = render(<FindingsList findings={findings} />);

      await tick();

      expect(lastFrame()).not.toContain('Fix the issue');
    });

    test('should show recommendations when enabled', async () => {
      const findings = [createFinding('high', 'Issue')];
      const { lastFrame } = render(<FindingsList findings={findings} showRecommendations={true} />);

      await tick();

      expect(lastFrame()).toContain('Fix the issue');
    });
  });

  describe('interactive mode', () => {
    test('should show navigation help in interactive mode', async () => {
      const findings = [createFinding('high', 'Issue')];
      const { lastFrame } = render(<FindingsList findings={findings} interactive={true} />);

      await tick();

      expect(lastFrame()).toContain('j/k: navigate');
    });

    test('should not show navigation help in non-interactive mode', async () => {
      const findings = [createFinding('high', 'Issue')];
      const { lastFrame } = render(<FindingsList findings={findings} interactive={false} />);

      await tick();

      expect(lastFrame()).not.toContain('j/k: navigate');
    });

    test('should call onSelect when Enter is pressed', async () => {
      const findings = [createFinding('high', 'Issue')];
      const onSelect = mock(() => {});
      const { stdin } = render(
        <FindingsList findings={findings} interactive={true} onSelect={onSelect} />
      );

      await tick();
      stdin.write('\r');
      await tick();

      expect(onSelect).toHaveBeenCalled();
    });

    test('should navigate with j key', async () => {
      const findings = [createFinding('high', 'First'), createFinding('medium', 'Second')];
      const onSelect = mock(() => {});
      const { stdin } = render(
        <FindingsList findings={findings} interactive={true} onSelect={onSelect} />
      );

      await tick();
      stdin.write('j');
      await tick();
      stdin.write('\r');
      await tick();

      expect(onSelect).toHaveBeenCalledWith(findings[1]);
    });

    test('should quick select with number keys', async () => {
      const findings = [
        createFinding('high', 'First'),
        createFinding('medium', 'Second'),
        createFinding('low', 'Third'),
      ];
      const onSelect = mock(() => {});
      const { stdin } = render(
        <FindingsList findings={findings} interactive={true} onSelect={onSelect} />
      );

      await tick();
      stdin.write('2');
      await tick();

      expect(onSelect).toHaveBeenCalledWith(findings[1]);
    });
  });

  describe('index indicators', () => {
    test('should show index numbers for quick selection', async () => {
      const findings = [createFinding('high', 'First'), createFinding('medium', 'Second')];
      const { lastFrame } = render(<FindingsList findings={findings} interactive={true} />);

      await tick();

      expect(lastFrame()).toContain('[1]');
      expect(lastFrame()).toContain('[2]');
    });
  });
});
