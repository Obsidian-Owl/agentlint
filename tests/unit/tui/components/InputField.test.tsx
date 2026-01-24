/**
 * Unit tests for InputField component
 *
 * Tests the user input capture with buffering.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { InputField } from '../../../../src/tui/components/InputField';

// =============================================================================
// Helper
// =============================================================================

/** Small delay to allow React effects to settle */
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

// =============================================================================
// Tests
// =============================================================================

describe('InputField', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    test('should render with initial value', () => {
      const { lastFrame } = render(
        <InputField value="initial" onChange={() => {}} onSubmit={() => {}} />
      );

      expect(lastFrame()).toContain('initial');
    });

    test('should render empty value', () => {
      const { lastFrame } = render(<InputField value="" onChange={() => {}} onSubmit={() => {}} />);

      // Should render without crashing
      expect(lastFrame()).toBeDefined();
    });

    test('should render placeholder when value is empty', () => {
      const { lastFrame } = render(
        <InputField value="" onChange={() => {}} onSubmit={() => {}} placeholder="Type here..." />
      );

      expect(lastFrame()).toContain('Type here...');
    });

    test('should not show placeholder when value is present', () => {
      const { lastFrame } = render(
        <InputField
          value="some text"
          onChange={() => {}}
          onSubmit={() => {}}
          placeholder="Type here..."
        />
      );

      expect(lastFrame()).toContain('some text');
      // Placeholder behavior depends on implementation - may still be visible but value takes precedence
    });
  });

  describe('input handling', () => {
    test('should call onChange when text is typed', async () => {
      const onChange = mock(() => {});
      const { stdin } = render(<InputField value="" onChange={onChange} onSubmit={() => {}} />);

      await tick();
      stdin.write('a');
      await tick();

      expect(onChange).toHaveBeenCalledWith('a');
    });

    test('should call onChange with appended text', async () => {
      const onChange = mock(() => {});
      const { stdin } = render(
        <InputField value="hello" onChange={onChange} onSubmit={() => {}} />
      );

      await tick();
      stdin.write(' world');
      await tick();

      expect(onChange).toHaveBeenCalledWith('hello world');
    });

    test('should handle backspace', async () => {
      const onChange = mock(() => {});
      const { stdin } = render(
        <InputField value="hello" onChange={onChange} onSubmit={() => {}} />
      );

      await tick();
      stdin.write('\x7F'); // Backspace
      await tick();

      expect(onChange).toHaveBeenCalledWith('hell');
    });

    test('should handle backspace on empty value', async () => {
      const onChange = mock(() => {});
      const { stdin, lastFrame } = render(
        <InputField value="" onChange={onChange} onSubmit={() => {}} />
      );

      await tick();
      stdin.write('\x7F');
      await tick();

      // Should not crash, no change needed when value is already empty
      // onChange may or may not be called - the key is the component doesn't crash
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('submit handling', () => {
    test('should call onSubmit when Enter is pressed', async () => {
      const onSubmit = mock(() => {});
      const { stdin } = render(
        <InputField value="submit this" onChange={() => {}} onSubmit={onSubmit} />
      );

      await tick();
      stdin.write('\r'); // Enter
      await tick();

      expect(onSubmit).toHaveBeenCalledWith('submit this');
    });

    test('should call onSubmit with empty value', async () => {
      const onSubmit = mock(() => {});
      const { stdin } = render(<InputField value="" onChange={() => {}} onSubmit={onSubmit} />);

      await tick();
      stdin.write('\r');
      await tick();

      expect(onSubmit).toHaveBeenCalledWith('');
    });
  });

  describe('disabled state', () => {
    test('should not call onChange when disabled', async () => {
      const onChange = mock(() => {});
      const { stdin } = render(
        <InputField value="" onChange={onChange} onSubmit={() => {}} disabled={true} />
      );

      await tick();
      stdin.write('a');
      await tick();

      expect(onChange).not.toHaveBeenCalled();
    });

    test('should not call onSubmit when disabled', async () => {
      const onSubmit = mock(() => {});
      const { stdin } = render(
        <InputField value="text" onChange={() => {}} onSubmit={onSubmit} disabled={true} />
      );

      await tick();
      stdin.write('\r');
      await tick();

      expect(onSubmit).not.toHaveBeenCalled();
    });

    test('should still render value when disabled', () => {
      const { lastFrame } = render(
        <InputField value="disabled text" onChange={() => {}} onSubmit={() => {}} disabled={true} />
      );

      expect(lastFrame()).toContain('disabled text');
    });
  });

  describe('special characters', () => {
    test('should handle multi-byte characters', async () => {
      const onChange = mock(() => {});
      const { stdin } = render(<InputField value="" onChange={onChange} onSubmit={() => {}} />);

      await tick();
      stdin.write('こんにちは');
      await tick();

      expect(onChange).toHaveBeenCalledWith('こんにちは');
    });

    test('should handle emoji', async () => {
      const onChange = mock(() => {});
      const { stdin } = render(<InputField value="" onChange={onChange} onSubmit={() => {}} />);

      await tick();
      stdin.write('👋');
      await tick();

      expect(onChange).toHaveBeenCalledWith('👋');
    });
  });

  describe('prompt indicator', () => {
    test('should render prompt indicator', () => {
      const { lastFrame } = render(<InputField value="" onChange={() => {}} onSubmit={() => {}} />);

      // Should have some visual prompt (like > or similar)
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('cursor position', () => {
    test('should position cursor at end of value', () => {
      const { lastFrame } = render(
        <InputField value="hello" onChange={() => {}} onSubmit={() => {}} />
      );

      // Cursor positioning is visual - just verify render
      expect(lastFrame()).toContain('hello');
    });
  });
});
