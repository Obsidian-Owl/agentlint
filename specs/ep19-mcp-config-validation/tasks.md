# Tasks: MCP Config Validation

> **Epic**: EP19
> **Generated**: 2026-01-25
> **Total Tasks**: 55
> **MVP Tasks**: 36

---

## Summary

| Phase | Tasks | Parallelizable |
|-------|-------|----------------|
| Setup | 4 | 3 |
| Core Infrastructure | 8 | 4 |
| US1: Discover MCP Configs (P1) | 8 | 4 |
| US2: Validate Schema (P1) | 6 | 3 |
| US3: Validate Paths (P1) | 6 | 3 |
| US4: Validate Env Vars (P1) | 4 | 2 |
| US5: Transport Validation (P2) | 5 | 2 |
| US6: Anti-Pattern Detection (P2) | 4 | 2 |
| US7: Cross-ACT Compatibility (P2) | 2 | 1 |
| US8: Aggregate Validation (P3) | 2 | 1 |
| Tool Integration | 3 | 1 |
| Polish | 3 | 1 |

---

## Phase 1: Setup

**Goal**: Initialize project structure and dependencies

- [x] T001 [P] Add `jsonc-parser` dependency in package.json
- [x] T002 [P] Create directory structure `src/tools/config/mcp/` per plan.md
- [x] T003 [P] Create directory structure `src/tools/config/mcp/validators/`
- [x] T004 Create `src/tools/config/mcp/index.ts` module exports skeleton

**Checkpoint**: Setup complete
- [ ] Directory structure exists
- [ ] jsonc-parser available for import

---

## Phase 2: Core Infrastructure

**Goal**: JSONC parsing with position tracking, MCP types, Zod schemas
**Requirements**: FR-020 (position tracking)

### Types and Schemas

- [x] T005 [P] Create MCP type definitions in `src/tools/config/mcp/types.ts` (copy from contracts/interfaces.ts with adjustments)
- [x] T006 [P] Create standard MCP Zod schema in `src/tools/config/mcp/schemas.ts` (McpServerConfigSchema)
- [x] T007 [P] Create OpenCode-specific Zod schema in `src/tools/config/mcp/schemas.ts` (OpenCodeMcpConfigSchema)
- [x] T008 Add MCP issue code constants in `src/tools/config/mcp/types.ts` (MCP001-MCP024)

### Parser

- [x] T009 Implement JSONC parser wrapper in `src/tools/config/mcp/parser.ts` with `parseTree()` support
- [x] T010 Implement `offsetToPosition()` helper for line:column conversion in `src/tools/config/mcp/parser.ts`
- [x] T011 Implement `parseMcpConfig()` function that returns parsed config with position map

### Tests

- [x] T012 Write unit tests for JSONC parser in `__tests__/tools/config/mcp/parser.test.ts`

**Checkpoint**: Core infrastructure complete
- [ ] Types compile without errors
- [ ] Zod schemas validate sample configs
- [ ] Parser extracts positions correctly
- [ ] Unit tests pass

---

## Phase 3: User Story 1 - Discover MCP Configs (P1)

**Goal**: Discover MCP configuration files across ACT-specific locations
**Requirements**: FR-001, FR-002, FR-003, FR-004, FR-005

### Tests (write first)

- [ ] T013 [P] [US1] Unit test: discovers `.mcp.json` at project root in `__tests__/tools/config/mcp/discovery.test.ts`
- [ ] T014 [P] [US1] Unit test: discovers `~/.claude.json` user config in `__tests__/tools/config/mcp/discovery.test.ts`
- [ ] T015 [P] [US1] Unit test: discovers OpenCode configs in `__tests__/tools/config/mcp/discovery.test.ts`
- [ ] T016 [P] [US1] Unit test: handles non-existent configs gracefully in `__tests__/tools/config/mcp/discovery.test.ts`

### Implementation

- [ ] T017 [US1] Implement ACT config location registry in `src/tools/config/mcp/discovery.ts`
- [ ] T018 [US1] Implement `discoverMcpConfigs()` function in `src/tools/config/mcp/discovery.ts`
- [ ] T019 [US1] Implement user-level config detection (~/.claude.json, ~/.config/opencode/) in `src/tools/config/mcp/discovery.ts`
- [ ] T020 [US1] Create `get_mcp_configs` tool definition in `src/tools/config/mcp/get-mcp-configs-tool.ts` with SDK tool() pattern

**Checkpoint**: US1 complete and independently testable
- [ ] Tool discovers configs at all P1 ACT locations
- [ ] Returns structured McpConfigFile[] with ACT identification
- [ ] Unit tests pass

---

## Phase 4: User Story 2 - Validate MCP Config Schema (P1)

**Goal**: Validate MCP configurations against expected schema
**Requirements**: FR-006, FR-007, FR-008, FR-017

### Tests (write first)

- [ ] T021 [P] [US2] Unit test: valid config passes schema in `__tests__/tools/config/mcp/validators/schema.test.ts`
- [ ] T022 [P] [US2] Unit test: missing required field returns MCP001 in `__tests__/tools/config/mcp/validators/schema.test.ts`
- [ ] T023 [P] [US2] Unit test: invalid types return MCP002 with position in `__tests__/tools/config/mcp/validators/schema.test.ts`

### Implementation

- [ ] T024 [US2] Implement `validateSchema()` in `src/tools/config/mcp/validators/schema.ts` with position tracking
- [ ] T025 [US2] Implement unknown field detection (MCP016) in `src/tools/config/mcp/validators/schema.ts`
- [ ] T026 [US2] Create validators index in `src/tools/config/mcp/validators/index.ts`

**Checkpoint**: US2 complete and independently testable
- [ ] Schema validation detects MCP001, MCP002, MCP015, MCP016
- [ ] All issues include file:line:column
- [ ] Unit tests pass

---

## Phase 5: User Story 3 - Validate Executable Paths (P1)

**Goal**: Validate server executables exist and are reachable
**Requirements**: FR-009, FR-010, FR-011, FR-022

### Tests (write first)

- [ ] T027 [P] [US3] Unit test: absolute path existence check in `__tests__/tools/config/mcp/validators/path.test.ts`
- [ ] T028 [P] [US3] Unit test: relative path warning MCP010 in `__tests__/tools/config/mcp/validators/path.test.ts`
- [ ] T029 [P] [US3] Unit test: shell variable detection MCP011 in `__tests__/tools/config/mcp/validators/path.test.ts`

### Implementation

- [ ] T030 [US3] Implement `validatePath()` in `src/tools/config/mcp/validators/path.ts`
- [ ] T031 [US3] Implement known executable PATH check (npx, node, python, docker) in `src/tools/config/mcp/validators/path.ts`
- [ ] T032 [US3] Implement package name extraction from npx args in `src/tools/config/mcp/validators/path.ts`

**Checkpoint**: US3 complete and independently testable
- [ ] Path validation detects MCP003, MCP010, MCP011
- [ ] PathInfo context populated for agent reasoning
- [ ] Package names extracted from npx commands
- [ ] Unit tests pass

---

## Phase 6: User Story 4 - Validate Environment Variables (P1)

**Goal**: Validate environment variable configuration and detect secrets
**Requirements**: FR-012, FR-021

### Tests (write first)

- [ ] T033 [P] [US4] Unit test: sensitive name detection MCP014 in `__tests__/tools/config/mcp/validators/env.test.ts`
- [ ] T034 [P] [US4] Unit test: variable reference detection MCP023 in `__tests__/tools/config/mcp/validators/env.test.ts`

### Implementation

- [ ] T035 [US4] Implement `validateEnv()` in `src/tools/config/mcp/validators/env.ts` with SENSITIVE_PATTERNS
- [ ] T036 [US4] Implement variable reference pattern detection (${VAR}) in `src/tools/config/mcp/validators/env.ts`

**Checkpoint**: US4 complete and independently testable
- [ ] Env validation detects MCP014, MCP023
- [ ] EnvVarInfo[] populated with sensitive flags
- [ ] VariableRef[] extracted for agent context
- [ ] Unit tests pass

---

## Phase 7: User Story 5 - Transport Validation (P2)

**Goal**: Validate transport-specific configuration
**Requirements**: FR-013, FR-014, FR-015

### Tests (write first)

- [ ] T037 [P] [US5] Unit test: SSE deprecation warning MCP012 in `__tests__/tools/config/mcp/validators/transport.test.ts`
- [ ] T038 [P] [US5] Unit test: Docker -i flag check MCP005 in `__tests__/tools/config/mcp/validators/transport.test.ts`

### Implementation

- [ ] T039 [US5] Implement `validateTransport()` in `src/tools/config/mcp/validators/transport.ts`
- [ ] T040 [US5] Implement URL format validation (MCP004) in `src/tools/config/mcp/validators/transport.ts`
- [ ] T041 [US5] Add transport validator to index in `src/tools/config/mcp/validators/index.ts`

**Checkpoint**: US5 complete and independently testable
- [ ] Transport validation detects MCP004, MCP005, MCP012
- [ ] Unit tests pass

---

## Phase 8: User Story 6 - Anti-Pattern Detection (P2)

**Goal**: Detect common configuration anti-patterns
**Requirements**: FR-016

### Tests (write first)

- [ ] T042 [P] [US6] Unit test: deprecated package detection MCP013 in `__tests__/tools/config/mcp/validators/patterns.test.ts`
- [ ] T043 [P] [US6] Unit test: high timeout warning MCP017 in `__tests__/tools/config/mcp/validators/patterns.test.ts`

### Implementation

- [ ] T044 [US6] Implement `validatePatterns()` in `src/tools/config/mcp/validators/patterns.ts` with DEPRECATED_PACKAGES
- [ ] T045 [US6] Add patterns validator to index in `src/tools/config/mcp/validators/index.ts`

**Checkpoint**: US6 complete and independently testable
- [ ] Pattern detection identifies MCP013, MCP017, MCP020
- [ ] Unit tests pass

---

## Phase 9: User Story 7 - Cross-ACT Compatibility (P2)

**Goal**: Identify which ACTs recognize each config file
**Requirements**: FR-019

### Tests (write first)

- [ ] T046 [P] [US7] Unit test: ACT recognition for standard `.mcp.json` in `__tests__/tools/config/mcp/discovery.test.ts`

### Implementation

- [ ] T047 [US7] Implement ACT compatibility flags in `McpConfigFile` result in `src/tools/config/mcp/discovery.ts`

**Checkpoint**: US7 complete and independently testable
- [ ] Discovery returns `compatibleActs` for each config file
- [ ] MCP021 (ACT-specific location) and MCP022 (cross-ACT note) populated
- [ ] Unit tests pass

---

## Phase 10: User Story 8 - Aggregate Validation (P3)

**Goal**: Aggregate validation results across multiple config files
**Requirements**: FR-018

### Tests (write first)

- [ ] T048 [P] [US8] Unit test: aggregate validation across multiple files in `__tests__/tools/config/mcp/integration.test.ts`

### Implementation

- [ ] T049 [US8] Implement `aggregateValidation()` helper in `src/tools/config/mcp/validate-mcp-config-tool.ts`

**Checkpoint**: US8 complete and independently testable
- [ ] `validate_mcp_config` can accept multiple files and return aggregated results
- [ ] Summary includes per-ACT and per-severity breakdowns
- [ ] Unit tests pass

---

## Phase 11: Tool Integration

**Goal**: Complete SDK tools with rich output
**Requirements**: FR-017

- [ ] T050 Create `validate_mcp_config` tool definition in `src/tools/config/mcp/validate-mcp-config-tool.ts`
- [ ] T051 Update `src/tools/config/mcp/index.ts` to export all tools
- [ ] T052 Update `src/tools/config/index.ts` to export MCP module

**Checkpoint**: Tool integration complete
- [ ] Both tools registered and callable
- [ ] `bun run test` passes

---

## Phase 12: Polish

**Goal**: Documentation and final validation

- [ ] T053 [P] Write integration test for full discovery → validation flow in `__tests__/tools/config/mcp/integration.test.ts`
- [ ] T054 Verify all 24 issue codes (MCP001-MCP024) have test coverage
- [ ] T055 Run `bun run test` to verify all tests pass

**Checkpoint**: Epic complete
- [ ] All P1 user stories pass acceptance criteria
- [ ] Test coverage > 80% for MCP validation tools
- [ ] All issue codes documented and tested

---

## MVP Scope

Minimum viable implementation (P1 user stories only):

| Phase | Tasks | Description |
|-------|-------|-------------|
| Setup | T001-T004 | 4 tasks |
| Core Infrastructure | T005-T012 | 8 tasks |
| US1: Discover Configs | T013-T020 | 8 tasks |
| US2: Validate Schema | T021-T026 | 6 tasks |
| US3: Validate Paths | T027-T032 | 6 tasks |
| US4: Validate Env | T033-T036 | 4 tasks |

**Total MVP**: 36 tasks
**Full Feature**: 55 tasks

MVP delivers:
- `get_mcp_configs` tool discovering Claude Code, OpenCode, VS Code configs
- `validate_mcp_config` tool with schema, path, and env validation
- Structured issues with file:line:column references
- Rich context for agent reasoning

---

## Execution Notes

- Tasks marked [P] can run in parallel within their phase
- Complete each phase before starting the next
- Each user story should be testable after its checkpoint
- Run `bun run test` after each checkpoint (NOT `bun test`)
- Tools provide data for agent reasoning—no judgments in tool code

### Key Files Created

```
src/tools/config/mcp/
├── index.ts                      # Module exports
├── types.ts                      # MCP types and issue codes
├── schemas.ts                    # Zod schemas (standard + OpenCode)
├── parser.ts                     # JSONC parser with positions
├── discovery.ts                  # Multi-ACT config discovery
├── get-mcp-configs-tool.ts       # Discovery tool definition
├── validate-mcp-config-tool.ts   # Validation tool definition
└── validators/
    ├── index.ts                  # Validator exports
    ├── schema.ts                 # Schema validation
    ├── path.ts                   # Path/executable validation
    ├── env.ts                    # Env var validation
    ├── transport.ts              # Transport validation
    └── patterns.ts               # Anti-pattern detection
```

### Test Files Created

```
__tests__/tools/config/mcp/
├── parser.test.ts
├── discovery.test.ts
├── integration.test.ts
└── validators/
    ├── schema.test.ts
    ├── path.test.ts
    ├── env.test.ts
    ├── transport.test.ts
    └── patterns.test.ts
```
