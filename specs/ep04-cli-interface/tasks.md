# Tasks: CLI Interface & Commands

> **Epic**: EP04
> **Generated**: 2026-01-16
> **Total Tasks**: 72
> **MVP Tasks**: 46

---

## Summary

| Phase | Tasks | Parallelizable | User Story |
|-------|-------|----------------|------------|
| Setup | 6 | 4 | - |
| Foundational | 10 | 5 | - |
| US-002: Help & Version (P1) | 5 | 2 | US-002 |
| US-004: Scan (P1) | 6 | 3 | US-004 |
| US-003: JSON Output (P1) | 8 | 2 | US-003 |
| US-001: Analyse with Streaming (P1) | 11 | 4 | US-001 |
| US-005: Trace (P2) | 6 | 3 | US-005 |
| US-006: Compare (P2) | 6 | 2 | US-006 |
| US-007: Markdown Output (P2) | 6 | 2 | US-007 |
| Polish | 8 | 3 | - |

---

## Phase 1: Setup

**Goal**: Initialize CLI module structure and dependencies

- [x] T001 [P] Add CLI dependencies to package.json: ink, @inkjs/ui, commander, chalk
- [x] T002 [P] Create src/cli/ directory structure per plan.md
- [x] T003 [P] Create src/cli/index.ts with public exports stub
- [x] T004 [P] Create src/cli/types.ts with CLI-specific types from contracts/interfaces.ts
- [x] T005 Create tsconfig.json JSX configuration for Ink React components
- [x] T006 Verify TypeScript compilation with new dependencies

**Checkpoint**: Setup complete
- [x] All dependencies installed
- [x] Directory structure created
- [x] TypeScript compiles without errors

---

## Phase 2: Foundational

**Goal**: Core infrastructure before user stories

### CLI Utilities

- [x] T007 [P] Create src/cli/utils/output.ts with getOutputMode() function (FR-012)
- [x] T008 [P] Create src/cli/utils/colors.ts with NO_COLOR support (FR-014, NFR-005)
- [x] T009 [P] Create src/cli/utils/terminal.ts with width detection (NFR-002)
- [x] T010 Create src/cli/utils/index.ts exporting all utilities

### Error Handling

- [x] T011 [P] Create src/errors/cli.ts with CLI-specific error classes
- [x] T012 Update src/errors/index.ts to export CLI errors

### Commander.js Program

- [x] T013 Create src/cli/program.ts with Commander.js program skeleton (FR-001)
- [x] T014 Register global options (--json, --markdown, --plain, --verbose, --fail-on-findings)
- [x] T015 Update src/cli.ts entry point to use new program.ts
- [x] T016 Wire program to export version from package.json (FR-003)

**Checkpoint**: Foundation ready
- [x] Utilities work independently
- [x] Error classes defined
- [x] `agentlint --version` works
- [x] All tests pass

---

## Phase 3: US-002 - Help & Version (P1)

**Goal**: Developers can see help text and version information
**Requirements**: FR-002, FR-003

### Tests

- [x] T017 [P] [US-002] Unit test for --help output in tests/unit/cli/help.test.ts
- [x] T018 [P] [US-002] Unit test for --version output in tests/unit/cli/version.test.ts

### Implementation

- [x] T019 [US-002] Configure Commander help text for all commands (FR-002)
- [x] T020 [US-002] Add command descriptions and examples to help
- [x] T021 [US-002] Implement custom help formatter matching CLI guidelines

**Checkpoint**: US-002 complete
- [x] `agentlint --help` shows all commands with descriptions
- [x] `agentlint <command> --help` shows detailed help
- [x] `agentlint --version` shows semver version
- [x] All tests pass

---

## Phase 4: US-004 - Scan for AI Configurations (P1)

**Goal**: Developers can discover AI configuration files
**Requirements**: FR-001

### Tests

- [x] T022 [P] [US-004] Unit test for scan command in tests/unit/cli/commands/scan.test.ts
- [x] T023 [P] [US-004] Integration test for scan in tests/integration/cli/scan.test.ts

### Implementation

- [x] T024 [US-004] Create src/cli/commands/scan.ts command handler
- [x] T025 [US-004] Implement config file discovery (CLAUDE.md, .cursorrules, etc.)
- [x] T026 [US-004] Format scan results for terminal output
- [x] T027 [US-004] Handle "no configs found" case with helpful message

**Checkpoint**: US-004 complete
- [x] `agentlint scan` discovers and lists AI config files
- [x] Multiple config types identified correctly
- [x] No configs case shows helpful setup instructions
- [x] All tests pass

---

## Phase 5: US-003 - Export Results to JSON (P1)

**Goal**: CI/CD integration with JSON output
**Requirements**: FR-004, FR-012, FR-016

### Tests

- [x] T028 [P] [US-003] Unit test for JSON formatter in tests/unit/cli/formatters/json.test.ts
- [x] T029 [P] [US-003] Integration test for --json flag in tests/integration/cli/json-output.test.ts

### Implementation

- [x] T030 [US-003] Create src/cli/formatters/json.ts implementing IJSONFormatter
- [x] T031 [US-003] Implement formatStreamChunk() for JSON Lines streaming
- [x] T032 [US-003] Implement formatComplete() for single JSON object output
- [x] T033 [US-003] Auto-detect non-TTY and switch to JSON (FR-012)
- [x] T034 [US-003] Implement --fail-on-findings exit code logic (FR-016)
- [x] T035 [US-003] Update scan command to support --json flag

**Checkpoint**: US-003 complete
- [x] `agentlint scan --json | jq .` succeeds
- [x] Piped output defaults to JSON
- [x] --fail-on-findings exits with code 1 when findings present
- [x] All tests pass

---

## Phase 6: US-001 - Analyse with Streaming Output (P1)

**Goal**: Real-time progress and findings during analysis
**Requirements**: FR-001, FR-005, FR-006, FR-015

### Tests

- [x] T036 [P] [US-001] Unit test for Progress component in tests/unit/cli/components/Progress.test.tsx
- [x] T037 [P] [US-001] Unit test for FindingsList component in tests/unit/cli/components/FindingsList.test.tsx
- [x] T038 [P] [US-001] Integration test for analyse command in tests/integration/cli/analyse.test.ts

### Ink Components

- [x] T039 [US-001] Create src/cli/components/Progress.tsx with Spinner from @inkjs/ui (FR-006)
- [x] T040 [US-001] Create src/cli/components/FindingsList.tsx using StatusMessage (FR-005)
- [x] T041 [US-001] Create src/cli/components/Summary.tsx for analysis summary
- [x] T042 [US-001] Create src/cli/components/App.tsx root component

### Command Implementation

- [x] T043 [US-001] Create src/cli/commands/analyse.ts command handler
- [x] T044 [US-001] Wire orchestrator.run() to Ink rendering (depends on T042, T043)
- [x] T045 [US-001] Implement --config-only and --sessions-only flags (FR-015)
- [x] T046 [US-001] Handle analysis errors with partial results display

**Checkpoint**: US-001 complete
- [x] `agentlint analyse` shows spinner with current phase
- [x] Findings appear immediately as discovered
- [x] Summary shows total findings and recommendations
- [x] Error case shows error with partial results
- [x] All tests pass

---

## Phase 7: US-005 - Trace Issue to Origin (P2)

**Goal**: Visualize causal chain for findings
**Requirements**: FR-007

### Tests

- [x] T047 [P] [US-005] Unit test for CausalTree component in tests/unit/cli/components/CausalTree.test.tsx
- [x] T048 [P] [US-005] Integration test for trace command in tests/integration/cli/trace.test.ts

### Implementation

- [x] T049 [US-005] Create src/cli/components/CausalTree.tsx with box-drawing characters (FR-007)
- [x] T050 [US-005] Create src/cli/commands/trace.ts command handler
- [x] T051 [US-005] Implement finding lookup by ID
- [x] T052 [US-005] Handle "finding not found" error case

**Checkpoint**: US-005 complete
- [x] `agentlint trace <id>` shows ASCII tree visualization
- [x] Tree shows issue → origin → root cause → recommendation
- [x] JSON output includes causal chain structure
- [x] Invalid ID shows clear error message
- [x] All tests pass

---

## Phase 8: US-006 - Compare Against Baseline (P2)

**Goal**: Show improvement over time
**Requirements**: FR-009

### Tests

- [x] T053 [P] [US-006] Unit test for CompareView component in tests/unit/cli/components/CompareView.test.tsx
- [x] T054 [US-006] Integration test for compare command in tests/integration/cli/compare.test.ts

### Implementation

- [x] T055 [US-006] Create src/cli/components/CompareView.tsx with delta indicators (FR-009)
- [x] T056 [US-006] Create src/cli/commands/compare.ts command handler
- [x] T057 [US-006] Create src/cli/commands/baseline.ts command handler
- [x] T058 [US-006] Handle "no baseline" error case

**Checkpoint**: US-006 complete
- [x] `agentlint baseline` captures current state
- [x] `agentlint compare` shows delta with +/- indicators
- [x] Improved metrics shown in green (↓), worsened in red (↑)
- [x] No baseline case shows helpful error
- [x] All tests pass

---

## Phase 9: US-007 - Export Results to Markdown (P2)

**Goal**: Formatted reports for documentation
**Requirements**: FR-008

### Tests

- [x] T059 [P] [US-007] Unit test for Markdown formatter in tests/unit/cli/formatters/markdown.test.ts
- [x] T060 [US-007] Integration test for --markdown flag in tests/integration/cli/markdown-output.test.ts

### Implementation

- [x] T061 [US-007] Create src/cli/formatters/markdown.ts implementing IOutputFormatter
- [x] T062 [US-007] Implement findings table format in Markdown
- [x] T063 [US-007] Implement causal traces as nested lists
- [x] T064 [US-007] Update commands to support --markdown flag

**Checkpoint**: US-007 complete
- [x] `agentlint analyse --markdown` outputs valid Markdown
- [x] Markdown includes summary, findings table, recommendations
- [x] Causal traces render as nested lists
- [x] All tests pass

---

## Phase 10: Polish

**Goal**: Final quality and documentation

### Remaining Commands

- [x] T065 Create src/cli/commands/recommend.ts stub (placeholder for EP05+)
- [x] T066 Create src/cli/commands/validate.ts stub (placeholder for EP05+)
- [x] T067 Create src/cli/commands/learn.ts with subcommands (FR-011, FR-017)

### Quality

- [x] T068 [P] Create src/cli/formatters/plain.ts for --plain output (FR-013)
- [x] T069 [P] Add startup time performance test (NFR-001: < 100ms)
- [x] T070 [P] Add memory usage test (NFR-004: < 100MB)

### Final Verification

- [x] T071 Run full CI pipeline (lint, format, typecheck, test, build)
- [x] T072 Verify all acceptance criteria from spec.md

**Checkpoint**: EP04 complete
- [x] All P1 user stories pass acceptance criteria
- [x] Test coverage > 80% for CLI components
- [x] Command startup < 100ms
- [x] CI pipeline passes
- [x] Manual verification of quickstart.md scenarios

---

## MVP Scope

Minimum viable implementation (P1 user stories only):

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1: Setup | T001-T006 (6) | Initialize CLI module |
| Phase 2: Foundational | T007-T016 (10) | Core utilities and program |
| Phase 3: US-002 | T017-T021 (5) | Help & Version |
| Phase 4: US-004 | T022-T027 (6) | Scan command |
| Phase 5: US-003 | T028-T035 (8) | JSON output |
| Phase 6: US-001 | T036-T046 (11) | Analyse with streaming |

**MVP Total**: 46 tasks (T001-T046)

After MVP, implement P2 user stories:
- Phase 7: US-005 (Trace) - T047-T052 (6 tasks)
- Phase 8: US-006 (Compare) - T053-T058 (6 tasks)
- Phase 9: US-007 (Markdown) - T059-T064 (6 tasks)
- Phase 10: Polish - T065-T072 (8 tasks)

**Full Feature**: 72 tasks

---

## Execution Notes

### Parallelization
- Tasks marked `[P]` can run in parallel within their phase
- Never start a phase until the previous phase checkpoint passes
- Within a phase, complete non-parallel tasks in order

### Test-First Development
- Each user story phase starts with tests
- Write failing tests before implementation
- Tests should verify acceptance criteria from spec.md

### Dependencies
- EP02 (Orchestration) must be complete - provides Orchestrator, StreamChunk
- EP03 (Persistence) must be complete - provides baseline and learning storage
- All CLI commands invoke these layers; no direct agent/storage logic in CLI

### File Naming Conventions
- Commands: `src/cli/commands/{command}.ts`
- Components: `src/cli/components/{Component}.tsx`
- Formatters: `src/cli/formatters/{format}.ts`
- Tests: `tests/{unit,integration}/cli/{category}/{name}.test.ts`

### Key Integration Points
```typescript
// Invoke orchestrator (US-001)
import { createOrchestrator } from '../orchestration';
for await (const chunk of orchestrator.run(task)) { /* render */ }

// Store baseline (US-006)
import { saveBaseline, compareBaselines } from '../persistence';

// Manage learnings (US-009)
import { saveLearning, queryLearnings } from '../persistence';
```
