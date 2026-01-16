# Feature Specification: CLI Interface & Commands

> **Epic**: EP04
> **Created**: 2026-01-16
> **Status**: Draft
> **Author**: Claude

---

## 1. Overview

Implement the command-line interface for agentlint using Ink (React-based terminal UI) and Commander.js for argument parsing. This provides the user-facing entry point for all analysis workflows with streaming output, progress indicators, and multiple output formats (terminal, JSON, Markdown).

### 1.1 Business Context

The CLI is the primary interface through which developers interact with agentlint. It invokes the orchestration layer (EP02) to run analysis sessions and presents results using rich terminal UI. This epic enables all subsequent analysis features (EP05-EP10) to be accessible to users.

**Business Hypothesis**: If we implement an intuitive CLI with streaming output, progress indicators, and multiple output formats, then developers can effectively interact with agentlint for all analysis workflows.

### 1.2 Out of Scope

- Actual analysis logic (EP05-EP10 provide the tools)
- Agent orchestration internals (EP02 provides this)
- Storage operations (EP03 provides persistence)
- Interactive prompts requiring user input mid-session (Bun/Ink compatibility issue)
- `--watch` mode for continuous analysis (deferred to future epic)

---

## 2. User Scenarios & Testing

> User stories are prioritized: P1 (must-have), P2 (should-have), P3 (nice-to-have)

### US-001 [P1]: Run Analysis with Streaming Output

**As a** developer using agentlint,
**I want** to run `agentlint analyse` and see real-time progress,
**So that** I know the analysis is progressing and can see findings as they're discovered.

**Acceptance Criteria:**
- [ ] Given I run `agentlint analyse`, when the analysis starts, then I see a spinner with current phase
- [ ] Given analysis is running, when a finding is discovered, then it appears immediately in the output
- [ ] Given analysis completes, when all phases finish, then I see a summary with total findings and recommendations

**Test Scenarios:**
- Happy path: Analysis runs, findings stream to terminal, summary displayed
- Error case: Analysis fails mid-way, error message shown with partial results
- Edge case: No findings discovered, success message with "0 findings" shown

---

### US-002 [P1]: Get Help and Version Information

**As a** developer new to agentlint,
**I want** to see help text and version information,
**So that** I can understand available commands and verify my installation.

**Acceptance Criteria:**
- [ ] Given I run `agentlint --help`, then I see a list of all commands with descriptions
- [ ] Given I run `agentlint <command> --help`, then I see detailed help for that command
- [ ] Given I run `agentlint --version`, then I see the current version number

**Test Scenarios:**
- Happy path: Help displays all commands with examples
- Happy path: Version displays semver format (e.g., "1.0.0")

---

### US-003 [P1]: Export Results to JSON

**As a** developer integrating agentlint into CI/CD,
**I want** to export analysis results as JSON,
**So that** I can parse results programmatically and fail builds on findings.

**Acceptance Criteria:**
- [ ] Given I run `agentlint analyse --json`, then output is valid JSON (or JSON Lines for streaming)
- [ ] Given JSON output, when piped to jq, then it parses without errors
- [ ] Given non-TTY output (piped), then JSON format is used by default

**Test Scenarios:**
- Happy path: `agentlint analyse --json | jq .` succeeds
- Streaming: JSON Lines format with one object per line during analysis
- CI integration: Exit code 1 when findings with severity >= high

---

### US-004 [P1]: Scan for AI Configurations

**As a** developer setting up agentlint,
**I want** to run `agentlint scan` to discover AI configurations,
**So that** I can see what configuration files exist before running full analysis.

**Acceptance Criteria:**
- [ ] Given I run `agentlint scan`, when configs exist, then I see a list of discovered files
- [ ] Given I run `agentlint scan`, when no configs exist, then I see a helpful message about creating one
- [ ] Given multiple ACT types (Claude Code, Cursor, etc.), then each is identified by type

**Test Scenarios:**
- Happy path: CLAUDE.md found, displayed with path and type
- Multiple configs: .cursorrules and CLAUDE.md both listed
- No configs: Helpful message suggesting configuration setup

---

### US-005 [P2]: Trace Issue to Origin

**As a** developer investigating a finding,
**I want** to run `agentlint trace <finding-id>` to see the causal chain,
**So that** I can understand why an issue occurred and how to prevent it.

**Acceptance Criteria:**
- [ ] Given a finding ID, when I run trace, then I see a tree visualization of the causal chain
- [ ] Given the causal tree, then it shows: issue → origin → root cause → recommendation
- [ ] Given `--json` flag, then the causal chain is output as structured JSON

**Test Scenarios:**
- Happy path: Tree displays with box-drawing characters (├──, └──, │)
- JSON output: Causal chain as nested JSON structure
- Invalid ID: Error message "Finding not found: <id>"

---

### US-006 [P2]: Compare Against Baseline

**As a** developer tracking improvement,
**I want** to run `agentlint compare` to see changes since baseline,
**So that** I can verify my configurations are improving over time.

**Acceptance Criteria:**
- [ ] Given a baseline exists, when I run compare, then I see delta metrics (new findings, resolved)
- [ ] Given metrics improved, then I see positive indicators (green, ↓ counts)
- [ ] Given metrics worsened, then I see negative indicators (red, ↑ counts)

**Test Scenarios:**
- Happy path: Baseline exists, delta shown with +/- indicators
- No baseline: Error message suggesting `agentlint baseline` first
- Same as baseline: "No changes since baseline" message

---

### US-007 [P2]: Export Results to Markdown

**As a** developer creating documentation,
**I want** to export analysis results as Markdown,
**So that** I can include reports in GitHub issues or documentation.

**Acceptance Criteria:**
- [ ] Given I run `agentlint analyse --markdown`, then output is valid Markdown
- [ ] Given Markdown output, then it includes summary, findings table, and recommendations
- [ ] Given causal traces, then they render as nested lists in Markdown

**Test Scenarios:**
- Happy path: Markdown renders correctly in GitHub preview
- With findings: Table format with severity, description, location
- No findings: Summary showing "0 findings" with success message

---

### US-008 [P3]: Verbose Mode for Debugging

**As a** developer debugging analysis issues,
**I want** to run with `--verbose` to see agent tool invocations,
**So that** I can understand what the agent is doing internally.

**Acceptance Criteria:**
- [ ] Given `--verbose` flag, then I see each tool call made by the agent
- [ ] Given verbose output, then tool parameters and timing are shown
- [ ] Given an error, then verbose mode shows full stack trace

**Test Scenarios:**
- Happy path: Tool calls displayed with "> Calling: readFile(...)"
- Timing: Each tool shows duration "readFile completed (120ms)"
- Error: Stack trace visible in verbose mode only

---

### US-009 [P3]: Manage Learnings

**As a** developer curating learnings,
**I want** to run `agentlint learn` commands to manage learnings,
**So that** I can add, list, and promote learnings between scopes.

**Acceptance Criteria:**
- [ ] Given I run `agentlint learn list`, then I see stored learnings
- [ ] Given I run `agentlint learn add`, then a new learning is created
- [ ] Given I run `agentlint learn promote <id>`, then learning moves to global scope

**Test Scenarios:**
- List: Table of learnings with ID, title, category, scope
- Add: Interactive or flag-based learning creation
- Promote: Confirmation of scope change from project to global

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | Parse all commands using Commander.js: scan, analyse, baseline, compare, recommend, trace, validate, learn | P1 | US-001, US-004 |
| FR-002 | Display help text for all commands via `--help` flag | P1 | US-002 |
| FR-003 | Display version via `--version` flag | P1 | US-002 |
| FR-004 | Output valid JSON when `--json` flag is provided | P1 | US-003 |
| FR-005 | Stream findings to terminal as they are discovered | P1 | US-001 |
| FR-006 | Show progress spinner during long-running phases | P1 | US-001 |
| FR-007 | Render causal chain as ASCII tree visualization | P2 | US-005 |
| FR-008 | Output valid Markdown when `--markdown` flag is provided | P2 | US-007 |
| FR-009 | Show delta metrics with visual indicators in compare output | P2 | US-006 |
| FR-010 | Display verbose tool invocation details when `--verbose` flag is set | P3 | US-008 |
| FR-011 | Manage learnings via learn subcommands (list, add, promote) | P3 | US-009 |
| FR-012 | Default to JSON output when stdout is not a TTY (piped) | P1 | US-003 |
| FR-013 | Support `--plain` flag for minimal text output | P2 | - |
| FR-014 | Respect NO_COLOR environment variable | P2 | - |
| FR-015 | Default `analyse` to full analysis (config + sessions); support `--config-only` and `--sessions-only` flags to narrow scope | P1 | US-001 |
| FR-016 | Support `--fail-on-findings` flag to exit 1 when findings present (for CI integration) | P1 | US-003 |
| FR-017 | `learn add` command accepts `--title`, `--content`, `--category` flags (no editor) | P3 | US-009 |

### 3.2 Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-001 | Command startup time (before agent invocation) | Time to first output | < 100ms |
| NFR-002 | Terminal width compatibility | Readable output | 80-120 characters |
| NFR-003 | Exit code conventions | Unix standard | 0=success (even with findings), 1=error; --fail-on-findings changes to 1 on findings |
| NFR-004 | Memory usage during streaming | Peak memory | < 100MB for typical session |
| NFR-005 | Color accessibility | ANSI standard | Use only 16 ANSI 4-bit colors |

---

## 4. Key Entities

> Define the core domain entities this feature introduces or modifies

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| Command | A CLI command (scan, analyse, etc.) | name, options, action, help |
| OutputFormat | Rendering mode for results | terminal, json, markdown, plain |
| ProgressState | Current analysis progress | phase, percent, message |
| Finding | An issue discovered during analysis | id, severity, description, location |
| CausalTree | Tree structure for trace visualization | issue, originChain, recommendation |

### 4.1 Entity Relationships

```
Command --1:1--> OutputFormat (determines rendering)
Command --1:N--> Finding (produces findings)
Finding --1:1--> CausalTree (has trace)
ProgressState --N:1--> Command (tracks execution)
```

---

## 5. Success Criteria

> How do we know this feature is successful? Define measurable outcomes.

- [ ] **Functional**: All P1 user stories pass acceptance criteria
- [ ] **Quality**: Test coverage > 80% for CLI components
- [ ] **Performance**: Command startup < 100ms (NFR-001)
- [ ] **Compatibility**: Output renders correctly in bash, zsh, fish, PowerShell
- [ ] **Integration**: `agentlint analyse --json | jq .` succeeds
- [ ] **MVP Gate**: `agentlint scan` and `agentlint analyse` produce meaningful output with streaming

---

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior | Priority |
|----------|-------------------|----------|
| No AI configuration files found | Display helpful message with setup instructions | P1 |
| Analysis fails mid-execution | Show error with partial results, exit code 1 | P1 |
| Invalid command or flag | Display error with suggested correction | P1 |
| Output piped (non-TTY) | Auto-switch to JSON format | P1 |
| Terminal too narrow (< 80 chars) | Graceful degradation, no horizontal scroll | P2 |
| SIGINT (Ctrl+C) during analysis | Clean shutdown, save checkpoint | P2 |
| No baseline for compare command | Clear error: "No baseline found. Run `agentlint baseline` first" | P2 |
| Invalid finding ID for trace | Error: "Finding not found: <id>" | P2 |
| Very long finding description | Truncate with "..." in terminal, full text in JSON | P3 |

---

## 7. Dependencies & Assumptions

### 7.1 Dependencies

| Dependency | Type | Status | Impact if Missing |
|------------|------|--------|-------------------|
| EP02 Orchestration Core | Internal | Complete | Cannot invoke agent analysis |
| EP03 Persistence Layer | Internal | Complete | Cannot store/retrieve baselines |
| Ink v4.x | External | Available | Terminal UI framework |
| @inkjs/ui | External | Available | UI components (Spinner, Table) |
| Commander.js | External | Available | Argument parsing |
| chalk | External | Available | Color support |

### 7.2 Assumptions

- Bun runtime handles Ink rendering correctly (known `useInput` bug is not blocking since we're output-focused)
- Users have terminals that support Unicode box-drawing characters (├──, └──, │)
- JSON Lines format is acceptable for streaming JSON output
- EP05-EP10 tools will be integrated incrementally; CLI provides the shell first

---

## 8. Open Questions

> Questions that need resolution before implementation

- [x] **Q1**: Should `agentlint analyse` require explicit flags for scope (config vs sessions), or analyze everything by default? — **RESOLVED: Analyze everything by default**
- [x] **Q2**: What exit code should be used when analysis succeeds but findings are present? — **RESOLVED: Exit 0 on success, use --fail-on-findings for CI**
- [x] **Q3**: Should we implement a `--watch` mode for continuous analysis, or defer to a future epic? — **RESOLVED: Defer to future epic**
- [x] **Q4**: For the `learn add` command, should it support inline content (`--content "..."`) or always open an editor? — **RESOLVED: Flags only (--title, --content, --category)**

---

## 9. References

- [Epic: EP04 CLI Interface & Commands](../../docs/planning/epics/EP04-cli-interface.md)
- [ADR-0003: CLI Framework and Command Structure](../../docs/architecture/adr/0003-cli-framework-and-command-structure.md)
- [ADR-0004: Output Format and Rendering](../../docs/architecture/adr/0004-output-format-and-rendering.md)
- [Ink: React for CLIs](https://github.com/vadimdemedes/ink)
- [Command Line Interface Guidelines](https://clig.dev/)

---

## Clarifications

> This section is populated by /dev.clarify

### Session 2026-01-16

**Q1: Should `agentlint analyse` require explicit flags for scope?**
A: Analyze everything by default (config + sessions). Users can narrow scope with `--config-only` or `--sessions-only` flags.

Updated: Added FR-015 in Section 3.1

**Q2: What exit code for findings present?**
A: Exit 0 on success (even with findings), exit 1 on error. Add `--fail-on-findings` flag for CI pipelines that want to fail on findings.

Updated: NFR-003 in Section 3.2, added FR-016 in Section 3.1

**Q3: Should we implement --watch mode?**
A: Defer to a future epic. Focus on core CLI functionality first; watch mode adds complexity (file watching, incremental analysis).

Updated: Added to Out of Scope in Section 1.2

**Q4: How should `learn add` work?**
A: Use flags only (`--title`, `--content`, `--category`). No editor integration to avoid Bun/Ink input compatibility issues.

Updated: Added FR-017 in Section 3.1
