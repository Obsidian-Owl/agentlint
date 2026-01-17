# Feature Specification: Session Analysis Tools

> **Epic**: EP06
> **Created**: 2026-01-17
> **Status**: Draft
> **Author**: Claude

---

## 1. Overview

Implement tools for AI session log discovery, metrics extraction, and full-text search with SQLite FTS5. This epic provides the `search_sessions` and `get_session_stats` tools that enable the agent to find relevant conversation history, extract quantitative metrics, and trace issues back to their origins in past sessions.

### 1.1 Business Context

Session Analysis Tools are part of the "Core Tools" phase in agentlint's architecture. They enable the agent to:
- Discover Claude Code session logs in `~/.claude/projects/`
- Parse JSONL session format to extract structured data
- Calculate token usage, turn counts, and efficiency metrics
- Search across session history with BM25 relevance ranking
- Provide position markers for causal tracing (file:line references)

**Business Hypothesis**: If we implement robust session log analysis with FTS5 search and metrics extraction, then developers can understand AI session patterns and the agent can trace issues to origins, measured by accurate metrics extraction and <2s search queries across session history.

### 1.2 Out of Scope

- Session quality assessment (requires LLM reasoning - EP07: Causal Tracing Engine)
- Causal chain reasoning about why issues occurred (EP07)
- Generating recommendations based on session analysis (EP10: Recommendation Engine)
- Non-Claude Code session formats (EP08: ACT Adapters provides adapter interface)
- Real-time session monitoring (watch-based indexing is included, but not live streaming)
- Session visualization or interactive exploration

---

## 2. User Scenarios & Testing

> User stories are prioritized: P1 (must-have), P2 (should-have), P3 (nice-to-have)

### US-001 [P1]: Discover Session Logs

**As a** developer setting up agentlint,
**I want** to discover all Claude Code session logs on my machine,
**So that** I know what session history is available for analysis.

**Acceptance Criteria:**
- [ ] Given `~/.claude/projects/` exists, when session discovery runs, then all `*.jsonl` files are found
- [ ] Given a session log directory, when discovery runs, then encoded project paths are decoded to human-readable paths
- [ ] Given no session logs exist, when discovery runs, then an empty result is returned with helpful guidance
- [ ] Given session logs in multiple project directories, when discovery runs, then logs are grouped by project

**Test Scenarios:**
- Happy path: User with 50+ session logs across 5 projects
- Happy path: Fresh installation with no session history
- Edge case: Corrupted directory structure in `~/.claude/projects/`
- Edge case: Symlinked session directories

---

### US-002 [P1]: Parse Session Content

**As a** developer analyzing my AI usage,
**I want** session logs parsed into structured data,
**So that** the agent can reason about conversation patterns.

**Acceptance Criteria:**
- [ ] Given a JSONL session file, when parsed, then each line is extracted as a session entry
- [ ] Given a session entry, when parsed, then message role (user/assistant), content, and timestamp are extracted
- [ ] Given a tool_use entry, when parsed, then tool name, input, and result are extracted
- [ ] Given a malformed JSONL line, when parsed, then that line is skipped with a warning, and parsing continues
- [ ] Given any parsed entry, then position information (file path, line number) is preserved for causal references

**Test Scenarios:**
- Happy path: Well-formed JSONL with 1000 entries
- Happy path: Session with tool_use, tool_result interleaved
- Error case: JSONL with one corrupted line in the middle
- Error case: Binary data embedded in session log
- Edge case: Very long message content (>100KB)

---

### US-003 [P1]: Extract Session Metrics

**As a** developer understanding my AI costs,
**I want** metrics extracted from my session history,
**So that** I can track token usage and iteration patterns.

**Acceptance Criteria:**
- [ ] Given a parsed session, when metrics are extracted, then total input/output tokens are calculated
- [ ] Given a parsed session, when metrics are extracted, then turn count (conversation exchanges) is reported
- [ ] Given a parsed session, when metrics are extracted, then tool usage distribution is categorized (read/write/bash/search)
- [ ] Given a parsed session, when metrics are extracted, then session duration is calculated from first to last timestamp
- [ ] Given multiple sessions, when aggregated, then total and per-project metrics are available

**Test Scenarios:**
- Happy path: Session with varied tool usage patterns
- Happy path: Long-running session (>2 hours)
- Edge case: Session with only user messages (no assistant responses)
- Edge case: Session with context compression events

---

### US-004 [P1]: Index Sessions for Search

**As a** developer tracing an issue origin,
**I want** sessions indexed for fast full-text search,
**So that** I can find when an issue first occurred.

**Acceptance Criteria:**
- [ ] Given session content, when indexed, then FTS5 virtual table is populated
- [ ] Given previously indexed sessions, when re-indexed, then unchanged files are skipped (incremental indexing)
- [ ] Given index creation, when complete, then metadata table tracks indexed files and timestamps
- [ ] Given a large session corpus (500MB+), when indexed, then memory usage stays under 100MB

**Test Scenarios:**
- Happy path: Index 100 session logs totaling 200MB
- Happy path: Incremental re-index after 5 new sessions added
- Performance: Index 500MB of logs in under 60 seconds
- Edge case: Interrupted indexing (power failure simulation)

---

### US-005 [P1]: Search Sessions

**As a** developer investigating a past issue,
**I want** to search across all sessions with relevance ranking,
**So that** I can find the most relevant conversation moments.

**Acceptance Criteria:**
- [ ] Given a search query, when executed, then results are ranked by BM25 relevance
- [ ] Given a search query, when executed, then result snippets show matching content with highlights
- [ ] Given a search query, when executed, then results include file path and line number for causal reference
- [ ] Given phrase search ("permission denied"), when executed, then exact phrase matches are found
- [ ] Given prefix search (error*), when executed, then stemmed variants are matched
- [ ] Given field-specific search (tool_name:Bash), when executed, then only matching field results are returned

**Test Scenarios:**
- Happy path: Search "API key" returns relevant error discussions
- Happy path: Search "permission denied" finds exact phrases
- Performance: Search query returns in <2 seconds on 500MB corpus
- Edge case: Search with no results returns empty with suggestions
- Edge case: Very broad query ("the") limited to top 100 results

---

### US-006 [P2]: Get Session Statistics

**As a** developer optimizing my AI workflow,
**I want** aggregated statistics about my sessions,
**So that** I can identify efficiency trends.

**Acceptance Criteria:**
- [ ] Given a time range, when stats are requested, then token usage trends are reported
- [ ] Given a project filter, when stats are requested, then only that project's sessions are included
- [ ] Given stats request, when executed, then tool error rates and retry patterns are identified
- [ ] Given stats request, when executed, then compression trigger frequency is reported
- [ ] Given stats request, when executed, then average tokens-per-turn efficiency is calculated

**Test Scenarios:**
- Happy path: Stats for last 30 days across all projects
- Happy path: Stats for specific project only
- Edge case: Stats for time range with no sessions
- Edge case: Stats aggregation across 1000+ sessions

---

### US-007 [P2]: Detect Tool Errors and Retries

**As a** developer improving my prompts,
**I want** to see tool error patterns,
**So that** I can identify problematic interaction patterns.

**Acceptance Criteria:**
- [ ] Given session logs, when analyzed, then tool errors are extracted with error messages
- [ ] Given tool errors, when analyzed, then retry patterns are detected (same tool called repeatedly)
- [ ] Given retry patterns, when analyzed, then root cause hints are generated (permission, syntax, etc.)
- [ ] Given error analysis, when complete, then frequency by tool type is reported

**Test Scenarios:**
- Happy path: Session with Bash command failures and retries
- Happy path: Session with file not found errors
- Edge case: Session with no errors (healthy pattern)
- Edge case: Cascading errors (one failure causes multiple)

---

### US-008 [P3]: Monitor Sessions in Real-Time

**As a** developer using agentlint during active coding,
**I want** new sessions indexed automatically,
**So that** search results stay current.

**Acceptance Criteria:**
- [ ] Given file watcher enabled, when new JSONL file appears, then it is indexed automatically
- [ ] Given file watcher enabled, when existing JSONL is modified, then delta is re-indexed
- [ ] Given file watcher enabled, when JSONL is deleted, then it is removed from index
- [ ] Given watcher crash, when restarted, then watcher resumes monitoring

**Test Scenarios:**
- Happy path: New session file indexed within 5 seconds
- Happy path: Appended session entries indexed incrementally
- Edge case: File deleted during active indexing
- Edge case: Rapid file changes (debouncing)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | Discover Claude Code session logs in `~/.claude/projects/` with encoded path decoding | P1 | US-001 |
| FR-002 | Parse JSONL session format extracting messages, tool_calls, tool_results | P1 | US-002 |
| FR-003 | Extract session metadata: timestamps, project path, session duration | P1 | US-002 |
| FR-004 | Calculate token usage metrics: input, output, total, per-turn | P1 | US-003 |
| FR-005 | Count iterations/turns per task with conversation exchange detection | P1 | US-003 |
| FR-006 | Categorize tool usage distribution (read/write/bash/search/other) | P1 | US-003 |
| FR-007 | Detect tool errors and extract error messages | P2 | US-007 |
| FR-008 | Identify retry patterns (same tool called repeatedly after failure) | P2 | US-007 |
| FR-009 | Detect context compression triggers | P2 | US-003 |
| FR-010 | Calculate efficiency ratios (tokens per successful outcome) | P2 | US-006 |
| FR-011 | Create SQLite FTS5 index with BM25 ranking per ADR-0006 | P1 | US-004 |
| FR-012 | Implement `search_sessions` tool with query syntax support | P1 | US-005 |
| FR-013 | Implement `get_session_stats` tool for metrics aggregation | P2 | US-006 |
| FR-014 | Support phrase search, prefix search, field-specific search | P1 | US-005 |
| FR-015 | Include position markers (file:line) in search results for causal reference | P1 | US-005 |
| FR-016 | Implement incremental indexing (skip unchanged files based on mtime) | P1 | US-004 |
| FR-017 | Implement file watcher for automatic re-indexing | P3 | US-008 |
| FR-018 | Stream parse large JSONL files to limit memory usage | P1 | US-004 |
| FR-019 | Create session summaries for agent consumption (avoid raw log ingestion) | P2 | US-002 |
| FR-020 | Use Porter stemmer for word variation matching | P1 | US-005 |
| FR-021 | Support date range filtering with `--since` and `--until` flags | P1 | US-005, US-006 |

### 3.2 Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-001 | Search query performance | Response time on 500MB corpus | < 2 seconds |
| NFR-002 | Indexing throughput | Time to index 500MB of logs | < 60 seconds |
| NFR-003 | Memory efficiency during indexing | Peak memory usage | < 100MB |
| NFR-004 | Memory efficiency during parsing | Peak memory per session | < 50MB |
| NFR-005 | Index storage overhead | Index size vs original logs | < 20% additional |
| NFR-006 | Incremental indexing performance | Time to check 100 files for changes | < 1 second |
| NFR-007 | Error recovery | Successful parse despite corrupted entries | > 99% of valid entries |

---

## 4. Key Entities

> Define the core domain entities this feature introduces or modifies

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| `SessionFile` | A discovered session log file | path, projectPath, size, lastModified, entryCount |
| `SessionEntry` | A single line from JSONL log | sessionId, timestamp, role, content, toolName, toolInput, toolResult, filePath, lineNumber |
| `SessionMetrics` | Aggregated metrics for a session | inputTokens, outputTokens, turnCount, duration, toolDistribution, errorCount |
| `SearchResult` | A single search match | sessionId, timestamp, contentSnippet, relevanceScore, filePath, lineNumber |
| `SessionStats` | Aggregated statistics | timeRange, projectFilter, totalTokens, avgTurnsPerSession, toolErrorRate, compressionCount |
| `IndexedFile` | Metadata for indexed files | filePath, lastModified, entryCount, indexedAt |

### 4.1 Entity Relationships

```
SessionFile --1:N--> SessionEntry
SessionEntry --N:1--> FTS5Index (session_entries virtual table)
SessionFile --1:1--> IndexedFile
SessionEntry --0:1--> SearchResult (when matched)
SessionFile --N:1--> SessionMetrics (aggregation)
SessionMetrics --N:1--> SessionStats (further aggregation)
```

---

## 5. Success Criteria

> How do we know this feature is successful? Define measurable outcomes.

- [ ] **Functional**: All P1 user stories pass acceptance criteria
- [ ] **Quality**: Test coverage > 80% for session analysis tools
- [ ] **Performance**: Search query < 2 seconds on 500MB corpus (NFR-001)
- [ ] **Performance**: Indexing < 60 seconds for 500MB (NFR-002)
- [ ] **Memory**: Peak memory < 100MB during indexing (NFR-003)
- [ ] **MVP Gate**: `search_sessions` returns relevant ranked results that agent can use for tracing
- [ ] **Integration**: Tools integrate with orchestration layer (EP02) via SDK `tool()` pattern
- [ ] **Integration**: Index stored in `.agentlint/sessions.db` per ADR-0006

---

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior | Priority |
|----------|-------------------|----------|
| Session log directory doesn't exist | Return empty result with guidance to check Claude Code installation | P1 |
| Malformed JSONL line (invalid JSON) | Skip line, log warning, continue parsing | P1 |
| Very large session file (>500MB single file) | Stream parse in chunks, maintain memory efficiency | P1 |
| Corrupted UTF-8 in session content | Replace invalid sequences, preserve rest | P2 |
| Session with missing timestamp | Use file mtime as fallback | P2 |
| Session with no tool usage | Return valid metrics with zero tool counts | P1 |
| FTS5 query syntax error | Return helpful error message with syntax hints | P1 |
| Database locked by another process | Retry with exponential backoff, then fail gracefully | P2 |
| Disk full during indexing | Fail gracefully, preserve partial index | P2 |
| Session log actively being written | Handle partial last line gracefully | P2 |
| Permission denied on session file | Skip file, log warning, continue discovery | P1 |
| Circular symlinks in projects directory | Detect and skip with warning | P2 |

---

## 7. Dependencies & Assumptions

### 7.1 Dependencies

| Dependency | Type | Status | Impact if Missing |
|------------|------|--------|-------------------|
| EP01 Project Foundation | Internal | Complete | Cannot start - need Bun:sqlite, project structure |
| EP02 Orchestration Core | Internal | Complete | Cannot register tools with SDK |
| EP03 Persistence Layer | Internal | Complete | Cannot use sessions.db infrastructure |
| Bun:sqlite FTS5 | External | Available | Core functionality - full-text search |
| Claude Code session logs | External | User-dependent | No data to analyze if user hasn't used Claude Code |

### 7.2 Assumptions (Validated)

- ✅ Claude Code session logs use JSONL format with `type`, `sessionId`, `uuid`, `parentUuid`, `timestamp`, `message` fields
- ✅ Session logs are stored at `~/.claude/projects/[dash-encoded-path]/*.jsonl` (slashes replaced with dashes)
- ✅ Users have read access to their own session logs
- ✅ Bun:sqlite supports FTS5 (confirmed since v0.6.12)
- ✅ Token counts are available in `message.usage` object (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`)
- ✅ Context compression creates `type: "summary"` entries with `leafUuid` pointing to last message before compression
- Session log format is stable (changes would require adapter update)

---

## 8. Open Questions

> Questions that need resolution before implementation

- [x] **Q1**: How are project paths encoded in `~/.claude/projects/` directory names? — [RESOLVED: See Clarifications §10.1]
- [x] **Q2**: What's the exact JSONL schema for Claude Code session logs? Need sample files. — [RESOLVED: See Clarifications §10.2]
- [x] **Q3**: Are token counts included in session logs or do we need to estimate them? — [RESOLVED: See Clarifications §10.3]
- [x] **Q4**: Should we support filtering search by date range in v1? — [RESOLVED: Yes, include in v1 - See Clarifications §10.4]
- [x] **Q5**: What triggers context compression and how is it recorded in logs? — [RESOLVED: See Clarifications §10.5]

---

## 9. References

- [Epic: EP06 Session Analysis Tools](../../docs/planning/epics/EP06-session-analysis.md)
- [ADR-0006: Session Log Processing Architecture](../../docs/architecture/adr/0006-session-log-processing-architecture.md)
- [ADR-0005: Tool Definition and Invocation Pattern](../../docs/architecture/adr/0005-tool-definition-and-invocation-pattern.md)
- [Arc42 §5: Building Blocks - Tool Layer](../../docs/architecture/arc42/05-building-blocks.md)
- [Use Cases: UC-003 Analyse Sessions](../../docs/requirements/use-cases.md)
- [Functional Requirements: FR-4](../../docs/requirements/functional-requirements.md)
- [SQLite FTS5 Documentation](https://sqlite.org/fts5.html)
- [Simon Willison: Claude Code Logs](https://simonwillison.net/2025/Oct/22/claude-code-logs/)
- [DuckDB Claude Code Log Analysis](https://liambx.com/blog/claude-code-log-analysis-with-duckdb)

---

## 10. Clarifications

> Resolved by `/dev.clarify` on 2026-01-17

### 10.1 Q1: Project Path Encoding Scheme

**Finding**: Project paths are encoded by replacing forward slashes (`/`) with dashes (`-`).

**Example**:
- Original path: `/Users/dmccarthy/Projects/agentlint`
- Encoded directory: `-Users-dmccarthy-Projects-agentlint`

**Implementation**: Simple string replacement - no URL encoding or complex transformation needed.

### 10.2 Q2: JSONL Schema

**Finding**: Session logs contain one JSON object per line with the following schema:

```json
{
  "type": "user" | "assistant" | "summary" | "system",
  "sessionId": "UUID",
  "uuid": "UUID (unique per entry)",
  "parentUuid": "UUID (links to parent message)",
  "timestamp": "ISO-8601 datetime",
  "cwd": "/path/to/project",
  "gitBranch": "branch-name",
  "version": "2.1.5",
  "message": {
    "role": "user" | "assistant",
    "content": [
      { "type": "text", "text": "..." },
      { "type": "tool_use", "id": "...", "name": "Read", "input": {...} },
      { "type": "tool_result", "tool_use_id": "...", "content": "..." }
    ],
    "usage": {
      "input_tokens": 10,
      "output_tokens": 3,
      "cache_creation_input_tokens": 6823,
      "cache_read_input_tokens": 13368
    }
  },
  "toolUseResult": {
    "id": "...",
    "name": "Read",
    "result": "..."
  }
}
```

**Entry Types**:
- `user`: User messages
- `assistant`: Assistant responses with tool calls
- `summary`: Context compression markers
- `system`: System messages

### 10.3 Q3: Token Count Availability

**Finding**: Token counts are **available directly** in `message.usage` object.

**Fields available**:
- `input_tokens`: Direct input tokens
- `output_tokens`: Generated output tokens
- `cache_creation_input_tokens`: Tokens used to create prompt cache
- `cache_read_input_tokens`: Tokens read from prompt cache

**Implementation**: No estimation needed - use actual counts from logs.

### 10.4 Q4: Date Range Filtering

**Decision**: Yes, include in v1 (user-confirmed).

**Implementation**: Add `--since` and `--until` flags to `search_sessions` tool.

**Added**: FR-021 for date range filtering support.

### 10.5 Q5: Compression Trigger Format

**Finding**: Context compression creates entries with `type: "summary"`:

```json
{
  "type": "summary",
  "sessionId": "UUID",
  "uuid": "UUID",
  "parentUuid": "UUID",
  "timestamp": "ISO-8601",
  "summary": "Summary of the compressed content...",
  "leafUuid": "UUID-of-last-message-before-compression"
}
```

**Key fields**:
- `type: "summary"` identifies compression events
- `summary`: Human-readable description of compressed content
- `leafUuid`: Points to the last message before compression (enables tracing)

**Implementation**: Detect `type === "summary"` entries, use `leafUuid` for causal chain reconstruction.

---

### External References

Research validated against:
- [Simon Willison: Claude Code Logs](https://simonwillison.net/2025/Oct/22/claude-code-logs/)
- [claude-code-log analysis tool](https://github.com/daaain/claude-code-log)
- Direct examination of `~/.claude/projects/` on local machine
