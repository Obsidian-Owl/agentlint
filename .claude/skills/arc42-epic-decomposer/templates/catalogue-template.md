# Epic Catalogue Template

Use this structure for `docs/planning/epic-catalogue.md`.

---

```markdown
# Epic Catalogue: [Project Name]

> Generated from Arc42 architecture documentation on [Date]

## Executive Summary

[2-3 sentences describing the overall scope and approach]

**Total Epics**: X  
**Estimated Duration**: X-Y weeks  
**Critical Path**: EP01 → EP03 → EP05 → EP08

## Epic Overview

| Epic | Name | Type | Priority | Size | Duration | Status |
|------|------|------|----------|------|----------|--------|
| EP01 | [Name] | Foundation | P0 | M | 4 weeks | Not Started |
| EP02 | [Name] | Foundation | P0 | S | 2 weeks | Not Started |
| EP03 | [Name] | Business | P1 | L | 6 weeks | Not Started |
| EP04 | [Name] | Business | P1 | M | 4 weeks | Not Started |
| EP05 | [Name] | Enabler | P2 | S | 3 weeks | Not Started |
| EP06 | [Name] | Integration | P1 | M | 5 weeks | Not Started |

## Dependency Matrix

|          | EP01 | EP02 | EP03 | EP04 | EP05 | EP06 |
|----------|------|------|------|------|------|------|
| **EP01** | —    |      |      |      |      |      |
| **EP02** |      | —    |      |      |      |      |
| **EP03** | H    | H    | —    |      |      |      |
| **EP04** | H    |      |      | —    |      |      |
| **EP05** |      |      | S    | S    | —    |      |
| **EP06** |      |      | H    |      |      | —    |

**Legend:**  
H = Hard dependency (row epic depends on column epic)  
S = Soft dependency (row epic prefers column epic complete)

## Implementation Phases

### Phase 1: Foundation (Weeks 1-4)

| Epic | Focus | Deliverables |
|------|-------|--------------|
| EP01 | [Name] | [Key deliverables] |
| EP02 | [Name] | [Key deliverables] |

**Phase Gate**: [Criteria to move to Phase 2]

### Phase 2: Core Delivery (Weeks 5-12)

| Epic | Focus | Deliverables |
|------|-------|--------------|
| EP03 | [Name] | [Key deliverables] |
| EP04 | [Name] | [Key deliverables] |

**Parallel Tracks**: EP03 and EP04 can proceed simultaneously.

**Phase Gate**: [Criteria to move to Phase 3]

### Phase 3: Integration & Polish (Weeks 13-16)

| Epic | Focus | Deliverables |
|------|-------|--------------|
| EP05 | [Name] | [Key deliverables] |
| EP06 | [Name] | [Key deliverables] |

**Phase Gate**: Production readiness criteria

## Roadmap Visualisation

```
Week:  1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16
       ├───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┤
EP01   ████████████████
EP02   ████████
EP03               ████████████████████████████
EP04               ████████████████████
EP05                                       ████████████
EP06                                   ████████████████████
       └─── Foundation ──┘└───────── Core ─────────┘└─ Integration ─┘
```

## Risk Register

| Risk | Affected Epics | Likelihood | Impact | Mitigation |
|------|----------------|------------|--------|------------|
| [Risk 1] | EP03, EP06 | Medium | High | [Mitigation] |
| [Risk 2] | EP05 | Low | Medium | [Mitigation] |

## Arc42 Coverage

| Arc42 Section | Covered By Epics |
|---------------|------------------|
| §5 Building Blocks | EP03, EP04, EP06 |
| §6 Runtime Scenarios | EP03, EP04 |
| §7 Deployment | EP01, EP02 |
| §8 Crosscutting | EP05 |
| §10 Quality Requirements | All |

## External Dependencies

| Dependency | Required By | Owner | Status | Due Date |
|------------|-------------|-------|--------|----------|
| [External API access] | EP06 | [Team] | Pending | [Date] |
| [Infrastructure] | EP01 | [Team] | Confirmed | [Date] |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| [Business metric 1] | [Target] | [How measured] |
| [Technical metric 1] | [Target] | [How measured] |

## Appendix

### Epic Files

- [EP01: Name](epics/EP01-name.md)
- [EP02: Name](epics/EP02-name.md)
- [EP03: Name](epics/EP03-name.md)
- [EP04: Name](epics/EP04-name.md)
- [EP05: Name](epics/EP05-name.md)
- [EP06: Name](epics/EP06-name.md)

### Related Documents

- [Dependency Graph](dependency-graph.mermaid)
- [Speckit Guide](speckit-guide.md)
- [Arc42 Documentation](../architecture/arc42/)
- [ADRs](../architecture/adr/)
```

---

## Usage Notes

1. Update status column as epics progress
2. Revise phase dates based on actual velocity
3. Add new epics with next sequential number
4. Keep risk register current