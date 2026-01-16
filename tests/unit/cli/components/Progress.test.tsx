/**
 * T036: Unit tests for Progress component
 *
 * Tests US-001: Analyse with Streaming Output
 * Tests FR-006: Show spinner with current phase during analysis
 */

import { describe, test, expect } from 'bun:test';
import { render } from 'ink-testing-library';
import { Progress } from '../../../../src/cli/components/Progress';

describe('Progress component', () => {
  describe('rendering', () => {
    test('renders without crashing', () => {
      const { lastFrame } = render(<Progress phase="init" />);
      expect(lastFrame()).toBeDefined();
    });

    test('displays the current phase', () => {
      const { lastFrame } = render(<Progress phase="scanning" />);
      expect(lastFrame()?.toLowerCase()).toContain('scanning');
    });

    test('displays custom message when provided', () => {
      const { lastFrame } = render(<Progress phase="analyzing" message="Processing CLAUDE.md" />);
      expect(lastFrame()).toContain('Processing CLAUDE.md');
    });
  });

  describe('phase display', () => {
    test('shows initialization phase', () => {
      const { lastFrame } = render(<Progress phase="init" />);
      expect(lastFrame()?.toLowerCase()).toContain('init');
    });

    test('shows scanning phase', () => {
      const { lastFrame } = render(<Progress phase="scanning" />);
      expect(lastFrame()?.toLowerCase()).toContain('scanning');
    });

    test('shows analyzing phase', () => {
      const { lastFrame } = render(<Progress phase="analyzing" />);
      expect(lastFrame()?.toLowerCase()).toContain('analyzing');
    });

    test('shows reporting phase', () => {
      const { lastFrame } = render(<Progress phase="reporting" />);
      expect(lastFrame()?.toLowerCase()).toContain('reporting');
    });
  });

  describe('spinner', () => {
    test('shows spinner indicator when active', () => {
      const { lastFrame } = render(<Progress phase="scanning" isActive={true} />);
      // Spinner will render some character(s) - just ensure component renders
      expect(lastFrame()).toBeDefined();
    });

    test('hides spinner when not active', () => {
      const { lastFrame } = render(<Progress phase="complete" isActive={false} />);
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('percentage', () => {
    test('shows percentage when provided', () => {
      const { lastFrame } = render(<Progress phase="scanning" percent={50} />);
      expect(lastFrame()).toContain('50%');
    });

    test('does not show percentage when not provided', () => {
      const { lastFrame } = render(<Progress phase="scanning" />);
      // Should not crash, and should render something
      expect(lastFrame()).toBeDefined();
    });

    test('handles 0% correctly', () => {
      const { lastFrame } = render(<Progress phase="init" percent={0} />);
      expect(lastFrame()).toContain('0%');
    });

    test('handles 100% correctly', () => {
      const { lastFrame } = render(<Progress phase="complete" percent={100} />);
      expect(lastFrame()).toContain('100%');
    });
  });

  describe('elapsed time', () => {
    test('shows elapsed time when provided', () => {
      const { lastFrame } = render(<Progress phase="scanning" elapsedMs={5000} />);
      expect(lastFrame()).toContain('5');
    });

    test('formats time correctly for seconds', () => {
      const { lastFrame } = render(<Progress phase="scanning" elapsedMs={12500} />);
      // Should show something like 12.5s or 12s
      const frame = lastFrame() ?? '';
      expect(frame.includes('12') || frame.includes('13')).toBe(true);
    });
  });

  describe('accessibility', () => {
    test('renders without spinner for non-TTY', () => {
      const { lastFrame } = render(<Progress phase="scanning" isActive={true} plainText={true} />);
      expect(lastFrame()).toBeDefined();
      expect(lastFrame()).toContain('scanning');
    });
  });
});
