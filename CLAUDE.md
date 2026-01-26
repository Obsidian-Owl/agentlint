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

## Naming Conventions

### Transient vs Permanent Artifacts

Epic identifiers (EP##) are appropriate for **transient artifacts**:
- Git branches: `ep15-session-intelligence`
- Spec directories: `specs/ep15-session-intelligence/`
- Linear issues: `EP15-T001`

Epic identifiers are **NOT appropriate** for permanent code:
- Exported constants: `CONFIG_TOOLS` not `EP05_CONFIG_TOOLS`
- Exported functions: `registerConfigTools` not `registerEP05Tools`
- Type names: `SessionMetrics` not `EP06SessionMetrics`
- Test describe blocks: `'Config Tool Registration'` not `'EP05 Tool Registration'`

**Rationale**: Code identifiers outlive their epic context. `CONFIG_TOOLS` is self-documenting; `EP05_CONFIG_TOOLS` requires lookup.

## Key Architecture Concepts

**6-Layer Architecture**: CLI → Orchestration (Claude Agent SDK) → Tools → ACT Adapters → Persistence → Integration

**Two-Layer Analysis**: Static tools for speed (parsing, extraction) + agent reasoning for depth (causal analysis, quality judgment)

**Signal Types**: Leading (predict), Lagging (reflect), Qualitative (semantic), Causal (traced origins)

## Agent SDK Design Patterns (CRITICAL)

agentlint is a Claude Agent SDK application. These patterns are **CRITICAL** and **MUST** be followed.

### Tool/Agent Boundary (MUST)

Tools provide **data and capabilities**. The agent provides **judgment and orchestration**.

| Tools MUST | Agent MUST |
|------------|------------|
| Return raw data with evidence | Decide what data means |
| Provide filtering/query parameters | Choose what to query and when |
| Execute deterministic operations | Reason about results |
| Return errors with context | Decide recovery strategy |

**CRITICAL Anti-patterns** (NEVER do these):
- Tools that encode "when to use" logic or thresholds
- Tools that return judgments ("this is low", "this is bad")
- Tools that orchestrate workflows or sequences
- Hardcoded rules that belong in agent reasoning (e.g., "if X > 5 then Y")

**Example - WRONG**:
```typescript
// BAD: Tool makes judgment
function detectMissedOpportunities(sessions, skills) {
  if (skill.invocationRate < 0.3) {  // Hardcoded threshold = judgment
    return { missed: true, reason: "Low rate" };  // Tool deciding meaning
  }
}
```

**Example - RIGHT**:
```typescript
// GOOD: Tool returns data, agent judges
function getSkillInvocations(skillName, dateRange) {
  return {
    invocations: [...],      // Raw data
    sessionCount: 47,        // Facts
    invocationCount: 3,      // Facts
    // Agent decides if 3/47 is "low"
  };
}
```

### Tool Design for Agent Cognition (MUST)

Design tools for how agents think, not for API completeness.

**Rich Descriptions**: Tool descriptions MUST explain what the tool does, when to use it, and what it returns. The agent selects tools based on descriptions.

**Contextual Filtering**: Tools MUST filter/truncate results. Never dump raw data and expect the agent to find what it needs. Every token competes for attention.

**High-Signal Consolidation**: Bundle related operations into single tools. Don't create `get_X`, `list_X`, `search_X`, `filter_X` when one `query_X` with parameters works.

**Poka-Yoke Design**: Structure parameters to make mistakes harder. Use absolute paths, enums instead of strings, required fields for critical data.

### Context Window Economics (MUST)

Every token in the context window competes for the agent's attention.

- Tools MUST summarize or truncate large results
- Tools MUST filter to relevant data, not return everything
- Prefer structured data over verbose prose
- Use `_rawData` pattern for machine-readable data alongside human summaries

### Start Simple (SHOULD)

The most successful agent implementations use simple, composable patterns—not complex frameworks.

- Start with one tool that provides data
- Let the agent reason about what to do with it
- Add complexity only when agent reasoning proves insufficient
- If you're building elaborate detection/matching logic, stop and ask: "Should the agent do this?"

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

**Subagent Design** (when using `agents` option):
- Each subagent MUST have one clear job
- Subagents MUST NOT spawn further subagents (depth=1 max)
- Use subagents for: isolated high-volume ops, parallel independent research, self-contained tasks
- Don't use subagents for: frequent back-and-forth, multi-phase shared context, quick changes

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

## ADR Implementation Pattern (CRITICAL)

ADRs describe **tool capabilities and data structures**, NOT agent orchestration. This is a CRITICAL distinction.

**MUST include**:
- Tool schemas with Zod definitions
- Data structures and TypeScript interfaces
- SQL queries and database schemas
- API surfaces and return types

**MUST NOT include** (these are anti-patterns):
- Functions that dictate when tools should be called
- Workflow sequences or pipelines
- Threshold-based detection logic (agent reasoning)
- Code that orchestrates agent behavior
- "If X then use tool Y" logic

**Test**: If your ADR includes logic the agent should reason about, you've put orchestration in the tool layer. Stop and redesign.

## Available Skills

Architecture: `adr`, `arc42-architecture-design`, `arc42-epic-decomposer`, `arch-review`

Dev workflow: `dev.specify`, `dev.clarify`, `dev.plan`, `dev.tasks`, `dev.taskstolinear`, `dev.implement`, `dev.implement-epic`, `dev.pr`, `dev.integration-check`

Quality: `dev.analyze`, `dev.checklist`, `dev.constitution`, `dev.tech-debt-review`, `dev.test-review`, `dev.verify-wiring`, `dev.testing`
