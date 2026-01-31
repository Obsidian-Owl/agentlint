import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { ActionMenu } from '../../../../src/tui/components/ActionMenu';
import type { MenuOption } from '../../../../src/tui/components/ActionMenu';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

function createOptions(): MenuOption[] {
  return [
    { key: '1', label: 'First option', action: 'first' },
    { key: '2', label: 'Second option', action: 'second' },
    { key: '3', label: 'Third option', action: 'third' },
  ];
}

describe('ActionMenu', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    test('should render subtitle when provided', async () => {
      const { lastFrame } = render(
        <ActionMenu subtitle="A helpful subtitle" options={createOptions()} onSelect={() => {}} />
      );

      await tick();

      expect(lastFrame()).toContain('A helpful subtitle');
    });

    test('should not render subtitle when not provided', async () => {
      const { lastFrame } = render(<ActionMenu options={createOptions()} onSelect={() => {}} />);

      await tick();

      // Just verify it renders without error - no subtitle text expected
      expect(lastFrame()).toBeDefined();
    });

    test('should render all options with keys', async () => {
      const { lastFrame } = render(<ActionMenu options={createOptions()} onSelect={() => {}} />);

      await tick();

      expect(lastFrame()).toContain('[1]');
      expect(lastFrame()).toContain('First option');
      expect(lastFrame()).toContain('[2]');
      expect(lastFrame()).toContain('Second option');
      expect(lastFrame()).toContain('[3]');
      expect(lastFrame()).toContain('Third option');
    });

    test('should render default hint', async () => {
      const { lastFrame } = render(<ActionMenu options={createOptions()} onSelect={() => {}} />);

      await tick();

      expect(lastFrame()).toContain('Press a number to select...');
    });

    test('should render custom hint', async () => {
      const { lastFrame } = render(
        <ActionMenu options={createOptions()} onSelect={() => {}} hint="Press a number key" />
      );

      await tick();

      expect(lastFrame()).toContain('Press a number key');
    });

    test('should render with empty options', async () => {
      const { lastFrame } = render(<ActionMenu options={[]} onSelect={() => {}} />);

      await tick();

      // Should render without error even with empty options
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('keyboard selection', () => {
    test('should call onSelect when option key is pressed', async () => {
      const onSelect = mock(() => {});
      const { stdin } = render(<ActionMenu options={createOptions()} onSelect={onSelect} />);

      await tick();
      stdin.write('1');
      await tick();

      expect(onSelect).toHaveBeenCalledWith('first');
    });

    test('should call onSelect with correct action for second option', async () => {
      const onSelect = mock(() => {});
      const { stdin } = render(<ActionMenu options={createOptions()} onSelect={onSelect} />);

      await tick();
      stdin.write('2');
      await tick();

      expect(onSelect).toHaveBeenCalledWith('second');
    });

    test('should call onSelect with correct action for third option', async () => {
      const onSelect = mock(() => {});
      const { stdin } = render(<ActionMenu options={createOptions()} onSelect={onSelect} />);

      await tick();
      stdin.write('3');
      await tick();

      expect(onSelect).toHaveBeenCalledWith('third');
    });

    test('should not call onSelect for unrecognized key', async () => {
      const onSelect = mock(() => {});
      const { stdin } = render(<ActionMenu options={createOptions()} onSelect={onSelect} />);

      await tick();
      stdin.write('9');
      await tick();

      expect(onSelect).not.toHaveBeenCalled();
    });

    test('should not call onSelect when disabled', async () => {
      const onSelect = mock(() => {});
      const { stdin } = render(
        <ActionMenu options={createOptions()} onSelect={onSelect} disabled={true} />
      );

      await tick();
      stdin.write('1');
      await tick();

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('custom keys', () => {
    test('should support letter keys', async () => {
      const onSelect = mock(() => {});
      const options: MenuOption[] = [
        { key: 'a', label: 'Action A', action: 'action_a' },
        { key: 'b', label: 'Action B', action: 'action_b' },
      ];
      const { stdin } = render(<ActionMenu options={options} onSelect={onSelect} />);

      await tick();
      stdin.write('a');
      await tick();

      expect(onSelect).toHaveBeenCalledWith('action_a');
    });
  });
});
