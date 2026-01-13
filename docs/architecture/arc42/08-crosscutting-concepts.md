# 8. Crosscutting Concepts

This section describes recurring patterns, cross-layer concerns, and fundamental design decisions that apply across agentlint's architecture.

## 8.1 AX/UX Separation

A fundamental concept in agentlint: **Agent Experience (AX)** and **User Experience (UX)** require different optimizations.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AX/UX SEPARATION                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  AGENT EXPERIENCE (AX)                 USER EXPERIENCE (UX)                 │
│  ─────────────────────                 ────────────────────                 │
│                                                                             │
│  Optimized for:                        Optimized for:                       │
│  • Token efficiency                    • Comprehension                      │
│  • Task completion                     • Actionability                      │
│  • Tool invocation                     • Visual clarity                     │
│  • Context preservation                • Progressive disclosure             │
│                                                                             │
│  ┌─────────────────────┐              ┌─────────────────────┐              │
│  │ Compressed context  │              │ Rich, detailed      │              │
│  │ Metrics + excerpts  │              │ Full explanations   │              │
│  │ Structured data     │              │ Visualizations      │              │
│  │ Prior hindsight     │              │ Code snippets       │              │
│  └─────────────────────┘              └─────────────────────┘              │
│                                                                             │
│  Example: File analysis                                                     │
│  ─────────────────────                                                     │
│  AX sees: {path, lineCount: 500, sections: 5, issues: ["missing workflow"]}│
│  UX sees: Full file content, highlighted issues, suggested additions       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Principle**: What serves an agent's cognitive needs differs from what serves human understanding. agentlint optimizes both interfaces independently.

## 8.2 Causal Analysis Model

The DETECT → TRACE → UNDERSTAND → CAPTURE → PREVENT model applies across all analysis domains.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CAUSAL ANALYSIS MODEL                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Stage        Purpose                 Mechanism                    ADR     │
│  ─────────    ───────                 ─────────                    ───     │
│                                                                             │
│  DETECT       Find issue in          Static analysis +            0007    │
│               codebase               Pattern matching                      │
│                                                                             │
│  TRACE        Link to origin         Git blame, session log       0007    │
│               (session, prompt,      correlation, config          0008    │
│               config gap)            inspection                            │
│                                                                             │
│  UNDERSTAND   Synthesize causal      LLM reasoning over           0007    │
│               narrative              evidence bundle                       │
│                                                                             │
│  CAPTURE      Extract hindsight      Pattern extraction,          0026    │
│               note                   user confirmation                     │
│                                                                             │
│  PREVENT      Generate config        Template-based +             0010    │
│               recommendation         LLM customization                     │
│                                                                             │
│  Key: Every finding should trace back to WHY it happened                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8.3 Compounding Value Through Baselines

Compounding Value is about TEMPORAL compounding—value that increases over time through baseline tracking and trend analysis.

```
┌─────────────────────────────────────────────────────────────┐
│ BASELINE → CHANGE → OBSERVE → UNDERSTAND → REFINE → REPEAT │
│                                                             │
│ Each analysis builds on previous:                          │
│ • First run establishes baseline                           │
│ • Second run shows delta                                   │
│ • Third run reveals trends                                 │
│ • Nth run provides rich historical context                 │
│                                                             │
│ Recommendations become more valuable over time             │
└─────────────────────────────────────────────────────────────┘
```

For cost control via model selection (Haiku/Sonnet/Opus), see [Section 4.2 - Compounding Value Delivery](./04-solution-strategy.md#compounding-value-delivery).

## 8.4 Observability-First Philosophy

agentlint informs and tracks rather than blocks and gates.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY-FIRST PRINCIPLE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ❌ ANTI-PATTERN (Quality Gate)       ✅ PATTERN (Observability)           │
│  ─────────────────────────────        ─────────────────────────            │
│                                                                             │
│  Low score → BLOCK                    Low score → INFORM                   │
│  Finding → EXIT 1                     Finding → EXIT 0, surface insight    │
│  Per-commit check                     Track over time                      │
│  Enforce threshold                    Show improvement trend               │
│  Break developer flow                 Background analysis                  │
│                                                                             │
│  WHY:                                                                       │
│  • agentlint measures PROCESS effectiveness, not code correctness          │
│  • Low score = improvement opportunity, not failure                        │
│  • Blocking contradicts improvement-oriented philosophy                    │
│  • Value is in trends, not point-in-time checks                           │
│                                                                             │
│  IMPLEMENTATION:                                                            │
│  • Exit code 0 for analysis complete (always)                              │
│  • Exit code 1-4 only for tool errors, not findings                        │
│  • PR comments are informational, not blocking                             │
│  • Git hooks run in background, notify on completion                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8.5 Multi-Layer Caching

Performance achieved through aggressive caching at multiple levels.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MULTI-LAYER CACHE ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Layer 1: In-Memory                                                        │
│  ─────────────────────                                                     │
│  • Request-scoped (analysis lifetime)                                      │
│  • File contents, parsed ASTs                                              │
│  • Hit time: <1ms                                                          │
│                                                                             │
│  Layer 2: Disk Cache                                                       │
│  ─────────────────────                                                     │
│  • Content-addressed (hash-based keys)                                     │
│  • LLM responses, static analysis results                                  │
│  • SQLite + FTS5                                                           │
│  • Hit time: <10ms                                                         │
│                                                                             │
│  Layer 3: LLM Prompt Cache                                                 │
│  ─────────────────────                                                     │
│  • Provider-level (Anthropic prompt caching)                               │
│  • System prompts, common patterns                                         │
│  • Hit time: Provider-dependent                                            │
│  • Cost reduction: Up to 90% for cached prefixes                           │
│                                                                             │
│  KEY STRATEGY: Content-addressed keys enable cache hits across             │
│                different analysis runs with same file content              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8.6 Error Handling Strategy

Errors are conversational and support partial completion.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING PHILOSOPHY                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Principle: PARTIAL COMPLETION > TOTAL FAILURE                             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ LLM API fails?                                                      │   │
│  │ → Return static results + explain what's missing                    │   │
│  │ → Don't fail the entire analysis                                    │   │
│  │                                                                      │   │
│  │ One domain fails?                                                   │   │
│  │ → Return results from other domains                                 │   │
│  │ → Mark failed domain, explain why                                   │   │
│  │                                                                      │   │
│  │ Config parse error?                                                 │   │
│  │ → Skip that config, continue with others                            │   │
│  │ → Report parse error as finding                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ERROR OUTPUT FORMAT:                                                       │
│  ─────────────────────                                                     │
│  ⚠️  Analysis incomplete                                                   │
│                                                                             │
│  I couldn't connect to the Anthropic API (rate limit exceeded).            │
│                                                                             │
│  What worked:                                                               │
│    ✓ Config detection (Claude Code configured)                             │
│    ✓ Session indexing (23 sessions found)                                  │
│                                                                             │
│  What I couldn't do:                                                        │
│    ✗ Config quality assessment                                             │
│    ✗ Recommendation generation                                             │
│                                                                             │
│  💡 Try again in a few minutes. The rate limit should reset shortly.       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8.7 Working Memory Management

Agent context is managed through hierarchical working memory with adaptive compression.

| Level | Scope | Contents | Compression |
|-------|-------|----------|-------------|
| 1 | Session | Analysis ID, project info, token budget | Never |
| 2 | Task | Per-domain goals, progress, findings | Summarize |
| 3 | Scratchpad | Current tool context, reasoning | Clear after step |

**Compression Triggers:**
- Token usage ≥80% of budget
- Preserve: goals, decisions, errors, TODOs
- Compress: tool outputs, reasoning traces
- Discard: scratchpad, redundant data

## 8.8 Testing Strategy

Four-layer testing pyramid ensures quality at all levels.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TESTING PYRAMID                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                          ┌─────────────────┐                               │
│                          │  Layer 4: Eval  │  ~$5-10/CI                    │
│                          │  (LLM Quality)  │  Real LLM calls              │
│                          └────────┬────────┘                               │
│                                   │                                         │
│                      ┌────────────┴────────────┐                           │
│                      │   Layer 3: Integration  │  Real I/O                 │
│                      │   (Component Combos)    │  SQLite, files            │
│                      └────────────┬────────────┘                           │
│                                   │                                         │
│              ┌────────────────────┴────────────────────┐                   │
│              │       Layer 2: Component Tests          │  Mocked deps      │
│              │       (Interface Contracts)             │  Golden files     │
│              └────────────────────┬────────────────────┘                   │
│                                   │                                         │
│      ┌────────────────────────────┴────────────────────────────┐           │
│      │               Layer 1: Unit Tests                        │  Fast    │
│      │               (Pure Functions)                           │  No I/O  │
│      └──────────────────────────────────────────────────────────┘           │
│                                                                             │
│  Distribution: 40% unit, 30% component, 20% integration, 10% eval          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8.9 Logging and Observability

Structured logging with tiered verbosity.

| Level | CLI Flag | Output | Use Case |
|-------|----------|--------|----------|
| Silent | `--silent` | Nothing | Scripts |
| Quiet | `--quiet` | Errors only | CI |
| Info | (default) | Summary | Normal use |
| Debug | `--verbose` | Detailed | Troubleshooting |
| Trace | `--debug` | Everything | Deep debugging |

**OpenTelemetry Integration:**
- Traces: Analysis flow, LLM calls
- Metrics: Token usage, latency, cache hits
- Export: OTLP, console, file

## 8.10 Configuration Cascade

Configuration resolves through cascading levels.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONFIGURATION CASCADE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Priority (highest to lowest):                                              │
│                                                                             │
│  1. CLI flags          agentlint analyse --model claude-sonnet             │
│                        ↓ overrides                                          │
│  2. Environment vars   AGENTLINT_MODEL=claude-sonnet                       │
│                        ↓ overrides                                          │
│  3. Project config     .agentlint/config.toml                              │
│                        ↓ overrides                                          │
│  4. Global config      ~/.config/agentlint/config.toml                     │
│                        ↓ overrides                                          │
│  5. Defaults           Built-in sensible defaults                          │
│                                                                             │
│  Resolution: Each level only specifies what it needs to override           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Related ADRs

- [ADR-0004](../adr/0004-configuration-file-locations.md) - Config cascade
- [ADR-0007](../adr/0007-causal-analysis-architecture.md) - Causal model
- [ADR-0009](../adr/0009-observability-strategy.md) - OpenTelemetry
- [ADR-0013](../adr/0013-testing-strategy.md) - Testing pyramid
- [ADR-0014](../adr/0014-error-handling-and-recovery.md) - Error handling
- [ADR-0021](../adr/0021-caching-strategy.md) - Caching layers
- [ADR-0025](../adr/0025-logging-and-debugging-strategy.md) - Logging
- [ADR-0027](../adr/0027-agent-working-memory-architecture.md) - Working memory
