# Implementation Plan: Temporal Analysis

> **Epic**: EP09
> **Spec**: specs/ep09-temporal-analysis/spec.md
> **Created**: 2026-01-18
> **Status**: Design Complete
> **Author**: Claude

---

## Summary

**Primary Requirement**: Temporal Analysis provides longitudinal tracking of AI-assisted development workflow effectiveness through mixed-methods measurement—combining quantitative metrics with structured qualitative reviews to enable developers to observe improvement trajectories and understand what works.

**Technical Approach**: Extend the existing EP03 persistence layer with temporal-specific tools following the Claude Agent SDK `tool()` pattern. Implement trend analysis via SQLite queries on baseline metadata, delta calculation via jsondiffpatch, and qualitative reviews as structured JSON documents. Expose all capabilities as atomic tools for agent consumption per ADR-0005.

---

## Technical Context

> Project-specific values validated against codebase.

| Aspect | Value |
|--------|-------|
| **Language/Version** | TypeScript 5.x (target ESNext) |
| **Runtime** | Bun (Node.js 22+ compatible) |
| **Primary Dependencies** | @anthropic-ai/claude-agent-sdk ^0.2.7, zod ^3.24.1, jsondiffpatch (to add) |
| **Storage** | JSON files + SQLite index per ADR-0008 (via bun:sqlite) |
| **Testing Framework** | Bun test + ink-testing-library |
| **Target Platform** | CLI Tool (agentlint binary) |
| **Project Type** | CLI Tool with embedded Claude Agent SDK |
| **Performance Goals** | Trend query < 2s on 50 baselines, Delta < 1s |
| **Constraints** | Local-first (no network), offline-capable |
| **Scale/Scope** | Single developer per project |

---

## Constitution Check

> Validated against project constitution at `.specify/memory/constitution.md`

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Local-First | ✅ | All data stored in `.agentlint/`, no network calls |
| II | Improvement-Oriented | ✅ | Core focus: baseline tracking enables continuous improvement cycle |
| III | Causal-First | ✅ | Git commit correlation traces changes to origins; trend inflection points linked to config changes |
| IV | Mixed-Methods | ✅ | Quantitative metrics + structured qualitative reviews; agent decides which methods to apply |
| V | Language-Agnostic | ✅ | Temporal analysis operates on baselines, not source code |
| VI | Agent-Agnostic | ✅ | Baselines work for any ACT type (via EP08 subagent pattern) |
| VII | Intelligent Tooling | ✅ | Tools provide data; agent reasons about trends and insights |
| VIII | Compounding Value | ✅ | Trend analysis, learning over time, cross-session insights |
| IX | Agent-Aware | ✅ | Tools designed for agent consumption with structured outputs; optional `temporal-analyzer` subagent |

**Gate Status**: [x] All principles pass

---

## Project Structure

### Documentation Structure

```
specs/ep09-temporal-analysis/
├── spec.md           # Feature specification (complete)
├── plan.md           # This file
├── research.md       # Research findings
├── data-model.md     # Entity definitions
├── quickstart.md     # Usage guide
├── contracts/        # TypeScript interfaces
│   └── temporal-tools.ts
└── checklists/
    ├── requirements.md  # Requirement validation (complete)
    └── design.md        # Design validation
```

### Source Code Structure (Proposed)

```
src/
├── temporal/                    # NEW: Temporal analysis module
│   ├── index.ts                 # Public exports
│   ├── types.ts                 # Type definitions
│   ├── delta/
│   │   ├── calculator.ts        # jsondiffpatch wrapper
│   │   ├── summarizer.ts        # Delta → DeltaSummary
│   │   └── trends.ts            # Trend indicator calculation
│   ├── trends/
│   │   ├── aggregator.ts        # Multi-baseline aggregation
│   │   ├── inflection.ts        # Inflection point detection
│   │   └── correlation.ts       # Git/config correlation
│   ├── qualitative/
│   │   ├── dimensions.ts        # Review dimension definitions
│   │   ├── review.ts            # Review session handler
│   │   └── sentiment.ts         # Sentiment trend analysis
│   └── tools/
│       ├── store-baseline.ts    # store_baseline tool
│       ├── query-baseline.ts    # query_baseline tool
│       ├── list-baselines.ts    # list_baselines tool
│       ├── calculate-delta.ts   # calculate_delta tool
│       ├── query-trends.ts      # query_trends tool
│       ├── conduct-review.ts    # conduct_review tool
│       └── get-review-history.ts # get_review_history tool
├── persistence/
│   ├── baselines/               # EXISTING: Extend for EP09
│   │   ├── storage.ts           # ✓ exists (saveBaseline, loadBaseline)
│   │   ├── queries.ts           # ✓ exists (queryBaselines, compareBaselines)
│   │   └── indexer.ts           # ✓ exists (SQLite indexing)
│   └── reviews/                 # NEW: Qualitative review storage
│       ├── storage.ts           # Review CRUD
│       └── indexer.ts           # Review SQLite indexing
└── tools/
    └── index.ts                 # Add temporal tools to registry
```

---

## Key Design Decisions

| Decision | Choice | Rationale | ADR |
|----------|--------|-----------|-----|
| Delta calculation library | jsondiffpatch | Industry-standard, handles nested objects, produces reversible patches | ADR-0008 |
| Baseline storage format | JSON + SQLite index | Human-readable primary, fast queries secondary | ADR-0008 |
| Qualitative sentiment scale | Likert (-2 to +2) | Balanced, enables trend calculation, research-backed | spec.md Q1 |
| Review frequency | Monthly + triggered | Low friction, captures context at key moments | spec.md Q2 |
| Recommendation tracking | Auto-detect + confirm | Best accuracy with reasonable effort | spec.md Q3 |
| Trend thresholds | Configurable (5% default) | Per-metric tuning, sensible defaults | spec.md Q4 |
| Tool architecture | SDK `tool()` with Zod | Type-safe, rich descriptions, ADR-0005 compliant | ADR-0005 |
| Subagent pattern | Optional temporal-analyzer | Context isolation per SDK best practices | spec.md SDK Validation |

---

## Dependencies

### Internal Dependencies

| Dependency | Status | Integration Point |
|------------|--------|-------------------|
| EP01 Project Foundation | ✅ Complete | TypeScript, Bun, test framework |
| EP02 Orchestration Core | ✅ Complete | Tool registration via `createSdkMcpServer()` |
| EP03 Persistence Layer | ✅ Complete | Baseline storage, SQLite indexing, atomic writes |
| EP06 Session Analysis | ✅ Complete | Session metrics for baseline snapshots |
| EP07 Causal Tracing | ✅ Complete | Pattern data for correlation |
| EP08 ACT Subagents | ✅ Complete | Subagent pattern reference |

### External Dependencies

| Dependency | Version | Purpose | Install Command |
|------------|---------|---------|-----------------|
| jsondiffpatch | ^0.6.0 | Delta calculation | `bun add jsondiffpatch` |
| @types/jsondiffpatch | ^0.1.0 | TypeScript types | `bun add -D @types/jsondiffpatch` |

**Note**: All other dependencies (zod, bun:sqlite, uuid) are already in package.json.

---

## Existing Code to Leverage

### From EP03 Persistence Layer

| Component | Location | Reuse Strategy |
|-----------|----------|----------------|
| `Baseline` type | `src/persistence/types.ts` | Extend with temporal metadata |
| `BaselineMetrics` | `src/persistence/types.ts` | Add temporal-specific metrics |
| `saveBaseline()` | `src/persistence/baselines/storage.ts` | Use directly |
| `loadBaseline()` | `src/persistence/baselines/storage.ts` | Use directly |
| `queryBaselines()` | `src/persistence/baselines/queries.ts` | Extend for trend queries |
| `compareBaselines()` | `src/persistence/baselines/queries.ts` | Enhance with jsondiffpatch |
| `getBaselineHistory()` | `src/persistence/baselines/queries.ts` | Use for trend aggregation |
| SQLite schema | `src/persistence/baselines/indexer.ts` | Extend for review indexing |
| Atomic writes | `src/persistence/common/atomic-write.ts` | Use for review storage |

### From EP02 Orchestration

| Component | Location | Reuse Strategy |
|-----------|----------|----------------|
| `tool()` pattern | `src/orchestration/tool-registry.ts` | Follow for new tools |
| `handleToolResult()` | ADR-0005 pattern | Apply large result handling |
| `createSdkMcpServer()` | SDK import | Register temporal tools |

### From EP08 ACT Subagents

| Component | Location | Reuse Strategy |
|-----------|----------|----------------|
| `AgentDefinition` | `src/act/types.ts` | Reference for subagent pattern |
| Subagent instructions | `src/act/instructions/` | Template for temporal-analyzer |

---

## Implementation Phases

### Phase 1: Core Delta & Comparison (P1)

1. Add jsondiffpatch dependency
2. Extend `BaselineMetrics` with temporal fields
3. Implement `calculate_delta` tool with jsondiffpatch
4. Implement trend indicators (↑ ↓ →) with configurable thresholds
5. Create `DeltaSummary` with human-readable interpretation

### Phase 2: Trend Analysis (P1)

1. Implement `query_trends` tool for multi-baseline analysis
2. Add `MetricTrend` with direction and slope calculation
3. Implement `TrendAnalysis` with date range support
4. Create SQLite queries for efficient aggregation

### Phase 3: Qualitative Reviews (P1)

1. Define `ReviewDimension` with 6 core dimensions
2. Create `QualitativeReview` storage (JSON + SQLite index)
3. Implement `conduct_review` tool for agent-guided sessions
4. Implement `get_review_history` tool for retrieval
5. Add Likert sentiment scoring (-2 to +2)

### Phase 4: Correlation & Tracking (P2)

1. Implement git commit correlation between baselines
2. Add inflection point detection
3. Create recommendation tracking with auto-detect + confirm
4. Implement alignment/divergence detection between signals

### Phase 5: Polish & Subagent (P2/P3)

1. Add configurable review reminders (P3)
2. Implement optional `temporal-analyzer` subagent (P2)
3. Performance optimization for 50+ baselines
4. Comprehensive test coverage (>80%)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| jsondiffpatch performance on large baselines | Lazy-load full JSON; index metrics in SQLite |
| Qualitative review adoption | Make reviews optional; low-friction prompts; triggered reviews |
| Schema evolution | Version field in all entities; migration utilities |
| Context window overflow | Hybrid summarization per ADR-0005; optional subagent pattern |

---

## References

- **Spec**: [specs/ep09-temporal-analysis/spec.md](./spec.md)
- **Epic**: [docs/planning/epics/EP09-temporal-analysis.md](../../docs/planning/epics/EP09-temporal-analysis.md)
- **Arc42**: [§6.3 Baseline Comparison](../../docs/architecture/arc42/06-runtime-view.md)
- **ADRs**:
  - [ADR-0005: Tool Definition Pattern](../../docs/architecture/adr/0005-tool-definition-and-invocation-pattern.md)
  - [ADR-0008: Baseline Storage](../../docs/architecture/adr/0008-baseline-storage-format-and-strategy.md)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-18 | Claude | Initial plan from /dev.plan |
