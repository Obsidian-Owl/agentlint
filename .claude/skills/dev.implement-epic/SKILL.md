# dev.implement-epic

> Implement ALL tasks in the current epic until completion (auto-loop, no confirmation). Use when batch processing tasks, automating implementation, or running unattended task completion.

## When to Use

Use this skill when:
- You want to implement an entire epic without confirmation between tasks
- You're running batch/unattended implementation
- You want automatic recovery after context compaction

Use `/dev.implement` instead if you want manual confirmation between tasks.

## Invocation

```
/dev.implement-epic [arguments]
```

**Stops only when:**
1. ALL tasks are Done (success)
2. A task is BLOCKED (requires human intervention)
3. Context window compacts (CLAUDE.md will instruct to continue)

---

## CRITICAL: Spec Context Loading (MANDATORY)

**You MUST load ALL spec artifacts into context and KEEP THEM LOADED throughout the entire epic.**

This is NON-NEGOTIABLE. Implementation without full spec context leads to:
- Deviations from agreed design
- Missing requirements
- Inconsistent architecture decisions
- Wasted rework

### Required Artifacts (Load All, Keep All)

| Artifact | Purpose | Location |
|----------|---------|----------|
| **spec.md** | Feature requirements, acceptance criteria | `$FEATURE_DIR/spec.md` |
| **plan.md** | Architecture decisions, component design | `$FEATURE_DIR/plan.md` |
| **tasks.md** | Task breakdown with dependencies | `$FEATURE_DIR/tasks.md` |
| **research.md** | Technology research, patterns (if exists) | `$FEATURE_DIR/research.md` |
| **data-model.md** | Schema design, contracts (if exists) | `$FEATURE_DIR/data-model.md` |
| **contracts/** | Contract definitions (if exists) | `$FEATURE_DIR/contracts/*.md` |
| **.linear-mapping.json** | Task-to-Linear ID mappings | `$FEATURE_DIR/.linear-mapping.json` |
| **constitution.md** | Project principles | `.specify/memory/constitution.md` |

### Loading Protocol

**At the START of epic auto-mode (before any task):**

```bash
# 1. Run prerequisites check
.claude/skills/dev.tasks/scripts/check-prerequisites.sh --json

# 2. Parse JSON for FEATURE_DIR

# 3. Load ALL spec artifacts (use Read tool for each)
Read: $FEATURE_DIR/spec.md
Read: $FEATURE_DIR/plan.md
Read: $FEATURE_DIR/tasks.md
Read: $FEATURE_DIR/research.md       # if exists
Read: $FEATURE_DIR/data-model.md     # if exists
Read: $FEATURE_DIR/contracts/*.md    # if exists
Read: .specify/memory/constitution.md
```

**After EVERY context compaction**: Re-read ALL artifacts immediately. The summary WILL lose critical details. This is your FIRST action after recovery.

---

## Setup

1. **Create state file** (for recovery after compaction):
   ```bash
   mkdir -p .agent
   ```

   Write JSON state file:
   ```json
   {
     "mode": "epic-auto",
     "feature_dir": "{FEATURE_DIR from prerequisites}",
     "epic_name": "{basename of feature_dir}",
     "branch": "{current git branch}",
     "started_at": "{ISO timestamp}",
     "total_tasks": "{count from .linear-mapping.json}",
     "completed_before_compact": 0,
     "compaction_count": 0
   }
   ```

   Save to `.agent/epic-auto-mode`

2. **Run prerequisite checks**:
   - Run `.claude/skills/dev.tasks/scripts/check-prerequisites.sh --json`
   - Parse JSON output for `FEATURE_DIR`
   - Verify `.linear-mapping.json` exists in FEATURE_DIR (run `/dev.taskstolinear` if missing)

3. **Output banner**:
   ```
   ================================================================================
   EPIC AUTO-MODE STARTING
   ================================================================================
   Feature: {feature-name}
   Tasks: {total-count}

   Mode: Auto-continue (no confirmation between tasks)
   Recovery: .agent/epic-auto-mode
   ================================================================================
   ```

---

## Process Loop

**Repeat until ALL tasks complete or BLOCKED:**

### Step 1: Find Next Ready Task

- Load `$FEATURE_DIR/.linear-mapping.json` for task-to-Linear mappings
- For each task in mapping, query Linear via `mcp__linear__get_issue` for current status
- Build ready list: issues with status type `unstarted` or `backlog`
- If no ready tasks:
  - Check if all tasks have status type `completed`: → "EPIC COMPLETE"
  - Otherwise check for blocked tasks: → "EPIC BLOCKED"

### Step 2: Output Progress Marker

```
[EPIC-AUTO-MODE] Task: {TaskID} ({LinearID}) | Remaining: {count} | {title}
```

### Step 3: Claim Task

- Query team statuses via `mcp__linear__list_issue_statuses` (team from Linear config)
- Update Linear via `mcp__linear__update_issue`:
  - `id`: Linear issue ID
  - `state`: "In Progress"
  - `assignee`: "me"

### Step 4: Load Context (CRITICAL - See "Spec Context Loading" above)

- **Load ALL spec artifacts** per the CRITICAL section above
- **This is NON-NEGOTIABLE** - do NOT proceed without full context
- Use Explore subagents for codebase understanding
- **After compaction recovery**: This step is your FIRST action - re-read ALL artifacts

### Step 5: Implement

- Follow constitution principles
- Implement per task description from tasks.md
- Use project's existing patterns and tooling
- Reference spec.md and plan.md continuously

### Step 6: Validate

Run ALL checks - ALL MUST PASS:
- `bun test` - Tests pass (zero failures)
- `bun run typecheck` - Types pass (zero errors)
- `bun run lint` - Lint pass (zero errors)
- `bun run format:check` - Format pass

**If validation fails**: Fix issues before proceeding (do NOT skip)

### Step 7: Close Task

- Query statuses, find status with type `completed` (usually "Done")
- Update Linear status via `mcp__linear__update_issue`
- **MANDATORY**: Create Linear comment via `mcp__linear__create_comment`:
  ```
  **Completed**: {TaskID}
  **Summary**: {what was implemented}
  **Commit**: {commit hash}
  **Files Changed**: {key files}
  ---
  *Closed via /dev.implement-epic*
  ```
- Update tasks.md checkbox: `- [ ]` → `- [x]`
- Update `.linear-mapping.json` with status and completed_at
- Commit changes: `{type}(scope): {title} ({TaskID}, {LinearID})`

### Step 8: Update State File

Update `.agent/epic-auto-mode` with progress:
```json
{
  "last_task": "{TaskID}",
  "last_linear_id": "{LinearID}",
  "completed_before_compact": {current completed count}
}
```

### Step 9: Auto-Continue

**NO confirmation prompt** - Loop back to Step 1 immediately.

---

## Completion States

### EPIC COMPLETE

When all tasks have status type `completed`:

**CRITICAL: Remove state file IMMEDIATELY before any other output:**
```bash
rm -f .agent/epic-auto-mode
```

**Why first?** If compaction happens after the banner but before cleanup, the file would still exist and Claude would try to resume. Removing first ensures clean state.

Then output the completion banner:
```
================================================================================
EPIC COMPLETE
================================================================================

Feature: {feature-name}
Tasks completed: {count}
Total commits: {count}

Epic auto-mode has ended. State file removed.

Next steps:
  1. /dev.integration-check - Validate integration
  2. /dev.pr - Create pull request
================================================================================
```

### EPIC BLOCKED

If any task has non-empty `blockedBy` relation or encounters unrecoverable error:

```
================================================================================
EPIC BLOCKED
================================================================================

Task: {TaskID} ({LinearID})
Reason: {blocked-by issues or error description}

To resume after resolving:
  /dev.implement-epic

State saved in: .agent/epic-auto-mode
================================================================================
```

**Do NOT remove state file** - allows resume after resolution.

---

## Context Recovery

After compaction, Claude automatically recovers via **CLAUDE.md instructions** (which survive compaction verbatim).

### How It Works

1. **Compaction occurs** - conversation summarized, but files survive
2. **CLAUDE.md is reloaded** from disk (verbatim, not summarized)
3. **CLAUDE.md instructs Claude** to check for `.agent/epic-auto-mode`
4. **If file exists**, Claude reads state and **continues implementing automatically**

### State File Contents

```json
{
  "mode": "epic-auto",
  "feature_dir": "specs/ep01-feature-name",
  "epic_name": "ep01-feature-name",
  "branch": "ep01-feature-name",
  "started_at": "2026-01-17T10:30:00Z",
  "last_task": "T005",
  "last_linear_id": "AGT-123",
  "total_tasks": 15,
  "completed_before_compact": 4,
  "compaction_count": 1
}
```

### Recovery Behavior

**Claude MUST NOT ask the user "should I continue?"** - the existence of the state file IS the user's instruction to continue automatically.

After compaction, Claude:
1. Reads `.agent/epic-auto-mode` for recovery state
2. **IMMEDIATELY re-reads ALL spec artifacts** (spec.md, plan.md, tasks.md, etc.)
3. Queries Linear for current task status
4. Finds next ready task
5. **Resumes implementation immediately** without prompting

**CRITICAL**: Step 2 (reloading spec artifacts) is NON-NEGOTIABLE. The compaction summary WILL lose critical design details. You MUST re-read the full files to maintain implementation quality.

---

## Quality Bar (NON-NEGOTIABLE)

Same as `/dev.implement`:
- Zero TypeScript errors allowed
- Zero ESLint errors allowed
- All tests must pass
- Fix issues locally, do NOT pass to CI

---

## Linear MCP Functions Used

| Function | Purpose | When |
|----------|---------|------|
| `mcp__linear__list_issue_statuses` | Get status type mapping | Step 1, 3, 7 |
| `mcp__linear__list_issues` | Find project tasks | Step 1 |
| `mcp__linear__get_issue` | Check blockedBy relations | Step 1 |
| `mcp__linear__update_issue` | Claim task (In Progress) | Step 3 |
| `mcp__linear__create_comment` | **MANDATORY** closure comment | Step 7 |
| `mcp__linear__update_issue` | Close task (Done) | Step 7 |

---

## Key Differences from /dev.implement

| Aspect | /dev.implement | /dev.implement-epic |
|--------|----------------|---------------------|
| Confirmation | Asks after each task | Never asks |
| State file | None | `.agent/epic-auto-mode` |
| Recovery | Manual re-run | CLAUDE.md hook detects |
| Use case | Single task or interactive | Batch processing |

---

## Error Handling

| Error | Cause | Behavior |
|-------|-------|----------|
| No ready tasks | All blocked or done | Check completion vs blocked |
| Task blocked | Dependency not complete | Stop with BLOCKED message |
| Validation fails | Tests/lint fail | Fix in-place, don't skip |
| API error | Linear/network issue | Retry once, then BLOCKED |

---

## Constitution Alignment

This skill supports:
- **III. Causal-First**: Implementation traces to task and requirements
- **V. Debuggable**: Closure comments provide audit trail
- **VI. Traceable**: Task ID in commit messages, Linear comments
- **IX. Agent-Aware**: Structured workflow for agent execution

---

## Handoff

After completing this skill:
- **Check integration**: Run `/dev.integration-check` before PR
- **Create PR**: Run `/dev.pr` to create pull request with Linear links
