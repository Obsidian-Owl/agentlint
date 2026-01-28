# Section 8: Crosscutting Concepts

> Patterns and approaches applied across multiple building blocks.

**Last Updated**: January 2026
**Related Sections**: [Building Blocks](05-building-blocks.md), [Quality Requirements](10-quality-requirements.md)

---

## 8.1 Domain Model

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│   Baseline   │◄───►│   Analysis   │────►│    Recommendation    │
│ • metrics    │     │ • findings   │     │ • action             │
│ • config     │     │ • issues     │     │ • target             │
└──────────────┘     └──────────────┘     │ • tracedOrigin       │
       │                    │             │ • status             │
       ▼                    ▼             │ • events[]           │
┌──────────────┐     ┌──────────────┐     └──────────┬───────────┘
│   Session    │────►│    Issue     │                │
│ • tokens     │     │ • origin     │                ▼
│ • iterations │     │ • severity   │     ┌──────────────────────┐
└──────────────┘     └──────────────┘     │ RecommendationEvent  │
                            │             │ • type               │
                            ▼             │ • content            │
              ┌─────────────────────────┐ │ • timestamp          │
              │      CausalChain        │ └──────────────────────┘
              │ • trigger (evidence)    │
              │ • gap (config gap)      │          ┌──────────────┐
              │ • mechanism             │          │   Learning   │
              │ • confidence            │          │ • scope      │
              └─────────────────────────┘          │ • pattern    │
                     │           │                 └──────────────┘
          ┌──────────┘           └──────────┐
          ▼                                 ▼
┌──────────────────┐              ┌──────────────────┐
│  EvidenceItem    │              │   IssuePattern   │
│ • type           │              │ • category       │
│ • source         │              │ • frequency      │
│ • timestamp      │              │ • isSystemic     │
│ • position       │              │ • chainIds       │
└──────────────────┘              └──────────────────┘
```

### Recommendation Entities (EP10)

| Entity                    | Purpose                                                         |
| ------------------------- | --------------------------------------------------------------- |
| **Recommendation**        | Living document tracking a suggested improvement over time      |
| **RecommendationEvent**   | Append-only log entry (observation, evidence, refinement, etc.) |
| **TracedOrigin**          | Causal link to source (finding, session, config gap, pattern)   |
| **RecommendationSummary** | Compressed view for context loading within token budget         |

### Recommendation Types

| Type          | Description                                      | When to Use                               |
| ------------- | ------------------------------------------------ | ----------------------------------------- |
| `symptomatic` | Quick fix for immediate symptoms                 | No clear root cause                       |
| `preventive`  | Prevents recurrence via config/workflow change   | Clear pattern with causal trace           |
| `systemic`    | Addresses underlying workflow/architecture issue | Deep-rooted pattern across multiple areas |

### Recommendation Status Lifecycle

| Status                 | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `open`                 | Active recommendation, not yet implemented          |
| `pending_confirmation` | Implementation detected, awaiting user confirmation |
| `implemented`          | Confirmed implemented by user                       |
| `monitoring`           | Tracking effectiveness over time                    |

Completion reasons: `implemented`, `superseded`, `obsolete`, `rejected`

### Outcome Tracking Entities (EP11)

| Entity                    | Purpose                                                                       |
| ------------------------- | ----------------------------------------------------------------------------- |
| **RecommendationOutcome** | Tracks effectiveness of a recommendation after implementation                 |
| **OutcomeMetrics**        | Aggregated metrics by recommendation type (implementation rate, success rate) |
| **ImplicitTrackingEvent** | Automatically detected events (config changes, issue recurrence)              |

### Outcome Tracking Fields

| Field                  | Type    | Description                                    |
| ---------------------- | ------- | ---------------------------------------------- |
| `implemented`          | boolean | Whether the recommendation was implemented     |
| `helped`               | boolean | User feedback on whether implementation helped |
| `configChangedAfter`   | boolean | Config changes detected after recommendation   |
| `similarIssueRecurred` | boolean | Similar issues detected after implementation   |
| `implementationDate`   | string  | When the recommendation was implemented        |
| `outcomeNotes`         | string  | User-provided notes on the outcome             |

### Outcome Storage

Outcomes are stored in SQLite (`.agentlint/outcomes.db`) for efficient querying:

```sql
-- Outcomes table with boolean fields stored as integers
CREATE TABLE IF NOT EXISTS recommendation_outcomes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  recommendation_id TEXT NOT NULL,
  recommendation_type TEXT NOT NULL,
  implemented INTEGER,           -- 0/1/null
  helped INTEGER,               -- 0/1/null
  config_changed_after INTEGER,
  similar_issue_recurred INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
```

### Causal Analysis Entities (EP07)

| Entity              | Purpose                                                                    |
| ------------------- | -------------------------------------------------------------------------- |
| **CausalChain**     | Links detected issue to origin via trigger → gap → mechanism → effect      |
| **EvidenceItem**    | Single piece of supporting evidence (session match, git correlation, etc.) |
| **Gap**             | Missing configuration that enabled the issue                               |
| **IssuePattern**    | Recurring issue type aggregated across multiple chains                     |
| **ConfidenceScore** | Validation assessment using 6-factor checklist                             |

### Evidence Types

| Type             | Source                               |
| ---------------- | ------------------------------------ |
| `SessionMatch`   | FTS5 search result from session logs |
| `GitCorrelation` | Git blame or pickaxe search result   |
| `ConfigGap`      | Missing configuration analysis       |
| `TemporalMarker` | Timestamp correlation evidence       |
| `ToolTrace`      | Tool call pattern evidence           |

### Gap Categories

| Category           | Description                           |
| ------------------ | ------------------------------------- |
| `missing_config`   | Configuration file or section missing |
| `missing_guidance` | Behavioral guidance missing           |
| `missing_example`  | Example code/usage missing            |
| `terminology_gap`  | Domain terminology undefined          |
| `context_loss`     | Context not preserved across sessions |

### Session Intelligence Entities (EP15)

| Entity               | Purpose                                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| **SessionTimeline**  | Complete session overview with intent, outcome, and metrics              |
| **Intent**           | First user prompt capturing what the session aimed to accomplish         |
| **SessionOutcome**   | Outcome signals (thanks, done, errors) for success interpretation        |
| **ToolCallRecord**   | Tool invocation with sequence number and input hash for repeat detection |
| **FileAccessRecord** | File operation (read/write/edit) for understanding session focus         |
| **CompressionEvent** | Context compaction occurrence for context loss detection                 |
| **DelegationEvent**  | Task tool usage for subagent pattern analysis                            |
| **QualitySignal**    | Test/build/lint outcome for session quality assessment                   |
| **McpToolCall**      | MCP server tool usage for integration health monitoring                  |

### Outcome Signals

| Signal               | Interpretation Hint                                |
| -------------------- | -------------------------------------------------- |
| `containsThanks`     | User expressed gratitude (often indicates success) |
| `containsDone`       | User indicated completion                          |
| `endsWithError`      | Last message was an error (may indicate failure)   |
| `hasUnresolvedError` | Error occurred without recovery                    |
| `hasCommitActivity`  | Session produced code changes                      |

**Note**: Per ADR-0019, these are DATA signals. The agent interprets their meaning in context.

---

## 8.2 Security Concept

| Aspect               | Approach                                                                        |
| -------------------- | ------------------------------------------------------------------------------- |
| **Data Privacy**     | Local-first; all storage in `.agentlint/`                                       |
| **API Credentials**  | Delegated to Opencode SDK ([ADR-0026](../adr/0026-opencode-auth-delegation.md)) |
| **Secret Detection** | Identify but never store ([ADR-0013](../adr/0013-secret-detection-strategy.md)) |
| **File Access**      | Read project; write only to `.agentlint/`                                       |
| **Telemetry**        | Zero usage tracking                                                             |

---

## 8.3 Error Handling

### CLI Error Classes

Located in `src/errors/index.ts`:

```typescript
// Base error with exit code mapping
class AgentlintError extends Error {
  constructor(
    message: string,
    public readonly code: ExitCode
  ) {}
}

// Specialized error types
class InvalidArgumentError extends AgentlintError {
  code = ExitCode.InvalidArgument;
}
class NetworkError extends AgentlintError {
  code = ExitCode.NetworkError;
}
class ChecksumMismatchError extends AgentlintError {
  code = ExitCode.ChecksumMismatch;
}

// Exit code constants
const ExitCode = {
  Success: 0,
  GeneralError: 1,
  InvalidArgument: 2,
  NetworkError: 3,
  ChecksumMismatch: 4,
} as const;
```

### CLI Exit Codes (EP04)

Located in `src/errors/cli.ts`, CLI-specific exit codes use range 10-19:

```typescript
const CLIExitCode = {
  CommandNotFound: 10, // Unknown command name
  InvalidOption: 11, // Invalid flag or option value
  MissingArgument: 12, // Required argument not provided
  OutputError: 13, // Output formatting/rendering failed
  UserCancelled: 14, // User cancelled operation (Ctrl+C)
  FindingsPresent: 15, // Findings present (with --fail-on-findings)
} as const;
```

| Code | Error Class            | Description                                  |
| ---- | ---------------------- | -------------------------------------------- |
| 10   | `CommandNotFoundError` | Unknown command, suggests available commands |
| 11   | `InvalidOptionError`   | Invalid flag value or combination            |
| 12   | `MissingArgumentError` | Required positional argument missing         |
| 13   | `OutputError`          | JSON/Markdown/terminal rendering failed      |
| 14   | `UserCancelledError`   | User interrupted with SIGINT                 |
| 15   | `FindingsPresentError` | CI mode exit when findings exist             |

Additional CLI error classes:

- `ConfigNotFoundError` - AI config file not found (uses GeneralError)
- `BaselineNotFoundError` - No baseline for compare (uses GeneralError)
- `FindingNotFoundError` - Invalid finding ID for trace (uses GeneralError)

### Tool Error Format

```typescript
interface ToolError {
  error: true;
  message: string; // Human-readable
  suggestion: string; // Actionable guidance
  recoverable: boolean; // Can analysis continue?
}
```

| Error Type        | Response                         |
| ----------------- | -------------------------------- |
| File not found    | Suggest correct path, continue   |
| Parse error       | Return partial, flag issue       |
| API error         | Retry with backoff, checkpoint   |
| Not indexed       | Suggest `agentlint scan`         |
| Network error     | Graceful message, preserve state |
| Checksum mismatch | Abort operation, clear error     |

---

## 8.4 Context Management

Following Claude Code patterns:

| Strategy                   | Implementation                                  |
| -------------------------- | ----------------------------------------------- |
| **Hierarchical Workspace** | Task → Context → Progress → Findings → Baseline |
| **Static Pre-Processing**  | Tools extract before agent receives             |
| **Incremental Loading**    | Load on demand, not upfront                     |
| **Compression Triggers**   | Auto-summarize near limit                       |
| **Priority Preservation**  | Goals, errors, decisions always retained        |
| **Large Results**          | Summarize + store, retrieve on demand           |

### Recommendation Context Compression (EP10)

Per Constitution IX (Agent-Aware), recommendations are compressed for context loading within an 8K token budget:

**Compression Rules**:

| Event Count | Strategy                    | Example                                                                              |
| ----------- | --------------------------- | ------------------------------------------------------------------------------------ |
| ≤3 events   | Include all events verbatim | `[created] Recommendation created: Add error handling...`                            |
| 4-10 events | Prefix + last 3 verbatim    | `[+4 earlier events]\n[observation] Config updated...\n[evidence] Baseline shows...` |
| >10 events  | Summary message             | `[Events summarized - use get_recommendation for full history]`                      |

**Loading Strategy**:

- Load recommendations newest-first until 8K token budget exhausted
- Each recommendation compressed to `RecommendationSummary` (< 500 chars per NFR-001)
- Agent can request full recommendation via `get_recommendation` tool

**Token Estimation**:

```typescript
// Simple char/4 approximation
function estimateTokens(input: string | object): number {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  return Math.ceil(text.length / 4);
}
```

---

## 8.5 Testing Strategy

| Type            | Scope                    | Approach                                                                            |
| --------------- | ------------------------ | ----------------------------------------------------------------------------------- |
| **Unit**        | Functions, parsers       | Jest/Vitest patterns                                                                |
| **Integration** | Tool + adapter           | Fixture-based                                                                       |
| **Wiring**      | Entry point reachability | Static import graph analysis                                                        |
| **Evaluation**  | Agent reasoning          | LLM-as-judge ([ADR-0012](../adr/0012-evaluation-framework-for-analysis-quality.md)) |
| **E2E**         | Full CLI                 | Real project fixtures                                                               |
| **Snapshot**    | Output format            | Golden file comparison                                                              |
| **Performance** | CLI startup, memory      | Threshold-based assertions                                                          |

### Performance Tests (EP04)

Located in `tests/performance/`:

| Test                  | NFR     | Target  | Approach                           |
| --------------------- | ------- | ------- | ---------------------------------- |
| `cli-startup.test.ts` | NFR-001 | < 100ms | Measure time to first output       |
| `cli-memory.test.ts`  | NFR-004 | < 100MB | Track peak memory during streaming |

```typescript
// Example: Startup time test
test('CLI starts within 100ms', async () => {
  const start = performance.now();
  await spawn(['agentlint', '--version']);
  const elapsed = performance.now() - start;
  expect(elapsed).toBeLessThan(100);
});
```

Performance tests run in CI but are excluded from standard `bun test` to avoid flakiness on slow runners.

---

## 8.6 Logging & Observability

| Concern            | Approach                                                                 |
| ------------------ | ------------------------------------------------------------------------ |
| User Output        | Streaming via Ink; progressive disclosure                                |
| Debug Logging      | Always-on file logging to `~/.agentlint/logs/` (disable via `--no-log`)  |
| Agent Transparency | Tool invocations visible in verbose mode                                 |
| Session Recording  | Analysis logged to `~/.agentlint/sessions/` (disable via `--no-session`) |
| Telemetry          | Opt-in only via `AGENTLINT_TELEMETRY=1`                                  |

### Telemetry Architecture (ADR-0025)

agentlint uses an **indirect telemetry architecture** — a custom Vercel proxy forwards sanitized events to HoneyHive for observability. The CLI contains no third-party SDK or API secrets.

```
┌────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  agentlint CLI     │     │  Vercel Edge Function │     │   HoneyHive     │
│                    │     │  (agentlint.vercel.app) │     │   (honeyhive.ai)│
│  AlphaTelemetry    │────►│  Transform to          │────►│   session/start │
│  Client            │POST │  HoneyHive schema      │POST │   events        │
│  (buffered, async) │JSON │  (8 builder functions) │     │                 │
└────────────────────┘     └──────────────────────┘     └─────────────────┘
```

**Why indirect (not HoneyHive SDK)?** HoneyHive has no auto-instrumentation for the Opencode SDK or Claude Agent SDK. The custom proxy approach:

- Keeps API secrets server-side (CLI has zero secrets)
- Allows schema transformation without CLI updates
- Enables graceful degradation (proxy down → events silently dropped)
- Supports future backend switching without CLI changes

**Data Flow:**

| Layer            | Component                      | Events                                                       |
| ---------------- | ------------------------------ | ------------------------------------------------------------ |
| **CLI**          | `AlphaTelemetryClient`         | Buffers events, flushes every 10s or 100 events              |
| **Orchestrator** | `IOrchestratorTelemetryClient` | Interface for tool + LLM tracking                            |
| **Legacy**       | `Orchestrator` (inline)        | Tracks tools/LLM via direct `trackToolEx`/`trackLLMEx` calls |
| **Opencode**     | `TelemetryTracker`             | Encapsulated tracking with FIFO tool correlation             |
| **Streaming**    | `StreamAdapter`                | Extracts token/cost/timing metadata from SSE events          |

**What is tracked** (when telemetry is opt-in enabled):

| Data                                  | Tracked | NOT Tracked                                                            |
| ------------------------------------- | ------- | ---------------------------------------------------------------------- |
| Tool names, duration, success/failure | ✅      | Tool input/output content (truncated to 5000 chars for telemetry only) |
| Token counts (input, output, cache)   | ✅      | Prompt or response content                                             |
| Model name, latency, cost             | ✅      | User files or project data                                             |
| Error types                           | ✅      | Error messages with user data                                          |
| Session duration, command type        | ✅      | Session content                                                        |

**Privacy controls** (Constitution Principle I — Local-First):

- Disabled by default (`AGENTLINT_TELEMETRY=alpha` to enable)
- Tool I/O truncated to 5000 chars before telemetry dispatch
- Error messages capped at 500 chars
- `SecretRedactor` sanitizes all logged data
- User content never transmitted (enforced by sanitization layer)

### Default Logging Behavior

Following Claude Code / OpenCode patterns, agentlint logs **everything by default**:

| Setting           | Default                                 | Override                               |
| ----------------- | --------------------------------------- | -------------------------------------- |
| Log level         | `info`                                  | `--verbose` (debug), `--quiet` (error) |
| Console output    | `stderr`                                | `--quiet` to suppress                  |
| File output       | `~/.agentlint/logs/{YYYY-MM-DD}.ndjson` | `--log-file <path>` or `--no-log`      |
| Session recording | `~/.agentlint/sessions/{id}/`           | `--no-session`                         |

### Log Rotation

Log files are automatically rotated on startup:

| Parameter | Default | Description                     |
| --------- | ------- | ------------------------------- |
| Max files | 10      | Keep last N log files           |
| Max size  | 500MB   | Total size cap across all files |
| Format    | NDJSON  | One JSON entry per line         |

### CLI Flags

| Flag                    | Effect                                                  |
| ----------------------- | ------------------------------------------------------- |
| `--no-log`              | Disable file logging for this run                       |
| `--no-session`          | Disable session recording for this run                  |
| `--log-file <path>`     | Override default log file location                      |
| `--verbose`             | Increase verbosity to debug level                       |
| `--quiet`               | Suppress console output (file logging continues)        |
| `--debug-level <level>` | Control debug verbosity: `minimal`, `normal`, `verbose` |

### Storage Layout

```
~/.agentlint/
├── logs/                         Debug logs (NDJSON format)
│   ├── 2026-01-25.ndjson
│   └── 2026-01-24.ndjson
├── sessions/                     Session checkpoints
│   └── {session-id}/
└── config.json                   User configuration
```

### Color Handling (EP04)

Located in `src/cli/utils/colors.ts`:

**Environment Variables**:
| Variable | Effect |
|----------|--------|
| `NO_COLOR` | Disables all ANSI colors ([no-color.org](https://no-color.org/)) |
| `FORCE_COLOR` | Enables colors even in non-TTY environments |

**Color Levels** (NFR-005):

- Uses ANSI 4-bit colors (16 colors) for maximum terminal compatibility
- Avoids 256-color or true-color codes that may not render correctly
- Chalk configured with `level: 1` when colors enabled

**Severity Colors**:
| Severity | Color | ANSI Code |
|----------|-------|-----------|
| Critical | Red | `\x1b[31m` |
| High | Yellow | `\x1b[33m` |
| Medium | Cyan | `\x1b[36m` |
| Low | Blue | `\x1b[34m` |
| Info | White | `\x1b[37m` |

**Output Mode Detection** (`src/cli/utils/output.ts`):

```typescript
function getOutputMode(options: GlobalOptions): OutputMode {
  if (options.json) return 'json';
  if (options.markdown) return 'markdown';
  if (options.plain) return 'plain';
  if (!process.stdout.isTTY) return 'json'; // Auto-JSON for pipes
  return 'terminal';
}
```

---

## 8.7 Shared Type Definitions

Located in `src/types/index.ts`:

| Type           | Purpose                                                       |
| -------------- | ------------------------------------------------------------- |
| `Platform`     | Operating system (`'darwin' \| 'linux'`)                      |
| `Architecture` | CPU architecture (`'arm64' \| 'x64'`)                         |
| `Binary`       | Compiled executable metadata (platform, arch, checksum, size) |
| `Release`      | Versioned distribution (tag, binaries, changelog)             |
| `InstallPaths` | Standard installation locations                               |

These types are shared across CLI, commands, and distribution tooling. See [§5 Building Blocks](05-building-blocks.md) for location in architecture.
