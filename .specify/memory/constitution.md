<!--
SYNC IMPACT REPORT
==================
Version change: 1.4.0 → 1.5.0 (MINOR - principle rename for clarity)

Previous changes (1.3.0):
- Established agentlint as an agentic application
- Added Architectural Foundation section
- Added LLM as technical requirement

Current changes (1.5.0):
- RENAMED "Progressive Value" (VIII) to "Compounding Value" - eliminates confusion with progressive enhancement/degradation patterns
- The principle meaning is unchanged: value compounds TEMPORALLY through baselines

Previous changes (1.4.0):
- REMOVED "Static-First" principle (VII) - it biased design incorrectly
- ADDED "Intelligent Tooling" principle (VII) - tools serve the agent's cognitive needs
- Updated Architectural Foundation to emphasize agent flexibility
- Agent has full autonomy to choose between tool use and direct reasoning

Modified sections:
- Architectural Foundation: Removed static tool preference, added flexibility emphasis
- VII: Completely replaced Static-First with Intelligent Tooling
- Compliance checks: New checks for tool/reasoning flexibility

Templates requiring updates:
- ADR-0006: Remove static-first bias, emphasize agent flexibility
- ADR-0011: Remove static-first language
- Architecture Vision: Update S4, S5, principles
- North Star: Update principle 7, decision framework
-->

# agentlint Constitution

> Governing principles for agentlint development. This constitution supersedes all other guidance when conflicts arise.

## Architectural Foundation

**agentlint IS an agentic application.** An LLM-powered agent orchestrates all analysis with full autonomy to choose its approach. This is not a traditional CLI with an optional "agentic enhancement"—the agent is the core of the system.

```
Developer → CLI → Analysis Agent (LLM) → [Tools | Direct Reasoning | File Analysis] → Report
                        ↓
              Agent decides freely:
              • What approach to use (tool vs. reasoning vs. reading)
              • When to gather data vs. when to reason deeply
              • How to understand meaning, causality, and quality
              • What recommendations to make
```

**Key architectural implications**:
- **LLM is required**: agentlint requires an LLM to function. The agent cannot reason without it.
- **Agent has full flexibility**: The agent chooses between tool invocation, direct file analysis, and semantic reasoning based on what the task requires—no approach is privileged.
- **Tools serve the agent**: Tools exist to support the agent's cognitive needs (understanding config, structure, sessions), not to replace its reasoning.
- **Deep understanding is first-class**: The agent can and should reason deeply about WHY things happened, not just extract WHAT happened.

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

### VII. Intelligent Tooling

Tools exist to serve the agent's cognitive needs. The agent chooses freely between tool use and direct reasoning based on what the task requires—no approach is privileged.

**Rationale**: Effective agents like Claude Code are hyper-flexible, choosing their approach based on the task. Tools support understanding; the agent provides understanding. Neither replaces the other.

**What tools provide**:
- Fast, deterministic data gathering when appropriate
- Structured extraction of configuration, metrics, history
- Specialized analysis (e.g., Skills folder structure, config patterns)

**What agent reasoning provides**:
- Understanding WHY things happened (not just WHAT)
- Quality judgments (was this a good agentic flow? error ≠ bad)
- Causal analysis (what led to this outcome?)
- Semantic understanding of intent and context

**Example**: Session log analysis
- Tools CAN: Parse logs, extract metadata, identify errors, tag positions
- Tools CANNOT: Understand why errors occurred, evaluate flow quality, reason about whether better Skills would have helped
- The agent uses BOTH tools AND reasoning to produce complete understanding

**Compliance checks**:
- Tools are designed to support agent understanding, not replace it
- The agent has full flexibility to choose its approach
- No language biases toward "preferring" one approach over another
- Deep semantic analysis is treated as first-class, not "reserved"

### VIII. Compounding Value

Value compounds over time through baselines and trend analysis. Each analysis builds on previous findings, making recommendations increasingly contextual and actionable. The continuous improvement cycle (BASELINE → CHANGE → OBSERVE → UNDERSTAND → REFINE) creates compounding value that point-in-time tools cannot match.

**Rationale**: agentlint's differentiation is continuous improvement, not one-shot analysis. Historical context makes every recommendation more valuable.

**Compliance checks**:
- Analysis persists findings for future comparison
- Recommendations reference historical patterns where available
- Baseline tracking enables trend detection
- First-run experience establishes initial baseline for future comparison

### IX. Agent-Aware

The agentlint agent IS the core of the system—not an enhancement. We "eat our own dog food": our analysis agent MUST embody the AX principles we recommend to users. The agent's cognitive experience directly determines agentlint's effectiveness.

**Rationale**: agentlint is an agentic application. The agent orchestrates analysis, invokes tools, and synthesizes findings. By optimizing for our agent's needs, we validate the principles we measure in target repositories.

**Compliance checks**:
- Large inputs (session logs, codebases) are compressed before agent processing
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

- **LLM Required**: agentlint requires an LLM to function (user provides API credentials)
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

**Version**: 1.5.0 | **Ratified**: 2026-01-11 | **Last Amended**: 2026-01-13
