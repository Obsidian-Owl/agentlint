# dev.analyze

> Analyze artifact quality and cross-artifact consistency

## Goal

Assess the quality and consistency of feature artifacts (spec, plan, tasks). Identify issues that would cause problems during implementation. This is a read-only analysis—it identifies issues but doesn't fix them.

## Success Criteria

- Issues that would block or confuse implementation are identified
- Agent can explain why each issue matters
- Severity is appropriate (not everything is an error)
- Cross-artifact inconsistencies are caught
- Report is actionable—clear what to fix

## Capabilities Available

**Scripts:**
```bash
# Get feature paths
source "$(dirname "$0")/scripts/common.sh"
eval "$(get_feature_paths)"
# $FEATURE_SPEC, $IMPL_PLAN, $TASKS, $FEATURE_DIR available
```

**Files:**
- `$FEATURE_SPEC` - Specification
- `$IMPL_PLAN` - Implementation plan
- `$TASKS` - Task breakdown
- `$FEATURE_DIR/` - All feature artifacts
- `.specify/memory/constitution.md` - Project principles

**Tools:**
- Read tool for all artifacts
- Grep/Glob for searching artifacts

**Scope options (via argument):**
- `spec` - Analyze spec.md only
- `plan` - Analyze plan.md and design docs
- `tasks` - Analyze tasks.md
- `all` - Full cross-artifact analysis (default)

## Agent Reasons About

- **What actually matters?** - Not every issue is equal; prioritize by impact
- **Is this really a problem?** - Context matters; some "issues" are fine
- **What severity?** - ERROR (must fix), WARNING (should fix), INFO (consider)
- **Cross-artifact consistency** - Do artifacts agree with each other?
- **Constitution alignment** - Do artifacts serve project principles?

## Patterns That Often Help

**Spec analysis:**
- Are user stories from the user's perspective?
- Are acceptance criteria testable?
- Are requirements specific enough to implement?
- Are priorities assigned?
- Are dependencies documented?

**Plan analysis:**
- Is the technical approach justified?
- Are design decisions documented with rationale?
- Does the plan align with existing architecture?
- For agentic apps: Is the tool/agent boundary clear?

**Tasks analysis:**
- Do tasks trace to requirements/stories?
- Are dependencies reasonable?
- Is there a clear path to completion?
- Are tasks appropriately sized?

**Cross-artifact consistency:**
- Do all spec requirements have implementation plans?
- Do all plan components have tasks?
- Are entity names consistent across artifacts?
- Do priorities align?

**What to skip:**
- Minor formatting issues
- Style preferences
- Things that are clearly intentional

## Output

Generate a report (to user, not a file) with:
- Summary: artifact count, issues by severity
- Findings grouped by severity (ERROR > WARNING > INFO)
- Each finding: location, issue, why it matters
- Recommendations: what to do about it

**Severity guide:**
- **ERROR**: Will definitely cause implementation problems
- **WARNING**: Likely to cause confusion or issues
- **INFO**: Worth considering, but not blocking

## Constitution Alignment

This skill supports:
- **I. Truthfulness**: Honest assessment of quality
- **III. Causal-First**: Trace issues to root cause
- **VII. Consistent**: Validate consistency across artifacts

## Handoff

After analysis, suggest based on findings:
- `/dev.clarify` - If spec ambiguities found
- `/dev.plan` - If plan issues found
- `/dev.tasks` - If task issues found
- Proceed to next step - If no blocking issues
