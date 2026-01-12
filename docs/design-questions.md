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

**Current Thinking**: TBD - Requires prototyping to evaluate trade-offs

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

**Current Thinking**: TBD - Depends on 1.1 resolution

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

**Current Thinking**: TBD

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

**Current Thinking**: TBD

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

**Current Thinking**: TBD

---

## 2. Analysis Engine

### 2.1 Agentic Analysis Implementation

**Question**: How should LLM-powered analysis be implemented?

**Options**:
| Option | Pros | Cons |
|--------|------|------|
| Claude Code wrapper | Fast MVP, battle-tested agent, understands own formats | Dependency on Claude Code CLI, less control |
| Custom agent (LLM SDK) | Full control, works with any LLM provider | More development effort, tool orchestration needed |
| Static-only (no LLM) | Simplest, no API costs, fastest | Limited semantic understanding |
| Hybrid (static core + optional LLM) | Progressive value, user choice | More complexity |

**Considerations**:
- Development speed vs control
- User requirements (not all users have Claude Code)
- Cost implications for users
- Aligns with Progressive Value principle

**Current Thinking**: TBD

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

**Current Thinking**: TBD

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

**Current Thinking**: TBD

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

**Current Thinking**: TBD - Core to product value, requires careful design

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

**Current Thinking**: TBD

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

**Current Thinking**: TBD

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

**Current Thinking**: TBD

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

**Current Thinking**: TBD

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

**Current Thinking**: TBD - Critical for data reliability

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

**Current Thinking**: TBD

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

**Current Thinking**: TBD

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
- Graceful degradation aligns with Progressive Value principle

**Current Thinking**: TBD

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

**Current Thinking**: TBD

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

**Current Thinking**: TBD

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

**Current Thinking**: TBD

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

**Current Thinking**: TBD

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

**Current Thinking**: TBD

### 6.2 Caching Strategy

**Question**: How should repeated analysis be optimised?

**Options**:
| Option | Pros | Cons |
|--------|------|------|
| Content-addressed cache | Precise invalidation by file hash | Storage overhead |
| Git-aware cache | Natural invalidation by commits | Only works in git repos |
| Time-based expiry | Simple TTL | May serve stale results |
| No caching | Always fresh | Slower, more expensive |

**Considerations**:
- Performance for large codebases
- Correctness (stale cache is worse than slow)
- Storage requirements
- Baseline comparison needs historical data (different from cache)

**Current Thinking**: TBD

### 6.3 CI/CD Integration Patterns

**Question**: How should agentlint integrate with CI/CD pipelines?

**Use Cases**:
- Run analysis on every PR
- Block merge if critical issues found
- Generate reports as build artifacts
- Comment on PRs with recommendations

**Sub-questions**:
- What exit codes for different outcomes?
- Output format for CI parsing (JSON, JUnit XML)?
- How to store baselines in CI (artifacts, external storage)?
- GitHub Actions, GitLab CI, Jenkins - official support?

**Considerations**:
- CI environments may have limited permissions
- Baselines need persistence across CI runs
- Cost implications of LLM analysis on every PR

**Current Thinking**: TBD (Phase 4)

### 6.4 Git Hooks Integration

**Question**: How should agentlint integrate with git hooks?

**Hook Types**:
| Hook | Use Case | Considerations |
|------|----------|----------------|
| pre-commit | Block commit if issues found | Must be fast |
| post-commit | Log analysis after commit | Non-blocking |
| pre-push | Check before pushing | Can be slower |

**Sub-questions**:
- Should agentlint install hooks automatically (`agentlint init`)?
- Configuration for which violations block vs warn?
- Integration with existing hook systems (husky, pre-commit)?
- How to make hook analysis fast enough?

**Considerations**:
- Hooks live in .git/hooks (not version-controlled by default)
- Full analysis too slow for pre-commit; need fast subset
- User control over blocking behaviour

**Current Thinking**: TBD (Phase 4)

---

## 7. User Experience

### 7.1 CLI Design & Help System

**Question**: How should the CLI be designed for optimal UX?

**Sub-questions**:
- Command structure: subcommands (`agentlint analyse`) or flags?
- Interactive mode for guided analysis?
- Progress indicators for long operations?
- Colour and formatting conventions?
- Shell completion scripts (bash, zsh, fish)?

**Common CLI Patterns**:
- `agentlint scan` - Discover AI tools
- `agentlint baseline` - Create baseline
- `agentlint analyse` - Run analysis
- `agentlint compare` - Compare baselines
- `agentlint recommend` - Show recommendations
- `agentlint trace <issue>` - Trace issue origin

**Considerations**:
- Consistent with user expectations from similar tools
- Progressive disclosure (simple default, advanced options available)
- Accessibility (screen readers, low-vision)

**Current Thinking**: TBD

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

**Current Thinking**: TBD

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
- Static-first principle minimises costs by default
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

### Research Needed

- Survey how developers currently capture learnings from AI sessions
- Analyze session logs for extractable hindsight patterns
- Evaluate CCA's hindsight note format for agentlint applicability
- Prototype automated hindsight extraction from traced issues

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
- Static-first principle applies - extract stats before LLM
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

---

## 13. Decision Log

Resolved decisions are logged here with rationale.

| Decision | Date | Choice | Rationale |
|----------|------|--------|-----------|
| *None yet* | - | - | - |

---

## 14. Next Steps

1. **Language Evaluation**: Prototype in TypeScript and evaluate Rust/Go for performance-critical paths
2. **Causal Analysis Design**: Deep dive on 2.4 - this is the core differentiator
3. **Storage Schema**: Design data model that supports causal links and efficient queries
4. **Testing Strategy**: Establish approach for LLM-dependent testing early
5. **Distribution**: Make packaging decision once language is settled

---

*This document is a living artifact. Questions are added as they arise and resolved through research and prototyping.*
