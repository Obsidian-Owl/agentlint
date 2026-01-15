# EP09: Temporal Analysis

> Implement baseline management, delta calculation, and trend tracking over time.

## Classification

| Attribute | Value |
|-----------|-------|
| **Type** | Business |
| **Priority** | P1-High |
| **Size** | M |
| **Estimated Duration** | 5 weeks |
| **Target Stories** | 8-10 stories |

## Business Outcome Hypothesis

**If** we implement baseline comparison and trend tracking,
**Then** developers can observe improvement over time and correlate changes with outcomes,
**Measured by** accurate delta calculation and visible improvement trends.

## Scope Definition

### In Scope

- [ ] Implement `store_baseline` tool (capture current state)
- [ ] Implement `query_baseline` tool (retrieve by timestamp)
- [ ] Implement `list_baselines` tool (enumerate history)
- [ ] Calculate deltas between current state and baseline (jsondiffpatch)
- [ ] Identify improvement/regression patterns
- [ ] Correlate changes with git history
- [ ] Track recommendation implementation status
- [ ] Generate trend indicators (↑ ↓ →)
- [ ] Support multiple baseline history
- [ ] Implement comparison views (current vs baseline)

### Out of Scope

- Baseline storage implementation (EP03)
- Recommendation generation (EP10)
- Global learnings (EP12)
- CLI comparison output (EP04)

### Minimum Viable Product (MVP)

The minimum deliverable that proves the hypothesis:

- Store baseline on command
- Retrieve and compare to latest baseline
- Calculate simple delta (changed fields)

**MVP validates:** Baseline workflow works before adding trend analysis

## Arc42 Traceability

| Source | References |
|--------|------------|
| **Building Blocks** | Tool Layer (Baseline tools), Persistence Layer |
| **Runtime Scenarios** | 6.3 Baseline Comparison (full flow) |
| **Quality Requirements** | QS-6 (<2s trend queries) |
| **Crosscutting Concepts** | Domain model (Baseline → Analysis → Recommendation) |
| **ADRs** | ADR-0005 (Tool Definition), ADR-0008 (Baseline Storage) |

## Requirements Traceability

| Source | References |
|--------|------------|
| **Personas** | Persona 1 (Optimizer) - track improvement over time |
| **Use Cases** | UC-000 (Establish Baseline), UC-006 (Compare to Baseline), UC-010 (Trend Analysis) |
| **Requirements** | FR-5 (Temporal Analysis) |

## Dependencies

### Blocked By (Cannot Start Without)

| Epic | Dependency Type | What's Needed |
|------|-----------------|---------------|
| EP01 | Hard | Project structure |
| EP02 | Soft | Tool registration (baselines are tools) |
| EP03 | Hard | Baseline storage infrastructure |

### Blocks (Other Epics Waiting On This)

| Epic | Dependency Type | What This Provides |
|------|-----------------|-------------------|
| EP10 | Soft | Baseline awareness for recommendations |
| EP12 | Soft | Baseline comparison for learning validation |

### External Dependencies

| System/Team | Dependency | Status |
|-------------|------------|--------|
| jsondiffpatch | Delta calculation library | Available |
| Git | History correlation | Available |

## Technical Considerations

### Key Decisions

- jsondiffpatch for structured delta calculation
- Baselines stored as JSON (human-readable)
- SQLite indexes for fast querying
- Git correlation uses adapter from EP08

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Schema changes break baseline comparison | Medium | Medium | Version baselines, migration support |
| Large baseline files slow comparison | Low | Low | Index key metrics separately |

### Spikes Needed

- [ ] Test jsondiffpatch with complex baselines
- [ ] Benchmark trend queries with 50+ baselines

### Constitution Alignment

- **II. Improvement-Oriented**: Baseline tracking IS the core capability
- **VIII. Compounding Value**: Trends reveal accumulated improvement

## Acceptance Criteria (High-Level)

### Functional

- [ ] `store_baseline` captures current analysis state
- [ ] `query_baseline` retrieves by timestamp or "latest"
- [ ] `list_baselines` shows all stored baselines
- [ ] Delta calculation shows added/removed/changed fields
- [ ] Trend indicators show improvement direction
- [ ] Git correlation links changes to commits
- [ ] Recommendation status tracked across baselines
- [ ] Comparison view shows side-by-side

### Non-Functional

- [ ] Query 50 baselines < 2 seconds
- [ ] Delta calculation < 1 second
- [ ] Baseline storage atomic

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] Code reviewed and merged
- [ ] Tests written and passing (unit, integration)
- [ ] Documentation updated (baseline workflow)
- [ ] Deployed to staging environment
- [ ] Product owner sign-off

## Speckit Handoff Notes

> Guidance for `/speckit.specify` phase

### Primary Focus

- **Persona**: Persona 1 (Optimizer)
- **Workflow**: Establish baseline → make changes → compare → observe trends
- **Outcome**: Visible improvement over time

### Constraints to Encode

From ADRs:
- ADR-0008: JSON + SQLite index pattern
- ADR-0005: Tool definitions with Zod

From Constitution:
- II. Improvement-Oriented: Baseline tracking is core

### Key Scenarios to Specify

1. First baseline establishment
2. Compare current to baseline from 30 days ago
3. Show improvement trend across 10 baselines
4. Correlate improvement with specific commit

### Tech Stack Notes (for `/speckit.plan`)

- jsondiffpatch for delta calculation
- SQLite for baseline indexing
- Git CLI for history correlation

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-15 | Arc42 Decomposer | Initial creation from Arc42 |
