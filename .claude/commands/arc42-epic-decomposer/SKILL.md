---
name: arc42-epic-decomposer
description: Analyses Arc42 architecture documentation and decomposes it into well-sized Epics suitable for Speckit implementation. Use when breaking down architecture into implementable work, creating epic catalogues from design docs, preparing Arc42 for agile delivery, or when asked to plan epics from architecture.
---

# Arc42 to Epic Decomposition

Transforms Arc42 architecture documentation into Speckit-ready Epics with proper sizing, dependency management, and traceability.

## Project Structure Conventions

This skill expects the following folder structure:

```
docs/
├── architecture/
│   ├── arc42/          # Arc42 documentation (input)
│   └── adr/            # Architecture Decision Records (input)
├── requirements/       # Personas, use-cases, requirements (input)
├── vision/             # Vision statements, north stars (input)
└── planning/           # Epic catalogue and roadmap (output)
    └── epics/          # Individual epic files

.specify/
└── memory/
    └── constitution.md # Speckit constitution (reference)
```

## Quick Start

1. Read `docs/architecture/arc42/` for architecture documentation
2. Check `.specify/memory/constitution.md` for project principles
3. Run the analysis workflow
4. Generate epic catalogue in `docs/planning/epics/`

## Analysis Workflow

Copy this checklist and track progress:

```
Arc42 Epic Decomposition Progress:
- [ ] Phase 1: Read all input documentation
- [ ] Phase 2: Extract context and constraints
- [ ] Phase 3: Map building blocks to epic candidates
- [ ] Phase 4: Apply sizing rules and form epics
- [ ] Phase 5: Analyse dependencies and sequence
- [ ] Phase 6: Generate output files in docs/planning/
```

### Phase 1: Read Documentation

Read in this order:

1. **Vision** (if exists): `docs/vision/` — North star, strategic direction
2. **Constitution**: `.specify/memory/constitution.md` — Project principles
3. **Arc42**: `docs/architecture/arc42/` — Architecture documentation
4. **ADRs**: `docs/architecture/adr/` — Key decisions and rationale
5. **Requirements** (if exists): `docs/requirements/` — Personas, use-cases

Minimum required: Arc42 sections 1, 3, and 5.

### Phase 2: Extract Context

Summarise these elements:

| Extract | Source | Purpose |
|---------|--------|---------|
| Strategic direction | `docs/vision/` | Epic prioritisation |
| Project principles | `.specify/memory/constitution.md` | Constraints on approach |
| Business drivers | Arc42 §1 | Epic acceptance criteria |
| System boundaries | Arc42 §3 | Integration epic identification |
| Technical constraints | Arc42 §2 + ADRs | Epic technical requirements |
| Quality attributes | Arc42 §10 | Non-functional requirements |

### Phase 3: Map Building Blocks

From Arc42 §5 Building Block View:
- List each Level 1 component's name and responsibility
- Note dependencies between components
- Flag shared/foundational components

Cross-reference with:
- Arc42 §6 Runtime View for workflow boundaries
- Arc42 §7 Deployment View for infrastructure needs
- Arc42 §8 Crosscutting Concepts for enabler epics

See [references/arc42-mapping.md](references/arc42-mapping.md) for detailed mapping guidance.

### Phase 4: Form Epics

Apply sizing rules to each candidate:

| Dimension | Target | If Violated |
|-----------|--------|-------------|
| Duration | 4-8 weeks | Split if >8 weeks, merge if <2 weeks |
| User stories | 5-12 expected | Decompose if >15, expand if <3 |
| MVP | Defined | Must identify minimum viable slice |
| Independence | Testable alone | Extract shared work to foundation |

Classify each epic:

| Type | Description | Examples |
|------|-------------|----------|
| **Foundation** | Enables other work | CI/CD, dev environment, auth, shared libs |
| **Business** | Delivers user value | Features, domain modules, bounded contexts |
| **Enabler** | Technical excellence | Logging, monitoring, security, tech debt |
| **Integration** | Connects systems | External APIs, data sync, migrations |

Use template: [templates/epic-template.md](templates/epic-template.md)

### Phase 5: Dependency Analysis

Ensure dependency graph has:
- Foundation epics with no blockers
- No circular dependencies
- Soft dependencies use interface contracts
- Clear critical path identified

Apply WSJF prioritisation:
```
Score = (Business Value + Time Criticality + Risk Reduction) / Size
```

See [references/dependency-patterns.md](references/dependency-patterns.md) for examples.

### Phase 6: Generate Outputs

Create files in `docs/planning/`:

```
docs/planning/
├── epic-catalogue.md      # Summary table and roadmap
├── dependency-graph.mermaid
├── speckit-guide.md       # Workflow for Speckit handoff
└── epics/
    ├── EP01-*.md
    ├── EP02-*.md
    └── ...
```

## Epic Template (Summary)

```markdown
# EP[XX]: [Epic Name]

## Classification
| Attribute | Value |
|-----------|-------|
| Type | Foundation / Business / Enabler / Integration |
| Priority | P0 / P1 / P2 / P3 |
| Size | S / M / L / XL |
| Duration | X weeks |

## Business Outcome Hypothesis
**If** we deliver [this epic],
**Then** [stakeholder] will be able to [outcome],
**Measured by** [metric].

## Scope
- **In Scope**: [capabilities]
- **Out of Scope**: [exclusions]
- **MVP**: [minimum viable slice]

## Traceability
- **Arc42 Building Blocks**: [from §5]
- **ADRs**: [relevant decision numbers]
- **Quality Requirements**: [from §10]

## Dependencies
| Blocked By | Type | What's Needed |
|------------|------|---------------|
| EPxx | Hard/Soft | Description |

## Acceptance Criteria
- [ ] [testable criterion]

## Speckit Handoff Notes
- Primary persona: [from requirements]
- Key workflow: [main user journey]
- Constraints: [from constitution + ADRs]
```

Full template: [templates/epic-template.md](templates/epic-template.md)

## Speckit Integration

After generating epics, for each epic (in dependency order):

```bash
git checkout -b epXX-epic-name
```

```
/speckit.specify [Paste epic scope and business outcome from EPxx.md]
/speckit.clarify
/speckit.plan [Include constraints from constitution and ADRs]
/speckit.tasks
/speckit.implement
```

The constitution at `.specify/memory/constitution.md` will automatically inform Speckit's decisions.

## Validation Checklist

Before finalising:

```
Epic Quality Check:
- [ ] Every Arc42 building block maps to at least one epic
- [ ] Every external interface (§3) has an integration epic
- [ ] Crosscutting concerns (§8) have enabler epics
- [ ] No epic exceeds 8 weeks duration
- [ ] No circular dependencies exist
- [ ] Each epic has defined MVP
- [ ] Acceptance criteria are testable
- [ ] ADR constraints reflected in relevant epics
- [ ] Constitution principles respected
```

## References

- [Arc42 Section Mapping](references/arc42-mapping.md) — Which sections inform which epic types
- [Dependency Patterns](references/dependency-patterns.md) — Good and bad dependency examples
- [Sizing Guidelines](references/sizing-guidelines.md) — When to split or merge epics
- [Epic Template](templates/epic-template.md) — Full template with all fields
- [Catalogue Template](templates/catalogue-template.md) — Epic catalogue structure
- [Speckit Guide Template](templates/speckit-guide-template.md) —  Per-epic Speckit workflow