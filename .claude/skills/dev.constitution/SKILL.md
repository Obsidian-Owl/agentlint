# dev.constitution

> Manage and validate project constitution (governance principles)

## When to Use

Use this skill when:
- Setting up a new project's governance
- Adding or modifying project principles
- Validating work against constitution
- Onboarding team members to project standards

## Invocation

```
/dev.constitution [action]
```

**Actions:**
- `view` - Display current constitution (default)
- `validate` - Check artifacts against constitution
- `init` - Initialize constitution from template
- `update` - Modify constitution with user input

## Prerequisites

- Project should have `.specify/memory/` directory
- For validation: feature artifacts should exist

## Workflow

### View Constitution

Display current principles:

```markdown
# Project Constitution

## Active Principles

| # | Principle | Description |
|---|-----------|-------------|
| I | Truthfulness | Never hallucinate or misrepresent |
| II | Constraint-Aware | Respect technical constraints |
| III | Causal-First | Trace to root cause |
| IV | Minimal | No unnecessary complexity |
| V | Debuggable | Clear errors and logs |
| VI | Traceable | Audit trail for decisions |
| VII | Consistent | Follow established patterns |
| VIII | Conventional | Standard formatting |
| IX | Agent-Aware | Structure for automation |

## Governance Rules

- All plans must pass constitution check
- Violations require documented justification
- New principles require team consensus
```

### Validate Against Constitution

Check artifacts against each principle:

```bash
/dev.constitution validate
```

**Validation process:**

For each principle:
1. Define what compliance looks like
2. Check relevant artifacts
3. Report pass/fail with evidence

```markdown
# Constitution Validation Report

## Feature: EP01 - Core Foundation

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Truthfulness | ✓ | No speculative features in spec |
| II. Constraint-Aware | ✓ | Memory limits documented in NFR-003 |
| III. Causal-First | ✓ | All tasks trace to requirements |
| IV. Minimal | ⚠️ | Custom logger may be over-engineered |
| V. Debuggable | ✓ | Error handling in plan.md |
| VI. Traceable | ✓ | Task IDs map to Linear |
| VII. Consistent | ✓ | Follows project patterns |
| VIII. Conventional | ✓ | Standard markdown format |
| IX. Agent-Aware | ✓ | Structured YAML/JSON outputs |

**Status**: PASS (1 warning)

**Warning Details**:
- IV. Minimal: Consider using existing logger instead of custom implementation
```

### Initialize Constitution

Create constitution from template:

```bash
/dev.constitution init
```

Creates `.specify/memory/constitution.md` with:
- Standard principles template
- Project-specific customization prompts
- Governance rules

### Update Constitution

Modify principles with user input:

```bash
/dev.constitution update
```

Interactive flow:
1. Display current principles
2. Ask which to modify/add/remove
3. Update document
4. Validate syntax
5. Commit change (optional)

## Constitution Template

```markdown
# Project Constitution

> Version: 1.0.0
> Last Updated: {{DATE}}
> Maintainer: {{AUTHOR}}

## Purpose

This constitution defines the governance principles for {{PROJECT_NAME}}.
All design and implementation work must comply with these principles.

## Principles

### I. Truthfulness

**Definition**: Never hallucinate, speculate, or misrepresent capabilities.

**Compliance**:
- Specs describe only implementable features
- Documentation reflects actual behavior
- Error messages are accurate

### II. Constraint-Aware

**Definition**: Respect technical, resource, and business constraints.

**Compliance**:
- Memory limits documented and tested
- Performance targets measurable
- Dependencies explicitly versioned

### III. Causal-First

**Definition**: Trace every decision to its root cause.

**Compliance**:
- Requirements link to user needs
- Tasks link to requirements
- Code links to tasks

[... continue for all principles ...]

## Governance

### Compliance Requirements

- All plans must include constitution check section
- Violations must be documented with justification
- Repeated violations trigger architecture review

### Amendment Process

1. Propose change via ADR
2. Team discussion period (1 week)
3. Consensus required for adoption
4. Update constitution and notify team

## History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | {{DATE}} | {{AUTHOR}} | Initial constitution |
```

## Output

On view:
```
Constitution: agentlint v1.0.0

  9 Principles active
  Last updated: 2026-01-10

  Principles:
    I.   Truthfulness
    II.  Constraint-Aware
    III. Causal-First
    IV.  Minimal
    V.   Debuggable
    VI.  Traceable
    VII. Consistent
    VIII.Conventional
    IX.  Agent-Aware

  Location: .specify/memory/constitution.md
```

On validate:
```
Constitution validation complete!

  Feature:  EP01 - Core Foundation
  Status:   PASS (1 warning)

  Results:
    Pass:     8 principles
    Warning:  1 principle (IV. Minimal)
    Fail:     0 principles

  See: specs/ep01-core-foundation/constitution-check.md
```

## Constitution Alignment

This skill supports:
- **I. Truthfulness**: Honest governance assessment
- **VII. Consistent**: Standardized principles
- **VIII. Conventional**: Standard constitution format
