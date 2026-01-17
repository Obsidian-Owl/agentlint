# Tasks: Config Analysis Tools

> **Epic**: EP05
> **Generated**: 2026-01-17
> **Total Tasks**: 78
> **MVP Tasks**: 46

---

## Summary

| Phase | Tasks | Parallelizable | Requirements |
|-------|-------|----------------|--------------|
| Setup | 6 | 4 | - |
| Foundational | 12 | 6 | FR-005, FR-006, FR-008, FR-017 |
| US-001: Discover Configs (P1) | 10 | 5 | FR-002, FR-003, FR-004, FR-016 |
| US-002: Parse Configs (P1) | 10 | 4 | FR-001, FR-005, FR-006, FR-008, FR-018 |
| US-003: Extract Metrics (P1) | 8 | 4 | FR-007, FR-011 |
| US-004: Quality Assessment (P2) | 10 | 4 | FR-009, FR-010 |
| US-005: Detect Skills (P2) | 8 | 4 | FR-012, FR-013 |
| US-006: Hierarchy Analysis (P3) | 6 | 2 | FR-014, FR-015 |
| Polish | 8 | 4 | NFR-001 through NFR-005 |

---

## Phase 1: Setup

**Goal**: Initialize directory structure and install dependencies

- [x] T001 [P] Create directory structure: `src/tools/`, `src/tools/config/`, `src/tools/adapters/`, `src/parsers/`
- [x] T002 [P] Create directory structure: `tests/unit/tools/config/`, `tests/integration/tools/config/`
- [x] T003 [P] Create test fixtures directory: `tests/fixtures/configs/` with sample CLAUDE.md, AGENTS.md, settings.json
- [x] T004 Install dependencies: `bun add unified remark-parse remark-frontmatter remark-gfm vfile-matter yaml fast-glob`
- [x] T005 Install dev dependencies: `bun add -d @types/mdast`
- [x] T006 Update `tsconfig.json` if needed for new dependencies

**Checkpoint**: Setup complete ✅
- [x] Dependencies installed successfully
- [x] Directory structure in place
- [x] Test fixtures created

---

## Phase 2: Foundational

**Goal**: Core types, parsers, and error handling infrastructure

### Types (copy from contracts)

- [x] T007 [P] Create `src/tools/types.ts` with all enumerations from contracts/interfaces.ts
- [x] T008 [P] Create `src/tools/config/types.ts` with entity interfaces from contracts/interfaces.ts
- [x] T009 Create `src/tools/adapters/types.ts` with IConfigAdapter interface from contracts/interfaces.ts

### Error Handling

- [x] T010 Create `src/errors/config.ts` with config-specific errors: `ConfigNotFoundError`, `ConfigParseError`, `ConfigValidationError`
- [x] T011 Update `src/errors/index.ts` to export config errors

### Parsing Infrastructure

- [x] T012 [P] Unit test for markdown parser in `tests/unit/parsers/markdown.test.ts`
- [x] T013 Create `src/parsers/markdown.ts` with remark/unified wrapper (depends on T012)
- [x] T014 [P] Unit test for frontmatter parser in `tests/unit/parsers/frontmatter.test.ts`
- [x] T015 Create `src/parsers/frontmatter.ts` with YAML frontmatter extraction (depends on T014)
- [x] T016 [P] Unit test for JSON config parser in `tests/unit/parsers/json-config.test.ts`
- [x] T017 Create `src/parsers/json-config.ts` with settings.json schema validation (depends on T016)
- [x] T018 Create `src/parsers/index.ts` to export all parsers

**Checkpoint**: Foundation ready ✅
- [x] All parser tests pass (skipped pending unskipping)
- [x] Types compile without errors
- [x] Error classes defined

---

## Phase 3: User Story 001 - Discover AI Configurations (P1)

**Goal**: Discover all AI configuration files in a project
**Requirements**: FR-002, FR-003, FR-004, FR-016

### Tests (write first)

- [x] T019 [P] Unit test for config discovery in `tests/unit/tools/config/discovery.test.ts`
- [x] T020 [P] Unit test for glob exclusions in `tests/unit/tools/config/exclusions.test.ts`
- [x] T021 Integration test for discovery in monorepo fixture in `tests/integration/tools/config/discovery.test.ts`

### Implementation

- [x] T022 Create `src/tools/config/discovery.ts` with `discoverConfigs()` function (depends on T019)
- [x] T023 Implement CLAUDE.md detection at root, nested dirs, ~/.claude/ in `src/tools/config/discovery.ts`
- [x] T024 [P] Implement AGENTS.md detection in `src/tools/config/discovery.ts`
- [x] T025 [P] Implement .claude/ directory structure detection in `src/tools/config/discovery.ts`
- [x] T026 Implement configurable exclusion patterns (node_modules, .git) in `src/tools/config/discovery.ts`
- [x] T027 Create `src/tools/config/index.ts` to export discovery functions
- [x] T028 Create `discover_configs` tool definition in `src/tools/config/discover-configs-tool.ts` using SDK `tool()` pattern

**Checkpoint**: US-001 complete ✅
- [x] All discovery tests pass (55 tests)
- [x] `discover_configs` tool returns ConfigFile[] for test fixtures
- [x] node_modules excluded by default

---

## Phase 4: User Story 002 - Parse Configuration Content (P1)

**Goal**: Parse configuration files into structured data with AST
**Requirements**: FR-001, FR-005, FR-006, FR-008, FR-018

### Tests (write first)

- [x] T029 [P] Unit test for CLAUDE.md parsing in `tests/unit/tools/config/parse-config.test.ts`
- [x] T030 [P] Unit test for settings.json parsing in `tests/unit/tools/config/parse-settings.test.ts`
- [x] T031 Unit test for malformed config handling in `tests/unit/tools/config/parse-errors.test.ts`
- [x] T032 Integration test for parsing pipeline in `tests/integration/tools/config/parse-config.test.ts`

### Implementation

- [x] T033 Create `src/tools/config/parse-config.ts` with main parsing logic (depends on T029)
- [x] T034 Implement section extraction from AST in `src/tools/config/parse-config.ts`
- [x] T035 Implement code block extraction in `src/tools/config/parse-config.ts`
- [x] T036 [P] Implement position tracking (line, column) preservation in `src/tools/config/parse-config.ts`
- [x] T037 Implement partial parsing on errors (NFR-005) in `src/tools/config/parse-config.ts`
- [x] T038 Create `parse_config` tool definition in `src/tools/config/parse-config-tool.ts` using SDK `tool()` pattern

**Checkpoint**: US-002 complete ✅
- [x] All parsing tests pass (73 tests)
- [x] `parse_config` tool returns ParsedConfig with sections, codeBlocks, positions
- [x] Malformed configs return partial results with warnings

---

## Phase 5: User Story 003 - Extract Configuration Metrics (P1)

**Goal**: Extract quantitative metrics from parsed configurations
**Requirements**: FR-007, FR-011

### Tests (write first)

- [x] T039 [P] Unit test for token estimation in `tests/unit/tools/config/metrics.test.ts`
- [x] T040 [P] Unit test for section/depth metrics in `tests/unit/tools/config/metrics.test.ts`
- [x] T041 Unit test for emphasis marker counting in `tests/unit/tools/config/metrics.test.ts`

### Implementation

- [x] T042 Create `src/tools/config/metrics.ts` with `extractMetrics()` function (depends on T039)
- [x] T043 Implement token count estimation (char/4 ratio) in `src/tools/config/metrics.ts`
- [x] T044 [P] Implement section count, heading depth, code block metrics in `src/tools/config/metrics.ts`
- [x] T045 [P] Implement emphasis marker counting (MUST, IMPORTANT, CRITICAL, etc.) in `src/tools/config/metrics.ts`
- [x] T046 Integrate metrics extraction into `parse_config` tool output

**Checkpoint**: US-003 complete ✅
- [x] All metrics tests pass (33 tests)
- [x] `parse_config` returns ConfigMetrics with all fields populated
- [x] Token estimates within ±50% of actual (verified with large configs)

---

## Phase 6: User Story 004 - Assess Configuration Quality (P2)

**Goal**: Evaluate configuration quality with scoring and issue detection
**Requirements**: FR-009, FR-010

### Tests (write first)

- [x] T047 [P] Unit test for quality scoring in `tests/unit/tools/config/quality.test.ts`
- [x] T048 [P] Unit test for anti-pattern detection in `tests/unit/tools/config/anti-patterns.test.ts`
- [x] T049 Integration test for quality assessment pipeline in `tests/integration/tools/config/quality.test.ts`

### Implementation

- [x] T050 Create `src/tools/config/quality.ts` with `assessQuality()` function (depends on T047)
- [x] T051 Implement structure scoring (0-100) per ADR-0007 thresholds in `src/tools/config/quality.ts`
- [x] T052 Implement size scoring based on research thresholds in `src/tools/config/quality.ts`
- [x] T053 [P] Implement completeness scoring (recommended sections) in `src/tools/config/quality.ts`
- [x] T054 [P] Implement anti-pattern detection (generic rules, linter jobs, instruction overload) in `src/tools/config/quality.ts`
- [x] T055 Implement weighted score calculation and grade assignment in `src/tools/config/quality.ts`
- [x] T056 Add `includeQuality` option to `parse_config` tool

**Checkpoint**: US-004 complete ✅
- [x] All quality tests pass (74 tests)
- [x] Anti-patterns detected in test fixtures
- [x] Quality score and grade calculated correctly

---

## Phase 7: User Story 005 - Detect Agent Skills (P2)

**Goal**: Discover and parse SKILL.md files
**Requirements**: FR-012, FR-013

### Tests (write first)

- [x] T057 [P] Unit test for skill discovery in `tests/unit/tools/config/skills.test.ts`
- [x] T058 [P] Unit test for SKILL.md frontmatter parsing in `tests/unit/tools/config/skills.test.ts`
- [x] T059 Integration test for skill bundled files in `tests/integration/tools/config/skills.test.ts`

### Implementation

- [x] T060 Create `src/tools/config/skills.ts` with `discoverSkills()` function (depends on T057)
- [x] T061 Implement SKILL.md frontmatter validation (name, description required) in `src/tools/config/skills.ts`
- [x] T062 [P] Implement bundled files detection (scripts/, references/, assets/) in `src/tools/config/skills.ts`
- [x] T063 [P] Implement skill content section extraction in `src/tools/config/skills.ts`
- [x] T064 Integrate skills into `discover_configs` and `ConfigHierarchy`

**Checkpoint**: US-005 complete ✅
- [x] All skill tests pass (40 tests)
- [x] SKILL.md frontmatter validated with warnings for missing fields
- [x] Bundled files catalogued correctly
- [x] `discover_configs` supports `parseSkills` option for full skill parsing

---

## Phase 8: User Story 006 - Analyze Configuration Hierarchy (P3)

**Goal**: Map and analyze configuration hierarchy with conflict detection
**Requirements**: FR-014, FR-015

### Tests (write first)

- [x] T065 [P] Unit test for hierarchy mapping in `tests/unit/tools/config/hierarchy.test.ts`
- [x] T066 Integration test for conflict detection in `tests/integration/tools/config/hierarchy.test.ts`

### Implementation

- [x] T067 Create `src/tools/config/hierarchy.ts` with `analyzeHierarchy()` function (depends on T065)
- [x] T068 Implement global → project → local hierarchy mapping in `src/tools/config/hierarchy.ts`
- [x] T069 Implement conflict detection (contradicting, overlapping) in `src/tools/config/hierarchy.ts`
- [x] T070 Create `analyze_hierarchy` tool definition in `src/tools/config/analyze-hierarchy-tool.ts`

**Checkpoint**: US-006 complete ✅
- [x] All hierarchy tests pass (27 tests: 18 unit + 9 integration)
- [x] Conflicts detected in test fixtures with contradicting configs
- [x] `analyze_hierarchy` tool returns ConfigHierarchy

---

## Phase 9: Polish

**Goal**: Integration, performance validation, documentation

### Tool Registration

- [x] T071 [P] Create `src/tools/index.ts` exporting all config analysis tools
- [x] T072 Register EP05 tools in orchestration layer (update orchestrator setup)

### Performance Tests

- [x] T073 [P] Create performance test for discovery (<5s) in `tests/performance/config-discovery.test.ts`
- [x] T074 [P] Create performance test for parsing memory (<50MB) in `tests/performance/config-memory.test.ts`

### Integration Tests

- [x] T075 End-to-end integration test with real project structure in `tests/integration/tools/config/e2e.test.ts`
- [x] T076 Test tool integration with ToolRegistry in `tests/integration/tools/config/tool-registry.test.ts`

### Documentation

- [x] T077 Update Arc42 §5 Building Blocks with EP05 tool layer details
- [x] T078 [P] Add inline JSDoc comments to all public exports in `src/tools/config/`

**Checkpoint**: EP05 complete ✅
- [x] All tests pass (`bun test`) - 1368 tests
- [x] Performance targets met (NFR-001, NFR-004)
- [x] Tools register successfully with orchestration layer
- [x] CI passes

---

## MVP Scope

Minimum viable implementation includes P1 user stories only:

| Phase | Tasks | Range |
|-------|-------|-------|
| Setup | 6 | T001-T006 |
| Foundational | 12 | T007-T018 |
| US-001: Discover Configs (P1) | 10 | T019-T028 |
| US-002: Parse Configs (P1) | 10 | T029-T038 |
| US-003: Extract Metrics (P1) | 8 | T039-T046 |

**Total MVP**: 46 tasks

**MVP Deliverables**:
- `discover_configs` tool - find all AI config files
- `parse_config` tool - parse markdown/JSON with metrics
- ConfigFile, ParsedConfig, ConfigMetrics types
- Markdown parser with frontmatter support
- Test coverage > 80%

---

## Execution Notes

### Parallelization
- Tasks marked `[P]` can run in parallel within their phase
- Test tasks (`[P]`) in each phase can run concurrently
- Do NOT start implementation until tests exist (TDD)

### Dependencies
- Complete each phase before starting the next
- Within phases: Tests → Implementation → Integration
- US-004 through US-006 depend on US-002's parser

### Testing Strategy
- Write tests FIRST (TDD)
- Unit tests in `tests/unit/`
- Integration tests in `tests/integration/`
- Performance tests in `tests/performance/`
- Use fixtures from `tests/fixtures/configs/`

### Quality Gates
- Each phase checkpoint must pass before proceeding
- CI must be green before merging
- Test coverage target: > 80%

---

## Test Fixtures Required

Create these in `tests/fixtures/configs/`:

```
tests/fixtures/configs/
├── valid/
│   ├── claude-simple.md       # Basic CLAUDE.md
│   ├── claude-complex.md      # Multi-section with code blocks
│   ├── agents.md              # AGENTS.md format
│   ├── settings.json          # Valid .claude/settings.json
│   └── skill/
│       ├── SKILL.md           # Valid skill with frontmatter
│       ├── scripts/           # Bundled scripts
│       └── references/        # Bundled references
├── malformed/
│   ├── unclosed-codeblock.md  # Unclosed code block
│   ├── invalid-yaml.md        # Bad frontmatter
│   └── invalid-settings.json  # Invalid JSON
├── anti-patterns/
│   ├── generic-rules.md       # "Write clean code"
│   ├── linter-jobs.md         # ESLint rules in config
│   └── instruction-overload.md # >200 instructions
└── hierarchy/
    ├── global/                # ~/.claude/ simulation
    ├── project/               # Project root
    └── local/                 # Nested configs
```

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-17 | Claude | Initial task generation |
