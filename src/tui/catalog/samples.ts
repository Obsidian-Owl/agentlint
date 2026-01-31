import type { StreamChunk } from '../../orchestration/types';
import type { AgentWorkState } from '../state/agent-state';
import type {
  StatusBarContext,
  LastSessionInfo,
  TopRecommendationData,
  ProgressStatsData,
} from '../types';
import type { MenuOption } from '../components/ActionMenu';

export const sampleAgentStates: AgentWorkState[] = [
  { phase: 'idle' },
  { phase: 'thinking', startedAt: Date.now() - 2000 },
  { phase: 'calling_tool', tool: 'read_file', startedAt: Date.now() - 1000 },
  { phase: 'waiting_response', tool: 'read_file', startedAt: Date.now() - 500 },
  { phase: 'streaming', startedAt: Date.now() - 300 },
  { phase: 'complete', durationMs: 5000 },
  { phase: 'error', message: 'Connection timeout' },
];

export const sampleToolChunks: StreamChunk[] = [
  {
    type: 'tool_start',
    content: 'Reading file src/index.ts...',
    level: 'normal',
    timestamp: new Date().toISOString(),
    metadata: { tool: 'read_file', path: 'src/index.ts' },
  },
  {
    type: 'tool_result',
    content: 'export function main() { ... }',
    level: 'normal',
    timestamp: new Date().toISOString(),
    metadata: { tool: 'read_file' },
  },
  {
    type: 'text',
    content: 'I found the main entry point. Let me analyze the code structure.',
    level: 'normal',
    timestamp: new Date().toISOString(),
  },
];

export const sampleStatusBar: StatusBarContext = {
  helpHint: 'q: quit | ?: help',
  status: 'Analyzing',
  model: 'claude-sonnet-4',
  openRecommendations: 3,
  projectPath: '/Users/dev/my-project',
  elapsedMs: 45000,
  tokenUsage: { used: 15000, limit: 200000 },
  warnings: ['High token usage'],
};

export const sampleMenuOptions: MenuOption[] = [
  { key: '1', label: 'Run full analysis', action: 'analyse' },
  { key: '2', label: 'Quick scan only', action: 'quick-scan' },
  { key: '3', label: 'Review recommendations', action: 'recommendations' },
  { key: '4', label: 'Configure settings', action: 'settings' },
];

export const sampleFindings = [
  {
    id: '1',
    severity: 'high' as const,
    title: 'Missing error handling in CLAUDE.md',
    location: 'CLAUDE.md:45',
    description: 'No guidance for error scenarios',
  },
  {
    id: '2',
    severity: 'medium' as const,
    title: 'Outdated tool patterns',
    location: 'CLAUDE.md:120',
    description: 'Using deprecated tool syntax',
  },
  {
    id: '3',
    severity: 'low' as const,
    title: 'Verbose instructions',
    location: 'CLAUDE.md:200',
    description: 'Instructions could be more concise',
  },
];

export const sampleLoadingSteps = [
  { id: 'config' as const, label: 'Loading config', status: 'complete' as const },
  { id: 'baseline' as const, label: 'Checking baseline', status: 'complete' as const },
  { id: 'recommendations' as const, label: 'Loading recommendations', status: 'loading' as const },
  { id: 'git' as const, label: 'Git status', status: 'pending' as const },
];

export const sampleLastSession: LastSessionInfo = {
  sessionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  durationMs: 45 * 60 * 1000,
  findingsCount: 5,
  recommendationsCreated: 3,
};

export const sampleTopRecommendation: TopRecommendationData = {
  id: 'rec-001',
  title: 'Add functional patterns to CLAUDE.md',
  becauseClause:
    'You frequently encounter map/filter/reduce suggestions but have no documented preference',
  recurrenceCount: 4,
  priority: 'high',
  actionPreview: 'Add section documenting preference for .map()/.filter() over loops',
  target: 'CLAUDE.md',
  expectedImpact: 'Reduce repetitive suggestions by ~30%',
};

export const sampleProgressStats: ProgressStatsData = {
  period: 'last 30 days',
  recommendationsApplied: 8,
  helpfulCount: 6,
  totalFeedback: 8,
  improvementPercent: 15,
  improvementMetric: 'session efficiency',
  mostEffective: {
    title: 'Add error handling patterns',
    preventedIssues: 12,
  },
};
