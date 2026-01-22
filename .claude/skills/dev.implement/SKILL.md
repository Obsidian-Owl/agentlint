# dev.implement

> Execute Linear tasks with mandatory claiming, implementation validation, and closure documentation. Use when tasks exist in Linear (via /dev.taskstolinear) and you're ready to implement. Ensures full traceability through closure comments, status updates, and linked commits.

## When to Use

Use this skill when:
- Linear issues have been created via `/dev.taskstolinear`
- You're ready to implement a specific task
- You need to claim, work on, and close a task properly
- **CRITICAL**: After implementing ANY task, you MUST complete Phase 4 closure

## Invocation

```
/dev.implement [task selector]
```

**Task selectors:**
- `T001` - Task ID from tasks.md
- `AGT-123` - Linear identifier
- `1` - Task number (first ready task)
- (empty) - Auto-select first ready task

## Prerequisites

- Must be on a feature branch (e.g., `ep01-feature-name`)
- `.linear-mapping.json` must exist (run `/dev.taskstolinear` first)
- Linear MCP server must be configured

---

## Workflow

### Phase 0: Load Context

```bash
SCRIPT_DIR="$(dirname "$0")/scripts"
source "$SCRIPT_DIR/common.sh"
eval "$(get_feature_paths)"

# Load mapping
MAPPING_FILE="$FEATURE_DIR/.linear-mapping.json"
if [[ ! -f "$MAPPING_FILE" ]]; then
    echo "Error: No Linear mapping. Run /dev.taskstolinear first."
    exit 1
fi
```

**GATE**: Cannot proceed without valid `.linear-mapping.json`

---

### Phase 1: Find Ready Tasks

**Step 1.1: Get Status Types**
```
mcp__linear__list_issue_statuses({team: teamId})
→ Build status map by TYPE
→ Find "unstarted" and "started" status IDs
```

**Step 1.2: Query Project Issues**
```
mcp__linear__list_issues({project: projectId})
→ Filter for status type = "unstarted" (ready to work)
→ Check blockedBy relations (exclude blocked tasks)
```

**Step 1.3: Display Ready Tasks**
```
Ready Tasks for EP01:
  1. T001 [AGT-123] Create project structure
  2. T002 [AGT-124] Initialize configuration files
  3. T005 [AGT-127] Implement base types (blocked by T003, T004)

Enter task number, Task ID (T001), or Linear ID (AGT-123):
```

---

### Phase 2: Claim Task

**Step 2.1: Validate Selection**
- Parse user input (number, T###, or AGT-###)
- Find in mapping
- Check not blocked via `mcp__linear__get_issue({id, includeRelations: true})`

**Step 2.2: Update Linear Status (REQUIRED)**

You MUST update Linear status before proceeding:

```
mcp__linear__update_issue({
  id: linear_id,
  state: "In Progress",
  assignee: "me"
})
```

**Step 2.3: Display Task Context**
```
Claimed: T001 [AGT-123]
=========================================

Phase: Phase 1 (Setup)
User Story: US1 (if applicable)
Linear: https://linear.app/agentlint/issue/AGT-123

Description:
{Full task description from tasks.md}

Related Files:
- spec.md: {key requirements}
- plan.md: {relevant design decisions}
- data-model.md: {entities if applicable}

Ready to implement. Use /dev.implement close when done.
```

**GATE**: Cannot proceed to Phase 3 until Linear shows "In Progress"

---

### Phase 3: Implementation

During implementation, the agent MUST:

1. **Reference design artifacts**
   - Read `spec.md` for requirements
   - Read `plan.md` for technical approach
   - Read `data-model.md` for entity definitions
   - Read `contracts/` for API definitions

2. **Follow task description**
   - Implement exactly what the task specifies
   - Use file paths from task description
   - Follow project conventions

2.5. **Write appropriate tests** (see [dev.testing](../dev.testing/SKILL.md))
   - Deterministic code → Unit tests in `tests/unit/`
   - LLM interactions → VCR tests in `tests/integration/`
   - Behavioral quality → Eval scenarios in `tests/evals/` (release-gate)

   **Red flags** (use evals, not unit tests):
   - Testing what an LLM responds
   - Testing if agent "did the right thing"
   - Testing recommendation quality

3. **Validate work (REQUIRED before closure - ALL MUST PASS)**
   - Run tests: `bun run test` (must pass - **zero failures**) - NEVER use raw `bun test`
   - Check types: `bun run typecheck` (must pass - **zero errors**)
   - Check lint: `bun run lint` (must pass - **zero errors**)
   - Check format: `bun run format:check` (must pass)
   - Verify acceptance criteria from task description

4. **Constitution compliance**
   - Ensure implementation follows project principles
   - Document any necessary complexity

---

## ⚠️ QUALITY BAR - NON-NEGOTIABLE

**Type safety is CRITICAL** - this is why we chose TypeScript:
- Zero TypeScript errors allowed
- Zero ESLint errors allowed
- All tests must pass

**We do NOT pass issues to CI - we fix them locally:**
- Pre-existing issues are NOT acceptable - fix all identified issues
- Issues discovered during implementation MUST be fixed before closure
- The pre-commit hook runs `typecheck`, `lint`, and `format:check`
- The pre-push hook runs the full CI suite

**The quality bar is absolute:**
- No exceptions for "minor" issues
- No deferring type errors to later
- No "it works locally" without passing all checks

---

**GATE**: Cannot proceed to Phase 4 until ALL validation checks pass with ZERO errors

---

### Phase 4: Close Task (MANDATORY - ALL STEPS REQUIRED)

**CRITICAL**: You MUST complete ALL steps below for EVERY task. DO NOT skip any step. Incomplete closure breaks traceability and audit trails.

#### Step 4.1: Validate Completion

Before closing, verify:
- [ ] Implementation matches task description
- [ ] Tests pass
- [ ] Types/lint pass
- [ ] Code is committed

#### Step 4.2: Create Closure Comment (MANDATORY - NON-NEGOTIABLE)

**You MUST create a closure comment on the Linear issue.** This is REQUIRED for:
- Audit trail of implementation
- Traceability per Constitution Principle VI
- Future reference on what was changed

```
mcp__linear__create_comment({
  issueId: linear_id,
  body: `**Completed**: T001

**Summary**: [1-2 sentence description of what was implemented]

**Files Changed**:
- path/to/file.ts (new|modified|deleted)
- path/to/other.ts (new|modified|deleted)

**Validation**:
- Tests: Pass (X tests)
- Types: Pass
- Lint: Pass

---
*Closed via /dev.implement*`
})
```

**DO NOT proceed to Step 4.3 until closure comment is created.**

#### Step 4.3: Update Linear Status (MANDATORY)

```
mcp__linear__update_issue({
  id: linear_id,
  state: "Done"
})
```

**Verify** the issue now shows "Done" status.

#### Step 4.4: Update tasks.md (MANDATORY)

```
Change: - [ ] T001 ...
To:     - [x] T001 ...
```

#### Step 4.5: Update Mapping (MANDATORY)

```json
"T001": {
  ...
  "status": "Done",
  "completed_at": "2026-01-15T12:00:00Z"
}
```

---

## Completion Verification Checklist

After closing a task, verify ALL items:

| Step | Action | Verified |
|------|--------|----------|
| 4.2 | Closure comment created in Linear | [ ] |
| 4.3 | Linear status = "Done" | [ ] |
| 4.4 | tasks.md checkbox = [x] | [ ] |
| 4.5 | .linear-mapping.json updated | [ ] |
| — | Commit includes (TaskID, LinearID) | [ ] |

**If ANY item is unchecked, the task is NOT complete. Go back and complete it.**

---

## Commit Message Format

When committing implementation work:

```
{type}({scope}): {description} ({TaskID}, {LinearID})
```

**Examples:**
```
feat(core): add base type definitions (T001, AGT-123)
fix(parser): handle empty input edge case (T015, AGT-137)
test(core): add unit tests for TypeResolver (T020, AGT-142)
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `test` - Tests
- `docs` - Documentation
- `refactor` - Code restructuring
- `chore` - Maintenance

---

## Output

On task claim:
```
Claimed: T001 [AGT-123]

  Status:     In Progress
  Assignee:   You
  Phase:      Phase 1 (Setup)

  Description:
  Create project directory structure per plan.md

  Begin implementation. Run /dev.implement close when done.
```

On task close:
```
Completed: T001 [AGT-123]

  Closure Steps:
  [x] Comment added to Linear
  [x] Status updated to Done
  [x] tasks.md checkbox updated
  [x] Mapping file updated

  Next ready tasks:
    1. T002 [AGT-124] Initialize configuration files
    2. T003 [AGT-125] Create base types

Run /dev.implement to claim next task.
```

---

## Error Handling

| Scenario | Recovery |
|----------|----------|
| Task is blocked | Select a different unblocked task |
| Validation fails | Fix issues, re-run validation, then proceed |
| Acceptance criteria unclear | Ask user via AskUserQuestion before implementing |
| Linear MCP unavailable | Check network, verify MCP config, retry |
| Closure comment fails | Verify Linear auth, check issue ID, retry |
| Status update fails | Check issue ID, verify permissions, retry |

---

## Linear MCP Functions Used

| Function | Purpose | When |
|----------|---------|------|
| `mcp__linear__list_issue_statuses` | Get status type mapping | Phase 1 |
| `mcp__linear__list_issues` | Find ready tasks | Phase 1 |
| `mcp__linear__get_issue` | Check blockedBy relations | Phase 2 |
| `mcp__linear__update_issue` | Claim task (In Progress) | Phase 2 |
| `mcp__linear__create_comment` | **MANDATORY** closure comment | Phase 4.2 |
| `mcp__linear__update_issue` | Close task (Done) | Phase 4.3 |

---

## Constitution Alignment

This skill supports:
- **III. Causal-First**: Implementation traces to task and requirements
- **V. Debuggable**: Closure comments provide audit trail
- **VI. Traceable**: Task ID in commit messages, Linear comments
- **IX. Agent-Aware**: Structured workflow for agent execution

---

## Files

- `scripts/common.sh` - Shared utilities
- `.linear-mapping.json` - Read for task lookup, updated on close
- `tasks.md` - Updated checkbox on close

---

## Handoff

After completing tasks, suggest:
- `/dev.implement` - Continue with next task
- `/dev.analyze` - Validate implementation quality
- `/dev.integration-check` - Pre-PR validation
