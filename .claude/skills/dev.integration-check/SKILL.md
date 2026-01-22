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

### Phase 3: Code Quality Checks (ZERO TOLERANCE)

**CRITICAL: The quality bar is absolute. No exceptions.**

Run ALL project validation tools - ALL MUST PASS WITH ZERO ERRORS:

```bash
# Type checking - ZERO errors allowed
bun run typecheck

# Linting - ZERO errors allowed
bun run lint

# Format check - MUST pass
bun run format:check

# Tests - ZERO failures allowed (NEVER use raw `bun test`)
bun run test

# Build - MUST succeed
bun run build
```

Report results (ALL must show ✓):
```markdown
Code Quality (ZERO TOLERANCE):
  ✓ Types: 0 errors (REQUIRED)
  ✓ Lint: 0 errors (REQUIRED)
  ✓ Format: Pass (REQUIRED)
  ✓ Tests: X/X pass, 0 fail (REQUIRED)
  ✓ Build: Pass (REQUIRED)
```

**FAILURE RESPONSE:**
- If ANY check shows errors → FAIL the integration check
- Do NOT proceed to Phase 4 until all errors are fixed
- Do NOT accept "warnings only" - all errors must be zero
- Pre-existing issues are NOT acceptable - fix all identified issues

**Type safety is CRITICAL** - this is why we chose TypeScript:
- TypeScript errors are NOT optional to fix
- ESLint errors are NOT optional to fix
- The quality bar is absolute

### Phase 3.5: Integration Wiring Verification (CRITICAL)

**CRITICAL: Features must be USED, not just BUILT.**

This phase verifies that built components are actually integrated into the system.
A component that compiles and passes tests but is never called is a failed delivery.

#### Step 3.5.1: Exported Symbol Analysis

For each new/modified TypeScript file:
```bash
# Find all exports from changed files
git diff --name-only main...HEAD | grep '\.tsx\?$' | while read file; do
  grep -E "^export (function|const|class|interface|type)" "$file"
done
```

#### Step 3.5.2: Import Verification

For each export, verify it is imported somewhere in src/:
```bash
grep -r "from ['\""].*${module}['\"]" src/ --include="*.ts" --include="*.tsx"
```

**Red Flags (AUTO-FAIL):**
- Exported React component never imported in src/
- Exported function never called anywhere
- Index file exports symbols never imported elsewhere

#### Step 3.5.3: Entry Point Path Verification

For UI components, verify path to entry point:
- Ink components → must reach `render(<Component>)` call
- CLI commands → must be registered in `program.ts`
- Tools → must be registered in tool registry

#### Output Format

```markdown
Integration Wiring:
  Exports Found:    15 symbols across 5 files
  Imports Verified: 12/15 (80%)

  UNINTEGRATED (AUTO-FAIL):
  ✗ App.tsx exports App → NOT IMPORTED
  ✗ Progress.tsx exports Progress → NOT IMPORTED

  Integration Status: FAIL (2 unintegrated exports)
```

**FAILURE RESPONSE:**
- ANY unintegrated export → FAIL the integration check
- This is NOT a warning - unintegrated code is a delivery failure

---

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
| Tasks | ✓ | XX/XX complete (ALL required) |
| Types | ✓ | 0 errors (ZERO tolerance) |
| Lint | ✓ | 0 errors (ZERO tolerance) |
| Tests | ✓ | XX/XX pass, 0 fail |
| Build | ✓ | Pass |
| Wiring | ✓ | X/X exports integrated (ZERO orphans) |
| Acceptance | ✓ | X/X criteria met |
| Constitution | ✓ | All principles pass |
| Linear Sync | ✓ | All synced |

**Overall Status**: READY FOR MERGE (or BLOCKED if ANY errors)

**NOTE**: Any status showing ⚠️ or ✗ for Types, Lint, Tests, or Wiring = BLOCKED.
The quality bar is absolute - we do NOT accept issues or unintegrated code into main.

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
    Wiring:     15/15 ✓
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
