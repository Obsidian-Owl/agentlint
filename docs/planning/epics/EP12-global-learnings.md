# EP12: Global Learnings

> Implement cross-project learning storage, transfer, and promotion mechanisms.

## Classification

| Attribute | Value |
|-----------|-------|
| **Type** | Integration |
| **Priority** | P2-Medium |
| **Size** | M |
| **Estimated Duration** | 4 weeks |
| **Target Stories** | 7-9 stories |

## Business Outcome Hypothesis

**If** we implement global learning transfer across projects,
**Then** insights from one project improve analysis in all projects,
**Measured by** learning promotion rate and cross-project value realization.

## Scope Definition

### In Scope

- [ ] Implement global learnings storage (`~/.agentlint/learnings/`)
- [ ] Implement project learnings storage (`.agentlint/learnings/`)
- [ ] Create `store_learning` tool (project scope)
- [ ] Create `list_learnings` tool (project and global)
- [ ] Create `promote_learning` tool (project → global)
- [ ] Load global learnings at session start
- [ ] Implement learning relevance scoring
- [ ] Support learning categories (patterns, anti-patterns, recommendations)
- [ ] Implement `agentlint learn --global` CLI command

### Out of Scope

- Persistence layer implementation (EP03)
- Recommendation generation using learnings (EP10)
- CLI command implementation (EP04 provides entry point)
- Cross-machine sync (explicitly non-goal)

### Minimum Viable Product (MVP)

The minimum deliverable that proves the hypothesis:

- Store learning at project level
- Promote learning to global level
- Load global learnings at session start

**MVP validates:** Learning transfer works before adding relevance scoring

## Arc42 Traceability

| Source | References |
|--------|------------|
| **Building Blocks** | Persistence Layer (Learnings), Tool Layer |
| **Runtime Scenarios** | Session start loads global learnings |
| **Quality Requirements** | N/A (feature quality) |
| **Crosscutting Concepts** | 8.4 Context Management (learnings in cognitive workspace) |
| **ADRs** | ADR-0009 (Global Learnings Storage) |

## Requirements Traceability

| Source | References |
|--------|------------|
| **Personas** | Persona 0 (Agent - loaded learnings), Persona 1 (Optimizer) |
| **Use Cases** | UC-011 (Persist Global Learnings), FR-5.3 (Learning Persistence) |
| **Requirements** | FR-5.3 (Learning Persistence) |

## Dependencies

### Blocked By (Cannot Start Without)

| Epic | Dependency Type | What's Needed |
|------|-----------------|---------------|
| EP01 | Hard | Project structure, global storage location |
| EP03 | Hard | Storage infrastructure for learnings |
| EP09 | Soft | Baseline comparison for learning validation |

### Blocks (Other Epics Waiting On This)

| Epic | Dependency Type | What This Provides |
|------|-----------------|-------------------|
| None | — | Final epic in sequence |

### External Dependencies

| System/Team | Dependency | Status |
|-------------|------------|--------|
| None | — | Uses internal storage |

## Technical Considerations

### Key Decisions

- Two scopes: project-local and global (`~/.agentlint/learnings/`)
- Learnings are JSON files with metadata
- Relevance scoring helps agent prioritize
- No cross-machine sync (local-first)

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Learnings become stale | Medium | Low | Expiration metadata, user review |
| Too many learnings overwhelm context | Medium | Medium | Relevance scoring, limits |
| Project-specific learnings promoted incorrectly | Low | Low | User confirmation on promote |

### Spikes Needed

- [ ] Design learning schema for categories
- [ ] Test relevance scoring accuracy

### Constitution Alignment

- **VIII. Compounding Value**: Learnings transfer IS compounding value
- **I. Local-First**: Learnings stay on user's machine
- **IX. Agent-Aware**: Learnings loaded into cognitive workspace

## Acceptance Criteria (High-Level)

### Functional

- [ ] `store_learning` persists to `.agentlint/learnings/`
- [ ] `list_learnings` shows project and global learnings
- [ ] `promote_learning` copies to `~/.agentlint/learnings/`
- [ ] Global learnings loaded at session start
- [ ] Relevance scoring prioritizes applicable learnings
- [ ] Learning categories: patterns, anti-patterns, recommendations
- [ ] `agentlint learn --global` promotes via CLI
- [ ] Learnings include metadata (source, date, context)

### Non-Functional

- [ ] Learning load < 1 second at session start
- [ ] Storage format human-readable (JSON)
- [ ] No cross-machine sync (local only)

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] Code reviewed and merged
- [ ] Tests written and passing (unit, integration)
- [ ] Documentation updated (learning workflow)
- [ ] Deployed to staging environment
- [ ] Product owner sign-off

## Speckit Handoff Notes

> Guidance for `/speckit.specify` phase

### Primary Focus

- **Persona**: Persona 0 (Agent) - receive learnings in context
- **Workflow**: Learn → store → promote → apply across projects
- **Outcome**: Knowledge compounds over time

### Constraints to Encode

From ADRs:
- ADR-0009: Project + global scopes, JSON format

From Constitution:
- VIII. Compounding Value: Learning transfer is core
- I. Local-First: No external sync

### Key Scenarios to Specify

1. Store learning from successful recommendation
2. Promote learning to global scope
3. Load relevant learnings at session start
4. Learning relevance scoring in action

### Tech Stack Notes (for `/speckit.plan`)

- JSON storage for learnings
- Metadata schema for categorization
- Relevance scoring algorithm

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-15 | Arc42 Decomposer | Initial creation from Arc42 |
