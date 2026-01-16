/**
 * T047: Unit tests for CausalTree component
 *
 * Tests US-005: Trace Issue to Origin
 * Tests FR-007: Show causal chain with box-drawing characters
 */

import { describe, test, expect } from 'bun:test';
import { render } from 'ink-testing-library';
import { CausalTree, type CausalNode } from '../../../../src/cli/components/CausalTree';

// Helper to create test causal nodes
function createCausalNode(overrides: Partial<CausalNode> = {}): CausalNode {
  return {
    id: 'node-1',
    type: 'finding',
    title: 'Test Finding',
    description: 'A test finding description',
    ...overrides,
  };
}

describe('CausalTree component', () => {
  describe('rendering', () => {
    test('renders without crashing', () => {
      const root = createCausalNode({ type: 'finding', title: 'Root Issue' });
      const { lastFrame } = render(<CausalTree root={root} />);
      expect(lastFrame()).toBeDefined();
    });

    test('displays root node title', () => {
      const root = createCausalNode({ title: 'Missing project context' });
      const { lastFrame } = render(<CausalTree root={root} />);
      expect(lastFrame()).toContain('Missing project context');
    });

    test('displays node type', () => {
      const root = createCausalNode({ type: 'finding', title: 'Test' });
      const { lastFrame } = render(<CausalTree root={root} />);
      const frame = lastFrame()?.toLowerCase() ?? '';
      expect(frame).toContain('finding');
    });
  });

  describe('tree structure', () => {
    test('renders single node without children', () => {
      const root = createCausalNode({ title: 'Single Node' });
      const { lastFrame } = render(<CausalTree root={root} />);
      expect(lastFrame()).toContain('Single Node');
    });

    test('renders parent with one child', () => {
      const root = createCausalNode({
        title: 'Parent',
        children: [createCausalNode({ id: 'child-1', title: 'Child' })],
      });
      const { lastFrame } = render(<CausalTree root={root} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('Parent');
      expect(frame).toContain('Child');
    });

    test('renders parent with multiple children', () => {
      const root = createCausalNode({
        title: 'Parent',
        children: [
          createCausalNode({ id: 'child-1', title: 'First Child' }),
          createCausalNode({ id: 'child-2', title: 'Second Child' }),
        ],
      });
      const { lastFrame } = render(<CausalTree root={root} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('Parent');
      expect(frame).toContain('First Child');
      expect(frame).toContain('Second Child');
    });

    test('renders deeply nested tree', () => {
      const root = createCausalNode({
        title: 'Issue',
        children: [
          createCausalNode({
            id: 'origin',
            type: 'origin',
            title: 'Origin',
            children: [
              createCausalNode({
                id: 'cause',
                type: 'root_cause',
                title: 'Root Cause',
                children: [
                  createCausalNode({
                    id: 'rec',
                    type: 'recommendation',
                    title: 'Recommendation',
                  }),
                ],
              }),
            ],
          }),
        ],
      });
      const { lastFrame } = render(<CausalTree root={root} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('Issue');
      expect(frame).toContain('Origin');
      expect(frame).toContain('Root Cause');
      expect(frame).toContain('Recommendation');
    });
  });

  describe('box-drawing characters', () => {
    test('uses box-drawing characters for tree structure', () => {
      const root = createCausalNode({
        title: 'Parent',
        children: [createCausalNode({ id: 'child', title: 'Child' })],
      });
      const { lastFrame } = render(<CausalTree root={root} />);
      const frame = lastFrame() ?? '';
      // Should contain at least one box-drawing character
      const hasBoxChar =
        frame.includes('├') || frame.includes('└') || frame.includes('│') || frame.includes('─');
      expect(hasBoxChar).toBe(true);
    });

    test('uses └── for last child', () => {
      const root = createCausalNode({
        title: 'Parent',
        children: [createCausalNode({ id: 'child', title: 'Only Child' })],
      });
      const { lastFrame } = render(<CausalTree root={root} />);
      expect(lastFrame()).toContain('└');
    });

    test('uses ├── for non-last children', () => {
      const root = createCausalNode({
        title: 'Parent',
        children: [
          createCausalNode({ id: 'child-1', title: 'First' }),
          createCausalNode({ id: 'child-2', title: 'Second' }),
        ],
      });
      const { lastFrame } = render(<CausalTree root={root} />);
      expect(lastFrame()).toContain('├');
    });
  });

  describe('node types', () => {
    test('displays finding type', () => {
      const root = createCausalNode({ type: 'finding', title: 'Test Finding' });
      const { lastFrame } = render(<CausalTree root={root} />);
      const frame = lastFrame()?.toLowerCase() ?? '';
      expect(frame).toContain('finding');
    });

    test('displays origin type', () => {
      const root = createCausalNode({ type: 'origin', title: 'Test Origin' });
      const { lastFrame } = render(<CausalTree root={root} />);
      const frame = lastFrame()?.toLowerCase() ?? '';
      expect(frame).toContain('origin');
    });

    test('displays root_cause type', () => {
      const root = createCausalNode({ type: 'root_cause', title: 'Test Cause' });
      const { lastFrame } = render(<CausalTree root={root} />);
      const frame = lastFrame()?.toLowerCase() ?? '';
      expect(frame.includes('root') || frame.includes('cause')).toBe(true);
    });

    test('displays recommendation type', () => {
      const root = createCausalNode({ type: 'recommendation', title: 'Test Rec' });
      const { lastFrame } = render(<CausalTree root={root} />);
      const frame = lastFrame()?.toLowerCase() ?? '';
      expect(frame.includes('recommend') || frame.includes('rec')).toBe(true);
    });
  });

  describe('descriptions', () => {
    test('shows description when showDescriptions is true', () => {
      const root = createCausalNode({
        title: 'Finding',
        description: 'Detailed description here',
      });
      const { lastFrame } = render(<CausalTree root={root} showDescriptions={true} />);
      expect(lastFrame()).toContain('Detailed description here');
    });

    test('hides description when showDescriptions is false', () => {
      const root = createCausalNode({
        title: 'Finding',
        description: 'Should not appear',
      });
      const { lastFrame } = render(<CausalTree root={root} showDescriptions={false} />);
      const frame = lastFrame() ?? '';
      expect(frame).not.toContain('Should not appear');
    });
  });

  describe('compact mode', () => {
    test('renders in compact mode', () => {
      const root = createCausalNode({
        title: 'Parent',
        children: [createCausalNode({ id: 'child', title: 'Child' })],
      });
      const { lastFrame } = render(<CausalTree root={root} compact={true} />);
      expect(lastFrame()).toBeDefined();
    });

    test('compact mode shows less detail', () => {
      const root = createCausalNode({
        title: 'Finding',
        description: 'A long description that would be hidden',
        children: [
          createCausalNode({
            id: 'child',
            title: 'Child',
            description: 'Another description',
          }),
        ],
      });
      const compactFrame = render(<CausalTree root={root} compact={true} />).lastFrame() ?? '';
      const fullFrame =
        render(<CausalTree root={root} compact={false} showDescriptions={true} />).lastFrame() ??
        '';

      expect(compactFrame.length).toBeLessThanOrEqual(fullFrame.length);
    });
  });

  describe('causal chain visualization', () => {
    test('shows complete causal chain: finding → origin → cause → recommendation', () => {
      const root = createCausalNode({
        type: 'finding',
        title: 'Missing project context',
        children: [
          createCausalNode({
            id: 'origin',
            type: 'origin',
            title: 'CLAUDE.md lacks description',
            children: [
              createCausalNode({
                id: 'cause',
                type: 'root_cause',
                title: 'No project overview section',
                children: [
                  createCausalNode({
                    id: 'rec',
                    type: 'recommendation',
                    title: 'Add project overview to CLAUDE.md',
                  }),
                ],
              }),
            ],
          }),
        ],
      });
      const { lastFrame } = render(<CausalTree root={root} />);
      const frame = lastFrame() ?? '';

      // All nodes should be visible
      expect(frame).toContain('Missing project context');
      expect(frame).toContain('CLAUDE.md lacks description');
      expect(frame).toContain('No project overview section');
      expect(frame).toContain('Add project overview');
    });
  });

  describe('empty state', () => {
    test('renders minimal output for node without children', () => {
      const root = createCausalNode({ title: 'Leaf Node' });
      const { lastFrame } = render(<CausalTree root={root} />);
      expect(lastFrame()).toContain('Leaf Node');
    });
  });
});
