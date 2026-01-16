# Section 5: Building Block View

> Static structure decomposition of agentlint's 6-layer architecture.

**Last Updated**: January 2026
**Related Sections**: [Runtime View](06-runtime-view.md), [Crosscutting Concepts](08-crosscutting-concepts.md)

---

## Level 1: System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              agentlint                                   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ CLI INTERFACE LAYER                                             │    │
│  │ Commands: scan, analyse, baseline, compare, recommend, trace    │    │
│  └────────────────────────────────┬────────────────────────────────┘    │
│  ┌────────────────────────────────▼────────────────────────────────┐    │
│  │ ORCHESTRATION LAYER                                             │    │
│  │ Master Agent Loop • Context Management • Tool Selection         │    │
│  └────────────────────────────────┬────────────────────────────────┘    │
│  ┌────────────────────────────────▼────────────────────────────────┐    │
│  │ TOOL LAYER                                                      │    │
│  │ Discovery • Extraction • Search • Persistence                   │    │
│  └────────────────────────────────┬────────────────────────────────┘    │
│  ┌────────────────────────────────▼────────────────────────────────┐    │
│  │ ADAPTER LAYER                                                   │    │
│  │ Claude Code │ Generalized │ Future ACTs                         │    │
│  └────────────────────────────────┬────────────────────────────────┘    │
│  ┌────────────────────────────────▼────────────────────────────────┐    │
│  │ PERSISTENCE LAYER                                               │    │
│  │ Baselines • Learnings • Session State • Configuration           │    │
│  └────────────────────────────────┬────────────────────────────────┘    │
│  ┌────────────────────────────────▼────────────────────────────────┐    │
│  │ INTEGRATION LAYER                                               │    │
│  │ Filesystem • Git • SQLite • Anthropic API                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

| Layer | Responsibility |
|-------|----------------|
| **CLI Interface** | Parse commands, format output, progress reporting |
| **Orchestration** | Agent reasoning, tool selection, finding synthesis |
| **Tool** | Deterministic data gathering, scoped writing |
| **Adapter** | ACT-specific abstraction (config locations, log formats) |
| **Persistence** | Local storage (baselines, learnings, state) |
| **Integration** | External interfaces (filesystem, git, LLM API) |

---

## Level 2: CLI Interface Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLI INTERFACE LAYER                          │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   cli.ts    │  │  version.ts │  │  commands/  │              │
│  │  Entry point│  │ Version info│  │  update.ts  │              │
│  │  Arg parsing│  │ Runtime info│  │  (future)   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                 │
│  ┌──────────────────────────────────────────────────┐           │
│  │              SHARED MODULES                       │           │
│  │  errors/         │  types/                        │           │
│  │  • ExitCodes     │  • Platform, Architecture     │           │
│  │  • Error classes │  • Binary, Release            │           │
│  │  • formatError() │  • InstallPaths               │           │
│  └──────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

| Component | Purpose |
|-----------|---------|
| `cli.ts` | Entry point, argument parsing, command routing |
| `version.ts` | Version info, runtime detection (Bun/Node) |
| `commands/` | Command implementations (update, future commands) |
| `errors/` | Typed error classes, exit codes, error formatting |
| `types/` | Shared type definitions (Platform, Binary, Release) |

---

## Level 3: CLI Module Structure (EP04)

```
src/cli/
├── index.ts           Public exports
├── program.ts         Commander.js setup, command definitions
├── types.ts           CLI-specific types, re-exports from EP02/EP03
│
├── commands/          Command implementations
│   ├── scan.ts        Discover AI configurations
│   ├── analyse.ts     Run full analysis
│   ├── baseline.ts    Capture baseline state
│   ├── compare.ts     Compare against baseline
│   └── trace.ts       Trace finding to origin
│
├── components/        Ink React components (ADR-0004)
│   ├── App.tsx        Main application wrapper
│   ├── Progress.tsx   Spinner + phase indicator
│   ├── FindingsList.tsx  Findings table display
│   ├── Summary.tsx    Analysis summary
│   ├── CausalTree.tsx Custom tree visualization
│   └── CompareView.tsx Baseline comparison view
│
├── formatters/        Output format handlers
│   ├── json.ts        JSON/JSON Lines streaming
│   ├── markdown.ts    Markdown report generation
│   └── plain.ts       Plain text (no colors)
│
└── utils/             Shared utilities
    ├── terminal.ts    Width detection, text wrapping
    ├── colors.ts      ANSI colors, NO_COLOR support
    └── output.ts      Output mode detection
```

| Module | Responsibility |
|--------|----------------|
| `program.ts` | Commander.js configuration, global options, command routing |
| `commands/` | Individual command logic, calls orchestration layer |
| `components/` | Ink-based React components for terminal UI |
| `formatters/` | Output serialization (JSON, Markdown, plain text) |
| `utils/` | Terminal detection, color support, text formatting |

**Key Design Decisions**:
- Commander.js for argument parsing ([ADR-0003](../adr/0003-cli-framework-and-command-structure.md))
- Ink for terminal UI with React components ([ADR-0004](../adr/0004-output-format-and-rendering.md))
- Custom CausalTree component for trace visualization
- ANSI 4-bit colors for accessibility (NFR-005)

---

## Level 2: Orchestration Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                    MASTER AGENT LOOP                            │
│  while (analysis_active):                                       │
│    1. Assess context and task state                             │
│    2. Decide: tool invocation OR direct reasoning               │
│    3. If tool: invoke → observe result                          │
│    4. If user input needed: pause for human-in-the-loop         │
│    5. Update working memory                                     │
│    6. Check termination                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│               AGENT COGNITIVE WORKSPACE                         │
│  ├─ Task Goal                                                   │
│  ├─ Project Context (compressed)                                │
│  ├─ Analysis Progress                                           │
│  ├─ Accumulated Findings                                        │
│  ├─ Baseline Awareness                                          │
│  └─ Global Learnings                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Level 2: Tool Layer

| Category | Tools |
|----------|-------|
| **Analysis** | `parse_config`, `search_sessions`, `get_session_stats`, `query_git` |
| **Baseline** | `store_baseline`, `query_baseline`, `list_baselines` |
| **Recommendation** | `store_recommendation`, `list_recommendations`, `update_recommendation` |
| **Learning** | `store_learning`, `list_learnings`, `promote_learning` |
| **Utility** | `retrieve_result`, `agentlint_write` |

**Design Principles**: Atomic operations, structured output, error transparency, poka-yoke.

---

## Level 2: Adapter Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                 ADAPTER INTERFACE                               │
│  detect() → parseConfig() → locateLogs() → parseLogs()          │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  CLAUDE CODE     │  │  GENERALIZED     │  │  FUTURE          │
│  Config: CLAUDE.md│  │  Common patterns │  │  Cursor, etc.    │
│  Logs: ~/.claude/ │  │  AGENTS.md       │  │  Plugin pattern  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

The generalized adapter ensures value even for unknown AI tools.
