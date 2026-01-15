# dev.implement

> Execute tasks from Linear with proper claiming, implementation, and closure

## When to Use

Use this skill when:
- Linear issues have been created via `/dev.taskstolinear`
- You're ready to implement a specific task
- You need to claim, work on, and close a task properly

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

### Phase 2: Claim Task

**Step 2.1: Validate Selection**
- Parse user input (number, T###, or AGT-###)
- Find in mapping
- Check not blocked via `mcp__linear__get_issue({id, includeRelations: true})`

**Step 2.2: Update Linear Status**
```
mcp__linear__update_issue({
  id: linear_id,
  state: "In Progress",  // Use actual status name from type mapping
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

### Phase 3: Implementation

During implementation, the agent should:

1. **Reference design artifacts**
   - Read `spec.md` for requirements
   - Read `plan.md` for technical approach
   - Read `data-model.md` for entity definitions
   - Read `contracts/` for API definitions

2. **Follow task description**
   - Implement exactly what the task specifies
   - Use file paths from task description
   - Follow project conventions

3. **Validate work**
   - Run tests if applicable
   - Check types/lint
   - Verify acceptance criteria

4. **Constitution compliance**
   - Ensure implementation follows project principles
   - Document any necessary complexity

### Phase 4: Close Task

**Step 4.1: Validate Completion**
- Verify implementation is complete
- Run validation checks (tests, lint, types)
- Confirm with user if needed

**Step 4.2: Create Closure Comment (MANDATORY)**
```
mcp__linear__create_comment({
  issueId: linear_id,
  body: `
**Completed**: T001
**Summary**: Created project directory structure with src/, tests/, docs/ folders

**Files Changed**:
- src/index.ts (new)
- src/types/index.ts (new)
- tests/setup.ts (new)

**Commit**: abc123 (or "See latest commit")

---
*Closed via /dev.implement*
  `
})
```

**Step 4.3: Update Linear Status**
```
mcp__linear__update_issue({
  id: linear_id,
  state: "Done"  // Use actual status name from type mapping
})
```

**Step 4.4: Update tasks.md**
```
Change: - [ ] T001 ...
To:     - [x] T001 ...
```

**Step 4.5: Update Mapping**
```json
"T001": {
  ...
  "status": "Done",
  "completed_at": "2026-01-15T12:00:00Z"
}
```

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

  Status:     Done
  Comment:    Added closure summary
  tasks.md:   Updated checkbox

  Next ready tasks:
    1. T002 [AGT-124] Initialize configuration files
    2. T003 [AGT-125] Create base types

Run /dev.implement to claim next task.
```

## Linear MCP Functions Used

| Function | Purpose |
|----------|---------|
| `mcp__linear__list_issue_statuses` | Get status type mapping |
| `mcp__linear__list_issues` | Find ready tasks |
| `mcp__linear__get_issue` | Check blockedBy relations |
| `mcp__linear__update_issue` | Claim task, close task |
| `mcp__linear__create_comment` | Mandatory closure comment |

## Constitution Alignment

This skill supports:
- **III. Causal-First**: Implementation traces to task and requirements
- **V. Debuggable**: Closure comments provide audit trail
- **VI. Traceable**: Task ID in commit messages
- **IX. Agent-Aware**: Structured workflow for agent execution

## Files

- `scripts/common.sh` - Shared utilities
- `.linear-mapping.json` - Read for task lookup, updated on close
- `tasks.md` - Updated checkbox on close

## Handoff

After completing tasks, suggest:
- `/dev.implement` - Continue with next task
- `/dev.analyze` - Validate implementation quality
- `/dev.integration-check` - Pre-PR validation
