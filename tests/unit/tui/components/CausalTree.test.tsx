import { describe, test, expect, afterEach } from 'bun:test';
import { render, cleanup } from 'ink-testing-library';
import { CausalTree } from '../../../../src/tui/components/CausalTree';
import type { CausalNode } from '../../../../src/tui/components/CausalTree';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

function createSimpleTree(): CausalNode {
  return {
    id: 'finding-1',
    type: 'finding',
    title: 'Missing configuration',
    description: 'The config file is incomplete',
  };
}

function createNestedTree(): CausalNode {
  return {
    id: 'finding-1',
    type: 'finding',
    title: 'Missing project context',
    description: 'Project lacks essential context',
    children: [
      {
        id: 'origin-1',
        type: 'origin',
        title: 'CLAUDE.md lacks description',
        description: 'No project overview section found',
        children: [
          {
            id: 'cause-1',
            type: 'root_cause',
            title: 'File was auto-generated',
            description: 'Template was not customized',
            children: [
              {
                id: 'rec-1',
                type: 'recommendation',
                title: 'Add project overview',
                description: 'Document the project purpose and architecture',
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('CausalTree', () => {
  afterEach(() => {
    cleanup();
  });

  describe('root node rendering', () => {
    test('should render root node title', async () => {
      const { lastFrame } = render(<CausalTree root={createSimpleTree()} />);

      await tick();

      expect(lastFrame()).toContain('Missing configuration');
    });

    test('should render root node type label', async () => {
      const { lastFrame } = render(<CausalTree root={createSimpleTree()} />);

      await tick();

      expect(lastFrame()).toContain('[Finding]');
    });

    test('should not show description by default', async () => {
      const { lastFrame } = render(<CausalTree root={createSimpleTree()} />);

      await tick();

      expect(lastFrame()).not.toContain('config file is incomplete');
    });

    test('should show description when showDescriptions is true', async () => {
      const { lastFrame } = render(
        <CausalTree root={createSimpleTree()} showDescriptions={true} />
      );

      await tick();

      expect(lastFrame()).toContain('config file is incomplete');
    });
  });

  describe('nested tree rendering', () => {
    test('should render all node types', async () => {
      const { lastFrame } = render(<CausalTree root={createNestedTree()} />);

      await tick();

      expect(lastFrame()).toContain('[Finding]');
      expect(lastFrame()).toContain('[Origin]');
      expect(lastFrame()).toContain('[Root Cause]');
      expect(lastFrame()).toContain('[Recommendation]');
    });

    test('should render all node titles', async () => {
      const { lastFrame } = render(<CausalTree root={createNestedTree()} />);

      await tick();

      expect(lastFrame()).toContain('Missing project context');
      expect(lastFrame()).toContain('CLAUDE.md lacks description');
      expect(lastFrame()).toContain('File was auto-generated');
      expect(lastFrame()).toContain('Add project overview');
    });

    test('should render tree structure characters', async () => {
      const { lastFrame } = render(<CausalTree root={createNestedTree()} />);

      await tick();

      expect(lastFrame()).toContain('─');
    });
  });

  describe('compact mode', () => {
    test('should not show descriptions in compact mode', async () => {
      const { lastFrame } = render(
        <CausalTree root={createSimpleTree()} showDescriptions={true} compact={true} />
      );

      await tick();

      expect(lastFrame()).toContain('Missing configuration');
      expect(lastFrame()).not.toContain('config file is incomplete');
    });
  });

  describe('multiple children', () => {
    test('should render multiple children at same level', async () => {
      const tree: CausalNode = {
        id: 'root',
        type: 'finding',
        title: 'Root Finding',
        children: [
          { id: 'child-1', type: 'origin', title: 'First Origin' },
          { id: 'child-2', type: 'origin', title: 'Second Origin' },
        ],
      };
      const { lastFrame } = render(<CausalTree root={tree} />);

      await tick();

      expect(lastFrame()).toContain('First Origin');
      expect(lastFrame()).toContain('Second Origin');
    });
  });
});
