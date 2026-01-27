import { describe, test, expect, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { Summary } from '../../../../src/tui/components/Summary';
import type { Finding, Severity } from '../../../../src/orchestration';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

function createFinding(severity: Severity): Finding {
  return {
    id: `finding-${Date.now()}-${Math.random()}`,
    type: 'quality_issue',
    severity,
    title: `Test finding - ${severity}`,
    description: 'A test finding',
    location: { file: 'test.ts' },
    origin: null,
    recommendations: [],
    detectedAt: new Date().toISOString(),
    detectedInPhase: 'scanning',
  };
}

describe('Summary', () => {
  afterEach(() => {
    cleanup();
  });

  describe('success state', () => {
    test('should render success message', async () => {
      const { lastFrame } = render(<Summary findings={[]} success={true} />);

      await tick();

      expect(lastFrame()).toContain('Analysis Complete');
    });

    test('should render elapsed time when provided', async () => {
      const { lastFrame } = render(<Summary findings={[]} elapsedMs={5000} success={true} />);

      await tick();

      expect(lastFrame()).toContain('5.0s');
    });

    test('should render elapsed time in ms for short durations', async () => {
      const { lastFrame } = render(<Summary findings={[]} elapsedMs={500} success={true} />);

      await tick();

      expect(lastFrame()).toContain('500ms');
    });

    test('should show no issues message when no findings', async () => {
      const { lastFrame } = render(<Summary findings={[]} success={true} />);

      await tick();

      expect(lastFrame()).toContain('No issues found');
    });
  });

  describe('failure state', () => {
    test('should render failure message', async () => {
      const { lastFrame } = render(<Summary findings={[]} success={false} />);

      await tick();

      expect(lastFrame()).toContain('Analysis Failed');
    });

    test('should render error message when provided', async () => {
      const { lastFrame } = render(
        <Summary findings={[]} success={false} error="Connection timeout" />
      );

      await tick();

      expect(lastFrame()).toContain('Error: Connection timeout');
    });
  });

  describe('findings display', () => {
    test('should show total finding count', async () => {
      const findings = [createFinding('high'), createFinding('medium')];
      const { lastFrame } = render(<Summary findings={findings} success={true} />);

      await tick();

      expect(lastFrame()).toContain('2');
      expect(lastFrame()).toContain('finding');
    });

    test('should show singular form for one finding', async () => {
      const findings = [createFinding('low')];
      const { lastFrame } = render(<Summary findings={findings} success={true} />);

      await tick();

      expect(lastFrame()).toContain('1');
      expect(lastFrame()).toContain('finding');
    });

    test('should show critical count when present', async () => {
      const findings = [createFinding('critical'), createFinding('critical')];
      const { lastFrame } = render(<Summary findings={findings} success={true} />);

      await tick();

      expect(lastFrame()).toContain('Critical: 2');
    });

    test('should show high count when present', async () => {
      const findings = [createFinding('high')];
      const { lastFrame } = render(<Summary findings={findings} success={true} />);

      await tick();

      expect(lastFrame()).toContain('High: 1');
    });

    test('should show medium count when present', async () => {
      const findings = [createFinding('medium'), createFinding('medium'), createFinding('medium')];
      const { lastFrame } = render(<Summary findings={findings} success={true} />);

      await tick();

      expect(lastFrame()).toContain('Medium: 3');
    });

    test('should show low count when present', async () => {
      const findings = [createFinding('low')];
      const { lastFrame } = render(<Summary findings={findings} success={true} />);

      await tick();

      expect(lastFrame()).toContain('Low: 1');
    });

    test('should show info count when present', async () => {
      const findings = [createFinding('info')];
      const { lastFrame } = render(<Summary findings={findings} success={true} />);

      await tick();

      expect(lastFrame()).toContain('Info: 1');
    });

    test('should not show severity counts when zero', async () => {
      const findings = [createFinding('medium')];
      const { lastFrame } = render(<Summary findings={findings} success={true} />);

      await tick();

      expect(lastFrame()).not.toContain('Critical:');
      expect(lastFrame()).not.toContain('High:');
      expect(lastFrame()).toContain('Medium: 1');
    });
  });

  describe('mixed severities', () => {
    test('should show all present severity counts', async () => {
      const findings = [
        createFinding('critical'),
        createFinding('high'),
        createFinding('high'),
        createFinding('medium'),
        createFinding('low'),
        createFinding('info'),
      ];
      const { lastFrame } = render(<Summary findings={findings} success={true} />);

      await tick();

      expect(lastFrame()).toContain('Critical: 1');
      expect(lastFrame()).toContain('High: 2');
      expect(lastFrame()).toContain('Medium: 1');
      expect(lastFrame()).toContain('Low: 1');
      expect(lastFrame()).toContain('Info: 1');
    });
  });

  describe('default values', () => {
    test('should default success to true', async () => {
      const { lastFrame } = render(<Summary findings={[]} />);

      await tick();

      expect(lastFrame()).toContain('Analysis Complete');
    });

    test('should handle undefined elapsedMs', async () => {
      const { lastFrame } = render(<Summary findings={[]} success={true} />);

      await tick();

      expect(lastFrame()).toContain('Analysis Complete');
      expect(lastFrame()).not.toContain('ms');
      expect(lastFrame()).not.toContain('s)');
    });
  });
});
