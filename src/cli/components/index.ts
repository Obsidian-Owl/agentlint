/**
 * EP04 CLI Interface - Components
 *
 * Ink-based React components for terminal UI.
 *
 * @module cli/components
 */

// Re-export components from TUI module (moved in EP17)
export { Progress, type ProgressProps } from '../../tui/components/Progress';
export { FindingsList, type FindingsListProps } from '../../tui/components/FindingsList';
export { Summary, type SummaryProps } from '../../tui/components/Summary';
export {
  CausalTree,
  type CausalTreeProps,
  type CausalNode,
  type CausalNodeType,
} from '../../tui/components/CausalTree';
export {
  CompareView,
  type CompareViewProps,
  type ComparisonData,
  type BaselineSummary as CompareBaselineSummary,
} from '../../tui/components/CompareView';

// Re-export App from TUI for backwards compatibility
export { App } from '../../tui/components/App';
export type { AppProps } from '../../tui/types';
