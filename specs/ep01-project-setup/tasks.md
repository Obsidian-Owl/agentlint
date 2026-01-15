# Tasks: Project Setup

> **Epic**: EP01
> **Generated**: 2026-01-15
> **Total Tasks**: 42
> **MVP Tasks**: 28

---

## Summary

| Phase | Tasks | Parallelizable | Priority |
|-------|-------|----------------|----------|
| Setup | 8 | 5 | P1 |
| Foundational | 6 | 3 | P1 |
| US1: Contributor Setup | 6 | 3 | P1 |
| US2: CI Validation | 4 | 2 | P1 |
| US3: Binary Distribution | 4 | 2 | P1 |
| US4: npm Fallback | 3 | 1 | P2 |
| US5: Release Pipeline | 5 | 2 | P2 |
| US6: Self-Update | 4 | 2 | P3 |
| Polish | 2 | 1 | - |

---

## Phase 1: Setup

**Goal**: Initialize project structure and configuration files

- [x] T001 [P] Create directory structure: `src/`, `src/commands/`, `tests/`, `scripts/`
- [x] T002 [P] Initialize package.json with name `@agentlint/cli`, version `0.1.0`
- [x] T003 [P] Create tsconfig.json with strict mode, ESNext target
- [x] T004 [P] Create bunfig.toml for Bun configuration
- [x] T005 [P] Create .gitignore with node_modules, dist, coverage patterns
- [x] T006 Create .eslintrc.cjs with TypeScript strict rules
- [x] T007 Create .prettierrc with project formatting rules
- [x] T008 Run `bun install` to generate lockfile

**Checkpoint**: Setup complete
- [x] Directory structure exists
- [x] `bun install` succeeds
- [x] Configuration files valid

---

## Phase 2: Foundational

**Goal**: Core infrastructure before user stories

- [x] T009 Create src/types/index.ts with Platform, Architecture, Binary, Release types
- [x] T010 [P] Create src/version.ts with VersionInfo interface and getVersion() function
- [x] T011 [P] Create src/errors/index.ts with ExitCode constants and error types
- [x] T012 Create src/cli.ts with minimal CLI entry point (--version, --help)
- [x] T013 Add "bin" field to package.json pointing to src/cli.ts
- [x] T014 [P] Create README.md with project overview and badges

**Checkpoint**: Foundation ready
- [x] `bun run src/cli.ts --version` outputs version
- [x] Types compile without errors
- [x] Entry point is executable

---

## Phase 3: User Story 1 - Contributor Setup (P1)

**Goal**: Clone, install, and test in under 5 minutes
**Requirements**: FR-001, FR-002, FR-003, FR-004, FR-005

### Tests

- [x] T015 [P] [US1] Create tests/cli.test.ts with basic CLI smoke tests
- [x] T016 [P] [US1] Create tests/version.test.ts to verify version output

### Implementation

- [x] T017 [US1] Add build script to package.json: `"build": "bun build src/cli.ts --outdir dist"`
- [x] T018 [US1] Add lint script: `"lint": "eslint src tests --ext .ts"`
- [x] T019 [US1] Add format script: `"format": "prettier --write src tests"`
- [x] T020 [US1] Create CONTRIBUTING.md with setup instructions

**Checkpoint**: US1 complete
- [x] `bun install` succeeds (< 30s)
- [x] `bun test` runs and passes
- [x] `bun run lint` validates code
- [x] `bun run build` compiles TypeScript

---

## Phase 4: User Story 2 - CI Validation (P1)

**Goal**: PRs validated automatically via GitHub Actions
**Requirements**: FR-006

### Tests

- [x] T021 [P] [US2] Verify CI workflow syntax with `actionlint` (manual or CI)

### Implementation

- [x] T022 [US2] Create .github/workflows/ci.yml with lint, typecheck, test jobs
- [x] T023 [P] [US2] Add typecheck script: `"typecheck": "tsc --noEmit"`
- [x] T024 [US2] Configure branch protection rules documentation in CONTRIBUTING.md

**Checkpoint**: US2 complete
- [x] CI workflow passes on push
- [x] PR with lint error shows failed check
- [x] All jobs run in parallel where possible

---

## Phase 5: User Story 3 - Binary Distribution (P1)

**Goal**: Install via curl | bash without runtime dependency
**Requirements**: FR-007, FR-008

### Tests

- [x] T025 [P] [US3] Test install.sh locally on current platform

### Implementation

- [x] T026 [US3] Add build:binary script: `"build:binary": "bun build src/cli.ts --compile --outfile dist/agentlint"`
- [x] T027 [US3] Create scripts/install.sh with platform detection and download logic
- [x] T028 [US3] Update CLI to show platform/arch in --version output

**Checkpoint**: US3 complete
- [x] `bun run build:binary` produces executable < 50MB
- [x] Binary runs: `./dist/agentlint --version`
- [x] Install script detects platform correctly

---

## Phase 6: User Story 4 - npm Fallback (P2)

**Goal**: Install via npm for Node.js users
**Requirements**: FR-009

### Tests

- [x] T029 [US4] Test npm pack and local install

### Implementation

- [x] T030 [P] [US4] Add engines field to package.json: `"node": ">=22.0.0"`
- [x] T031 [US4] Configure package.json for npm publishing (files, main, types)

**Checkpoint**: US4 complete
- [x] `npm pack` creates valid tarball
- [x] Local install works: `npm install -g ./agentlint-cli-0.1.0.tgz`

---

## Phase 7: User Story 5 - Release Pipeline (P2)

**Goal**: Automated releases on git tag
**Requirements**: FR-010, FR-011

### Tests

- [x] T032 [P] [US5] Test release workflow with `act` (local GitHub Actions runner)

### Implementation

- [x] T033 [US5] Create .github/workflows/release.yml with build matrix (4 platforms)
- [x] T034 [US5] Add checksum generation to release workflow
- [x] T035 [US5] Configure GitHub Release creation with auto-generated notes
- [x] T036 [US5] Add npm publish step to release workflow

**Checkpoint**: US5 complete
- [x] Release workflow builds all 4 platform binaries
- [x] Checksums generated for each binary
- [x] npm package published on release

---

## Phase 8: User Story 6 - Self-Update (P3)

**Goal**: Update binary without reinstalling
**Requirements**: FR-012, FR-013

### Tests

- [x] T037 [P] [US6] Create tests/commands/update.test.ts with mock network calls
- [x] T038 [P] [US6] Test checksum verification logic

### Implementation

- [x] T039 [US6] Create src/commands/update.ts with update logic
- [x] T040 [US6] Wire update command into CLI entry point

**Checkpoint**: US6 complete
- [x] `agentlint update` checks for new version
- [x] Checksum verification works
- [x] Network failures handled gracefully

---

## Phase 9: Polish

**Goal**: Final validation and documentation

- [x] T041 [P] Validate all quickstart.md commands work end-to-end
- [x] T042 Review and update README.md with final badges and instructions

**Checkpoint**: Polish complete
- [x] All documentation accurate
- [x] All NFRs validated (build < 30s, binary < 50MB, CI < 5min)

---

## MVP Scope

Minimum viable implementation (P1 stories only):

| Phase | Tasks | Range |
|-------|-------|-------|
| Setup | 8 | T001-T008 |
| Foundational | 6 | T009-T014 |
| US1: Contributor Setup | 6 | T015-T020 |
| US2: CI Validation | 4 | T021-T024 |
| US3: Binary Distribution | 4 | T025-T028 |

**Total MVP**: 28 tasks
**Full Feature**: 42 tasks

---

## Execution Notes

1. **Parallelization**: Tasks marked `[P]` can run concurrently within their phase
2. **Phase order**: Complete each phase before starting the next
3. **Tests first**: Write tests before implementation in story phases
4. **Checkpoints**: Verify checkpoint criteria before proceeding
5. **Dependencies**: Tasks without `[P]` may depend on earlier tasks in the phase

### Blocking Dependencies

| Task | Depends On | Reason |
|------|------------|--------|
| T008 | T002-T004 | Needs package.json and configs |
| T012 | T009-T011 | CLI needs types and errors |
| T017-T019 | T012 | Scripts need CLI to exist |
| T022 | T017-T019 | CI runs the scripts |
| T027 | T026 | Install script downloads binary |

### NFR Validation Points

| NFR | Task | Validation |
|-----|------|------------|
| NFR-001 (Build < 30s) | T017 | Time `bun run build` |
| NFR-002 (Binary < 50MB) | T026 | Check `ls -lh dist/agentlint` |
| NFR-003 (CI < 5min) | T022 | Check workflow duration |
| NFR-004 (Coverage > 80%) | T015-T016 | Run `bun test --coverage` |
| NFR-005 (Startup < 500ms) | T028 | Time `./dist/agentlint --version` |
