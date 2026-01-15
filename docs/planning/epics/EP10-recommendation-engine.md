# EP10: Recommendation Engine

> Implement recommendation generation, prioritization, tracking, and effectiveness correlation.

## Classification

| Attribute | Value |
|-----------|-------|
| **Type** | Business |
| **Priority** | P1-High |
| **Size** | M |
| **Estimated Duration** | 4 weeks |
| **Target Stories** | 8-10 stories |

## Business Outcome Hypothesis

**If** we implement a recommendation engine that generates actionable, traced recommendations,
**Then** developers receive specific guidance to improve their AI workflows,
**Measured by** recommendation implementation rate and outcome improvement.

## Scope Definition

### In Scope

- [ ] Generate symptomatic recommendations (fix immediate issue)
- [ ] Generate preventive recommendations (enable prevention of recurrence)
- [ ] Generate systemic recommendations (address root patterns)
- [ ] Provide specific, actionable configuration changes
- [ ] Include rationale and traced origin for each recommendation
- [ ] Prioritize recommendations by expected impact
- [ ] Implement `store_recommendation` tool
- [ ] Implement `list_recommendations` tool
- [ ] Implement `update_recommendation` tool (status changes)
- [ ] Track recommendation history
- [ ] Detect whether recommendations were implemented
- [ ] Correlate implementation with outcome changes

### Out of Scope

- Causal analysis (EP07 - provides input)
- Baseline comparison (EP09 - used for correlation)
- Global learning promotion (EP12)
- CLI recommendation output (EP04)

### Minimum Viable Product (MVP)

The minimum deliverable that proves the hypothesis:

- Generate recommendation with rationale and origin
- Store recommendation with priority
- Mark recommendation as implemented/dismissed

**MVP validates:** Recommendation workflow works before adding effectiveness tracking

## Arc42 Traceability

| Source | References |
|--------|------------|
| **Building Blocks** | Tool Layer (Recommendation tools) |
| **Runtime Scenarios** | 6.1 Full Analysis (generate recommendations) |
| **Quality Requirements** | N/A (quality is the feature) |
| **Crosscutting Concepts** | Domain model (Recommendation with evidence chain) |
| **ADRs** | ADR-0005 (Tool Definition) |

## Requirements Traceability

| Source | References |
|--------|------------|
| **Personas** | Persona 1 (Optimizer), Persona 4 (Context Engineer) |
| **Use Cases** | UC-004 (Recommendations), UC-009 (Validate Effectiveness) |
| **Requirements** | FR-7 (Recommendation Engine) |

## Dependencies

### Blocked By (Cannot Start Without)

| Epic | Dependency Type | What's Needed |
|------|-----------------|---------------|
| EP01 | Hard | Project structure |
| EP02 | Hard | Agent synthesis capabilities |
| EP03 | Hard | Recommendation storage |
| EP05 | Soft | Config assessment data |
| EP06 | Soft | Session metrics data |
| EP07 | Hard | Causal chains for preventive recommendations |
| EP09 | Soft | Baseline awareness for correlation |

### Blocks (Other Epics Waiting On This)

| Epic | Dependency Type | What This Provides |
|------|-----------------|-------------------|
| EP12 | Soft | Recommendations for learning promotion |

### External Dependencies

| System/Team | Dependency | Status |
|-------------|------------|--------|
| None | — | Depends on internal epics |

## Technical Considerations

### Key Decisions

- Three recommendation types: symptomatic, preventive, systemic
- Recommendations include full evidence chain from causal analysis
- Agent generates recommendations (not rule-based)
- Implementation detection via config diff

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Recommendations too vague | Medium | High | Require specific config changes |
| Implementation detection inaccurate | Medium | Medium | User confirmation option |
| Correlation claims spurious | Medium | Medium | Confidence levels, multiple observations |

### Spikes Needed

- [ ] Test recommendation quality with real issues
- [ ] Validate implementation detection accuracy

### Constitution Alignment

- **III. Causal-First**: Recommendations include traced origin
- **II. Improvement-Oriented**: Effectiveness tracking closes the loop
- **User Agency**: Recommendations propose, developer decides

## Acceptance Criteria (High-Level)

### Functional

- [ ] Generate symptomatic, preventive, systemic recommendations
- [ ] Each recommendation includes specific config change
- [ ] Each recommendation includes rationale and traced origin
- [ ] Recommendations prioritized by expected impact
- [ ] `store_recommendation` persists with metadata
- [ ] `list_recommendations` shows by status/priority
- [ ] `update_recommendation` changes status (implemented, dismissed)
- [ ] Detect implementation via config comparison
- [ ] Correlate implementation with outcome improvement

### Non-Functional

- [ ] Recommendations human-readable and actionable
- [ ] Storage operations atomic
- [ ] Correlation requires multiple observations

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] Code reviewed and merged
- [ ] Tests written and passing (unit, integration)
- [ ] Documentation updated (recommendation types)
- [ ] Deployed to staging environment
- [ ] Product owner sign-off

## Speckit Handoff Notes

> Guidance for `/speckit.specify` phase

### Primary Focus

- **Persona**: Persona 1 (Optimizer)
- **Workflow**: Receive recommendations → implement → observe improvement
- **Outcome**: Actionable guidance that works

### Constraints to Encode

From ADRs:
- ADR-0005: Tool definitions with Zod

From Constitution:
- III. Causal-First: Include traced origin
- User Agency: Recommend, don't automate

### Key Scenarios to Specify

1. Generate preventive recommendation from causal chain
2. Mark recommendation as implemented
3. Detect implementation automatically
4. Show correlation with improvement

### Tech Stack Notes (for `/speckit.plan`)

- Agent synthesis via Claude SDK
- JSON storage for recommendations
- Config diff for implementation detection

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-15 | Arc42 Decomposer | Initial creation from Arc42 |
