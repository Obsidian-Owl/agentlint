# Quickstart: Session Analysis Tools

> **Epic**: EP06
> **Status**: Draft

---

## Overview

Session Analysis Tools enable searching and analyzing Claude Code session history. The tools index JSONL logs from `~/.claude/projects/` into a SQLite FTS5 database for fast, relevance-ranked queries.

---

## Installation

Session Analysis Tools are built into agentlint. No additional installation required.

Ensure you have Claude Code session logs at:
```
~/.claude/projects/
```

---

## Basic Usage

### 1. Index Session Logs (First Time)

Before searching, the session logs must be indexed:

```typescript
import { indexSessions } from 'agentlint/tools/sessions';

const result = await indexSessions();
// { filesIndexed: 47, entriesIndexed: 12543, durationMs: 2340 }
```

Or via CLI:
```bash
agentlint scan --sessions
```

### 2. Search Sessions

Search across all session history with FTS5 query syntax:

```typescript
import { searchSessions } from 'agentlint/tools/sessions';

// Basic search
const results = await searchSessions({ query: 'permission denied' });

// Phrase search
const results = await searchSessions({ query: '"API key error"' });

// Field-specific search
const results = await searchSessions({ query: 'tool_name:Bash' });

// With date filtering
const results = await searchSessions({
  query: 'error',
  since: '2026-01-01',
  until: '2026-01-15',
});
```

### 3. Get Session Statistics

Aggregate metrics across sessions:

```typescript
import { getSessionStats } from 'agentlint/tools/sessions';

// All-time stats
const stats = await getSessionStats();

// Stats for last 30 days
const stats = await getSessionStats({
  since: '2026-01-01',
});

// Stats for specific project
const stats = await getSessionStats({
  project: '/Users/me/my-project',
});
```

---

## Common Patterns

### Finding Error Origins (Causal Tracing)

Find when an error first occurred:

```typescript
const results = await searchSessions({
  query: '"ENOENT" OR "file not found"',
  limit: 10,
});

// Results include file:line for causal reference
for (const r of results.results) {
  console.log(`${r.filePath}:${r.lineNumber} - ${r.contentSnippet}`);
}
```

### Analyzing Tool Usage

Find patterns in tool failures:

```typescript
// Find Bash errors
const bashErrors = await searchSessions({
  query: 'tool_name:Bash AND (error OR failed)',
});

// Check tool distribution
const stats = await getSessionStats();
console.log(stats.stats.toolDistribution);
// { read: 1234, write: 456, bash: 789, search: 321, other: 100, total: 2900 }
```

### Token Usage Analysis

Track token consumption:

```typescript
const stats = await getSessionStats({ since: '2026-01-01' });

console.log(`Total tokens: ${stats.stats.totalInputTokens + stats.stats.totalOutputTokens}`);
console.log(`Avg tokens/turn: ${stats.stats.avgTokensPerTurn}`);
console.log(`Cache tokens: ${stats.stats.totalCacheTokens}`);
```

### Finding Context Compressions

Identify when context was compressed:

```typescript
const compressions = await searchSessions({
  query: 'role:summary',
  limit: 100,
});

const stats = await getSessionStats();
console.log(`Total compressions: ${stats.stats.compressionCount}`);
```

---

## FTS5 Query Syntax

| Query | Description |
|-------|-------------|
| `error` | Match "error" or stemmed variants |
| `"permission denied"` | Exact phrase match |
| `error*` | Prefix match (error, errors, erroring) |
| `tool_name:Bash` | Field-specific search |
| `error NEAR/5 api` | Words within 5 tokens |
| `error OR exception` | Boolean OR |
| `error NOT warning` | Exclude matches |
| `error AND api` | Both terms required |

---

## Tool Reference

### search_sessions

Search across session history with BM25 relevance ranking.

**Input:**
- `query` (required): FTS5 search query
- `since`: Filter by start date (ISO-8601)
- `until`: Filter by end date (ISO-8601)
- `project`: Filter by project path
- `sessionId`: Filter by session UUID
- `limit`: Max results (default: 50)
- `offset`: Pagination offset

**Output:**
- `results`: Array of SearchResult with relevance scores
- `totalMatches`: Total matches found
- `queryTimeMs`: Query execution time

### get_session_stats

Aggregate statistics across sessions.

**Input:**
- `since`: Filter by start date (ISO-8601)
- `until`: Filter by end date (ISO-8601)
- `project`: Filter by project path

**Output:**
- `stats`: SessionStats object with metrics
- `queryTimeMs`: Query execution time

---

## Performance Notes

- First indexing may take 30-60 seconds for large corpora (500MB+)
- Incremental re-indexing is fast (checks file mtimes)
- Search queries return in < 2 seconds on 500MB corpus
- Memory usage stays under 100MB during indexing

---

## Troubleshooting

### "No session logs found"

Check that Claude Code has been used and logs exist:
```bash
ls ~/.claude/projects/
```

### "Index locked"

Another process may be indexing. Wait and retry:
```bash
# Check for lock file
ls ~/.agentlint/sessions.db-wal
```

### Query returns no results

Try simpler queries or check spelling:
```typescript
// Instead of complex query
await searchSessions({ query: 'authentication failure endpoint' });

// Try individual terms
await searchSessions({ query: 'authentication' });
await searchSessions({ query: 'failure' });
```

---

## Next Steps

- Use search results with the agent for causal tracing
- Combine with `trace` command for issue origin analysis
- Export stats for reporting with `--format json`
