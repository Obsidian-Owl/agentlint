import { describe, test, expect, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { Progress } from '../../../../src/tui/components/Progress';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('Progress', () => {
  afterEach(() => {
    cleanup();
  });

  describe('phase display', () => {
    test('should render phase name', async () => {
      const { lastFrame } = render(<Progress phase="scanning" />);

      await tick();

      expect(lastFrame()).toContain('Scanning');
    });

    test('should render init phase as Initializing', async () => {
      const { lastFrame } = render(<Progress phase="init" />);

      await tick();

      expect(lastFrame()).toContain('Initializing');
    });

    test('should render analyzing phase', async () => {
      const { lastFrame } = render(<Progress phase="analyzing" />);

      await tick();

      expect(lastFrame()).toContain('Analyzing');
    });

    test('should render reporting phase', async () => {
      const { lastFrame } = render(<Progress phase="reporting" />);

      await tick();

      expect(lastFrame()).toContain('Reporting');
    });

    test('should render complete phase', async () => {
      const { lastFrame } = render(<Progress phase="complete" />);

      await tick();

      expect(lastFrame()).toContain('Complete');
    });

    test('should render unknown phase as-is', async () => {
      const { lastFrame } = render(<Progress phase="custom_phase" />);

      await tick();

      expect(lastFrame()).toContain('custom_phase');
    });
  });

  describe('message display', () => {
    test('should render custom message', async () => {
      const { lastFrame } = render(<Progress phase="scanning" message="Finding config files..." />);

      await tick();

      expect(lastFrame()).toContain('Finding config files...');
    });
  });

  describe('percentage display', () => {
    test('should render percentage when provided', async () => {
      const { lastFrame } = render(<Progress phase="analyzing" percent={50} />);

      await tick();

      expect(lastFrame()).toContain('50%');
    });

    test('should not show percentage when not provided', async () => {
      const { lastFrame } = render(<Progress phase="analyzing" />);

      await tick();

      expect(lastFrame()).not.toContain('%');
    });
  });

  describe('elapsed time display', () => {
    test('should render elapsed time in seconds', async () => {
      const { lastFrame } = render(<Progress phase="scanning" elapsedMs={5000} />);

      await tick();

      expect(lastFrame()).toContain('5s');
    });

    test('should render elapsed time in minutes and seconds', async () => {
      const { lastFrame } = render(<Progress phase="scanning" elapsedMs={125000} />);

      await tick();

      expect(lastFrame()).toContain('2m 5s');
    });

    test('should not show elapsed time when not provided', async () => {
      const { lastFrame } = render(<Progress phase="scanning" />);

      await tick();

      expect(lastFrame()).not.toContain('s)');
    });
  });

  describe('plain text mode', () => {
    test('should render in plain text format', async () => {
      const { lastFrame } = render(<Progress phase="scanning" plainText={true} />);

      await tick();

      expect(lastFrame()).toContain('[scanning]');
    });

    test('should include message in plain text format', async () => {
      const { lastFrame } = render(
        <Progress phase="scanning" message="Processing..." plainText={true} />
      );

      await tick();

      expect(lastFrame()).toContain('Processing...');
    });
  });

  describe('spinner visibility', () => {
    test('should render with spinner when active', async () => {
      const { lastFrame } = render(<Progress phase="scanning" isActive={true} />);

      await tick();

      expect(lastFrame()).toBeDefined();
    });

    test('should render without spinner when inactive', async () => {
      const { lastFrame } = render(<Progress phase="scanning" isActive={false} />);

      await tick();

      expect(lastFrame()).toContain('Scanning');
    });
  });

  describe('combined display', () => {
    test('should render phase, percent, and elapsed together', async () => {
      const { lastFrame } = render(<Progress phase="analyzing" percent={75} elapsedMs={30000} />);

      await tick();

      expect(lastFrame()).toContain('Analyzing');
      expect(lastFrame()).toContain('75%');
      expect(lastFrame()).toContain('30s');
    });
  });
});
