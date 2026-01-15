# Epic Template

Use this template for each epic file in `docs/planning/epics/`.

---

```markdown
# EP[XX]: [Epic Name]

> [One-sentence summary of what this epic delivers]

## Classification

| Attribute | Value |
|-----------|-------|
| **Type** | Foundation / Business / Enabler / Integration |
| **Priority** | P0-Critical / P1-High / P2-Medium / P3-Low |
| **Size** | S / M / L / XL |
| **Estimated Duration** | X weeks |
| **Target Stories** | X-Y stories |

## Business Outcome Hypothesis

**If** we deliver [specific capability from this epic],  
**Then** [stakeholder/user persona] will be able to [achieve specific outcome],  
**Measured by** [quantifiable success metric].

## Scope Definition

### In Scope

- [ ] [Specific capability 1]
- [ ] [Specific capability 2]
- [ ] [Specific capability 3]

### Out of Scope

- [Explicitly excluded item 1 — reason/which epic owns it]
- [Explicitly excluded item 2 — reason/which epic owns it]

### Minimum Viable Product (MVP)

The minimum deliverable that proves the hypothesis:

- [Essential capability 1]
- [Essential capability 2]

**MVP validates:** [What question does the MVP answer?]

## Arc42 Traceability

| Source | References |
|--------|------------|
| **Building Blocks** | [Component names from §5] |
| **Runtime Scenarios** | [Scenario names from §6] |
| **Quality Requirements** | [QR IDs from §10] |
| **Crosscutting Concepts** | [Concepts from §8 if applicable] |
| **ADRs** | [ADR numbers from docs/architecture/adr/] |

## Requirements Traceability

| Source | References |
|--------|------------|
| **Personas** | [Persona names if defined in docs/requirements/] |
| **Use Cases** | [Use case IDs if defined] |
| **Requirements** | [Requirement IDs if defined] |

## Dependencies

### Blocked By (Cannot Start Without)

| Epic | Dependency Type | What's Needed |
|------|-----------------|---------------|
| [EPxx] | Hard / Soft | [Specific deliverable required] |

### Blocks (Other Epics Waiting On This)

| Epic | Dependency Type | What This Provides |
|------|-----------------|-------------------|
| [EPxx] | Hard / Soft | [Specific deliverable provided] |

### External Dependencies

| System/Team | Dependency | Status |
|-------------|------------|--------|
| [External system] | [What's needed] | Confirmed / Pending / Risk |

## Technical Considerations

### Key Decisions

- [Important technical approach or pattern]
- [Technology choice and rationale]

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk description] | High/Med/Low | High/Med/Low | [Mitigation approach] |

### Spikes Needed

- [ ] [Research spike 1 — question to answer]
- [ ] [Research spike 2 — question to answer]

### Constitution Alignment

Relevant principles from `.specify/memory/constitution.md`:
- [Principle 1 that applies]
- [Principle 2 that applies]

## Acceptance Criteria (High-Level)

### Functional

- [ ] [User can... / System shall...]
- [ ] [User can... / System shall...]

### Non-Functional

- [ ] [Performance: response time < X ms]
- [ ] [Security: authentication required for...]
- [ ] [Reliability: availability of X%]

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] Code reviewed and merged
- [ ] Tests written and passing (unit, integration)
- [ ] Documentation updated
- [ ] Deployed to staging environment
- [ ] Product owner sign-off

## Speckit Handoff Notes

> Guidance for `/speckit.specify` phase

### Primary Focus

- **Persona**: [Primary user persona for this epic]
- **Workflow**: [Main user journey to specify]
- **Outcome**: [What user achieves at the end]

### Constraints to Encode

From ADRs:
- [ADR-XXX: constraint description]

From Constitution:
- [Principle that must be followed]

### Key Scenarios to Specify

1. [Happy path scenario]
2. [Alternative flow]
3. [Error handling scenario]

### Tech Stack Notes (for `/speckit.plan`)

- [Framework/library to use]
- [Pattern to follow]
- [Integration approach]

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| YYYY-MM-DD | [Name] | Initial creation |
```

---

## Usage Notes

1. **File naming**: `EP01-epic-slug.md`, `EP02-another-epic.md`
2. **Numbering**: Use sequential numbers; gaps are OK after splits
3. **Scope changes**: Update and note in change log
4. **Dependencies**: Update both sides when adding dependency