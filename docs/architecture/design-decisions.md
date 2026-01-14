# agentlint Design Decisions

> Key technical decisions requiring research and ADR documentation before implementation begins.

**Version**: 1.0.0
**Status**: Decision Catalogue
**Date**: January 2026

---

## Purpose

This document catalogues the key design decisions that must be made before detailed architecture documentation and implementation. Each decision will be resolved through research and documented as an Architecture Decision Record (ADR) according to project standards.

Decisions are organized by architectural domain and prioritized by dependency (decisions that block others are listed first).

---

## Decision Status Legend

| Status | Meaning |
|--------|---------|
| **OPEN** | Decision not yet researched |
| **RESEARCHING** | Active investigation underway |
| **PROPOSED** | Recommendation made, awaiting approval |
| **DECIDED** | ADR approved and ratified |

---

## 1. Foundation Decisions

These decisions establish the fundamental platform and must be resolved first.

### DD-001: Runtime Platform and Language

**Status**: DECIDED (ADR-0001)

**Question**: What runtime platform and programming language should agentlint be built on?

**Context**:
- agentlint is a CLI tool for developers
- Must support macOS, Linux, Windows
- Requires excellent async/streaming support for LLM interactions
- Should have strong ecosystem for CLI tooling and LLM libraries
- Constitution principle NFR-6.2 specifies Node.js LTS compatibility as a possibility

**Options to Consider**:
| Option | Strengths | Considerations |
|--------|-----------|----------------|
| TypeScript/Node.js | Strong CLI ecosystem, async excellence, wide adoption, type safety | V8 memory model, startup time |
| Rust | Performance, safety, excellent CLI tools (ripgrep precedent) | Steeper learning curve, LLM library maturity |
| Python | Rich LLM ecosystem, rapid prototyping | Distribution complexity, type checking optional |
| Go | Single binary distribution, good performance | Less flexible for dynamic agent patterns |

**Evaluation Criteria**:
- Developer productivity and maintainability
- Distribution simplicity (single binary vs. runtime dependency)
- LLM library ecosystem maturity
- Async/streaming support quality
- Cross-platform compatibility

**Related Principles**: NFR-6 (Compatibility), NFR-7 (Maintainability)

**Dependencies**: Blocks all implementation decisions

---

### DD-002: Agentic Framework Strategy

**Status**: DECIDED (ADR-0002)

**Question**: Should agentlint use an existing agentic framework, build a custom agent loop, or adopt a hybrid approach?

**Decision**: Use the **Claude Agent SDK** with Anthropic-only for MVP. This provides the same proven infrastructure that powers Claude Code, with built-in agent loop, context management, and MCP support. Anthropic-only strategy simplifies testing and maximizes development velocity.

**Context**:
- agentlint requires a master agent loop with tool calling
- Research shows production systems often use custom loops for control
- Claude Code uses a simple single-threaded loop without complex frameworks
- Constitution principle VII requires agent flexibility in tool selection

**Options to Consider**:
| Option | Strengths | Considerations |
|--------|-----------|----------------|
| LangChain/LangGraph | Rich ecosystem, many patterns pre-built | Abstraction complexity, may hide critical details |
| Vercel AI SDK | TypeScript-native, streaming-first, modern | Newer, may have gaps |
| Custom Loop | Full control, simple debugging, Claude Code pattern | More initial development, less community support |
| Hybrid | Custom loop with library utilities | Integration complexity |

**Key Questions**:
- How much control do we need over the agent loop?
- What tool-calling abstractions exist in each framework?
- How do frameworks handle streaming and checkpointing?
- What are the escape hatches when frameworks don't fit?

**Evaluation Criteria**:
- Alignment with single-threaded master loop architecture
- Tool definition and invocation flexibility
- Streaming and progressive output support
- Debuggability and transparency
- Long-session support (checkpointing, resumability)

**Related Principles**: VII (Intelligent Tooling), IX (Agent-Aware)

**Dependencies**: Depends on DD-001; Blocks tool layer implementation

---

### DD-003: LLM Provider Abstraction

**Status**: DECIDED (per ADR-0002)

**Question**: How should agentlint abstract LLM provider interactions to support multiple providers while optimizing for the primary use case?

**Decision**: **Anthropic-only for MVP** via Claude Agent SDK. No provider abstraction layer needed initially. Multi-provider support can be added post-MVP via thin adapter layer if demand warrants. This decision was made alongside ADR-0002 to simplify development, testing, and maximize Anthropic-specific optimizations (prompt caching, extended thinking).

**Context**:
- Primary users will likely use Anthropic models (analyzing Claude Code)
- Local-first principle requires user-provided credentials
- Must support tool calling, streaming, and potentially extended thinking
- Future-proofing for local models (Ollama) is desirable

**Options to Consider**:
| Option | Strengths | Considerations |
|--------|-----------|----------------|
| Direct Anthropic SDK | Optimized for primary use case, full feature access | Vendor coupling |
| Multi-provider SDK (LiteLLM, etc.) | Provider portability | Feature lowest-common-denominator |
| Custom abstraction | Full control | Development overhead |
| Provider plugins | Extensible | Architecture complexity |

**Key Questions**:
- How critical is multi-provider support for MVP?
- What provider-specific features do we need (extended thinking, caching)?
- How do we handle streaming across providers consistently?
- What's the cost of abstraction vs. direct integration?

**Evaluation Criteria**:
- Feature completeness for Anthropic (primary)
- Abstraction overhead
- Streaming support quality
- Future extensibility to other providers

**Related Principles**: I (Local-First), VI (Agent-Agnostic)

**Dependencies**: Depends on DD-001, DD-002; Blocks orchestration layer

---

## 2. Tool Layer Decisions

### DD-004: Tool Definition and Invocation Pattern

**Status**: DECIDED (ADR-0005)

**Question**: How should tools be defined, documented, and invoked within the agent loop?

**Decision**: Use **Claude Agent SDK's native `tool()` function with Zod schemas**. No MCP protocol overhead—the SDK creates MCP-compatible definitions without requiring MCP servers. Rich tool descriptions follow Anthropic's Poka-yoke principle for agent comprehension. Large results use **hybrid summarization**: if result < threshold return full; if >= threshold return LLM summary + store full result for retrieval.

**Tool Scope**:
- SDK built-in tools: Read, Glob, Grep, Bash (analysis-focused, no Write/Edit to project files)
- Custom tools: config parsing, session search, baselines, recommendations, learnings
- Controlled write: Agent can only write to `.agentlint/` and `~/.agentlint/`

**Context**:
- Tools serve the agent's cognitive needs
- Research emphasizes investing in Agent-Computer Interface (ACI) quality
- Tools should be atomic, well-documented, and prevent common errors
- MCP provides a standard tool definition format

**Options to Consider**:
| Option | Strengths | Considerations |
|--------|-----------|----------------|
| Native framework tools | Integration with chosen framework | Framework coupling |
| MCP-native tools | Standard format, ecosystem compatibility | Protocol overhead |
| Custom tool schema | Optimized for our needs | Non-standard |
| Hybrid (internal + MCP bridge) | Flexibility | Complexity |

**Key Questions**:
- Should tool definitions be MCP-compatible from the start?
- How do we ensure rich tool documentation for agent understanding?
- What validation and error handling patterns work best?
- How do we handle tool results that exceed context limits?

**Evaluation Criteria**:
- Ease of tool authoring
- Agent comprehension of tool capabilities
- Error handling and recovery
- Future MCP ecosystem integration

**Related Principles**: VII (Intelligent Tooling)

**Dependencies**: Depends on DD-002; Blocks static tool implementation

---

### DD-005: Session Log Processing Architecture

**Status**: DECIDED (ADR-0006)

**Question**: How should session logs be indexed, searched, and presented to the agent?

**Decision**: Use **SQLite FTS5** with Bun's built-in `bun:sqlite`. FTS5 provides full-text search with BM25 relevance ranking—essential for causal tracing. Index stored in `.agentlint/sessions.db`. **Watch + incremental indexing** keeps index current as new sessions occur. Schema tracks file:line positions for precise causal references.

**Research Finding**: Claude Code logs accumulate to 100s of MB (users report up to 379 MB). Logs stored as JSONL at `~/.claude/projects/[encoded-dir]/*.jsonl`.

**Context**:
- Claude Code session logs are large JSONL files
- Logs must be searchable for causal tracing (FR-6)
- Agent cannot ingest raw logs due to context limits
- Need position markers for precise issue references

**Options to Consider**:
| Option | Strengths | Considerations |
|--------|-----------|----------------|
| SQLite FTS5 | Embedded, proven, full-text search | Schema design complexity |
| In-memory indexing | Simple, fast for moderate sizes | Memory limits for large histories |
| External search (Elasticsearch) | Powerful | Deployment complexity, not local-first |
| Streaming with summarization | Memory efficient | May lose detail |

**Key Questions**:
- What's the expected session log volume for typical users?
- How do we balance search precision with context limits?
- What indexing strategy enables efficient causal tracing?
- How do we handle incremental updates as new sessions occur?

**Evaluation Criteria**:
- Search performance for causal tracing
- Memory efficiency
- Incremental update support
- Local-first compatibility

**Related Principles**: III (Causal-First), I (Local-First)

**Dependencies**: Depends on DD-001; Blocks session analysis implementation

---

### DD-006: Configuration Parser Design

**Status**: DECIDED (ADR-0007)

**Question**: How should ACT configuration files be parsed, normalized, and validated?

**Decision**: Use **mdast + Adapter Pattern**. The unified/remark ecosystem parses markdown into AST, then adapters normalize output per ACT type. Claude Code adapter implemented for MVP; others via community contribution. Structural analysis extracts quality signals (size, coverage, patterns, anti-patterns) without semantic understanding.

**Key Quality Signals Extracted**:
- Size metrics: line count, token estimate, weight class (lightweight/medium/heavy)
- Structure: sections, WHAT/WHY/HOW coverage, heading depth
- Content: build/test commands, file references, emphasis markers
- Anti-patterns: generic rules, secrets, linter jobs, instruction overload

**Research-Backed Thresholds**:
- CLAUDE.md: <60 lines recommended, <300 max (HumanLayer, Anthropic)
- Cursor rules: <100 lines per file, <500 max
- Token weight: <3k lightweight, 3-15k medium, >25k heavy (bottleneck)

**Related Principles**: VI (Agent-Agnostic)

**Dependencies**: Depends on DD-001; Blocks config analysis implementation

---

## 3. Persistence Decisions

### DD-007: Baseline Storage Format and Strategy

**Status**: DECIDED (ADR-0008)

**Question**: How should baselines be stored, versioned, and queried?

**Decision**: Use **JSON files + SQLite metadata index**. Each baseline is stored as a human-readable `.json` file in `.agentlint/baselines/`. SQLite database indexes metadata for fast trend queries. Delta calculation uses jsondiffpatch library. Baselines are project-local (no export/import for MVP).

**Key Design Points**:
- Human debuggable: Plain JSON files open in any editor
- Efficient queries: SQLite indexes created_at, warning_count, coverage_score
- User-configurable frequency: per-analysis, explicit, or on-change modes
- Follows same pattern as session indexing (ADR-0006)

**Storage Layout**:
```
.agentlint/
├── baselines/
│   ├── 2026-01-14T10-30-00-abc123.json
│   └── latest.json → (symlink to most recent)
└── baselines.db
```

**Related Principles**: II (Improvement-Oriented), VIII (Compounding Value)

**Dependencies**: Depends on DD-001; Blocks baseline functionality

---

### DD-008: Global Learnings Storage and Transfer

**Status**: DECIDED (ADR-0009)

**Question**: How should cross-project learnings be stored, validated, and transferred?

**Decision**: Use **Markdown files + sqlite-vec for semantic search**. Each learning is stored as a human-readable markdown file with YAML frontmatter in `~/.agentlint/learnings/`. Semantic search via local embeddings (Transformers.js + sqlite-vec) finds relevant learnings at session start. LLM validates generalizability before promotion to global status.

**Key Design Points**:
- Human editable: Markdown with YAML frontmatter for metadata
- Semantic retrieval: Local embeddings via `Xenova/gte-small` (~50MB cached)
- Quality validation: LLM checks generalizability score (>0.7 to promote)
- Origin tracking: Each learning tracks project/session it came from
- Usage metrics: Retrieval and application counts for learning effectiveness

**Storage Layout**:
```
~/.agentlint/
├── learnings/
│   └── 2026-01-14-api-error-handling-abc123.md
├── learnings.db        # sqlite-vec for vector search
└── models/             # Transformers.js model cache
```

**Related Principles**: VIII (Compounding Value)

**Dependencies**: Depends on DD-001; Blocks learning system

---

### DD-009: Session State and Checkpointing

**Status**: DECIDED (ADR-0010)

**Question**: How should analysis session state be checkpointed and restored?

**Decision**: Use **SDK sessions + state file** with **event + interval triggers**. The Claude Agent SDK handles conversation persistence natively via session IDs. agentlint adds a lightweight JSON state file for analysis-specific data (findings, tool results, progress). Checkpoints are saved on significant events AND at time intervals (whichever comes first).

**Key Design Points**:
- Leverage SDK's built-in session management (resume via `resume: sessionId`)
- JSON state file per session: `.agentlint/sessions/{sessionId}-state.json`
- Dual triggers: Event-based (findings, phase completion) + interval (every 60s)
- Tool result caching: Avoid re-running expensive operations on resume
- Crash recovery: Check for incomplete sessions on startup

**Checkpoint Triggers**:
- On finding detected
- On phase completion (scan → analyze → recommend)
- On recommendation generated
- Every 60 seconds (interval)
- Minimum 10 seconds between checkpoints (debounce)

**Related Principles**: NFR-1.2 (Agentic Analysis Layer)

**Dependencies**: Depends on DD-002; Blocks long-session support

---

## 4. Interface Decisions

### DD-010: CLI Framework and Command Structure

**Status**: DECIDED (ADR-0003)

**Question**: What CLI framework should be used and how should commands be structured?

**Decision**: Use **Ink + Commander.js** following Claude Code's architecture pattern. Ink provides React-based terminal UI with streaming support and Yoga layout engine. Commander handles argument parsing. Commands use verb-based structure (scan, analyse, baseline, compare, recommend, trace, validate, learn).

**Context**:
- Primary interface is CLI
- Commands: scan, analyse, baseline, compare, recommend, trace, validate, learn
- Need excellent help, completion, and error messages
- Progressive output for long operations

**Options to Consider**:
| Option | Strengths | Considerations |
|--------|-----------|----------------|
| Commander.js | Mature, widely used | Less modern DX |
| Oclif | Extensible, plugin architecture | Heavier weight |
| Cliffy (Deno) | Modern, TypeScript-native | Deno-specific |
| Clap (Rust) | Excellent UX, derived macros | Rust-only |
| Cobra (Go) | Standard for Go CLIs | Go-only |

**Key Questions**:
- What command structure best serves the continuous improvement model?
- How do we handle streaming output in CLI context?
- What progress indication patterns work for 30+ minute operations?
- How do we support both interactive and scripted usage?

**Evaluation Criteria**:
- Developer ergonomics
- Streaming and progress support
- Help and documentation quality
- Cross-platform consistency

**Related Principles**: NFR-5 (Usability)

**Dependencies**: Depends on DD-001; Blocks CLI implementation

---

### DD-011: Output Format and Rendering

**Status**: DECIDED (ADR-0004)

**Question**: How should analysis results be formatted and rendered across different output modes?

**Decision**: Use **Ink UI Components + Custom Causal Tree**. Leverage @inkjs/ui for standard components (Spinner, ProgressBar, Table, StatusMessage), build custom tree component for causal chain visualization. Support three output formats: Terminal (default with rich Ink rendering), JSON (--json with JSON Lines for streaming), and Markdown (--markdown for reports).

**Context**:
- Multiple output formats: terminal (default), JSON, Markdown
- Terminal output needs careful width handling
- Streaming output during long operations
- Causal chains need visual representation

**Options to Consider**:
| Option | Strengths | Considerations |
|--------|-----------|----------------|
| Template-based rendering | Flexible, separates logic from presentation | Template complexity |
| Structured output + formatters | Clean separation | Multiple rendering paths |
| Rich terminal libraries (Ink, etc.) | Modern terminal UX | Dependency weight |
| Plain text + ANSI | Simple, portable | Limited formatting |

**Key Questions**:
- How rich should terminal output be?
- How do we handle output width across terminals?
- What's the best way to represent causal chains visually?
- How do we balance aesthetics with accessibility?

**Evaluation Criteria**:
- Readability and clarity
- Streaming support
- Cross-terminal compatibility
- Accessibility

**Related Principles**: NFR-5.3 (Output readable in standard terminal widths)

**Dependencies**: Depends on DD-001, DD-010; Blocks report implementation

---

## 5. Quality and Testing Decisions

### DD-012: Testing Strategy for Agentic Components

**Status**: DECIDED (ADR-0011)

**Question**: How should agentic components (agent loop, tool interactions, LLM responses) be tested?

**Decision**: Use **VCR-style recorded responses + TruLens evals** with **separate test suites**. Unit tests run on every commit with mocks. Integration tests use VCR-recorded API responses and run on pull requests. E2E tests and behavioral evaluations use TruLens with live LLM calls, running only on release tags.

**Key Design Points**:
- VCR recordings via bun-bagel for deterministic CI
- TruLens provides explainable evaluation metrics with tracing
- Four test suites: unit (mocked), integration (VCR), E2E (live), evals (TruLens)
- Expensive tests gated to release tags only
- Behavioral metrics: relevance, groundedness, actionability

**Test Suite Structure**:
| Suite | Runs On | LLM Interaction |
|-------|---------|-----------------|
| Unit | Every commit | Mocked |
| Integration | Pull requests | Recorded (VCR) |
| E2E | Release tags | Live |
| Evals | Release tags | Live + TruLens |

**Related Principles**: NFR-7.2 (Test coverage >80% for core functionality)

**Dependencies**: Depends on DD-001, DD-002; Blocks test infrastructure

---

### DD-013: Evaluation Framework for Analysis Quality

**Status**: DECIDED (ADR-0012)

**Question**: How do we measure and validate the quality of agentlint's analysis and recommendations?

**Decision**: Use **golden dataset + outcome tracking** with **comprehensive dogfooding**. Real production CLAUDE.md files from GitHub (Metabase, LangGraph). Session logs via dogfooding only—no public dataset exists. Outcome tracking captures whether recommendations helped.

**Critical Finding**: No public session log dataset exists. Session logs must be generated through dogfooding.

**Key Design Points**:
- Three-tier grading: code-based (fast), LLM-as-judge (nuanced), human spot-check (gold standard)
- Primary metrics: actionability, causal accuracy, relevance
- Comprehensive dogfooding: CLAUDE.md, commands, skills, CI/CD, docs—all best-in-class
- Outcome tracking: did users implement? did it help? (opt-in)

**Phased Dataset Strategy**:
| Phase | CLAUDE.md Source | Session Log Source |
|-------|-----------------|-------------------|
| MVP | Real production repos (Metabase, LangGraph) | Dogfooding only |
| Post-launch | Above + agentlint's own | Dogfooding (accumulated) |
| Ongoing | Above + community submissions | Above + opt-in user data |

**Golden Dataset Sources**:
- [metabase/metabase CLAUDE.md](https://github.com/metabase/metabase/blob/master/CLAUDE.md) - Real production
- [langchain-ai/langgraphjs CLAUDE.md](https://github.com/langchain-ai/langgraphjs/blob/main/CLAUDE.md) - Real production
- Session logs: **Dogfood only** (no public dataset exists)

**Related Principles**: II (Improvement-Oriented), IX (Agent-Aware)

**Dependencies**: Depends on DD-002; Blocks quality measurement

---

## 6. Security and Privacy Decisions

### DD-014: Secret Detection Strategy

**Status**: DECIDED (ADR-0013)

**Question**: How should agentlint detect secrets and sensitive information in analyzed files?

**Decision**: Use **Hybrid: Gitleaks patterns + LLM validation**. Parse Gitleaks' TOML pattern definitions (140+ community-maintained detectors) in TypeScript, then use LLM to validate candidates with redacted context. This provides battle-tested patterns without binary dependencies, while LLM reasoning reduces false positives.

**Key Design Points**:
- Pattern source: Gitleaks TOML rules (synced periodically from upstream)
- Execution: Native TypeScript regex matching (no Go binary required)
- Privacy: Secret values redacted before LLM sees context
- Validation: Agent reasons about context to classify true/false positives
- Output: Classification with confidence score and reasoning

**Research Findings**:
- Entropy-only detection produces high false positives (210K candidates → first 50 all false positives in one study)
- LLMs achieve F1 = 94.49% vs 80% for pure regex (IEEE research)
- detect-secrets has lowest false positive rate but requires Python runtime
- Gitleaks patterns are recall-focused; LLM filter adds precision

**Related Principles**: I (Local-First), NFR-2 (Privacy and Security)

**Dependencies**: Depends on DD-001; Blocks security features

---

### DD-015: Credential Management

**Status**: OPEN

**Question**: How should user LLM API credentials be stored and accessed?

**Context**:
- Local-first requires user-provided credentials
- Must never transmit credentials inappropriately
- Need secure local storage
- Support multiple providers potentially

**Options to Consider**:
| Option | Strengths | Considerations |
|--------|-----------|----------------|
| Environment variables | Simple, standard | User must manage |
| System keychain | Secure, OS-integrated | Platform-specific APIs |
| Encrypted config file | Portable | Key management complexity |
| Credential helper pattern | Flexible, git-like | Implementation complexity |

**Key Questions**:
- What's the expected user flow for credential setup?
- How do we handle credential rotation?
- What validation should occur at startup?
- How do we support CI/scripted usage?

**Evaluation Criteria**:
- Security of storage
- User experience for setup
- Cross-platform consistency
- CI/automation support

**Related Principles**: I (Local-First), NFR-2.3 (User provides own credentials)

**Dependencies**: Depends on DD-001; Blocks LLM integration

---

## 7. Integration Decisions

### DD-016: Git Integration Depth

**Status**: OPEN

**Question**: How deeply should agentlint integrate with Git for temporal analysis?

**Context**:
- Git history needed for causal tracing
- Blame, log, diff, pickaxe search capabilities
- Must work with or without git (NFR-6.5)
- Performance considerations for large repos

**Options to Consider**:
| Option | Strengths | Considerations |
|--------|-----------|----------------|
| Git CLI wrapper | Simple, universal | Process overhead |
| libgit2 bindings | Native performance | Binding complexity |
| isomorphic-git | Pure JS, portable | Feature completeness |
| Minimal integration | Graceful degradation | Limited tracing capability |

**Key Questions**:
- What git operations are critical for causal tracing?
- How do we handle large repositories efficiently?
- What's the degradation path without git?
- How do we handle shallow clones or worktrees?

**Evaluation Criteria**:
- Performance for common operations
- Feature completeness
- Cross-platform reliability
- Graceful degradation

**Related Principles**: III (Causal-First), NFR-6.5 (Works with or without git)

**Dependencies**: Depends on DD-001; Blocks temporal analysis

---

### DD-017: MCP Integration Strategy

**Status**: OPEN

**Question**: Should agentlint adopt MCP (Model Context Protocol) and if so, to what extent?

**Context**:
- MCP is becoming standard for AI-tool integration
- Donated to Linux Foundation by Anthropic, OpenAI, Block
- Could enable ecosystem extensibility
- May add protocol overhead

**Options to Consider**:
| Option | Strengths | Considerations |
|--------|-----------|----------------|
| Full MCP adoption | Ecosystem compatibility | Protocol complexity |
| MCP bridge for extensions | Core simplicity, optional extensibility | Two systems |
| MCP-compatible tool definitions | Future-proof, no runtime overhead | Definition maintenance |
| No MCP | Simplicity | Potential isolation |

**Key Questions**:
- What's the adoption trajectory of MCP?
- What extensibility do we actually need?
- What's the protocol overhead cost?
- Can we start simple and add MCP later?

**Evaluation Criteria**:
- Ecosystem benefit vs. complexity cost
- Implementation timeline impact
- Future extensibility
- Maintenance burden

**Related Principles**: NFR-3 (Extensibility)

**Dependencies**: Depends on DD-002, DD-004; Impacts tool architecture

---

### DD-018: Agent Skills Integration

**Status**: OPEN

**Question**: How should agentlint integrate with the Agent Skills standard, and should agentlint itself be packageable as an Agent Skill?

**Context**:
- Agent Skills is an open standard (agentskills.io) for portable procedural knowledge
- Originally developed by Anthropic, now adopted by Claude Code, Cursor, VS Code, OpenAI Codex, etc.
- SKILL.md format provides structured metadata + instructions + supporting files
- Skills enable cross-platform interoperability

**Options to Consider**:
| Option | Strengths | Considerations |
|--------|-----------|----------------|
| Analysis only | Detect and assess SKILL.md quality | Limited integration |
| Analysis + recommendations | Generate skill improvement suggestions | Medium complexity |
| agentlint as a Skill | Enable other agents to invoke agentlint | Packaging constraints |
| Full ecosystem integration | Consume and produce skills | Higher complexity |

**Key Questions**:
- Should agentlint analyze SKILL.md files as part of ACT configuration?
- What quality criteria apply to skills (description clarity, size limits, structure)?
- Could agentlint recommendations be packaged as Agent Skills?
- Should agentlint be invocable as an Agent Skill by other agents?

**Evaluation Criteria**:
- Value to users who use Agent Skills
- Alignment with agent-agnostic principle
- Implementation complexity
- Cross-platform benefit

**Related Principles**: VI (Agent-Agnostic), NFR-3 (Extensibility)

**Dependencies**: Depends on DD-006; Impacts configuration analysis scope

---

## 8. Distribution Decisions

### DD-019: Distribution and Installation Strategy

**Status**: OPEN

**Question**: How should agentlint be distributed and installed?

**Context**:
- Target: developers with CLI experience
- Must support macOS, Linux, Windows
- Balance between ease of install and dependency management
- Updates and versioning

**Options to Consider**:
| Option | Strengths | Considerations |
|--------|-----------|----------------|
| npm package | Standard for Node.js tools | Requires Node.js |
| Single binary (pkg, deno compile) | No runtime dependency | Larger file size |
| Homebrew/Chocolatey/apt | Native package managers | Multiple systems to maintain |
| Container image | Consistent environment | Docker dependency |

**Key Questions**:
- What's the acceptable install friction?
- How do we handle updates?
- What's the first-run experience?
- How do we support enterprise proxies/firewalls?

**Evaluation Criteria**:
- Installation simplicity
- Cross-platform consistency
- Update mechanism
- Offline/air-gapped support

**Related Principles**: NFR-6 (Compatibility), NFR-5 (Usability)

**Dependencies**: Depends on DD-001; Impacts release process

---

## Decision Dependencies

```
DD-001 (Runtime/Language)
    │
    ├──▶ DD-002 (Agentic Framework) ──▶ DD-004 (Tool Pattern)
    │         │                              │
    │         ├──▶ DD-003 (LLM Provider)     └──▶ DD-017 (MCP)
    │         │
    │         └──▶ DD-009 (Checkpointing)
    │
    ├──▶ DD-005 (Session Logs)
    │
    ├──▶ DD-006 (Config Parser) ──▶ DD-018 (Agent Skills)
    │
    ├──▶ DD-007 (Baseline Storage)
    │
    ├──▶ DD-008 (Global Learnings)
    │
    ├──▶ DD-010 (CLI Framework) ──▶ DD-011 (Output Format)
    │
    ├──▶ DD-012 (Testing Strategy)
    │
    ├──▶ DD-014 (Secret Detection)
    │
    ├──▶ DD-015 (Credentials)
    │
    ├──▶ DD-016 (Git Integration)
    │
    └──▶ DD-019 (Distribution)

DD-002 (Agentic Framework)
    │
    └──▶ DD-013 (Evaluation Framework)
```

---

## Prioritized Research Order

Based on dependencies and risk, recommended research order:

### Phase 1: Foundation (Blocks Everything)
1. **DD-001**: Runtime Platform and Language
2. **DD-002**: Agentic Framework Strategy
3. **DD-003**: LLM Provider Abstraction

### Phase 2: Core Capabilities
4. **DD-004**: Tool Definition Pattern
5. **DD-005**: Session Log Processing
6. **DD-006**: Configuration Parser Design
7. **DD-007**: Baseline Storage

### Phase 3: Supporting Infrastructure
8. **DD-010**: CLI Framework
9. **DD-012**: Testing Strategy
10. **DD-015**: Credential Management
11. **DD-016**: Git Integration

### Phase 4: Quality and Polish
12. **DD-008**: Global Learnings
13. **DD-009**: Session State/Checkpointing
14. **DD-011**: Output Format
15. **DD-013**: Evaluation Framework
16. **DD-014**: Secret Detection

### Phase 5: Future-Proofing
17. **DD-017**: MCP Integration
18. **DD-018**: Agent Skills Integration
19. **DD-019**: Distribution Strategy

---

## ADR Process

Each decision will follow the ADR process:

1. **Research**: Investigate options thoroughly
2. **Prototype**: Build minimal proofs-of-concept where valuable
3. **Document**: Write ADR with context, options, decision, consequences
4. **Review**: Validate against constitution principles
5. **Ratify**: Approve and record in ADR registry

ADR template and examples can be found in `.specify/templates/` (when created).

---

## References

- agentlint Constitution v1.2.0
- agentlint Conceptual Architecture v1.0.0
- agentlint Architecture Vision v0.3
- Functional Requirements document
- Non-Functional Requirements document

---

*This document will be updated as decisions are researched and resolved. Each resolved decision will reference its corresponding ADR.*
