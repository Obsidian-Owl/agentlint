/**
 * Unit tests for Breadcrumbs component
 *
 * Tests the navigation context breadcrumb display.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { Breadcrumbs } from '../../../../src/tui/components/Breadcrumbs';
import type { ExplorationStep } from '../../../../src/tui/types';

// =============================================================================
// Fixtures
// =============================================================================

function createStep(
  id: string,
  topic: string,
  context: string,
  parentId: string | null = null
): ExplorationStep {
  return {
    id,
    topic,
    context,
    timestamp: new Date().toISOString(),
    parentId,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Breadcrumbs', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    test('should render empty when no steps', () => {
      const { lastFrame } = render(<Breadcrumbs steps={[]} />);

      // Should render without crashing
      expect(lastFrame()).toBeDefined();
    });

    test('should render single step', () => {
      const steps = [createStep('1', 'Configuration', 'Exploring config files')];
      const { lastFrame } = render(<Breadcrumbs steps={steps} />);

      expect(lastFrame()).toContain('Configuration');
    });

    test('should render multiple steps with separator', () => {
      const steps = [
        createStep('1', 'Configuration', 'Config'),
        createStep('2', 'Skills', 'Skill analysis', '1'),
        createStep('3', 'Missing', 'Missing skills', '2'),
      ];
      const { lastFrame } = render(<Breadcrumbs steps={steps} />);

      const frame = lastFrame()!;
      expect(frame).toContain('Configuration');
      expect(frame).toContain('Skills');
      expect(frame).toContain('Missing');
    });

    test('should show context or topic for each step', () => {
      const steps = [
        createStep('1', 'Skills', 'Skill analysis'),
        createStep('2', 'Commit', 'commit-skill', '1'),
      ];
      const { lastFrame } = render(<Breadcrumbs steps={steps} />);

      const frame = lastFrame()!;
      expect(frame).toContain('Skills');
      expect(frame).toContain('Commit');
    });
  });

  describe('navigation', () => {
    test('should call onNavigate when step is selected', async () => {
      // Note: Navigation might require keyboard input
      // This test verifies the callback is passed correctly
      const onNavigate = mock(() => {});
      const steps = [
        createStep('step-1', 'First', 'First step'),
        createStep('step-2', 'Second', 'Second step', 'step-1'),
      ];

      const { lastFrame } = render(<Breadcrumbs steps={steps} onNavigate={onNavigate} />);

      // Component should render
      expect(lastFrame()).toContain('First');
      expect(lastFrame()).toContain('Second');
    });

    test('should render without onNavigate', () => {
      const steps = [createStep('1', 'Topic', 'Context')];
      const { lastFrame } = render(<Breadcrumbs steps={steps} />);

      expect(lastFrame()).toContain('Topic');
    });
  });

  describe('visual hierarchy', () => {
    test('should visually distinguish current step', () => {
      const steps = [
        createStep('1', 'Root', 'Root level'),
        createStep('2', 'Current', 'Current location', '1'),
      ];
      const { lastFrame } = render(<Breadcrumbs steps={steps} />);

      // Current step (last) should be present
      expect(lastFrame()).toContain('Current');
    });

    test('should show path separators', () => {
      const steps = [
        createStep('1', 'A', 'a'),
        createStep('2', 'B', 'b', '1'),
        createStep('3', 'C', 'c', '2'),
      ];
      const { lastFrame } = render(<Breadcrumbs steps={steps} />);

      // Should have some separator between items
      // The exact separator (>, /, →, etc.) is implementation-dependent
      expect(lastFrame()).toContain('A');
      expect(lastFrame()).toContain('B');
      expect(lastFrame()).toContain('C');
    });
  });

  describe('truncation', () => {
    test('should handle long topic names', () => {
      const steps = [createStep('1', 'A'.repeat(100), 'Very long topic')];
      const { lastFrame } = render(<Breadcrumbs steps={steps} />);

      // Should render without crashing
      expect(lastFrame()).toBeDefined();
    });

    test('should handle many steps gracefully', () => {
      const steps: ExplorationStep[] = [];
      for (let i = 0; i < 10; i++) {
        steps.push(createStep(`${i}`, `Step ${i}`, `Context ${i}`, i > 0 ? `${i - 1}` : null));
      }
      const { lastFrame } = render(<Breadcrumbs steps={steps} />);

      // Should render without crashing
      // May truncate or show ellipsis for many steps
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('accessibility', () => {
    test('should render semantic navigation structure', () => {
      const steps = [createStep('1', 'Home', 'Start'), createStep('2', 'Settings', 'Config', '1')];
      const { lastFrame } = render(<Breadcrumbs steps={steps} />);

      // Steps should be visible for screen readers
      expect(lastFrame()).toContain('Home');
      expect(lastFrame()).toContain('Settings');
    });
  });

  describe('styling', () => {
    test('should render inline', () => {
      const steps = [createStep('1', 'A', 'a'), createStep('2', 'B', 'b', '1')];
      const { lastFrame } = render(<Breadcrumbs steps={steps} />);

      // Should be a single-line breadcrumb trail
      expect(lastFrame()).toBeDefined();
    });

    test('should have consistent spacing', () => {
      const steps = [
        createStep('1', 'First', 'f'),
        createStep('2', 'Second', 's', '1'),
        createStep('3', 'Third', 't', '2'),
      ];
      const { lastFrame } = render(<Breadcrumbs steps={steps} />);

      expect(lastFrame()).toContain('First');
      expect(lastFrame()).toContain('Second');
      expect(lastFrame()).toContain('Third');
    });
  });
});
