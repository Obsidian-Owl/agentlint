<!--
SYNC IMPACT REPORT
==================
Version change: 1.2.0 → 1.2.1 (PATCH - clarification)

Previous changes (1.2.0):
- Added IX. Agent-Aware principle (CCA research learnings)

Current changes (1.2.1):
- Clarified VII. Static-First principle: "first" means preference, not temporal ordering
- Added clarification that static and agentic analysis run concurrently (per ADR-0019 deep research pattern)
- Added compliance check: "Static and agentic tracks run concurrently, not sequentially"

Modified sections:
- VII. Static-First: Added Clarification subsection explaining concurrent execution model

Templates requiring updates:
- ADRs already updated: ADR-0006, ADR-0011, ADR-0019 aligned with this clarification

Follow-up TODOs: None - clarification aligns existing ADR decisions
-->

# agentlint Constitution

> Governing principles for agentlint development. This constitution supersedes all other guidance when conflicts arise.

## Core Principles

### I. Local-First

All analysis MUST run on the user's machine. No data leaves the user's environment unless explicitly configured by the user. Users provide their own LLM API credentials.

**Rationale**: Privacy and trust are foundational. Developers must control their data.

**Compliance checks**:
- No network calls without explicit user opt-in
- No telemetry without consent
- LLM calls use user-provided credentials only

### II. Improvement-Oriented

Every feature MUST support the continuous improvement cycle: BASELINE → CHANGE → OBSERVE → UNDERSTAND → REFINE. Prefer capabilities that compound value over time to one-shot utilities. Baseline tracking and historical comparison are core, not afterthoughts.

**Rationale**: agentlint's value proposition is continuous improvement, not point-in-time diagnostics.

**Compliance checks**:
- New features must explain how they support recurring analysis
- Historical data persistence is mandatory for metrics/signals
- One-shot utilities require justification

### III. Causal-First

Don't just detect issues—trace them to their origin and recommend prevention. Every detected issue SHOULD link back to a session, prompt, or config gap. Recommendations MUST be preventive (stop recurrence) not just symptomatic (fix immediate problem).

**Rationale**: Preventive recommendations compound value. Each one makes future AI sessions better.

**Compliance checks**:
- Issue detection includes origin tracing where session/git data is available
- Recommendations explain WHY (traced cause) not just WHAT (symptom)
- Preventive recommendations are prioritised over symptomatic fixes

### IV. Mixed-Methods

Combine quantitative signals with qualitative assessment. Neither alone tells the full story. Value exploratory analysis alongside structured metrics. Embrace uncertainty—AI-assisted development is an evolving practice.

**Rationale**: Quantitative signals provide anchors; qualitative assessment reveals *why* things work.

**Compliance checks**:
- Analysis outputs include both quantitative and qualitative components where applicable
- Avoid false precision—acknowledge uncertainty in evolving domains
- Support correlation of signals across types (meta-inferences)

### V. Language-Agnostic

The tool MUST effectively analyse projects regardless of programming language—TypeScript, Python, Go, Rust, Java, and others. Language-specific features degrade gracefully for unsupported languages.

**Rationale**: AI coding assistants are used across all languages. agentlint must follow.

**Compliance checks**:
- Core analysis works without language-specific tooling
- Language-specific features are opt-in enhancements
- No hard dependencies on single-language ecosystems

### VI. Tool-Agnostic

While initially focused on Claude Code, the architecture MUST support analysis of any AI coding assistant through an adapter pattern. No AI tool is privileged in the core design.

**Rationale**: Developers use multiple AI tools. Unified analysis across tools is a key differentiator.

**Compliance checks**:
- Core analysis logic is tool-independent
- Tool-specific code lives in adapters only
- Adding a new AI tool requires only adapter implementation

### VII. Static-First

Prefer deterministic static analysis over LLM-based analysis where possible. Use LLMs only where semantic understanding is genuinely required. Static analysis is fast, cheap, reproducible, and privacy-preserving.

**Rationale**: LLM calls are expensive, slow, and non-deterministic. Static analysis provides reliable baseline.

**Clarification**: "Static-First" means **preference**, not **temporal ordering**. Per the deep research pattern (ADR-0019), static and agentic analysis run **concurrently** for maximum throughput. Static-First ensures:
1. Static analysis always runs (with or without LLM)
2. Results are available even if LLM fails (graceful degradation)
3. LLM is reserved for semantic tasks that require it

**Compliance checks**:
- Every analysis task must justify LLM usage if static alternatives exist
- Static analysis results are cached aggressively
- LLM-enhanced features work (with reduced capability) when LLM is unavailable
- Static and agentic tracks run concurrently, not sequentially (see ADR-0011)

### VIII. Progressive Value

Provide useful insights even without LLM configuration. LLM integration enhances analysis but MUST NOT be required for basic functionality.

**Rationale**: Lower barrier to entry. Users should see value immediately.

**Compliance checks**:
- CLI works without any LLM configuration
- Static-only mode produces actionable output
- LLM features are clearly marked as enhancements

### IX. Agent-Aware

The agentlint agent is a first-class stakeholder with its own cognitive needs. We "eat our own dog food"—our analysis agents MUST embody the AX principles we recommend to users. Features should consider how they affect the agent's ability to reason effectively.

**Rationale**: agentlint's effectiveness depends on how well we serve our own agent's cognitive experience. By optimizing for our agent, we validate the principles we measure in target repositories.

**Compliance checks**:
- Large inputs (session logs, codebases) are compressed before LLM analysis
- Agent context is hierarchically structured (task goal, project context, findings)
- AX/UX separation: agent sees compressed summaries; users see rich reports
- Working memory preserves critical info (task goals, errors, decisions)
- Design decisions reference impact on agent cognitive experience

## Analysis Domains

agentlint analyses eight interconnected areas. All features MUST map to one or more of these domains:

1. **AI Assistant Configuration** - Config files controlling AI assistant behaviour
2. **AI Session Effectiveness** - Session logs and usage patterns
3. **Repository Structure** - Codebase organisation and discoverability
4. **Developer Tooling** - Type systems, linters, formatters, LSP
5. **DevSecOps Controls** - CI/CD, pre-commit hooks, quality gates
6. **Documentation Quality** - README, docs, llms.txt, AGENTS.md
7. **Code Patterns** - Type coverage, function size, style consistency
8. **Cross-Cutting Concerns** - Multi-tool conflicts, drift detection, AI-readiness

## Development Constraints

### MVP Non-Goals

The following are explicitly OUT OF SCOPE for MVP:

- **No Web Dashboard** - CLI only
- **No SaaS Backend** - Local-first means local-only
- **No Real-Time Analysis** - Post-hoc analysis of completed sessions only
- **No Enterprise Governance** - No team management, audit trails, or compliance
- **No IDE Plugins** - CLI-first; editor integrations are future work
- **No Cross-Machine Sync** - History stays local

### Technical Boundaries

- Primary runtime: Bun (TypeScript) - confirmed via [ADR-0001](../docs/architecture/adr/0001-language-and-runtime-selection.md)
- MVP language support: TypeScript/JavaScript, Python, Go
- MVP AI tool support: Claude Code only (adapter pattern enables future tools)
- Storage: SQLite (Bun built-in) with FTS5 - confirmed via [ADR-0003](../docs/architecture/adr/0003-local-storage-strategy.md)

## Governance

### Amendment Process

1. Proposed amendments MUST be documented with rationale
2. Amendments require review of all dependent templates (listed below)
3. Version increment follows semantic versioning:
   - MAJOR: Principle removal/redefinition, backward-incompatible changes
   - MINOR: New principle/section, material expansion
   - PATCH: Clarifications, typos, non-semantic refinements

### Dependent Artifacts

Changes to this constitution MUST trigger review of:

- `.specify/templates/plan-template.md` (Constitution Check section)
- `.specify/templates/spec-template.md` (requirements alignment)
- `.specify/templates/tasks-template.md` (task categorisation)
- `docs/north-star.md` (principle alignment)
- `docs/agentlint-architecture-vision.md` (design principle alignment)

### Compliance Review

All PRs MUST verify compliance with applicable principles. The Constitution Check in plan-template.md gates implementation work.

**Version**: 1.2.1 | **Ratified**: 2026-01-11 | **Last Amended**: 2026-01-13
