# EP04: CLI Interface & Commands

> Implement the command-line interface with Ink + Commander.js for all agentlint commands.

## Classification

| Attribute | Value |
|-----------|-------|
| **Type** | Business |
| **Priority** | P1-High |
| **Size** | M |
| **Estimated Duration** | 4 weeks |
| **Target Stories** | 8-10 stories |

## Business Outcome Hypothesis

**If** we implement an intuitive CLI with streaming output, progress indicators, and multiple output formats,
**Then** developers can effectively interact with agentlint for all analysis workflows,
**Measured by** successful command execution, user comprehension of output, and format flexibility.

## Scope Definition

### In Scope

- [ ] Set up Ink for React-based terminal UI
- [ ] Integrate Commander.js for command parsing
- [ ] Implement core commands: `scan`, `analyse`, `baseline`, `compare`, `recommend`, `trace`, `validate`
- [ ] Add global flags: `--format`, `--verbose`, `--sessions`, `--compare`
- [ ] Create streaming output components for long-running operations
- [ ] Implement progress indicators showing current phase
- [ ] Add terminal-friendly output (80-120 char width)
- [ ] Create JSON output format for tooling integration
- [ ] Create Markdown output format for documentation
- [ ] Add causal tree visualization for trace output

### Out of Scope

- Actual analysis logic (EP05-EP10)
- Agent orchestration (EP02)
- Storage operations (EP03)

### Minimum Viable Product (MVP)

The minimum deliverable that proves the hypothesis:

- `agentlint scan` command parses and outputs to terminal
- `agentlint --version` and `--help` work correctly
- Streaming output shows progress for mock long-running operation

**MVP validates:** CLI framework supports real command implementations

## Arc42 Traceability

| Source | References |
|--------|------------|
| **Building Blocks** | CLI Interface Layer (Commands, Output Formatting) |
| **Runtime Scenarios** | All scenarios begin with CLI command |
| **Quality Requirements** | QS-5 (<10s static analysis), streaming output |
| **Crosscutting Concepts** | 8.6 Logging & Observability (user output via Ink) |
| **ADRs** | ADR-0003 (CLI Framework), ADR-0004 (Output Rendering) |

## Requirements Traceability

| Source | References |
|--------|------------|
| **Personas** | Persona 1 (Optimizer) - clear CLI, actionable output |
| **Use Cases** | FR-9 (CLI Interface) |
| **Requirements** | NFR-5 (Usability), NFR-1.3 (User Feedback During Long Sessions) |

## Dependencies

### Blocked By (Cannot Start Without)

| Epic | Dependency Type | What's Needed |
|------|-----------------|---------------|
| EP01 | Hard | Project structure, Ink/Commander.js dependencies |
| EP02 | Hard | Agent execution entry point to invoke from commands |

### Blocks (Other Epics Waiting On This)

| Epic | Dependency Type | What This Provides |
|------|-----------------|-------------------|
| All | Soft | User-facing interface for all features |

### External Dependencies

| System/Team | Dependency | Status |
|-------------|------------|--------|
| Ink | React-based terminal UI | Available |
| Commander.js | Command parsing | Available |

## Technical Considerations

### Key Decisions

- Ink for React-based components (not inquirer/prompts)
- Commander.js for argument parsing (familiar API)
- Streaming by default for long operations
- Exit codes follow Unix conventions (0=success, 1=error)

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Ink rendering issues in different terminals | Low | Medium | Test across common terminals |
| Progress indicator UX unclear | Medium | Low | User testing, iterate on design |

### Spikes Needed

- [ ] Prototype streaming output with Ink
- [ ] Test JSON/Markdown output parsers

### Constitution Alignment

- **IX. Agent-Aware**: CLI invokes agent, shows agent reasoning
- **III. Causal-First**: Trace command surfaces causal chains visually

## Acceptance Criteria (High-Level)

### Functional

- [ ] All core commands parse arguments correctly
- [ ] `--help` shows usage for all commands
- [ ] `--version` shows agentlint version
- [ ] `--format json` outputs valid JSON
- [ ] `--format markdown` outputs valid Markdown
- [ ] Progress indicators update during long operations
- [ ] Streaming output shows findings as discovered
- [ ] Causal tree visualizes issue → origin → prevention

### Non-Functional

- [ ] Output readable in 80-120 character terminals
- [ ] Command startup < 100ms (before agent invocation)
- [ ] Exit codes follow conventions (0, 1)

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] Code reviewed and merged
- [ ] Tests written and passing (unit, integration)
- [ ] Documentation updated (command reference)
- [ ] Deployed to staging environment
- [ ] Product owner sign-off

## Speckit Handoff Notes

> Guidance for `/speckit.specify` phase

### Primary Focus

- **Persona**: Persona 1 (The Optimizer)
- **Workflow**: User runs command → sees progress → receives results
- **Outcome**: Clear, actionable CLI experience

### Constraints to Encode

From ADRs:
- ADR-0003: Ink + Commander.js
- ADR-0004: Custom causal tree rendering

From Constitution:
- III. Causal-First: Visual representation of causal chains

### Key Scenarios to Specify

1. Run `agentlint analyse` with streaming output
2. Run `agentlint trace <issue>` with causal tree
3. Export results to JSON for tooling
4. Verbose mode shows agent tool invocations

### Tech Stack Notes (for `/speckit.plan`)

- Ink v4.x for terminal rendering
- Commander.js for parsing
- React components for output

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-15 | Arc42 Decomposer | Initial creation from Arc42 |
