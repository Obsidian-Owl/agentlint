# Feature Specification: Orchestration Core

> **Epic**: EP02
> **Created**: 2026-01-16
> **Status**: ✅ Implemented (Migrated to Opencode SDK)
> **Author**: Claude
>
> **⚠️ HISTORICAL DOCUMENT**: This spec describes the original implementation using `@anthropic-ai/claude-agent-sdk`. The implementation has been migrated to Opencode SDK (see `.sisyphus/plans/opencode-sdk-migration.md`). References to Claude Agent SDK in this document are historical.

---

## 1. Overview

The Orchestration Core implements the master agent loop that powers all agentlint analysis. Using the Claude Agent SDK, it provides the agentic infrastructure for tool invocation, context management, streaming output, and session checkpointing. This is the central nervous system of agentlint—the agent IS the core of the system.

### 1.1 Business Context

EP02 is a P0-Critical foundation epic that blocks EP04 (CLI Interface), EP05 (Config Analysis), EP06 (Session Analysis), EP07 (Causal Tracing), and EP10 (Recommendation Engine). Without the orchestration layer, no analysis can occur. This epic implements the single-threaded master loop pattern proven by Claude Code, where the agent gathers context, invokes tools, reasons about findings, and synthesizes recommendations.

**Constitution Alignment**: Primarily serves Principle IX (Agent-Aware) by designing for the agent's cognitive needs, and Principle VII (Intelligent Tooling) by enabling free choice between tool use and reasoning.

### 1.2 Out of Scope

- **Specific tool implementations** (EP05-EP10 will provide these)
- **Persistence layer** (EP03 handles SQLite, baselines, learnings)
- **CLI command parsing and UI** (EP04 handles Ink/Commander.js)
- **ACT adapter implementations** (EP08 handles these)
- **Multi-provider LLM support** (Anthropic-only for MVP per ADR-0002)
- **Parallel agent execution** (following Claude Code's single-threaded pattern)

---

## 2. User Scenarios & Testing

> User stories are prioritized: P1 (must-have), P2 (should-have), P3 (nice-to-have)

### US-001 [P1]: Execute Analysis via Master Loop

**As** the agentlint CLI (on behalf of a user),
**I want** to invoke the master agent loop with a task and receive structured analysis results,
**So that** users get consistent, high-quality analysis output.

**Acceptance Criteria:**

- [ ] Given a valid task prompt, when the orchestrator is invoked, then the agent loop executes until tool_use=false or termination condition
- [ ] Given the agent decides to use a tool, when the tool is invoked, then the result is observed and fed back into the loop
- [ ] Given the agent decides direct reasoning is sufficient, when no tool is invoked, then the agent proceeds with synthesis
- [ ] Given the analysis completes, when results are returned, then they include structured findings and recommendations

**Test Scenarios:**

- Happy path: Agent invokes 3 mock tools, synthesizes findings, returns structured result
- Termination: Agent reaches "analysis complete" and loop exits cleanly
- Error in tool: Tool returns error, agent reasons about it and continues or fails gracefully

---

### US-002 [P1]: Register and Invoke Tools

**As** the orchestration layer,
**I want** a tool registration mechanism that accepts SDK-compatible tool definitions,
**So that** tools from EP05-EP10 can be plugged in without modifying orchestration code.

**Acceptance Criteria:**

- [ ] Given a tool defined with `tool()` and Zod schema, when registered, then the agent can discover and invoke it
- [ ] Given the agent invokes a tool, when the tool executes, then the result follows the CallToolResult format
- [ ] Given multiple tools are registered, when the agent lists available tools, then all registered tools appear with descriptions

**Test Scenarios:**

- Happy path: Register mock tool, agent selects it based on task, invocation succeeds
- Tool not found: Agent attempts non-existent tool, receives clear error
- Invalid input: Agent provides wrong schema, Zod validation fails with helpful message

---

### US-003 [P1]: Manage Context Within Token Limits

**As** the orchestration layer,
**I want** automatic context compression when approaching token limits,
**So that** long analysis sessions don't overflow the context window.

**Acceptance Criteria:**

- [ ] Given context reaches ~92% of limit, when compression triggers, then older, less relevant content is summarized
- [ ] Given compression occurs, when analysis continues, then task goals and critical findings are preserved
- [ ] Given context includes large tool results, when the result is summarized, then full data is stored for retrieval

**Test Scenarios:**

- Happy path: Context grows to 170K tokens, compression triggers, key data retained
- Priority preservation: After compression, task goal and recent errors are still accessible
- Large result: Tool returns 50KB JSON, summarized to 2KB with storage reference

---

### US-004 [P1]: Stream Agent Reasoning Output

**As** a user (via CLI),
**I want** to see agent reasoning in real-time as the analysis progresses,
**So that** I understand what the agent is doing during long-running sessions.

**Acceptance Criteria:**

- [ ] Given streaming is enabled, when the agent reasons, then text chunks are emitted progressively
- [ ] Given a tool is invoked, when the invocation starts, then the tool name and intent are streamed
- [ ] Given streaming output, when consumed by CLI, then it can be formatted for terminal display

**Test Scenarios:**

- Happy path: Start analysis, see "Analyzing config..." stream before tool result
- Tool progress: See "Invoking parse_config for CLAUDE.md" during tool execution
- Consumer control: Streaming can be paused/buffered by consumer

---

### US-005 [P1]: Checkpoint Session State

**As** the orchestration layer,
**I want** to emit checkpoint events at significant moments,
**So that** EP03 persistence can save state for crash recovery.

**Acceptance Criteria:**

- [ ] Given a checkpoint trigger (finding, phase complete, interval), when the trigger fires, then a checkpoint event is emitted with current state
- [ ] Given session state, when emitted, then it includes phase, findings, tool results cache, and progress metrics
- [ ] Given checkpoint hooks are registered, when events fire, then hooks are called with state payload

**Test Scenarios:**

- Happy path: Complete analysis phase, checkpoint event fires with phase="config_parsing"
- Finding checkpoint: New finding detected, checkpoint event fires immediately
- Interval checkpoint: 60 seconds pass, interval checkpoint fires

---

### US-006 [P2]: Support Human-in-the-Loop Pauses

**As** a user,
**I want** the agent to pause and ask me questions when clarification is needed,
**So that** I can guide analysis toward my specific concerns.

**Acceptance Criteria:**

- [ ] Given the agent needs user input, when it requests clarification, then the loop pauses
- [ ] Given the loop is paused, when the user provides input, then the loop resumes with that context
- [ ] Given a pause request, when emitted, then it includes the question and suggested options (if any)

**Test Scenarios:**

- Happy path: Agent asks "Focus on security or performance?", user selects, analysis continues
- Timeout: Pause exceeds timeout, checkpoint saved, session can resume later
- Cancel: User cancels during pause, session terminates gracefully

---

### US-007 [P2]: Resume from Checkpoint

**As** the orchestration layer,
**I want** to accept a session ID and resume from checkpoint,
**So that** interrupted analysis can continue without losing progress.

**Acceptance Criteria:**

- [ ] Given a valid session ID, when resume is called, then the SDK session is restored
- [ ] Given agentlint state exists for session, when loaded, then findings, phase, and cache are restored
- [ ] Given resume completes, when analysis continues, then a state summary is injected into conversation

**Test Scenarios:**

- Happy path: Resume session, see "Resuming from phase: pattern_analysis with 5 findings"
- No checkpoint: Session ID has no state file, start fresh with warning
- Corrupted state: State file invalid, start fresh with error logged

---

### US-008 [P2]: Configure Subagent Delegation

**As** the orchestration layer,
**I want** to support subagent delegation with depth limits,
**So that** complex analysis can be decomposed while preventing runaway costs.

**Acceptance Criteria:**

- [ ] Given the agent decides to delegate, when a subagent is spawned, then it has its own context window
- [ ] Given subagent depth=1 limit, when subagent attempts to delegate, then delegation is rejected
- [ ] Given subagent completes, when results return, then they are summarized for parent context

**Test Scenarios:**

- Happy path: Main agent delegates "deep config analysis" to subagent, gets summary back
- Depth limit: Subagent attempts further delegation, receives "depth limit reached" error
- Subagent failure: Subagent crashes, parent receives error and continues gracefully

---

### US-009 [P3]: Provide Cognitive Workspace Structure

**As** the agentlint agent (Persona 0),
**I want** my context structured as hierarchical working memory,
**So that** I can reason effectively with compressed, prioritized information.

**Acceptance Criteria:**

- [ ] Given analysis starts, when context is initialized, then it includes task goal, project summary, and baseline awareness
- [ ] Given analysis progresses, when context is updated, then progress and findings are organized hierarchically
- [ ] Given context includes global learnings, when loaded, then they inform analysis without repeating full content

**Test Scenarios:**

- Happy path: Context shows "Task: Analyze config quality | Project: agentlint | Findings: 3"
- Baseline awareness: Context includes "Previous analysis: 2026-01-10 | Config score: 72%"
- Learnings loaded: Global learning "Always check for .env references" influences analysis

---

## 3. Requirements

### 3.1 Functional Requirements

| ID     | Requirement                                                                      | Priority | User Story     |
| ------ | -------------------------------------------------------------------------------- | -------- | -------------- |
| FR-001 | Master loop executes until tool_use=false or termination condition               | P1       | US-001         |
| FR-002 | Agent can invoke registered tools and observe results                            | P1       | US-001, US-002 |
| FR-003 | Tool registration accepts SDK `tool()` definitions with Zod schemas              | P1       | US-002         |
| FR-004 | Context compression handled by SDK via PreCompact hook (~92% internal threshold) | P1       | US-003         |
| FR-005 | Task goals and critical findings preserved during compression                    | P1       | US-003         |
| FR-006 | Large tool results summarized with full data stored for retrieval                | P1       | US-003         |
| FR-007 | Streaming output via async generators for real-time visibility                   | P1       | US-004         |
| FR-008 | Checkpoint events emitted on findings, phase changes, and intervals              | P1       | US-005         |
| FR-009 | Checkpoint state includes phase, findings, cache, and progress                   | P1       | US-005         |
| FR-010 | Human-in-the-loop requests pause loop until user responds                        | P2       | US-006         |
| FR-011 | Session resume loads SDK session and agentlint state atomically                  | P2       | US-007         |
| FR-012 | State summary injected into conversation on resume                               | P2       | US-007         |
| FR-013 | Subagent delegation with depth=1 limit                                           | P2       | US-008         |
| FR-014 | Subagent results summarized for parent context                                   | P2       | US-008         |
| FR-015 | Hierarchical cognitive workspace structure (task, context, progress, findings)   | P3       | US-009         |
| FR-016 | Global learnings loaded at session start                                         | P3       | US-009         |

### 3.2 Non-Functional Requirements

| ID      | Requirement            | Metric             | Target                                           |
| ------- | ---------------------- | ------------------ | ------------------------------------------------ |
| NFR-001 | Loop iteration latency | Time excluding LLM | < 5 seconds                                      |
| NFR-002 | Context management     | Token limit        | Model's context window (e.g., 200K for Sonnet 4) |
| NFR-003 | Checkpoint recovery    | Resume time        | < 5 seconds                                      |
| NFR-004 | API reliability        | Retry with backoff | Exponential backoff, max 3 retries               |
| NFR-005 | Streaming latency      | First chunk        | < 500ms                                          |
| NFR-006 | Test coverage          | Code coverage      | > 80%                                            |

---

## 4. Key Entities

> Define the core domain entities this feature introduces or modifies

| Entity             | Description                    | Key Attributes                                                  |
| ------------------ | ------------------------------ | --------------------------------------------------------------- |
| MasterLoop         | The main agent execution loop  | sessionId, phase, isActive, toolRegistry                        |
| CognitiveWorkspace | Hierarchical context structure | taskGoal, projectContext, progress, findings, baselineAwareness |
| ToolRegistry       | Registry of available tools    | tools[], register(), invoke()                                   |
| CheckpointEvent    | State snapshot for persistence | trigger, sequence, state, timestamp                             |
| StreamChunk        | Unit of streaming output       | type (text/tool/status), content                                |
| SessionState       | Agentlint-specific state       | id, phase, findings, toolResultCache, checkpoint                |

### 4.1 Entity Relationships

```
MasterLoop --1:1--> CognitiveWorkspace
MasterLoop --1:1--> ToolRegistry
MasterLoop --1:N--> CheckpointEvent
MasterLoop --1:N--> StreamChunk
MasterLoop --1:1--> SessionState
ToolRegistry --1:N--> Tool
```

---

## 5. Success Criteria

> How do we know this feature is successful? Define measurable outcomes.

- [ ] **Functional**: Master loop executes with mock tools, produces structured output
- [ ] **Context Management**: Compression triggers correctly at ~92% threshold
- [ ] **Checkpointing**: State saved after major phases; resume loads state correctly
- [ ] **Streaming**: Real-time output visible during analysis
- [ ] **Quality**: > 80% test coverage; no critical bugs
- [ ] **Performance**: Loop iteration < 5s; checkpoint recovery < 5s
- [ ] **Integration**: Mock LLM tests pass; ready for EP03-EP10 integration

---

## 6. Edge Cases & Error Handling

| Scenario                             | Expected Behavior                                                    | Priority |
| ------------------------------------ | -------------------------------------------------------------------- | -------- |
| API rate limit hit                   | Exponential backoff with max 3 retries; checkpoint before retry      | P1       |
| Context overflow despite compression | Emergency truncation of oldest non-critical content; warning emitted | P1       |
| Tool throws exception                | Return structured error; agent reasons about recovery                | P1       |
| Tool returns invalid schema          | Log warning; return error to agent with suggestion                   | P1       |
| Network failure during LLM call      | Checkpoint immediately; retry or fail gracefully                     | P1       |
| User input timeout during pause      | Save checkpoint; allow resume later                                  | P2       |
| Subagent exceeds depth limit         | Reject with clear error; parent continues                            | P2       |
| Invalid session ID for resume        | Start fresh with warning; log error                                  | P2       |
| Corrupted state file                 | Start fresh; delete corrupted file; log error                        | P2       |
| SDK version incompatibility          | Clear error message; suggest upgrade                                 | P3       |

---

## 7. Dependencies & Assumptions

### 7.1 Dependencies

| Dependency              | Type          | Status    | Impact if Missing                   |
| ----------------------- | ------------- | --------- | ----------------------------------- |
| EP01 Project Foundation | Internal      | Complete  | Cannot start - no project structure |
| Claude Agent SDK        | External      | Available | Core functionality blocked          |
| Anthropic API           | External      | Available | Agent cannot execute                |
| Zod                     | External      | Available | Schema validation blocked           |
| OPENCODE_API_KEY        | User-provided | Required  | Analysis cannot run                 |

### 7.2 Assumptions

- Claude Agent SDK provides stable V1 patterns; V2 interface can be adopted incrementally
- SDK's built-in context compaction (~92%) is sufficient for initial implementation
- Single-threaded loop (no parallel agent execution) is adequate for MVP
- Subagent depth=1 limit follows Claude Code's proven pattern
- Tools will be provided by subsequent epics (EP05-EP10) using the registered interface

---

## 8. Open Questions

> Questions that need resolution before implementation

- [x] **Q1**: What is the exact SDK import path and version to pin? — **RESOLVED**: Pin specific version for reproducibility (exact version TBD during /dev.plan spike)
- [x] **Q2**: Should checkpoint interval be configurable per-command or global config? — **RESOLVED**: Global config only (`~/.agentlint/config`)
- [x] **Q3**: How should streaming output be formatted for different verbosity levels? — **RESOLVED**: Structured levels (quiet, normal, verbose, debug)
- [x] **Q4**: What is the fallback when API key is invalid/expired mid-session? — **RESOLVED**: Checkpoint and fail with clear error

---

## 9. References

### Internal Documentation

- [EP02 Epic](../../docs/planning/epics/EP02-orchestration-core.md)
- [ADR-0002 Agentic Framework Strategy](../../docs/architecture/adr/0002-agentic-framework-strategy.md)
- [ADR-0005 Tool Definition and Invocation Pattern](../../docs/architecture/adr/0005-tool-definition-and-invocation-pattern.md)
- [ADR-0010 Session State and Checkpointing](../../docs/architecture/adr/0010-session-state-and-checkpointing.md)
- [Arc42 Section 5 Building Blocks - Orchestration Layer](../../docs/architecture/arc42/05-building-blocks.md)
- [Arc42 Section 6 Runtime View](../../docs/architecture/arc42/06-runtime-view.md)
- [Arc42 Section 8 Crosscutting Concepts - Context Management](../../docs/architecture/arc42/08-crosscutting-concepts.md)
- [Constitution](../../.specify/memory/constitution.md)
- [Persona 0: The agentlint Agent](../../docs/requirements/personas.md)

### External Research (SDK Validation)

- [Claude Code Behind-the-Scenes of the Master Agent Loop](https://blog.promptlayer.com/claude-code-behind-the-scenes-of-the-master-agent-loop/) - Architecture analysis
- [Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript) - Official SDK documentation
- [Claude Agent SDK npm](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) - Package details
- [ZenML - Claude Code Architecture](https://www.zenml.io/llmops-database/claude-code-agent-architecture-single-threaded-master-loop-for-autonomous-coding) - Architecture patterns

---

## Clarifications

> This section is populated by /dev.clarify

### C1: SDK Version Strategy (2026-01-16)

**Question**: What SDK version should we pin for Claude Agent SDK?

**Decision**: Pin specific version for reproducibility.

**Rationale**: Pinning ensures reproducible builds and prevents unexpected breaking changes. The exact version will be determined during `/dev.plan` phase through a spike to identify the current stable SDK version and its API surface.

**Impact**:

- Add version pinning to package.json during implementation
- Document upgrade procedure in CLAUDE.md or README

---

### C2: Checkpoint Configuration Scope (2026-01-16)

**Question**: Should checkpoint interval be configurable per-command or global?

**Decision**: Global config only via `~/.agentlint/config`.

**Rationale**: Simpler implementation and consistent behavior across all commands. Users who want different intervals for different scenarios can manually adjust the global config.

**Impact**:

- FR-008 checkpoint interval reads from global config
- Default interval: 60 seconds (as per ADR-0010)
- Config schema: `{ checkpoint: { intervalMs: number } }`

---

### C3: Streaming Output Verbosity (2026-01-16)

**Question**: How should streaming output handle different verbosity levels?

**Decision**: Structured levels with four tiers.

**Levels**:
| Level | Output |
|-------|--------|
| `quiet` | Errors only |
| `normal` | Progress indicators and results |
| `verbose` | Agent reasoning and tool invocations |
| `debug` | All events including internal state |

**Rationale**: Matches common CLI patterns. Allows EP04 (CLI) to filter events based on user preference while EP02 emits all events with level metadata.

**Impact**:

- StreamChunk entity gains `level: 'quiet' | 'normal' | 'verbose' | 'debug'` attribute
- EP02 emits all events; filtering is EP04's responsibility
- Default level: `normal`

---

### C4: API Key Expiration Handling (2026-01-16)

**Question**: What should happen when the API key becomes invalid/expired mid-session?

**Decision**: Checkpoint and fail with clear error.

**Rationale**: Simpler and more predictable than prompting for a new key mid-session. The user can fix their environment and resume from the checkpoint. This avoids complexity of validating new keys mid-loop and keeps the orchestration layer focused on analysis, not credential management.

**Impact**:

- On authentication error (401/403), immediately trigger checkpoint
- Emit error with specific message: "API key invalid or expired. Session saved. Re-run with valid OPENCODE_API_KEY."
- Exit with appropriate error code (per EP01 error handling patterns)
- Resume capability (US-007) allows continuation after key is fixed

---

### C5: Two-Layer Analysis Pattern (2026-01-16)

**Question**: Should EP02 explicitly implement the Two-Layer Analysis pattern from Arc42 §4, or defer layer separation to tool implementations?

**Decision**: Tools self-categorize; EP02 orchestrates without layer awareness.

**Rationale**: The Constitution explicitly prohibits forced pipelines:

- Principle IV: "The agent selects methods via semantic matching, not rigid pipelines"
- Principle VII: "The agent MUST choose freely between tool use and direct reasoning"
- Anti-pattern: "Forced sequential pipelines where every analysis must run every method"

Exposing layer awareness to the agent would constrain its reasoning. The Two-Layer Architecture is an _implementation detail_ for tool authors (EP05-EP10), not an orchestration concept. The agent shouldn't know or care whether a tool is "static" or "agentic"—it invokes tools based on task requirements.

**Impact**:

- EP02 treats all tools uniformly via the ToolRegistry
- Tool metadata may include `layer: 'static' | 'agentic'` for documentation/debugging, but the agent ignores this
- Arc42 §4 Two-Layer diagram remains valid as human documentation, not runtime architecture

---

### C6: Model Configuration (2026-01-16)

**Question**: Which Claude model should EP02 target for context window sizing?

**Decision**: Configurable model selection with sensible defaults.

**Rationale**: Users have different cost/quality trade-offs. Some analysis tasks benefit from Opus; others work fine with Sonnet. Local-First principle means user controls their API costs.

**Impact**:

- Add `model` to global config: `{ model: 'claude-sonnet-4-20250514' }` (default)
- NFR-002 adjusted: Context management targets the _configured model's_ context window (dynamically queried or hardcoded per model)
- Supported models: Any Anthropic model compatible with Claude Agent SDK
- Model-specific features (extended thinking, etc.) enabled when available

---

### C7: Analysis Phases (2026-01-16)

**Question**: Should EP02 define analysis phases explicitly, or let the agent determine phases dynamically?

**Decision**: Hybrid approach—define core phases but allow agent flexibility.

**Rationale**: Constitution Principle IV emphasizes agent agency: "When a method doesn't fit the task, the agent adapts or skips it." We don't know what the user is analyzing or the state of their environment. The agent needs room to explore and use its intelligence.

**Core Phases** (suggested, not enforced):

- `init` - Session setup, context loading
- `discovery` - Find configs, sessions, relevant files
- `analysis` - Deep analysis of discovered content
- `synthesis` - Generate findings and recommendations
- `complete` - Finalization

**Agent Agency**:

- Agent can skip phases that aren't relevant
- Agent can add custom phases (e.g., `security_audit`, `performance_review`)
- Phase tracking is for observability and checkpointing, not control flow
- The agent decides phase transitions based on its reasoning

**Impact**:

- SessionState.phase is a string, not an enum
- Checkpointing works with any phase name
- Core phases are documented but not hardcoded
- System prompt includes phase guidance as suggestions, not requirements

---

### C8: SDK Integration Strategy (2026-01-16)

**Research Source**: [Claude Code Behind-the-Scenes](https://blog.promptlayer.com/claude-code-behind-the-scenes-of-the-master-agent-loop/), [Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)

**Question**: How should EP02 integrate with the Claude Agent SDK?

**Decisions**:

1. **Wrap `query()` function**: Use the SDK's `query()` as the foundation. It implements the master loop internally (`while(tool_call) → execute → repeat`). EP02 adds agentlint-specific layers on top.

2. **Use SDK hooks for checkpointing**: Leverage the SDK's built-in hooks system (`PostToolUse`, `SessionEnd`, `PreCompact`) for checkpoint events rather than custom event emission.

3. **SDK tools + custom**: Use SDK's built-in tools (Read, Write, Edit, Bash, Glob, Grep, Task, TodoWrite) and add agentlint-specific tools via EP05-EP10.

**Rationale**: The SDK already implements Claude Code's proven patterns:

- Single-threaded master loop with flat message history
- Context compaction at ~92% via `SDKCompactBoundaryMessage`
- Session resume via `resume` option
- Streaming via `includePartialMessages`
- Hooks for extension points

Building on `query()` gives us these patterns for free while allowing agentlint-specific customization.

**Key SDK Patterns to Use**:

```typescript
// Core invocation pattern
const result = query({
  prompt: taskPrompt,
  options: {
    model: config.model, // User-configurable
    resume: sessionId, // For session resume (US-007)
    includePartialMessages: true, // For streaming (US-004)
    hooks: {
      PostToolUse: [{ hooks: [checkpointHook] }],
      SessionEnd: [{ hooks: [finalCheckpointHook] }],
      PreCompact: [{ hooks: [preCompactHook] }],
    },
    mcpServers: {
      agentlint: createSdkMcpServer({
        name: 'agentlint',
        tools: [...agentlintTools], // EP05-EP10 tools
      }),
    },
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      append: agentlintSystemPrompt, // Cognitive workspace guidance
    },
  },
});
```

**Impact on Requirements**:

| Requirement                | SDK Alignment                           |
| -------------------------- | --------------------------------------- |
| FR-001 Master loop         | Use `query()` - loop is internal        |
| FR-002 Tool invocation     | Via MCP server registration             |
| FR-003 Tool registration   | `tool()` + `createSdkMcpServer()`       |
| FR-004 Context compression | SDK handles via `PreCompact` hook       |
| FR-007 Streaming           | `includePartialMessages: true`          |
| FR-008 Checkpoint events   | SDK hooks: `PostToolUse`, `SessionEnd`  |
| FR-010 Human-in-the-loop   | Streaming input mode with `interrupt()` |
| FR-011 Session resume      | `resume` option with session ID         |

**h2A Queue Pattern** (for US-006):
The SDK's streaming input mode enables real-time steering. Users can inject instructions mid-task via the async iterable prompt pattern:

```typescript
// Real-time steering pattern
async function* streamingPrompt() {
  yield { type: 'user', message: { content: initialPrompt } };
  // Wait for user injection...
  yield { type: 'user', message: { content: userInjection } };
}

const result = query({
  prompt: streamingPrompt(),
  options: {
    /* ... */
  },
});
```

---

### C9: Built-in Tool Strategy (2026-01-16)

**Question**: Which SDK built-in tools should EP02 expose vs implement custom?

**Decision**: Use SDK built-in tools for file/system operations; implement custom tools for agentlint-specific analysis.

**SDK Built-in Tools** (expose via `tools` option):

- `Read` - File reading (text, images, PDFs, notebooks)
- `Write` - File writing
- `Edit` - String replacement edits
- `Bash` - Command execution with sandbox
- `Glob` - File pattern matching
- `Grep` - Regex content search
- `Task` - Subagent delegation
- `TodoWrite` - Task list management
- `WebFetch` - URL fetching
- `WebSearch` - Web search

**Custom agentlint Tools** (via EP05-EP10):

- `parse_config` - CLAUDE.md parsing and analysis (EP05)
- `search_sessions` - Session log search (EP06)
- `trace_origin` - Causal tracing (EP07)
- `query_baseline` - Baseline comparison (EP03)
- `generate_recommendation` - Recommendation synthesis (EP10)

**Rationale**: SDK tools are battle-tested in Claude Code. Implementing custom versions would duplicate effort and miss optimizations. agentlint's value is in the analysis tools, not reimplementing file I/O.
