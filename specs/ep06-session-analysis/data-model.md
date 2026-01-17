# Data Model: Session Analysis Tools

> **Epic**: EP06
> **Created**: 2026-01-17
> **Status**: Draft

---

## Overview

This document defines the data entities, relationships, and validation rules for Session Analysis Tools. These entities support session log discovery, JSONL parsing, FTS5 indexing, and metrics extraction.

---

## Entities

### SessionFile

**Description**: A discovered Claude Code session log file in `~/.claude/projects/`.

**Source**: US-001 (Discover Session Logs), FR-001

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| path | string | Yes | - | Absolute path to JSONL file |
| projectPath | string | Yes | - | Decoded project path (from encoded directory name) |
| encodedPath | string | Yes | - | Original encoded directory name |
| size | number | Yes | - | File size in bytes |
| lastModified | number | Yes | - | File mtime (Unix timestamp ms) |
| entryCount | number | No | null | Number of entries (set after indexing) |

**Validation Rules**:
- `path` must end with `.jsonl`
- `path` must exist and be readable
- `size` must be >= 0

**Invariants**:
- `projectPath` is derived from `encodedPath` via dash replacement

---

### SessionEntry

**Description**: A single line from a JSONL session log, representing one conversation turn or event.

**Source**: US-002 (Parse Session Content), FR-002, FR-003

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| type | EntryType | Yes | - | Entry type: 'user' \| 'assistant' \| 'summary' \| 'system' |
| sessionId | string | Yes | - | UUID identifying the session |
| uuid | string | Yes | - | Unique ID for this entry |
| parentUuid | string | Yes | - | Links to parent message in conversation |
| timestamp | string | Yes | - | ISO-8601 timestamp |
| cwd | string | No | null | Current working directory when entry created |
| gitBranch | string | No | null | Git branch at time of entry |
| version | string | No | null | Claude Code version |
| message | Message | No | null | Message content and metadata |
| toolUseResult | ToolResult | No | null | Tool execution result |
| summary | string | No | null | Summary text (for type='summary') |
| leafUuid | string | No | null | Last message before compression (for type='summary') |
| filePath | string | Yes | - | Source file path (added during parsing) |
| lineNumber | number | Yes | - | Line number in source file (1-indexed) |

**Validation Rules**:
- `type` must be one of the valid EntryType values
- `timestamp` must be valid ISO-8601
- If `type === 'summary'`, `summary` must be present
- `lineNumber` must be >= 1

**Invariants**:
- `filePath` and `lineNumber` are always populated (added during parsing)
- `uuid` is unique within a session log

---

### Message

**Description**: Message content and metadata within a SessionEntry.

**Source**: US-002, FR-002

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| role | 'user' \| 'assistant' | Yes | - | Message role |
| content | ContentBlock[] | Yes | - | Array of content blocks |
| usage | TokenUsage | No | null | Token usage metrics |

---

### ContentBlock

**Description**: A single block within message content (text, tool_use, or tool_result).

**Source**: US-002, FR-002

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| type | 'text' \| 'tool_use' \| 'tool_result' | Yes | - | Content block type |
| text | string | No | null | Text content (for type='text') |
| id | string | No | null | Tool call ID (for type='tool_use') |
| name | string | No | null | Tool name (for type='tool_use') |
| input | object | No | null | Tool input (for type='tool_use') |
| tool_use_id | string | No | null | Reference to tool call (for type='tool_result') |
| content | string | No | null | Result content (for type='tool_result') |

---

### TokenUsage

**Description**: Token usage metrics from Claude API response.

**Source**: US-003 (Extract Session Metrics), FR-004, Spec §10.3

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| input_tokens | number | Yes | 0 | Direct input tokens |
| output_tokens | number | Yes | 0 | Generated output tokens |
| cache_creation_input_tokens | number | No | 0 | Tokens used to create prompt cache |
| cache_read_input_tokens | number | No | 0 | Tokens read from prompt cache |

---

### ToolResult

**Description**: Result from a tool execution, stored at entry level.

**Source**: US-002, FR-002

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | string | Yes | - | Tool call ID |
| name | string | Yes | - | Tool name |
| result | string \| object | Yes | - | Tool execution result |

---

### SessionMetrics

**Description**: Aggregated metrics for a single session.

**Source**: US-003, FR-003-010

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| sessionId | string | Yes | - | Session UUID |
| projectPath | string | Yes | - | Decoded project path |
| inputTokens | number | Yes | 0 | Total input tokens |
| outputTokens | number | Yes | 0 | Total output tokens |
| cacheReadTokens | number | Yes | 0 | Total cache read tokens |
| cacheCreationTokens | number | Yes | 0 | Total cache creation tokens |
| turnCount | number | Yes | 0 | Number of conversation turns (user+assistant pairs) |
| duration | number | No | null | Session duration in milliseconds |
| firstTimestamp | string | Yes | - | First entry timestamp |
| lastTimestamp | string | Yes | - | Last entry timestamp |
| toolDistribution | ToolDistribution | Yes | - | Tool usage by category |
| errorCount | number | Yes | 0 | Number of tool errors detected |
| compressionCount | number | Yes | 0 | Number of context compressions |

---

### ToolDistribution

**Description**: Tool usage counts by category.

**Source**: US-003, FR-006

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| read | number | Yes | 0 | Read tool calls |
| write | number | Yes | 0 | Write/Edit tool calls |
| bash | number | Yes | 0 | Bash command calls |
| search | number | Yes | 0 | Grep/Glob/search calls |
| other | number | Yes | 0 | Other tool calls |
| total | number | Yes | 0 | Total tool calls |

---

### SearchResult

**Description**: A single search match from FTS5 query.

**Source**: US-005 (Search Sessions), FR-012, FR-015

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| sessionId | string | Yes | - | Session UUID |
| timestamp | string | Yes | - | Entry timestamp |
| role | string | No | null | Message role |
| contentSnippet | string | Yes | - | Matched content with highlights |
| toolName | string | No | null | Tool name if tool-related |
| relevanceScore | number | Yes | - | BM25 relevance score |
| filePath | string | Yes | - | Source file path |
| lineNumber | number | Yes | - | Line number for causal reference |
| projectPath | string | Yes | - | Decoded project path |

---

### SessionStats

**Description**: Aggregated statistics across multiple sessions.

**Source**: US-006 (Get Session Statistics), FR-013

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| timeRange | TimeRange | Yes | - | Time range of included sessions |
| projectFilter | string | No | null | Project path filter if applied |
| sessionCount | number | Yes | 0 | Number of sessions analyzed |
| totalInputTokens | number | Yes | 0 | Sum of input tokens |
| totalOutputTokens | number | Yes | 0 | Sum of output tokens |
| totalCacheTokens | number | Yes | 0 | Sum of cache-related tokens |
| avgTurnsPerSession | number | Yes | 0 | Average turns per session |
| totalToolCalls | number | Yes | 0 | Sum of tool invocations |
| toolErrorRate | number | Yes | 0 | Errors / total tool calls |
| compressionCount | number | Yes | 0 | Total context compressions |
| avgTokensPerTurn | number | Yes | 0 | Efficiency metric |
| toolDistribution | ToolDistribution | Yes | - | Aggregate tool usage |

---

### TimeRange

**Description**: Time range for filtering and reporting.

**Source**: FR-021

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| since | string | No | null | Start timestamp (ISO-8601) |
| until | string | No | null | End timestamp (ISO-8601) |

---

### IndexedFile

**Description**: Metadata for tracking indexed files (incremental indexing).

**Source**: US-004 (Index Sessions), FR-016

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| filePath | string | Yes | - | Absolute path to JSONL file |
| lastModified | number | Yes | - | File mtime when indexed |
| entryCount | number | Yes | 0 | Number of entries indexed |
| indexedAt | string | Yes | - | ISO-8601 timestamp of indexing |

---

## Relationships

```
┌──────────────┐         ┌───────────────┐
│  SessionFile │───1:N──▶│  SessionEntry │
└──────────────┘         └───────────────┘
       │                        │
       │ 1:1                    │ N:1
       ▼                        ▼
┌──────────────┐         ┌──────────────────────┐
│ IndexedFile  │         │ FTS5 session_entries │
└──────────────┘         └──────────────────────┘
       │                        │
       │ N:1                    │ 0:1
       ▼                        ▼
┌────────────────┐        ┌──────────────┐
│ SessionMetrics │        │ SearchResult │
└────────────────┘        └──────────────┘
       │
       │ N:1
       ▼
┌──────────────┐
│ SessionStats │
└──────────────┘
```

| From | Relationship | To | Description |
|------|--------------|----|--------------|
| SessionFile | 1:N | SessionEntry | One file contains many entries |
| SessionFile | 1:1 | IndexedFile | Tracks indexing status per file |
| SessionEntry | N:1 | FTS5 Index | Entries indexed in virtual table |
| SessionEntry | 0:1 | SearchResult | When matched by query |
| SessionFile | N:1 | SessionMetrics | Aggregated metrics per session |
| SessionMetrics | N:1 | SessionStats | Further aggregation for stats |

---

## State Transitions

### IndexedFile States

```
┌─────────┐    discover    ┌────────────┐    index     ┌───────────┐
│ (start) │───────────────▶│ Discovered │─────────────▶│  Indexed  │
└─────────┘                └────────────┘              └───────────┘
                                  │                          │
                                  │ file deleted             │ file modified
                                  ▼                          ▼
                           ┌────────────┐             ┌───────────┐
                           │  Removed   │             │   Stale   │
                           └────────────┘             └───────────┘
                                                           │
                                                           │ re-index
                                                           ▼
                                                     ┌───────────┐
                                                     │  Indexed  │
                                                     └───────────┘
```

| State | Description | Allowed Transitions |
|-------|-------------|---------------------|
| Discovered | File found, not yet indexed | Indexed, Removed |
| Indexed | File indexed in FTS5 | Stale, Removed |
| Stale | File modified since indexing | Indexed (re-index) |
| Removed | File deleted | (terminal) |

---

## Type Definitions

```typescript
// Core entity types

type EntryType = 'user' | 'assistant' | 'summary' | 'system';

interface SessionFile {
  path: string;
  projectPath: string;
  encodedPath: string;
  size: number;
  lastModified: number;
  entryCount: number | null;
}

interface SessionEntry {
  type: EntryType;
  sessionId: string;
  uuid: string;
  parentUuid: string;
  timestamp: string;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  message?: Message;
  toolUseResult?: ToolResult;
  summary?: string;
  leafUuid?: string;
  // Added during parsing
  filePath: string;
  lineNumber: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: ContentBlock[];
  usage?: TokenUsage;
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface ToolResult {
  id: string;
  name: string;
  result: string | Record<string, unknown>;
}

interface ToolDistribution {
  read: number;
  write: number;
  bash: number;
  search: number;
  other: number;
  total: number;
}

interface SessionMetrics {
  sessionId: string;
  projectPath: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  turnCount: number;
  duration: number | null;
  firstTimestamp: string;
  lastTimestamp: string;
  toolDistribution: ToolDistribution;
  errorCount: number;
  compressionCount: number;
}

interface SearchResult {
  sessionId: string;
  timestamp: string;
  role?: string;
  contentSnippet: string;
  toolName?: string;
  relevanceScore: number;
  filePath: string;
  lineNumber: number;
  projectPath: string;
}

interface TimeRange {
  since?: string;
  until?: string;
}

interface SessionStats {
  timeRange: TimeRange;
  projectFilter?: string;
  sessionCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheTokens: number;
  avgTurnsPerSession: number;
  totalToolCalls: number;
  toolErrorRate: number;
  compressionCount: number;
  avgTokensPerTurn: number;
  toolDistribution: ToolDistribution;
}

interface IndexedFile {
  filePath: string;
  lastModified: number;
  entryCount: number;
  indexedAt: string;
}
```

---

## Database Schema

```sql
-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE session_entries USING fts5(
  session_id,
  timestamp,
  role,
  content,
  tool_name,
  tool_input,
  tool_result,
  file_path,
  line_number,
  tokenize = 'porter unicode61'
);

-- Metadata for incremental indexing
CREATE TABLE indexed_files (
  file_path TEXT PRIMARY KEY,
  last_modified INTEGER NOT NULL,
  entry_count INTEGER NOT NULL DEFAULT 0,
  indexed_at TEXT NOT NULL
);

-- Session summary for quick lookups and stats
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  first_timestamp TEXT NOT NULL,
  last_timestamp TEXT NOT NULL,
  entry_count INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  turn_count INTEGER NOT NULL DEFAULT 0,
  compression_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0
);

-- Tool usage per session for distribution queries
CREATE TABLE session_tools (
  session_id TEXT NOT NULL,
  tool_category TEXT NOT NULL,  -- 'read', 'write', 'bash', 'search', 'other'
  call_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, tool_category),
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);
```

---

## Indexes & Constraints

| Table | Index/Constraint | Type | Purpose |
|-------|------------------|------|---------|
| session_entries | FTS5 built-in | Full-text | BM25 search |
| indexed_files | file_path | PRIMARY KEY | Uniqueness |
| sessions | session_id | PRIMARY KEY | Uniqueness |
| sessions | project_path | INDEX | Filter by project |
| sessions | first_timestamp | INDEX | Date range queries |
| session_tools | session_id, tool_category | PRIMARY KEY | Uniqueness |

---

## Migration Notes

> EP06 creates new tables; no migration from existing schema required.

| Change | Migration Required | Strategy |
|--------|-------------------|----------|
| Create session_entries FTS5 | No (new) | Create on first run |
| Create indexed_files | No (new) | Create on first run |
| Create sessions | No (new) | Create on first run |
| Create session_tools | No (new) | Create on first run |

---

## References

- **Spec Entities**: spec.md Section 4
- **Requirements**: FR-001 through FR-021, NFR-001 through NFR-007
- **ADRs**: ADR-0006 (FTS5 schema)
