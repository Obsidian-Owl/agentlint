# dev.checklist

> Generate domain-specific quality checklists for feature validation

## When to Use

Use this skill when:
- Starting a new feature to establish quality criteria
- Before implementation to define "done" criteria
- During review to validate completeness
- For domain-specific quality requirements

## Invocation

```
/dev.checklist [checklist type]
```

**Checklist types:**
- `requirements` - Requirement quality checklist
- `design` - Design quality checklist
- `implementation` - Implementation quality checklist
- `review` - Pre-PR review checklist
- `custom` - Generate from description

## Prerequisites

- Must be on a feature branch (e.g., `ep01-feature-name`)
- `spec.md` should exist for context

## Workflow

### Phase 1: Load Context

Read feature artifacts to understand:
- Domain/problem space
- Key requirements
- Technical constraints
- Quality attributes (NFRs)

### Phase 2: Generate Checklist

Based on type, generate appropriate checklist in `checklists/` directory.

### Requirements Checklist (`requirements.md`)

```markdown
# Requirements Quality Checklist

## Completeness
- [ ] All user stories have acceptance criteria
- [ ] All requirements have unique IDs
- [ ] Dependencies explicitly documented
- [ ] Out of scope clearly defined
- [ ] Success criteria measurable

## Clarity
- [ ] No vague terms (fast, easy, scalable) without metrics
- [ ] No undefined acronyms or jargon
- [ ] No ambiguous pronouns ("it", "they", "this")
- [ ] Each requirement independently understandable

## Consistency
- [ ] No conflicting requirements
- [ ] Terminology used consistently
- [ ] Priority levels consistent with dependencies
- [ ] No duplicate requirements

## Testability
- [ ] Each requirement can be verified
- [ ] Acceptance criteria are binary (pass/fail)
- [ ] Edge cases documented
- [ ] Error conditions specified

## Traceability
- [ ] Requirements link to user needs
- [ ] Dependencies reference other requirements
- [ ] Related ADRs documented
```

### Design Checklist (`design.md`)

```markdown
# Design Quality Checklist

## Architecture Alignment
- [ ] Follows established patterns (Arc42 §8)
- [ ] No architecture violations
- [ ] ADRs created for new decisions
- [ ] Constitution principles checked

## Data Model
- [ ] All entities defined
- [ ] Relationships documented
- [ ] Validation rules specified
- [ ] State transitions clear

## API Design
- [ ] Contracts defined
- [ ] Error handling specified
- [ ] Backward compatibility considered
- [ ] Versioning strategy clear

## Technical Debt
- [ ] No shortcuts without documentation
- [ ] Complexity justified
- [ ] TODOs tracked
- [ ] Migration path clear
```

### Implementation Checklist (`implementation.md`)

```markdown
# Implementation Quality Checklist

## Code Quality
- [ ] Follows project conventions
- [ ] No linting errors
- [ ] Type safety maintained
- [ ] No hardcoded values

## Testing
- [ ] Unit tests written
- [ ] Integration tests for flows
- [ ] Edge cases covered
- [ ] Test coverage adequate

## Documentation
- [ ] Public APIs documented
- [ ] Complex logic explained
- [ ] README updated if needed
- [ ] Changelog entry added

## Security
- [ ] Input validation present
- [ ] No secrets in code
- [ ] Error messages safe
- [ ] Dependencies audited
```

### Review Checklist (`review.md`)

```markdown
# Pre-PR Review Checklist

## Functional
- [ ] All acceptance criteria met
- [ ] Edge cases handled
- [ ] Error handling complete
- [ ] User flows work end-to-end

## Technical
- [ ] Types pass
- [ ] Lint passes
- [ ] Tests pass
- [ ] No regressions

## Documentation
- [ ] Code comments adequate
- [ ] API docs updated
- [ ] Spec marked complete
- [ ] Linear issues closed

## Process
- [ ] Commit messages follow format
- [ ] Branch up to date with main
- [ ] No merge conflicts
- [ ] Ready for review
```

### Phase 3: Customize for Feature

Add feature-specific items based on:
- NFRs from spec.md (performance, security, etc.)
- Domain requirements (data handling, compliance)
- Integration points (APIs, services)
- Tech stack specifics

### Phase 4: Save Checklist

Write to `$FEATURE_DIR/checklists/{type}.md`

## Output

On completion:
```
Checklist generated!

  Type:       requirements
  Location:   specs/ep01-core-foundation/checklists/requirements.md
  Items:      25 checks

  Categories:
    Completeness:    6 items
    Clarity:         5 items
    Consistency:     4 items
    Testability:     5 items
    Traceability:    5 items

Use this checklist to validate your spec before /dev.plan
```

## Constitution Alignment

This skill supports:
- **VII. Consistent**: Standardized quality criteria
- **VIII. Conventional**: Follows project conventions
- **IX. Agent-Aware**: Structured for systematic validation

## Files

- `templates/checklist-template.md` - Base template
- Generated: `checklists/*.md` in feature directory
