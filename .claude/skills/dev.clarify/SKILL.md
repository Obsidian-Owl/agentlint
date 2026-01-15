# dev.clarify

> Resolve ambiguities in a feature specification through targeted questions

## When to Use

Use this skill when:
- A spec has [NEEDS CLARIFICATION] markers
- Requirements are underspecified
- You want to reduce ambiguity before planning

## Invocation

```
/dev.clarify [optional context]
```

## Prerequisites

- Must be on a feature branch (e.g., `ep01-feature-name`)
- `spec.md` must exist in the feature directory

## Workflow

### Step 0: Load Feature Context

```bash
# Get feature paths
SCRIPT_DIR="$(dirname "$0")/scripts"
source "$SCRIPT_DIR/common.sh"
eval "$(get_feature_paths)"

# Validate
if [[ -z "$FEATURE_SPEC" ]] || [[ ! -f "$FEATURE_SPEC" ]]; then
    echo "Error: No spec.md found. Run /dev.specify first."
    exit 1
fi
```

### Step 1: Perform Ambiguity Scan

Analyze the spec across 8 categories:

| Category | What to Look For |
|----------|------------------|
| **Functional Scope** | Vague verbs (handle, manage, process), missing details |
| **Domain Model** | Undefined entities, unclear relationships |
| **UX Flow** | Missing interaction details, unclear UI states |
| **Quality Attributes** | Unmeasured NFRs (fast, scalable, secure) |
| **Integrations** | Unspecified APIs, protocols, formats |
| **Edge Cases** | Missing error handling, boundary conditions |
| **Constraints** | Unstated assumptions, hidden dependencies |
| **Terminology** | Inconsistent terms, undefined jargon |

### Step 2: Prioritize Questions

Generate a prioritized question queue:
- Maximum 5 questions per session
- Maximum 10 questions across all sessions
- Focus on highest-impact ambiguities first

**Priority Order:**
1. Blockers for planning (dependencies, integrations)
2. Scope clarifications (in/out of scope)
3. Quality attributes (performance, security targets)
4. UX/interaction details
5. Edge cases and error handling

### Step 3: Interactive Questioning

For each question:

1. **Present ONE question at a time**
2. **For multiple choice**: Show recommended option prominently
3. **For free-form**: Suggest an answer and explain reasoning
4. **Accept quick answers**: "yes", "recommended", "suggested", or custom

Example interaction:
```
Question 1 of 3:

The spec mentions "fast response times" but doesn't define a target.

What should the maximum response time be for the analysis command?

  [1] < 5 seconds (Recommended - aligns with QR from Arc42 §10)
  [2] < 10 seconds
  [3] < 30 seconds
  [4] Custom value

Your answer:
```

### Step 4: Update Spec Incrementally

After EACH answer:

1. Create `## Clarifications` section if it doesn't exist
2. Add `### Session {{DATE}}` subheading
3. Update the relevant requirement sections with clarified details
4. Save the spec immediately (don't batch updates)

**Update Format:**
```markdown
## Clarifications

### Session 2026-01-15

**Q: What should the maximum response time be?**
A: < 5 seconds (aligns with QR from Arc42 §10)

Updated: NFR-001 in Section 3.2
```

### Step 5: Validate After Each Update

After updating:
- Check for contradictions with existing requirements
- Ensure no duplicate requirements created
- Verify formatting is preserved

### Step 6: Generate Coverage Summary

After all questions answered:

```
Clarification Summary
=====================

| Category              | Status    |
|-----------------------|-----------|
| Functional Scope      | Clear     |
| Domain Model          | Clear     |
| UX Flow               | Resolved  |
| Quality Attributes    | Resolved  |
| Integrations          | Deferred  |
| Edge Cases            | Clear     |
| Constraints           | Clear     |
| Terminology           | Clear     |

Questions asked: 3
Questions deferred: 1 (integration with external API - blocked on vendor)
Outstanding: 0

Recommendation: Proceed to /dev.plan
```

## Output

On completion:
```
Clarification complete!

  Spec:     specs/ep01-feature-name/spec.md
  Updated:  3 sections
  Resolved: 3 ambiguities
  Deferred: 1 (documented in spec)

  Coverage: 7/8 categories clear

Next: Run /dev.plan to create implementation design
```

## Constitution Alignment

This skill supports:
- **III. Causal-First**: Trace clarifications to requirements
- **IX. Agent-Aware**: Structured Q&A for agent consumption

## Files

- `scripts/common.sh` - Shared utilities

## Handoff

After completing this skill, suggest:
- `/dev.plan` - If all critical ambiguities resolved
- `/dev.clarify` again - If more questions surfaced
