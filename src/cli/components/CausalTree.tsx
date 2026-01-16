/**
 * EP04 CLI Interface - CausalTree Component
 *
 * Implements FR-007: Show causal chain with box-drawing characters.
 *
 * Displays a tree visualization of the causal chain from finding
 * to root cause using Unicode box-drawing characters.
 *
 * Tree structure: finding → origin → root cause → recommendation
 *
 * @module cli/components/CausalTree
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useColors } from '../utils/colors';

/**
 * Type of node in the causal tree.
 */
export type CausalNodeType = 'finding' | 'origin' | 'root_cause' | 'recommendation';

/**
 * A node in the causal tree.
 */
export interface CausalNode {
  /** Unique identifier */
  id: string;
  /** Type of node */
  type: CausalNodeType;
  /** Short title */
  title: string;
  /** Detailed description */
  description?: string | undefined;
  /** Child nodes */
  children?: CausalNode[] | undefined;
  /** Additional metadata */
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Props for the CausalTree component.
 */
export interface CausalTreeProps {
  /** Root node of the tree */
  root: CausalNode;
  /** Show descriptions for each node (default: false) */
  showDescriptions?: boolean | undefined;
  /** Use compact display mode (default: false) */
  compact?: boolean | undefined;
}

/**
 * Box-drawing characters for tree structure.
 */
const TREE_CHARS = {
  /** Vertical line */
  vertical: '│',
  /** Branch for non-last child */
  branch: '├',
  /** Branch for last child */
  lastBranch: '└',
  /** Horizontal line */
  horizontal: '──',
  /** Spacing */
  space: '   ',
} as const;

/**
 * Get display name for node type.
 */
function getTypeLabel(type: CausalNodeType): string {
  const labels: Record<CausalNodeType, string> = {
    finding: 'Finding',
    origin: 'Origin',
    root_cause: 'Root Cause',
    recommendation: 'Recommendation',
  };
  return labels[type];
}

/**
 * Get color for node type.
 */
function getTypeColor(type: CausalNodeType, colors: ReturnType<typeof useColors>): string {
  switch (type) {
    case 'finding':
      return colors.error;
    case 'origin':
      return colors.warning;
    case 'root_cause':
      return colors.info;
    case 'recommendation':
      return colors.success;
    default:
      return colors.text;
  }
}

/**
 * Props for a single tree node.
 */
interface TreeNodeProps {
  node: CausalNode;
  prefix: string;
  isLast: boolean;
  showDescriptions: boolean;
  compact: boolean;
  colors: ReturnType<typeof useColors>;
}

/**
 * Renders a single node in the tree.
 */
function TreeNode({
  node,
  prefix,
  isLast,
  showDescriptions,
  compact,
  colors,
}: TreeNodeProps): React.ReactElement {
  const typeColor = getTypeColor(node.type, colors);
  const typeLabel = getTypeLabel(node.type);
  const connector = isLast ? TREE_CHARS.lastBranch : TREE_CHARS.branch;
  const childPrefix = prefix + (isLast ? TREE_CHARS.space : `${TREE_CHARS.vertical}  `);

  return (
    <Box flexDirection="column">
      {/* Node line */}
      <Box>
        <Text color={colors.dim}>
          {prefix}
          {connector}
          {TREE_CHARS.horizontal}{' '}
        </Text>
        <Text color={typeColor} bold>
          [{typeLabel}]
        </Text>
        <Text> {node.title}</Text>
      </Box>

      {/* Description (if enabled and not compact) */}
      {showDescriptions && !compact && node.description && (
        <Box>
          <Text color={colors.dim}>{childPrefix}</Text>
          <Text color={colors.dim}>{node.description}</Text>
        </Box>
      )}

      {/* Children */}
      {node.children?.map((child, index) => (
        <TreeNode
          key={child.id}
          node={child}
          prefix={childPrefix}
          isLast={index === (node.children?.length ?? 0) - 1}
          showDescriptions={showDescriptions}
          compact={compact}
          colors={colors}
        />
      ))}
    </Box>
  );
}

/**
 * CausalTree component for displaying causal chain visualization.
 *
 * Renders a tree using box-drawing characters showing the path
 * from finding to root cause to recommendation.
 *
 * @example
 * ```tsx
 * const tree = {
 *   id: 'finding-1',
 *   type: 'finding',
 *   title: 'Missing project context',
 *   children: [{
 *     id: 'origin-1',
 *     type: 'origin',
 *     title: 'CLAUDE.md lacks description',
 *     children: [{
 *       id: 'cause-1',
 *       type: 'root_cause',
 *       title: 'No project overview section',
 *       children: [{
 *         id: 'rec-1',
 *         type: 'recommendation',
 *         title: 'Add project overview to CLAUDE.md'
 *       }]
 *     }]
 *   }]
 * };
 *
 * <CausalTree root={tree} showDescriptions={true} />
 * ```
 */
export function CausalTree({
  root,
  showDescriptions = false,
  compact = false,
}: CausalTreeProps): React.ReactElement {
  const colors = useColors();
  const typeColor = getTypeColor(root.type, colors);
  const typeLabel = getTypeLabel(root.type);

  return (
    <Box flexDirection="column">
      {/* Root node (no prefix) */}
      <Box>
        <Text color={typeColor} bold>
          [{typeLabel}]
        </Text>
        <Text> {root.title}</Text>
      </Box>

      {/* Root description */}
      {showDescriptions && !compact && root.description && (
        <Box marginLeft={2}>
          <Text color={colors.dim}>{root.description}</Text>
        </Box>
      )}

      {/* Children */}
      {root.children?.map((child, index) => (
        <TreeNode
          key={child.id}
          node={child}
          prefix=""
          isLast={index === (root.children?.length ?? 0) - 1}
          showDescriptions={showDescriptions}
          compact={compact}
          colors={colors}
        />
      ))}
    </Box>
  );
}

export default CausalTree;
