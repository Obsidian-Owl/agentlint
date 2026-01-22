/**
 * EP04 CLI Interface - Components
 *
 * Ink-based React components for terminal UI.
 *
 * @module cli/components
 */

export { Progress, type ProgressProps } from './Progress';
export { FindingsList, type FindingsListProps } from './FindingsList';
export { Summary, type SummaryProps } from './Summary';
export {
  App,
  type AppProps,
  type AnalysisState,
  createInitialState,
  updateStateFromChunk,
} from './App';
export {
  CausalTree,
  type CausalTreeProps,
  type CausalNode,
  type CausalNodeType,
} from './CausalTree';
export {
  CompareView,
  type CompareViewProps,
  type ComparisonData,
  type BaselineSummary as CompareBaselineSummary,
} from './CompareView';
export {
  presentQuestionsInteractive,
  confirmPrompt,
  type QuestionAnswer,
  type PresentQuestionsOptions,
} from './question-presenter';
