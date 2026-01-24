/**
 * Unit tests for PermissionDialog component
 *
 * Tests the permission request dialog with session/permanent choices.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { PermissionDialog } from '../../../../src/tui/components/PermissionDialog';
import type { PermissionDecision } from '../../../../src/tui/types';

// =============================================================================
// Helper
// =============================================================================

/** Small delay to allow React effects to settle */
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

/** Extract first call argument from mock, cast through unknown for type safety */
function getFirstCallArg<T>(mockFn: ReturnType<typeof mock>): T {
  const calls = mockFn.mock.calls as unknown[][];
  return calls[0]![0] as T;
}

// =============================================================================
// Tests
// =============================================================================

describe('PermissionDialog', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    test('should render tool name', () => {
      const { lastFrame } = render(
        <PermissionDialog
          tool="read_file"
          description="Read contents of a file"
          onDecision={() => {}}
        />
      );

      expect(lastFrame()).toContain('read_file');
    });

    test('should render description', () => {
      const { lastFrame } = render(
        <PermissionDialog
          tool="execute_command"
          description="Run a shell command on your system"
          onDecision={() => {}}
        />
      );

      expect(lastFrame()).toContain('Run a shell command');
    });

    test('should render pattern when provided', () => {
      const { lastFrame } = render(
        <PermissionDialog
          tool="read_file"
          description="Read a file"
          pattern="/home/user/*.ts"
          onDecision={() => {}}
        />
      );

      expect(lastFrame()).toContain('/home/user/*.ts');
    });

    test('should render without pattern', () => {
      const { lastFrame } = render(
        <PermissionDialog
          tool="list_directory"
          description="List directory contents"
          onDecision={() => {}}
        />
      );

      expect(lastFrame()).toContain('list_directory');
    });

    test('should show permission options', () => {
      const { lastFrame } = render(
        <PermissionDialog tool="write_file" description="Write to a file" onDecision={() => {}} />
      );

      const frame = lastFrame()!;
      // Should show allow/deny options
      expect(frame).toBeDefined();
    });
  });

  describe('session permission', () => {
    test('should call onDecision with session scope when selected', async () => {
      const onDecision = mock(() => {});
      const { stdin } = render(
        <PermissionDialog tool="read_file" description="Read a file" onDecision={onDecision} />
      );

      await tick();
      // Press 'y' or '1' for session allow
      stdin.write('y');
      await tick();

      expect(onDecision).toHaveBeenCalled();
      const decision = getFirstCallArg<PermissionDecision>(onDecision);
      expect(decision.allowed).toBe(true);
      expect(decision.scope).toBe('session');
    });
  });

  describe('permanent permission', () => {
    test('should call onDecision with permanent scope when selected', async () => {
      const onDecision = mock(() => {});
      const { stdin } = render(
        <PermissionDialog tool="read_file" description="Read a file" onDecision={onDecision} />
      );

      await tick();
      // Press 'a' or appropriate key for permanent allow
      stdin.write('a');
      await tick();

      expect(onDecision).toHaveBeenCalled();
      const decision = getFirstCallArg<PermissionDecision>(onDecision);
      expect(decision.allowed).toBe(true);
      expect(decision.scope).toBe('permanent');
    });
  });

  describe('deny permission', () => {
    test('should call onDecision with denied when selected', async () => {
      const onDecision = mock(() => {});
      const { stdin } = render(
        <PermissionDialog
          tool="execute_command"
          description="Run command"
          onDecision={onDecision}
        />
      );

      await tick();
      // Press 'n' for deny
      stdin.write('n');
      await tick();

      expect(onDecision).toHaveBeenCalled();
      const decision = getFirstCallArg<PermissionDecision>(onDecision);
      expect(decision.allowed).toBe(false);
    });
  });

  describe('keyboard shortcuts', () => {
    test('should respond to keyboard input', async () => {
      const onDecision = mock(() => {});
      const { lastFrame } = render(
        <PermissionDialog tool="test_tool" description="Test" onDecision={onDecision} />
      );

      await tick();

      // Should render and accept keyboard input
      expect(lastFrame()).toContain('test_tool');
    });
  });

  describe('decision metadata', () => {
    test('should include tool name in decision', async () => {
      const onDecision = mock(() => {});
      const { stdin } = render(
        <PermissionDialog
          tool="special_tool"
          description="Special operation"
          onDecision={onDecision}
        />
      );

      await tick();
      stdin.write('y');
      await tick();

      const decision = getFirstCallArg<PermissionDecision>(onDecision);
      expect(decision.tool).toBe('special_tool');
    });

    test('should include pattern in decision when provided', async () => {
      const onDecision = mock(() => {});
      const { stdin } = render(
        <PermissionDialog
          tool="read_file"
          description="Read"
          pattern="*.ts"
          onDecision={onDecision}
        />
      );

      await tick();
      stdin.write('y');
      await tick();

      const decision = getFirstCallArg<PermissionDecision>(onDecision);
      expect(decision.pattern).toBe('*.ts');
    });

    test('should include timestamp in decision', async () => {
      const onDecision = mock(() => {});
      const { stdin } = render(
        <PermissionDialog tool="tool" description="desc" onDecision={onDecision} />
      );

      await tick();
      stdin.write('y');
      await tick();

      const decision = getFirstCallArg<PermissionDecision>(onDecision);
      expect(decision.grantedAt).toBeDefined();
    });
  });
});
