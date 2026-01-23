# dev.specify

> Create a feature specification from a natural language description

## When to Use

Use this skill when:
- Starting work on a new feature from an Epic
- Converting a feature idea into a formal specification
- Creating the foundation for the dev workflow pipeline

## Invocation

```
/dev.specify [feature description]
```

Or describe your feature need and this skill will be auto-invoked.

## Workflow

### Step 1: Identify Epic

1. Read the epic catalogue at `docs/planning/epic-catalogue.md`
2. Present available Epics to user for selection
3. If user provides Epic ID directly, validate it exists

### Step 2: Generate Feature Name

From the user's description, generate a short feature name:
- 2-4 words maximum
- Descriptive and unique
- Will become part of branch name

### Step 3: Check for Existing Work

Before creating:
```bash
# Check for existing branches
git branch -a | grep -i "{{EPIC_ID}}"

# Check for existing specs
ls specs/ | grep -i "{{EPIC_ID}}"
```

If work exists, ask user how to proceed.

### Step 4: Create Feature Structure

Run the creation script:
```bash
bash "$(dirname "$0")/scripts/create-new-feature.sh" "{{EPIC_ID}}" "{{FEATURE_NAME}}" --json
```

This creates:
- Feature branch: `ep01-feature-name`
- Spec directory: `specs/ep01-feature-name/`
- Spec file: `specs/ep01-feature-name/spec.md`
- Checklists directory: `specs/ep01-feature-name/checklists/`

### Step 5: Generate Specification

Using the template at `templates/spec-template.md`, generate a complete specification:

1. **Overview**: Extract from user description
2. **User Scenarios**: Convert requirements to user stories with acceptance criteria
3. **Requirements**: Functional and non-functional requirements with priorities
4. **Key Entities**: Domain model outline
5. **Success Criteria**: Measurable outcomes
6. **Edge Cases**: Boundary conditions and error handling
7. **Dependencies**: Internal and external dependencies
8. **Open Questions**: Mark unclear items with [NEEDS CLARIFICATION]

### Step 6: Create Requirements Checklist

Generate `checklists/requirements.md` with quality validation items:
- Requirement completeness checks
- Clarity and specificity checks
- Consistency checks
- Testability checks

### Step 7: Validate Specification

Run up to 3 iterations to:
1. Check spec against checklist
2. Fix any obvious issues
3. Ensure no contradictions

### Step 8: Handle Clarifications

If there are more than 3 items marked [NEEDS CLARIFICATION]:
- Present the top 3 to the user
- Ask for clarification using AskUserQuestion
- Update spec with answers

---

## For Agentic Applications

When specifying features for agentic systems (like agentlint), apply these additional guidelines:

### Tool/Agent Boundary in Requirements

**Functional requirements MUST describe tool capabilities, NOT agent orchestration.**

| Write This (Tool Capability) | NOT This (Agent Orchestration) |
|------------------------------|--------------------------------|
| "Tool returns skill invocation counts per session" | "Tool detects when invocation rate is low" |
| "Tool provides session summaries with user prompts" | "Tool identifies missed opportunities" |
| "Tool stores indexed data in SQLite" | "Tool decides which analysis to run" |

**Why?** Per Constitution Principle VII, the agent decides what data means. Tools provide data and capabilities; the agent provides judgment.

### User Stories for Agentic Features

Frame user stories around **outcomes**, not agent behavior:

```markdown
# CORRECT: Outcome-focused
**As a** developer,
**I want** to see which Skills are being invoked and how often,
**So that** I can understand whether my Skills are providing value.

# WRONG: Prescribing agent behavior
**As a** developer,
**I want** the agent to detect low invocation rates,
**So that** I'm alerted when skills aren't being used.
```

### Key Entities

For agentic applications, entities typically include:
- **Data structures** the tools operate on (sessions, configs, invocations)
- **Indexes** for efficient querying (SQLite tables, FTS5 indexes)
- **NOT** orchestration concepts (workflows, pipelines, detection rules)

### Anti-patterns to Avoid

| Anti-pattern | Why It's Wrong | Fix |
|--------------|----------------|-----|
| Hardcoded thresholds in requirements | Agent should judge what's "low" or "high" | Describe the data; let agent interpret |
| Detection/matching logic | Agent reasoning, not tool logic | Provide data; agent reasons |
| "When X, do Y" rules | Prescribes orchestration | Describe capability; agent decides when |
| Workflow sequences | Agent orchestrates | Provide independent tools |

### Acceptance Criteria

Write acceptance criteria that test **tool capabilities**, not agent judgment:

```markdown
# CORRECT: Tests tool capability
- [ ] Given sessions exist, when tool queries invocations, then it returns count per skill

# WRONG: Tests agent judgment
- [ ] Given a skill has <30% invocation rate, then it's flagged as underutilized
```

### Reference

See Constitution Principle VII (Intelligent Tooling) and ADR Implementation Notes for full guidance.

---

## Output

On success, output:
```
Feature specification created!

  Epic:     EP01
  Branch:   ep01-feature-name
  Spec:     specs/ep01-feature-name/spec.md

  Status: Ready for clarification
  Open Questions: X items marked [NEEDS CLARIFICATION]

Next: Run /dev.clarify to resolve ambiguities
```

## Constitution Alignment

This skill supports:
- **III. Causal-First**: Requirements trace to user outcomes
- **IX. Agent-Aware**: Structured for agent consumption

## Files

- `templates/spec-template.md` - Specification template
- `scripts/common.sh` - Shared utilities
- `scripts/create-new-feature.sh` - Branch/directory creation

## Handoff

After completing this skill, suggest:
- `/dev.clarify` - To resolve [NEEDS CLARIFICATION] items
- `/dev.plan` - If spec is already clear enough
- `/dev.analyze spec` - Optional quality validation before proceeding
