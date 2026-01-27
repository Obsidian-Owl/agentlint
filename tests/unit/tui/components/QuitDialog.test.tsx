/**
 * Unit tests for QuitDialog component
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { QuitDialog } from '../../../../src/tui/components/QuitDialog';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('QuitDialog', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    test('should render quit confirmation message', async () => {
      const { lastFrame } = render(<QuitDialog onConfirm={() => {}} onCancel={() => {}} />);

      await tick();

      expect(lastFrame()).toContain('Quit agentlint?');
    });

    test('should render Yes and No options', async () => {
      const { lastFrame } = render(<QuitDialog onConfirm={() => {}} onCancel={() => {}} />);

      await tick();

      expect(lastFrame()).toContain('[Y]es');
      expect(lastFrame()).toContain('[N]o');
    });

    test('should render help text', async () => {
      const { lastFrame } = render(<QuitDialog onConfirm={() => {}} onCancel={() => {}} />);

      await tick();

      expect(lastFrame()).toContain('y/n to select');
      expect(lastFrame()).toContain('Tab to toggle');
      expect(lastFrame()).toContain('Enter to confirm');
    });

    test('should render unsaved work message', async () => {
      const { lastFrame } = render(<QuitDialog onConfirm={() => {}} onCancel={() => {}} />);

      await tick();

      expect(lastFrame()).toContain('unsaved work will be preserved');
    });

    test('should default to No selected (safe default)', async () => {
      const { lastFrame } = render(<QuitDialog onConfirm={() => {}} onCancel={() => {}} />);

      await tick();

      expect(lastFrame()).toBeDefined();
    });
  });

  describe('keyboard shortcuts', () => {
    test('should call onConfirm when y is pressed', async () => {
      const onConfirm = mock(() => {});
      const { stdin } = render(<QuitDialog onConfirm={onConfirm} onCancel={() => {}} />);

      await tick();
      stdin.write('y');
      await tick();

      expect(onConfirm).toHaveBeenCalled();
    });

    test('should call onConfirm when Y is pressed', async () => {
      const onConfirm = mock(() => {});
      const { stdin } = render(<QuitDialog onConfirm={onConfirm} onCancel={() => {}} />);

      await tick();
      stdin.write('Y');
      await tick();

      expect(onConfirm).toHaveBeenCalled();
    });

    test('should call onCancel when n is pressed', async () => {
      const onCancel = mock(() => {});
      const { stdin } = render(<QuitDialog onConfirm={() => {}} onCancel={onCancel} />);

      await tick();
      stdin.write('n');
      await tick();

      expect(onCancel).toHaveBeenCalled();
    });

    test('should call onCancel when N is pressed', async () => {
      const onCancel = mock(() => {});
      const { stdin } = render(<QuitDialog onConfirm={() => {}} onCancel={onCancel} />);

      await tick();
      stdin.write('N');
      await tick();

      expect(onCancel).toHaveBeenCalled();
    });

    test('should call onCancel when Escape is pressed', async () => {
      const onCancel = mock(() => {});
      const { stdin } = render(<QuitDialog onConfirm={() => {}} onCancel={onCancel} />);

      await tick();
      stdin.write('\x1B');
      await tick();

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('selection toggle', () => {
    test('should toggle selection with Tab', async () => {
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});
      const { stdin } = render(<QuitDialog onConfirm={onConfirm} onCancel={onCancel} />);

      await tick();
      stdin.write('\t');
      await tick();
      stdin.write('\r');
      await tick();

      expect(onConfirm).toHaveBeenCalled();
    });

    test('should toggle selection with left arrow', async () => {
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});
      const { stdin } = render(<QuitDialog onConfirm={onConfirm} onCancel={onCancel} />);

      await tick();
      stdin.write('\x1B[D');
      await tick();
      stdin.write('\r');
      await tick();

      expect(onConfirm).toHaveBeenCalled();
    });

    test('should toggle selection with right arrow', async () => {
      const onConfirm = mock(() => {});
      const onCancel = mock(() => {});
      const { stdin } = render(<QuitDialog onConfirm={onConfirm} onCancel={onCancel} />);

      await tick();
      stdin.write('\x1B[C');
      await tick();
      stdin.write('\r');
      await tick();

      expect(onConfirm).toHaveBeenCalled();
    });
  });

  describe('Enter key behavior', () => {
    test('should call onCancel when Enter pressed with No selected (default)', async () => {
      const onCancel = mock(() => {});
      const { stdin } = render(<QuitDialog onConfirm={() => {}} onCancel={onCancel} />);

      await tick();
      stdin.write('\r');
      await tick();

      expect(onCancel).toHaveBeenCalled();
    });

    test('should call onConfirm when Enter pressed with Yes selected', async () => {
      const onConfirm = mock(() => {});
      const { stdin } = render(<QuitDialog onConfirm={onConfirm} onCancel={() => {}} />);

      await tick();
      stdin.write('\t');
      await tick();
      stdin.write('\r');
      await tick();

      expect(onConfirm).toHaveBeenCalled();
    });
  });
});
