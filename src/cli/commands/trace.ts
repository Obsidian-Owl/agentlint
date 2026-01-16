/**
 * EP04 CLI Interface - Trace Command
 *
 * Implements US-005: Trace Issue to Origin.
 * Implements FR-007: Show causal chain with box-drawing characters.
 *
 * The trace command displays the causal chain from a finding
 * to its root cause, helping developers understand why an issue
 * occurred and how to prevent it.
 *
 * @module cli/commands/trace
 */

import { getOutputMode } from '../utils/output';
import type { GlobalOptions } from '../types';
import type { CausalNode, CausalNodeType } from '../components/CausalTree';

/**
 * Options for the trace command.
 */
export interface TraceOptions extends GlobalOptions {
  /** Finding ID to trace */
  findingId: string;
}

/**
 * Trace result structure for JSON output.
 */
export interface TraceResult {
  /** Status of the trace operation */
  status: 'success' | 'error' | 'not_found';
  /** Error message if status is 'error' or 'not_found' */
  error?: string;
  /** Finding ID that was traced */
  findingId: string;
  /** The causal chain (if found) */
  causalChain?: CausalNode;
  /** ISO-8601 timestamp */
  timestamp: string;
}

/**
 * Storage interface for finding lookup.
 * In a real implementation, this would query the persistence layer.
 */
interface FindingStore {
  findById(id: string): Promise<StoredFinding | null>;
}

/**
 * Stored finding with causal chain data.
 */
interface StoredFinding {
  id: string;
  title: string;
  description: string;
  severity: string;
  origin?: {
    id: string;
    title: string;
    description?: string;
  };
  rootCause?: {
    id: string;
    title: string;
    description?: string;
  };
  recommendation?: {
    id: string;
    title: string;
    description?: string;
  };
}

/**
 * Box-drawing characters for tree structure.
 */
const TREE_CHARS = {
  vertical: '│',
  branch: '├',
  lastBranch: '└',
  horizontal: '──',
  space: '   ',
} as const;

/**
 * Get display label for node type.
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
 * Builds a causal chain tree from a stored finding.
 */
function buildCausalChain(finding: StoredFinding): CausalNode {
  const children: CausalNode[] = [];

  if (finding.origin) {
    const originChildren: CausalNode[] = [];

    if (finding.rootCause) {
      const causeChildren: CausalNode[] = [];

      if (finding.recommendation) {
        causeChildren.push({
          id: finding.recommendation.id,
          type: 'recommendation',
          title: finding.recommendation.title,
          description: finding.recommendation.description,
        });
      }

      originChildren.push({
        id: finding.rootCause.id,
        type: 'root_cause',
        title: finding.rootCause.title,
        description: finding.rootCause.description,
        children: causeChildren.length > 0 ? causeChildren : undefined,
      });
    }

    children.push({
      id: finding.origin.id,
      type: 'origin',
      title: finding.origin.title,
      description: finding.origin.description,
      children: originChildren.length > 0 ? originChildren : undefined,
    });
  }

  return {
    id: finding.id,
    type: 'finding',
    title: finding.title,
    description: finding.description,
    children: children.length > 0 ? children : undefined,
  };
}

/**
 * Renders a node for plain text output.
 */
function renderNodePlain(node: CausalNode, prefix: string, isLast: boolean, lines: string[]): void {
  const connector = isLast ? TREE_CHARS.lastBranch : TREE_CHARS.branch;
  const label = getTypeLabel(node.type);

  lines.push(`${prefix}${connector}${TREE_CHARS.horizontal} [${label}] ${node.title}`);

  const childPrefix = prefix + (isLast ? TREE_CHARS.space : `${TREE_CHARS.vertical}  `);

  if (node.description) {
    lines.push(`${childPrefix}${node.description}`);
  }

  if (node.children) {
    node.children.forEach((child, index) => {
      renderNodePlain(child, childPrefix, index === node.children!.length - 1, lines);
    });
  }
}

/**
 * Formats the causal chain for plain text terminal output.
 */
function formatTerminal(result: TraceResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('Causal Chain Trace');
  lines.push('==================');
  lines.push('');

  if (result.status === 'not_found') {
    lines.push(`Error: Finding not found: ${result.findingId}`);
    lines.push('');
    lines.push('To see available findings, run:');
    lines.push("  agentlint analyse --json | jq '.findings[].id'");
    lines.push('');
    return lines.join('\n');
  }

  if (result.status === 'error') {
    lines.push(`Error: ${result.error}`);
    lines.push('');
    return lines.join('\n');
  }

  if (!result.causalChain) {
    lines.push('No causal chain data available.');
    lines.push('');
    return lines.join('\n');
  }

  const chain = result.causalChain;
  const label = getTypeLabel(chain.type);

  // Root node (no prefix)
  lines.push(`[${label}] ${chain.title}`);

  if (chain.description) {
    lines.push(`  ${chain.description}`);
  }

  // Children
  if (chain.children) {
    chain.children.forEach((child, index) => {
      renderNodePlain(child, '', index === chain.children!.length - 1, lines);
    });
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Formats the trace result for JSON output.
 */
function formatJson(result: TraceResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Formats the trace result for Markdown output.
 */
function formatMarkdown(result: TraceResult): string {
  const lines: string[] = [];

  lines.push('# Causal Chain Trace');
  lines.push('');
  lines.push(`**Finding ID:** ${result.findingId}`);
  lines.push(`**Timestamp:** ${result.timestamp}`);
  lines.push('');

  if (result.status === 'not_found') {
    lines.push('> **Error:** Finding not found');
    lines.push('');
    return lines.join('\n');
  }

  if (result.status === 'error') {
    lines.push(`> **Error:** ${result.error}`);
    lines.push('');
    return lines.join('\n');
  }

  if (!result.causalChain) {
    lines.push('No causal chain data available.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('## Causal Chain');
  lines.push('');

  // Render as nested list
  function renderMarkdownNode(node: CausalNode, depth: number): void {
    const indent = '  '.repeat(depth);
    const label = getTypeLabel(node.type);
    lines.push(`${indent}- **[${label}]** ${node.title}`);

    if (node.description) {
      lines.push(`${indent}  - ${node.description}`);
    }

    if (node.children) {
      node.children.forEach((child) => renderMarkdownNode(child, depth + 1));
    }
  }

  renderMarkdownNode(result.causalChain, 0);

  lines.push('');
  return lines.join('\n');
}

/**
 * Creates a mock finding store for demonstration.
 * In a real implementation, this would connect to the persistence layer.
 */
function createFindingStore(): FindingStore {
  // Mock data for demonstration and testing
  const mockFindings: Map<string, StoredFinding> = new Map([
    [
      'FND-001',
      {
        id: 'FND-001',
        title: 'Missing project context in CLAUDE.md',
        description: 'The CLAUDE.md file lacks essential project description',
        severity: 'medium',
        origin: {
          id: 'ORG-001',
          title: 'CLAUDE.md lacks description section',
          description: 'No project overview found in configuration',
        },
        rootCause: {
          id: 'RC-001',
          title: 'No project overview section exists',
          description: 'The file was created without a standard template',
        },
        recommendation: {
          id: 'REC-001',
          title: 'Add project overview to CLAUDE.md',
          description: 'Include project purpose, tech stack, and key conventions',
        },
      },
    ],
  ]);

  return {
    findById(id: string): Promise<StoredFinding | null> {
      return Promise.resolve(mockFindings.get(id) ?? null);
    },
  };
}

/**
 * Runs the trace command.
 *
 * @param options - Command options including findingId
 * @returns Exit code (0 for success, non-zero for failure)
 */
export async function runTrace(options: TraceOptions): Promise<number> {
  const { findingId } = options;
  const outputMode = getOutputMode(options);
  const store = createFindingStore();

  // Look up the finding
  const finding = await store.findById(findingId);

  let result: TraceResult;

  if (!finding) {
    result = {
      status: 'not_found',
      error: `Finding not found: ${findingId}`,
      findingId,
      timestamp: new Date().toISOString(),
    };
  } else {
    const causalChain = buildCausalChain(finding);
    result = {
      status: 'success',
      findingId,
      causalChain,
      timestamp: new Date().toISOString(),
    };
  }

  // Format output based on mode
  if (outputMode === 'json') {
    console.log(formatJson(result));
  } else if (outputMode === 'markdown') {
    console.log(formatMarkdown(result));
  } else {
    console.log(formatTerminal(result));
  }

  // Return appropriate exit code
  return result.status === 'success' ? 0 : 1;
}

export default runTrace;
