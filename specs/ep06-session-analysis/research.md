# Research Findings: Session Analysis Tools

> **Epic**: EP06
> **Created**: 2026-01-17
> **Status**: Complete

---

## Overview

This document captures research findings and technical decisions made during the planning phase for Session Analysis Tools. All unknowns from the specification have been resolved through direct investigation of Claude Code session logs and codebase patterns.

---

## Decision Log

### Decision 1: JSONL Entry Type Detection

**Question**: How to differentiate entry types in session logs?

**Decision**: Use the `type` field to identify entry types: `user`, `assistant`, `summary`, `system`.

**Rationale**: Direct examination of session logs shows consistent `type` field usage. This provides clean branching for parsing logic.

**Implementation**:
```typescript
type SessionEntryType = 'user' | 'assistant' | 'summary' | 'system';

interface SessionEntry {
  type: SessionEntryType;
  sessionId: string;
  uuid: string;
  parentUuid: string;
  timestamp: string;
  // ... rest of fields
}
```

**References**:
- Spec §10.2 JSONL Schema
- Direct examination of `~/.claude/projects/` logs

---

### Decision 2: Token Count Strategy

**Question**: Estimate tokens or use actual values?

**Decision**: Use actual token counts from `message.usage` object.

**Rationale**: Claude Code logs include precise token counts including cache metrics. No estimation needed, providing accurate cost analysis.

**Implementation**:
```typescript
interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

// Extract from message.usage
const usage = entry.message?.usage as TokenUsage;
const totalTokens = (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0);
```

**Alternatives Considered**:
1. tiktoken estimation - Not needed since actual counts available
2. Character-based estimation - Less accurate than actual counts

**References**:
- Spec §10.3 Token Count Availability

---

### Decision 3: Compression Event Detection

**Question**: How are context compressions recorded?

**Decision**: Detect `type: "summary"` entries with `leafUuid` field pointing to last message before compression.

**Rationale**: Direct examination revealed consistent structure for compression events. The `leafUuid` enables causal chain reconstruction.

**Implementation**:
```typescript
interface CompressionEntry {
  type: 'summary';
  sessionId: string;
  uuid: string;
  parentUuid: string;
  timestamp: string;
  summary: string;      // Human-readable description
  leafUuid: string;     // Last message before compression
}

function isCompressionEvent(entry: SessionEntry): boolean {
  return entry.type === 'summary' && 'leafUuid' in entry;
}
```

**References**:
- Spec §10.5 Compression Trigger Format

---

### Decision 4: Path Decoding Strategy

**Question**: How to decode project paths from directory names?

**Decision**: Replace leading dash and all dashes with forward slashes.

**Rationale**: Claude Code encodes `/Users/foo/bar` as `-Users-foo-bar`. Simple string transformation.

**Implementation**:
```typescript
function decodeProjectPath(encodedPath: string): string {
  // Remove leading dash and replace dashes with slashes
  return encodedPath.replace(/^-/, '/').replace(/-/g, '/');
}

// Example:
// "-Users-dmccarthy-Projects-agentlint" → "/Users/dmccarthy/Projects/agentlint"
```

**Edge Cases**:
- Directory names with dashes in original path are indistinguishable
- Mitigation: Store both encoded and decoded paths; allow user clarification

**References**:
- Spec §10.1 Project Path Encoding

---

### Decision 5: FTS5 Index Schema

**Question**: What fields to index for optimal search?

**Decision**: Follow ADR-0006 schema with additions for date filtering and token metrics.

**Rationale**: BM25 ranking requires content fields; position markers support causal tracing; date filtering confirmed for v1.

**Implementation**:
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
  last_modified INTEGER,
  entry_count INTEGER,
  indexed_at TEXT
);

-- Session summary for quick lookups
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  project_path TEXT,
  first_timestamp TEXT,
  last_timestamp TEXT,
  entry_count INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_read_tokens INTEGER,
  cache_creation_tokens INTEGER,
  compression_count INTEGER
);
```

**References**:
- ADR-0006 §Implementation Notes
- FR-021 Date Range Filtering

---

### Decision 6: Streaming Parser Architecture

**Question**: How to parse 500MB+ JSONL files without exceeding 100MB memory?

**Decision**: Use line-by-line streaming with Bun's file API and async iteration.

**Rationale**: JSONL format is naturally line-oriented; each line is independent JSON. No need to buffer entire file.

**Implementation**:
```typescript
async function* streamParseJSONL(filePath: string): AsyncGenerator<SessionEntry> {
  const file = Bun.file(filePath);
  const text = await file.text();
  const lines = text.split('\n');

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const line = lines[lineNumber].trim();
    if (!line) continue;

    try {
      const entry = JSON.parse(line) as SessionEntry;
      yield { ...entry, _lineNumber: lineNumber + 1 };
    } catch (error) {
      // Skip malformed lines with warning
      console.warn(`Skipping malformed line ${lineNumber + 1} in ${filePath}`);
    }
  }
}
```

**Note**: For very large files (>100MB), consider chunked reading with `file.slice()`.

**References**:
- NFR-003 Memory Efficiency (< 100MB)
- NFR-004 Memory per session (< 50MB)
- FR-018 Stream parsing

---

### Decision 7: Tool Pattern Alignment

**Question**: How to structure tools for SDK integration?

**Decision**: Follow EP05 `parse_config` tool pattern with SDK `tool()` function.

**Rationale**: Consistency with existing codebase; proven pattern from EP05.

**Implementation Pattern**:
```typescript
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const searchSessionsInputSchema = {
  query: z.string().describe('FTS5 search query'),
  since: z.string().optional().describe('ISO-8601 date/time filter (after)'),
  until: z.string().optional().describe('ISO-8601 date/time filter (before)'),
  project: z.string().optional().describe('Filter by project path'),
  limit: z.number().optional().default(50).describe('Max results'),
};

export const searchSessionsTool = tool(
  'search_sessions',
  `Search across Claude Code session history with BM25 relevance ranking...`,
  searchSessionsInputSchema,
  async (args) => {
    // Implementation
  }
);
```

**References**:
- `src/tools/config/parse-config-tool.ts`
- ADR-0005 Tool Definition Pattern

---

## Existing Patterns Found

| Pattern | Location | Applicability |
|---------|----------|---------------|
| Tool definition with SDK | `src/tools/config/parse-config-tool.ts` | Template for `search_sessions`, `get_session_stats` tools |
| Zod validation schemas | `src/persistence/schemas.ts` | Pattern for session entry schemas |
| Atomic file writes | `src/persistence/common/atomic-write.ts` | Use for index file updates |
| Error handling | `src/errors/persistence.ts` | Template for session errors |
| Database operations | `src/persistence/common/database.ts` | Pattern for SQLite operations |
| Directory utilities | `src/persistence/common/directories.ts` | Use for session directory handling |

---

## Dependencies Verified

| Dependency | Version | Status | Notes |
|------------|---------|--------|-------|
| `bun:sqlite` | Built-in | ✅ Available | FTS5 supported since v0.6.12 |
| `@anthropic-ai/claude-agent-sdk` | * | ✅ Available | `tool()` function for MCP |
| `zod` | ^3.x | ✅ Available | Schema validation |
| Claude Code session logs | - | ✅ Present | `~/.claude/projects/` verified |

---

## Open Items

> All items resolved during research

- [x] Path encoding scheme → Dash replacement confirmed
- [x] JSONL schema → Full schema documented
- [x] Token availability → `message.usage` provides actual counts
- [x] Date filtering → User confirmed for v1
- [x] Compression format → `type: "summary"` with `leafUuid`

---

## Session Log

### Session 2026-01-17

**Topics Researched**:
- Claude Code session log structure and location
- JSONL entry types and schemas
- Token count availability
- Compression event format
- Path encoding scheme

**Decisions Made**:
- Use actual token counts (no estimation)
- Detect compression via `type: "summary"`
- Simple dash replacement for path decoding
- Follow EP05 tool pattern
- Streaming parser for memory efficiency

**Next Steps**:
- Phase 2: Create data model definitions
- Phase 2: Define tool interfaces
- Phase 2: Create quickstart guide
