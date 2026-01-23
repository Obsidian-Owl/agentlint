# dev.analyze

> Perform non-destructive cross-artifact consistency and quality analysis

## When to Use

Use this skill when:
- After generating spec, plan, or tasks
- Before creating Linear issues
- To validate artifact quality and consistency
- As a read-only quality gate

## Invocation

```
/dev.analyze [optional scope]
```

**Scope options:**
- `spec` - Analyze spec.md only
- `plan` - Analyze plan.md and related design docs
- `tasks` - Analyze tasks.md
- `all` - Full cross-artifact analysis (default)

## Prerequisites

- Must be on a feature branch (e.g., `ep01-feature-name`)
- At least `spec.md` must exist

## Workflow

### Phase 1: Load Artifacts

Read all available artifacts:
- `spec.md` - Feature specification
- `plan.md` - Implementation plan
- `research.md` - Technical decisions
- `data-model.md` - Entity definitions
- `tasks.md` - Task breakdown
- `contracts/` - API definitions

### Phase 2: Spec Analysis

**Completeness checks:**
- [ ] All user stories have acceptance criteria
- [ ] All requirements have IDs (FR-###, NFR-###)
- [ ] Priorities assigned (P1, P2, P3)
- [ ] Dependencies documented
- [ ] Success criteria defined

**Quality checks:**
- [ ] No vague language ("fast", "scalable", "easy")
- [ ] No undefined terms
- [ ] No conflicting requirements
- [ ] No duplicate IDs

**Output:** List of issues with severity (ERROR, WARNING, INFO)

### Phase 3: Plan Analysis

**Completeness checks:**
- [ ] Technical context filled (no [NEEDS CLARIFICATION])
- [ ] Constitution check completed
- [ ] Key design decisions documented
- [ ] Project structure defined

**Consistency checks:**
- [ ] All spec requirements addressable by plan
- [ ] No orphaned design elements
- [ ] Technology choices consistent
- [ ] ADR references valid

### Phase 4: Tasks Analysis

**Format checks:**
- [ ] All tasks have IDs (T###)
- [ ] IDs are sequential (no gaps)
- [ ] Proper checkbox format `- [ ]`
- [ ] File paths included

**Coverage checks:**
- [ ] All user stories have tasks
- [ ] All requirements traced to tasks
- [ ] MVP scope defined
- [ ] Checkpoints between phases

**Dependency checks:**
- [ ] No circular dependencies
- [ ] Phase order correct
- [ ] Explicit dependencies valid

### Phase 5: Cross-Artifact Consistency

**Spec ↔ Plan:**
- [ ] All FR-### addressed in design
- [ ] All NFR-### have implementation approach
- [ ] Entity names match between spec and data-model

**Spec ↔ Tasks:**
- [ ] All user stories have implementation tasks
- [ ] All acceptance criteria testable
- [ ] Priority order preserved

**Plan ↔ Tasks:**
- [ ] All design components have creation tasks
- [ ] Project structure matches task file paths
- [ ] Phase organization aligns with design phases

---

## For Agentic Applications

When analyzing artifacts for agentic systems (like agentlint), add these checks:

### Phase 2.5: Agentic Design Analysis

**Tool/Agent Boundary Checks:**

| Check | Severity | What to Look For |
|-------|----------|------------------|
| Judgment in requirements | ERROR | FR that says "detect", "identify", "flag when" with conditions |
| Hardcoded thresholds | ERROR | Requirements with specific numbers (< 30%, > 5) for judgment |
| Orchestration logic | ERROR | Requirements describing workflow sequences |
| Detection functions | WARNING | Technical design with `detect*()` or `identify*()` functions |
| Computed judgments in schema | ERROR | Database columns like `is_low`, `status`, `recommendation` |

**Examples of Errors:**

```markdown
[ERROR] spec.md:FR-007 - "Detect when skill invocation rate is below 30%"
  → Encodes threshold judgment. Should be: "Return invocation counts per skill"

[ERROR] data-model.md - Table has column `missed_opportunity: boolean`
  → Stores agent judgment. Remove column; agent identifies missed opportunities.

[ERROR] plan.md - Function `detectMissedOpportunities(sessions, skills)`
  → Detection logic should be agent reasoning, not tool function.
```

**Tool Design Quality Checks:**

- [ ] Tool descriptions explain what AND when to use
- [ ] Tools return raw data, not judgments
- [ ] Large result sets have filtering/pagination
- [ ] Related operations consolidated (not separate list/get/search)

**Constitution Principle VII Compliance:**

- [ ] No tool encodes "when to use" logic
- [ ] No tool returns status/quality judgments
- [ ] No tool orchestrates workflows
- [ ] Agent reasoning not encoded in tool logic

### Agentic-Specific Findings Format

```markdown
### Agentic Design Issues

1. [ERROR] spec.md:FR-012 - Encodes judgment in requirement
   Location: "Flag skills with invocation rate < 30%"
   Issue: Hardcoded threshold; agent should judge what's "low"
   Fix: Change to "Return invocation rate per skill"

2. [ERROR] data-model.md - Stores computed judgment
   Location: `missed_opportunities` table
   Issue: Agent reasoning stored as data
   Fix: Remove table; agent identifies opportunities from session summaries
```

---

### Phase 6: Generate Report

**Report format:**
```markdown
# Analysis Report: {{FEATURE_NAME}}

> Generated: {{DATE}}
> Artifacts Analyzed: spec.md, plan.md, tasks.md

## Summary

| Artifact | Errors | Warnings | Info |
|----------|--------|----------|------|
| spec.md | 0 | 2 | 5 |
| plan.md | 0 | 1 | 3 |
| tasks.md | 0 | 0 | 2 |
| Cross-artifact | 0 | 1 | 0 |

**Overall Status**: PASS / WARN / FAIL

## Findings

### Errors (must fix)
None

### Warnings (should fix)
1. [WARN] spec.md:45 - NFR-002 uses vague term "fast"
2. [WARN] plan.md:78 - Constitution principle VII not checked

### Info (consider)
1. [INFO] spec.md - 3 items marked [NEEDS CLARIFICATION]
2. [INFO] tasks.md - 45 tasks, 20 in MVP scope

## Recommendations

1. Resolve [NEEDS CLARIFICATION] items via /dev.clarify
2. Add specific metric to NFR-002 (e.g., "< 5 seconds")
3. Complete constitution check in plan.md
```

## Output

On completion:
```
Analysis complete!

  Feature:    EP01 - Core Foundation
  Artifacts:  5 analyzed

  Results:
    Errors:   0
    Warnings: 3
    Info:     8

  Status: PASS (with warnings)

  Report: specs/ep01-core-foundation/analysis-report.md

Recommendations:
  1. Run /dev.clarify to resolve 3 open questions
  2. Add metrics to NFR-002, NFR-005
```

## Constitution Alignment

This skill supports:
- **I. Truthfulness**: Honest assessment of artifact quality
- **III. Causal-First**: Traces issues to root cause
- **VII. Consistent**: Validates consistency across artifacts
- **IX. Agent-Aware**: Structured report for agent consumption

## Notes

- **Non-destructive**: This skill only reads, never modifies files
- **Run often**: Use before major workflow transitions
- **Fix issues early**: Cheaper to fix in spec than in code

## Handoff

After analysis, based on scope:

**After `dev.analyze spec`**:
- `/dev.clarify` - If ambiguities found
- `/dev.plan` - If spec is clear

**After `dev.analyze plan`**:
- `/dev.plan` - To address design issues
- `/dev.tasks` - If plan is solid

**After `dev.analyze tasks`**:
- `/dev.tasks` - To fix task issues
- `/dev.taskstolinear` - If tasks are ready

**After `dev.analyze all`**:
- Address highest priority issues first
- `/dev.integration-check` - If all clear for PR
