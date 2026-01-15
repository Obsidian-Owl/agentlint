# dev.pr

> Create a pull request with quality validation and Linear integration

## When to Use

Use this skill when:
- All implementation tasks are complete
- `dev.integration-check` has passed
- You're ready to submit work for review

## Invocation

```
/dev.pr [optional: --draft]
```

**Options:**
- `--draft` - Create as draft PR

## Prerequisites

- Must be on a feature branch (e.g., `ep01-feature-name`)
- All tasks should be complete (or explicitly deferred)
- Branch should have commits to push
- `gh` CLI must be authenticated

## Workflow

### Phase 0: Load Context

```bash
SCRIPT_DIR="$(dirname "$0")/scripts"
source "$SCRIPT_DIR/common.sh"
eval "$(get_feature_paths)"
```

Load feature artifacts:
- `spec.md` - For PR description
- `tasks.md` - For completion summary
- `.linear-mapping.json` - For Linear issue links
- `integration-report.md` - For quality summary (if exists)

### Phase 1: Pre-PR Validation

**Step 1.1: Check Branch State**
```bash
# Verify on feature branch
git rev-parse --abbrev-ref HEAD

# Check for uncommitted changes
git status --porcelain

# Check if ahead of remote
git rev-list --count origin/$(git rev-parse --abbrev-ref HEAD)..HEAD
```

**Step 1.2: Verify Task Completion**

Query Linear for task status:
```
mcp__linear__list_issues({project: projectId})
→ Check all issues have status type "completed"
→ List any incomplete tasks
```

If incomplete tasks exist, prompt user:
```
Warning: 3 tasks still incomplete in Linear:
  - AGT-142: Update documentation (In Progress)
  - AGT-143: Add integration tests (Todo)
  - AGT-144: Performance optimization (Todo)

Options:
  [1] Continue anyway (will note in PR)
  [2] Abort and complete tasks first
```

**Step 1.3: Run Quality Checks**
```bash
# Type check (if applicable)
npm run typecheck || pnpm typecheck || true

# Lint
npm run lint || pnpm lint || true

# Tests
npm test || pnpm test || true

# Build
npm run build || pnpm build || true
```

Report any failures but allow user to proceed.

### Phase 2: Prepare PR Content

**Step 2.1: Generate Title**

Format: `{Epic ID}: {Feature Name}`

Extract from:
- Branch name: `ep01-core-foundation` → `EP01`
- spec.md title: `Feature Specification: Core Foundation`

Result: `EP01: Core Foundation`

**Step 2.2: Build Description**

```markdown
## Summary

{Extract from spec.md Section 1 - Overview}

## Changes

{List key changes from tasks.md phases}

### Phase 1: Setup
- [x] T001: Created project structure
- [x] T002: Initialized configuration

### Phase 2: Implementation
- [x] T010: Implemented core analyzer
...

## Test Plan

{Extract from spec.md acceptance criteria}

- [x] Given valid input, analyzer returns results
- [x] Given invalid input, returns appropriate error
- [x] Performance: < 5s for typical codebase

## Linear Issues

- Project: [EP01 - Core Foundation](https://linear.app/agentlint/project/...)
- Issues: AGT-101 to AGT-145

## Quality Checks

| Check | Status |
|-------|--------|
| Types | ✓ Pass |
| Lint | ✓ Pass |
| Tests | ✓ 45/45 |
| Build | ✓ Pass |

---

Generated with [Claude Code](https://claude.com/claude-code)
```

**Step 2.3: Prepare Labels**

- `epic:EP01` (from epic ID)
- Additional labels based on content (e.g., `feature`, `enhancement`)

### Phase 3: Create PR

**Step 3.1: Push Branch**
```bash
# Push with upstream tracking
git push -u origin $(git rev-parse --abbrev-ref HEAD)
```

**Step 3.2: Create PR via gh**
```bash
gh pr create \
  --title "EP01: Core Foundation" \
  --body "$(cat pr-description.md)" \
  --label "epic:EP01"
```

For draft:
```bash
gh pr create --draft ...
```

**Step 3.3: Capture PR URL**
```bash
gh pr view --json url -q '.url'
```

### Phase 4: Post-PR Actions

**Step 4.1: Update Linear Issues**

For each task in mapping, add PR link:
```
mcp__linear__update_issue({
  id: task.linear_id,
  links: [{
    title: "Pull Request",
    url: pr_url
  }]
})
```

**Step 4.2: Add Comment to Linear Project**
```
mcp__linear__create_comment({
  issueId: first_task_linear_id,
  body: `
## PR Created

Pull request submitted for review:
${pr_url}

**Tasks included**: ${task_count} issues
**Status**: Ready for review

---
*Created via /dev.pr*
  `
})
```

## Output

On completion:
```
PR created successfully!

  Title:    EP01: Core Foundation
  URL:      https://github.com/owner/repo/pull/123
  Status:   Ready for review

  Branch:   ep01-core-foundation
  Commits:  15 commits ahead of main

  Linear:
    Project:  EP01 - Core Foundation
    Issues:   45 tasks linked
    PR Link:  Added to all issues

  Quality:
    Types:    ✓ Pass
    Lint:     ✓ Pass
    Tests:    ✓ 45/45
    Build:    ✓ Pass

Next steps:
  1. Review PR at: https://github.com/owner/repo/pull/123
  2. Address review feedback
  3. Merge when approved
```

## Error Handling

| Error | Recovery |
|-------|----------|
| Not on feature branch | Switch to feature branch first |
| Uncommitted changes | Commit or stash changes |
| gh not authenticated | Run `gh auth login` |
| Push rejected | Pull and resolve conflicts |
| Linear issues incomplete | Complete tasks or proceed with warning |

## Constitution Alignment

This skill supports:
- **VI. Traceable**: PR links to Linear issues, tasks trace to requirements
- **V. Debuggable**: Quality checks documented in PR
- **VII. Consistent**: Standard PR format across features

## Files

- `scripts/common.sh` - Shared utilities

## Handoff

After PR creation:
- Monitor PR for review feedback
- Address comments via additional commits
- When approved, merge and close Linear issues
