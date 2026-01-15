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
