# Implementation Plan: {{FEATURE_NAME}}

> **Epic**: {{EPIC_ID}}
> **Spec**: {{SPEC_PATH}}
> **Created**: {{DATE}}
> **Status**: Draft
> **Author**: {{AUTHOR}}

---

## Summary

**Primary Requirement**: [Extract from spec.md - the main thing this feature delivers]

**Technical Approach**: [High-level approach - 1-2 sentences on how we'll build this]

---

## Technical Context

> Fill in project-specific values. Mark unknowns as `[NEEDS CLARIFICATION]`.

| Aspect | Value |
|--------|-------|
| **Language/Version** | [e.g., TypeScript 5.x, Python 3.12, Go 1.21] |
| **Primary Dependencies** | [e.g., Commander, Vitest, Pydantic] |
| **Storage** | [e.g., File system, SQLite, PostgreSQL, None] |
| **Testing Framework** | [e.g., Vitest, pytest, go test] |
| **Target Platform** | [e.g., CLI, Web, API, Library] |
| **Project Type** | [e.g., CLI Tool, Library, Service, Plugin] |
| **Performance Goals** | [e.g., < 5s response, < 100MB memory] |
| **Constraints** | [e.g., No external services, Must be offline-capable] |
| **Scale/Scope** | [e.g., Single user, Team, Enterprise] |

---

## Constitution Check

> Validate against project constitution at `.specify/memory/constitution.md`

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | | ☐ | |
| II | | ☐ | |
| III | | ☐ | |
| IV | | ☐ | |
| V | | ☐ | |
| VI | | ☐ | |
| VII | | ☐ | |
| VIII | | ☐ | |
| IX | | ☐ | |

**Gate Status**: [ ] All principles pass

---

## Project Structure

### Documentation Structure

```
specs/{{EPIC_ID_LOWER}}-{{FEATURE_SLUG}}/
├── spec.md           # Feature specification
├── plan.md           # This file
├── research.md       # Research findings (Phase 1)
├── data-model.md     # Entity definitions (Phase 2)
├── quickstart.md     # Usage guide (Phase 2)
├── contracts/        # API definitions (Phase 2)
└── checklists/       # Validation checklists
```

### Source Code Structure (Proposed)

```
src/
├── [component]/      # New component location
│   ├── index.ts      # Public exports
│   ├── types.ts      # Type definitions
│   └── ...
└── ...
```

---

## Complexity Tracking

> Only add rows if constitution principles require justified violations

| Principle | Violation | Justification | Mitigation |
|-----------|-----------|---------------|------------|
| | | | |

---

## Key Design Decisions

| Decision | Choice | Rationale | ADR |
|----------|--------|-----------|-----|
| [Decision 1] | [Choice] | [Why] | [ADR-XXXX or N/A] |

---

## References

- **Spec**: [Link to spec.md]
- **Epic**: [Link to Linear project]
- **Arc42**: [Relevant architecture sections]
- **ADRs**: [Relevant decision records]

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| {{DATE}} | {{AUTHOR}} | Initial plan |
