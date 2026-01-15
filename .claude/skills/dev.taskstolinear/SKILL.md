# dev.taskstolinear

> Convert tasks.md into Linear issues with dependencies and epic labels

## When to Use

Use this skill when:
- `tasks.md` has been generated and reviewed
- You're ready to create Linear issues for tracking
- You need to sync task status between tasks.md and Linear

## Invocation

```
/dev.taskstolinear [optional context]
```

## Prerequisites

- Must be on a feature branch (e.g., `ep01-feature-name`)
- `tasks.md` must exist with properly formatted tasks
- Linear project must exist (e.g., `EP01 - Core Foundation`)
- Linear MCP server must be configured

## Workflow

### Phase 0: Validate Prerequisites

```bash
SCRIPT_DIR="$(dirname "$0")/scripts"
source "$SCRIPT_DIR/common.sh"
eval "$(get_feature_paths)"

if [[ ! -f "$TASKS" ]]; then
    echo "Error: tasks.md not found. Run /dev.tasks first."
    exit 1
fi
```

### Phase 1: Connect to Linear

**Step 1.1: Get Team**
```
mcp__linear__get_team({query: "agentlint"})
→ Returns team ID
```

**Step 1.2: Find Project**
```
mcp__linear__list_projects({team: teamId})
→ Find project matching Epic ID (e.g., "EP01 - Core Foundation")
→ ERROR if project not found (must create in Linear UI first)
```

**Step 1.3: Get Status Types**
```
mcp__linear__list_issue_statuses({team: teamId})
→ Build status map by TYPE (not name):
  - unstarted → ready to work
  - started → in progress
  - completed → done
  - canceled → abandoned
```

**CRITICAL**: Never hardcode status names. Different teams use different names.

**Step 1.4: Ensure Epic Label**
```
mcp__linear__list_issue_labels({team: teamId})
→ Check if "epic:EP01" exists
→ If not: mcp__linear__create_issue_label({name: "epic:EP01", teamId: teamId})
```

### Phase 2: Parse Tasks

**Task Format:**
```
- [ ] T### [P?] [US?] Description with file path
```

**Parsing regex:**
```regex
- \[([ xX])\] T(\d+)(?:\s+\[P\])?(?:\s+\[(US\d+)\])?\s+(.+)
```

**Extract for each task:**
- `checkbox`: `[ ]` (pending) or `[x]` (completed)
- `task_id`: T001, T002, etc.
- `parallel`: true if `[P]` present
- `story`: US1, US2, etc. (if present)
- `description`: full task description
- `phase`: from section header
- `dependencies`: parse "depends on T###" from description

### Phase 3: Load/Initialize Mapping

**Mapping file:** `$FEATURE_DIR/.linear-mapping.json`

**Structure:**
```json
{
  "metadata": {
    "feature": "ep01-core-foundation",
    "project": "EP01 - Core Foundation",
    "project_id": "uuid",
    "epic_label": "epic:EP01",
    "created_at": "2026-01-15T00:00:00Z",
    "last_sync": "2026-01-15T00:00:00Z"
  },
  "mappings": {
    "T001": {
      "linear_id": "uuid",
      "linear_identifier": "AGT-123",
      "title": "T001: Create project structure",
      "url": "https://linear.app/agentlint/issue/AGT-123",
      "status": "Todo"
    }
  }
}
```

### Phase 4: Query Existing Issues

```
mcp__linear__list_issues({project: projectId})
→ Get all existing issues in project
→ Match to mapping by title prefix "T###:"
```

### Phase 5: Create New Issues

For each task NOT in mapping:

**Issue title:** `T001: Description` (truncate to ~80 chars)

**Issue description:**
```markdown
**Task ID**: T001
**Phase**: Phase 1 (Setup)
**Parallel**: Yes/No
**User Story**: US1 (if applicable)

**Description**:
{Full task description from tasks.md}

---
Source: tasks.md
Created by: /dev.taskstolinear
```

**Create call:**
```
mcp__linear__create_issue({
  team: teamId,
  project: projectId,
  labels: ["epic:EP01"],
  title: "T001: Description",
  description: descriptionMarkdown,
  state: "Todo"
})
→ Returns {id, identifier, url}
→ Store in mapping
```

### Phase 6: Set Dependencies

**AFTER all issues created**, set blockedBy relations:

For each task with "depends on T###" in description:
```
blockerIds = [mapping[T###].linear_id for each dependency]

mcp__linear__update_issue({
  id: task.linear_id,
  blockedBy: blockerIds
})
```

**Phase dependencies (automatic):**
- Phase 2 tasks block all Phase 3+ tasks
- Each phase N blocks phase N+1 tasks

### Phase 7: Sync Status from Linear

Query current status of all mapped issues:
```
For each mapping:
  mcp__linear__get_issue({id: linear_id})
  → Check status type
  → If completed and tasks.md shows [ ], update to [x]
```

Update `tasks.md` with completed checkboxes.

### Phase 8: Save Mapping

Write updated `.linear-mapping.json` with:
- Updated `last_sync` timestamp
- New mappings for created issues
- Updated status for all issues

## Output

On completion:
```
Linear sync complete!

  Epic:     EP01
  Project:  EP01 - Core Foundation
  Label:    epic:EP01

  Summary:
    Total Tasks:     45
    Issues Created:  40 (AGT-123 to AGT-162)
    Already Synced:  5
    Dependencies:    12 blockedBy relations

  Mapping: specs/ep01-core-foundation/.linear-mapping.json

Next: Run /dev.implement to start working on tasks
```

## Linear MCP Functions Used

| Function | Purpose |
|----------|---------|
| `mcp__linear__get_team` | Get agentlint team ID |
| `mcp__linear__list_projects` | Find epic project |
| `mcp__linear__list_issue_statuses` | Get status type mapping |
| `mcp__linear__list_issue_labels` | Check epic label exists |
| `mcp__linear__create_issue_label` | Create epic label if needed |
| `mcp__linear__list_issues` | Get existing issues |
| `mcp__linear__create_issue` | Create new task issue |
| `mcp__linear__update_issue` | Set blockedBy dependencies |
| `mcp__linear__get_issue` | Check issue status |

## Constitution Alignment

This skill supports:
- **VI. Traceable**: Task IDs map to Linear issues
- **IX. Agent-Aware**: Structured mapping for agent consumption

## Files

- `scripts/common.sh` - Shared utilities
- `.linear-mapping.json` - Created in feature directory

## Handoff

After completing this skill, suggest:
- `/dev.implement` - Start working on tasks from Linear
- View in Linear: `https://linear.app/agentlint/project/{project-id}`
