# Quickstart: Session Intelligence

> **Epic**: EP15
> **Created**: 2026-01-24

---

## Overview

Session Intelligence enables agentlint to understand what happened in Claude Code sessions and why. Rather than just showing metrics (tokens, tool counts), it provides narrative understanding of session flow, quality, and effectiveness.

---

## Installation

Session Intelligence is built into agentlint. No additional installation required.

Ensure sessions are indexed:

```bash
# Index all session logs (run once, then automatically maintained)
agentlint index sessions
```

---

## Basic Usage

### Analyze a Session

```bash
# Analyze a specific session
agentlint analyse --session <session-id>

# Analyze the most recent session
agentlint analyse --session latest

# Compare two sessions
agentlint analyse --session <session-id> --compare <other-session-id>
```

### Find Sessions to Analyze

```bash
# List recent sessions with basic info
agentlint sessions list

# Search sessions by content
agentlint sessions search "authentication"

# Get session stats
agentlint sessions stats
```

---

## What You Get

### Session Narrative

The Session Analyst subagent produces a narrative understanding:

```
## Session Analysis

**Intent**: User wanted to implement authentication with JWT tokens

**Journey**:
1. Exploration (turns 1-12): Agent explored existing auth code, read 8 files
2. Implementation (turns 13-45): Created auth middleware, JWT utils, tests
3. Debugging (turns 46-58): Fixed token expiration bug after test failure

**Outcome**: Completed successfully. All tests pass.

**Quality Assessment**:
- Flow: Smooth progression with minimal backtracking
- Tool Usage: 3 repeated Read calls to same file (context loss indicator)
- Compressions: 2 (at turns 25 and 50) - appropriate for session length

**Recommendations**:
1. Consider adding auth patterns to CLAUDE.md to reduce exploration time
2. The repeated reads suggest adding context about JWT structure upfront
```

### Flow Analysis

Tool call patterns reveal session dynamics:

```
Tool Sequences:
- Glob → Grep → Read (x3) → Edit → Write  [exploration → implementation]
- Bash (test) → Read (error) → Edit → Bash (test) [debug cycle]

Repeat Patterns:
- Read(src/auth/jwt.ts) called 4 times (potential context loss)
- Grep("authenticate") called 3 times (search refinement)

File Access:
- src/auth/jwt.ts: 12 accesses (4 read, 8 edit) ← high churn
- tests/auth.test.ts: 6 accesses (2 read, 4 edit)
```

### Quality Signals

Test and build outcomes extracted from session:

```
Quality Signals:
- Test run at turn 38: 12/15 passed (3 failures in auth.test.ts)
- Test run at turn 52: 15/15 passed ✓
- No build failures detected
```

### MCP Usage

Integration effectiveness:

```
MCP Server Usage:
- linear: 8 calls, 0 errors - Used for issue tracking
- deepwiki: 3 calls, 1 error - Documentation lookup (error: rate limit)
```

---

## Common Patterns

### Understanding Why a Session Took Long

```bash
agentlint analyse --session <id>

# Look for:
# - Many compressions (context overflow)
# - Repeated tool calls with same input (stuck loops)
# - Long debugging phases after implementation
```

### Comparing Good vs. Bad Sessions

```bash
agentlint analyse --session <good-id> --compare <bad-id>

# Agent explains:
# - Why one session flowed better
# - What context was missing in the bad session
# - Recommendations to prevent bad patterns
```

### Checking MCP Integration Health

```bash
agentlint analyse --session <id>

# Focus on MCP usage section:
# - Which servers are being used?
# - What's the error rate?
# - Are errors impacting the session flow?
```

---

## Programmatic Usage

### Accessing Session Intelligence Tools

```typescript
import {
  getSessionTimeline,
  getToolSequences,
  getFileAccesses,
  getCompressionEvents,
  getMcpUsage,
  getQualitySignals,
} from 'agentlint/sessions';

// Get session overview
const timeline = await getSessionTimeline({ sessionId: 'abc123' });
console.log(timeline.intent.firstUserPrompt);
console.log(timeline.outcome.signals);

// Get tool call patterns
const sequences = await getToolSequences({
  sessionId: 'abc123',
  limit: 100,
});
console.log(sequences.repeatPatterns);

// Get MCP usage
const mcp = await getMcpUsage({ sessionId: 'abc123' });
console.log(mcp.servers);
```

### Spawning the Session Analyst

```typescript
import { spawnSessionAnalyst } from 'agentlint/sessions';

// Get agent definition for orchestrator
const result = await spawnSessionAnalyst({
  sessionId: 'abc123',
  focus: 'comprehensive',
  query: 'Why did this session have so many compressions?',
});

// Result includes agent definition and query prompt
console.log(result.agentDefinition);
console.log(result.queryPrompt);
```

---

## Configuration

Session Intelligence uses the standard agentlint configuration:

```json
// ~/.agentlint/config.json
{
  "sessions": {
    "autoIndex": true,           // Auto-index new sessions
    "indexOnStartup": false,     // Index on CLI startup
    "maxSessionAge": "90d"       // Sessions older than this are skipped
  }
}
```

---

## Troubleshooting

### "Session not found"

```bash
# Check if session is indexed
agentlint sessions list | grep <session-id>

# Force re-index
agentlint index sessions --force
```

### "No compression events"

Compression events are only present when Claude Code performed context compaction. Short sessions may have none.

### Slow Analysis

For very long sessions (1000+ turns), the subagent uses incremental analysis. This is normal and maintains quality.

---

## Next Steps

- **Improve your workflow**: Apply recommendations from session analysis to your CLAUDE.md
- **Track trends**: Use temporal analysis (`agentlint analyse --trends`) to see improvement over time
- **Compare patterns**: Analyze your best sessions to understand what makes them effective
