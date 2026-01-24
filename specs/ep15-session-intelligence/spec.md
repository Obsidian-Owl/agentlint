# Feature Specification: Session Intelligence

> **Epic**: EP15
> **Created**: 2026-01-24
> **Status**: Clarified
> **Consolidates**: EP16 (Symptom Patterns), EP18 (Subagent Delegation)

---

## 1. Overview

Session Intelligence enables agentlint to **understand what happened in sessions and why**—not just measure metrics. A session is a story with intent, exploration, challenges, decisions, and resolution. This feature provides tools that extract session narratives and a dedicated subagent that reasons about session quality, contextualising efficiency against task complexity.

### 1.1 Business Context

The strategic pivot identified that raw metrics (token counts, compression events) are meaningless without context. "10 million tokens" means nothing unless contextualised against what the agent was accomplishing. This epic delivers the capability to answer:

- What was the user trying to accomplish?
- Did the agent understand and deliver?
- Was the journey smooth or chaotic?
- Was the output high quality?
- Were resources appropriate for the task?

Per Constitution Principle IX (Agent-Aware), this must be implemented as a **subagent** to manage context window pressure—a main orchestrator analysing 19MB session logs would exceed context limits.

### 1.2 Out of Scope

- Real-time session monitoring (future feature)
- Automatic remediation of session issues
- Cross-project session comparison (future EP12 integration)
- Hardcoded thresholds or scoring (agent reasons about meaning)
- MCP configuration validation (remains in EP19 as static analysis)
- Session log parsing infrastructure (already exists in EP06)

---

## 2. User Scenarios & Testing

> User stories are prioritized: P1 (must-have), P2 (should-have), P3 (nice-to-have)

### US-001 [P1]: Session Narrative Understanding

**As a** developer using agentlint,
**I want** to understand what happened in a session (the story),
**So that** I can learn from effective patterns and identify where things went wrong.

**Acceptance Criteria:**
- [ ] Given a session exists, when narrative is extracted, then timeline shows key events (user prompts, tool clusters, errors, compressions)
- [ ] Given a session exists, when narrative is extracted, then first user prompt is identified as "intent"
- [ ] Given a session exists, when narrative is extracted, then outcome signals (success/failure) are identified
- [ ] Given a session has compressions, when narrative is extracted, then compression events include pre-tokens and summary preserved

**Test Scenarios:**
- Happy path: Extract narrative from a complete session with clear intent and successful outcome
- Edge case: Session with no user prompts (system-initiated)
- Edge case: Session interrupted mid-task (no clear outcome)
- Error case: Malformed session log returns error with context

---

### US-002 [P1]: Session Flow Analysis

**As a** developer,
**I want** to see tool call patterns and error cycles in a session,
**So that** I can identify where the agent got stuck or was inefficient.

**Acceptance Criteria:**
- [ ] Given a session exists, when tool sequences are queried, then each call includes name, input hash, timestamp, sequence index
- [ ] Given a session has repeated tool calls, when sequences are queried, then repeated calls with same input hash are visible
- [ ] Given a session has errors, when error clusters are queried, then errors are grouped by time proximity
- [ ] Given a session has file operations, when file access is queried, then per-file access counts are available

**Test Scenarios:**
- Happy path: Session with varied tool usage shows clear sequence
- Edge case: Session with 100+ tool calls handles pagination
- Edge case: Session with no tool calls returns empty result
- Error case: Invalid session ID returns appropriate error

---

### US-003 [P1]: Delegation Analysis

**As a** developer,
**I want** to see when and how delegation (subagents) was used in a session,
**So that** I can understand orchestration patterns and context offloading.

**Acceptance Criteria:**
- [ ] Given a session has Task tool calls, when delegation events are queried, then each includes subagent type, prompt, timestamp, turn index
- [ ] Given a session has delegations, when queried, then data includes whether delegation completed successfully
- [ ] Given subagent sessions exist, when delegation events are queried, then links to subagent session IDs are included where available

**Test Scenarios:**
- Happy path: Session with multiple delegations shows orchestration pattern
- Edge case: Session with nested delegation (subagent spawns subagent)
- Edge case: Session with failed delegation (task errored)

---

### US-004 [P1]: Quality Signal Extraction

**As a** developer,
**I want** to see test results, build outcomes, and correction patterns from a session,
**So that** I can assess whether the session produced quality output.

**Acceptance Criteria:**
- [ ] Given a session ran tests, when quality signals are queried, then test pass/fail counts are extracted from Bash tool results
- [ ] Given a session ran builds, when quality signals are queried, then build success/failure is extracted
- [ ] Given a session has multiple edits to same file, when corrections are queried, then per-file edit counts are available

**Test Scenarios:**
- Happy path: Session with test runs shows extracted results
- Edge case: Test output in non-standard format
- Edge case: Session with no test/build activity

---

### US-005 [P1]: MCP Usage Quality

**As a** developer,
**I want** to see MCP server usage patterns from a session,
**So that** I can understand which integrations are being used effectively.

**Acceptance Criteria:**
- [ ] Given a session has MCP tool calls, when MCP usage is queried, then per-server call counts are available
- [ ] Given a session has MCP errors, when MCP usage is queried, then error rates per server are available
- [ ] Given MCP calls exist, when queried, then error messages are included for agent reasoning

**Test Scenarios:**
- Happy path: Session with MCP calls shows per-server breakdown
- Edge case: Session with only MCP errors
- Edge case: Session with no MCP usage

---

### US-006 [P1]: Session Understanding Subagent

**As a** developer,
**I want** an agent that can explain what happened in a session and why,
**So that** I receive narrative understanding rather than raw data dumps.

**Acceptance Criteria:**
- [ ] Given a session ID, when subagent analyzes it, then output includes narrative summary of what happened
- [ ] Given a session with issues, when subagent analyzes it, then identified issues include root causes
- [ ] Given a session, when subagent analyzes it, then resource usage is contextualised against task complexity
- [ ] Given two session IDs, when subagent compares them, then comparative analysis explains why one went better

**Test Scenarios:**
- Happy path: Subagent produces actionable narrative for a complex session
- Edge case: Very short session (1-2 turns)
- Edge case: Very long session requiring phased analysis
- Error case: Session ID doesn't exist

---

### US-007 [P2]: Session Timeline Visualisation Data

**As a** developer,
**I want** timeline data structured for potential visualisation,
**So that** future TUI (EP17) can render session timelines.

**Acceptance Criteria:**
- [ ] Given a session, when timeline is extracted, then data includes phase markers (exploration, implementation, debugging)
- [ ] Given a session timeline, then events have consistent structure for rendering
- [ ] Given a session timeline, then key moments (errors, compressions, milestones) are flagged

**Test Scenarios:**
- Happy path: Complex session produces renderable timeline structure

---

### US-008 [P2]: Permission Interaction Data

**As a** developer,
**I want** to see permission approval/denial patterns in a session,
**So that** I can identify permission friction opportunities.

**Acceptance Criteria:**
- [ ] Given a session has permission interactions, when queried, then approval/denial events are extracted
- [ ] Given permission data exists, then patterns per tool/command are available
- [ ] Given permission data exists, then agent can reason about friction candidates

**Test Scenarios:**
- Happy path: Session with permission prompts shows pattern
- Edge case: Session with all auto-approved permissions

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | Tool extracts turn-by-turn session timeline with timestamps | P1 | US-001 |
| FR-002 | Tool identifies first user prompt as intent marker | P1 | US-001 |
| FR-003 | Tool extracts compression events with pre-tokens and summary text | P1 | US-001 |
| FR-004 | Tool detects session outcome signals (completion, abandonment) | P1 | US-001 |
| FR-005 | Tool extracts tool call sequences with name, input hash, timestamp, index | P1 | US-002 |
| FR-006 | Tool extracts error events with surrounding context | P1 | US-002 |
| FR-007 | Tool calculates per-file access counts from Read/Write/Edit calls | P1 | US-002 |
| FR-008 | Tool extracts Task tool calls as delegation events | P1 | US-003 |
| FR-009 | Tool captures subagent type, prompt, timing from delegations | P1 | US-003 |
| FR-010 | Tool links delegations to subagent session IDs where available | P2 | US-003 |
| FR-011 | Tool extracts test results (pass/fail counts) from Bash outputs | P1 | US-004 |
| FR-012 | Tool extracts build/lint outcomes from tool results | P1 | US-004 |
| FR-013 | Tool tracks edit frequency per file as correction signal | P2 | US-004 |
| FR-014 | Tool extracts MCP tool calls with server name parsed from prefix | P1 | US-005 |
| FR-015 | Tool tracks MCP success/error counts per server | P1 | US-005 |
| FR-016 | Tool captures MCP error messages for agent analysis | P1 | US-005 |
| FR-017 | Subagent definition exists for session analysis | P1 | US-006 |
| FR-018 | Subagent produces narrative summaries of sessions | P1 | US-006 |
| FR-019 | Subagent contextualises efficiency against task complexity | P1 | US-006 |
| FR-020 | Subagent can compare two sessions when requested | P2 | US-006 |
| FR-021 | Timeline data includes phase markers (exploration, implementation, debugging) | P2 | US-007 |
| FR-022 | Tool extracts permission approval/denial events | P2 | US-008 |
| FR-023 | All tools store extracted data in SQLite for persistence | P1 | All |
| FR-024 | All tools support date range filtering | P1 | All |

### 3.2 Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-001 | Session indexing performance | Sessions per second | > 50 sessions/sec |
| NFR-002 | Query response time | 95th percentile | < 500ms |
| NFR-003 | Subagent context efficiency | Tokens per analysis | < 50K tokens input |
| NFR-004 | Memory usage during indexing | Peak memory | < 500MB |
| NFR-005 | Error recovery | Failed extractions | Graceful skip with warning |
| NFR-006 | Data integrity | Extraction accuracy | > 99% for structured fields |

---

## 4. Key Entities

> Define the core domain entities this feature introduces or modifies

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| SessionTimeline | Structured representation of session narrative | sessionId, startTime, endTime, phases[], keyEvents[], compressions[], outcome |
| TimelineEvent | Single event in session timeline | turn, timestamp, type, summary |
| CompressionEvent | Context compression occurrence | timestamp, type, preTokens, tokensSaved, summaryPreserved |
| ToolCallRecord | Single tool invocation record | sessionId, toolName, inputHash, timestamp, sequenceIndex, isError |
| FileAccess | File operation record | sessionId, filePath, operation, timestamp, accessSequence |
| DelegationEvent | Subagent invocation record | sessionId, subagentType, taskPrompt, timestamp, turnIndex, success |
| McpToolCall | MCP tool invocation record | sessionId, serverName, toolName, timestamp, isError, errorMessage |
| QualitySignal | Quality indicator from session | sessionId, signalType, timestamp, passed, details |

### 4.1 Entity Relationships

```
Session --1:1--> SessionTimeline
Session --1:N--> TimelineEvent
Session --1:N--> CompressionEvent
Session --1:N--> ToolCallRecord
Session --1:N--> FileAccess
Session --1:N--> DelegationEvent
Session --1:N--> McpToolCall
Session --1:N--> QualitySignal

DelegationEvent --0:1--> Session (subagent session)
```

---

## 5. Success Criteria

> How do we know this feature is successful? Define measurable outcomes.

- [ ] **Functional**: All P1 user stories pass acceptance criteria
- [ ] **Functional**: Subagent produces coherent narratives for 90%+ of test sessions
- [ ] **Quality**: Test coverage > 80% for extraction logic
- [ ] **Quality**: No hardcoded thresholds or judgments in tool code
- [ ] **Performance**: Meets NFR performance targets
- [ ] **Integration**: CLI `agentlint analyse` includes session intelligence findings
- [ ] **Constitution**: Tools return data; subagent provides judgment (Principle VII verified)

---

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior | Priority |
|----------|-------------------|----------|
| Session log file doesn't exist | Return error with file path and suggestion | P1 |
| Session log is malformed JSON | Skip malformed lines, log warning, continue | P1 |
| Session has no user prompts | Return timeline with "system-initiated" intent | P2 |
| Session has 1000+ tool calls | Paginate results, warn about large session | P1 |
| Compression summary is empty | Include compression event without summary text | P2 |
| Subagent session file missing | Return delegation event without subagent link | P2 |
| MCP server name unparseable | Use "unknown" as server name, include raw tool name | P2 |
| Test output in non-standard format | Return QualitySignal with passed=null, include raw output | P2 |
| Session analysis exceeds subagent context | Phase analysis across multiple subagent calls | P1 |

---

## 7. Dependencies & Assumptions

### 7.1 Dependencies

| Dependency | Type | Status | Impact if Missing |
|------------|------|--------|-------------------|
| EP06 Session Analysis | Internal | Complete | Cannot parse session logs |
| EP14 Skills Effectiveness | Internal | Complete | Cannot correlate with skill usage |
| SQLite sessions.db | Internal | Ready | Cannot persist extracted data |
| Claude Agent SDK | External | Ready | Cannot define subagent |
| Zod | External | Ready | Cannot define schemas |

### 7.2 Assumptions

- Session logs follow Claude Code JSONL format (validated by EP06)
- Compression events include `compactMetadata` with `preTokens`
- Task tool calls include `subagent_type` in input
- MCP tool names follow `mcp__servername__toolname` convention
- Test output patterns are recognisable (bun test, jest, vitest formats)

---

## 8. Open Questions

> Questions that need resolution before implementation

- [x] **Q1**: Should the subagent analyse sessions incrementally (phase by phase) or request all data upfront? — **RESOLVED: Incremental** (see C1)
- [x] **Q2**: What test output formats should we prioritise for extraction (bun, jest, vitest, pytest)? — **RESOLVED: Agent interprets raw output** (see C2)
- [x] **Q3**: Should phase detection (exploration/implementation/debugging) use heuristics or be agent-reasoned? — **RESOLVED: Agent-reasoned** (see C3)

---

## 9. References

- [EP15 Epic Definition](../../docs/planning/epics/EP15-session-intelligence.md)
- [Linear Project: EP15](https://linear.app/obsidianowl/project/ep15-session-intelligence-91799dbb3244)
- [ADR-0006: Session Log Processing Architecture](../../docs/architecture/adr/0006-session-log-processing-architecture.md)
- [Strategic Review](../../docs/review/agentlint-strategic-review-jan26.md)
- [Constitution](../../.specify/memory/constitution.md)
- [Arc42 §5: Building Blocks](../../docs/architecture/arc42/05-building-blocks.md)

---

## 10. Technical Design Notes

> Guidance for implementation phase

### 10.1 Tool Design Principles

Per Constitution Principle VII, tools provide **data and capabilities**, the subagent provides **judgment**.

| Tool Provides | Subagent Reasons About |
|---------------|------------------------|
| Tool call sequences with hashes | Whether pattern indicates "stuck" |
| File access counts | Whether re-reads indicate context loss |
| Compression pre-token counts | Whether compression was problematic |
| Test pass/fail counts | Whether quality is acceptable |
| MCP error rates | Whether integration needs attention |
| Token usage numbers | Whether usage was appropriate for task |

### 10.2 Subagent Design

The Session Analyst subagent should:
- Have access to all session intelligence tools
- Be limited to ~5 turns per analysis (focused scope)
- Produce structured output: narrative + issues + recommendations
- Balance quantitative data with qualitative understanding
- Contextualise metrics against task complexity (a 10M token session for implementing an epic is different from one for fixing a typo)

### 10.3 Database Schema Extensions

Extend existing `sessions.db` with new tables:
- `tool_call_sequences` - tool invocations with hashes
- `file_accesses` - file operations
- `compression_events` - compression occurrences
- `delegation_events` - subagent invocations
- `mcp_tool_calls` - MCP invocations
- `quality_signals` - test/build outcomes

See epic definition for detailed schema.

### 10.4 Indexing Strategy

Index new tables on:
- `session_id` (all tables) - primary query dimension
- `timestamp` (all tables) - date range filtering
- `input_hash` (tool_call_sequences) - pattern detection
- `file_path` (file_accesses) - file-based queries
- `server_name` (mcp_tool_calls) - server-based queries

---

## Clarifications

> This section is populated by /dev.clarify

### C1: Incremental Session Analysis

**Decision**: Subagent analyses sessions **incrementally**, not upfront.

**Rationale**: A phase isn't predefined—it's emergent from session data. The subagent:

1. **Starts with session metadata** — timestamp, duration, first user prompt (intent), total message count
2. **Requests data in chunks** — "give me messages 1-50" or "give me the next batch of tool calls"
3. **Builds narrative incrementally** — after understanding intent, request exploration data, then implementation, etc.

The tools don't define phases—they provide **windowed access** to session data. The subagent reasons about phase boundaries based on patterns (e.g., shift from Read/Grep to Write/Edit indicates exploration→implementation).

**Token budget**: A 19MB session is ~4-5M tokens raw. The subagent only needs:
- Message summaries (not full content)
- Tool call sequences (name, file, success/fail)
- Compression events
- Key decision points

Target: ~50-100K tokens for a rich session summary via incremental requests.

---

### C2: Test Output Interpretation

**Decision**: **Agent interprets raw test output**—no framework-specific parsers.

**Rationale**: Aligns with agent-reasoned philosophy (C3). Tool identifies "this looks like test output" based on patterns (PASS/FAIL, assertion errors, test runner headers) and includes raw text. Agent reasons about:
- Pass/fail counts
- Which tests failed
- Error patterns

**Benefits**:
- Works with any test framework
- No parser maintenance burden
- Agent can handle edge cases and non-standard formats
- Consistent with Constitution Principle VII (tool provides data, agent judges)

---

### C3: Agent-Reasoned Phase Detection

**Decision**: **Phase detection is fully agent-reasoned**.

**Rationale**: Tool provides raw data:
- Tool call sequences with timestamps
- File access patterns
- Error clusters
- Compression boundaries

Agent reasons about what phase they represent:
- Heavy Read/Grep/Glob → likely exploration
- Write/Edit clusters → likely implementation
- Error loops + Read same file → likely debugging
- Compression after long context → possible phase boundary

**Why not heuristics**: Hardcoded phase rules would encode judgment in tools, violating Constitution Principle VII. Different sessions have different patterns—a research session may never enter "implementation" phase, while a bug fix may skip "exploration" entirely.
