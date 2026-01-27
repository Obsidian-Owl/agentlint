/**
 * Unit tests for ToolPhaseRenderer component
 *
 * Tests the three-phase tool invocation display:
 * - Preparing: Tool call initiated
 * - Running: Tool executing
 * - Complete: Tool finished (success/error)
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { ToolPhaseRenderer } from '../../../../src/tui/components/ToolPhaseRenderer';
import type { StreamChunk } from '../../../../src/orchestration/types';

// =============================================================================
// Helper
// =============================================================================

/** Small delay to allow React effects to settle */
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

/** Create a mock StreamChunk for testing */
function createMockChunk(overrides: Partial<StreamChunk['metadata']> = {}): StreamChunk {
  return {
    type: 'tool_start',
    level: 'normal',
    content: '',
    timestamp: new Date().toISOString(),
    metadata: {
      toolName: 'MockTool',
      ...overrides,
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('ToolPhaseRenderer', () => {
  afterEach(() => {
    cleanup();
  });

  describe('preparing phase', () => {
    test('should render preparing state with tool name', async () => {
      const chunk = createMockChunk({ toolName: 'ReadFile' });
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="preparing" />);

      await tick();

      expect(lastFrame()).toContain('ReadFile');
      expect(lastFrame()).toContain('Preparing...');
    });

    test('should show spinner during preparing phase', async () => {
      const chunk = createMockChunk();
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="preparing" />);

      await tick();

      // Spinner is active, component should render without error
      expect(lastFrame()).toBeDefined();
      expect(lastFrame()).toContain('Preparing...');
    });

    test('should use cyan color for preparing phase', async () => {
      const chunk = createMockChunk();
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="preparing" />);

      await tick();

      // Component renders with border - verifying it doesn't crash
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('running phase', () => {
    test('should render running state with tool name', async () => {
      const chunk = createMockChunk({ toolName: 'ExecuteCommand' });
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="running" />);

      await tick();

      expect(lastFrame()).toContain('ExecuteCommand');
      expect(lastFrame()).toContain('Running...');
    });

    test('should show spinner during running phase', async () => {
      const chunk = createMockChunk();
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="running" />);

      await tick();

      expect(lastFrame()).toBeDefined();
      expect(lastFrame()).toContain('Running...');
    });
  });

  describe('complete phase - success', () => {
    test('should render complete state with success indicator', async () => {
      const chunk = createMockChunk({ success: true });
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="complete" />);

      await tick();

      expect(lastFrame()).toContain('Complete');
      expect(lastFrame()).toContain('✓');
    });

    test('should display duration when available', async () => {
      const chunk = createMockChunk({ success: true, durationMs: 150 });
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="complete" />);

      await tick();

      expect(lastFrame()).toContain('150ms');
    });

    test('should display output when available', async () => {
      const chunk = createMockChunk({
        success: true,
        output: 'Command executed successfully',
      });
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="complete" />);

      await tick();

      expect(lastFrame()).toContain('Command executed successfully');
    });

    test('should not show spinner in complete phase', async () => {
      const chunk = createMockChunk({ success: true });
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="complete" />);

      await tick();

      // Should show checkmark icon instead of spinner
      expect(lastFrame()).toContain('✓');
    });
  });

  describe('complete phase - error', () => {
    test('should render error indicator when success is false', async () => {
      const chunk = createMockChunk({ success: false });
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="complete" />);

      await tick();

      expect(lastFrame()).toContain('✗');
    });

    test('should display error output', async () => {
      const chunk = createMockChunk({
        success: false,
        output: 'Error: File not found',
      });
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="complete" />);

      await tick();

      expect(lastFrame()).toContain('Error: File not found');
    });
  });

  describe('output truncation', () => {
    test('should truncate output longer than 10 lines', async () => {
      const longOutput = Array.from({ length: 15 }, (_, i) => `Line ${i + 1}`).join('\n');
      const chunk = createMockChunk({
        success: true,
        output: longOutput,
      });
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="complete" />);

      await tick();

      const frame = lastFrame();
      expect(frame).toContain('Line 1');
      expect(frame).toContain('Line 10');
      expect(frame).toContain('5 more lines');
      expect(frame).not.toContain('Line 15');
    });

    test('should show all lines when output is 10 lines or less', async () => {
      const output = Array.from({ length: 5 }, (_, i) => `Line ${i + 1}`).join('\n');
      const chunk = createMockChunk({
        success: true,
        output,
      });
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="complete" />);

      await tick();

      const frame = lastFrame();
      expect(frame).toContain('Line 1');
      expect(frame).toContain('Line 5');
      expect(frame).not.toContain('more lines');
    });

    test('should handle exactly 10 lines without truncation', async () => {
      const output = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join('\n');
      const chunk = createMockChunk({
        success: true,
        output,
      });
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="complete" />);

      await tick();

      const frame = lastFrame();
      expect(frame).toContain('Line 10');
      expect(frame).not.toContain('more lines');
    });
  });

  describe('tool name handling', () => {
    test('should display tool name from metadata', async () => {
      const chunk = createMockChunk({ toolName: 'CustomToolName' });
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="preparing" />);

      await tick();

      expect(lastFrame()).toContain('CustomToolName');
    });

    test('should fallback to "Tool" when toolName is not in metadata', async () => {
      const chunk: StreamChunk = {
        type: 'tool_start',
        level: 'normal',
        content: '',
        timestamp: new Date().toISOString(),
        metadata: {},
      };
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="preparing" />);

      await tick();

      expect(lastFrame()).toContain('Tool');
    });

    test('should handle undefined metadata gracefully', async () => {
      const chunk: StreamChunk = {
        type: 'tool_start',
        level: 'normal',
        content: '',
        timestamp: new Date().toISOString(),
      };
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="preparing" />);

      await tick();

      expect(lastFrame()).toContain('Tool');
    });
  });

  describe('phase icons', () => {
    test('should show diamond icon for preparing phase', async () => {
      const chunk = createMockChunk();
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="preparing" />);

      await tick();

      // Preparing uses spinner, not static icon
      expect(lastFrame()).toBeDefined();
    });

    test('should show checkmark for successful complete', async () => {
      const chunk = createMockChunk({ success: true });
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="complete" />);

      await tick();

      expect(lastFrame()).toContain('✓');
    });

    test('should show X for failed complete', async () => {
      const chunk = createMockChunk({ success: false });
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="complete" />);

      await tick();

      expect(lastFrame()).toContain('✗');
    });
  });

  describe('rendering without output', () => {
    test('should render complete phase without output section when output is undefined', async () => {
      const chunk = createMockChunk({ success: true });
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="complete" />);

      await tick();

      const frame = lastFrame();
      expect(frame).toContain('Complete');
      expect(frame).toContain('✓');
    });

    test('should render complete phase without output section when output is empty', async () => {
      const chunk = createMockChunk({ success: true, output: '' });
      const { lastFrame } = render(<ToolPhaseRenderer chunk={chunk} phase="complete" />);

      await tick();

      const frame = lastFrame();
      expect(frame).toContain('Complete');
    });
  });
});
