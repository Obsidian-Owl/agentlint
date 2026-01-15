# dev.integration-check

> Pre-PR validation to ensure feature is ready for review

## When to Use

Use this skill when:
- All tasks for a feature are complete
- Before creating a pull request
- As a final quality gate before merge
- To validate end-to-end functionality

## Invocation

```
/dev.integration-check [options]
```

**Options:**
- `--fix` - Attempt to auto-fix issues
- `--verbose` - Show detailed output

## Prerequisites

- Must be on a feature branch (e.g., `ep01-feature-name`)
- All implementation tasks should be complete
- Code should be committed

## Workflow

### Phase 1: Load Context

```bash
SCRIPT_DIR="$(dirname "$0")/scripts"
source "$SCRIPT_DIR/common.sh"
eval "$(get_feature_paths)"
```

Read:
- `spec.md` - Requirements and acceptance criteria
- `tasks.md` - Verify all tasks completed
- `.linear-mapping.json` - Check Linear status
- `checklists/review.md` - Review criteria

### Phase 2: Task Completion Check

Verify all tasks are done:
```markdown
Task Completion:
  ✓ T001 - Create project structure
  ✓ T002 - Initialize configuration
  ...
  ✗ T045 - Update documentation (INCOMPLETE)

Status: 44/45 tasks complete
```

If incomplete tasks exist, list them and their Linear status.

### Phase 3: Code Quality Checks

Run project validation tools:

```bash
# Type checking (if TypeScript)
npx tsc --noEmit

# Linting
npm run lint

# Tests
npm test

# Build
npm run build
```

Report results:
```markdown
Code Quality:
  ✓ Types pass
  ✓ Lint pass (0 errors, 2 warnings)
  ✓ Tests pass (45/45)
  ✓ Build succeeds
```

### Phase 4: Acceptance Criteria Validation

For each user story in spec.md:
1. List acceptance criteria
2. Map to test results or manual verification
3. Mark pass/fail

```markdown
Acceptance Criteria:

US1: User can analyze code
  ✓ Given valid code, when analyzed, then returns results
  ✓ Given invalid code, when analyzed, then returns error
  ✓ Analysis completes in < 5 seconds

US2: User can export results
  ✓ Given results, when exported, then creates valid JSON
  ✗ Given results, when exported to CSV, then creates valid CSV
    → Not implemented (P2, deferred)
```

### Phase 5: Constitution Compliance

Validate against project principles:

```markdown
Constitution Compliance:

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Truthfulness | ✓ | No misleading outputs |
| II. Constraint-Aware | ✓ | Respects memory limits |
| III. Causal-First | ✓ | Requirements traced |
| IV. Minimal | ✓ | No over-engineering |
| V. Debuggable | ✓ | Logs and errors clear |
| VI. Traceable | ✓ | Task IDs in commits |
| VII. Consistent | ✓ | Follows patterns |
| VIII. Conventional | ✓ | Standard formatting |
| IX. Agent-Aware | ✓ | Structured outputs |
```

### Phase 6: Linear Sync Check

Verify Linear state matches reality:
```
mcp__linear__list_issues({project: projectId})

Linear Sync:
  ✓ All completed tasks marked Done in Linear
  ✓ All closure comments present
  ✗ T045 still "In Progress" but tasks.md shows incomplete
```

### Phase 7: Generate Report

Create comprehensive integration report:

```markdown
# Integration Check Report

> Feature: EP01 - Core Foundation
> Branch: ep01-core-foundation
> Date: 2026-01-15

## Summary

| Category | Status | Details |
|----------|--------|---------|
| Tasks | ⚠️ | 44/45 complete |
| Types | ✓ | Pass |
| Lint | ✓ | Pass |
| Tests | ✓ | 45/45 pass |
| Build | ✓ | Pass |
| Acceptance | ⚠️ | 8/9 criteria met |
| Constitution | ✓ | All principles pass |
| Linear Sync | ✓ | All synced |

**Overall Status**: READY WITH WARNINGS

## Blockers

None

## Warnings

1. Task T045 incomplete - documentation update
2. US2 AC3 deferred to next iteration

## Recommendations

1. Complete T045 or explicitly defer
2. Document deferred criteria in PR description
3. Create follow-up issue for US2 AC3
```

## Output

On completion:
```
Integration check complete!

  Feature:    EP01 - Core Foundation
  Status:     READY WITH WARNINGS

  Summary:
    Tasks:      44/45 ✓
    Types:      Pass ✓
    Lint:       Pass ✓
    Tests:      45/45 ✓
    Build:      Pass ✓
    Acceptance: 8/9 ⚠️
    Constitution: Pass ✓
    Linear:     Synced ✓

  Warnings: 2
    - T045 incomplete
    - US2 AC3 deferred

  Report: specs/ep01-core-foundation/integration-report.md

Ready for PR with noted warnings.
```

## Constitution Alignment

This skill supports:
- **I. Truthfulness**: Honest quality assessment
- **V. Debuggable**: Clear failure reporting
- **VII. Consistent**: Standardized checks
- **IX. Agent-Aware**: Structured validation

## Handoff

After passing checks, suggest:
- `/dev.pr` - Create pull request with Linear integration
- `/arch-review` - If significant architecture changes made
