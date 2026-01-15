# arch-review

> Review implementation against Arc42 architecture documentation

## When to Use

Use this skill when:
- Completing a significant feature
- Before merging architectural changes
- Reviewing code for architecture compliance
- Validating design decisions against documented architecture

## Invocation

```
/arch-review [scope]
```

**Scope options:**
- `feature` - Review current feature branch (default)
- `pr` - Review specific PR
- `commit` - Review specific commit range
- `full` - Full codebase architecture review

## Prerequisites

- Arc42 documentation must exist in `docs/architecture/`
- For feature review: must be on a feature branch
- Git history available for change analysis

## Workflow

### Phase 1: Load Architecture Context

Read Arc42 documentation sections:
- `01-intro-goals.md` - System goals and constraints
- `04-solution-strategy.md` - Key architectural decisions
- `05-building-blocks.md` - Component structure
- `06-runtime.md` - Runtime behavior
- `08-concepts.md` - Cross-cutting concerns
- `09-decisions.md` - Architecture decisions (ADRs)

### Phase 2: Analyze Changes

For feature/PR/commit scope:
```bash
# Get changed files
git diff main..HEAD --name-only

# Get change summary
git diff main..HEAD --stat
```

Categorize changes:
- **New components**: Files in new directories
- **Modified components**: Changes to existing modules
- **Cross-cutting**: Changes affecting multiple areas
- **Configuration**: Config/setup changes

### Phase 3: Architecture Compliance Check

For each changed component, verify against Arc42:

**Building Block View (§5)**
- Does component exist in documented structure?
- Are dependencies as documented?
- Are responsibilities aligned?

**Runtime View (§6)**
- Do flows match documented sequences?
- Are interfaces as specified?
- Are error paths handled?

**Cross-cutting Concepts (§8)**
- Error handling consistent?
- Logging follows patterns?
- Security considerations met?

**Architecture Decisions (§9)**
- ADRs followed?
- New decisions documented?
- Superseded decisions updated?

### Phase 4: Identify Violations

Categorize findings:

**VIOLATION** - Direct contradiction of documented architecture
- Component in wrong layer
- Forbidden dependency
- Bypassing required interface

**DRIFT** - Gradual deviation from architecture
- Undocumented component
- Implicit dependency
- Missing abstraction

**ENHANCEMENT** - Valid extension needing documentation
- New component following patterns
- New capability within bounds
- Performance optimization

### Phase 5: Generate Report

```markdown
# Architecture Review Report

> Feature: EP01 - Core Foundation
> Branch: ep01-core-foundation
> Reviewed: 2026-01-15

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Violations | 0 | ✓ |
| Drift | 2 | ⚠️ |
| Enhancements | 3 | ℹ️ |

**Overall**: PASS (documentation updates needed)

## Changes Analyzed

| File | Category | Arc42 Section |
|------|----------|---------------|
| src/core/analyzer.ts | New | §5.1 Core |
| src/rules/index.ts | Modified | §5.2 Rules |
| src/utils/logger.ts | New | §8.3 Logging |

## Findings

### Drift

**D1: Undocumented utility module**
- Location: `src/utils/logger.ts`
- Issue: New logging utility not in building blocks
- Impact: Low - follows patterns
- Recommendation: Add to §5.3 Utilities

**D2: Implicit dependency**
- Location: `src/rules/index.ts` → `src/utils/`
- Issue: Rules depending on utils not documented
- Impact: Low - reasonable dependency
- Recommendation: Update §5.2 dependency diagram

### Enhancements

**E1: New analyzer component**
- Location: `src/core/analyzer.ts`
- Alignment: Follows §5.1 Core structure
- Recommendation: Document in §5.1.2 Analyzers

[...]

## Recommendations

1. **Required**: Update §5.3 with utils/logger.ts
2. **Required**: Update §5.2 dependency diagram
3. **Suggested**: Add §5.1.2 for analyzer components
4. **Optional**: Consider ADR for logging approach

## Architecture Debt

| Item | Severity | Effort |
|------|----------|--------|
| Utils documentation | Low | 30 min |
| Dependency diagram | Low | 15 min |
```

## Constitution Alignment Mapping

Map constitution principles to Arc42 sections:

| Principle | Arc42 Section |
|-----------|---------------|
| II. Constraint-Aware | §1 Constraints, §2 Context |
| III. Causal-First | §9 Decisions (ADRs) |
| VI. Traceable | §9 Decisions |
| VII. Consistent | §8 Concepts |
| VIII. Conventional | §4 Strategy, §8 Concepts |

## Output

On completion:
```
Architecture review complete!

  Feature:    EP01 - Core Foundation
  Status:     PASS (updates needed)

  Findings:
    Violations:    0
    Drift:         2
    Enhancements:  3

  Arc42 Updates Needed:
    - §5.3 Utilities (add logger)
    - §5.2 Rules (update diagram)
    - §5.1 Core (document analyzer)

  Report: specs/ep01-core-foundation/arch-review.md

Merge approved. Update Arc42 docs in follow-up PR.
```

## Integration with Arc42

This skill reads from these Arc42 sections:

| Section | Purpose |
|---------|---------|
| §1 Introduction | Goals, constraints, stakeholders |
| §4 Solution Strategy | Key decisions and approaches |
| §5 Building Blocks | Component structure |
| §6 Runtime | Behavior and flows |
| §8 Concepts | Cross-cutting concerns |
| §9 Decisions | ADRs |
| §10 Quality | Quality requirements |

## Handoff

After review, suggest:
- Update Arc42 docs for drift items
- Create ADRs for new decisions
- `/dev.integration-check` for final validation
