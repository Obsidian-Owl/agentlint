# dev.plan

> Create an implementation plan from a feature specification

## Goal

Transform a clarified specification into an implementation plan. The plan should resolve technical unknowns, define the approach, and prepare for task breakdown. After planning, the path to implementation should be clear.

## Success Criteria

- Technical approach is defined and justified
- Key design decisions are documented with rationale
- Agent can explain why this approach was chosen over alternatives
- Plan aligns with project architecture and constitution
- Unknowns that would block implementation are resolved

## Capabilities Available

**Scripts:**
```bash
# Get feature paths
source "$(dirname "$0")/scripts/common.sh"
eval "$(get_feature_paths)"
# $FEATURE_SPEC, $IMPL_PLAN, $FEATURE_DIR available
```

**Files:**
- `$FEATURE_SPEC` - The specification to plan from
- `templates/plan-template.md` - Plan structure (use as guide)
- `templates/data-model-template.md` - Entity model structure (if needed)
- `.specify/memory/constitution.md` - Project principles
- `docs/architecture/adr/` - Existing architecture decisions
- `docs/architecture/arc42/` - System architecture

**Tools:**
- Read tool for spec, ADRs, existing code
- Write tool to create plan.md and supporting docs
- Grep/Glob for finding existing patterns in codebase
- AskUserQuestion for technical decisions requiring user input

## Agent Reasons About

- **What technical approach?** - How should this be built? What are the options?
- **What needs research?** - What unknowns need resolution before implementation?
- **What artifacts are needed?** - Not every feature needs data-model.md, contracts/, etc.
- **What existing patterns apply?** - How does this fit with existing architecture?
- **What's the minimal viable approach?** - Avoid over-engineering
- **Constitution alignment** - Does this approach serve project principles?

## Patterns That Often Help

**Understanding the technical landscape:**
- Read related ADRs to understand past decisions
- Search codebase for similar implementations
- Check existing module structure and patterns
- Understand dependencies and integration points

**Making design decisions:**
- Document the decision, rationale, and alternatives considered
- Prefer existing patterns over novel approaches
- Start simple—add complexity only when justified
- Consider testability in design choices

**For agentic applications:**
- Design tools to provide data/capabilities, not judgment
- Agent reasoning should NOT be encoded in tool logic
- Avoid hardcoded thresholds, detection rules, or orchestration in tools
- Tools should return raw data; agent interprets meaning

**Artifacts to create (as needed):**
- `plan.md` - Always: technical context and approach
- `research.md` - If significant unknowns needed resolution
- `data-model.md` - If new entities are introduced
- `contracts/` - If APIs or interfaces are defined

**Constitution validation:**
- Check plan against ALL constitution principles
- Document compliance or justified violations
- Pay special attention to tool/agent boundaries (Principle VII)

## Workflow Guidance

This is a suggested flow, not a rigid sequence.

1. **Load context** - Read spec, constitution, related architecture
2. **Identify unknowns** - What technical questions need answers?
3. **Research** - Search codebase, read docs, explore options
4. **Decide approach** - Choose and document technical decisions
5. **Create artifacts** - Plan and supporting docs as needed
6. **Validate alignment** - Check against constitution

## Output

On success, the feature directory contains:
- `plan.md` - Technical approach and context (always)
- Supporting docs as needed (research.md, data-model.md, etc.)

Communicate to user:
- Summary of technical approach
- Key decisions and rationale
- Any deferred decisions (and why)
- Suggested next step (usually /dev.tasks)

## Constitution Alignment

This skill supports:
- **III. Causal-First**: Design decisions trace to requirements
- **IV. Minimal**: Focus on minimal viable design
- **VI. Traceable**: ADR and Arc42 references
- **VII. Intelligent Tooling**: Tool/agent boundary in design
- **IX. Agent-Aware**: Structured artifacts for agent consumption

## Handoff

After completing, suggest based on context:
- `/dev.tasks` - If plan is ready for task breakdown
- `/dev.clarify` - If planning revealed spec ambiguities
