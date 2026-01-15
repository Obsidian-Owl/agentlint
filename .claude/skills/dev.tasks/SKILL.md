# dev.tasks

> Generate an actionable, dependency-ordered tasks.md from feature design artifacts

## When to Use

Use this skill when:
- Plan and design artifacts are complete (`plan.md`, `data-model.md`, etc.)
- You're ready to break down the feature into implementable tasks
- You need a structured task list before creating Linear issues

## Invocation

```
/dev.tasks [optional context]
```

## Prerequisites

- Must be on a feature branch (e.g., `ep01-feature-name`)
- `spec.md` must exist with prioritized user stories
- `plan.md` must exist with technical context

## Workflow

### Phase 0: Validate Prerequisites

```bash
# Get feature paths and validate
SCRIPT_DIR="$(dirname "$0")/scripts"
source "$SCRIPT_DIR/common.sh"
eval "$(get_feature_paths)"

# Run prerequisite check
bash "$SCRIPT_DIR/check-prerequisites.sh" --json
```

**Required artifacts:**
- `spec.md` - User stories with priorities (P1, P2, P3)
- `plan.md` - Technical context and project structure

**Optional artifacts (enhance task generation):**
- `data-model.md` - Entity definitions
- `research.md` - Technical decisions
- `contracts/` - API/interface definitions
- `quickstart.md` - Usage scenarios for testing

### Phase 1: Extract Inputs

**From spec.md:**
- User stories with priorities (P1, P2, P3)
- Acceptance criteria per story
- Functional requirements (FR-###)
- Non-functional requirements (NFR-###)

**From plan.md:**
- Technical context (language, dependencies, storage)
- Project structure (source code layout)
- Key design decisions

**From data-model.md:**
- Entities and their attributes
- Relationships between entities
- Validation rules

**From contracts/:**
- API endpoints or interfaces
- Input/output contracts
- Error handling patterns

### Phase 2: Generate Task Phases

Organize tasks into these phases:

#### Phase 1: Setup
- Project initialization
- Directory structure creation
- Configuration files
- Basic package structure
- **No dependencies** - can start immediately

#### Phase 2: Foundational
- Base models and types
- Core exceptions/errors
- Framework infrastructure
- Shared utilities
- **Checkpoint**: Foundation ready

#### Phase 3+: User Stories (one phase per story)
- Order by priority: P1, P2, P3...
- Each story independently testable
- Tests FIRST in each phase
- **Checkpoint**: Story N complete and independently functional

#### Final Phase: Polish
- Documentation updates
- Performance optimization
- Contract tests
- Validation against quickstart.md

### Phase 3: Apply Task Format

**Mandatory format:**
```
- [ ] T### [P?] [US?] Description with file path
```

**Components:**
| Component | Required | Description |
|-----------|----------|-------------|
| `- [ ]` | Yes | Checkbox (always unchecked) |
| `T###` | Yes | Sequential task ID (T001, T002...) |
| `[P]` | No | Parallelizable marker (safe to run concurrently) |
| `[US#]` | Story phases only | User story reference (US1, US2...) |
| Description | Yes | Clear action with **absolute file path** |

**Valid examples:**
```markdown
- [ ] T001 Create project structure per implementation plan
- [ ] T005 [P] Implement authentication middleware in src/middleware/auth.py
- [ ] T012 [P] [US1] Create User model in src/models/user.py
- [ ] T014 [US1] Implement UserService in src/services/user_service.py (depends on T012)
```

**Parallelization rules:**
- Mark `[P]` only if task works on different files than concurrent tasks
- Never mark `[P]` if task depends on incomplete task in same phase
- When in doubt, don't mark `[P]`

### Phase 4: Map Dependencies

**Three dependency types:**

1. **Phase dependencies** (implicit):
   ```
   Setup → Foundational → US1 → US2 → ... → Polish
   ```

2. **Within-phase dependencies** (implicit order):
   - Tests before implementation
   - Models before services
   - Services before endpoints

3. **Explicit dependencies** (noted in description):
   ```
   - [ ] T014 [US1] Implement UserService (depends on T012, T013)
   ```

### Phase 5: Define Checkpoints

After each phase, add a checkpoint:

```markdown
**Checkpoint**: [Phase name] complete
- [ ] All tests pass
- [ ] [Story-specific verification if applicable]
```

After each user story phase:
```markdown
**Checkpoint**: User Story X fully functional and independently testable
```

### Phase 6: Calculate MVP Scope

Identify the minimal viable implementation:
- Setup phase (always included)
- Foundational phase (always included)
- P1 user stories only

Output as summary:
```markdown
## MVP Scope

Tasks for minimum viable feature:
- Setup: T001-T005 (5 tasks)
- Foundational: T006-T012 (7 tasks)
- US1 (P1): T013-T020 (8 tasks)

**Total MVP**: 20 tasks
**Full Feature**: 45 tasks
```

### Phase 7: Generate tasks.md

Create `$FEATURE_DIR/tasks.md` using template with:
1. Header with metadata
2. Summary section
3. Phase sections with tasks
4. MVP scope section
5. Execution notes

## Task Format Template

```markdown
# Tasks: {{FEATURE_NAME}}

> **Epic**: {{EPIC_ID}}
> **Generated**: {{DATE}}
> **Total Tasks**: {{COUNT}}
> **MVP Tasks**: {{MVP_COUNT}}

---

## Summary

| Phase | Tasks | Parallelizable |
|-------|-------|----------------|
| Setup | X | Y |
| Foundational | X | Y |
| US1: [Name] | X | Y |
| Polish | X | Y |

---

## Phase 1: Setup

**Goal**: Initialize project structure

- [ ] T001 [P] Create directory structure per plan.md
- [ ] T002 [P] Initialize configuration files
...

**Checkpoint**: Setup complete

---

## Phase 2: Foundational

**Goal**: Core infrastructure before user stories

- [ ] T00X Create base types in src/types/index.ts
- [ ] T00X [P] Implement error handling in src/errors/index.ts
...

**Checkpoint**: Foundation ready, all base infrastructure in place

---

## Phase 3: User Story 1 - [Title] (P1)

**Goal**: [What this story delivers]
**Requirements**: FR-001, FR-002

### Tests (write first, ensure they fail)

- [ ] T0XX [P] [US1] Unit test for [component] in tests/unit/test_[name].ts
- [ ] T0XX [P] [US1] Integration test for [flow] in tests/integration/test_[name].ts

### Implementation

- [ ] T0XX [US1] Create [Entity] model in src/models/[entity].ts
- [ ] T0XX [US1] Implement [Service] in src/services/[service].ts (depends on T0XX)
...

**Checkpoint**: US1 complete and independently testable

---

## MVP Scope

Minimum viable implementation:
- Phase 1: Setup (T001-T00X)
- Phase 2: Foundational (T00X-T0XX)
- Phase 3: US1 (T0XX-T0XX)

**Total**: XX tasks

---

## Execution Notes

- Tasks marked [P] can run in parallel within their phase
- Complete each phase before starting the next
- Each user story should be deployable after its checkpoint
- Run tests after each checkpoint
```

## Output

On completion:
```
Tasks generated!

  Epic:     EP01
  Branch:   ep01-feature-name
  Tasks:    specs/ep01-feature-name/tasks.md

  Summary:
    Total Tasks:    45
    MVP Tasks:      20
    Phases:         6
    User Stories:   4

  Phase Breakdown:
    Setup:          5 tasks (3 parallel)
    Foundational:   7 tasks (2 parallel)
    US1 (P1):       8 tasks (4 parallel)
    US2 (P1):       10 tasks (5 parallel)
    US3 (P2):       8 tasks (3 parallel)
    Polish:         7 tasks (2 parallel)

Next: Run /dev.taskstolinear to create Linear issues
```

## Constitution Alignment

This skill supports:
- **III. Causal-First**: Tasks trace to requirements and stories
- **IV. Minimal**: MVP scope clearly defined
- **VI. Traceable**: Task IDs enable tracking
- **IX. Agent-Aware**: Structured format for agent execution

## Files

- `templates/tasks-template.md` - Tasks document template
- `scripts/common.sh` - Shared utilities
- `scripts/check-prerequisites.sh` - Prerequisite validation

## Handoff

After completing this skill, suggest:
- `/dev.taskstolinear` - Create Linear issues from tasks
- `/dev.plan` - If tasks reveal missing design elements
- `/dev.analyze tasks` - Optional quality validation before Linear sync
