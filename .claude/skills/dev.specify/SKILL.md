# dev.specify

> Create a feature specification from a natural language description

## Goal

Transform a feature idea or Epic into a clear specification that enables implementation planning. The specification should capture what needs to be built, why it matters, and what success looks like.

## Success Criteria

- Spec articulates the problem being solved and why it matters
- User stories capture actual user needs with testable acceptance criteria
- Requirements are specific enough to implement without ambiguity
- Agent can explain the reasoning behind scope decisions
- Open questions are identified (not hidden or assumed away)

## Capabilities Available

**Scripts:**
```bash
# Get feature paths and context
source "$(dirname "$0")/scripts/common.sh"
eval "$(get_feature_paths)"

# Create feature branch and directory structure
bash "$(dirname "$0")/scripts/create-new-feature.sh" "{{EPIC_ID}}" "{{FEATURE_NAME}}" --json
```

**Files:**
- `templates/spec-template.md` - Specification structure (use as guide, not rigid format)
- `docs/planning/epic-catalogue.md` - Available epics and their definitions
- `.specify/memory/constitution.md` - Project principles to align with

**Tools:**
- Read tool for existing specs, ADRs, architecture docs
- Write tool to create spec.md
- AskUserQuestion for clarifying user intent
- Bash for git operations and script execution

## Agent Reasons About

- **What Epic?** - Which epic does this work belong to? Validate it exists.
- **Scope boundaries** - What's in vs out? Where are the edges?
- **User value** - Who benefits and how? What's the real problem?
- **Requirements depth** - How detailed should requirements be for THIS feature?
- **What's unclear?** - What would block implementation if not clarified?
- **Constitution alignment** - Does this feature serve the project's principles?

## Patterns That Often Help

**Understanding the feature:**
- Read the epic definition first to understand strategic context
- Check for existing work (branches, specs) that might overlap
- Consider who the users are and what they actually need (not just what they ask for)

**Writing effective specs:**
- Start with the "why" before the "what"
- User stories should be from the user's perspective, not implementation details
- Acceptance criteria should be testable—if you can't verify it, rephrase it
- Mark genuinely unclear items as [NEEDS CLARIFICATION] rather than guessing

**Scope management:**
- "Out of Scope" is as important as "In Scope"
- When in doubt about scope, ask the user
- Features that try to do everything often do nothing well

**For agentic applications (like agentlint):**
- Distinguish between tool capabilities (data, operations) and agent reasoning (judgment, decisions)
- Specs should describe WHAT the system does, not HOW the agent should orchestrate
- Avoid encoding thresholds, rules, or detection logic that should be agent reasoning

## Workflow Guidance

This is a suggested flow, not a rigid sequence. Adapt based on context.

1. **Identify Epic** - Determine which epic this belongs to
2. **Check existing work** - Look for branches/specs that might conflict
3. **Create structure** - Branch and directory via create-new-feature.sh
4. **Understand context** - Read related docs, existing code, ADRs
5. **Draft specification** - Use template as guide, fill based on understanding
6. **Validate alignment** - Check against constitution principles
7. **Identify gaps** - Mark unclear items, don't paper over them

## Output

On success, the feature directory contains:
- `spec.md` - The specification
- `checklists/requirements.md` - Quality validation items (if needed)

Communicate to user:
- What was created and where
- Key decisions made and why
- What's unclear and needs clarification
- Suggested next step (usually /dev.clarify if open questions exist)

## Constitution Alignment

This skill supports:
- **III. Causal-First**: Requirements trace to user outcomes
- **VII. Intelligent Tooling**: For agentic apps, distinguish tool vs agent responsibilities
- **IX. Agent-Aware**: Structured for agent consumption

## Handoff

After completing, suggest based on context:
- `/dev.clarify` - If open questions exist
- `/dev.plan` - If spec is already clear
