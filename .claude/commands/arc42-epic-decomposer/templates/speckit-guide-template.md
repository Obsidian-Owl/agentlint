# Speckit Guide Template

Use this structure for `docs/planning/speckit-guide.md`.

---

```markdown
# Speckit Implementation Guide

> Workflow for implementing epics using Speckit

## Prerequisites

Before starting implementation:

1. ✅ Epic catalogue reviewed and approved
2. ✅ Dependencies validated
3. ✅ Constitution established at `.specify/memory/constitution.md`
4. ✅ Speckit initialised in project (`specify init . --ai claude`)

## Implementation Order

Execute epics in this sequence (respecting dependencies):

### Wave 1: Foundation

| Order | Epic | Branch Name | Blocked By |
|-------|------|-------------|------------|
| 1 | EP01: [Name] | `ep01-name` | None |
| 2 | EP02: [Name] | `ep02-name` | None |

### Wave 2: Core Business

| Order | Epic | Branch Name | Blocked By |
|-------|------|-------------|------------|
| 3 | EP03: [Name] | `ep03-name` | EP01, EP02 |
| 4 | EP04: [Name] | `ep04-name` | EP01 |

### Wave 3: Integration & Enablers

| Order | Epic | Branch Name | Blocked By |
|-------|------|-------------|------------|
| 5 | EP05: [Name] | `ep05-name` | EP03 |
| 6 | EP06: [Name] | `ep06-name` | EP03, EP04 |

## Per-Epic Workflow

For each epic, follow this workflow:

### 1. Create Branch

```bash
git checkout main
git pull origin main
git checkout -b epXX-epic-name
```

### 2. Run /speckit.specify

Open Claude Code and run:

```
/speckit.specify
```

Then paste the epic's business outcome and scope:

```
[Copy from EPxx.md]

## Business Outcome Hypothesis
If we deliver [capability],
Then [stakeholder] will be able to [outcome],
Measured by [metric].

## In Scope
- [capability 1]
- [capability 2]

## Primary Persona
[persona name and description]

## Key Scenarios
1. [scenario 1]
2. [scenario 2]
```

### 3. Run /speckit.clarify

```
/speckit.clarify
```

Answer questions to refine the specification.

### 4. Run /speckit.plan

```
/speckit.plan
```

Include technical constraints:

```
Technical constraints from architecture:
- [From ADR-XXX: constraint]
- [From constitution: principle]

Tech stack:
- [Framework/library]
- [Pattern to follow]

Integration points:
- [System/API to integrate with]
```

### 5. Run /speckit.tasks

```
/speckit.tasks
```

Review generated tasks for completeness.

### 6. Run /speckit.implement

```
/speckit.implement
```

Monitor implementation, address issues as they arise.

### 7. Create PR

```bash
git add .
git commit -m "feat(epXX): [epic name] implementation"
gh pr create --title "EP[XX]: [Epic Name]" --body "## Summary
[Epic description]

## Acceptance Criteria
- [ ] [criterion 1]
- [ ] [criterion 2]

## Testing
- [ ] Unit tests passing
- [ ] Integration tests passing

## Documentation
- [ ] README updated
- [ ] API docs updated"
```

### 8. Update Epic Status

Update `docs/planning/epic-catalogue.md`:
- Change status to "In Review" or "Complete"
- Note actual duration
- Record any scope changes

## Epic-Specific Notes

### EP01: [Name]

**Speckit Focus:**
- [Specific guidance for this epic]

**Key Constraints:**
- [Constraint 1]
- [Constraint 2]

**Watch Out For:**
- [Common pitfall]

---

### EP02: [Name]

**Speckit Focus:**
- [Specific guidance for this epic]

**Key Constraints:**
- [Constraint 1]

---

[Repeat for each epic]

## Troubleshooting

### Speckit generates wrong tech stack

Re-run `/speckit.plan` with explicit constraints:
```
Use [specific technology] as specified in ADR-XXX.
Do not use [wrong technology].
```

### Implementation diverges from plan

1. Stop `/speckit.implement`
2. Review divergence with team
3. Update spec if requirements changed
4. Re-run from `/speckit.tasks`

### Cross-epic dependencies not available

1. Check if blocker epic is truly complete
2. If soft dependency, proceed with mock/stub
3. Document assumption for later integration

## Quality Gates

Before marking epic complete:

```
Epic Completion Checklist:
- [ ] All acceptance criteria from EPxx.md pass
- [ ] Tests cover happy path and error cases
- [ ] Documentation updated
- [ ] PR reviewed and approved
- [ ] Deployed to staging
- [ ] Product owner sign-off
- [ ] Epic status updated in catalogue
```
```