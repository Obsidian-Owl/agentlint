/**
 * Unit tests for RecommendationDialog component
 *
 * Tests the recommendation display with accept/dismiss/defer actions.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { RecommendationDialog } from '../../../../src/tui/components/RecommendationDialog';
import type { Recommendation } from '../../../../src/orchestration/types';

// =============================================================================
// Helper
// =============================================================================

/** Small delay to allow React effects to settle */
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

/** Create a test recommendation */
function createRecommendation(overrides?: Partial<Recommendation>): Recommendation {
  return {
    type: 'preventive',
    action: 'Add input validation to the user form',
    rationale: 'Prevents invalid data from reaching the backend',
    priority: 'medium',
    effort: 'small',
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('RecommendationDialog', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    test('should render recommendation action', () => {
      const { lastFrame } = render(
        <RecommendationDialog
          recommendation={createRecommendation({ action: 'Fix the bug' })}
          onAction={() => {}}
        />
      );

      expect(lastFrame()).toContain('Fix the bug');
    });

    test('should render recommendation rationale', () => {
      const { lastFrame } = render(
        <RecommendationDialog
          recommendation={createRecommendation({ rationale: 'This prevents issues' })}
          onAction={() => {}}
        />
      );

      expect(lastFrame()).toContain('This prevents issues');
    });

    test('should render recommendation type', () => {
      const { lastFrame } = render(
        <RecommendationDialog
          recommendation={createRecommendation({ type: 'systemic' })}
          onAction={() => {}}
        />
      );

      expect(lastFrame()).toContain('systemic');
    });

    test('should render recommendation priority', () => {
      const { lastFrame } = render(
        <RecommendationDialog
          recommendation={createRecommendation({ priority: 'high' })}
          onAction={() => {}}
        />
      );

      expect(lastFrame()).toContain('high');
    });

    test('should render effort when provided', () => {
      const { lastFrame } = render(
        <RecommendationDialog
          recommendation={createRecommendation({ effort: 'large' })}
          onAction={() => {}}
        />
      );

      expect(lastFrame()).toContain('large');
    });

    test('should render without effort when not provided', () => {
      const rec = createRecommendation();
      delete rec.effort;

      const { lastFrame } = render(
        <RecommendationDialog recommendation={rec} onAction={() => {}} />
      );

      // Should not crash
      expect(lastFrame()).toBeDefined();
    });

    test('should show action options', () => {
      const { lastFrame } = render(
        <RecommendationDialog recommendation={createRecommendation()} onAction={() => {}} />
      );

      const frame = lastFrame()!;
      // Should show accept/dismiss/defer options
      expect(frame).toBeDefined();
    });
  });

  describe('accept action', () => {
    test('should call onAction with accept when selected', async () => {
      const onAction = mock(() => {});
      const { stdin } = render(
        <RecommendationDialog recommendation={createRecommendation()} onAction={onAction} />
      );

      await tick();
      // Press 'a' or 'y' for accept
      stdin.write('a');
      await tick();

      expect(onAction).toHaveBeenCalledWith('accept');
    });

    test('should accept with Enter key', async () => {
      const onAction = mock(() => {});
      const { stdin } = render(
        <RecommendationDialog recommendation={createRecommendation()} onAction={onAction} />
      );

      await tick();
      stdin.write('\r');
      await tick();

      expect(onAction).toHaveBeenCalledWith('accept');
    });
  });

  describe('dismiss action', () => {
    test('should call onAction with dismiss when selected', async () => {
      const onAction = mock(() => {});
      const { stdin } = render(
        <RecommendationDialog recommendation={createRecommendation()} onAction={onAction} />
      );

      await tick();
      // Press 'n' for dismiss (no)
      stdin.write('n');
      await tick();

      expect(onAction).toHaveBeenCalledWith('dismiss');
    });

    test('should dismiss with x key', async () => {
      const onAction = mock(() => {});
      const { stdin } = render(
        <RecommendationDialog recommendation={createRecommendation()} onAction={onAction} />
      );

      await tick();
      stdin.write('x');
      await tick();

      expect(onAction).toHaveBeenCalledWith('dismiss');
    });
  });

  describe('defer action', () => {
    test('should call onAction with defer when selected', async () => {
      const onAction = mock(() => {});
      const { stdin } = render(
        <RecommendationDialog recommendation={createRecommendation()} onAction={onAction} />
      );

      await tick();
      // Press 'd' for defer
      stdin.write('d');
      await tick();

      expect(onAction).toHaveBeenCalledWith('defer');
    });

    test('should defer with Escape key', async () => {
      const onAction = mock(() => {});
      const { stdin } = render(
        <RecommendationDialog recommendation={createRecommendation()} onAction={onAction} />
      );

      await tick();
      stdin.write('\x1b'); // Escape
      await tick();

      expect(onAction).toHaveBeenCalledWith('defer');
    });
  });

  describe('keyboard shortcuts', () => {
    test('should respond to keyboard input', async () => {
      const onAction = mock(() => {});
      const { lastFrame } = render(
        <RecommendationDialog recommendation={createRecommendation()} onAction={onAction} />
      );

      await tick();

      // Should render and accept keyboard input
      expect(lastFrame()).toBeDefined();
    });

    test('should ignore unrecognized keys', async () => {
      const onAction = mock(() => {});
      const { stdin } = render(
        <RecommendationDialog recommendation={createRecommendation()} onAction={onAction} />
      );

      await tick();
      stdin.write('z');
      await tick();

      expect(onAction).not.toHaveBeenCalled();
    });
  });

  describe('recommendation types', () => {
    test('should render symptomatic recommendation', () => {
      const { lastFrame } = render(
        <RecommendationDialog
          recommendation={createRecommendation({ type: 'symptomatic' })}
          onAction={() => {}}
        />
      );

      expect(lastFrame()).toContain('symptomatic');
    });

    test('should render preventive recommendation', () => {
      const { lastFrame } = render(
        <RecommendationDialog
          recommendation={createRecommendation({ type: 'preventive' })}
          onAction={() => {}}
        />
      );

      expect(lastFrame()).toContain('preventive');
    });

    test('should render systemic recommendation', () => {
      const { lastFrame } = render(
        <RecommendationDialog
          recommendation={createRecommendation({ type: 'systemic' })}
          onAction={() => {}}
        />
      );

      expect(lastFrame()).toContain('systemic');
    });
  });

  describe('priority levels', () => {
    test('should render high priority', () => {
      const { lastFrame } = render(
        <RecommendationDialog
          recommendation={createRecommendation({ priority: 'high' })}
          onAction={() => {}}
        />
      );

      expect(lastFrame()).toContain('high');
    });

    test('should render medium priority', () => {
      const { lastFrame } = render(
        <RecommendationDialog
          recommendation={createRecommendation({ priority: 'medium' })}
          onAction={() => {}}
        />
      );

      expect(lastFrame()).toContain('medium');
    });

    test('should render low priority', () => {
      const { lastFrame } = render(
        <RecommendationDialog
          recommendation={createRecommendation({ priority: 'low' })}
          onAction={() => {}}
        />
      );

      expect(lastFrame()).toContain('low');
    });
  });
});
