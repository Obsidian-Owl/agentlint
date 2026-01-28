# Opencode SDK Migration

## TL;DR

> **Quick Summary**: Migrate agentlint from Claude Agent SDK to Opencode SDK using a big-bang approach, implementing self-managed server lifecycle, bundled MCP tools, and hybrid session management.
>
> **Deliverables**:
>
> - New orchestration layer using Opencode client-server model
> - Server lifecycle manager (start/stop Opencode server)
> - MCP server exposing all 40+ agentlint tools
> - Migrated ACT subagents as Opencode config-based agents
> - TUI connected to Opencode SSE event stream
> - Hybrid session storage (Opencode + agentlint metadata)
> - All tests passing with new SDK
>
> **Estimated Effort**: XL (3-4 weeks)
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: T01 → T02 → T03 → T06 → T16 → T17 → T20 → T23 → T24

---

## Context

### Original Request

Migrate agentlint from `@anthropic-ai/claude-agent-sdk` v0.2.7 to `@opencode-ai/sdk` (Opencode SDK).

### Interview Summary

**Key Discussions**:

- Server lifecycle: agentlint manages (starts on launch, stops on exit)
- Tool architecture: MCP server bundled with binary
- Migration strategy: Big-bang (no users, early dev phase)
- Session strategy: Hybrid (Opencode base + agentlint metadata)
- Breaking changes: Significant allowed, optimize for clean architecture

**Research Findings**:

- 57 total files import Claude Agent SDK across repo:
  - `src/`: 45 files (runtime code - IN SCOPE)
  - `tests/`: 10 files (test helpers/mocks - UPDATE)
  - `specs/`: 1 file (spec examples - UPDATE)
  - `spikes/ep02-sdk/`: 1 file (prototype - DELETE)
- 40+ tools need migration to new definition format
- ACT subagent system (6 files) needs config-based conversion
- TUI depends on `StreamChunk` from `processMessage()`
- Existing tech debt in SDK type probing and eslint-disable blocks

### Gap Analysis

**Identified Gaps** (addressed in plan):

- Server process management (crash recovery, port conflicts)
- Tool return format conversion (`{ content: [...] }` → simple returns)
- Streaming translation (AsyncIterable → SSE)
- Permission model change (callback → config)
- Test infrastructure (VCR cassettes tied to old SDK)

---

## Work Objectives

### Core Objective

Replace Claude Agent SDK with Opencode SDK while improving architecture quality and eliminating existing tech debt.

### Concrete Deliverables

- `src/opencode/` - New Opencode integration module
- `src/opencode/server.ts` - Server lifecycle manager
- `src/opencode/client.ts` - Opencode client wrapper
- `src/opencode/mcp-server.ts` - MCP server exposing tools
- `src/opencode/streaming.ts` - SSE → StreamChunk adapter
- `src/opencode/sessions.ts` - Hybrid session manager
- `opencode.json` - Opencode configuration
- `.opencode/agents/*.md` - Agent definitions
- Migrated tools in `src/tools/**/*.ts`
- Updated TUI in `src/tui/**/*.ts`

### Definition of Done

- [ ] `bun run test` passes with 100% of current tests
- [ ] `bun run typecheck` passes with zero errors
- [ ] No `@anthropic-ai/claude-agent-sdk` imports in `src/**` (runtime code)
- [ ] No `@anthropic-ai/claude-agent-sdk` imports in `tests/**` (test code)
- [ ] `spikes/ep02-sdk/` directory deleted (obsolete prototype)
- [ ] Server starts/stops cleanly on CLI launch/exit
- [ ] All 40+ tools accessible via MCP
- [ ] TUI receives real-time streaming
- [ ] Session persistence works across restarts

**Scope Boundaries**:

- **Runtime (`src/`)**: Full migration to Opencode SDK
- **Tests (`tests/`)**: Update SDK helpers, re-record VCR cassettes
- **Spikes (`spikes/ep02-sdk/`)**: Delete (obsolete exploration code)
- **Specs (`specs/`)**: Update any SDK examples in spec documentation

### Must Have

- Self-managed Opencode server lifecycle
- All existing tools available via MCP
- Real-time streaming to TUI
- Session state with findings and checkpoints
- Clean shutdown without orphan processes
- Local-first operation (Constitution I)

### Must NOT Have (Guardrails)

- External dependencies for server management (no systemd, no docker)
- Tools that make quality judgments (tool/agent boundary per CLAUDE.md)
- Adapter layer for backwards compatibility (big-bang approach)
- File-based tools in `.opencode/tools/` (bundled MCP only)
- Blocking synchronous operations in streaming path
- Hardcoded ports without conflict resolution

---

## Verification Strategy (MANDATORY)

### Test Decision

- **Infrastructure exists**: YES (bun runtime with test scripts)
- **User wants tests**: TDD for new modules, update existing tests
- **Framework**: bun test runner (via `bun run test` scripts per CLAUDE.md)

**CRITICAL**: Per CLAUDE.md, NEVER run `bun test` directly. Always use npm scripts:

- `bun run test` - Unit/integration tests (safe, no API calls)
- `bun run test:live` - E2E tests (requires API key)
- `bun run test:evals` - Evaluations (requires API key)

### Test Infrastructure Notes

- Existing VCR cassettes need re-recording for new SDK
- Integration tests need mock Opencode server
- E2E tests need real Opencode server running

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - Start Immediately):
├── T01: Add Opencode SDK dependency
├── T02: Create server lifecycle manager
└── T03: Create Opencode client wrapper

Wave 2 (Core Infrastructure - After Wave 1):
├── T04: Create MCP server skeleton
├── T05: Create tool definition adapter
├── T06: Create streaming adapter (SSE → StreamChunk)
└── T07: Create hybrid session manager

Wave 3 (Migration - After Wave 2):
├── T08: Migrate config tools (5 tools)
├── T09: Migrate session tools (11 tools)
├── T10: Migrate temporal tools (8 tools)
├── T11: Migrate recommendation tools (10 tools)
├── T12: Migrate causal tools (2 tools)
├── T13: Migrate skill tools (4 tools)
└── T14: Migrate security classifier (1 tool)

Wave 4 (Integration - After Wave 3):
├── T15: Convert ACT subagents to config
├── T16: Migrate orchestrator
├── T17: Update TUI integration
├── T18: Migrate permission handler
└── T19: Update prompt adapters

Wave 5 (Cleanup - After Wave 4):
├── T20: Remove old SDK dependency
├── T21: Update test infrastructure
├── T22: Fix remaining type errors
├── T23: Update documentation
└── T24: Final validation & tech debt audit

Critical Path: T01 → T02 → T03 → T06 → T16 → T17 → T20 → T23 → T24
Parallel Speedup: ~50% faster than sequential
```

### Dependency Matrix

| Task    | Depends On         | Blocks             | Can Parallelize With |
| ------- | ------------------ | ------------------ | -------------------- |
| T01     | None               | T02, T03, T04, T05 | None (first)         |
| T02     | T01                | T16                | T03                  |
| T03     | T01                | T04, T06, T07, T16 | T02                  |
| T04     | T01, T03           | T08-T14            | T05, T06, T07        |
| T05     | T01                | T08-T14            | T04, T06, T07        |
| T06     | T03                | T17                | T04, T05, T07        |
| T07     | T03                | T16                | T04, T05, T06        |
| T08-T14 | T04, T05           | T15, T16           | Each other           |
| T15     | T08-T14            | T16                | T17, T18, T19        |
| T16     | T02, T03, T07, T15 | T20                | T17, T18, T19        |
| T17     | T06, T16           | T20                | T18, T19             |
| T18     | T16                | T20                | T17, T19             |
| T19     | T16                | T20                | T17, T18             |
| T20     | T16, T17, T18, T19 | T21, T22           | None                 |
| T21     | T20                | T23                | T22                  |
| T22     | T20                | T23                | T21                  |
| T23     | T21, T22           | T24                | None                 |
| T24     | T23                | None (final)       | None                 |

### Agent Dispatch Summary

| Wave | Tasks   | Recommended Approach                                 |
| ---- | ------- | ---------------------------------------------------- |
| 1    | T01-T03 | Sequential start, parallel T02/T03                   |
| 2    | T04-T07 | All parallel                                         |
| 3    | T08-T14 | All parallel (7 tasks)                               |
| 4    | T15-T19 | Sequential T15→T16, then parallel T17-T19            |
| 5    | T20-T24 | Sequential T20, parallel T21/T22, then T23, then T24 |

---

## TODOs

### Wave 1: Foundation

- [x] **T01. Add Opencode SDK Dependency**

  **What to do**:
  - Add `@opencode-ai/sdk` to package.json dependencies
  - Run `bun install` to install
  - Verify TypeScript types are available
  - Create `src/opencode/index.ts` module entry point

  **Must NOT do**:
  - Remove old SDK yet (needed until migration complete)
  - Modify existing code in this task

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple dependency addition, low complexity
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commit for dependency change

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (first)
  - **Blocks**: T02, T03, T04, T05
  - **Blocked By**: None

  **References**:
  - `package.json:56-79` - Current dependencies section
  - Opencode SDK: `npm install @opencode-ai/sdk` (see Appendix A for API examples)

  **Acceptance Criteria**:
  - [ ] `@opencode-ai/sdk` in package.json dependencies
  - [ ] `bun install` completes without errors
  - [ ] `import { createOpencode } from '@opencode-ai/sdk'` type-checks
  - [ ] `src/opencode/index.ts` exists with module exports

  **Manual Verification**:
  - [ ] `bun run typecheck` → no errors for new imports

  **Commit**: YES
  - Message: `feat(opencode): add Opencode SDK dependency`
  - Files: `package.json`, `bun.lockb`, `src/opencode/index.ts`

---

- [x] **T02. Create Server Lifecycle Manager**

  **What to do**:
  - Create `src/opencode/server.ts` with `OpencodeServerManager` class
  - Implement `start()`: spawn `opencode serve` as child process
  - Implement `stop()`: graceful shutdown with SIGTERM, fallback SIGKILL
  - Implement port conflict detection (check if 4096 in use)
  - Implement health check (poll until server responds)
  - Handle crash recovery (restart on unexpected exit)
  - Register shutdown hooks (process.on('exit'), SIGINT, SIGTERM)
  - Create `IServerManager` interface for testability

  **Must NOT do**:
  - Use external process managers (systemd, pm2)
  - Hardcode port without configuration option
  - Block main thread during startup

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Process management requires careful error handling
  - **Skills**: [`dev-testing`]
    - `dev-testing`: Unit tests for lifecycle states

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T03)
  - **Blocks**: T16
  - **Blocked By**: T01

  **References**:
  - `src/orchestration/orchestrator.ts:596-634` - Existing Claude Code path resolution (similar pattern)
  - Node.js `child_process.spawn()` docs
  - Opencode CLI: `opencode serve --port 4096`

  **Acceptance Criteria**:
  - [ ] `OpencodeServerManager.start()` spawns server process
  - [ ] `OpencodeServerManager.stop()` cleanly terminates process
  - [ ] Port conflict detected before spawn attempt
  - [ ] Health check confirms server is ready before returning
  - [ ] Process exit handlers registered for cleanup
  - [ ] Unit tests cover: start, stop, port conflict, crash recovery

  **Manual Verification**:
  - [ ] Using interactive_bash (tmux):
    ```bash
    # Start agentlint, verify opencode process starts
    bun run src/cli.ts --help &
    pgrep -f "opencode serve"  # Should find process
    # Ctrl+C, verify cleanup
    pgrep -f "opencode serve"  # Should find nothing
    ```

  **Commit**: YES
  - Message: `feat(opencode): implement server lifecycle manager`
  - Files: `src/opencode/server.ts`, `tests/unit/opencode/server.test.ts`

---

- [x] **T03. Create Opencode Client Wrapper**

  **What to do**:
  - Create `src/opencode/client.ts` with `OpencodeClient` class
  - Implement `connect()`: create SDK client connected to local server
  - Implement `createSession()`: create new Opencode session
  - Implement `prompt()`: send prompt to session, return response
  - Implement `subscribe()`: subscribe to SSE event stream
  - Create `IOpencodeClient` interface for testability
  - Handle connection errors with retry logic
  - Implement client health check

  **Must NOT do**:
  - Expose raw SDK client (encapsulate for future flexibility)
  - Mix session management logic here (separate concern)

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: SDK integration requires understanding Opencode patterns
  - **Skills**: [`dev-testing`]
    - `dev-testing`: Unit tests with mocked server

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T02)
  - **Blocks**: T04, T06, T07, T16
  - **Blocked By**: T01

  **References**:
  - User-provided Opencode SDK examples
  - `src/orchestration/orchestrator.ts:290-327` - Current SDK options pattern

  **Acceptance Criteria**:
  - [ ] `OpencodeClient.connect()` creates SDK client
  - [ ] `OpencodeClient.createSession()` returns session object
  - [ ] `OpencodeClient.prompt()` sends prompt and returns result
  - [ ] `OpencodeClient.subscribe()` returns SSE event stream
  - [ ] Connection retry on transient failures
  - [ ] Unit tests with mocked responses

  **Manual Verification**:
  - [ ] Using REPL:
    ```typescript
    > const client = new OpencodeClient({ port: 4096 })
    > await client.connect()
    > const session = await client.createSession({ title: 'test' })
    > session.id  // Should be UUID
    ```

  **Commit**: YES
  - Message: `feat(opencode): implement client wrapper`
  - Files: `src/opencode/client.ts`, `tests/unit/opencode/client.test.ts`

---

### Wave 2: Core Infrastructure

- [x] **T04. Create MCP Server Skeleton**

  **What to do**:
  - Create `src/opencode/mcp-server.ts` with `AgentlintMcpServer` class
  - Implement MCP protocol server (JSON-RPC over stdio or HTTP)
  - Create `registerTool(definition)` method for adding tools
  - Create `start()` method to begin serving
  - Wire into Opencode via `opencode.json` mcp configuration
  - Create `opencode.json` with MCP server configuration

  **Must NOT do**:
  - Implement tool handlers here (separate concern)
  - Use `.opencode/tools/` file-based pattern

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: MCP protocol implementation requires precision
  - **Skills**: [`dev-testing`]
    - `dev-testing`: Protocol-level tests

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T05, T06, T07)
  - **Blocks**: T08-T14
  - **Blocked By**: T01, T03

  **References**:
  - `src/orchestration/tool-registry.ts` - Current `createSdkMcpServer()` pattern
  - MCP specification: https://spec.modelcontextprotocol.io/
  - See Appendix A.2 for `opencode.json` MCP config format

  **Acceptance Criteria**:
  - [ ] `AgentlintMcpServer` implements MCP protocol
  - [ ] Tools can be registered via `registerTool()`
  - [ ] Server responds to MCP `tools/list` request
  - [ ] Server responds to MCP `tools/call` request
  - [ ] `opencode.json` configures MCP server
  - [ ] Integration test: tool call round-trip

  **Manual Verification**:
  - [ ] `cat opencode.json | jq '.mcp.agentlint'` shows config
  - [ ] MCP server responds to ping

  **Commit**: YES
  - Message: `feat(opencode): implement MCP server skeleton`
  - Files: `src/opencode/mcp-server.ts`, `opencode.json`, `tests/unit/opencode/mcp-server.test.ts`

---

- [x] **T05. Create Tool Definition Adapter**

  **What to do**:
  - Create `src/opencode/tool-adapter.ts` with adapter functions
  - Create `adaptTool(oldDef)` to convert SDK tool → MCP tool
  - Handle schema conversion (Zod → JSON Schema)
  - Handle return format conversion (`{ content: [...] }` → simple)
  - Create `ToolDefinition` type for new format
  - Create type guards for validation

  **Must NOT do**:
  - Migrate actual tools here (just the adapter)
  - Change tool behavior (only format conversion)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward format conversion
  - **Skills**: [`dev-testing`]
    - `dev-testing`: Unit tests for conversion edge cases

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T04, T06, T07)
  - **Blocks**: T08-T14
  - **Blocked By**: T01

  **References**:
  - `src/tools/config/parse-config-tool.ts` - Example tool definition
  - `src/orchestration/tool-registry.ts:218-245` - Current name extraction hack

  **Acceptance Criteria**:
  - [ ] `adaptTool()` converts SDK tool to MCP format
  - [ ] Zod schemas converted to JSON Schema
  - [ ] Tool descriptions preserved
  - [ ] Return format adapter handles `_rawData` pattern
  - [ ] Unit tests cover all tool patterns in codebase

  **Manual Verification**:
  - [ ] Test with `parseConfigTool`:
    ```typescript
    > const adapted = adaptTool(parseConfigTool)
    > adapted.name  // 'parse_config'
    > adapted.inputSchema  // JSON Schema object
    ```

  **Commit**: YES
  - Message: `feat(opencode): implement tool definition adapter`
  - Files: `src/opencode/tool-adapter.ts`, `tests/unit/opencode/tool-adapter.test.ts`

---

- [x] **T06. Create Streaming Adapter (SSE → StreamChunk)**

  **What to do**:
  - Create `src/opencode/streaming.ts` with `StreamAdapter` class
  - Implement SSE event parsing from Opencode event stream
  - Map Opencode events to existing `StreamChunk` types
  - Handle event types: text, tool_start, tool_result, status
  - Preserve existing `StreamChunk` interface for TUI compatibility
  - Handle connection drops and reconnection

  **Must NOT do**:
  - Change `StreamChunk` interface (TUI depends on it)
  - Implement TUI changes here

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Streaming is critical path, must be reliable
  - **Skills**: [`dev-testing`]
    - `dev-testing`: Test various event sequences

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T04, T05, T07)
  - **Blocks**: T17
  - **Blocked By**: T03

  **References**:
  - `src/orchestration/orchestrator.ts:686-989` - Current `processMessage()` (300 lines)
  - `src/orchestration/types.ts` - `StreamChunk` interface
  - See Appendix A.3 for Opencode SSE event format

  **Acceptance Criteria**:
  - [ ] `StreamAdapter` converts SSE → `AsyncIterable<StreamChunk>`
  - [ ] Text events → `{ type: 'text', content: '...' }`
  - [ ] Tool events → `{ type: 'tool_start' | 'tool_result', ... }`
  - [ ] Status events → `{ type: 'status', ... }`
  - [ ] Connection drop triggers reconnection
  - [ ] Unit tests with mock SSE stream

  **Manual Verification**:
  - [ ] TUI displays text as it streams (visual check)

  **Commit**: YES
  - Message: `feat(opencode): implement streaming adapter`
  - Files: `src/opencode/streaming.ts`, `tests/unit/opencode/streaming.test.ts`

---

- [x] **T07. Create Hybrid Session Manager**

  **What to do**:
  - Create `src/opencode/sessions.ts` with `HybridSessionManager` class
  - Wrap Opencode session with agentlint metadata
  - Implement `startSession()`: create Opencode session + local metadata
  - Implement `saveCheckpoint()`: persist findings to local storage
  - Implement `resumeSession()`: restore from checkpoint
  - Store metadata alongside Opencode session ID
  - Use existing SQLite persistence layer

  **Must NOT do**:
  - Replace Opencode sessions entirely
  - Store sensitive data in Opencode sessions

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Session management is complex stateful logic
  - **Skills**: [`dev-testing`]
    - `dev-testing`: Test session lifecycle

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T04, T05, T06)
  - **Blocks**: T16
  - **Blocked By**: T03

  **References**:
  - `src/orchestration/orchestrator.ts:639-658` - Current `createInitialState()`
  - `src/orchestration/types.ts` - `SessionState` interface
  - `src/persistence/` - Existing SQLite storage

  **Acceptance Criteria**:
  - [ ] `HybridSessionManager.startSession()` creates both
  - [ ] `HybridSessionManager.saveCheckpoint()` persists metadata
  - [ ] `HybridSessionManager.resumeSession()` restores state
  - [ ] Opencode session ID linked to local metadata
  - [ ] Checkpoint includes findings, phase, tool cache
  - [ ] Unit tests cover full lifecycle

  **Manual Verification**:
  - [ ] Start session, add finding, checkpoint, resume → finding preserved

  **Commit**: YES
  - Message: `feat(opencode): implement hybrid session manager`
  - Files: `src/opencode/sessions.ts`, `tests/unit/opencode/sessions.test.ts`

---

### Wave 3: Tool Migration (Parallel)

- [x] **T08. Migrate Config Tools (5 tools)**

  **What to do**:
  - Migrate tools in `src/tools/config/`:
    - `parse-config-tool.ts`
    - `discover-configs-tool.ts`
    - `analyze-hierarchy-tool.ts`
    - `mcp/get-mcp-configs-tool.ts`
    - `mcp/validate-mcp-config-tool.ts`
  - Update imports: `tool` from adapter, not SDK
  - Update return format: remove `content` wrapper
  - Register with MCP server
  - Update tool tests

  **Must NOT do**:
  - Change tool business logic
  - Change tool names (API stability)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical migration, low judgment needed
  - **Skills**: [`dev-testing`]
    - `dev-testing`: Verify tool behavior unchanged

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T09-T14)
  - **Blocks**: T15, T16
  - **Blocked By**: T04, T05

  **References**:
  - `src/tools/config/parse-config-tool.ts` - Example (already read)
  - `src/opencode/tool-adapter.ts` - New tool format

  **Acceptance Criteria**:
  - [ ] All 5 tools use new format
  - [ ] No SDK imports in these files
  - [ ] Tools registered with MCP server
  - [ ] Unit tests pass with new format
  - [ ] Manual test: `parse_config` returns same data

  **Manual Verification**:
  - [ ] Call `parse_config` via MCP → returns parse result

  **Commit**: YES
  - Message: `refactor(tools): migrate config tools to Opencode format`
  - Files: `src/tools/config/*.ts`, `tests/unit/tools/config/*.test.ts`

---

- [x] **T09. Migrate Session Tools (11 tools)**

  **What to do**:
  - Migrate tools in `src/sessions/tools/`:
    - `get-session-timeline-tool.ts`
    - `get-tool-sequences-tool.ts`
    - `get-quality-signals-tool.ts`
    - `get-mcp-usage-tool.ts`
    - `get-permission-events-tool.ts`
    - `get-file-accesses-tool.ts`
    - `get-delegation-events-tool.ts`
    - `spawn-session-analyst.ts`
  - Migrate tools in `src/tools/sessions/`:
    - `search-sessions-tool.ts`
    - `get-session-stats-tool.ts`
    - `index-sessions-tool.ts`
  - Same migration pattern as T08

  **Must NOT do**:
  - Change session analysis logic
  - Remove `spawn-session-analyst` subagent invocation

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical migration
  - **Skills**: [`dev-testing`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T08, T10-T14)
  - **Blocks**: T15, T16
  - **Blocked By**: T04, T05

  **References**:
  - `src/sessions/tools/*.ts` - Tool files
  - `src/tools/sessions/*.ts` - Tool files

  **Acceptance Criteria**:
  - [ ] All 11 tools use new format
  - [ ] No SDK imports in these files
  - [ ] Unit tests pass

  **Commit**: YES
  - Message: `refactor(tools): migrate session tools to Opencode format`
  - Files: `src/sessions/tools/*.ts`, `src/tools/sessions/*.ts`

---

- [x] **T10. Migrate Temporal Tools (8 tools)**

  **What to do**:
  - Migrate tools in `src/temporal/tools/`:
    - `query-trends.ts`
    - `store-baseline.ts`
    - `conduct-review.ts`
    - `spawn-analyst.ts`
    - `get-review-history.ts`
    - `calculate-delta.ts`
    - `query-baseline.ts`
    - `list-baselines.ts`
  - Same migration pattern as T08

  **Must NOT do**:
  - Change temporal analysis logic
  - Break baseline comparison format

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical migration
  - **Skills**: [`dev-testing`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T08, T09, T11-T14)
  - **Blocks**: T15, T16
  - **Blocked By**: T04, T05

  **References**:
  - `src/temporal/tools/*.ts` - Tool files

  **Acceptance Criteria**:
  - [ ] All 8 tools use new format
  - [ ] No SDK imports in these files
  - [ ] Unit tests pass

  **Commit**: YES
  - Message: `refactor(tools): migrate temporal tools to Opencode format`
  - Files: `src/temporal/tools/*.ts`

---

- [x] **T11. Migrate Recommendation Tools (10 tools)**

  **What to do**:
  - Migrate tools in `src/recommendations/tools/`:
    - `add-event.ts`
    - `create-recommendation.ts`
    - `refine-recommendation.ts`
    - `update-status.ts`
    - `get-recommendation-summary.ts`
    - `spawn-advisor.ts`
    - `list-recommendations.ts`
    - `complete-recommendation.ts`
    - `get-recommendation.ts`
    - (verify count, may be 9)
  - Same migration pattern as T08

  **Must NOT do**:
  - Change recommendation generation logic
  - Alter recommendation data structures

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical migration
  - **Skills**: [`dev-testing`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T08-T10, T12-T14)
  - **Blocks**: T15, T16
  - **Blocked By**: T04, T05

  **References**:
  - `src/recommendations/tools/*.ts` - Tool files

  **Acceptance Criteria**:
  - [ ] All recommendation tools use new format
  - [ ] No SDK imports in these files
  - [ ] Unit tests pass

  **Commit**: YES
  - Message: `refactor(tools): migrate recommendation tools to Opencode format`
  - Files: `src/recommendations/tools/*.ts`

---

- [x] **T12. Migrate Causal Tools (2 tools)**

  **What to do**:
  - Migrate tools in `src/tools/causal/`:
    - `trace-issue-tool.ts`
    - `get-patterns-tool.ts`
  - Same migration pattern as T08

  **Must NOT do**:
  - Change causal tracing logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small scope, mechanical migration
  - **Skills**: [`dev-testing`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T08-T11, T13-T14)
  - **Blocks**: T15, T16
  - **Blocked By**: T04, T05

  **References**:
  - `src/tools/causal/*.ts` - Tool files

  **Acceptance Criteria**:
  - [ ] Both tools use new format
  - [ ] No SDK imports
  - [ ] Unit tests pass

  **Commit**: YES
  - Message: `refactor(tools): migrate causal tools to Opencode format`
  - Files: `src/tools/causal/*.ts`

---

- [x] **T13. Migrate Skill Tools (4 tools)**

  **What to do**:
  - Migrate tools in `src/skills/tools/`:
    - `index-skill-invocations-tool.ts`
    - `get-skill-invocations-tool.ts`
    - `get-skill-inventory-tool.ts`
    - `get-session-summaries-tool.ts`
  - Same migration pattern as T08

  **Must NOT do**:
  - Change skill detection logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical migration
  - **Skills**: [`dev-testing`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T08-T12, T14)
  - **Blocks**: T15, T16
  - **Blocked By**: T04, T05

  **References**:
  - `src/skills/tools/*.ts` - Tool files

  **Acceptance Criteria**:
  - [ ] All 4 tools use new format
  - [ ] No SDK imports
  - [ ] Unit tests pass

  **Commit**: YES
  - Message: `refactor(tools): migrate skill tools to Opencode format`
  - Files: `src/skills/tools/*.ts`

---

- [x] **T14. Migrate Security Classifier (1 tool)**

  **What to do**:
  - Migrate `src/security/classifier.ts`
  - Same migration pattern as T08

  **Must NOT do**:
  - Change security classification logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single tool, mechanical migration
  - **Skills**: [`dev-testing`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T08-T13)
  - **Blocks**: T15, T16
  - **Blocked By**: T04, T05

  **References**:
  - `src/security/classifier.ts` - Tool file

  **Acceptance Criteria**:
  - [ ] Tool uses new format
  - [ ] No SDK imports
  - [ ] Unit tests pass

  **Commit**: YES
  - Message: `refactor(tools): migrate security classifier to Opencode format`
  - Files: `src/security/classifier.ts`

---

### Wave 4: Integration

- [x] **T15. Convert ACT Subagents to Config**

  **What to do**:
  - Create `.opencode/agents/` directory
  - Convert `src/act/instructions/claude-code.ts` → `.opencode/agents/claude-code-analyzer.md`
  - Convert `src/act/instructions/generalized.ts` → `.opencode/agents/generalized-analyzer.md`
  - Update `opencode.json` with agent configuration
  - Update `src/act/registry.ts` to read from config
  - Preserve tool restrictions (no Task tool)
  - Delete old `buildACTSubagents()` code after migration

  **Must NOT do**:
  - Change agent prompts/behavior
  - Allow subagents to invoke other subagents (depth=1)

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Agent configuration requires understanding Opencode patterns
  - **Skills**: [`dev-testing`]

  **Parallelization**:
  - **Can Run In Parallel**: NO (must complete before T16)
  - **Parallel Group**: Wave 4 (sequential with T16)
  - **Blocks**: T16
  - **Blocked By**: T08-T14

  **References**:
  - `src/act/index.ts` - Current `buildACTSubagents()`
  - `src/act/instructions/claude-code.ts` - Claude Code analyzer
  - `src/act/instructions/generalized.ts` - Generalized analyzer
  - See Appendix A.4 for Opencode agent config format

  **Acceptance Criteria**:
  - [ ] `.opencode/agents/claude-code-analyzer.md` exists
  - [ ] `.opencode/agents/generalized-analyzer.md` exists
  - [ ] Agent prompts preserved exactly
  - [ ] Tool restrictions enforced in config
  - [ ] Agents invocable via Opencode
  - [ ] Unit tests verify agent configuration

  **Manual Verification**:
  - [ ] Invoke claude-code-analyzer via Opencode → responds correctly

  **Commit**: YES
  - Message: `refactor(act): convert subagents to Opencode config format`
  - Files: `.opencode/agents/*.md`, `opencode.json`, `src/act/*.ts`

---

- [x] **T16. Migrate Orchestrator**

  **What to do**:
  - Create `src/opencode/orchestrator.ts` as new entry point
  - Implement `OpencodeOrchestrator` class implementing `IOrchestrator`
  - Wire together: ServerManager, Client, SessionManager, StreamAdapter
  - Implement `run()`: start server → create session → prompt → stream
  - Implement `resume()`: restore session from checkpoint
  - Implement `interrupt()`: abort current prompt
  - Replace old `Orchestrator` usage in CLI
  - Delete or mark deprecated: `src/orchestration/orchestrator.ts`

  **Must NOT do**:
  - Change `IOrchestrator` interface (TUI depends on it)
  - Remove telemetry hooks

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Core orchestration is critical path
  - **Skills**: [`dev-testing`]

  **Parallelization**:
  - **Can Run In Parallel**: NO (core integration)
  - **Parallel Group**: Wave 4 (after T15)
  - **Blocks**: T17, T18, T19, T20
  - **Blocked By**: T02, T03, T07, T15

  **References**:
  - `src/orchestration/orchestrator.ts` - Current implementation (1009 lines)
  - `src/orchestration/types.ts` - `IOrchestrator` interface

  **Acceptance Criteria**:
  - [ ] `OpencodeOrchestrator` implements `IOrchestrator`
  - [ ] `run()` starts server and streams results
  - [ ] `resume()` restores from checkpoint
  - [ ] `interrupt()` aborts cleanly
  - [ ] Server stops on orchestrator dispose
  - [ ] Integration test: full run cycle

  **Manual Verification**:
  - [ ] `bun run src/cli.ts "Analyze my CLAUDE.md"` → streaming output

  **Commit**: YES
  - Message: `feat(opencode): implement Opencode orchestrator`
  - Files: `src/opencode/orchestrator.ts`, `src/cli.ts`

---

- [x] **T17. Update TUI Integration**

  **What to do**:
  - Update `src/tui/index.ts` to use new orchestrator
  - Verify `StreamChunk` flow works with new streaming adapter
  - Update any direct SDK type references
  - Test real-time streaming in TUI
  - Update TUI state management if needed

  **Must NOT do**:
  - Redesign TUI (out of scope)
  - Change user-facing behavior

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: TUI integration requires visual verification
  - **Skills**: [`dev-testing`, `frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T18, T19)
  - **Blocks**: T20
  - **Blocked By**: T06, T16

  **References**:
  - `src/tui/index.ts` - TUI entry point
  - `src/tui/state/app-reducer.ts` - State management
  - `src/orchestration/types.ts` - `StreamChunk` interface

  **Acceptance Criteria**:
  - [ ] TUI displays streaming text in real-time
  - [ ] Tool invocations shown in TUI (AgentStateIndicator shows "calling_tool")
  - [ ] Status updates displayed in StatusBar component
  - [ ] TUI tests pass: `bun run test tests/unit/tui`
  - [ ] Ink testing library snapshot tests pass (if any exist)

  **Manual Verification**:
  - [ ] Using interactive_bash (tmux):
    ```bash
    # Start TUI and verify streaming
    bun run src/cli.ts
    # Type a prompt, observe:
    # 1. Text appears incrementally (not all at once)
    # 2. Tool calls show spinner/indicator
    # 3. Status bar updates token count
    # 4. Ctrl+C interrupts cleanly
    ```
  - [ ] Compare with pre-migration TUI behavior (same user-visible elements)

  **Commit**: YES
  - Message: `refactor(tui): integrate with Opencode streaming`
  - Files: `src/tui/*.ts`, `src/tui/**/*.ts`

---

- [x] **T18. Migrate Permission Handler**

  **What to do**:
  - Update `src/tui/permissions/tui-permission-handler.ts`
  - Remove `PermissionResult` type from SDK
  - Create Opencode-compatible permission config
  - Update `opencode.json` with permission rules
  - Maintain TUI permission prompts for dangerous operations

  **Must NOT do**:
  - Remove permission checks
  - Auto-approve dangerous operations

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Config migration, moderate complexity
  - **Skills**: [`dev-testing`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T17, T19)
  - **Blocks**: T20
  - **Blocked By**: T16

  **References**:
  - `src/tui/permissions/tui-permission-handler.ts` - Current handler
  - `src/orchestration/can-use-tool.ts` - Current callback
  - See Appendix A.5 for Opencode permission config format

  **Acceptance Criteria**:
  - [ ] No `PermissionResult` SDK type imports
  - [ ] `opencode.json` has permission config
  - [ ] TUI still prompts for bash/edit
  - [ ] Unit tests pass

  **Commit**: YES
  - Message: `refactor(permissions): migrate to Opencode config-based permissions`
  - Files: `src/tui/permissions/*.ts`, `src/orchestration/can-use-tool.ts`, `opencode.json`

---

- [x] **T19. Update Prompt Adapters**

  **What to do**:
  - Update `src/prompts/adapters/claude-agent-sdk.ts`
  - Rename to `opencode.ts` or create new adapter
  - Update message format conversion for Opencode
  - Remove `SDKMessage` type dependency
  - Update prompt rendering for Opencode client

  **Must NOT do**:
  - Change prompt content (just format)
  - Remove PromptKit abstraction

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Format conversion, low complexity
  - **Skills**: [`dev-testing`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T17, T18)
  - **Blocks**: T20
  - **Blocked By**: T16

  **References**:
  - `src/prompts/adapters/claude-agent-sdk.ts` - Current adapter
  - `src/prompts/promptkit/types.ts` - PromptKit types

  **Acceptance Criteria**:
  - [ ] No `SDKMessage` imports
  - [ ] Prompts render correctly for Opencode
  - [ ] Unit tests pass

  **Commit**: YES
  - Message: `refactor(prompts): update adapter for Opencode format`
  - Files: `src/prompts/adapters/*.ts`

---

### Wave 5: Cleanup

- [x] **T20. Remove Old SDK Dependency**

  **What to do**:
  - Remove `@anthropic-ai/claude-agent-sdk` from package.json
  - Run `bun install` to update lockfile
  - Delete `src/orchestration/orchestrator.ts` (old implementation)
  - Delete `src/orchestration/tool-registry.ts` (old registry)
  - Delete or update `src/orchestration/can-use-tool.ts`
  - Grep for any remaining SDK imports and fix
  - Update barrel exports in `src/orchestration/index.ts`

  **Must NOT do**:
  - Leave any dead code
  - Break exports that other modules depend on

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Cleanup, straightforward deletion
  - **Skills**: [`git-master`]
    - `git-master`: Clean commit for removal

  **Parallelization**:
  - **Can Run In Parallel**: NO (final cleanup)
  - **Parallel Group**: Wave 5 (first)
  - **Blocks**: T21, T22
  - **Blocked By**: T16, T17, T18, T19

  **References**:
  - `package.json` - Dependency to remove
  - `src/orchestration/*.ts` - Files to delete

  **Acceptance Criteria**:
  - [ ] No `@anthropic-ai/claude-agent-sdk` in package.json
  - [ ] No SDK imports in `src/**` or `tests/**` (per DoD scope)
  - [ ] `bun run typecheck` passes
  - [ ] `bun run test` passes
  - [ ] Old orchestrator files deleted

  **Manual Verification**:
  - [ ] `grep -r "claude-agent-sdk" src/` returns nothing

  **Commit**: YES
  - Message: `chore: remove Claude Agent SDK dependency`
  - Files: `package.json`, `bun.lockb`, deleted files

---

- [x] **T21. Update Test Infrastructure**

  **What to do**:
  - Update `tests/utils/sdk-test-helpers.ts` for Opencode
  - Create mock Opencode server for unit tests
  - Re-record VCR cassettes in `tests/integration/recordings/*.json`
  - Update integration tests for new patterns
  - Ensure E2E tests work with real Opencode server
  - Delete `spikes/ep02-sdk/` directory (obsolete SDK prototype)
  - Update SDK references in `specs/ep02-orchestration-core/contracts/interfaces.ts` (spec example file)

  **Must NOT do**:
  - Delete tests without replacement
  - Skip re-recording cassettes

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Test infrastructure requires careful setup
  - **Skills**: [`dev-testing`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with T22)
  - **Blocks**: T23
  - **Blocked By**: T20

  **References**:
  - `tests/utils/sdk-test-helpers.ts` - Current SDK test helpers
  - `tests/integration/*.test.ts` - Integration tests
  - `tests/integration/recordings/*.json` - VCR cassettes (JSON format)
  - `spikes/ep02-sdk/` - Obsolete prototype to delete

  **Acceptance Criteria**:
  - [ ] Mock Opencode server available for tests
  - [ ] `bun run test` passes (NOT `bun test`)
  - [ ] VCR cassettes in `tests/integration/recordings/` updated
  - [ ] Integration tests use new patterns
  - [ ] E2E tests pass: `bun run test:live`
  - [ ] `spikes/ep02-sdk/` deleted
  - [ ] No SDK imports in test files

  **Manual Verification**:
  - [ ] `bun run test:live` passes
  - [ ] `ls spikes/ep02-sdk` returns "No such file or directory"
  - [ ] `grep -r "claude-agent-sdk" specs/` returns nothing

  **Commit**: YES
  - Message: `test: update test infrastructure for Opencode SDK`
  - Files: `tests/**/*.ts`, `tests/integration/recordings/*.json`, deleted `spikes/ep02-sdk/`

---

- [x] **T22. Fix Remaining Type Errors**

  **What to do**:
  - Run `bun run typecheck` and fix all errors
  - Remove eslint-disable comments that were SDK workarounds
  - Add proper types where `any` was used for SDK interop
  - Update type exports in index files

  **Must NOT do**:
  - Add new `any` types
  - Suppress errors without fixing

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Type cleanup, mechanical fixes
  - **Skills**: None needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with T21)
  - **Blocks**: T23
  - **Blocked By**: T20

  **References**:
  - `src/orchestration/orchestrator.ts:277-278, 691-692` - eslint-disable blocks
  - `src/orchestration/tool-registry.ts:221-238` - Type probing hack

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes with zero errors
  - [ ] No eslint-disable for SDK types
  - [ ] No `any` types for SDK interop
  - [ ] Clean type exports

  **Manual Verification**:
  - [ ] `bun run typecheck` → "Found 0 errors"

  **Commit**: YES
  - Message: `chore: fix type errors and remove SDK workarounds`
  - Files: various

---

- [x] **T23. Update Documentation & ADRs**

  **What to do**:

  **A. Create New ADR (ADR-0024: Opencode SDK Migration)**:
  - Document decision to migrate from Claude Agent SDK to Opencode SDK
  - Include rationale: server-side architecture, self-managed lifecycle, MCP bundling
  - Reference superseded ADRs: ADR-0002, ADR-0005, ADR-0010
  - Document consequences and migration approach taken

  **B. Supersede Existing ADRs** (add `status: superseded` + superseded-by reference):
  - `ADR-0002` (Agentic Framework Strategy) → Superseded by ADR-0024
  - `ADR-0005` (Tool Definition Pattern) → Superseded by ADR-0024
  - `ADR-0010` (Session State and Checkpointing) → Superseded by ADR-0024

  **C. Update Related ADRs** (add note about Opencode impact):
  - `ADR-0016` (MCP Integration Strategy) → Update: now using bundled MCP server
  - `ADR-0022` (PromptKit) → Add note: validated by migration (SDK-agnostic design worked)

  **D. Update Arc42 Architecture Docs**:
  - `05-building-blocks.md` → Update Orchestration module description
  - `06-runtime-view.md` → Update runtime sequences for Opencode server
  - `08-crosscutting-concepts.md` → Update tool patterns, session management
  - `09-architecture-decisions.md` → Add ADR-0024, mark superseded ADRs
  - `11-risks-technical-debt.md` → Remove resolved tech debt items

  **E. Update Project Docs**:
  - `CLAUDE.md` → Update "Orchestration Module" section, SDK references
  - `README.md` → Update if installation/usage changes

  **Must NOT do**:
  - Delete superseded ADRs (preserve history, mark as superseded)
  - Create documentation for features that don't exist
  - Leave any SDK references without updating

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Extensive documentation updates
  - **Skills**: [`adr`]
    - `adr`: Create and update ADRs with proper format

  **Parallelization**:
  - **Can Run In Parallel**: NO (requires T21, T22 complete)
  - **Parallel Group**: Wave 5 (before T24)
  - **Blocks**: T24
  - **Blocked By**: T21, T22

  **References**:
  - `docs/architecture/adr/0002-agentic-framework-strategy.md` - To supersede
  - `docs/architecture/adr/0005-tool-definition-and-invocation-pattern.md` - To supersede
  - `docs/architecture/adr/0010-session-state-and-checkpointing.md` - To supersede
  - `docs/architecture/adr/0016-mcp-integration-strategy.md` - To update
  - `docs/architecture/adr/0022-promptkit-sdk-agnostic-prompt-architecture.md` - To note validation
  - `docs/architecture/arc42/*.md` - All Arc42 sections

  **Acceptance Criteria**:
  - [ ] ADR-0024 created documenting migration decision
  - [ ] ADR-0002, ADR-0005, ADR-0010 marked `status: superseded`
  - [ ] ADR-0016 updated with bundled MCP server approach
  - [ ] ADR-0022 notes SDK-agnostic design validated
  - [ ] Arc42 sections 05, 06, 08, 09, 11 updated
  - [ ] CLAUDE.md references Opencode, not Claude Agent SDK
  - [ ] README.md installation instructions correct
  - [ ] `grep -r "claude-agent-sdk" docs/` returns nothing (except historical ADR context)
  - [ ] `grep -r "@anthropic-ai/claude-agent-sdk" CLAUDE.md` returns nothing

  **Manual Verification**:
  - [ ] Read through ADR-0024 for completeness
  - [ ] Verify superseded ADRs have correct frontmatter
  - [ ] Spot-check Arc42 sections for consistency

  **Commit**: YES
  - Message: `docs: update architecture documentation for Opencode SDK migration`
  - Files: `CLAUDE.md`, `README.md`, `docs/architecture/adr/*.md`, `docs/architecture/arc42/*.md`

---

- [x] **T24. Final Validation & Tech Debt Audit**

  **What to do**:
  - Run comprehensive E2E smoke test of full agentlint workflow
  - Execute ALL verification commands from Success Criteria section
  - Audit Tech Debt Remediation table: verify each item is resolved
  - Validate all Definition of Done items from plan header
  - Run `bun run test` (unit/integration)
  - Run `bun run test:live` (E2E with real Opencode server)
  - Run `bun run test:evals` (if applicable)
  - Perform manual TUI walkthrough: start → prompt → streaming → tool call → completion
  - Verify server lifecycle: start, crash recovery, clean shutdown
  - Create completion report documenting any remaining issues or follow-up work

  **Must NOT do**:
  - Skip any verification step
  - Mark complete if any DoD item fails
  - Ignore pre-existing issues without documenting them

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Comprehensive validation requires systematic verification
  - **Skills**: [`dev-testing`, `dev.checklist`]
    - `dev-testing`: Test execution expertise
    - `dev.checklist`: Systematic verification

  **Parallelization**:
  - **Can Run In Parallel**: NO (final validation)
  - **Parallel Group**: Wave 5 (final)
  - **Blocks**: None (migration complete)
  - **Blocked By**: T23

  **References**:
  - Success Criteria section (this document)
  - Tech Debt Remediation table (this document)
  - Definition of Done (this document header)

  **Acceptance Criteria**:
  - [ ] All Success Criteria verification commands pass
  - [ ] All 5 tech debt items confirmed resolved (see table)
  - [ ] All 9 Definition of Done items checked and passing
  - [ ] E2E smoke test: `agentlint "Analyze my CLAUDE.md"` completes successfully
  - [ ] TUI manual walkthrough: text streams, tools show, status updates
  - [ ] Server lifecycle: starts on launch, stops on exit, no orphan processes
  - [ ] Completion report created at `.sisyphus/reports/opencode-migration-complete.md`

  **Manual Verification**:
  - [ ] Execute full verification script:

    ```bash
    # Run all automated checks
    bun run test && \
    bun run typecheck && \
    grep -r "claude-agent-sdk" src/ tests/ && \
    echo "FAIL: SDK imports found" || echo "PASS: No SDK imports"

    # E2E smoke test
    bun run test:live

    # Server lifecycle test (interactive)
    bun run src/cli.ts &
    sleep 5 && pgrep -f "opencode serve" && echo "Server started"
    kill %1
    sleep 2 && ! pgrep -f "opencode serve" && echo "Server stopped cleanly"
    ```

  - [ ] TUI walkthrough documented with screenshots or terminal output

  **Commit**: YES
  - Message: `chore: complete Opencode SDK migration - final validation passed`
  - Files: `.sisyphus/reports/opencode-migration-complete.md`

---

## Tech Debt Remediation (During Migration)

The following tech debt items will be resolved as part of this migration:

| Debt Item                   | Location                   | Resolution Task                     |
| --------------------------- | -------------------------- | ----------------------------------- |
| SDK Type Probing            | `tool-registry.ts:221-238` | T05 (new adapter with proper types) |
| eslint-disable blocks       | `orchestrator.ts:277, 691` | T22 (remove after migration)        |
| Hardcoded Claude Code path  | `orchestrator.ts:596-634`  | T02 (replaced by Opencode server)   |
| SDKMessage 300-line handler | `orchestrator.ts:686-989`  | T06 (new streaming adapter)         |
| Prompt adapter coupling     | `claude-agent-sdk.ts`      | T19 (create Opencode adapter)       |

---

## Commit Strategy

| After Task | Message                                                               | Files                                            | Verification |
| ---------- | --------------------------------------------------------------------- | ------------------------------------------------ | ------------ |
| T01        | `feat(opencode): add Opencode SDK dependency`                         | package.json, src/opencode/index.ts              | typecheck    |
| T02        | `feat(opencode): implement server lifecycle manager`                  | src/opencode/server.ts                           | unit tests   |
| T03        | `feat(opencode): implement client wrapper`                            | src/opencode/client.ts                           | unit tests   |
| T04        | `feat(opencode): implement MCP server skeleton`                       | src/opencode/mcp-server.ts, opencode.json        | unit tests   |
| T05        | `feat(opencode): implement tool definition adapter`                   | src/opencode/tool-adapter.ts                     | unit tests   |
| T06        | `feat(opencode): implement streaming adapter`                         | src/opencode/streaming.ts                        | unit tests   |
| T07        | `feat(opencode): implement hybrid session manager`                    | src/opencode/sessions.ts                         | unit tests   |
| T08-T14    | `refactor(tools): migrate [category] tools to Opencode format`        | src/tools/\*_/_.ts                               | unit tests   |
| T15        | `refactor(act): convert subagents to Opencode config format`          | .opencode/agents/_.md, src/act/_.ts              | manual       |
| T16        | `feat(opencode): implement Opencode orchestrator`                     | src/opencode/orchestrator.ts                     | integration  |
| T17        | `refactor(tui): integrate with Opencode streaming`                    | src/tui/\*_/_.ts                                 | visual       |
| T18        | `refactor(permissions): migrate to Opencode config-based permissions` | src/tui/permissions/\*.ts, opencode.json         | unit tests   |
| T19        | `refactor(prompts): update adapter for Opencode format`               | src/prompts/adapters/\*.ts                       | unit tests   |
| T20        | `chore: remove Claude Agent SDK dependency`                           | package.json, deleted files                      | grep         |
| T21        | `test: update test infrastructure for Opencode SDK`                   | tests/\*_/_.ts                                   | bun run test |
| T22        | `chore: fix type errors and remove SDK workarounds`                   | various                                          | typecheck    |
| T23        | `docs: update architecture documentation for Opencode SDK migration`  | CLAUDE.md, docs/architecture/\*_/_.md            | manual       |
| T24        | `chore: complete Opencode SDK migration - final validation passed`    | .sisyphus/reports/opencode-migration-complete.md | E2E          |

---

## Risk Assessment

### HIGH RISK

| Risk                                  | Mitigation                                                    |
| ------------------------------------- | ------------------------------------------------------------- |
| **Streaming breaks TUI**              | T06 creates adapter that preserves `StreamChunk` interface    |
| **Server process orphaned**           | T02 registers multiple shutdown hooks (exit, SIGINT, SIGTERM) |
| **Tool migration errors (40+ files)** | Parallel migration with unit tests per tool category          |

### MEDIUM RISK

| Risk                      | Mitigation                                      |
| ------------------------- | ----------------------------------------------- |
| **Port 4096 conflict**    | T02 implements port conflict detection          |
| **Session state loss**    | T07 hybrid approach preserves local checkpoints |
| **VCR cassettes invalid** | T21 re-records all cassettes                    |

### LOW RISK

| Risk                          | Mitigation                      |
| ----------------------------- | ------------------------------- |
| **Type errors after removal** | T22 dedicated type cleanup task |
| **Documentation outdated**    | T23 comprehensive doc update    |

---

## Success Criteria

### Verification Commands

```bash
# All tests pass (NEVER use `bun test` directly per CLAUDE.md)
bun run test

# Type checking passes
bun run typecheck

# No old SDK imports in runtime or test code
grep -r "claude-agent-sdk" src/ tests/  # Should return nothing

# Verify spikes deleted
ls spikes/ep02-sdk 2>&1 | grep -q "No such file"  # Should succeed

# Server lifecycle works
bun run src/cli.ts --help &
pgrep -f "opencode serve"  # Should find process
kill %1
pgrep -f "opencode serve"  # Should find nothing

# Live test passes
bun run test:live
```

### Final Checklist

- [ ] All "Must Have" items present
- [ ] All "Must NOT Have" items absent
- [ ] All tests pass (`bun run test`)
- [ ] Type checking passes (`bun run typecheck`)
- [ ] No SDK imports remain in `src/**` or `tests/**`
- [ ] Server starts and stops cleanly
- [ ] TUI streams in real-time
- [ ] Sessions persist across restarts

---

## Appendix A: Opencode SDK Reference Examples

### A.1 SDK Client Usage

```typescript
import { createOpencode, createOpencodeClient } from '@opencode-ai/sdk';

// Option 1: Start embedded server + client
const { client, close } = await createOpencode({
  hostname: '127.0.0.1',
  port: 4096,
  config: { model: 'anthropic/claude-sonnet-4-20250514' },
});

// Option 2: Connect to existing server
const client = createOpencodeClient({ baseUrl: 'http://localhost:4096' });

// Create session and prompt
const session = await client.session.create({ title: 'Analysis' });
const result = await client.session.prompt({
  path: { id: session.id },
  body: {
    model: { providerID: 'anthropic', modelID: 'claude-sonnet-4-20250514' },
    parts: [{ type: 'text', text: 'Analyze my CLAUDE.md' }],
  },
});

// Cleanup
await close();
```

### A.2 MCP Server Configuration (`opencode.json`)

```json
{
  "mcp": {
    "agentlint": {
      "type": "local",
      "command": ["bun", "run", "src/opencode/mcp-server.ts"],
      "enabled": true,
      "env": {
        "AGENTLINT_CWD": "${workspaceFolder}"
      }
    }
  }
}
```

### A.3 SSE Event Format

Opencode streams events via Server-Sent Events:

```typescript
// Subscribe to events
const events = await client.event.subscribe();

for await (const event of events.stream) {
  switch (event.type) {
    case 'message.start':
      // New message beginning
      break;
    case 'message.delta':
      // Incremental text: event.content
      console.log(event.content);
      break;
    case 'tool.start':
      // Tool invocation: event.tool, event.input
      break;
    case 'tool.result':
      // Tool completed: event.tool, event.output
      break;
    case 'message.complete':
      // Message finished
      break;
  }
}
```

**Mapping to StreamChunk**:
| Opencode Event | StreamChunk Type |
|----------------|------------------|
| `message.delta` | `text` |
| `tool.start` | `tool_start` |
| `tool.result` | `tool_result` |
| `message.complete` | `status` |

### A.4 Agent Configuration (Markdown Format)

`.opencode/agents/claude-code-analyzer.md`:

```markdown
---
description: Specialized analyzer for Claude Code configurations
mode: subagent
model: anthropic/claude-sonnet-4-20250514
tools:
  write: false
  edit: false
  bash: false
  Task: false # Prevent subagent spawning (depth=1)
permission:
  mcp__agentlint__*: allow
---

You are the Claude Code Analyzer, a specialized subagent for analyzing
Claude Code configurations (CLAUDE.md files)...

[Full prompt content from src/act/instructions/claude-code.ts]
```

### A.5 Permission Configuration

```json
{
  "permission": {
    "edit": "ask",
    "write": "ask",
    "bash": {
      "*": "ask",
      "bun run test": "allow",
      "bun run typecheck": "allow",
      "git status": "allow",
      "git diff": "allow"
    },
    "mcp__agentlint__*": "allow"
  }
}
```

**Permission Values**:

- `"allow"`: Auto-approve without prompt
- `"ask"`: Prompt user for confirmation (TUI handles this)
- `"deny"`: Always reject

### A.6 Tool Definition (New Format)

```typescript
// Old Claude Agent SDK format
import { tool } from '@anthropic-ai/claude-agent-sdk';

export const parseConfigTool = tool(
  'parse_config',
  `Description...`,
  { filePath: z.string() },
  async (args) => ({
    content: [{ type: 'text', text: output }],
    _rawData: result,
  })
);

// New Opencode MCP format
import { z } from 'zod';

export const parseConfigTool = {
  name: 'parse_config',
  description: `Description...`,
  inputSchema: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'Path to config file' },
    },
    required: ['filePath'],
  },
  handler: async (args: { filePath: string }) => {
    const result = await parseConfig(args.filePath);
    // Simple return - no content wrapper needed
    return { success: true, config: result };
  },
};
```
