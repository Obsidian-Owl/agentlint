# agentlint: Design Questions

> Open questions and implementation considerations for the design phase.
> This document captures decisions that need research, prototyping, or stakeholder input.

**Status**: Active exploration
**Last Updated**: January 2026

---

## How to Use This Document

This document captures open design questions that need to be resolved during the design phase. Each question includes:
- The decision to be made
- Options being considered
- Key considerations and trade-offs
- Current thinking (where applicable)

Questions are resolved through research, prototyping, and stakeholder input. Once resolved, decisions move to the Decision Log (Section 11) and implementation documentation.

---

## 1. Core Architecture

### 1.1 Language & Runtime Selection

**Question**: What language and runtime should agentlint be built with?

**Options**:
| Option | Pros | Cons |
|--------|------|------|
| **TypeScript + Bun** | Fastest JS startup, native TypeScript, built-in SQLite | Newer ecosystem, less battle-tested |
| **TypeScript + Node.js** | Most mature, widest compatibility, largest ecosystem | Slower startup, requires build step |
| **TypeScript + Deno** | Strong security model, native TypeScript | Smaller ecosystem, compatibility concerns |
| **Rust** | Single binary, excellent performance, no runtime dependency | Steeper learning curve, slower initial development |
| **Go** | Fast compilation, simple cross-platform, single binary | Less expressive type system, smaller library ecosystem for LLM |
| **Python** | Excellent for statistical analysis, mature LLM ecosystem | Slower, distribution complexity (PyInstaller), startup time |

**Key Evaluation Criteria**:
- **Startup time target**: What's acceptable? (<100ms? <500ms?)
- **Workload characterisation**: Is this primarily CPU-bound (parsing 100MB+ logs) or I/O-bound?
- **Distribution model**: Single binary vs runtime dependency acceptable?
- **Statistical analysis needs**: How complex is signal correlation? Does it need NumPy/Pandas-level capabilities?
- **LLM ecosystem maturity**: Which language has best SDK support for multiple providers?

**Considerations**:
- Session logs can be 100MB+; parsing efficiency matters
- Cross-platform support is required (macOS, Linux, Windows)
- CLI startup time affects developer experience for frequent use
- Statistical/correlation analysis may favour Python's data science ecosystem
- Single binary distribution simplifies installation significantly

**Current Thinking**: ✅ **DECIDED** - See [ADR-0001](architecture/adr/0001-language-and-runtime-selection.md): TypeScript + Bun selected for <100ms startup, built-in SQLite, Agent SDK access.

### 1.2 Distribution & Packaging

**Question**: How will users install and update agentlint?

**Options**:
| Option | Pros | Cons |
|--------|------|------|
| npm package | Familiar to JS/TS developers, easy updates | Requires Node.js/Bun pre-installed |
| Homebrew formula | Native macOS experience, simple install | macOS/Linux only, maintenance burden |
| Cargo install | Rust ecosystem, single binary | Only if Rust is chosen |
| Direct binary download | No runtime dependency, works everywhere | Manual updates, trust concerns |
| Multiple channels | Maximum reach | Maintenance complexity |

**Sub-questions**:
- **Runtime dependency model**: Should users need Bun/Node/Python pre-installed, or should we provide self-contained binaries?
- **Platform-specific installers**: Do we need .pkg (macOS), .msi (Windows), .deb/.rpm (Linux)?
- **Binary signing**: Should binaries be code-signed for trust? (Apple notarisation, Windows Authenticode)
- **Release automation**: GitHub Actions for multi-platform builds?
- **Update mechanism**: Built-in update command? Rely on package manager? Notify-only?

**Considerations**:
- Language choice (1.1) significantly constrains this decision
- Self-contained binaries are simpler for users but harder to build
- Homebrew + npm covers most developer workflows
- Binary signing adds trust but requires certificates and process

**Current Thinking**: ✅ **DECIDED** - See [ADR-0002](architecture/adr/0002-distribution-and-packaging-strategy.md): npm primary + Homebrew formula for macOS convenience.

### 1.3 Local Storage Strategy

**Question**: How should analysis results, session history, and cache be stored?

**Options**:
| Option | Pros | Cons |
|--------|------|------|
| SQLite | Full query capability, single file, widely supported | Dependency, schema migrations |
| Flat files (JSON/YAML) | Simple, human-readable, no dependencies | Limited querying, potential performance issues |
| Hybrid | Best of both—structured queries + readable content | More complexity |

**Considerations**:
- Query patterns (trend comparison, historical lookup)
- Export capability for users
- Storage location standards (XDG, etc.)
- Baseline comparison requires efficient historical queries

**Current Thinking**: ✅ **DECIDED** - See [ADR-0003](architecture/adr/0003-local-storage-strategy.md): SQLite only using Bun built-in, with FTS5 for full-text search, XDG-compliant locations.

### 1.4 Configuration File Locations

**Question**: Where should agentlint store its own configuration?

**Options**:
- XDG Base Directory Specification (standard on Linux, adaptable elsewhere)
- User home directory (simple, universal)
- Per-project configuration (allows project-specific settings)
- Combination (global defaults + per-project overrides)

**Considerations**:
- Cross-platform compatibility (macOS, Linux, Windows)
- User expectations from similar tools
- Support for multiple projects with different settings

**Current Thinking**: ✅ **DECIDED** - See [ADR-0004](architecture/adr/0004-configuration-file-locations.md): XDG-compliant global + per-project override with TOML format. Global at `~/.config/agentlint/config.toml`, per-project at `.agentlint/config.toml`. Auto-creates with commented defaults on first run.

### 1.5 Credential Storage

**Question**: How should LLM API credentials be securely stored?

**Options**:
| Option | Pros | Cons |
|--------|------|------|
| System keychain | Native security, platform-specific | Platform-specific implementation |
| Encrypted file | Portable, works everywhere | Requires password/key management |
| Environment variables only | Simplest, user manages security | No persistence, user burden |

**Considerations**:
- Security requirements (API keys are sensitive)
- Cross-platform support
- User convenience vs security trade-off

**Current Thinking**: ✅ **DECIDED** - See [ADR-0005](architecture/adr/0005-credential-storage-strategy.md): Env vars primary (`ANTHROPIC_API_KEY`), Bun.secrets keychain fallback. Helper command `agentlint config set-key` for keychain setup. Never stores credentials in config files.

---

## 2. Analysis Engine

### 2.1 Agentic Analysis Implementation

**Question**: How should LLM-powered analysis be implemented?

**Options**:
| Option | Pros | Cons |
|--------|------|------|
| Claude Code wrapper | Fast MVP, battle-tested agent, understands own formats | Dependency on Claude Code CLI, less control |
| Custom agent (LLM SDK) | Full control, works with any LLM provider | More development effort, tool orchestration needed |
| Static-only (no LLM) | ~~Not viable~~ | LLM required per Constitution IX—agent IS the orchestrator |
| Hybrid (static core + optional LLM) | Progressive value, user choice | More complexity |

**Considerations**:
- Development speed vs control
- User requirements (not all users have Claude Code)
- Cost implications for users
- Aligns with Compounding Value principle

**Current Thinking**: ✅ **DECIDED** - See [ADR-0006](architecture/adr/0006-agent-orchestrated-analysis.md): Agent-orchestrated analysis with Vercel AI SDK. Static tools and LLM reasoning run in parallel—agent orchestrates which to invoke based on task requirements (Principle VII). Provider-agnostic (Anthropic, OpenAI), full tool use (read + selective write), native OpenTelemetry support for future observability.

### 2.2 LLM Provider Abstraction

**Question**: How should multiple LLM providers be supported?

**Options**:
| Option | Pros | Cons |
|--------|------|------|
| Vercel AI SDK | Unified interface, many providers, TypeScript-native | Dependency, may not cover all providers |
| LangChain | Feature-rich, well-known | Heavy, potentially over-engineered |
| Direct SDK usage | Most control, minimal dependencies | More code per provider |
| Custom abstraction layer | Tailored to our needs | Development effort |

**Considerations**:
- Provider coverage (Anthropic, OpenAI, local models)
- Streaming support for real-time feedback
- Tool use capabilities for agentic analysis
- Token counting and cost tracking

**Current Thinking**: ✅ **DECIDED** - Resolved by [ADR-0006](architecture/adr/0006-agent-orchestrated-analysis.md): Vercel AI SDK selected for provider abstraction. Supports Anthropic, OpenAI, and future providers via adapters. Includes streaming, tool use, and token tracking via OpenTelemetry integration.

### 2.3 Session Log Analysis Strategy

**Question**: How should large session logs be processed within context limits?

**Options**:
| Option | Pros | Cons |
|--------|------|------|
| Hierarchical summarisation | Preserves structure, scalable | Multiple LLM calls, cost |
| Sampling | Simple, predictable cost | May miss important patterns |
| Embedding-based retrieval | Semantic search, efficient | Requires embedding infrastructure |
| Streaming analysis | Memory efficient, real-time capable | Complex state management |

**Considerations**:
- Analysis quality vs token costs
- Session logs can be very large (100MB+)
- Need to correlate issues with specific session segments (causal tracing)
- Implementation complexity

**Current Thinking**: ✅ **DECIDED** - See [ADR-0008](architecture/adr/0008-session-quality-analysis.md): Agent-orchestrated layered analysis. Infrastructure from ADR-0007 (streaming parser, FTS5 indexing) enables processing 100MB+ logs. Analysis covers 6 dimensions: Outcome Metrics, Agent Cognitive Health, Configuration Effectiveness, Prompt Quality, Automation Health, and Cross-Session Learning. Static tools and agent reasoning run in parallel (per ADR-0011)—agent orchestrates analysis depth based on discovered patterns. Both approaches are first-class per Principle VII.

### 2.4 Causal Analysis Implementation

**Question**: How should the causal analysis model (DETECT → TRACE → UNDERSTAND → PREVENT) be implemented?

This is the **core differentiator** of agentlint. Traditional linters detect; agentlint traces to origin and recommends prevention.

**Sub-questions**:

| Question | Options | Considerations |
|----------|---------|----------------|
| How is causality established? | Heuristics, ML model, rule-based, LLM reasoning | Accuracy vs complexity vs explainability |
| What's the scope of origin tracing? | Git blame only, session logs only, both | More sources = better tracing but more complexity |
| Confidence thresholds? | Always show, threshold-based, user-configurable | Balance between noise and completeness |
| How are causal links represented? | Flat list, dependency graph, narrative | Affects output format and storage schema |
| Can users override causality? | Yes (feedback loop), No (read-only) | User override enables learning but adds complexity |

**Tracing Sources**:
- **Git history**: When was content added? By whom? In what commit?
- **Session logs**: Which AI session introduced this? What prompt led to it?
- **Config gaps**: What guidance was missing that allowed this issue?

**Example Causal Chain**:
```
Issue: Secret in CLAUDE.md
  → Traced to: Session abc123, prompt "add my API config"
  → Gap identified: No credential handling guidance
  → Prevention: Add "Use environment variables for all credentials"
```

**Considerations**:
- Accuracy of causal links affects trust in recommendations
- False positives (wrong causality) may be worse than no causality
- Session log correlation requires efficient search (see 2.7)
- Should causal confidence be visible to users?

**Current Thinking**: ✅ **DECIDED** - See [ADR-0007](architecture/adr/0007-causal-analysis-architecture.md): Evidence-First with LLM Synthesis + Multi-Pass Verification. Static extraction indexes 100MB+ logs via FTS5, LLM synthesizes causal narrative from evidence bundles, verification pass adds confidence. Evidence-based grading (HIGH/MEDIUM/LOW). User feedback improves rules + prompts.

### 2.5 Recommendation Prioritisation

**Question**: How should recommendations be ranked and prioritised?

**Sub-questions**:
- What factors determine priority? (impact, effort, dependency order, confidence)
- How is "impact" quantified? (frequency of issue, severity, user-defined weights)
- Can users customise priority weights?
- How are conflicting recommendations resolved?
- Should recommendations be grouped by type (symptomatic, preventive, systemic)?

**Priority Factors to Consider**:
| Factor | Description | Measurable? |
|--------|-------------|-------------|
| Impact | How much does this improve AI effectiveness? | Partially (proxy signals) |
| Effort | How hard is it to implement? | Estimate only |
| Confidence | How certain is the causal link? | Yes (from 2.4) |
| Frequency | How often does this issue occur? | Yes |
| Dependency | Does this enable other improvements? | Yes (graph analysis) |

**Considerations**:
- Recommendations with weak causal links should be deprioritised
- Preventive recommendations should rank higher than symptomatic
- User context affects priority (solo dev vs team)

**Current Thinking**: ✅ **DECIDED** - See [ADR-0010](architecture/adr/0010-recommendation-prioritisation-strategy.md): Layered Views approach with Quick Wins view (low effort, high impact) and Optimal Impact view (type-first with dependencies). Strong type weighting (Systemic=3 > Preventive=2 > Symptomatic=1). Confidence displayed but advisory (user decides). Effort estimated via heuristics. Conflicts merged when compatible, flagged when contradictory.

### 2.6 Parallel Processing Architecture

**Question**: Should analysis be single-threaded or parallel?

**Operations to Consider**:
| Operation | I/O or CPU bound? | Parallelisable? |
|-----------|-------------------|-----------------|
| File system scanning | I/O | Yes (multiple dirs) |
| AST parsing | CPU | Yes (per file) |
| Session log parsing | CPU | Yes (per session) |
| LLM calls | Network/I/O | Yes (concurrent requests) |
| Git history analysis | I/O | Partially |

**Sub-questions**:
- What's the target analysis time? (30 seconds per North Star)
- Memory budget for parallel tasks?
- Does parallelism affect determinism? (important for reproducibility)
- Thread pool vs async/await model?

**Considerations**:
- Parallel execution can dramatically speed up large codebase analysis
- Non-deterministic ordering may affect test reliability
- Memory constraints on developer machines
- Language choice (1.1) affects available concurrency primitives

**Current Thinking**: ✅ **DECIDED** - See [ADR-0011](architecture/adr/0011-parallel-processing-architecture.md): Layered Parallelism with Subagent Pattern. Static analysis uses Bun worker pools (CPU-bound tasks). Agentic analysis adopts Claude Code's orchestrator-worker pattern with up to 5 subagents (config, sessions, docs, code patterns, cross-reference). Deterministic output guaranteed via post-execution normalization (sort by domain/path/line). Rate limiting with token bucket for LLM calls.

### 2.7 Incremental Analysis

**Question**: How should analysis handle incremental updates efficiently?

**Scenarios**:
- User runs analysis daily; most files haven't changed
- New session log added since last analysis
- Config file modified

**Options**:
| Option | Pros | Cons |
|--------|------|------|
| Full re-analysis | Simple, always correct | Slow, wasteful |
| Content-addressed cache | Precise invalidation | Storage overhead, complexity |
| Git-aware incremental | Natural invalidation | Only works in git repos |
| Dependency tracking | Only re-analyse affected parts | Complex dependency graph |

**Considerations**:
- Correctness trumps speed (stale results are harmful)
- Watch mode (future) requires efficient incremental updates
- Baseline comparison is different from caching (historical vs current)

**Current Thinking**: ✅ **DECIDED** - See [ADR-0012](architecture/adr/0012-incremental-analysis-strategy.md): Hybrid change detection (Git + Session timestamps). **Key insight: Notification fatigue is real** - research shows fewer notifications → better engagement. Three frequency modes (configured during `agentlint init`): 🌙 Calm (~$1-5/mo), ⚖️ Regular (~$10-20/mo, recommended), ⚡ Active (~$30-50/mo). Passive triggers: Claude Code SessionEnd hook (threshold-based), Git pre-push hook, weekly digest. Shell prompt indicator opt-in only (causes fatigue). Active triggers: manual CLI, CI/CD. Recommendation lifecycle: proposed → adopted → measured → closed. See Section 7.1.1 for init workflow with cost transparency.

---

## 3. Data Architecture

### 3.1 Schema Design

**Question**: What data model should be used for storage?

**Core Entities**:
- Baselines (snapshots of signals at a point in time)
- Sessions (parsed session log data)
- Issues (detected problems)
- Recommendations (suggested improvements)
- Causal links (issue → origin → prevention)

**Query Patterns to Optimise**:
| Query | Frequency | Performance Need |
|-------|-----------|------------------|
| Get latest baseline | Every run | Fast |
| Compare two baselines | Trend analysis | Fast |
| Find sessions with issue type X | Causal tracing | Medium |
| Aggregate signals over time | Trend charts | Medium |
| Search recommendations by keyword | User lookup | Medium |

**Schema Options**:
- Relational (SQLite) - Good for complex queries
- Document (JSON files) - Good for flexibility
- Time-series optimised - Good for trend analysis

**Considerations**:
- Schema must support causal link representation
- Historical queries are core (not an afterthought)
- Export format should be human-readable

**Current Thinking**: ✅ **DECIDED** - See [ADR-0003](../docs/architecture/adr/0003-local-storage-strategy.md) which defines the SQLite schema with tables for baselines, sessions, causal_traces, recommendations, and FTS5 indexes for full-text search.

### 3.2 Schema Migration Strategy

**Question**: How should schema changes be handled as the tool evolves?

**Sub-questions**:
- How is schema version identified in stored data?
- Automatic migration on tool update, or manual command?
- Backward compatibility window (how long are old schemas supported)?
- Rollback strategy if migration fails?
- Are old baselines still queryable after migration?

**Options**:
| Option | Pros | Cons |
|--------|------|------|
| Automatic on startup | Seamless UX | Risk of data loss, slow startup |
| Explicit migrate command | User control | Extra step, users may forget |
| Lazy migration | Only migrate accessed data | Complexity, partial state |
| No migration (re-baseline) | Simple | Loses history (unacceptable) |

**Considerations**:
- Historical data is core to value proposition; loss is catastrophic
- Users may not run tool for weeks; schema may skip versions
- Testing migrations requires sample data from each version

**Current Thinking**: ✅ **DECIDED** - See [ADR-0017](architecture/adr/0017-versioning-and-migration-strategy.md)

**Decisions**:
- **Schema versioning**: PRAGMA user_version (zero dependencies, built into SQLite)
- **Migration trigger**: Automatic on startup with pre-flight backup
- **Backup strategy**: File copy to ~/.cache/agentlint/backups/ before migration
- **Rollback**: Restore from backup on migration failure
- **Version skipping**: Supported (can migrate v1 → v5 directly)

### 3.3 Baseline Versioning

**Question**: How should baselines be versioned and identified?

**Sub-questions**:
- Naming convention: timestamp, git commit, user-provided name?
- Retention policy: keep all forever, prune old, user-configured limit?
- What metadata is stored with each baseline?
- Can baselines be annotated or tagged?

**Metadata to Consider**:
- Timestamp
- Git commit hash (if available)
- agentlint version
- LLM model used (if applicable)
- User-provided notes
- Analysis scope (which domains were included)

**Considerations**:
- Reproducibility requires knowing which LLM model was used
- Retention affects storage requirements
- Baseline comparison needs efficient lookup by time range

**Current Thinking**: ✅ **DECIDED** - See [ADR-0017](architecture/adr/0017-versioning-and-migration-strategy.md)

**Decisions**:
- **Primary identifier**: ISO 8601 timestamp (human-readable, sortable)
- **Metadata stored**: Git commit + branch + dirty flag, agentlint version, schema version, LLM model + temperatures, analysis domains, optional user notes
- **Display format**: `agentlint history` shows table with timestamp, git short hash, version, and summary
- **Retention**: Configurable (follow-up decision needed)

---

## 4. Quality & Reliability

### 4.1 Testing Strategy

**Question**: How should agentlint be tested, especially LLM-dependent features?

**Testing Layers**:
| Layer | Scope | LLM Dependency |
|-------|-------|----------------|
| Unit tests | Individual functions | None (mocked) |
| Integration tests | Component interaction | Mocked or recorded |
| E2E tests | Full CLI workflow | Real or recorded |
| LLM behaviour tests | Agentic analysis quality | Real API required |

**LLM Testing Approaches**:
| Approach | Pros | Cons |
|----------|------|------|
| Mock responses | Fast, deterministic, free | Doesn't test real LLM behaviour |
| Recorded fixtures | Real responses, reproducible | Stale over time, storage overhead |
| Real API in CI | Tests actual behaviour | Slow, costly, flaky |
| Hybrid (mock default, real for release) | Balance | Complexity |

**Sub-questions**:
- What's the test coverage target?
- How to test causal analysis accuracy?
- Cross-platform testing matrix (OS × runtime versions)?
- Performance regression testing for "30-second scan" requirement?
- How to handle LLM response changes over time?

**Considerations**:
- LLM tests are inherently non-deterministic
- Real API tests have cost implications
- Test data (sample projects) needed for integration tests

**Current Thinking**: ✅ **DECIDED** - See [ADR-0013](architecture/adr/0013-testing-strategy.md): Layered testing pyramid with Bun Test + EvalKit. Four layers: (1) Unit tests - pure functions, 80%+ coverage, (2) Component tests - static analysers, no LLM, (3) Integration tests - golden dataset 100+ scenarios, mocked LLM via Vercel AI SDK, (4) Agent evaluation - real LLM every CI run, EvalKit metrics (tool correctness, hallucination, faithfulness, coherence). Cost tracking via OTel (ADR-0009). ~$5-10 per CI run budget.

### 4.2 Error Handling & Recovery

**Question**: How should failures be handled gracefully?

**Failure Scenarios**:
| Scenario | Impact | Recovery Strategy |
|----------|--------|-------------------|
| One analysis component fails | Partial results | Continue with others? Abort? |
| LLM API unavailable | No agentic analysis | Fall back to static-only |
| Corrupt baseline data | History lost | Backup restoration? Re-baseline? |
| Session log malformed | Missing session data | Skip with warning? |
| Out of memory | Crash | Streaming processing, limits |
| Permission denied | Can't read files | Clear error message |

**Sub-questions**:
- Should partial failures produce partial results or abort entirely?
- What's the retry strategy for transient failures (network, rate limits)?
- How are errors logged for debugging?
- Should there be a "safe mode" for recovery?

**Considerations**:
- Users should never lose data due to tool bugs
- Clear error messages are essential for debugging
- Graceful degradation aligns with Compounding Value principle

**Current Thinking**: ✅ **DECIDED** - See [ADR-0014](architecture/adr/0014-error-handling-and-recovery.md): Continue with Degraded + Exponential Backoff. Three error types: transient (retry with backoff + jitter), recoverable (degrade gracefully), fatal (abort with clear message). LLM unavailable → graceful degradation to static-only mode. Structured terminal output with color-coded errors, suggestions, and exit codes (0=success, 1=fatal, 2=partial, 3=issues found). Subagent isolation prevents cascade failures. Follows Claude Code checkpoint patterns and Vercel AI SDK error taxonomy.

### 4.3 Reproducibility & Determinism

**Question**: Should analysis results be reproducible?

**Factors Affecting Reproducibility**:
| Factor | Controllable? | Impact |
|--------|--------------|--------|
| File content | Yes (same input) | Deterministic |
| LLM responses | No (model updates, temperature) | Non-deterministic |
| LLM model version | Partially (can record) | Version drift |
| Parallel execution order | Partially | May affect results |

**Sub-questions**:
- Should baselines record which LLM model/version was used?
- How to handle comparison when LLM models differ between baselines?
- Should there be a "deterministic mode" that uses only static analysis?
- How to communicate non-determinism to users?

**Considerations**:
- Baseline comparison may be misleading if LLM behaviour changed
- Recording model version enables "reproducibility warnings"
- Static-only mode is always reproducible

**Current Thinking**: ✅ **DECIDED** - See [ADR-0015](architecture/adr/0015-reproducibility-and-determinism.md): Documented Non-Determinism with Version Tracking. Accept that LLM outputs are non-deterministic (even temp=0 doesn't guarantee it). **NOT using temp=0** - use task-appropriate temperatures (extraction: 0.1, reasoning: 0.3, synthesis: 0.4) for quality. Record full metadata: model ID, version, temperatures, timestamp, result hashes. Warn on version mismatch in baseline comparison. Static analysis fully deterministic. Static-only mode (`--static-only`) for guaranteed reproducibility.

### 4.4 Concurrency Model

**Question**: How should concurrent analysis runs be handled?

**Scenarios**:
- User runs `agentlint analyse` twice in different terminals
- Watch mode running while user triggers manual analysis
- CI/CD runs analysis while developer runs locally

**Options**:
| Option | Pros | Cons |
|--------|------|------|
| Single-instance lock | Simple, no conflicts | Blocks legitimate use cases |
| Isolated storage per run | No conflicts | Merge complexity |
| Read-write locking | Fine-grained control | Implementation complexity |
| Optimistic locking | Good for rare conflicts | Conflict resolution needed |

**Considerations**:
- Watch mode (Phase 4) will require concurrent access
- File locking mechanisms vary by OS
- Storage engine (SQLite vs files) affects options

**Current Thinking**: ✅ **DECIDED** - See [ADR-0016](architecture/adr/0016-concurrency-model.md)

**Decisions**:
- **Database Concurrency**: SQLite WAL mode (concurrent reads during writes, 10-30% faster writes)
- **Checkpointing**: SQLite-based checkpoints (NOT Temporal-style event sourcing - too complex for CLI)
- **Durability**: Crash-Resume (resume from last checkpoint, loses minimal work)
- **CLI Concurrency**: Lock + Queue (acquire project lock, wait if busy, user-friendly message)

**Key Design Insights**:
- Temporal's "durable execution" requires server infrastructure - violates Local-First
- SQLite WAL provides excellent concurrency for single-machine CLI tool
- Checkpoint after each major step: 50 files (static), each session (indexing), each subagent (agentic)
- Lock files use SHA256 of project path: `~/.local/share/agentlint/locks/<hash>.lock`

### 4.4 Observability Strategy

**Question**: How should agentlint support observability for debugging, monitoring, and product improvement?

**Context**: ADR-0006 selected Vercel AI SDK which has native OpenTelemetry support. This enables opt-in telemetry collection that could help improve the product while respecting Local-First principles.

**Options**:
| Option | Pros | Cons |
|--------|------|------|
| No telemetry | Simplest, maximum privacy | No product learning, harder debugging |
| Opt-in to agentlint cloud | Product improvement, community insights | Requires hosted infrastructure |
| Opt-in to user's OTel collector | User controls data destination | Complex setup for users |
| Hybrid (local logs + opt-in remote) | Best of both | Most implementation effort |

**Sub-questions**:
- What data should be collected? (traces, errors, usage patterns, findings)
- How is consent managed? (explicit opt-in, per-session, persistent)
- Where is data sent? (agentlint-hosted, user-configured OTel endpoint)
- What privacy controls exist? (redact file paths, API keys, code snippets)
- How does this align with Local-First principle?

**Considerations**:
- Local-First principle requires explicit user consent for any data leaving machine
- Vercel AI SDK's `experimental_telemetry` supports `recordInputs: false` for privacy
- OpenTelemetry is the industry standard, supported by Langfuse, Braintrust, Phoenix
- Product improvement requires understanding real-world usage patterns
- Enterprise users may have strict data governance requirements

**Current Thinking**: ✅ **DECIDED** - See [ADR-0009](architecture/adr/0009-observability-strategy.md): Dual-Exporter OpenTelemetry Pipeline. Local file exporter always enabled for debugging. Remote exporter to agentlint.io feature-flagged (disabled MVP, enabled post-MVP). Redaction processor hashes file paths/project names before remote export. Consent via `agentlint init` opt-in step + `agentlint telemetry enable/disable` command. Leverages Vercel AI SDK native OTel (ADR-0006).

---

## 5. Extensibility

### 5.1 Plugin Architecture for AI Tools

**Question**: How should support for new AI coding assistants be added?

**Options**:
| Option | Pros | Cons |
|--------|------|------|
| Compiled adapters | Part of core, tested together | Requires release for new tools |
| Runtime plugins | Dynamic loading, third-party contributions | Security concerns, versioning complexity |
| Configuration-based | Declarative, easy to add | Limited to pattern matching |

**Considerations**:
- Extensibility vs maintenance burden
- Third-party contributions
- Security implications of loading external code
- Versioning and compatibility

**Current Thinking**: ✅ **DECIDED** - See [ADR-0018](architecture/adr/0018-ai-tool-adapter-architecture.md)

**Decisions**:
- **Architecture**: Strategy + Factory pattern (compiled adapters, no runtime plugins)
- **Agent Configuration**: AgentProfile system - each adapter provides tool-specific prompts, skills, tools, workflow hints
- **Multi-Tool Handling**: Auto-detect all tools, merge findings, user configures primary tool
- **Adapter Interface**: Full adapter (detect, parseConfig, parseSessions, generateConfig, getAgentProfile)
- **MVP Scope**: Claude Code only; adapter pattern validated but others deferred
- **Maintenance**: Core team only; no third-party plugins

### 5.2 Language Ecosystem Support

**Question**: How should language-specific analysis be handled?

**Approach options**:
- Invoke existing language tools (type checkers, linters) and parse output
- Use multi-language parsing libraries
- Fall back to text-based analysis for unsupported languages

**Priority languages** (based on AI coding assistant adoption):
1. TypeScript/JavaScript
2. Python
3. Go

**Considerations**:
- Balance between depth (language-specific) and breadth (language-agnostic)
- Graceful degradation for unsupported languages
- Maintenance burden of language-specific code

**Current Thinking**: ✅ **DECIDED** - See [ADR-0019](architecture/adr/0019-language-ecosystem-support.md)

**Decisions**:
- **Parsing Strategy**: Layered approach (Surface regex → AST tree-sitter → External tools)
- **Analysis Structure**: LanguageAnalyzer interface (per-language implementations)
- **Metrics Scope**: Full static analysis (all layers) - agentlint as "deep research" capability
- **Deep Research Integration**: Static layers run in PARALLEL with LLM analysis (not sequentially)
- **Pattern Adopted**: Orchestrator-Worker from Claude's lead agent + parallel sub-agents model
- **Error Handling**: Graceful degradation (Gemini async task manager pattern)
- **MVP Languages**: TypeScript/JavaScript, Python, Go

---

## 6. Integration & Output

### 6.1 Output Formats

**Question**: What output formats should be supported?

**Options**:
- Terminal output (human-readable, immediate feedback)
- JSON (machine-readable, scriptable)
- Markdown (shareable reports)
- HTML (rich formatting, charts, trends)

**Considerations**:
- Primary use cases (interactive vs CI/CD vs reporting)
- Integration with other tools
- Complexity of implementation

**Current Thinking**: ✅ **DECIDED** - See [ADR-0020](architecture/adr/0020-output-formats-and-execution-ux.md)

**Decisions**:
- **Architecture**: Context-Aware Multi-Mode (Interactive, Scriptable, CI/CD, MCP)
- **Interactive Mode**: Terminal Dashboard with structured progress + conversational narration + final report
- **Scriptable Mode**: JSON, NDJSON (stream-json), plain text
- **CI/CD Mode**: SARIF (GitHub code scanning), JUnit XML, Markdown, exit codes
- **MCP Mode**: agentlint as MCP server with tools (analyse, recommend, trace)
- **Error UX**: Conversational (AI explains what happened), not raw error codes
- **Streaming**: Static results stream immediately; agentic narrates findings as discovered

### 6.2 Caching Strategy

**Question**: How should repeated analysis be optimised?

**Decision**: Multi-Layer Content-Addressed Caching with LLM Prompt Caching

See [ADR-0021: Caching Strategy](./architecture/adr/0021-caching-strategy.md) for full details.

**Summary**:
- **Layer 1**: Input fingerprinting (SHA-256 of config + sessions + code)
- **Layer 2**: Static analysis cache (content-addressed, per-file granularity)
- **Layer 3**: LLM prompt caching (Anthropic native, 90% cost reduction)
- **Layer 4**: Response cache (development/testing only, optional)

**Key Insights**:
- Content-addressed caching ensures precise invalidation (no stale results)
- Anthropic prompt caching saves up to 90% on LLM costs (cache reads at 0.1x price)
- Static analysis is fully deterministic; caching is safe and reliable
- Response caching is explicitly development-only for reproducibility
- This ADR addresses **performance caching**; ADR-0012 addresses **learning/tracking**

### 6.3 CI/CD Integration Patterns

**Question**: Why would anyone add agentlint to their CI? (Reframed from "how" to "why")

**Decision**: Observability-First Integration (Non-Blocking Default)

See [ADR-0022: CI/CD Integration Patterns](./architecture/adr/0022-cicd-integration-patterns.md) for full details.

**Key Reframe**: agentlint is NOT a quality gate. It's an improvement-oriented tool for tracking AI workflow effectiveness. CI integration provides **visibility** and **trend tracking**, not gatekeeping.

**Summary**:
- **Non-blocking by default**: Exit code 0 always (unless internal error). PR comments are informational, never blocking.
- **Configurable analysis levels**: Static (free), Light LLM (~$0.05/PR), Full (~$0.50/PR)
- **Baseline auto-capture**: On merge, capture baseline for trend tracking
- **Team visibility**: PR comments with insights, artifact reports, trend data

**Exit Codes**:
| Code | Meaning | CI Effect |
|------|---------|-----------|
| 0 | Analysis completed (even with findings) | Pass always |
| 1 | Internal error (tool bug) | Fail |
| 2 | Invalid configuration | Fail |

**Why CI Integration Matters for Personas**:
- **The Optimizer**: Auto-capture baselines, track improvement trends
- **Multi-Tool User**: Detect config drift across team PRs
- **Vibe Coder**: Surface cost trends, alert on degradation
- **Context Engineer**: Validate compliance with best practices

### 6.4 Git Hooks Integration

**Question**: How should agentlint integrate with git hooks?

**Decision**: Observability Triggers with Smart Throttling

See [ADR-0023: Git Hooks Integration](./architecture/adr/0023-git-hooks-integration.md) for full details.

**Key Philosophy**: Hooks are **observability triggers**, not quality gates. They trigger background analysis and surface status, never block git operations by default.

**Recommended Hook: post-push** (not pre-commit)
- Rationale: We track improvement OVER TIME, not per-operation
- post-push is a natural "I'm ready to share" checkpoint
- Background analysis runs without blocking the push

**Smart Throttling**:
| Check | Default | Purpose |
|-------|---------|---------|
| Cooldown | 4 hours | Don't run if last analysis was recent |
| Min sessions | 3 | Don't run if no significant changes |
| Batch window | 30 min | Combine rapid triggers into single analysis |

**Hook Types**:
| Hook | Recommended | Behavior |
|------|-------------|----------|
| pre-commit | No (opt-in) | Static only, <2s, exit 0 always |
| post-commit | Neutral | Counter increment only |
| post-push | **Yes** | Background analysis with throttling |

**Framework Integration**: Works with husky, lefthook, pre-commit (examples provided)

**Exit Codes**: Always 0 (observability-first). Findings are observations, not failures.

---

## 7. User Experience

### 7.1 CLI Design & Help System

**Question**: How should the CLI be designed for optimal UX?

**Decision**: Subcommand-based CLI using Clerc framework

See [ADR-0024: CLI Design and Help System](./architecture/adr/0024-cli-design-and-help-system.md) for full details.

**Command Structure** (git/npm style):
```
agentlint
├── init          # First-run wizard
├── analyse       # Run analysis (primary command)
├── baseline      # Create/manage baselines
├── compare       # Compare baselines
├── recommend     # Show recommendations
├── trace         # Trace issue to origin
├── scan          # Discover AI tools
├── hooks         # Manage git hooks
├── cache         # Manage analysis cache
├── config        # View/edit configuration
└── completion    # Generate shell completions
```

**CLI Framework**: [Clerc](https://github.com/mrozio13pl/clerc)
- Explicitly Bun-native (Node, Deno, Bun)
- Strongly-typed (TypeScript-first)
- Zero dependencies
- Built-in shell completion generation

**Global Flags** (per [clig.dev](https://clig.dev/)):
- `-h, --help` - Show help
- `-V, --version` - Show version
- `-q, --quiet` - Suppress non-essential output
- `-v, --verbose` - Show detailed output
- `--no-color` - Disable colored output
- `-f, --output-format` - Output format (from ADR-0020)

**Help Design**: Tiered help (root → command → contextual error suggestions)

### 7.1.1 `agentlint init` Command Design

**Question**: How should the first-run experience guide users through setup?

**Context**:
- ADR-0009 surfaces need for telemetry opt-in during init
- ADR-0012 surfaces need for frequency mode selection during init
- Research shows first-run wizards with safe defaults reduce time-to-value ([Medium CLI UX](https://medium.com/@kaushalsinh73/top-8-cli-ux-patterns-users-will-brag-about-4427adb548b7))

**Design Goals**:
1. **Minimal friction** - Get value quickly with sensible defaults
2. **Cost transparency** - Users understand LLM cost implications of choices
3. **Escapable** - Power users can skip with flags (`agentlint init --defaults`)
4. **Project-scoped** - Per-project config, with global defaults

**Proposed Init Flow**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         agentlint init WORKFLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: PROJECT DETECTION                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  $ agentlint init                                                          │
│                                                                             │
│  🔍 Detected AI coding tools:                                              │
│     ✓ Claude Code (claude-code, ~/.claude/)                                │
│     ✓ CLAUDE.md found                                                      │
│     ○ Cursor (not detected)                                                │
│     ○ Aider (not detected)                                                 │
│                                                                             │
│  📁 Project: myproject (/Users/me/myproject)                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 2: FREQUENCY MODE SELECTION                                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  How often should agentlint analyse your AI sessions?                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ○ 🌙 Calm      - Weekly digest, manual trigger only                │   │
│  │                  Estimated: ~$1-5/month in LLM costs               │   │
│  │                  Best for: cost-conscious, infrequent users        │   │
│  │                                                                     │   │
│  │ ● ⚖️  Regular   - After every 5 AI sessions (Recommended)          │   │
│  │                  Estimated: ~$10-20/month in LLM costs             │   │
│  │                  Best for: most users                              │   │
│  │                                                                     │   │
│  │ ○ ⚡ Active    - After every AI session                            │   │
│  │                  Estimated: ~$30-50/month in LLM costs             │   │
│  │                  Best for: power users, active improvement         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [↑↓ to select, Enter to confirm, ? for help]                              │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 3: HOOK INSTALLATION (based on frequency mode)                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  Based on your choice (Regular), these hooks will be installed:            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ☑ Claude Code SessionEnd hook (analyses after 5 AI sessions)       │   │
│  │ ☑ Git pre-push hook (analyses before pushing to remote)            │   │
│  │ ☐ Git post-commit hook (skipped - too frequent for Regular mode)   │   │
│  │ ☐ Shell prompt indicator (opt-in only - causes notification fatigue) │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Install hooks? [Y/n]                                                      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 4: TELEMETRY OPT-IN (from ADR-0009)                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  📊 Anonymous Telemetry (Optional)                                         │
│                                                                             │
│  Help improve agentlint by sharing anonymous usage data.                   │
│                                                                             │
│  We collect: command usage, timing, finding counts, LLM model used         │
│  We NEVER collect: file paths, code, prompts, API keys                    │
│                                                                             │
│  Enable anonymous telemetry? [y/N]                                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 5: SUMMARY & FIRST RUN                                               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  ✅ Configuration saved to .agentlint/config.toml                          │
│                                                                             │
│  Summary:                                                                   │
│    Frequency: Regular (analyse every 5 sessions)                           │
│    Hooks: Claude Code SessionEnd, Git pre-push                             │
│    Telemetry: Disabled                                                     │
│    Estimated cost: ~$10-20/month                                           │
│                                                                             │
│  Run initial baseline now? [Y/n]                                           │
│                                                                             │
│  (This will take 1-2 minutes and cost ~$0.10-0.50)                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**CLI Options**:
```bash
# Interactive init (default)
agentlint init

# Skip wizard, use defaults (Regular mode, no telemetry)
agentlint init --defaults

# Non-interactive with specific options
agentlint init --frequency calm --no-telemetry --no-hooks

# Init for global defaults (not project-specific)
agentlint init --global
```

**Files Created**:
```
.agentlint/
├── config.toml        # Project configuration
├── state.json         # Staleness tracking (gitignored)
└── .gitignore         # Ignores state.json

~/.config/agentlint/
└── config.toml        # Global defaults (created on first init)

~/.claude/hooks/
└── session-end.sh     # Claude Code hook (if Claude Code detected)

.git/hooks/
└── pre-push           # Git hook (if requested)
```

**Cost Transparency**:
| Mode | Sessions/Week | Analyses/Month | Est. Monthly Cost |
|------|---------------|----------------|-------------------|
| 🌙 Calm | Any | 4 (weekly) | $1-5 |
| ⚖️ Regular | ~20 | 16 (every 5) | $10-20 |
| ⚡ Active | ~20 | 80 (every 1) | $30-50 |

*Costs based on Claude Sonnet at ~$3/1M input, ~$15/1M output tokens, typical session size*

**Decision**: ✅ **DECIDED** - See [ADR-0024: CLI Design and Help System](./architecture/adr/0024-cli-design-and-help-system.md) for implementation details. First-run wizard with frequency mode selection (ADR-0012), telemetry opt-in (ADR-0009), and hook installation (ADR-0023). Cost transparency upfront. Sensible defaults (Regular mode). Escapable with `--defaults` flag.

### 7.2 Logging & Debugging

**Question**: How should logging and debugging work?

**Sub-questions**:
- Logging levels: DEBUG, INFO, WARN, ERROR?
- Log destination: stderr, file, configurable?
- Log rotation for file logs?
- `--verbose` / `--debug` flags?
- Diagnostic command (`agentlint diagnose`)?

**Logged Information**:
- Analysis stage progress
- LLM API calls, tokens, costs
- Error stack traces (in debug mode)
- Performance timing

**Considerations**:
- Logs should be safe to share (no secrets)
- Debug mode for troubleshooting
- Performance logging for optimisation

**Decision**: ✅ **DECIDED** - See [ADR-0025: Logging and Debugging Strategy](./architecture/adr/0025-logging-and-debugging-strategy.md). Using **Consola** (TypeScript-first, UnJS ecosystem, Bun-compatible). Tiered log levels: `--silent` → `--quiet` → (default info) → `--verbose` → `--debug`. stdout for results, stderr for diagnostics. Secrets always redacted. `agentlint doctor` command for environment validation with `--fix` option.

### 7.3 Documentation Strategy

**Question**: How should user-facing documentation be structured?

**Documentation Types**:
| Type | Audience | Format |
|------|----------|--------|
| README | First-time users | Markdown |
| Getting Started | New users | Markdown/Web |
| Command Reference | All users | --help, man pages |
| Configuration Guide | Power users | Markdown |
| Output Format Docs | Integrators | Markdown |
| Contributing Guide | Developers | Markdown |

**Sub-questions**:
- Man pages or --help only?
- Auto-generated from code or manually maintained?
- Online documentation site (mkdocs, docusaurus)?
- Tutorial/walkthrough content?

**Considerations**:
- Documentation maintenance burden
- Searchability and discoverability
- Keeping docs in sync with code

**Current Thinking**: TBD

---

## 8. Product & Ecosystem

### 8.1 Pricing Model

**Question**: How should the tool be monetised?

**Options**:
- Open source (community-driven, no direct revenue)
- Open source core + paid features
- Subscription model
- One-time purchase
- Freemium (free tier + paid tiers)

**Considerations**:
- Sustainability of development
- User expectations for CLI tools
- Competitive landscape
- Aligns with Local-First principle (no SaaS dependency)

**Current Thinking**: TBD

### 8.2 Telemetry & Privacy

**Question**: Should anonymised usage data be collected to improve the tool?

**Considerations**:
- Local-First principle emphasises privacy
- Telemetry can improve product decisions
- User trust is paramount
- Opt-in vs opt-out implications

**Current Thinking**: TBD

### 8.3 Community & Templates

**Question**: Should there be a public repository of configuration templates and best practices?

**Considerations**:
- Community contributions can accelerate adoption
- Maintenance burden
- Quality control
- Could be separate from core tool

**Current Thinking**: TBD

### 8.4 Token Budget & Cost Model

**Question**: How should LLM token usage and costs be managed?

**Sub-questions**:
- What's the acceptable token cost per analysis? (User decides? Tool enforces?)
- Should users be warned about estimated costs before LLM analysis?
- What happens if analysis would exceed budget? (Degrade, error, prompt)
- How is token usage tracked and reported?
- Should there be cost optimisation recommendations?

**Cost Factors**:
| Analysis Type | Token Usage | User Control |
|---------------|-------------|--------------|
| Static analysis | 0 | N/A |
| Config quality assessment | Low-Medium | Optional |
| Session log summarisation | Medium-High | Optional |
| Documentation quality | Medium | Optional |
| Full agentic analysis | High | Optional |

**Considerations**:
- Surprise costs damage trust
- Per-analysis cost visibility enables informed decisions
- Static tools run in parallel with LLM reasoning, minimising costs when agent judges them sufficient
- Power users may want full analysis regardless of cost

**Current Thinking**: TBD

---

## 9. Technical Research

### 9.1 Session Log Accessibility

| AI Tool | Log Accessibility | Format | Notes |
|---------|------------------|--------|-------|
| Claude Code | Available | JSONL | ~/.claude/projects/ |
| Cursor | Unknown | Unknown | Needs research |
| GitHub Copilot | Not exposed | N/A | May need git-based inference |
| Codex | Unknown | Unknown | Needs research |
| Gemini Code Assist | Unknown | Unknown | Needs research |

**Research needed**: Document log formats and accessibility for each tool.

### 9.2 MCP Integration

**Question**: Should agentlint expose itself as an MCP server?

**Potential value**:
- AI assistants could query agentlint directly
- Real-time feedback during sessions
- Deeper integration with workflows

**Considerations**:
- Implementation complexity
- User value vs development effort
- Aligns with Tool-Agnostic principle

**Current Thinking**: TBD (future consideration)

### 9.3 IDE Integration

**Question**: Should there be VS Code / Cursor / JetBrains extensions?

**Considerations**:
- CLI-first is an MVP non-goal
- Extensions could provide better UX
- Development and maintenance burden
- Could be community-contributed

**Current Thinking**: Post-MVP consideration

---

## 10. Phased Development

### Phase 1: Foundation (MVP)

**Goal**: Prove the continuous improvement concept with Claude Code analysis.

**Capabilities**:
- Baseline establishment with quantitative and qualitative signals
- Claude Code configuration detection and parsing
- Session log statistics (tokens, tools, iterations)
- Historical storage for trend comparison
- Basic recommendations
- Trend comparison to previous baselines

**Non-Goals**:
- Multi-tool support beyond Claude Code
- Deep semantic analysis requiring extensive LLM usage
- Automated fix application
- Web dashboard
- Cross-machine sync

### Phase 2: Analysis Depth

**Goal**: Rich analysis with actionable insights.

**Capabilities**:
- Full repository structure analysis
- Documentation quality assessment
- Developer tooling detection
- Hierarchical session log analysis
- Detailed recommendations with effort estimates
- Causal analysis implementation

### Phase 3: Multi-Tool Support

**Goal**: Unified analysis across AI coding assistants.

**Capabilities**:
- Cursor configuration analysis
- GitHub Copilot configuration analysis
- Cross-tool consistency checking
- Configuration migration assistance
- Unified effectiveness metrics

### Phase 4: Automation and Integration

**Goal**: Seamless workflow integration.

**Capabilities**:
- Automated configuration improvements
- Pre-commit hook integration
- CI/CD workflow integration
- DevSecOps assessment
- Continuous monitoring (watch mode)

---

## 11. Hindsight Learning & Cross-Session Memory

The CCA research paper introduces the concept of "hindsight notes" - a note-taking agent that distills trajectories into structured Markdown capturing failures, compilation errors, and runtime exceptions. This creates "a steadily growing, human-readable body of durable knowledge" enabling cross-session learning.

### Core Questions

#### 11.1 Should agentlint support hindsight capture?

**Options**:
1. **Passive analysis only**: Detect and analyze any hindsight documentation users have created
2. **Recommendation mode**: Recommend that users implement hindsight capture in configs/docs
3. **Active capture tooling**: Help users capture and organize learnings from traced issues
4. **Automated extraction**: Parse session logs to automatically extract hindsight candidates

**Considerations**:
- Options 3-4 expand scope significantly beyond "linter"
- Aligns strongly with causal analysis model (DETECT → TRACE → UNDERSTAND → CAPTURE → PREVENT)
- Could become a key differentiator

#### 11.2 What format should hindsight take?

**Options**:
1. Markdown notes in project docs
2. Structured data in agentlint's local database
3. Additions to AI configuration files (CLAUDE.md sections)
4. Git-tracked knowledge base

**Considerations**:
- Must be usable by both humans AND agents
- Should support the continuous improvement model
- Local-first principle applies

#### 11.3 How should hindsight be surfaced to agents?

**Options**:
1. Append to configuration files automatically
2. Recommend manual updates to configuration
3. Provide as separate context file the agent can reference
4. Integration with MCP for dynamic hindsight retrieval

#### 11.4 How do we measure hindsight effectiveness?

**Signals**:
- Repeated patterns get resolved faster over time
- Token costs decrease for similar tasks
- Error recurrence rate drops
- Recommendation adoption leads to measurable improvement

**Decision**: ✅ **DECIDED** - See [ADR-0026: Hindsight Capture and Knowledge Surfacing Strategy](./architecture/adr/0026-hindsight-capture-and-knowledge-surfacing-strategy.md). Active Capture + Auto-Extract scope. Extends causal model to `DETECT → TRACE → UNDERSTAND → CAPTURE → PREVENT`. SQLite storage with Markdown export. Export + Recommend surfacing (user controls what agents see). Integrates with ADR-0012 recommendation lifecycle.

---

## 12. agentlint Agent Architecture (Self-Application of AX/UX/DX)

The CCA research provides a framework we should apply to agentlint's own agentic components. We "eat our own dog food"—our analysis agents should embody the same AX principles we recommend to users.

### 12.1 Context Management for Analysis Agents

**Question**: How do we structure context for our LLM-powered analysis?

**Options**:
1. **Load and send**: Send full context to LLM (simple, but expensive and may overflow)
2. **Pre-summarization**: Summarize logs/configs before LLM analysis
3. **Hierarchical**: Multiple passes - coarse summary first, then targeted deep dives
4. **Hybrid**: Static pre-processing + LLM summarization for semantic content

**CCA Insight**: CCA uses hierarchical working memory with adaptive compression triggered when context approaches thresholds.

**Considerations**:
- Session logs can be very large (mentioned in architecture vision)
- Static tools and LLM reasoning run concurrently (per ADR-0011); agent orchestrates approach
- Need to preserve critical information in compression

### 12.2 Agent Working Memory Structure

**Question**: What does agentlint's agent need in its "cognitive workspace"?

**Components to consider**:
1. Task goal (what are we analyzing and why)
2. Project context (detected configs, language, structure)
3. Analysis progress (what we've assessed, what remains)
4. Findings so far (issues detected, traces in progress)
5. Baseline comparison (if available)

**CCA Insight**: Structured summaries preserving "task goals, decisions, TODOs, and error traces" while replacing historical messages.

### 12.3 AX/UX Separation in agentlint

**Question**: How do we separate what our agent sees vs. what users see?

**Agent-facing (AX)**:
- Compressed config summaries
- Session statistics (not full logs)
- Code samples (not full files)
- Distilled prior findings

**User-facing (UX)**:
- Full analysis reports
- Traced origins with evidence
- Detailed recommendations with rationale
- Historical trend visualizations

**Design Principle**: The agent works with distilled context; the user receives rich, interpretable output.

### 12.4 Hindsight for agentlint's Agent

**Question**: Should agentlint's agent learn from previous analyses?

**Options**:
1. **Stateless**: Each analysis is independent (simpler, more reproducible)
2. **Per-project memory**: Agent remembers previous analyses of this project
3. **Cross-project learning**: Agent learns patterns that transfer
4. **Meta-improvement**: Agent suggests improvements to its own prompts/configs

**CCA Insight**: Note-taking agent creates "steadily growing, human-readable body of durable knowledge."

**Considerations**:
- Reproducibility concern (same input should produce same output)
- Local-first principle (learning stays on machine)
- Meta-agent concept - could agentlint improve itself?

### 12.5 Extension/Modularity Pattern

**Question**: Should agentlint adopt an "extensions" pattern for its components?

**CCA Pattern**: Extensions with typed callbacks:
- Perception (interpreting outputs)
- Reasoning (rewriting prompts)
- Action (executing tools)

**agentlint Mapping**:
- Perception: Parsing configs, logs, code
- Reasoning: Assessing quality, generating recommendations
- Action: Writing reports, updating baselines

**Benefits**:
- Cleaner abstraction boundaries
- Easier testing and ablation
- Plugin potential for future extensibility

**Decision**: ✅ **DECIDED** - See [ADR-0028: Agent Modularity and Extension Pattern](./architecture/adr/0028-agent-modularity-and-extension-pattern.md). Keep current adapter pattern (AIToolAdapter, LanguageAnalyzer) - no P/R/A formalization needed. Compiled-in only (no plugins). Interface contracts + mocks for testing.

---

## 13. Decision Log

Resolved decisions are logged here with rationale.

| Decision | Date | Choice | Rationale |
|----------|------|--------|-----------|
| [ADR-0001](architecture/adr/0001-language-and-runtime-selection.md) | 2026-01-12 | TypeScript + Bun | <100ms startup, built-in SQLite, Agent SDK access, same stack as Claude Code |
| [ADR-0002](architecture/adr/0002-distribution-and-packaging-strategy.md) | 2026-01-12 | npm + Homebrew | npm primary for reach, Homebrew for macOS convenience, single source of truth |
| [ADR-0003](architecture/adr/0003-local-storage-strategy.md) | 2026-01-12 | SQLite Only | Bun built-in, FTS5 search, efficient trends/causal linking, XDG locations |
| [ADR-0004](architecture/adr/0004-configuration-file-locations.md) | 2026-01-12 | XDG + TOML | Global defaults + per-project overrides, TOML for comments, auto-create on first run |
| [ADR-0005](architecture/adr/0005-credential-storage-strategy.md) | 2026-01-12 | Env + Keychain | Env vars primary, Bun.secrets keychain fallback, helper command for setup |
| [ADR-0006](architecture/adr/0006-agent-orchestrated-analysis.md) | 2026-01-12 | Agent-Orchestrated + Vercel AI SDK | Agent orchestrates static tools + LLM reasoning in parallel. Multi-provider, full tool use, OTel ready |
| [ADR-0007](architecture/adr/0007-causal-analysis-architecture.md) | 2026-01-12 | Evidence-First + LLM Synthesis | Static evidence extraction, LLM synthesizes narrative, multi-pass verification, user feedback loop |
| [ADR-0008](architecture/adr/0008-session-quality-analysis.md) | 2026-01-12 | Agent-Orchestrated Layered Analysis | 6 analysis dimensions (outcome, cognitive health, config effectiveness, prompt quality, automation, cross-session learning). Builds on ADR-0007 infrastructure |
| [ADR-0009](architecture/adr/0009-observability-strategy.md) | 2026-01-12 | Dual-Exporter OTel Pipeline | Local always-on + remote feature-flagged. Redaction for privacy. Consent via init + command. Leverages ADR-0006 |
| [ADR-0010](architecture/adr/0010-recommendation-prioritisation-strategy.md) | 2026-01-12 | Layered Views | Quick Wins + Optimal Impact views. Strong type weighting (Systemic > Preventive > Symptomatic). Heuristic effort. Merge-first conflicts |
| [ADR-0011](architecture/adr/0011-parallel-processing-architecture.md) | 2026-01-12 | Layered Parallelism + Subagent | Static worker pools + orchestrator-worker agentic pattern. 5 subagents max. Deterministic via post-execution normalization |
| [ADR-0012](architecture/adr/0012-incremental-analysis-strategy.md) | 2026-01-12 | Hybrid + Frequency Modes | Hybrid change detection (Git + Session). Three frequency modes: 🌙 Calm, ⚖️ Regular, ⚡ Active (cost transparency). Shell prompt opt-in only (notification fatigue). Recommendation lifecycle: proposed → adopted → measured → closed |
| [ADR-0013](architecture/adr/0013-testing-strategy.md) | 2026-01-13 | Bun Test + EvalKit | 4-layer pyramid: unit, component, integration (golden dataset), agent eval (real LLM). EvalKit for tool correctness, hallucination, faithfulness. Real API every CI run. ~$5-10/run budget via OTel tracking |
| [ADR-0014](architecture/adr/0014-error-handling-and-recovery.md) | 2026-01-13 | Degraded + Backoff | Three error types (transient/recoverable/fatal). Exponential backoff + jitter for retries. Graceful degradation to static-only. Exit codes for CI/CD. Claude Code patterns |
| [ADR-0015](architecture/adr/0015-reproducibility-and-determinism.md) | 2026-01-13 | Documented Non-Determinism | Accept LLM non-determinism, task-appropriate temps (NOT temp=0), record full metadata, warn on version mismatch. Static analysis deterministic. Static-only mode for guaranteed reproducibility |
| [ADR-0016](architecture/adr/0016-concurrency-model.md) | 2026-01-13 | SQLite WAL + Crash-Resume | WAL mode for concurrent reads. SQLite-based checkpoints (not Temporal). Crash-resume from last checkpoint. Lock + Queue for CLI concurrency |
| [ADR-0017](architecture/adr/0017-versioning-and-migration-strategy.md) | 2026-01-13 | user_version + File Backup | PRAGMA user_version for schema versioning. Auto-migrate on startup with file backup. Config version field. Baseline: timestamp + git hash metadata |
| [ADR-0018](architecture/adr/0018-ai-tool-adapter-architecture.md) | 2026-01-13 | Strategy + Factory + AgentProfile | Compiled adapters (no plugins). Each adapter provides AgentProfile for tool-specific agent config. Auto-detect + merge for multi-tool. MVP: Claude Code only |
| [ADR-0019](architecture/adr/0019-language-ecosystem-support.md) | 2026-01-13 | Layered Analysis + Deep Research Pattern | Layered parsing (Surface → AST → External tools). LanguageAnalyzer interface. Full static analysis as "deep research". Parallel with LLM (not sequential). Orchestrator-Worker pattern from Claude. MVP: TS/JS, Python, Go |
| [ADR-0020](architecture/adr/0020-output-formats-and-execution-ux.md) | 2026-01-13 | Context-Aware Multi-Mode | Terminal Dashboard (structured progress + conversational narration + final report). Scriptable (JSON/NDJSON). CI/CD (SARIF/JUnit XML/exit codes). MCP server mode. Conversational error UX |
| [ADR-0021](architecture/adr/0021-caching-strategy.md) | 2026-01-13 | Multi-Layer + Prompt Caching | File hash-based invalidation. Static results cached locally. Prompt caching for LLM context. Cache warming for CI/CD |
| [ADR-0022](architecture/adr/0022-cicd-integration-patterns.md) | 2026-01-13 | GitHub Actions + SARIF | Official reusable workflow. SARIF for code scanning integration. Caching via actions/cache. PR comments via GitHub API |
| [ADR-0023](architecture/adr/0023-git-hooks-integration.md) | 2026-01-13 | Native + Husky Compat | Direct .git/hooks installation. Husky/lint-staged detection. Configurable hooks (pre-commit, pre-push). Quick mode for hooks |
| [ADR-0024](architecture/adr/0024-cli-design-and-help-system.md) | 2026-01-13 | Clerc + Init Wizard | Clerc framework (Bun-native). Subcommand structure. First-run init wizard. Shell completions |
| [ADR-0025](architecture/adr/0025-logging-and-debugging-strategy.md) | 2026-01-13 | Consola + Doctor Command | Consola logger (UnJS). Tiered verbosity (--quiet/--verbose/--debug). agentlint doctor for diagnostics. Secret redaction |
| [ADR-0026](architecture/adr/0026-hindsight-capture-and-knowledge-surfacing-strategy.md) | 2026-01-13 | Active Capture + Export | Extends causal model: DETECT→TRACE→UNDERSTAND→CAPTURE→PREVENT. SQLite + Markdown export. Export + Recommend surfacing. Integrates with ADR-0012 recommendation lifecycle |
| [ADR-0027](architecture/adr/0027-agent-working-memory-architecture.md) | 2026-01-13 | Hierarchical + Scratchpad | CCA-style memory tree. Threshold-based compression (80%). Per-project memory. Preserves goals/decisions/errors/TODOs. Integrates with ADR-0011 subagents |
| [ADR-0028](architecture/adr/0028-agent-modularity-and-extension-pattern.md) | 2026-01-13 | Keep Current Patterns | No P/R/A formalization - existing adapters sufficient. Compiled-in only (no plugins). Interface contracts + mocks for testing |

---

## 14. Next Steps

1. ~~**Language Evaluation**: Prototype in TypeScript and evaluate Rust/Go for performance-critical paths~~ ✅ Decided: TypeScript + Bun (ADR-0001)
2. ~~**Distribution & Packaging**: Decide on installation method now that language is settled (Section 1.2)~~ ✅ Decided: npm + Homebrew (ADR-0002)
3. ~~**Local Storage Strategy**: Decide on SQLite vs hybrid approach (Section 1.3)~~ ✅ Decided: SQLite Only (ADR-0003)
4. ~~**Configuration File Locations**: Decide on config file format and locations (Section 1.4)~~ ✅ Decided: XDG + TOML (ADR-0004)
5. ~~**Credential Storage**: Decide on secure storage for LLM API keys (Section 1.5)~~ ✅ Decided: Env + Keychain (ADR-0005)
6. ~~**Agentic Analysis Implementation**: Decide on LLM integration approach (Section 2.1)~~ ✅ Decided: Hybrid + Vercel AI SDK (ADR-0006)
7. ~~**Causal Analysis Design**: Deep dive on Section 2.4 - this is the core differentiator~~ ✅ Decided: Evidence-First + LLM Synthesis (ADR-0007)
8. ~~**Storage Schema**: Design data model that supports causal links and efficient queries~~ ✅ Included in ADR-0003
9. ~~**Session Log Analysis Strategy**: How to analyze 100MB+ logs for quality, effectiveness, and patterns (Section 2.3)~~ ✅ Decided: Layered Static + Optional LLM (ADR-0008)
10. ~~**Observability Strategy**: Decide on opt-in telemetry approach (Section 4.4)~~ ✅ Decided: Dual-Exporter OTel Pipeline (ADR-0009)
11. ~~**Recommendation Prioritisation**: Define how recommendations are ranked and conflicts resolved (Section 2.5)~~ ✅ Decided: Layered Views (ADR-0010)
12. ~~**Parallel Processing Architecture**: Define static and agentic parallelism strategy (Section 2.6)~~ ✅ Decided: Layered Parallelism + Subagent Pattern (ADR-0011)
13. ~~**Incremental Analysis Strategy**: Define change detection, triggers, and recommendation lifecycle (Section 2.7)~~ ✅ Decided: Hybrid + Frequency Modes (ADR-0012)
14. ~~**Testing Strategy**: Establish approach for LLM-dependent testing early (Section 4.1)~~ ✅ Decided: Bun Test + EvalKit (ADR-0013)
15. ~~**`agentlint init` Command Design**: Define full init workflow including telemetry opt-in (surfaced by ADR-0009)~~ ✅ Decided: First-run wizard with frequency modes (Section 7.1.1)
16. ~~**Error Handling & Recovery**: Define error classification, retry strategy, and graceful degradation (Section 4.2)~~ ✅ Decided: Degraded + Backoff (ADR-0014)
17. ~~**Reproducibility & Determinism**: Define how to handle LLM non-determinism and baseline comparison (Section 4.3)~~ ✅ Decided: Documented Non-Determinism (ADR-0015)
18. ~~**Concurrency Model**: Define database concurrency, checkpointing, durability, and CLI concurrency (Section 4.4)~~ ✅ Decided: SQLite WAL + Crash-Resume (ADR-0016)
19. ~~**Versioning & Migration Strategy**: Define schema migration, config versioning, baseline identification (Sections 3.2, 3.3)~~ ✅ Decided: user_version + File Backup (ADR-0017)
20. ~~**Plugin Architecture for AI Tools**: Define adapter architecture, agent configuration, multi-tool handling (Section 5.1)~~ ✅ Decided: Strategy + Factory + AgentProfile (ADR-0018)
21. ~~**Language Ecosystem Support**: Define language analysis approach, parsing strategy, deep research integration (Section 5.2)~~ ✅ Decided: Layered Analysis + Deep Research Pattern (ADR-0019)
22. ~~**Output Formats & Execution UX**: Define output formats, execution contexts, streaming UX, MCP integration (Section 6.1)~~ ✅ Decided: Context-Aware Multi-Mode (ADR-0020)

---

*This document is a living artifact. Questions are added as they arise and resolved through research and prototyping.*
