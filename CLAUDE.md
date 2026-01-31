# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

agentlint is a local-first CLI tool for continuous improvement of AI-assisted development workflows. It traces issues to their origins and provides preventive recommendations that compound value over time. Unlike traditional linters, agentlint analyzes the AI development system itself—configuration quality, session effectiveness, and workflow optimization.

**Status**: EP22 Complete (Unified Observability implemented)

**Stack**: TypeScript + Bun, Opencode SDK (@opencode-ai/sdk), Zod validation, SQLite

**Implemented Epics**:

- EP01: Project Setup (CI/CD, TypeScript config, test framework)
- EP02: Orchestration Core (Opencode SDK wrapper, streaming, checkpoints, session management)
- EP06: Session Analysis Tools (session discovery, metrics extraction, FTS5 search)
- EP07: Causal Tracing Engine (evidence collection, causal chain reasoning, origin linking)
- EP11: Quality & Security (debug infrastructure, session recording, evaluation framework, outcome tracking)
- EP14: Skills Effectiveness Analysis (skills invocation tracking, discovery analysis, improvement suggestions)
- EP22: Unified Observability (trace correlation, GenAI span hierarchy, local JSONL export, OTLP support)

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

| Command              | What it does                                |
| -------------------- | ------------------------------------------- |
| `bun run test`       | Safe - unit/integration only, no API calls  |
| `bun run test:live`  | E2E tests (requires API key, costs money)   |
| `bun run test:evals` | Evaluations (requires API key, costs money) |

**Why**: `bun test` runs ALL tests including expensive live API tests. A preload in `bunfig.toml` blocks live tests unless `RUN_LIVE_TESTS=1` is set, but use the npm scripts to be safe.

**When verifying code**: Use `bun run test` (not `bun test`).

## Development Workflow

Use the dev.\* skills in `.claude/skills/` for structured feature development:

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

**6-Layer Architecture**: CLI → Orchestration (Opencode SDK) → Tools → ACT Adapters → Persistence → Integration

**Two-Layer Analysis**: Static tools for speed (parsing, extraction) + agent reasoning for depth (causal analysis, quality judgment)

**Signal Types**: Leading (predict), Lagging (reflect), Qualitative (semantic), Causal (traced origins)

## Agent SDK Design Patterns (CRITICAL)

agentlint is an Opencode SDK application. These patterns are **CRITICAL** and **MUST** be followed.

### Tool/Agent Boundary (MUST)

Tools provide **data and capabilities**. The agent provides **judgment and orchestration**.

| Tools MUST                         | Agent MUST                    |
| ---------------------------------- | ----------------------------- |
| Return raw data with evidence      | Decide what data means        |
| Provide filtering/query parameters | Choose what to query and when |
| Execute deterministic operations   | Reason about results          |
| Return errors with context         | Decide recovery strategy      |

**CRITICAL Anti-patterns** (NEVER do these):

- Tools that encode "when to use" logic or thresholds
- Tools that return judgments ("this is low", "this is bad")
- Tools that orchestrate workflows or sequences
- Hardcoded rules that belong in agent reasoning (e.g., "if X > 5 then Y")

**Example - WRONG**:

```typescript
// BAD: Tool makes judgment
function detectMissedOpportunities(sessions, skills) {
  if (skill.invocationRate < 0.3) {
    // Hardcoded threshold = judgment
    return { missed: true, reason: 'Low rate' }; // Tool deciding meaning
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

| Location                          | Content                                      |
| --------------------------------- | -------------------------------------------- |
| `docs/architecture/arc42/`        | 12-section Arc42 architecture docs           |
| `docs/architecture/adr/`          | 25 Architecture Decision Records             |
| `docs/planning/epic-catalogue.md` | 12 implementation epics with dependencies    |
| `docs/requirements/`              | Functional requirements, use cases, personas |
| `docs/vision/north-star.md`       | Mission, vision, success indicators          |

## Orchestration Module (EP02)

The orchestration layer uses **Opencode SDK** (`@opencode-ai/sdk`) with two module locations:

**Opencode Integration** (`src/opencode/`):

| Component               | File                   | Purpose                                              |
| ----------------------- | ---------------------- | ---------------------------------------------------- |
| OpencodeOrchestrator    | `orchestrator.ts`      | Main orchestration integrating all modules           |
| OpencodeServerManager   | `server.ts`            | Server lifecycle (start/stop/health)                 |
| AgentlintOpencodeClient | `client.ts`            | SDK client wrapper                                   |
| AgentlintMcpServer      | `mcp-server.ts`        | MCP server exposing 40+ tools                        |
| StreamAdapter           | `streaming.ts`         | SSE → StreamChunk conversion with telemetry metadata |
| HybridSessionManager    | `sessions.ts`          | Opencode + agentlint metadata                        |
| adaptTool               | `tool-adapter.ts`      | Tool format conversion                               |
| TelemetryTracker        | `telemetry-tracker.ts` | Tool/LLM telemetry tracking (FIFO queue correlation) |

**Shared Infrastructure** (`src/orchestration/`):

| Component         | File                   | Purpose                                    |
| ----------------- | ---------------------- | ------------------------------------------ |
| ToolRegistry      | `tool-registry.ts`     | Tool registration and lookup               |
| Types             | `types.ts`             | StreamChunk, SessionState, Finding, etc.   |
| Config            | `config.ts`            | Configuration loading with defaults        |
| CheckpointHandler | `checkpoint.ts`        | Crash recovery checkpoints                 |
| Retry             | `retry.ts`             | Retry logic with exponential backoff       |
| TelemetryUtils    | `telemetry-utils.ts`   | Shared truncation + error extraction utils |
| Context           | `context.ts`           | Large tool result summarization            |
| ExecutionContext  | `execution-context.ts` | Target directory tracking via AsyncLocal   |

**Key patterns**:

- Tool definitions use `adaptTool()` wrapper with Zod schemas
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

## TUI Module

The `src/tui/` module provides the terminal user interface using Ink (React for CLI):

### Component Hierarchy

```
App.tsx (root)
├── StatusBar (tokens, elapsed time, model name)
├── ActionMenu (welcome flow options)
├── SessionSummary (last session context)
├── TopRecommendation (with "because" clause)
├── ResumePrompt (interrupted epic detection)
├── AgentStateIndicator (thinking/calling_tool/streaming)
├── ToolPhaseRenderer (preparing/running/complete)
├── ConversationHistory
├── LoadingProgress
├── FeedbackPrompt (outcome tracking)
├── ProgressStats (longitudinal display)
└── QuitDialog (confirmation)
```

### Key Components

| Component           | File                                 | Purpose                                          |
| ------------------- | ------------------------------------ | ------------------------------------------------ |
| App                 | `components/App.tsx`                 | Root component with AppProvider context          |
| AgentOutput         | `components/AgentOutput.tsx`         | Renders streaming chunks with markdown           |
| AgentStateIndicator | `components/AgentStateIndicator.tsx` | Shows agent work phase (thinking/tool/streaming) |
| StatusBar           | `components/StatusBar.tsx`           | Token count, elapsed time, model indicator       |
| ActionMenu          | `components/ActionMenu.tsx`          | Welcome menu with keyboard navigation            |

### State Management

Redux-style reducer in `state/app-reducer.ts` with React Context via `AppProvider`:

```typescript
// State shape
interface AppState {
  tuiState: 'loading' | 'welcome' | 'conversing' | 'analyzing';
  agentWorkState: AgentWorkState; // idle | thinking | calling_tool | streaming
  streamBuffer: StreamChunk[];
  conversationHistory: ConversationMessage[];
  statusBar: StatusBarContext;
  // ... dialogs, permissions, etc.
}

// Dispatch actions
dispatch({ type: 'SET_TUI_STATE', payload: { state: 'conversing' } });
dispatch({ type: 'ADD_STREAM_CHUNK', payload: { chunk } });
```

### Keyboard Shortcuts

| Key      | Context        | Action                        |
| -------- | -------------- | ----------------------------- |
| `q`      | Any            | Open quit confirmation dialog |
| `Escape` | During explore | Pop exploration breadcrumb    |
| `↑/↓`    | Menu           | Navigate options              |
| `Enter`  | Menu           | Select option                 |
| `y/n`    | Dialog         | Yes/No response               |
| `Tab`    | Input          | Autocomplete (if available)   |

### Accessibility

See `docs/architecture/accessibility-audit.md` for full audit. Key features:

- `--plain` flag for non-interactive output
- `NO_COLOR=1` environment variable support
- All critical information available as text (not just visual indicators)
- Keyboard-only navigation for all actions

### Performance

See `src/tui/profiling/PERFORMANCE.md` for benchmarks. Summary:

- 100 chunks: ~15ms render (excellent)
- 500 chunks: ~55ms re-render (good)
- 1000 chunks: ~106ms re-render (acceptable)

Run `bun run tui:benchmark` to profile.

### Component Catalog

Preview components in isolation:

```bash
bun run tui:catalog
```

## Quality & Security Module (EP11)

The `src/debug/` and `src/eval/` modules provide quality infrastructure:

### Debug Infrastructure (`src/debug/`)

| Component        | File            | Purpose                                       |
| ---------------- | --------------- | --------------------------------------------- |
| DebugLogger      | `logger.ts`     | Namespace-based logging with verbosity levels |
| SecretRedactor   | `redaction.ts`  | Auto-redacts secrets from logs                |
| TokenTracker     | `metrics.ts`    | Track LLM call tokens and latency             |
| DEBUG_NAMESPACES | `namespaces.ts` | Standard namespace constants                  |

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

| Component       | Purpose                                       |
| --------------- | --------------------------------------------- |
| SessionRecorder | Record checkpoints to disk for crash recovery |
| SessionReplayer | Replay sessions from recorded checkpoints     |

**CLI Commands**:

```bash
agentlint session list           # List recorded sessions
agentlint session replay <id>    # Replay a session
agentlint session delete <id>    # Delete a session
agentlint session cleanup        # Clean up old sessions
```

### Evaluation Framework (`src/eval/`)

| Component | File         | Purpose                           |
| --------- | ------------ | --------------------------------- |
| Scoring   | `scoring.ts` | Numerical quality scoring (0-100) |
| Graders   | `graders/`   | Code-based and LLM-judge graders  |
| Runner    | `runner.ts`  | Execute evaluations               |

### Outcome Tracking (`src/persistence/outcome-storage.ts`, `src/eval/feedback.ts`)

Tracks recommendation effectiveness for continuous improvement:

| Component         | File                 | Purpose                     |
| ----------------- | -------------------- | --------------------------- |
| OutcomeStorage    | `outcome-storage.ts` | SQLite storage for outcomes |
| FeedbackCollector | `feedback.ts`        | Opt-in feedback collection  |

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

## Observability Module (EP22)

The `src/observability/` module provides unified tracing with OpenTelemetry GenAI semantic conventions, enabling comprehensive visibility into agent execution without compromising privacy:

### Core Components

| Component            | File                          | Purpose                                          |
| -------------------- | ----------------------------- | ------------------------------------------------ |
| TraceContextProvider | `trace-context.ts`            | AsyncLocalStorage-based trace context propagation |
| TracingSpanFactory   | `span-factory.ts`             | Creates spans with GenAI semantic conventions     |
| LocalSpanExporter    | `exporters/local-exporter.ts` | Exports spans to NDJSON files with rotation       |
| OtlpExporter         | `exporters/otlp-exporter.ts`  | Exports spans to OTLP endpoints with sanitization |
| ContentCapture       | `content-capture.ts`          | Opt-in tool argument/result capture              |
| Consent Manager      | `consent.ts`                  | Manages telemetry consent per Constitution I     |

### Trace Context Provider

Automatic trace context propagation using Node.js `AsyncLocalStorage`:

```typescript
import { traceContextProvider, generateTraceId } from './observability';

// Create new trace ID and run with trace context
const traceId = generateTraceId();
await traceContextProvider.run(async () => {
  // All nested operations automatically propagate trace context
  const ctx = traceContextProvider.getContext();
  console.log('Trace ID:', ctx?.traceId);

  // Nested async operations receive child context automatically
  await someAsyncOperation();
});
```

**Key features**:
- No explicit context passing required — propagates through async call chains
- Parent-child span relationships maintained automatically
- Trace context available at any depth via `traceContextProvider.getContext()`

### Span Factory

Creates spans with OpenTelemetry GenAI semantic conventions:

```typescript
import { spanFactory } from './observability';

// Instrumentation helpers create properly-structured spans
await instrumentSession({ sessionId, target, command }, async (sessionSpan) => {
  // sessionSpan automatically has GenAI semantic attributes set

  await instrumentToolCall({ toolName, input, toolCallId }, async (toolSpan) => {
    // Tool spans track name, input/output, success/failure
  });

  await instrumentLLMCall({ model, temperature, maxTokens }, async (llmSpan) => {
    // LLM spans track model, tokens (input/output/cache), latency, cost
  });
});
```

**Semantic conventions**:
- **Session spans**: Command, target directory, duration, status
- **Tool spans**: Tool name, call ID, input (sanitized), output (sanitized), duration, success/failure
- **LLM spans**: Model, temperature, max tokens, input/output/cache tokens, latency, cost

See `GenAIAttributes` and `AgentlintAttributes` for complete attribute listings.

### Local Span Export

Spans are automatically exported to local NDJSON files:

**Location**: `~/.agentlint/logs/traces-{YYYY-MM-DD}.ndjson`

**Features**:
- NDJSON format (one JSON object per line) for streaming consumption
- Automatic file rotation at 10MB (configurable)
- Runs on agent's machine only — data never leaves without consent
- Each span includes:
  - W3C trace ID (32 hex chars) and span ID (16 hex chars)
  - Parent span ID for hierarchy
  - Start/end times and duration
  - Status (ok/error) with error messages
  - Semantic convention attributes
  - Span events (milestones, checkpoints)

**Configuration**:
```typescript
import { LocalSpanExporter, createLocalExporter } from './observability';

const exporter = createLocalExporter({
  outputDir: '~/.agentlint/logs',      // Override default
  maxFileSizeMB: 10,                    // Rotation threshold
  filePrefix: 'traces',                 // File name prefix
});

traceContextProvider.registerExporter(exporter);
```

### OTLP Remote Export

Optional OpenTelemetry Protocol (OTLP/HTTP) export for users who opt in:

```typescript
import { OtlpExporter } from './observability';

const otlpExporter = new OtlpExporter({
  endpoint: 'http://localhost:4318/v1/traces',  // OTLP endpoint
  timeoutMs: 10000,                             // Request timeout
  headers: { 'Authorization': 'Bearer token' }, // Custom headers
});

traceContextProvider.registerExporter(otlpExporter);
```

**Data sanitization for OTLP**:
- All span attributes are scanned for sensitive patterns (prompts, completions, file contents, API keys)
- Matching attributes are redacted with labels: `[REDACTED:PROMPT]`, `[REDACTED:COMPLETION]`, etc.
- File paths and user content are never exported
- Follows Constitution Principle I (Local-First, opt-in only)

**Environment variables**:

| Variable                      | Purpose                              | Example |
| ----------------------------- | ------------------------------------ | ------- |
| `AGENTLINT_TELEMETRY`         | Enable telemetry (`otel` for OTLP)  | `otel`  |
| `AGENTLINT_OTLP_ENDPOINT`     | OTLP endpoint URL                    | `http://localhost:4318/v1/traces` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Fallback OTLP endpoint (standard OTel var) | `http://localhost:4318` |

### Content Capture (Opt-In)

Optionally capture tool arguments and results for debugging (disabled by default):

```typescript
import {
  isContentCaptureEnabled,
  captureToolCallContent,
  generateToolCallId,
} from './observability';

if (isContentCaptureEnabled()) {
  const callId = generateToolCallId();
  await captureToolCallContent({
    toolName: 'read_file',
    callId,
    input: { path: '/some/file.ts' },
    result: { content: '...' }, // Only captured if enabled
  });
}
```

**Configuration**:

| Environment Variable        | Purpose                      | Default |
| --------------------------- | ---------------------------- | ------- |
| `AGENTLINT_CAPTURE_CONTENT` | Enable content capture       | false   |
| `AGENTLINT_CAPTURE_MAX_LENGTH` | Max content length per capture | 5000 |

Content capture respects user privacy and Constitution Principle I — disabled by default, no data transmitted without consent.

### Integration with Existing Telemetry

The observability module is designed to work alongside (and eventually replace) the existing telemetry system:

- **Backward compatible**: Existing `IOrchestratorTelemetryClient` still works
- **Complementary**: Traces provide execution hierarchy; telemetry client provides analytics
- **Future path**: As traces mature, they'll subsume telemetry data collection
- **No breaking changes**: Existing code using telemetry client continues unchanged

**Connection points**:
- `src/opencode/streaming.ts` — Emits stream phase events as trace events
- `src/opencode/telemetry-tracker.ts` — Tool/LLM tracking creates corresponding spans
- `src/debug/logger.ts` — Logs include trace ID when active
- `src/orchestration/checkpoint.ts` — Checkpoints include trace context

## PromptKit Module (ADR-0022)

The `src/prompts/` module provides SDK-agnostic prompt management:

| Component         | Location                | Purpose                                           |
| ----------------- | ----------------------- | ------------------------------------------------- |
| PromptKit Core    | `promptkit/types.ts`    | `PromptSpec`, `PromptMessage`, `PromptRole` types |
| PromptRegistry    | `promptkit/registry.ts` | Version-aware prompt storage                      |
| DETECTIVE_PERSONA | `components/persona/`   | Single source of truth for personality            |

**Key patterns**:

- Prompts are SDK-agnostic (just strings) - adapters convert to provider formats
- `PromptSpec` has `id@version` for tracking and A/B testing
- Personality centralized in `DETECTIVE_PERSONA` - import everywhere, define once
- Future SDK migration: swap adapter, not prompts

**Usage**:

```typescript
import { buildPersonaBlock, getPromptRegistry } from '../prompts';

// Use centralized persona
const systemPrompt = `You are agentlint.\n\n${buildPersonaBlock()}`;

// Register versioned prompts
const registry = getPromptRegistry();
registry.register(myPromptSpec);
const prompt = registry.get('welcome/system', '1.0.0');
```

**Migration path**: Prompts themselves are portable. SDK coupling is in:

- `orchestration/orchestrator.ts` - `query()` call
- `orchestration/tool-registry.ts` - `createSdkMcpServer()`

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
