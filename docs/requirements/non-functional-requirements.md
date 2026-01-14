# Non-Functional Requirements

> Derived from architecture vision and design principles (January 2026)

---

## NFR-1: Performance & User Experience

**Philosophy**: agentlint performs deep agentic analysis. Sessions of 30+ minutes are expected for thorough analysis of large codebases, extensive session histories, or complex repositories. Speed is not prioritized over depth.

### NFR-1.1: Static Analysis Layer (Fast)
- NFR-1.1.1: Configuration detection completes in <10 seconds
- NFR-1.1.2: Session log indexing handles files up to 500MB
- NFR-1.1.3: Metrics extraction parallelizable across sessions
- NFR-1.1.4: Incremental indexing for unchanged logs (caching)

### NFR-1.2: Agentic Analysis Layer (Thorough)
- NFR-1.2.1: Deep analysis sessions may run 30+ minutes for complex analysis
- NFR-1.2.2: Progressive output: User sees findings as they're discovered
- NFR-1.2.3: Checkpointing: Analysis state saved after each major phase
- NFR-1.2.4: Resumability: Interrupted sessions can resume from last checkpoint
- NFR-1.2.5: Pause/resume: User can pause analysis for review, then continue

### NFR-1.3: User Feedback During Long Sessions
- NFR-1.3.1: Streaming output for real-time visibility into agent reasoning
- NFR-1.3.2: Progress indicators showing current phase and estimated progress
- NFR-1.3.3: Intermediate findings surfaced before final report
- NFR-1.3.4: Human-in-the-loop interrupts for complex decisions

---

## NFR-2: Privacy and Security

- NFR-2.1: All analysis runs locally on user's machine (local-first)
- NFR-2.2: No data transmitted to external services without explicit user consent
- NFR-2.3: User provides own LLM API credentials
- NFR-2.4: Secrets and credentials detected but never stored or logged
- NFR-2.5: Local storage uses appropriate file permissions
- NFR-2.6: Sensitive paths and patterns are configurable

---

## NFR-3: Extensibility

- NFR-3.1: ACT adapters follow plugin architecture
- NFR-3.2: New ACT support addable without core changes
- NFR-3.3: Analysis rules are configurable and extensible
- NFR-3.4: Output formats are pluggable
- NFR-3.5: Static analysis tools are modular

---

## NFR-4: Reliability

- NFR-4.1: Graceful degradation when optional files missing
- NFR-4.2: Consistent results for unchanged inputs (deterministic static analysis)
- NFR-4.3: Clear error messages with remediation guidance
- NFR-4.4: Transaction-safe baseline storage (atomic writes)
- NFR-4.5: Recovery from interrupted analysis sessions

---

## NFR-5: Usability

- NFR-5.1: CLI follows standard conventions (--help, --version, exit codes)
- NFR-5.2: Commands are discoverable and well-documented
- NFR-5.3: Output is readable in standard terminal widths (80-120 chars)
- NFR-5.4: Progress indicators for long-running operations
- NFR-5.5: Sensible defaults that work without configuration

---

## NFR-6: Compatibility

- NFR-6.1: Works on macOS, Linux, Windows
- NFR-6.2: Supports Node.js LTS versions (20.x, 22.x)
- NFR-6.3: Works with major git hosting platforms
- NFR-6.4: Handles monorepo structures
- NFR-6.5: Works with or without git repository present

---

## NFR-7: Maintainability

- NFR-7.1: Codebase follows consistent coding standards
- NFR-7.2: Test coverage >80% for core functionality
- NFR-7.3: Documentation maintained alongside code
- NFR-7.4: Clear separation between static tools and agentic layer

---

## Rationale for Key Decisions

### Why 30+ Minute Sessions Are Expected

Research into production AI agent systems reveals:
- Complex causal analysis requires deep semantic reasoning
- Large session log histories (100K+ messages) need thorough examination
- Quality judgments about AI conversations cannot be rushed
- Checkpointing and resumability mitigate the risk of long sessions

### Why Local-First Is Non-Negotiable

- Session logs contain sensitive project information
- Configuration files may include credentials (which we detect but don't transmit)
- Users maintain full control over their data
- Enterprise adoption requires data sovereignty

### Why Progressive Output Matters

For sessions exceeding 10 minutes:
- Users need visibility into agent progress
- Intermediate findings allow early course correction
- Streaming output reduces perceived wait time
- Human-in-the-loop enables collaborative analysis

---

## Traceability to Design Principles

| NFR Category | Design Principle |
|--------------|------------------|
| NFR-1 (Performance) | Principle 7: Intelligent Tooling |
| NFR-2 (Privacy) | Principle 1: Local-First |
| NFR-3 (Extensibility) | Principle 6: Agent-Agnostic |
| NFR-4 (Reliability) | Principle 8: Compounding Value |
| NFR-5 (Usability) | Principle 9: Agent-Aware |
| NFR-6 (Compatibility) | Principle 5: Language-Agnostic |
| NFR-7 (Maintainability) | Principle 2: Improvement-Oriented |
