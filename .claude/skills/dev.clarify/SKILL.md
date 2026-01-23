# dev.clarify

> Resolve ambiguities in a feature specification through targeted questions

## Goal

Resolve ambiguities that would block implementation planning. After clarification, the spec should be clear enough that implementation decisions can be made without guessing.

## Success Criteria

- Ambiguities that would cause implementation questions are resolved
- Agent can explain why each clarification was needed
- User understands what was clarified and why
- Spec is updated with resolutions (not just discussed)
- Remaining uncertainty is documented, not hidden

## Capabilities Available

**Scripts:**
```bash
# Get feature paths
source "$(dirname "$0")/scripts/common.sh"
eval "$(get_feature_paths)"
# $FEATURE_SPEC points to spec.md
```

**Files:**
- `$FEATURE_SPEC` - The specification to clarify
- `.specify/memory/constitution.md` - Project principles (may reveal alignment questions)

**Tools:**
- Read tool for spec and related documents
- Edit tool to update spec with clarifications
- AskUserQuestion for user clarification (supports multiple choice or free-form)

## Agent Reasons About

- **What's actually unclear?** - Not a generic checklist, but what's unclear in THIS spec
- **What would block planning?** - Which ambiguities matter most for implementation
- **How many questions?** - Might be 1, might be 10—depends on the spec
- **What order?** - Prioritize by implementation impact
- **When is "clear enough"?** - Perfect clarity isn't always needed; judge when to stop
- **What can be deferred?** - Some questions can wait until implementation

## Patterns That Often Help

**Finding ambiguities:**
- Undefined terms are common sources of confusion
- Vague requirements ("fast", "scalable", "easy") need specific metrics
- Integration points often have hidden complexity
- Edge cases are frequently underspecified
- Implicit assumptions should be made explicit

**Asking good questions:**
- One question at a time is easier to answer
- Provide recommended options when you have informed opinions
- Explain why the clarification matters
- Accept quick answers ("yes", "recommended") to reduce friction

**Updating the spec:**
- Update spec immediately after each answer (don't batch)
- Add a `## Clarifications` section with dated entries
- Reference which requirement/section was updated
- Preserve the original question and answer for traceability

**Knowing when to stop:**
- Stop when remaining ambiguities won't block planning
- Some questions are better resolved during implementation
- User fatigue is real—don't over-question

## Workflow Guidance

This is a suggested flow, not a rigid sequence.

1. **Load context** - Read the spec thoroughly
2. **Identify ambiguities** - What's unclear that would block implementation?
3. **Prioritize** - Which matter most? (agent judgment, not fixed rules)
4. **Ask questions** - One at a time, with context
5. **Update spec** - After each answer, immediately
6. **Repeat or stop** - Continue until clear enough to plan

## Output

Communicate to user:
- Summary of what was clarified
- Which spec sections were updated
- Any deferred questions (and why deferred)
- Suggested next step (usually /dev.plan)

## Constitution Alignment

This skill supports:
- **III. Causal-First**: Trace clarifications to implementation needs
- **VII. Intelligent Tooling**: For agentic apps, clarify tool vs agent boundaries
- **IX. Agent-Aware**: Structured Q&A for agent consumption

## Handoff

After completing, suggest based on context:
- `/dev.plan` - If spec is clear enough for planning
- `/dev.clarify` again - If more questions surfaced during answers
