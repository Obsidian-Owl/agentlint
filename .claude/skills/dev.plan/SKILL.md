# dev.plan

> Execute the implementation planning workflow to generate design artifacts from a feature specification

## When to Use

Use this skill when:
- A spec has been created and clarified via `/dev.specify` and `/dev.clarify`
- You need to resolve technical unknowns before implementation
- Design artifacts (data model, contracts) are needed before task generation

## Invocation

```
/dev.plan [optional context]
```

## Prerequisites

- Must be on a feature branch (e.g., `ep01-feature-name`)
- `spec.md` must exist in the feature directory
- Spec should be clarified (minimal [NEEDS CLARIFICATION] markers)

## Workflow

### Phase 0: Setup & Environment

**Step 0.1: Initialize Environment**

```bash
# Get feature paths
SCRIPT_DIR="$(dirname "$0")/scripts"
source "$SCRIPT_DIR/common.sh"
eval "$(get_feature_paths)"

# Validate prerequisites
if [[ -z "$FEATURE_SPEC" ]] || [[ ! -f "$FEATURE_SPEC" ]]; then
    echo "Error: No spec.md found. Run /dev.specify first."
    exit 1
fi
```

**Step 0.2: Load Context Documents**

Read these files in parallel:
1. `$FEATURE_SPEC` - The feature specification
2. `$CONSTITUTION` - Project principles (`.specify/memory/constitution.md`)
3. Copy `templates/plan-template.md` → `$FEATURE_DIR/plan.md` (if not exists)

**Step 0.3: Fill Technical Context**

In `plan.md`, populate the Technical Context section with project-specific values:

| Field | Description | Example |
|-------|-------------|---------|
| Language/Version | Primary language and version | TypeScript 5.x |
| Primary Dependencies | Key libraries/frameworks | Vitest, Commander |
| Storage | Data persistence approach | File system, SQLite |
| Testing Framework | Test tools used | Vitest, Playwright |
| Target Platform | Deployment target | CLI, Node.js 20+ |
| Project Type | Architecture pattern | CLI Tool, Library |
| Performance Goals | Key metrics | < 5s analysis time |
| Constraints | Technical limitations | No external services |
| Scale/Scope | Expected usage scale | Single developer |

Mark any unknown fields as `[NEEDS CLARIFICATION]`.

**Step 0.4: Constitution Check (Gate 1)**

Read `$CONSTITUTION` and validate the plan against ALL principles.

```markdown
## Constitution Compliance

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | [Name] | ✓/✗ | [How this plan complies] |
| II | [Name] | ✓/✗ | [How this plan complies] |
...
```

**Gate Criteria**: All principles must pass OR violations must be justified in a "Complexity Tracking" table.

---

### Phase 1: Research & Clarification

**Purpose**: Resolve all technical unknowns before design

**Step 1.1: Extract Unknowns**

Parse `plan.md` Technical Context for:
- Fields marked `[NEEDS CLARIFICATION]`
- Dependencies without version clarity
- Integrations without defined contracts
- Performance targets without metrics

**Step 1.2: Research Tasks**

For each unknown, create a research task:
- `"Research {technology} best practices for {project type}"`
- `"Investigate {integration} patterns"`
- `"Evaluate {options} for {requirement}"`

Use codebase search to find existing patterns:
```bash
# Search for similar implementations
grep -r "pattern" src/
# Check existing architecture docs
cat docs/architecture/*.md
```

**Step 1.3: Consolidate Findings**

Create `$FEATURE_DIR/research.md` with format:

```markdown
# Research Findings: {{FEATURE_NAME}}

## Decision Log

### {{Topic 1}}

**Decision**: [What was chosen]
**Rationale**: [Why chosen]
**Alternatives Considered**: [What else was evaluated]
**References**: [Links to docs, ADRs, etc.]

### {{Topic 2}}
...
```

**Step 1.4: Resolve Remaining Unknowns**

Use `AskUserQuestion` tool for any unresolved items:
- Present options with recommendations
- Document answers in research.md
- Update plan.md Technical Context

**Gate**: All `[NEEDS CLARIFICATION]` must be resolved before Phase 2.

---

### Phase 2: Design & Contracts

**Prerequisites**: research.md complete, no unresolved unknowns

**Step 2.1: Data Model Design**

Create `$FEATURE_DIR/data-model.md`:

```markdown
# Data Model: {{FEATURE_NAME}}

## Entities

### {{Entity Name}}

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Unique identifier |
...

**Relationships**:
- `EntityA` --1:N--> `EntityB`

**Validation Rules**:
- [Rule from requirements]

**State Transitions** (if applicable):
- Initial → Processing → Complete
```

Extract entities from:
- spec.md Key Entities section
- Functional requirements
- User story acceptance criteria

**Step 2.2: API/Contract Design**

Create `$FEATURE_DIR/contracts/` directory with:
- Interface definitions (TypeScript)
- API schemas (OpenAPI/JSON Schema)
- Event contracts (if applicable)

Format depends on project type:
- **CLI**: Command interface definitions
- **Library**: Public API types
- **Service**: REST/GraphQL schemas

**Step 2.3: Quickstart Guide**

Create `$FEATURE_DIR/quickstart.md`:

```markdown
# Quickstart: {{FEATURE_NAME}}

## Installation

[Steps to set up]

## Basic Usage

[Minimal example]

## Common Patterns

[Frequent use cases]
```

**Step 2.4: Constitution Re-check (Gate 2)**

Re-validate design against constitution:
- ERROR if new violations introduced
- Document justified violations in "Complexity Tracking"

**Step 2.5: Update Plan Status**

Update `plan.md` header:
```markdown
> **Status**: Design Complete
```

---

## Output Artifacts

On completion, the following files exist:

```
specs/{epic-id}-{feature}/
├── spec.md           # Input (from /dev.specify)
├── plan.md           # Technical context & constitution check
├── research.md       # Phase 1 output (resolved unknowns)
├── data-model.md     # Phase 2 output (entity definitions)
├── quickstart.md     # Phase 2 output (usage guide)
├── contracts/        # Phase 2 output (API definitions)
│   └── interfaces.ts # Or openapi.yaml, schema.graphql
└── checklists/       # Validation checklists
    └── design.md
```

## Completion Message

```
Implementation plan complete!

  Epic:     EP01
  Branch:   ep01-feature-name

  Artifacts Generated:
    ✓ plan.md          - Technical context defined
    ✓ research.md      - X decisions documented
    ✓ data-model.md    - X entities defined
    ✓ contracts/       - API interfaces created
    ✓ quickstart.md    - Usage guide ready

  Constitution: All principles pass
  Status: Ready for task generation

Next: Run /dev.tasks to generate implementation tasks
```

## Constitution Alignment

This skill supports:
- **III. Causal-First**: Design decisions trace to requirements
- **IV. Minimal**: Focus on minimal viable design
- **VI. Traceable**: ADR and Arc42 references
- **IX. Agent-Aware**: Structured artifacts for agent consumption

## Files

- `templates/plan-template.md` - Technical context template
- `templates/research-template.md` - Research findings template
- `templates/data-model-template.md` - Entity model template
- `scripts/common.sh` - Shared utilities
- `scripts/setup-plan.sh` - Plan initialization

## Handoff

After completing this skill, suggest:
- `/dev.tasks` - Generate implementation tasks from plan
- `/dev.clarify` - If design reveals new spec ambiguities
- `/dev.constitution validate` - Optional principle compliance check
- `/dev.analyze plan` - Optional quality validation before proceeding
