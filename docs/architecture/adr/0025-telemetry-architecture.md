---
status: accepted
date: 2026-01-28
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0025: Telemetry Architecture

## Context and Problem Statement

agentlint needs observability into analysis sessions to understand tool usage patterns, token consumption, error rates, and overall session health during alpha development. This telemetry supports product decisions and quality improvement.

However, Constitution Principle I (Local-First) states: "No data leaves without explicit user consent" and "No telemetry, analytics, or data collection without opt-in." Any telemetry architecture must satisfy this constraint while providing meaningful observability.

Additionally, HoneyHive (our chosen observability backend) has **no auto-instrumentation** for the Opencode SDK or Claude Agent SDK. A custom integration is required.

## Decision Drivers

- **Constitution Principle I**: Local-first, opt-in only, no secrets in CLI
- **No HoneyHive SDK support**: No auto-instrumentation for our SDK stack
- **Alpha-phase needs**: Understanding tool/LLM usage without user content
- **Graceful degradation**: Telemetry failures must never affect analysis
- **Future flexibility**: Backend should be swappable without CLI changes

## Considered Options

1. **HoneyHive Python/JS SDK direct integration** — Use HoneyHive's official SDK
2. **Custom Vercel proxy with HoneyHive API** — CLI POSTs to proxy, proxy forwards to HoneyHive
3. **OpenTelemetry (OTEL) standard** — Emit OTEL traces, user routes to any backend
4. **No telemetry** — Ship without observability

## Decision Outcome

Chosen option: **"Custom Vercel proxy with HoneyHive API"** (Option 2) because:

- HoneyHive SDK has no auto-instrumentation for our SDK stack (eliminates Option 1)
- CLI contains zero secrets — API key lives server-side in Vercel environment
- Proxy can transform schema without CLI updates
- Graceful degradation is trivial (HTTP POST failure → silently drop)
- OTEL (Option 3) is deferred as a future mode (`telemetry.mode: 'otel'`)

### Architecture

```
┌────────────────────────┐     ┌───────────────────────┐     ┌──────────────┐
│  agentlint CLI          │     │  Vercel Edge Function  │     │  HoneyHive   │
│                        │     │  /api/events           │     │              │
│  IOrchestratorTelemetry│     │                       │     │  session/    │
│  Client (interface)    │     │  Transform to          │     │   start      │
│       │                │     │  HoneyHive schema      │     │  events      │
│       ▼                │     │  (8 builder functions) │     │              │
│  AlphaTelemetryClient  │────►│                       │────►│              │
│  • Buffer events       │POST │  Secrets:             │POST │              │
│  • Flush every 10s     │JSON │  • HONEYHIVE_API_KEY  │     │              │
│  • Max 100 buffer      │     │  • HONEYHIVE_PROJECT  │     │              │
│  • 5s request timeout  │     └───────────────────────┘     └──────────────┘
└────────────────────────┘
```

### Orchestrator Telemetry Wiring

```
CLI (analyse.ts)
  │  getTelemetryClient() → AlphaTelemetryClient
  │  telemetry.sessionStart()
  │  config.telemetryClient = telemetry
  ▼
createOrchestrator(config)
  ├─ Legacy: Orchestrator (inline tracking maps, ~200 lines)
  └─ Opencode: OpencodeOrchestrator
       └─ TelemetryTracker (encapsulated)
            ├─ onToolStart/onToolComplete (FIFO queue correlation)
            ├─ onLLMUsage (token/cost/latency tracking)
            └─ onTurnStart (latency baseline)
```

### Data Tracked (When Opted In)

| Category       | Data                                        | Privacy                              |
| -------------- | ------------------------------------------- | ------------------------------------ |
| Tool execution | Name, duration, success/failure             | Input/output truncated to 5000 chars |
| LLM usage      | Model, tokens (in/out/cache), cost, latency | No prompt or response content        |
| Session        | Command, duration, project type             | No file paths or user content        |
| Errors         | Error category                              | Messages capped at 500 chars         |

### Data NOT Tracked

- User file contents or project data
- Prompt or response text
- File paths (beyond project type classification)
- Environment variables or credentials
- Any data when telemetry is disabled (default)

### Opt-In Mechanism

```bash
# Enable via environment variable
AGENTLINT_TELEMETRY=alpha agentlint analyse

# Enable via config file
# ~/.agentlint/config.json
{ "telemetry": { "enabled": true, "mode": "alpha" } }
```

Modes:

- `disabled` (default) — No telemetry
- `alpha` — Send to agentlint Vercel proxy → HoneyHive
- `otel` (future) — Send to user's own OTEL backend

### Key Design Decisions

**FIFO Queue for Tool Correlation (Opencode)**: The Opencode SDK has no `toolId` concept. Multiple concurrent calls to the same tool are correlated using a FIFO queue per tool name — the first `onToolComplete` matches the first `onToolStart` for that name.

**Shared Truncation Utilities**: Both legacy and Opencode orchestrators share `truncateToolOutput`, `truncateToolInput`, and `extractErrorMessage` from `src/orchestration/telemetry-utils.ts` to ensure consistent data sanitization.

**TelemetryTracker Encapsulation**: Unlike the legacy orchestrator (inline tracking across ~200 lines), the Opencode orchestrator delegates all tracking to a `TelemetryTracker` class with clear memory bounds (MAX_PENDING_TOOLS=100, TTL=5min).

**Side-Effect Only**: Telemetry tracking happens after stream chunks are yielded. Telemetry failures never block or affect the analysis stream.

### Consequences

**Good:**

- Zero secrets in CLI binary
- Graceful degradation — telemetry failures are silent
- Schema changes don't require CLI updates
- Privacy enforced at multiple layers (opt-in, truncation, sanitization)
- Backend swappable without CLI changes

**Bad:**

- Custom proxy adds deployment dependency
- No real-time debugging (buffered, 10s flush interval)
- HoneyHive schema coupling lives in Vercel function (not in CLI)

**Neutral:**

- OTEL support deferred (mode exists in config, not implemented)
- Per-tool tracking adds ~1KB memory per pending tool call

## Constitution Compliance

| Principle                | Compliance | Evidence                                                              |
| ------------------------ | ---------- | --------------------------------------------------------------------- |
| I. Local-First           | ✅ Full    | Opt-in only, zero secrets in CLI, no data without consent             |
| II. Improvement-Oriented | ✅         | Telemetry data informs product improvement                            |
| III. Causal-First        | N/A        |                                                                       |
| IV. Mixed-Methods        | N/A        |                                                                       |
| V. Contextual            | N/A        |                                                                       |
| VI. Traceable            | ✅         | Session/event IDs enable trace correlation                            |
| VII. Intelligent Tooling | ✅         | `IOrchestratorTelemetryClient` is a pure data interface — no judgment |
| VIII. Conventional       | ✅         | Follows standard proxy pattern; truncation conventions shared         |
| IX. Agent-Aware          | N/A        |                                                                       |

## Related

- [ADR-0024](0024-opencode-sdk-migration.md) — Opencode SDK migration (telemetry was a gap)
- [ADR-0019](0019-tool-agent-boundary-temporal.md) — Tool/agent boundary (telemetry is data, not judgment)
- [Arc42 §8.6](../arc42/08-crosscutting-concepts.md) — Logging & Observability section
