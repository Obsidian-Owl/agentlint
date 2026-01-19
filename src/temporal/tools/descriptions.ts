/**
 * EP09 Temporal Analysis - Tool Descriptions
 *
 * Rich tool descriptions following ADR-0005 guidelines.
 * These are used when registering tools with the Claude Agent SDK.
 *
 * @module temporal/tools/descriptions
 */

/**
 * Tool descriptions for SDK registration.
 * Copied from contracts/temporal-tools.ts for runtime use.
 */
export const TOOL_DESCRIPTIONS = {
  store_baseline: `
Store a baseline snapshot of the current project state.

Use this tool when you need to:
- Capture a point-in-time snapshot for future comparison
- Mark a milestone (e.g., "before refactoring", "after config update")
- Establish a baseline for tracking improvement over time

The baseline includes:
- Analysis findings and metrics
- Configuration analysis results
- Session statistics (if available)
- Git commit reference for correlation

Returns the baseline ID for future reference.
  `.trim(),

  query_baseline: `
Retrieve a baseline snapshot by ID or get the latest baseline.

Use this tool when you need to:
- Get the most recent baseline for comparison
- Retrieve a specific historical baseline by ID
- Access baseline metrics for trend analysis

Returns structured baseline data with metrics.
Set includeFindings=true for full findings array (larger response).
  `.trim(),

  list_baselines: `
List available baseline snapshots with filtering and sorting.

Use this tool when you need to:
- See the history of baselines for a project
- Find baselines in a date range
- Look up baselines by label

Returns summary information without full findings.
Use query_baseline with specific ID for full details.
  `.trim(),

  calculate_delta: `
Calculate the difference between two baselines.

Use this tool when you need to:
- Compare current state to a previous baseline
- Identify what improved or regressed
- See the magnitude and direction of changes

Returns:
- Metric changes with direction indicators (↑ ↓ →)
- Warnings added/resolved
- Recommendations added/resolved
- Overall trend classification

Set includeGitCommits=true to see commits in the date range.
  `.trim(),

  query_trends: `
Analyze trends across multiple baselines over time.

Use this tool when you need to:
- See improvement trajectory over time
- Identify when trends changed direction (inflection points)
- Correlate changes with git commits
- Compare quantitative and qualitative trends

Requires at least 3 baselines (configurable via minBaselines).
Returns insufficient data message if not enough baselines exist.
  `.trim(),

  conduct_review: `
Facilitate a structured qualitative review session.

Use this tool when you need to:
- Capture user's subjective experience with AI-assisted workflow
- Gather context that metrics alone cannot reveal
- Build qualitative trend data over time

The review covers 6 dimensions:
1. Perceived Friction - Where friction occurs
2. Trust Calibration - How user verifies AI suggestions
3. Task Fit - What tasks work well/poorly
4. Configuration Confidence - Confidence in CLAUDE.md
5. Improvement Attribution - What changes made difference
6. Workflow Satisfaction - Overall satisfaction

Each dimension uses a Likert scale (-2 to +2).
Review is attached to a baseline for correlation.
  `.trim(),

  get_review_history: `
Retrieve qualitative review history for trend analysis.

Use this tool when you need to:
- See how sentiment has evolved over time
- Compare qualitative trends with quantitative metrics
- Find reviews for specific baselines or time ranges

Returns review summaries with sentiment and themes.
Use query_trends for integrated quantitative/qualitative analysis.
  `.trim(),

  spawn_temporal_analyst: `
Spawn a temporal analysis subagent with configurable focus.

Use this tool when you need to:
- Analyze workflow trends across multiple baselines
- Review qualitative sentiment trends over time
- Compare specific baselines for detailed change analysis
- Get comprehensive temporal insights combining metrics and reviews

The subagent has deep domain knowledge about:
- 6 qualitative review dimensions
- Mixed-methods analysis (quantitative + qualitative)
- Statistical trend interpretation
- ADR-0019 tool/agent boundary principles

Focus options:
- trends: Metric trends, slopes, inflection points
- reviews: Qualitative sentiment, themes, friction
- comparison: Baseline-to-baseline delta analysis
- comprehensive: Full multi-dimensional analysis

Returns the subagent definition and context for orchestrator delegation.
The orchestrator should invoke the subagent using the SDK agents option.
  `.trim(),
} as const;
