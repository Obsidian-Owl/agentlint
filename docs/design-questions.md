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

Questions are resolved through research, prototyping, and stakeholder input. Once resolved, decisions move to implementation documentation.

---

## 1. Runtime and Infrastructure

### 1.1 CLI Runtime Environment

**Question**: Which runtime should the CLI be built on?

**Options**:
| Option | Pros | Cons |
|--------|------|------|
| Bun | Fastest startup, native TypeScript, built-in SQLite | Newer ecosystem, less battle-tested |
| Node.js | Most mature, widest compatibility, largest ecosystem | Slower startup, requires build step for TypeScript |
| Deno | Strong security model, native TypeScript | Smaller ecosystem, compatibility concerns |

**Considerations**:
- CLI startup time matters for developer experience
- Ecosystem compatibility affects library choices
- Cross-platform support is required

**Current Thinking**: TBD

### 1.2 Local Storage Strategy

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

### 1.3 Configuration File Locations

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

### 1.4 Credential Storage

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

---

## 3. Extensibility

### 3.1 Plugin Architecture for AI Tools

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

### 3.2 Language Ecosystem Support

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

## 4. Output and Integration

### 4.1 Output Formats

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

### 4.2 Incremental Analysis and Caching

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

---

## 5. Product and Ecosystem

### 5.1 Pricing Model

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

### 5.2 Telemetry and Privacy

**Question**: Should anonymised usage data be collected to improve the tool?

**Considerations**:
- Local-First principle emphasises privacy
- Telemetry can improve product decisions
- User trust is paramount
- Opt-in vs opt-out implications

**Current Thinking**: TBD

### 5.3 Community and Templates

**Question**: Should there be a public repository of configuration templates and best practices?

**Considerations**:
- Community contributions can accelerate adoption
- Maintenance burden
- Quality control
- Could be separate from core tool

**Current Thinking**: TBD

---

## 6. Technical Research Needed

### 6.1 Session Log Accessibility

| AI Tool | Log Accessibility | Format | Notes |
|---------|------------------|--------|-------|
| Claude Code | ✅ Available | JSONL | ~/.claude/projects/ |
| Cursor | ❓ Unknown | Unknown | Needs research |
| GitHub Copilot | ❌ Not exposed | N/A | May need git-based inference |
| Codex | ❓ Unknown | Unknown | Needs research |
| Gemini Code Assist | ❓ Unknown | Unknown | Needs research |

**Research needed**: Document log formats and accessibility for each tool.

### 6.2 MCP Integration

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

### 6.3 IDE Integration

**Question**: Should there be VS Code / Cursor / JetBrains extensions?

**Considerations**:
- CLI-first is an MVP non-goal
- Extensions could provide better UX
- Development and maintenance burden
- Could be community-contributed

**Current Thinking**: Post-MVP consideration

---

## 7. Phased Development Approach

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

## 8. Decision Log

Resolved decisions are logged here with rationale.

| Decision | Date | Choice | Rationale |
|----------|------|--------|-----------|
| *None yet* | - | - | - |

---

## 9. Next Steps

1. **Research**: Investigate session log formats for Cursor, Copilot, etc.
2. **Prototype**: Build minimal static analysis for Claude Code config
3. **Validate**: Test with real projects to validate analysis approach
4. **Decide**: Resolve runtime and storage questions based on prototyping

---

*This document is a living artifact. Questions are added as they arise and resolved through research and prototyping.*
