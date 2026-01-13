# 6. Runtime View

This section describes the behavior and interactions of building blocks through important runtime scenarios.

## 6.1 Primary Scenarios

### 6.1.1 First-Run Setup (`agentlint init`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SCENARIO: FIRST-RUN SETUP                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User                CLI                  Wizard              Storage       │
│    │                  │                     │                    │          │
│    │─agentlint init──▶│                     │                    │          │
│    │                  │──start wizard──────▶│                    │          │
│    │                  │                     │                    │          │
│    │                  │                     │──detect AI tools───┤          │
│    │                  │                     │◀─tools found───────┤          │
│    │                  │                     │                    │          │
│    │◀─────────────────┤◀──prompt frequency──│                    │          │
│    │──select Regular──┤───────────────────▶│                    │          │
│    │                  │                     │                    │          │
│    │◀─────────────────┤◀──prompt hooks──────│                    │          │
│    │──confirm hooks───┤───────────────────▶│                    │          │
│    │                  │                     │                    │          │
│    │◀─────────────────┤◀──prompt telemetry──│                    │          │
│    │──decline─────────┤───────────────────▶│                    │          │
│    │                  │                     │                    │          │
│    │                  │                     │──save config──────▶│          │
│    │                  │                     │──install hooks────▶│          │
│    │                  │                     │──create DB────────▶│          │
│    │                  │                     │                    │          │
│    │◀─────────────────┤◀──setup complete────│                    │          │
│    │                  │                     │                    │          │
│                                                                             │
│  Output: .agentlint/config.toml, .git/hooks/post-push, SQLite DB           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Steps:**
1. CLI launches interactive wizard
2. Wizard detects existing AI tools (CLAUDE.md, .cursorrules)
3. User selects frequency mode (Calm/Regular/Active)
4. User confirms git hook installation
5. User opts in/out of telemetry
6. Wizard creates config, installs hooks, initializes DB

### 6.1.2 Full Analysis (`agentlint analyse`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SCENARIO: FULL ANALYSIS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CLI          Orchestrator       Subagents        Tools          LLM       │
│   │                │                 │              │              │        │
│   │──analyse──────▶│                 │              │              │        │
│   │                │                 │              │              │        │
│   │                │──load context───┤              │              │        │
│   │                │  (project,      │              │              │        │
│   │                │   baseline)     │              │              │        │
│   │                │                 │              │              │        │
│   │                │══spawn config agent══════════▶│              │        │
│   │                │══spawn session agent═════════▶│              │        │
│   │                │══spawn docs agent════════════▶│              │        │
│   │                │                 │              │              │        │
│   │                │                 │──ConfigParser│              │        │
│   │                │                 │◀─config data─│              │        │
│   │                │                 │              │              │        │
│   │                │                 │──────────────┼──assess─────▶│        │
│   │                │                 │◀─────────────┼──quality─────│        │
│   │                │                 │              │              │        │
│   │                │◀══task results══│              │              │        │
│   │                │                 │              │              │        │
│   │                │──synthesize findings──────────┼─────────────▶│        │
│   │                │◀─recommendations───────────────┼──────────────│        │
│   │                │                 │              │              │        │
│   │                │──save to DB─────┤              │              │        │
│   │                │                 │              │              │        │
│   │◀─result────────│                 │              │              │        │
│   │                │                 │              │              │        │
│                                                                             │
│  Duration: <30 seconds (target)                                            │
│  LLM Calls: 3-5 (depending on complexity)                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Steps:**
1. CLI invokes orchestrator with analysis task
2. Orchestrator loads project context and previous baseline
3. Orchestrator spawns parallel subagents for each domain
4. Subagents invoke tools to gather data
5. Subagents use LLM for quality assessment
6. Orchestrator merges results and synthesizes recommendations
7. Results saved to SQLite, rendered to user

### 6.1.3 Causal Tracing (`agentlint trace`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SCENARIO: CAUSAL TRACING                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CLI          Tracer          GitQuery       SessionStats        LLM       │
│   │              │                │               │                │        │
│   │──trace issue─▶│               │               │                │        │
│   │              │                │               │                │        │
│   │              │──DETECT────────┤               │                │        │
│   │              │  (identify     │               │                │        │
│   │              │   issue type)  │               │                │        │
│   │              │                │               │                │        │
│   │              │──TRACE─────────┤               │                │        │
│   │              │                │──git blame───▶│               │        │
│   │              │                │◀─commit info──│               │        │
│   │              │                │               │                │        │
│   │              │                │               │──find session─▶│        │
│   │              │                │               │◀─session log───│        │
│   │              │                │               │                │        │
│   │              │──UNDERSTAND────┼───────────────┼───analyze─────▶│        │
│   │              │                │               │                │        │
│   │              │◀─causal chain──┼───────────────┼────────────────│        │
│   │              │                │               │                │        │
│   │              │──CAPTURE───────┤               │                │        │
│   │              │  (create       │               │                │        │
│   │              │   hindsight)   │               │                │        │
│   │              │                │               │                │        │
│   │              │──PREVENT───────┤               │                │        │
│   │              │  (generate     │               │                │        │
│   │              │   recommendation)              │                │        │
│   │              │                │               │                │        │
│   │◀─causal trace│                │               │                │        │
│   │              │                │               │                │        │
│                                                                             │
│  Model: DETECT → TRACE → UNDERSTAND → CAPTURE → PREVENT                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Steps:**
1. User invokes trace on a specific issue
2. Tracer DETECTS issue type and severity
3. Tracer TRACES to origin using git blame and session logs
4. Tracer UNDERSTANDS causal chain with LLM reasoning
5. Tracer CAPTURES hindsight note for future learning
6. Tracer PREVENTS recurrence with config recommendation

### 6.1.4 Git Hook Trigger (`post-push`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SCENARIO: GIT HOOK TRIGGER                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Git          Hook Script       Throttle         Analysis       Notify     │
│   │               │                │                │              │        │
│   │──post-push───▶│                │                │              │        │
│   │               │                │                │              │        │
│   │               │──check cooldown▶│               │              │        │
│   │               │◀─last: 2h ago──│               │              │        │
│   │               │                │                │              │        │
│   │               │──check changes─▶│               │              │        │
│   │               │◀─5 sessions────│               │              │        │
│   │               │                │                │              │        │
│   │               │  (cooldown passed,              │              │        │
│   │               │   significant changes)          │              │        │
│   │               │                │                │              │        │
│   │◀──exit 0──────│                │                │              │        │
│   │               │                │                │              │        │
│   │               │══spawn background══════════════▶│              │        │
│   │               │                │                │              │        │
│   │               │                │                │──analyse────▶│        │
│   │               │                │                │  (full run)   │        │
│   │               │                │                │              │        │
│   │               │                │                │──notify──────▶│        │
│   │               │                │                │              │        │
│   │               │                │                │◀─desktop─────│        │
│   │               │                │                │   notification│        │
│                                                                             │
│  Key: Hook exits immediately (0), analysis runs in background              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Steps:**
1. Git triggers post-push hook
2. Hook checks throttle state (cooldown, change significance)
3. If throttle passes, hook spawns background analysis
4. Hook exits 0 immediately (non-blocking)
5. Background analysis completes and sends desktop notification

### 6.1.5 CI/CD Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SCENARIO: CI/CD ANALYSIS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GitHub        Action          agentlint       Artifact       PR Comment   │
│  Actions          │                │              │               │         │
│     │             │                │              │               │         │
│     │──checkout──▶│                │              │               │         │
│     │             │                │              │               │         │
│     │             │──install──────▶│              │               │         │
│     │             │                │              │               │         │
│     │             │──analyse       │              │               │         │
│     │             │  --output ci───▶              │               │         │
│     │             │                │              │               │         │
│     │             │                │              │               │         │
│     │             │◀─exit 0 + JSON─│              │               │         │
│     │             │                │              │               │         │
│     │             │──upload───────▶│──────────────▶              │         │
│     │             │                │  report.json │               │         │
│     │             │                │              │               │         │
│     │             │──post comment──┼──────────────┼──────────────▶│         │
│     │             │                │              │  (non-blocking)│         │
│     │             │                │              │               │         │
│     │◀─pipeline passes─────────────│              │               │         │
│     │                              │              │               │         │
│                                                                             │
│  Key: Exit 0 always (observability-first), comment is informational        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Steps:**
1. GitHub Actions checks out repository
2. Action installs agentlint
3. Action runs analysis with `--output ci` (using configured model)
4. agentlint exits 0 (analysis complete, findings are informational)
5. Action uploads report artifact
6. Action posts non-blocking PR comment with insights

## 6.2 Working Memory Compression

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SCENARIO: CONTEXT COMPRESSION                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Agent         MemoryManager       LLM            Checkpoint               │
│    │                │               │                 │                     │
│    │──tool call────▶│               │                 │                     │
│    │                │               │                 │                     │
│    │                │──update tokens│                 │                     │
│    │                │  (now at 82%) │                 │                     │
│    │                │               │                 │                     │
│    │                │──trigger: 80% │                 │                     │
│    │                │   threshold   │                 │                     │
│    │                │               │                 │                     │
│    │                │──PRESERVE─────│                 │                     │
│    │                │  goals,       │                 │                     │
│    │                │  decisions,   │                 │                     │
│    │                │  errors       │                 │                     │
│    │                │               │                 │                     │
│    │                │──COMPRESS────▶│                 │                     │
│    │                │               │──generate──────▶│                     │
│    │                │               │   structured    │                     │
│    │                │               │   summary       │                     │
│    │                │◀──summary─────│                 │                     │
│    │                │               │                 │                     │
│    │                │──CLEAR────────│                 │                     │
│    │                │  scratchpad   │                 │                     │
│    │                │               │                 │                     │
│    │                │──checkpoint──▶│─────────────────▶│                    │
│    │                │               │                  │ (crash recovery)   │
│    │                │               │                  │                    │
│    │◀─continue─────│               │                  │                    │
│    │  with         │               │                  │                    │
│    │  compressed   │               │                  │                    │
│    │  context      │               │                  │                    │
│                                                                             │
│  Preserved: Goals, decisions, errors, TODOs                                │
│  Compressed: Tool outputs, reasoning traces                                │
│  Discarded: Scratchpad, redundant data                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 6.3 Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SCENARIO: LLM API FAILURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Agent          ErrorHandler        LLM API         Recovery               │
│    │                │                  │                │                   │
│    │──LLM call─────▶│                  │                │                   │
│    │                │──request────────▶│                │                   │
│    │                │◀─429 rate limit──│                │                   │
│    │                │                  │                │                   │
│    │                │──exponential backoff────────────▶│                   │
│    │                │  (1s, 2s, 4s)    │                │                   │
│    │                │                  │                │                   │
│    │                │──retry──────────▶│                │                   │
│    │                │◀─429 again───────│                │                   │
│    │                │                  │                │                   │
│    │                │──max retries exceeded────────────▶│                   │
│    │                │                  │                │                   │
│    │                │◀─partial completion──────────────│                   │
│    │                │  (static results saved)          │                   │
│    │                │                  │                │                   │
│    │◀─degraded result                  │                │                   │
│    │  + explanation  │                 │                │                   │
│    │                │                  │                │                   │
│                                                                             │
│  Output: Static findings saved, user informed, exit 0                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 6.4 Parallel Subagent Execution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SCENARIO: PARALLEL SUBAGENTS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Orchestrator                                                               │
│       │                                                                     │
│       │═══════════════════════════════════════════════════════════════     │
│       │              │                │               │                     │
│       ▼              ▼                ▼               ▼                     │
│  ┌─────────┐   ┌─────────┐      ┌─────────┐    ┌─────────┐                │
│  │ Config  │   │ Session │      │  Docs   │    │  Code   │                │
│  │ Agent   │   │ Agent   │      │ Agent   │    │ Agent   │                │
│  │         │   │         │      │         │    │         │                │
│  │ Parse   │   │ Extract │      │ Analyse │    │ Metrics │                │
│  │ config  │   │ metrics │      │ quality │    │ extract │                │
│  └────┬────┘   └────┬────┘      └────┬────┘    └────┬────┘                │
│       │              │                │               │                     │
│       │              │                │               │                     │
│       │◀─────────────┴────────────────┴───────────────┘                    │
│       │         (merge results)                                            │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────┐                                                               │
│  │Synthesis│  Merge findings, generate recommendations                     │
│  │ Agent   │                                                               │
│  └─────────┘                                                               │
│                                                                             │
│  Parallelism: Independent domains run concurrently                         │
│  Isolation: Each subagent has own working memory                           │
│  Merge: Orchestrator aggregates and synthesizes                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Related ADRs

- [ADR-0006](../adr/0006-agent-orchestrated-analysis.md) - Agent orchestration
- [ADR-0007](../adr/0007-causal-analysis-architecture.md) - Causal tracing model
- [ADR-0011](../adr/0011-parallel-processing-architecture.md) - Parallel subagents
- [ADR-0014](../adr/0014-error-handling-and-recovery.md) - Error handling
- [ADR-0022](../adr/0022-cicd-integration-patterns.md) - CI/CD flow
- [ADR-0023](../adr/0023-git-hooks-integration.md) - Hook triggering
- [ADR-0027](../adr/0027-agent-working-memory-architecture.md) - Memory compression
