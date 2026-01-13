# 10. Quality Requirements

This section specifies quality requirements as scenarios and relates them to architectural decisions.

## 10.1 Quality Tree

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           QUALITY TREE                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              Quality                                        │
│                                 │                                           │
│     ┌───────────┬───────────┬───┴───┬───────────┬───────────┐              │
│     │           │           │       │           │           │              │
│     ▼           ▼           ▼       ▼           ▼           ▼              │
│  Performance  Privacy    Action-  Repro-    Developer  Maintain-          │
│              (Local-    ability  ducibility Experience ability            │
│               First)                                                       │
│     │           │           │       │           │           │              │
│     │           │           │       │           │           │              │
│ ┌───┴───┐   ┌───┴───┐   ┌───┴───┐ ┌─┴─┐    ┌───┴───┐   ┌───┴───┐         │
│ │<30s   │   │Local  │   │Every  │ │95%│    │<5min  │   │Test   │         │
│ │analysis│   │storage│   │finding│ │static│  │setup  │   │coverage│        │
│ │       │   │       │   │has    │ │80%│    │       │   │       │         │
│ │<100ms │   │User   │   │next   │ │agentic│ │Init   │   │Clear  │         │
│ │startup│   │owned  │   │step   │ │   │    │wizard │   │interfaces│       │
│ │       │   │creds  │   │       │ │   │    │       │   │       │         │
│ │Cache  │   │       │   │Config │ │   │    │Good   │   │Compiled│         │
│ │hits   │   │No     │   │snippets│ │   │   │help   │   │in only │         │
│ │       │   │telemetry│  │       │ │   │    │       │   │       │         │
│ └───────┘   └───────┘   └───────┘ └───┘    └───────┘   └───────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 10.2 Quality Scenarios

### 10.2.1 Performance

| ID | Scenario | Stimulus | Response | Measure | Priority |
|----|----------|----------|----------|---------|----------|
| **P1** | Analysis Speed | User runs `agentlint analyse` on 500-file project | Analysis completes | <30 seconds (P95) | High |
| **P2** | Startup Time | User runs any agentlint command | CLI responds | <100ms to first output | High |
| **P3** | Cache Efficiency | User reruns analysis with no changes | Results returned from cache | >80% cache hit rate | Medium |
| **P4** | Memory Usage | Analysis of large project (10k files) | Stable memory consumption | <512MB peak | Medium |

**Architectural Support:**
- P1: Parallel subagents ([ADR-0011](../adr/0011-parallel-processing-architecture.md)), multi-layer caching ([ADR-0021](../adr/0021-caching-strategy.md))
- P2: Bun runtime ([ADR-0001](../adr/0001-language-and-runtime-selection.md))
- P3: Content-addressed caching ([ADR-0021](../adr/0021-caching-strategy.md))
- P4: Working memory compression ([ADR-0027](../adr/0027-agent-working-memory-architecture.md))

### 10.2.2 Privacy (Local-First)

| ID | Scenario | Stimulus | Response | Measure | Priority |
|----|----------|----------|----------|---------|----------|
| **PR1** | Data Sovereignty | User analyzes proprietary codebase | All data stays local | Zero external network calls (static mode) | Critical |
| **PR2** | Credential Security | User configures API key | Key stored securely | Not in plain text files | Critical |
| **PR3** | No Telemetry | User declines telemetry in init | No usage data collected | No network calls to agentlint servers | High |
| **PR4** | LLM Control | User chooses LLM provider | Analysis uses chosen provider | API calls only to user's provider | High |

**Architectural Support:**
- PR1: SQLite local storage ([ADR-0003](../adr/0003-local-storage-strategy.md))
- PR2: Keychain integration ([ADR-0005](../adr/0005-credential-storage-strategy.md))
- PR3: Opt-in telemetry ([ADR-0009](../adr/0009-observability-strategy.md))
- PR4: Multi-provider SDK ([ADR-0006](../adr/0006-agent-orchestrated-analysis.md))

### 10.2.3 Actionability

| ID | Scenario | Stimulus | Response | Measure | Priority |
|----|----------|----------|----------|---------|----------|
| **A1** | Recommendation Quality | User views recommendation | Recommendation includes specific action | 100% have concrete next step | Critical |
| **A2** | Config Snippets | Recommendation suggests config change | Snippet provided | Ready-to-paste code | High |
| **A3** | Causal Explanation | User wants to understand issue | Origin traced and explained | Causal chain visible | High |
| **A4** | Priority Guidance | User has multiple recommendations | Clear prioritization | Quick Wins + Optimal Impact views | Medium |

**Architectural Support:**
- A1: Recommendation schema validation
- A2: Template-based generation ([ADR-0010](../adr/0010-recommendation-prioritisation-strategy.md))
- A3: Causal tracing ([ADR-0007](../adr/0007-causal-analysis-architecture.md))
- A4: Prioritization algorithm ([ADR-0010](../adr/0010-recommendation-prioritisation-strategy.md))

### 10.2.4 Reproducibility

| ID | Scenario | Stimulus | Response | Measure | Priority |
|----|----------|----------|----------|---------|----------|
| **R1** | Static Consistency | Same analysis run twice | Identical static results | 100% match | High |
| **R2** | Agentic Consistency | Same analysis run twice | Semantically similar LLM results | ≥80% semantic similarity | Medium |
| **R3** | Documented Variance | LLM results vary | Variance documented | Confidence indicators shown | Medium |
| **R4** | Checkpoint Recovery | Analysis interrupted | Resume from checkpoint | <5% work loss | Medium |

**Architectural Support:**
- R1: Deterministic static analysis
- R2: Prompt engineering, seed control ([ADR-0015](../adr/0015-reproducibility-and-determinism.md))
- R3: Confidence metadata in results
- R4: Checkpoint system ([ADR-0016](../adr/0016-concurrency-model.md))

### 10.2.5 Developer Experience

| ID | Scenario | Stimulus | Response | Measure | Priority |
|----|----------|----------|----------|---------|----------|
| **D1** | Time to First Insight | New user installs agentlint | First useful recommendation | <5 minutes from install | High |
| **D2** | Init Wizard | User runs `agentlint init` | Guided through setup | Interactive wizard completes | High |
| **D3** | Help Discovery | User needs command help | Help available and useful | All commands documented | High |
| **D4** | Error Messages | Error occurs during analysis | User understands what to do | Conversational error with suggestion | High |
| **D5** | Shell Completion | User types partial command | Completion suggestions | Tab completion works | Medium |

**Architectural Support:**
- D1: Default config, progressive value
- D2: Interactive prompts ([ADR-0024](../adr/0024-cli-design-and-help-system.md))
- D3: Tiered help system ([ADR-0024](../adr/0024-cli-design-and-help-system.md))
- D4: Conversational errors ([ADR-0020](../adr/0020-output-formats-and-execution-ux.md))
- D5: Clerc completion ([ADR-0024](../adr/0024-cli-design-and-help-system.md))

### 10.2.6 Maintainability

| ID | Scenario | Stimulus | Response | Measure | Priority |
|----|----------|----------|----------|---------|----------|
| **M1** | Test Coverage | Developer changes code | Tests catch regressions | ≥80% coverage target | High |
| **M2** | Interface Stability | New adapter needed | Implement via interface | No core changes needed | High |
| **M3** | Security Updates | Dependency vulnerability | Update without breaking | Clean upgrade path | High |
| **M4** | Schema Migration | Database schema changes | Automatic migration | Zero manual intervention | Medium |

**Architectural Support:**
- M1: Testing pyramid ([ADR-0013](../adr/0013-testing-strategy.md))
- M2: Strategy pattern ([ADR-0018](../adr/0018-ai-tool-adapter-architecture.md), [ADR-0019](../adr/0019-language-ecosystem-support.md))
- M3: Minimal dependencies ([ADR-0001](../adr/0001-language-and-runtime-selection.md))
- M4: Migration system ([ADR-0017](../adr/0017-versioning-and-migration-strategy.md))

## 10.3 Quality Attribute Trade-offs

| Trade-off | Decision | Rationale |
|-----------|----------|-----------|
| **Performance vs. Depth** | Configurable model selection | Users choose cost/quality tradeoff |
| **Privacy vs. Cost** | User-provided API keys | Clear cost ownership and control |
| **Flexibility vs. Simplicity** | Compiled-in components | Security and quality over extensibility |
| **Blocking vs. Flow** | Non-blocking default | Observability-first philosophy |
| **Determinism vs. Richness** | Document variance | LLM adds value despite non-determinism |

## 10.4 Quality Measurement

### Metrics Dashboard (Planned)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Analysis P95 latency | <30s | OpenTelemetry traces |
| Cache hit rate | >80% | Cache middleware logging |
| Recommendation actionability | 100% | Schema validation |
| Static reproducibility | 100% | CI golden tests |
| Test coverage | ≥80% | Bun test coverage |
| User satisfaction | >4/5 | Optional feedback |

### Quality Gates

| Gate | Trigger | Requirement |
|------|---------|-------------|
| **Pre-commit** | Code change | Lint + type check pass |
| **PR** | Pull request | Tests pass, coverage maintained |
| **Release** | Version bump | Full test suite, eval suite |

## Related ADRs

All ADRs contribute to quality requirements. Key references:
- [ADR-0001](../adr/0001-language-and-runtime-selection.md) - Performance foundation
- [ADR-0003](../adr/0003-local-storage-strategy.md) - Privacy foundation
- [ADR-0007](../adr/0007-causal-analysis-architecture.md) - Actionability
- [ADR-0013](../adr/0013-testing-strategy.md) - Maintainability
- [ADR-0015](../adr/0015-reproducibility-and-determinism.md) - Reproducibility
- [ADR-0024](../adr/0024-cli-design-and-help-system.md) - Developer experience
