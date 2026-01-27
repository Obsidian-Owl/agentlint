import { describe, test, expect, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { LoadingProgress } from '../../../../src/tui/components/LoadingProgress';
import type { LoadingStep } from '../../../../src/tui/types';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

function createStep(overrides: Partial<LoadingStep> = {}): LoadingStep {
  return {
    id: 'step-1',
    label: 'Loading...',
    status: 'pending',
    ...overrides,
  };
}

describe('LoadingProgress', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    test('should render title when provided', async () => {
      const { lastFrame } = render(<LoadingProgress steps={[createStep()]} title="Initializing" />);

      await tick();

      expect(lastFrame()).toContain('Initializing');
    });

    test('should render without title', async () => {
      const { lastFrame } = render(<LoadingProgress steps={[createStep()]} />);

      await tick();

      expect(lastFrame()).toBeDefined();
    });

    test('should render step labels', async () => {
      const steps = [
        createStep({ id: '1', label: 'Loading config' }),
        createStep({ id: '2', label: 'Scanning files' }),
      ];
      const { lastFrame } = render(<LoadingProgress steps={steps} />);

      await tick();

      expect(lastFrame()).toContain('Loading config');
      expect(lastFrame()).toContain('Scanning files');
    });

    test('should render step details when provided', async () => {
      const steps = [createStep({ label: 'Loading', detail: 'config.json' })];
      const { lastFrame } = render(<LoadingProgress steps={steps} />);

      await tick();

      expect(lastFrame()).toContain('config.json');
    });
  });

  describe('status icons', () => {
    test('should render pending icon', async () => {
      const steps = [createStep({ status: 'pending' })];
      const { lastFrame } = render(<LoadingProgress steps={steps} />);

      await tick();

      expect(lastFrame()).toContain('○');
    });

    test('should render loading icon', async () => {
      const steps = [createStep({ status: 'loading' })];
      const { lastFrame } = render(<LoadingProgress steps={steps} />);

      await tick();

      expect(lastFrame()).toContain('◐');
    });

    test('should render complete icon', async () => {
      const steps = [createStep({ status: 'complete' })];
      const { lastFrame } = render(<LoadingProgress steps={steps} />);

      await tick();

      expect(lastFrame()).toContain('●');
    });

    test('should render error icon', async () => {
      const steps = [createStep({ status: 'error' })];
      const { lastFrame } = render(<LoadingProgress steps={steps} />);

      await tick();

      expect(lastFrame()).toContain('✗');
    });

    test('should render skipped icon', async () => {
      const steps = [createStep({ status: 'skipped' })];
      const { lastFrame } = render(<LoadingProgress steps={steps} />);

      await tick();

      expect(lastFrame()).toContain('◌');
    });
  });

  describe('multiple steps', () => {
    test('should render steps in order', async () => {
      const steps = [
        createStep({ id: '1', label: 'Step 1', status: 'complete' }),
        createStep({ id: '2', label: 'Step 2', status: 'loading' }),
        createStep({ id: '3', label: 'Step 3', status: 'pending' }),
      ];
      const { lastFrame } = render(<LoadingProgress steps={steps} />);

      await tick();

      const frame = lastFrame() ?? '';
      const step1Index = frame.indexOf('Step 1');
      const step2Index = frame.indexOf('Step 2');
      const step3Index = frame.indexOf('Step 3');

      expect(step1Index).toBeLessThan(step2Index);
      expect(step2Index).toBeLessThan(step3Index);
    });

    test('should handle empty steps array', async () => {
      const { lastFrame } = render(<LoadingProgress steps={[]} />);

      await tick();

      expect(lastFrame()).toBeDefined();
    });
  });

  describe('with details', () => {
    test('should render detail with separator', async () => {
      const steps = [createStep({ label: 'Processing', detail: '50% complete' })];
      const { lastFrame } = render(<LoadingProgress steps={steps} />);

      await tick();

      expect(lastFrame()).toContain('Processing');
      expect(lastFrame()).toContain('50% complete');
    });
  });
});
