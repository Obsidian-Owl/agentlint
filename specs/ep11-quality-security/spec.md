# Feature Specification: Quality & Security

> **Epic**: EP11
> **Created**: 2026-01-20
> **Status**: Draft
> **Author**: Claude Code

---

## 1. Overview

EP11 implements a comprehensive quality assurance and security foundation for agentlint, encompassing rigorous end-to-end testing, LLM-as-judge evaluation framework, secret detection, and a sophisticated debug mode for local development. This epic transforms agentlint from a functional prototype into a production-quality tool that can be confidently run against real codebases.

### 1.1 Business Context

EP11 is an Enabler epic that provides cross-cutting capabilities supporting all other epics. It addresses three critical needs:

1. **Quality Assurance**: Ensure agentlint's analysis is accurate, actionable, and valuable through systematic evaluation
2. **Security**: Detect secrets in analyzed content without ever storing or transmitting them
3. **Developer Experience**: Enable effective debugging when running agentlint locally against real projects

This epic is essential before production use—users must trust that agentlint provides accurate analysis and handles sensitive data appropriately.

### 1.2 Out of Scope

- Config analysis tools (EP05)
- Session analysis tools (EP06)
- CLI output implementation (EP04)
- Recommendation generation (EP10)
- Performance optimization (separate future work)
- Production telemetry/monitoring (requires user consent architecture)

---

## 2. User Scenarios & Testing

> User stories are prioritized: P1 (must-have), P2 (should-have), P3 (nice-to-have)

### US-001 [P1]: Debug Mode for Local Development

**As a** developer running agentlint locally on my own projects,
**I want** a comprehensive debug mode that shows what the agent is doing,
**So that** I can understand agent behavior, diagnose issues, and trust the analysis.

**Acceptance Criteria:**
- [ ] Given `DEBUG=agentlint:*` environment variable, when agentlint runs, then all internal operations are logged with timestamps
- [ ] Given `--verbose` flag, when agentlint runs, then tool invocations, LLM requests, and phase transitions are visible
- [ ] Given debug mode, when secrets are detected, then they are redacted in all log output
- [ ] Given debug mode, when an error occurs, then stack traces and context are included (with secrets redacted)
- [ ] Given `--log-file <path>`, when agentlint runs, then debug output writes to file instead of terminal
- [ ] Given `--quiet` flag, when agentlint runs, then only errors and final results are shown

**Test Scenarios:**
- Happy path: Run with `DEBUG=agentlint:*` on a sample project, verify timestamps, phases, and tool calls logged
- Error case: Trigger a parsing error in debug mode, verify stack trace includes file context
- Security: Include a secret in analyzed config, verify it's redacted in debug output
- File logging: Use `--log-file`, verify file contains expected debug content

---

### US-002 [P1]: E2E Testing Framework

**As a** agentlint maintainer,
**I want** a comprehensive end-to-end testing framework,
**So that** I can verify the complete analysis workflow works correctly against real codebases.

**Acceptance Criteria:**
- [ ] Given a test project with known issues, when agentlint runs full analysis, then expected findings are detected
- [ ] Given the agentlint codebase itself (dogfooding), when analyzed, then it should score 95%+ on quality rubrics
- [ ] Given VCR recordings exist for a workflow, when tests run in CI, then responses are replayed deterministically
- [ ] Given `VCR_MODE=record`, when tests run, then new API interactions are captured to cassettes
- [ ] Given cassettes are stale, when CI runs, then tests fail with clear error message
- [ ] Given E2E tests, when they run, then they complete in under 5 minutes (with VCR playback)

**Test Scenarios:**
- Happy path: E2E test against test fixture project with known CLAUDE.md gaps
- Dogfooding: E2E test analyzing agentlint's own CLAUDE.md and session logs
- VCR playback: Run integration tests, verify no live API calls made
- Cassette refresh: Modify prompts, run `bun run record`, verify new cassettes generated

---

### US-003 [P1]: LLM-as-Judge Evaluation Framework

**As a** agentlint maintainer,
**I want** automated evaluation of analysis quality using LLM-as-judge,
**So that** I can detect quality regressions and ensure recommendations remain actionable.

**Acceptance Criteria:**
- [ ] Given a golden dataset of CLAUDE.md files, when evaluation runs, then actionability scores are calculated
- [ ] Given analysis output, when LLM-as-judge evaluates, then causal accuracy is scored
- [ ] Given release tag trigger, when TruLens evals run, then results are persisted to `.agentlint/evals.db`
- [ ] Given evaluation scores drop below 70% threshold, when release pipeline runs, then it fails
- [ ] Given code-based checks fail (invalid output format), then LLM-as-judge is skipped
- [ ] Given evaluation results, then they include detailed reasoning for each score

**Test Scenarios:**
- Happy path: Evaluate against high-quality golden example, expect 85%+ scores
- Regression detection: Evaluate against intentionally degraded output, expect failure
- Code-based gates: Malformed output fails before LLM evaluation
- TruLens integration: Verify TruLens subprocess executes and results parse correctly

---

### US-004 [P1]: Secret Detection in Analyzed Content

**As a** security-conscious developer,
**I want** agentlint to detect potential secrets in my config files without storing them,
**So that** I'm alerted to accidental credential exposure without risking further leakage.

**Acceptance Criteria:**
- [ ] Given a CLAUDE.md with an AWS key pattern, when scanned, then it's detected as a secret candidate
- [ ] Given detected secrets, when results are returned, then actual secret values are NEVER included
- [ ] Given detected secrets, when logged (even in debug mode), then values are redacted
- [ ] Given a false positive (test API key), when LLM validates context, then it's classified as unlikely
- [ ] Given secrets in session logs, when scanned, then they're detected with file:line location
- [ ] Given detection results, when presented to user, then they're alerts, not blockers

**Test Scenarios:**
- Happy path: Detect `AWS_SECRET_ACCESS_KEY=AKIA...` pattern in test file
- Privacy: Verify secret value never appears in any output, logs, or persisted data
- False positive: Detect `api_key = "test-key-12345"` in test file, expect LLM marks as `unlikely`
- Entropy-based: High-entropy random string detected, low-entropy placeholder rejected

---

### US-005 [P2]: Session Recording & Replay

**As a** developer debugging an agentlint analysis,
**I want** session recordings that capture analysis state,
**So that** I can replay and inspect what happened during a failed analysis.

**Acceptance Criteria:**
- [ ] Given analysis runs, when checkpoint interval triggers, then state is persisted to `.agentlint/session-state/`
- [ ] Given a session ID, when `--replay <session-id>` is used, then analysis resumes from last checkpoint
- [ ] Given session recordings, when inspected, then tool calls, findings, and phase transitions are visible
- [ ] Given a crash during analysis, when agentlint restarts, then it offers to resume from checkpoint
- [ ] Given session state files, when secrets were processed, then they're redacted in persisted state

**Test Scenarios:**
- Happy path: Run analysis, verify checkpoint files created at expected intervals
- Crash recovery: Simulate crash mid-analysis, restart, verify resume works
- Inspection: Export session state, verify human-readable tool call history
- Privacy: Process file with secrets, verify session state doesn't contain secret values

---

### US-006 [P2]: Verbose Mode with Tool Invocation Visibility

**As a** developer understanding agentlint behavior,
**I want** to see exactly which tools the agent invokes,
**So that** I can understand why certain findings were made.

**Acceptance Criteria:**
- [ ] Given `--verbose`, when agent calls a tool, then tool name, arguments (redacted), and result summary are shown
- [ ] Given `--verbose`, when LLM request is made, then model, token usage, and latency are shown
- [ ] Given `--verbose`, when phase transition occurs, then new phase and reason are logged
- [ ] Given verbose output, when tool returns large result, then it's truncated with `[... truncated]`
- [ ] Given non-verbose mode, when analysis runs, then only progress indicators and final results shown

**Test Scenarios:**
- Happy path: Run with `--verbose`, verify tool invocations logged with timing
- Token tracking: Verify input/output token counts displayed for each LLM call
- Truncation: Tool returns 10KB result, verify truncated in verbose output
- Redaction: Tool argument contains file path with secret, verify redacted

---

### US-007 [P3]: Outcome Tracking for Recommendations

**As a** agentlint maintainer,
**I want** to track whether users implement recommendations,
**So that** I can measure real-world effectiveness and improve future recommendations.

**Acceptance Criteria:**
- [ ] Given `eval.collectFeedback: true` in config, when analysis completes, then user is prompted about recommendations
- [ ] Given user indicates "will implement", when tracked, then outcome record is created
- [ ] Given config changes after recommendation, when detected, then implicit implementation signal recorded
- [ ] Given outcome data collected, when aggregated, then implementation rates are calculated by recommendation type
- [ ] Given user opts out of feedback collection, then no prompts shown and no tracking occurs

**Test Scenarios:**
- Happy path: Complete analysis, receive feedback prompt, respond, verify record created
- Opt-out: Set `eval.collectFeedback: false`, verify no prompts
- Implicit tracking: Make recommendation, modify CLAUDE.md, verify change detected
- Aggregation: Create multiple outcomes, verify summary metrics calculated correctly

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | Implement debug logging with `DEBUG=agentlint:*` namespace | P1 | US-001 |
| FR-002 | Implement `--verbose` flag showing tool invocations | P1 | US-001, US-006 |
| FR-003 | Implement `--quiet` flag for minimal output | P1 | US-001 |
| FR-004 | Implement `--log-file <path>` for file-based debug output | P1 | US-001 |
| FR-005 | Redact all secrets in debug output (pattern: `[REDACTED:type:len=N]`) | P1 | US-001, US-004 |
| FR-006 | E2E test framework using Bun test with VCR recordings | P1 | US-002 |
| FR-007 | Dogfooding test suite analyzing agentlint's own codebase | P1 | US-002 |
| FR-008 | VCR cassette enforcement in CI (strict mode: request mismatch detection) | P1 | US-002 |
| FR-009 | LLM-as-judge evaluation framework using TruLens | P1 | US-003 |
| FR-010 | Golden dataset with curated CLAUDE.md examples | P1 | US-003 |
| FR-011 | Three-tier grading: code-based, LLM-as-judge, human spot-check | P1 | US-003 |
| FR-012 | 70% pass threshold for release gate | P1 | US-003 |
| FR-013 | Secret detection using Gitleaks patterns (automatic, opt-out via --no-secrets) | P1 | US-004 |
| FR-014 | LLM validation layer for secret false positive reduction | P1 | US-004 |
| FR-015 | Entropy calculation for secret candidate scoring | P2 | US-004 |
| FR-016 | Session checkpoint persistence (60s interval + phase transitions) to `.agentlint/session-state/` | P2 | US-005 |
| FR-017 | Session replay from checkpoint with `--replay <session-id>` | P2 | US-005 |
| FR-018 | Token usage and latency tracking in verbose mode | P2 | US-006 |
| FR-019 | Outcome tracking database (SQLite) for recommendations | P3 | US-007 |
| FR-020 | Optional feedback collection prompts | P3 | US-007 |

### 3.2 Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-001 | Secret detection performance | Per-file scan time | < 1 second |
| NFR-002 | LLM-as-judge overhead | Additional analysis time | < 30 seconds |
| NFR-003 | Debug logging overhead | Performance impact | < 5% slowdown |
| NFR-004 | VCR playback tests | CI execution time | < 2 minutes |
| NFR-005 | E2E tests (with VCR) | CI execution time | < 5 minutes |
| NFR-006 | Session checkpoint size | Per-checkpoint | < 1 MB |
| NFR-007 | Secret redaction coverage | Leak prevention | 100% (zero leaks) |
| NFR-008 | Dogfood quality score | agentlint self-analysis | > 95% |

---

## 4. Key Entities

> Define the core domain entities this feature introduces or modifies

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| DebugLogger | Structured logging with namespaces | level, namespace, timestamp, redaction |
| SecretCandidate | Potential secret detected by patterns | ruleId, redactedContext, entropy, location |
| ClassifiedSecret | Secret with LLM validation result | classification, confidence, reasoning |
| GoldenScenario | Test case for evaluation framework | input, expectedProperties, rubricWeights |
| EvaluationResult | Output of quality evaluation | scores, grades, overallScore, passed |
| SessionCheckpoint | Persisted analysis state | sessionId, phase, toolHistory, findings |
| RecommendationOutcome | Tracked implementation feedback | recommendationId, implemented, helped |

### 4.1 Entity Relationships

```
SecretCandidate --1:1--> ClassifiedSecret (after LLM validation)
GoldenScenario --1:N--> EvaluationResult (one scenario, many runs)
SessionCheckpoint --N:1--> AnalysisSession (many checkpoints per session)
RecommendationOutcome --N:1--> Recommendation (many outcomes per recommendation type)
```

---

## 5. Success Criteria

> How do we know this feature is successful? Define measurable outcomes.

- [ ] **Functional**: All user stories pass acceptance criteria
- [ ] **Quality**: Test coverage > 80% for new code
- [ ] **Dogfooding**: agentlint's own codebase scores > 95% on evaluation rubrics
- [ ] **Security**: Zero secret leaks in any output path (debug, logs, persistence)
- [ ] **Performance**: All NFR timing targets met
- [ ] **Developer Experience**: Debug mode enables diagnosis of analysis issues within 5 minutes

---

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior | Priority |
|----------|-------------------|----------|
| Secret pattern matches non-secret (UUID, hash) | LLM validation classifies as `unlikely` or `false_positive` | P1 |
| LLM-as-judge unavailable during release | Fail release with clear error; don't skip evaluation | P1 |
| VCR cassette missing for new test | CI fails with message to run `bun run record` | P1 |
| Session checkpoint corrupted | Log warning, start fresh analysis, don't crash | P1 |
| Circular reference in session state | Limit serialization depth, truncate with marker | P2 |
| Extremely large file scanned for secrets | Stream processing, don't load entire file in memory | P2 |
| Debug log file write fails (permissions) | Fall back to console, log warning | P2 |
| TruLens Python subprocess times out | Fail evaluation with timeout error, suggest retry | P2 |
| Golden dataset version mismatch | Warn and continue with best-effort evaluation | P3 |

---

## 7. Dependencies & Assumptions

### 7.1 Dependencies

| Dependency | Type | Status | Impact if Missing |
|------------|------|--------|-------------------|
| EP01 (Project Foundation) | Internal | Complete | Cannot proceed |
| EP02 (Orchestration Core) | Internal | Complete | Cannot proceed |
| Bun test framework | External | Available | Testing blocked |
| TruLens library | External | Available | Evals blocked |
| Gitleaks patterns (TOML) | External | Available | Use bundled patterns |
| Python 3.11+ | External | Required for TruLens | Evals only |

### 7.2 Assumptions

- Claude Agent SDK query() call provides token usage metadata
- TruLens can be executed as a subprocess from Bun
- Gitleaks TOML pattern format remains stable
- Users will opt-in to feedback collection at reasonable rates (10-20%)
- Debug logging with namespace filtering is familiar to developers

---

## 8. Open Questions

> Questions that need resolution before implementation

- [x] **Q1**: Should debug output use `console.debug()` or a dedicated logging library? — **RESOLVED**: Follow Claude Code pattern with namespaced env vars + CLI flags. See [C1](#c1-debug-logging-approach-resolved-q1).
- [x] **Q2**: What's the retention policy for session checkpoints? — **RESOLVED**: Configurable with 7-day default. See [C2](#c2-session-checkpoint-retention-policy-resolved-q2).
- [x] **Q3**: Should the golden dataset be versioned separately from the codebase? — **RESOLVED**: In codebase at `tests/evals/golden/`. See [C3](#c3-golden-dataset-location-resolved-q3).

---

## 9. References

- [Epic Definition](../../docs/planning/epics/EP11-quality-security.md)
- [ADR-0011: Testing Strategy for Agentic Components](../../docs/architecture/adr/0011-testing-strategy-for-agentic-components.md)
- [ADR-0012: Evaluation Framework for Analysis Quality](../../docs/architecture/adr/0012-evaluation-framework-for-analysis-quality.md)
- [ADR-0013: Secret Detection Strategy](../../docs/architecture/adr/0013-secret-detection-strategy.md)
- [Constitution](../../.specify/memory/constitution.md)

---

## 10. Technical Design Notes

### 10.1 Debug Logging Architecture

Based on research into CLI debugging best practices, the debug system uses:

```typescript
interface DebugConfig {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  namespace: string;  // e.g., 'agentlint:tools', 'agentlint:llm'
  output: 'console' | 'file' | 'both';
  redactionPatterns: RegExp[];  // Patterns to redact
  format: 'pretty' | 'json';
}
```

**Namespace hierarchy:**
- `agentlint:*` - All debug output
- `agentlint:tools` - Tool invocations
- `agentlint:llm` - LLM requests/responses
- `agentlint:secrets` - Secret detection
- `agentlint:eval` - Evaluation framework
- `agentlint:checkpoint` - Session checkpoints

### 10.2 E2E Testing Strategy

Per ADR-0011, tests are organized as:

| Suite | Trigger | LLM Interaction | Location |
|-------|---------|-----------------|----------|
| Unit | Every commit | Mocked | `tests/unit/` |
| Integration | Every commit | VCR recorded | `tests/integration/` |
| E2E | PR merge | VCR recorded | `tests/e2e/` |
| Evals | Release tag | Live + TruLens | `tests/evals/` |

**Dogfooding requirement**: agentlint must be able to analyze itself successfully.

### 10.3 Secret Detection Pipeline

```
Gitleaks TOML → Regex Matcher → Candidates → Redaction → LLM Validator → Classified Results
```

**Key privacy guarantee**: Secret values NEVER reach the LLM. Only redacted context is sent:
```
"api_key = AKIA[REDACTED:aws-access-key:len=20]"
```

### 10.4 Session Checkpoint Format

```typescript
interface SessionCheckpoint {
  version: '1.0';
  sessionId: string;
  timestamp: string;
  phase: 'init' | 'scan' | 'analyze' | 'recommend' | 'complete';

  // Tool history (for replay)
  toolHistory: Array<{
    tool: string;
    arguments: Record<string, unknown>;  // Redacted
    resultSummary: string;  // Truncated/redacted
    timestamp: string;
  }>;

  // Analysis state
  findings: Array<{
    id: string;
    type: string;
    location: { file: string; line: number };
  }>;

  // Metrics
  metrics: {
    toolCalls: number;
    llmCalls: number;
    tokensUsed: number;
    elapsedMs: number;
  };
}
```

---

## Clarifications

> This section is populated by /dev.clarify

### C1: Debug Logging Approach (resolved Q1)

**Decision**: Follow Claude Code's pattern with namespaced environment variable + CLI flags.

Based on research into how Claude Code handles debugging:
- Use `DEBUG=agentlint:*` for namespace-based debug filtering (consistent with the established pattern)
- Avoid conflicts with generic `DEBUG` variable by checking for `agentlint:` prefix specifically
- Support `--debug` with category filtering (e.g., `--debug "tools,llm"`)
- Support `--verbose` for user-friendly output (tool invocations, timing)
- Output debug to stderr (not stdout) to avoid contaminating output
- Support custom logger injection via SDK config for advanced users

**Implementation**:
```typescript
// Check for agentlint-specific debug namespace
const DEBUG = process.env.DEBUG || '';
const isDebugEnabled = DEBUG.includes('agentlint:') || DEBUG === 'agentlint';

// Or use --debug flag with categories
// agentlint analyze --debug "tools,llm"
```

### C2: Session Checkpoint Retention Policy (resolved Q2)

**Decision**: Configurable retention with sensible defaults.

- Default: 7 days (matches typical debugging window)
- Configurable via `~/.agentlint/config.json`:
  ```json
  {
    "checkpoint": {
      "retentionDays": 30
    }
  }
  ```
- Maximum: 365 days (prevent unbounded growth)
- Cleanup runs on agentlint startup (non-blocking)
- Special value `0` means "never delete" (for dogfooding/development)

### C3: Golden Dataset Location (resolved Q3)

**Decision**: Version golden dataset in codebase at `tests/evals/golden/`.

- Location: `tests/evals/golden/` (per ADR-0011 structure)
- Versioned with code to ensure test/code alignment
- Subdirectories:
  - `tests/evals/golden/claude-md/` - CLAUDE.md examples
  - `tests/evals/golden/sessions/` - Session log fixtures (dogfooded)
  - `tests/evals/golden/manifest.json` - Metadata and expected properties
- If dataset grows beyond 50MB, consider Git LFS for session logs only

### C4: Checkpoint Interval (Session 2026-01-20)

**Q: What checkpoint interval should trigger automatic state persistence?**
A: 60 seconds (matches existing EP02 orchestration config default)

**Decision**: Time-based checkpoints every 60 seconds.

- Default: 60 seconds (configurable via `checkpoint.intervalMs`)
- Also checkpoint on: phase transitions, significant findings
- Matches existing pattern from `src/orchestration/checkpoint.ts`

Updated: FR-016 clarified with specific interval.

### C5: VCR Staleness Detection (Session 2026-01-20)

**Q: How should VCR cassette staleness be detected in CI?**
A: Request mismatch detection (fail when test makes request not in cassette)

**Decision**: Request mismatch triggers cassette staleness error.

- CI runs in strict mode: any request without matching cassette fails
- Error message includes: URL, method, and instruction to run `bun run record`
- No prompt hash comparison (simpler, avoids noisy failures from minor prompt changes)

Updated: FR-008 clarified with detection mechanism.

### C6: Secret Detection Mode (Session 2026-01-20)

**Q: Should secret detection run automatically or be opt-in?**
A: Automatic (security-by-default)

**Decision**: Secret detection runs automatically on all analyzed content.

- Always enabled during analysis (no opt-in required)
- Can be disabled with `--no-secrets` flag for specific runs
- Aligns with Constitution Principle I (Local-First) - scan happens locally, no transmission
- Detection is non-blocking (alerts, doesn't fail analysis)

Updated: FR-013 clarified as automatic.
