# dev.tasks

> Generate implementation tasks from feature design artifacts

## Goal

Break down a planned feature into actionable implementation tasks. Tasks should be concrete enough to implement, properly ordered, and traceable to requirements. After task generation, the implementation path should be clear.

## Success Criteria

- Tasks cover all requirements from spec
- Tasks are concrete and actionable (not vague)
- Dependencies are clear and reasonable
- Agent can explain the task breakdown rationale
- MVP scope is identifiable

## Capabilities Available

**Scripts:**
```bash
# Get feature paths and validate
source "$(dirname "$0")/scripts/common.sh"
eval "$(get_feature_paths)"

# Check prerequisites
bash "$(dirname "$0")/scripts/check-prerequisites.sh" --json
```

**Files:**
- `$FEATURE_SPEC` - User stories and requirements
- `$IMPL_PLAN` - Technical approach and design
- `$FEATURE_DIR/data-model.md` - Entity definitions (if exists)
- `$FEATURE_DIR/contracts/` - API definitions (if exists)
- `templates/tasks-template.md` - Task structure (use as guide)

**Tools:**
- Read tool for spec, plan, and design docs
- Write tool to create tasks.md
- Grep/Glob for understanding existing code structure

## Agent Reasons About

- **How to decompose?** - What's the right granularity for THIS feature?
- **What order?** - What depends on what? What enables parallelism?
- **What's MVP?** - What's the minimal set to deliver value?
- **What phases make sense?** - Not a rigid structure, but logical groupings
- **How detailed?** - More complex features may need finer-grained tasks

## Patterns That Often Help

**Task decomposition:**
- Start from user stories and requirements, not arbitrary phases
- Each task should be completable in a reasonable work session
- Tasks should be independently verifiable (testable)
- Include file paths when known—helps implementation

**Ordering and dependencies:**
- Foundation before features (types, utilities first)
- Tests can often be written before implementation
- Within a feature, model → service → endpoint is common
- Mark tasks that can run in parallel

**Task format (suggested, not rigid):**
```markdown
- [ ] T### [Context] Description with file path if known
```
- Sequential IDs help tracking
- Context like [P] for parallel, [US1] for story reference
- File paths help implementation and reduce ambiguity

**MVP identification:**
- P1 user stories typically define MVP
- Setup and foundation are usually required
- Be explicit about what's in vs out of MVP

**For agentic applications:**
- Separate tool implementation tasks from integration tasks
- Tools should be testable in isolation
- Don't create tasks for "agent orchestration logic"—that's agent reasoning

## Workflow Guidance

This is a suggested flow, not a rigid sequence.

1. **Load context** - Read spec, plan, and design docs
2. **Understand requirements** - What needs to be built?
3. **Identify structure** - What logical phases or groups?
4. **Generate tasks** - Concrete, actionable, with dependencies
5. **Identify MVP** - What's the minimal valuable set?
6. **Review coverage** - Do tasks cover all requirements?

## Output

On success, create `tasks.md` with:
- Header with metadata (epic, date, counts)
- Summary of phases/groups
- Tasks grouped logically
- Checkpoints between major phases
- MVP scope section

Communicate to user:
- Total task count and MVP count
- Phase breakdown
- Any coverage gaps or concerns
- Suggested next step (usually /dev.taskstolinear)

## Constitution Alignment

This skill supports:
- **III. Causal-First**: Tasks trace to requirements
- **IV. Minimal**: MVP scope clearly defined
- **VI. Traceable**: Task IDs enable tracking
- **IX. Agent-Aware**: Structured for agent execution

## Handoff

After completing, suggest based on context:
- `/dev.taskstolinear` - To create Linear issues
- `/dev.plan` - If tasks reveal missing design elements
- `/dev.analyze tasks` - Optional validation before Linear sync
