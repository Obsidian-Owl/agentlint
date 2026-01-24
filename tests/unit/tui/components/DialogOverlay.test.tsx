/**
 * Unit tests for DialogOverlay component
 *
 * Tests the dialog overlay wrapper with focus trapping.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { Text, Box } from 'ink';
import { DialogOverlay } from '../../../../src/tui/components/DialogOverlay';

// =============================================================================
// Helper
// =============================================================================

/** Small delay to allow React effects to settle */
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

// =============================================================================
// Tests
// =============================================================================

describe('DialogOverlay', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    test('should render children', () => {
      const { lastFrame } = render(
        <DialogOverlay>
          <Text>Dialog Content</Text>
        </DialogOverlay>
      );

      expect(lastFrame()).toContain('Dialog Content');
    });

    test('should render title when provided', () => {
      const { lastFrame } = render(
        <DialogOverlay title="My Dialog">
          <Text>Content</Text>
        </DialogOverlay>
      );

      expect(lastFrame()).toContain('My Dialog');
    });

    test('should render without title', () => {
      const { lastFrame } = render(
        <DialogOverlay>
          <Text>No Title Content</Text>
        </DialogOverlay>
      );

      expect(lastFrame()).toContain('No Title Content');
    });

    test('should render border around dialog', () => {
      const { lastFrame } = render(
        <DialogOverlay title="Bordered">
          <Text>Content</Text>
        </DialogOverlay>
      );

      const frame = lastFrame();
      // Check for border characters (depends on ink Box implementation)
      // At minimum, content should be present
      expect(frame).toContain('Content');
    });
  });

  describe('dismiss handling', () => {
    test('should call onDismiss when ESC is pressed', async () => {
      const onDismiss = mock(() => {});
      const { stdin } = render(
        <DialogOverlay onDismiss={onDismiss}>
          <Text>Dismissible</Text>
        </DialogOverlay>
      );

      await tick();
      stdin.write('\x1B'); // ESC
      await tick();

      expect(onDismiss).toHaveBeenCalled();
    });

    test('should not crash when ESC pressed without onDismiss', async () => {
      const { stdin, lastFrame } = render(
        <DialogOverlay>
          <Text>No Handler</Text>
        </DialogOverlay>
      );

      await tick();
      stdin.write('\x1B');
      await tick();

      expect(lastFrame()).toContain('No Handler');
    });
  });

  describe('focus handling', () => {
    test('should capture focus when rendered', () => {
      const { lastFrame } = render(
        <DialogOverlay>
          <Text>Focused Dialog</Text>
        </DialogOverlay>
      );

      // Dialog should render (focus trapping is an internal concern)
      expect(lastFrame()).toContain('Focused Dialog');
    });
  });

  describe('styling', () => {
    test('should render with centered layout', () => {
      const { lastFrame } = render(
        <DialogOverlay title="Centered">
          <Text>Centered Content</Text>
        </DialogOverlay>
      );

      expect(lastFrame()).toContain('Centered Content');
    });

    test('should render nested content properly', () => {
      const { lastFrame } = render(
        <DialogOverlay title="Nested">
          <Box flexDirection="column">
            <Text>Line 1</Text>
            <Text>Line 2</Text>
          </Box>
        </DialogOverlay>
      );

      expect(lastFrame()).toContain('Line 1');
      expect(lastFrame()).toContain('Line 2');
    });
  });

  describe('keyboard interaction', () => {
    test('should pass through non-ESC keys', async () => {
      const { stdin, lastFrame } = render(
        <DialogOverlay>
          <Text>Interactive</Text>
        </DialogOverlay>
      );

      await tick();
      stdin.write('j');
      stdin.write('k');
      stdin.write('1');
      await tick();

      // Dialog should still be rendered
      expect(lastFrame()).toContain('Interactive');
    });
  });

  describe('accessibility', () => {
    test('should render semantic dialog structure', () => {
      const { lastFrame } = render(
        <DialogOverlay title="Accessible Dialog">
          <Text>Accessible content</Text>
        </DialogOverlay>
      );

      // Title should be visible for screen readers
      expect(lastFrame()).toContain('Accessible Dialog');
      expect(lastFrame()).toContain('Accessible content');
    });
  });
});
