# Feature Specification: Temporal Analysis

> **Epic**: EP09
> **Created**: 2026-01-18
> **Status**: Draft
> **Author**: Claude

---

## 1. Overview

Temporal Analysis is agentlint's longitudinal measurement system—tracking AI-assisted development workflow effectiveness over time through both quantitative metrics and structured qualitative reviews. Unlike point-in-time snapshots, this system enables developers to observe improvement trajectories, correlate changes with outcomes, and build compounding understanding of what works for their specific workflow.

### 1.1 Business Context

This epic implements Constitution Principles II (Improvement-Oriented) and VIII (Compounding Value). It operationalizes the continuous improvement model:

```
BASELINE → CHANGE → OBSERVE → UNDERSTAND → REFINE → (repeat)
```

**Business Hypothesis**: If we implement comprehensive temporal analysis combining quantitative metrics AND structured qualitative review, then developers can objectively observe improvement over time AND understand the "why" behind changes, measured by trend visibility, improvement correlation, and qualitative insight quality.

**Key Insight**: Research shows developers consistently misjudge their own AI-assisted productivity. Pure quantitative metrics miss context. Pure qualitative assessment lacks comparability. The most effective measurement combines operational telemetry with structured qualitative review—each explaining what the other cannot.

### 1.2 The Mixed-Methods Approach

EP09 implements temporal analysis across two complementary dimensions:

| Dimension | What It Captures | How It's Captured | When It's Captured |
|-----------|------------------|-------------------|-------------------|
| **Quantitative** | Token usage, iteration counts, error frequencies, tool distributions | Automatic extraction from session logs and baselines | Continuous/automatic |
| **Qualitative** | Context behind changes, perceived friction, improvement attributions, workflow satisfaction | Structured review prompts and agent-guided assessment | Periodic/deliberate |

This mirrors best practices from organizations like Google and LinkedIn, which combine objective telemetry with subjective developer feedback to understand the full picture.

### 1.3 Agent-Oriented Design

Following Constitution Principle IX (Agent-Aware), temporal analysis tools are designed primarily for agent consumption:

1. **Trend Query Tools**: `query_trends`, `compare_baselines` return structured data for agent reasoning about patterns
2. **Qualitative Review Tools**: `conduct_review`, `get_review_history` enable the agent to facilitate structured qualitative sessions
3. **Delta Calculation**: Pre-computed deltas via `calculate_delta` reduce agent token cost for comparisons
4. **Correlation Tools**: `correlate_changes` links quantitative changes to git history and config modifications

The agent orchestrates temporal analysis, combining tool results with its reasoning capabilities to surface insights neither purely automated nor purely manual analysis could achieve.

### 1.4 Out of Scope

- **Baseline storage infrastructure**: Provided by EP03 (hard dependency)
- **Recommendation generation**: EP10 consumes temporal analysis for recommendations
- **Session log indexing**: EP06 provides session search and metrics
- **Global learning promotion**: EP12 handles cross-project learning
- **CLI output formatting**: EP04 handles terminal UI; EP09 provides structured data
- **Real-time monitoring**: Post-hoc analysis only (consistent with MVP non-goals)
- **Automated remediation**: agentlint recommends; developer decides

### 1.5 Tool/Agent Boundary (ADR-0019)

Per ADR-0019 and Constitution Principles IV (Mixed-Methods) and VII (Intelligent Tooling), EP09 maintains a strict boundary between tool-provided data and agent-provided judgment:

| Layer | Responsibility | Examples |
|-------|---------------|----------|
| **Tools** | Data extraction, statistical calculation | Config diffs, metric deltas, regression slopes, R² values |
| **Agent** | Quality judgment, semantic understanding | "Is this improvement?", "What caused this regression?" |

**What Tools Provide (Data)**:
- Config diff (lines added/removed, files modified)
- Metric delta (from → to values, percent change)
- Slope and R² statistics from regression
- Sentiment numeric values (-2 to +2)
- Evidence arrays with weights for pattern matching
- Time series data points

**What Agent Determines (Judgment)**:
- Whether a change represents "improvement" or "regression"
- What caused observed changes
- Which metrics matter most in context
- Confidence interpretation for recommendations
- Overall trend assessment across mixed signals

**Principle**: Tools extract WHAT happened. Agent interprets WHY it matters.

---

## 2. User Scenarios & Testing

> User stories are prioritized: P1 (must-have), P2 (should-have), P3 (nice-to-have)

### US-001 [P1]: Establish Baseline Snapshot

**As a** developer starting agentlint analysis,
**I want** to capture my current workflow state as a baseline,
**So that** I have a reference point for measuring future improvement.

**Acceptance Criteria:**
- [ ] Given current analysis state, when `store_baseline` is invoked, then a complete snapshot is stored with timestamp
- [ ] Given a baseline capture, when completed, then both quantitative metrics AND qualitative annotations are captured
- [ ] Given multiple captures in one day, when listing baselines, then each is distinctly identifiable (timestamp + optional label)
- [ ] Given a baseline, when stored, then git commit hash (if available) is recorded for correlation

**Test Scenarios:**
- Happy path: First baseline captured with full metrics and optional label
- Happy path: Labeled milestone baseline ("Post-CLAUDE.md rewrite")
- Edge case: Baseline captured with no session history (new project)
- Error case: Storage failure → atomic rollback, clear error message

---

### US-002 [P1]: Compare Current State to Baseline

**As a** developer who has made workflow changes,
**I want** to compare my current state against a previous baseline,
**So that** I can see what improved, regressed, or stayed the same.

**Acceptance Criteria:**
- [ ] Given current state and baseline, when comparison runs, then structured delta is calculated
- [ ] Given a delta, when displayed, then trend indicators show direction (↑ improved, ↓ regressed, → stable)
- [ ] Given quantitative changes, when reported, then magnitude and percentage change are included
- [ ] Given multiple baselines, when comparing, then user can select which baseline to compare against

**Test Scenarios:**
- Happy path: Token usage decreased 15%, warning count down by 2
- Happy path: Mixed results—some metrics improved, some regressed
- Edge case: No meaningful change detected → "stable" indicator with explanation
- Edge case: Baseline schema version differs → migration or compatibility warning

---

### US-003 [P1]: Query Trends Across Baselines

**As a** developer with a history of baselines,
**I want** to see trends across multiple snapshots,
**So that** I can observe my improvement trajectory over time.

**Acceptance Criteria:**
- [ ] Given 3+ baselines, when trend query runs, then metrics are aggregated across time
- [ ] Given trend data, when displayed, then directional patterns are identified (improving, degrading, volatile, stable)
- [ ] Given trend results, when analyzing, then inflection points (when trends changed) are highlighted
- [ ] Given trend results, when correlating, then inflection points are linked to git commits or config changes

**Test Scenarios:**
- Happy path: 10 baselines over 30 days showing consistent token reduction
- Happy path: Volatile iteration count with identifiable inflection point
- Edge case: Only 2 baselines → comparison mode, not trend mode
- Edge case: Long gaps between baselines → temporal scaling in visualization

---

### US-004 [P1]: Conduct Qualitative Review Session

**As a** developer wanting to understand my AI workflow effectiveness,
**I want** a structured qualitative review session,
**So that** I capture context and insights that metrics alone can't reveal.

**Acceptance Criteria:**
- [ ] Given a review request, when initiated, then the agent presents structured prompts covering key quality dimensions
- [ ] Given review prompts, when answered, then responses are persisted with baseline reference
- [ ] Given historical reviews, when analyzing, then sentiment and theme trends are observable
- [ ] Given quantitative data, when reviewing, then the agent presents relevant metrics to contextualize qualitative questions

**Test Scenarios:**
- Happy path: First qualitative review capturing perceived friction, satisfaction, improvement attribution
- Happy path: Follow-up review showing sentiment improvement aligned with metric improvement
- Edge case: User provides minimal responses → agent probes for specifics
- Edge case: Conflicting signals (good metrics, negative sentiment) → flagged for investigation

---

### US-005 [P2]: Track Recommendation Implementation

**As a** developer who received improvement recommendations,
**I want** to track which recommendations I implemented,
**So that** I can correlate implementations with outcome changes.

**Acceptance Criteria:**
- [ ] Given recommendations from EP10, when baselines are compared, then implementation status is detected
- [ ] Given an implemented recommendation, when tracked, then pre/post metrics are compared
- [ ] Given implementation tracking, when analyzed, then effectiveness correlation is calculated
- [ ] Given multiple recommendations, when tracked, then individual impact is estimated where possible

**Test Scenarios:**
- Happy path: "Add credential guidance" implemented → secret exposure rate drops
- Happy path: Multiple recommendations implemented → aggregate and individual attribution attempted
- Edge case: Recommendation implemented but metrics unchanged → noted as "no measurable effect"
- Edge case: Recommendation partially implemented → status = "partial"

---

### US-006 [P2]: Correlate Changes with Git History

**As a** developer investigating why metrics changed,
**I want** changes correlated with git commits,
**So that** I can trace improvements or regressions to specific code changes.

**Acceptance Criteria:**
- [ ] Given metric change between baselines, when correlating, then relevant commits in date range are identified
- [ ] Given commits, when analyzing, then file types and change patterns are categorized
- [ ] Given config file commits (CLAUDE.md, etc.), when identified, then they're highlighted as likely sources
- [ ] Given git correlation, when displaying, then commit → metric change relationship is explained

**Test Scenarios:**
- Happy path: CLAUDE.md updated → next baseline shows improvement → correlation highlighted
- Happy path: Multiple commits → ranked by likely relevance to observed changes
- Edge case: No git repository → graceful skip with message
- Edge case: Metric changed but no commits in range → external factors noted

---

### US-007 [P2]: Analyze Qualitative Trends

**As a** developer with multiple qualitative reviews,
**I want** to see trends in my qualitative assessments,
**So that** I can understand how my subjective experience is evolving.

**Acceptance Criteria:**
- [ ] Given 3+ qualitative reviews, when trend analysis runs, then sentiment direction is computed per dimension
- [ ] Given qualitative trends, when compared to quantitative, then alignment or divergence is noted
- [ ] Given recurring themes across reviews, when analyzed, then patterns are surfaced
- [ ] Given qualitative improvement, when tracked, then contributing factors are identified from context

**Test Scenarios:**
- Happy path: Friction perception decreasing over time, aligned with iteration count reduction
- Happy path: Satisfaction improving despite stable metrics → qualitative context explains why
- Edge case: Diverging signals (metrics improving, sentiment declining) → investigation prompt
- Edge case: Inconsistent review frequency → weighted by recency

---

### US-008 [P3]: Generate Periodic Review Reminders

**As a** developer who wants consistent workflow assessment,
**I want** reminders to conduct periodic reviews,
**So that** I maintain consistent qualitative data collection.

**Acceptance Criteria:**
- [ ] Given configured review interval (weekly/monthly), when interval passes, then reminder is surfaced
- [ ] Given a reminder, when session starts, then agent prompts for qualitative review
- [ ] Given review history, when analyzing consistency, then gaps are identified
- [ ] Given skipped reviews, when prompted, then catch-up option is offered

**Test Scenarios:**
- Happy path: Weekly review configured, reminder at 7-day mark
- Edge case: Rapid successive sessions → don't over-prompt
- Edge case: Long absence → suggest comprehensive review on return

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | User Story | Category |
|----|-------------|----------|------------|----------|
| FR-TA-001 | Capture baseline snapshot including quantitative metrics and context | P1 | US-001 | Baseline |
| FR-TA-002 | Store baselines with timestamp, optional label, and git commit reference | P1 | US-001 | Baseline |
| FR-TA-003 | Support multiple baseline history per project | P1 | US-001 | Baseline |
| FR-TA-004 | Calculate structured delta between two baselines using jsondiffpatch | P1 | US-002 | Delta |
| FR-TA-005 | Identify improvement/regression patterns with magnitude and direction | P1 | US-002 | Delta |
| FR-TA-006 | Generate trend indicators (↑ ↓ →) with thresholds for significance | P1 | US-002 | Delta |
| FR-TA-007 | Query baselines by timestamp, label, or "latest" | P1 | US-002 | Query |
| FR-TA-008 | Aggregate metrics across multiple baselines for trend analysis | P1 | US-003 | Trends |
| FR-TA-009 | Identify inflection points (when trends changed direction) | P2 | US-003 | Trends |
| FR-TA-010 | Correlate inflection points with git commits and config changes | P2 | US-003, US-006 | Correlation |
| FR-TA-011 | Implement structured qualitative review prompts covering key dimensions | P1 | US-004 | Qualitative |
| FR-TA-012 | Persist qualitative review responses with baseline reference | P1 | US-004 | Qualitative |
| FR-TA-013 | Enable agent-guided qualitative review sessions | P1 | US-004 | Qualitative |
| FR-TA-014 | Detect recommendation implementation status via config diffs | P2 | US-005 | Tracking |
| FR-TA-015 | Correlate recommendation implementation with outcome changes | P2 | US-005 | Tracking |
| FR-TA-016 | Calculate recommendation effectiveness scores | P2 | US-005 | Tracking |
| FR-TA-017 | Identify relevant git commits between baselines | P2 | US-006 | Correlation |
| FR-TA-018 | Categorize commits by likely impact on AI workflow | P2 | US-006 | Correlation |
| FR-TA-019 | Analyze qualitative sentiment trends across reviews | P2 | US-007 | Qualitative |
| FR-TA-020 | Detect alignment or divergence between quantitative and qualitative signals | P2 | US-007 | Analysis |
| FR-TA-021 | Surface recurring themes from qualitative reviews | P2 | US-007 | Qualitative |
| FR-TA-022 | Support configurable review interval reminders | P3 | US-008 | Workflow |
| FR-TA-023 | Implement `store_baseline` tool for agent/CLI use | P1 | US-001 | Tool |
| FR-TA-024 | Implement `query_baseline` tool with flexible retrieval | P1 | US-002 | Tool |
| FR-TA-025 | Implement `list_baselines` tool with metadata summary | P1 | US-002 | Tool |
| FR-TA-026 | Implement `calculate_delta` tool for baseline comparison | P1 | US-002 | Tool |
| FR-TA-027 | Implement `query_trends` tool for multi-baseline analysis | P1 | US-003 | Tool |
| FR-TA-028 | Implement `conduct_review` tool for qualitative sessions | P1 | US-004 | Tool |
| FR-TA-029 | Implement `get_review_history` tool for qualitative data retrieval | P1 | US-007 | Tool |
| FR-TA-030 | Optional `temporal-analyzer` subagent for context isolation (per SDK best practices) | P2 | US-003 | Architecture |

### 3.2 Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-TA-001 | Trend query performance | Query time for 50 baselines | < 2 seconds |
| NFR-TA-002 | Delta calculation performance | Comparison of two baselines | < 1 second |
| NFR-TA-003 | Baseline storage atomicity | Concurrent write safety | Atomic (no partial writes) |
| NFR-TA-004 | Memory efficiency | Peak memory during trend analysis | < 150MB |
| NFR-TA-005 | Schema evolution support | Baseline version migration | Automatic with fallback |
| NFR-TA-006 | Qualitative data privacy | Review storage location | Local only (.agentlint/) |
| NFR-TA-007 | Review session UX | Agent prompt quality | Clear, non-leading questions |

---

## 4. Key Entities

> Define the core domain entities this feature introduces or modifies

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| `Baseline` | Point-in-time snapshot of workflow state | id, version, createdAt, projectPath, actType, configPath, gitCommit, configAnalysis, metrics, recommendations, sessionSummary, label, notes |
| `BaselineMetrics` | Aggregated quantitative signals | configTokens, configLines, warningCount, sectionCount, coverageScore, avgTokensPerSession, avgIterationsPerSession, errorRate |
| `BaselineDelta` | Difference between two baselines | fromId, toId, delta (jsondiffpatch), summary |
| `DeltaSummary` | Human-readable delta interpretation | metricsChanged, warningsAdded, warningsResolved, recommendationsAdded, recommendationsResolved, trendIndicators |
| `TrendAnalysis` | Multi-baseline pattern analysis | projectPath, dateRange, metricTrends, inflectionPoints, correlatedCommits |
| `MetricTrend` | Single metric over time | metricName, direction (improving/degrading/volatile/stable), values, slope |
| `QualitativeReview` | Structured qualitative assessment | id, baselineId, createdAt, dimensions (array), overallSentiment, themes, freeformNotes |
| `ReviewDimension` | Single qualitative dimension | name, promptText, response, sentiment (-2 to +2), confidence |
| `RecommendationTracking` | Rec implementation status | recommendationId, status (pending/implemented/partial/rejected), implementedAt, preMetrics, postMetrics, effectivenessScore |

### 4.1 Entity Relationships

```
Baseline --1:1--> BaselineMetrics
Baseline --0:N--> QualitativeReview
Baseline --0:N--> RecommendationTracking
BaselineDelta --N:1--> Baseline (from)
BaselineDelta --N:1--> Baseline (to)
TrendAnalysis --N:N--> Baseline
TrendAnalysis --1:N--> MetricTrend
QualitativeReview --1:N--> ReviewDimension
```

### 4.2 Qualitative Review Dimensions

The structured qualitative review covers key dimensions identified from research:

| Dimension | Prompt Focus | Signal Type |
|-----------|--------------|-------------|
| **Perceived Friction** | Where do you experience friction in AI-assisted work? | Leading (predict) |
| **Trust Calibration** | How often do you verify AI suggestions before accepting? | Qualitative |
| **Task Fit** | What types of tasks work well/poorly with AI assistance? | Causal |
| **Configuration Confidence** | How confident are you in your current CLAUDE.md? | Leading |
| **Improvement Attribution** | What changes made the biggest difference recently? | Causal |
| **Workflow Satisfaction** | Overall, how satisfied are you with your AI workflow? | Lagging |

These dimensions are informed by:
- [DX AI Measurement Framework](https://getdx.com/research/measuring-ai-code-assistants-and-agents/)
- [LinearB AI Measurement Framework](https://linearb.io/blog/ai-measurement-framework)
- [Martin Fowler: Measuring Developer Productivity via Humans](https://martinfowler.com/articles/measuring-developer-productivity-humans.html)

---

## 5. Success Criteria

> How do we know this feature is successful? Define measurable outcomes.

- [ ] **Functional**: All P1 user stories pass acceptance criteria
- [ ] **Quality**: Test coverage > 80% for temporal analysis tools
- [ ] **Performance**: Trend query < 2s on 50 baselines (NFR-TA-001)
- [ ] **Performance**: Delta calculation < 1s (NFR-TA-002)
- [ ] **Integration**: Tools register with EP02 orchestration layer via SDK `tool()` pattern
- [ ] **Integration**: Baselines stored in `.agentlint/baselines/` per ADR-0008
- [ ] **Integration**: SQLite metadata index in `.agentlint/baselines.db` per ADR-0008
- [ ] **Qualitative Value**: Agent-guided reviews produce actionable insights in testing
- [ ] **Mixed-Methods Validation**: System detects signal alignment/divergence between quantitative and qualitative

---

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior | Priority |
|----------|-------------------|----------|
| No baselines exist | Return empty result with guidance: "Run `agentlint baseline` first" | P1 |
| Only one baseline | Comparison not possible; suggest creating second after changes | P1 |
| Baseline schema version mismatch | Attempt migration; if incompatible, warn and skip old baseline | P1 |
| Large baseline file (>10MB) | Index metrics in SQLite; lazy-load full JSON when needed | P2 |
| No git repository available | Skip git correlation, note limitation, continue analysis | P1 |
| Qualitative review interrupted | Save partial responses, allow resume | P2 |
| Conflicting quantitative/qualitative signals | Flag for investigation, suggest deeper analysis | P2 |
| Very old baselines (schema 1.0 from months ago) | Migration path or exclude with warning | P2 |
| Baseline directory doesn't exist | Create on first `store_baseline` | P1 |
| SQLite index corrupt | Rebuild from JSON files, log warning | P2 |
| No session data for period | Note in baseline as "no sessions analyzed" | P1 |
| Git history too large (>10k commits in range) | Limit to recent commits, note truncation | P3 |

---

## 7. Dependencies & Assumptions

### 7.1 Dependencies

| Dependency | Type | Status | Impact if Missing |
|------------|------|--------|-------------------|
| EP01 Project Foundation | Hard | Complete | Cannot build - need TypeScript, Bun |
| EP02 Orchestration Core | Soft | Complete | Can build tools, but no agent integration |
| EP03 Persistence Layer | Hard | Not Started | Cannot store baselines or reviews |
| EP06 Session Analysis | Soft | Complete | Baseline session metrics unavailable |
| EP07 Causal Tracing | Soft | Complete | No traced issues in baseline |
| jsondiffpatch | External | Available | Core delta calculation library |
| Git | External | User-dependent | Correlation features degrade gracefully |

### 7.2 Assumptions

- Baselines use JSON format per ADR-0008 for human debuggability
- SQLite metadata index provides fast queries per ADR-0008
- Users have local filesystem access for baseline storage
- Qualitative reviews are conducted periodically (frequency is user-configurable)
- Agent has sufficient context for multi-turn qualitative review sessions
- jsondiffpatch handles baseline comparison efficiently for expected sizes

---

## 8. Open Questions

> Questions that need resolution before implementation

- [x] **Q1**: How should qualitative sentiment be quantified for trend analysis? — [RESOLVED]
  - **Decision**: Likert scale (-2 to +2)
  - 5-point scale: Very Negative (-2), Negative (-1), Neutral (0), Positive (+1), Very Positive (+2)
  - Enables nuanced trend calculation while remaining simple

- [x] **Q2**: What's the optimal frequency for qualitative reviews to balance insight vs friction? — [RESOLVED]
  - **Decision**: Monthly + triggered
  - Default monthly schedule with triggered reviews after significant changes (CLAUDE.md updates, major metric shifts)
  - Balances insight quality with low user friction

- [x] **Q3**: Should recommendation tracking be automatic (diff-based) or require explicit user confirmation? — [RESOLVED]
  - **Decision**: Auto-detect with confirmation
  - System detects potential implementations via config diffs, then asks user to confirm
  - Best accuracy with reasonable user effort

- [x] **Q4**: How should we handle metric significance thresholds for trend indicators? — [RESOLVED]
  - **Decision**: Configurable with sensible defaults
  - Default 5% threshold: 5% improvement = ↑, 5% regression = ↓, within ±5% = →
  - Users can override in `~/.agentlint/config.json` per metric type
  - Balances precision with usability

---

## 9. References

- [Epic: EP09 Temporal Analysis](../../docs/planning/epics/EP09-temporal-analysis.md)
- [ADR-0008: Baseline Storage Format and Strategy](../../docs/architecture/adr/0008-baseline-storage-format-and-strategy.md)
- [ADR-0005: Tool Definition and Invocation Pattern](../../docs/architecture/adr/0005-tool-definition-and-invocation-pattern.md)
- [Arc42 §6.3: Baseline Comparison Runtime Scenario](../../docs/architecture/arc42/06-runtime-view.md)
- [Use Cases: UC-000, UC-006, UC-010](../../docs/requirements/use-cases.md)
- [Functional Requirements: FR-5 Temporal Analysis](../../docs/requirements/functional-requirements.md)
- [Constitution: Principles II, VIII](../../.specify/memory/constitution.md)
- [jsondiffpatch](https://github.com/benjamine/jsondiffpatch)
- [DX AI Measurement Framework](https://getdx.com/research/measuring-ai-code-assistants-and-agents/)
- [LinearB AI Measurement Framework](https://linearb.io/blog/ai-measurement-framework)
- [Martin Fowler: Measuring Developer Productivity via Humans](https://martinfowler.com/articles/measuring-developer-productivity-humans.html)

---

## Clarifications

> Resolved by `/dev.specify` on 2026-01-18

### Session 2026-01-18

#### Q1: Qualitative Sentiment Quantification

**Question**: How should qualitative sentiment be quantified for trend analysis?

**Decision**: **Likert scale (-2 to +2)**

A 5-point scale with clear anchors:
- -2: Very Negative
- -1: Negative
- 0: Neutral
- +1: Positive
- +2: Very Positive

**Rationale**: This approach enables nuanced trend calculation while remaining simple for users to apply. The symmetric scale around zero makes trend direction calculation straightforward (positive slope = improving sentiment).

**Impact on requirements**:
- `ReviewDimension.sentiment` uses range -2 to +2
- Trend calculation uses simple linear regression on sentiment values
- Visualization can use color gradients (red → yellow → green)

---

#### Q2: Qualitative Review Frequency

**Question**: What's the optimal frequency for qualitative reviews to balance insight vs friction?

**Decision**: **Monthly + triggered**

Default monthly schedule with triggered reviews after significant changes:
- CLAUDE.md configuration updates
- Major metric shifts (>25% change in key metrics)
- Post-recommendation implementation

**Rationale**: Monthly reviews provide consistent data points without feeling burdensome. Triggered reviews capture context immediately after significant changes when memory is fresh.

**Impact on requirements**:
- FR-TA-022 updated: "Support configurable review interval reminders (default: monthly)"
- Add trigger conditions to `QualitativeReview` entity
- Agent prompts for review when detecting significant changes

---

#### Q3: Recommendation Tracking Approach

**Question**: Should recommendation tracking be automatic or require user confirmation?

**Decision**: **Auto-detect with confirmation**

System automatically detects potential implementations via config diffs, then asks user to confirm accuracy.

**Rationale**: Pure automation risks false positives (incidental changes detected as implementation) and false negatives (partial implementations missed). User confirmation ensures accuracy while minimizing manual effort.

**Impact on requirements**:
- FR-TA-014 updated: "Detect recommendation implementation status via config diffs with user confirmation"
- `RecommendationTracking.status` includes "detected_pending_confirm" state
- Agent asks for confirmation when potential implementation detected

---

#### Summary of Clarification Impact

| Requirement | Update |
|-------------|--------|
| FR-TA-011 | Qualitative prompts use Likert scale |
| FR-TA-019 | Sentiment trends use -2 to +2 values |
| FR-TA-022 | Default monthly + triggered frequency |
| FR-TA-014 | Auto-detect with user confirmation |
| ReviewDimension | `sentiment: number` (-2 to +2) |
| RecommendationTracking | Add `detected_pending_confirm` status |

---

#### Q4: Metric Significance Thresholds

**Question**: How should we handle metric significance thresholds for trend indicators?

**Decision**: **Configurable with sensible defaults**

Default 5% threshold:
- ↑ Improving: > 5% improvement
- ↓ Regressing: > 5% regression
- → Stable: within ±5%

Users can override in `~/.agentlint/config.json`:
```json
{
  "temporal": {
    "thresholds": {
      "default": 0.05,
      "warningCount": 1,  // Absolute threshold for discrete metrics
      "tokenUsage": 0.10  // 10% for token metrics
    }
  }
}
```

**Rationale**: Different metrics may warrant different sensitivity. Token usage naturally fluctuates more than warning counts. Configurable thresholds let users tune to their context.

**Impact on requirements**:
- FR-TA-006 updated: "Generate trend indicators with configurable significance thresholds"
- Add `ThresholdConfig` type to `Baseline` entity
- Default config loaded from `~/.agentlint/config.json`

---

### SDK Design Validation

Based on research into Claude Agent SDK patterns and Anthropic's best practices, here's how EP09 aligns:

#### Agent Feedback Loop Pattern

**Anthropic's Pattern**: `Gather Context → Take Action → Verify Work → Repeat`

**EP09 Alignment**: ✅ Strong

The temporal analysis workflow follows this pattern:
1. **Gather Context**: `query_baseline`, `list_baselines`, `get_review_history` tools
2. **Take Action**: `store_baseline`, `conduct_review`, `calculate_delta`
3. **Verify Work**: Delta analysis, trend detection, alignment/divergence checking
4. **Repeat**: Baseline → change → observe → understand → refine cycle

#### Tool Design Best Practices

**Anthropic's Guidance**: "Keep tool purpose clear and atomic (single responsibility). Include strong input validation and descriptive documentation strings."

**EP09 Alignment**: ✅ Strong

| Tool | Single Purpose | Input Validation |
|------|---------------|------------------|
| `store_baseline` | Capture snapshot | Zod schema validation |
| `query_baseline` | Retrieve snapshot | ID or "latest" validation |
| `calculate_delta` | Compare two baselines | fromId/toId validation |
| `query_trends` | Analyze across baselines | Date range, metric filter |
| `conduct_review` | Facilitate qualitative session | Dimension enum validation |

Each tool has ONE job, uses Zod schemas per ADR-0005.

#### Context Optimization

**Anthropic's Guidance**: "Tool Search Tool discovers tools on-demand. Claude only sees the tools it actually needs for the current task."

**EP09 Alignment**: ⚠️ Partially Addressed

Current design registers all temporal tools upfront. For optimization:
- Consider grouping tools under a `temporal-analyzer` subagent (like EP08's ACT subagents)
- Main orchestrator delegates temporal analysis to specialist subagent
- Reduces main context window pollution

**Recommendation**: Add P2 requirement for optional `temporal-analyzer` subagent pattern.

#### Subagent Delegation

**Anthropic's Guidance**: "Subagent pattern provides parallelization and context management. Each subagent maintains isolated context windows."

**EP09 Alignment**: ✅ Aligned (via EP08 pattern)

- Qualitative reviews can run as agent-guided multi-turn sessions
- Trend analysis could be delegated to specialist subagent
- Aligns with Constitution Principle C8 (single-depth subagents)

#### Large Result Handling

**Anthropic's Guidance**: "Hybrid summarization—if result exceeds threshold, return LLM summary while storing full result."

**EP09 Alignment**: ✅ Strong

- Trend queries across 50+ baselines could exceed context
- Design uses SQLite metadata index for efficient queries
- Full JSON lazy-loaded only when needed
- Follows ADR-0005's hybrid summarization pattern

#### Verification Mechanisms

**Anthropic's Three Approaches**:
1. Rules-Based Feedback (validation rules)
2. Visual Feedback (screenshot-based)
3. LLM-as-Judge (secondary evaluation)

**EP09 Alignment**: ✅ Strong (Mixed-Methods)

| Mechanism | EP09 Implementation |
|-----------|---------------------|
| Rules-Based | Trend threshold validation, schema validation |
| LLM-as-Judge | Qualitative review analysis, sentiment extraction |
| Human Feedback | User confirmation for recommendation tracking |

The qualitative + quantitative mixed-methods approach IS the verification mechanism.

---

### Design Improvements Identified

Based on SDK research, these improvements should be considered:

1. **[Adopted]** Configurable thresholds (Q4 resolution)

2. **[P2 Addition]** Consider `temporal-analyzer` subagent pattern:
   ```typescript
   // Similar to EP08's ACT subagents
   const temporalAnalyzerSubagent: AgentDefinition = {
     description: "Analyze workflow trends across baselines and qualitative reviews",
     prompt: temporalAnalyzerInstructions,
     tools: ['query_baseline', 'list_baselines', 'calculate_delta', 'query_trends', 'get_review_history']
   };
   ```
   This would isolate temporal analysis context from main orchestrator.

3. **[Already in Design]** Pre-computed data for efficiency:
   - Delta summaries stored in SQLite
   - Trend calculations cached
   - Aligns with SDK guidance on reducing agent token cost

4. **[Confirmed]** Tool documentation pattern follows ADR-0005's rich description approach
