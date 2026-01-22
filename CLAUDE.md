# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

agentlint is a local-first CLI tool for continuous improvement of AI-assisted development workflows. It traces issues to their origins and provides preventive recommendations that compound value over time. Unlike traditional linters, agentlint analyzes the AI development system itself—configuration quality, session effectiveness, and workflow optimization.

**Status**: EP11 Complete (Quality & Security implemented)

**Stack**: TypeScript + Bun, Claude Agent SDK (@anthropic-ai/claude-agent-sdk), Zod validation, SQLite

**Implemented Epics**:
- EP01: Project Setup (CI/CD, TypeScript config, test framework)
- EP02: Orchestration Core (Claude Agent SDK wrapper, streaming, checkpoints, session management)
- EP11: Quality & Security (debug infrastructure, session recording, evaluation framework, outcome tracking)

## Constitution

All work must align with the 9-principle Constitution at `.specify/memory/constitution.md`. Key principles:

1. **Local-First**: All analysis on user's machine, no data transmission without consent
2. **Causal-First**: Trace issues to origin, recommend prevention (DETECT → TRACE → UNDERSTAND → RECOMMEND)
3. **Agent-Aware**: The agent IS the system; design serves agent cognitive needs
4. **Mixed-Methods**: Agent decides which analysis methods to apply based on context

**Decision test**: Does the feature support continuous improvement? Trace to root cause? Maintain local-first? Preserve user agency (recommend, don't automate)?

## Epic Auto-Mode Recovery

**At session start, check for `.agent/epic-auto-mode`**. If this file exists, an epic implementation was interrupted (by compaction or session end) and should be resumed automatically.

**Recovery protocol:**
1. Read `.agent/epic-auto-mode` for state (feature_dir, last_task, etc.)
2. **IMMEDIATELY re-read ALL spec artifacts** - spec.md, plan.md, tasks.md, constitution.md
3. Query Linear for current task statuses
4. Find next ready task
5. **Resume implementation automatically** - do NOT ask "should I continue?"

The existence of the state file IS the user's instruction to continue. Remove the file only when the epic completes or is explicitly cancelled.

## Testing Rules (CRITICAL)

**NEVER run `bun test` directly.** Always use npm scripts:

| Command | What it does |
|---------|--------------|
| `bun run test` | Safe - unit/integration only, no API calls |
| `bun run test:live` | E2E tests (requires API key, costs money) |
| `bun run test:evals` | Evaluations (requires API key, costs money) |

**Why**: `bun test` runs ALL tests including expensive live API tests. A preload in `bunfig.toml` blocks live tests unless `RUN_LIVE_TESTS=1` is set, but use the npm scripts to be safe.

**When verifying code**: Use `bun run test` (not `bun test`).

## Development Workflow

Use the dev.* skills in `.claude/skills/` for structured feature development:

```
/dev.specify → /dev.clarify → /dev.plan → /dev.tasks → /dev.taskstolinear → /dev.implement-epic → /dev.integration-check → /dev.pr
```

For single-task implementation with confirmation between tasks, use `/dev.implement` instead of `/dev.implement-epic`.

- **Branch naming**: `ep##-feature-name` (e.g., `ep01-project-setup`) matching epic IDs from `docs/planning/epic-catalogue.md`
- **Feature specs**: Created in `specs/ep##-feature-name/` with spec.md, plan.md, tasks.md
- **Task tracking**: Linear integration via MCP (configured in `.mcp.json`)

## Key Architecture Concepts

**6-Layer Architecture**: CLI → Orchestration (Claude Agent SDK) → Tools → ACT Adapters → Persistence → Integration

**Two-Layer Analysis**: Static tools for speed (parsing, extraction) + agent reasoning for depth (causal analysis, quality judgment)

**Signal Types**: Leading (predict), Lagging (reflect), Qualitative (semantic), Causal (traced origins)

## Documentation Structure

| Location | Content |
|----------|---------|
| `docs/architecture/arc42/` | 12-section Arc42 architecture docs |
| `docs/architecture/adr/` | 18 Architecture Decision Records |
| `docs/planning/epic-catalogue.md` | 12 implementation epics with dependencies |
| `docs/requirements/` | Functional requirements, use cases, personas |
| `docs/vision/north-star.md` | Mission, vision, success indicators |

## Orchestration Module (EP02)

The `src/orchestration/` module wraps the Claude Agent SDK:

| Component | File | Purpose |
|-----------|------|---------|
| Orchestrator | `orchestrator.ts` | Main loop wrapping SDK `query()` |
| ToolRegistry | `tool-registry.ts` | MCP tool registration via `createSdkMcpServer()` |
| StreamProcessor | `streaming.ts` | SDK message → StreamChunk conversion |
| CheckpointHandler | `checkpoint.ts` | Crash recovery checkpoints |
| SessionState | `session-state.ts` | Session persistence to JSON |
| CognitiveWorkspace | `cognitive-workspace.ts` | Hierarchical context for agent |
| Context | `context.ts` | Large result summarization |

**Key patterns**:
- Tool definitions use SDK's `tool()` with Zod schemas
- Streaming yields `StreamChunk` objects with verbosity levels
- Checkpoints emit on tool completion, findings, phase changes, intervals
- Subagent depth limited to 1 per Constitution Principle C8

**Configuration** (`~/.agentlint/config.json`):
```json
{
  "model": "claude-sonnet-4-20250514",
  "checkpoint": { "intervalMs": 60000 },
  "verbosity": "normal"
}
```

## Quality & Security Module (EP11)

The `src/debug/` and `src/eval/` modules provide quality infrastructure:

### Debug Infrastructure (`src/debug/`)

| Component | File | Purpose |
|-----------|------|---------|
| DebugLogger | `logger.ts` | Namespace-based logging with verbosity levels |
| SecretRedactor | `redaction.ts` | Auto-redacts secrets from logs |
| TokenTracker | `metrics.ts` | Track LLM call tokens and latency |
| DEBUG_NAMESPACES | `namespaces.ts` | Standard namespace constants |

**Usage**:
```typescript
import { createDebugLogger, DEBUG_NAMESPACES, redact } from './debug';

const logger = createDebugLogger({
  level: 'debug',
  namespaces: ['agentlint:tools', 'agentlint:llm'],
});

// Redact secrets from strings
const safe = redact('api_key=sk-secret');
// → 'api_key=[REDACTED:API_KEY]'
```

### Session Recording (`src/orchestration/checkpoint.ts`)

| Component | Purpose |
|-----------|---------|
| SessionRecorder | Record checkpoints to disk for crash recovery |
| SessionReplayer | Replay sessions from recorded checkpoints |

**CLI Commands**:
```bash
agentlint session list           # List recorded sessions
agentlint session replay <id>    # Replay a session
agentlint session delete <id>    # Delete a session
agentlint session cleanup        # Clean up old sessions
```

### Evaluation Framework (`src/eval/`)

| Component | File | Purpose |
|-----------|------|---------|
| Scoring | `scoring.ts` | Numerical quality scoring (0-100) |
| Graders | `graders/` | Code-based and LLM-judge graders |
| Runner | `runner.ts` | Execute evaluations |

### Outcome Tracking (`src/persistence/outcome-storage.ts`, `src/eval/feedback.ts`)

Tracks recommendation effectiveness for continuous improvement:

| Component | File | Purpose |
|-----------|------|---------|
| OutcomeStorage | `outcome-storage.ts` | SQLite storage for outcomes |
| FeedbackCollector | `feedback.ts` | Opt-in feedback collection |

**Configuration** (opt-in per Constitution Principle I):
```json
{
  "outcomeTracking": {
    "collectFeedback": true,
    "maxPromptsPerSession": 3,
    "followUpDelayDays": 7
  }
}
```

## ADR Implementation Pattern

ADRs describe tool capabilities and data structures, NOT agent orchestration:
- **Good**: Tool schemas, data structures, SQL queries, API surfaces
- **Anti-pattern**: Functions that dictate session workflows, code that orchestrates agent behavior

## Available Skills

Architecture: `adr`, `arc42-architecture-design`, `arc42-epic-decomposer`, `arch-review`

Dev workflow: `dev.specify`, `dev.clarify`, `dev.plan`, `dev.tasks`, `dev.taskstolinear`, `dev.implement`, `dev.implement-epic`, `dev.pr`, `dev.integration-check`

Quality: `dev.analyze`, `dev.checklist`, `dev.constitution`
