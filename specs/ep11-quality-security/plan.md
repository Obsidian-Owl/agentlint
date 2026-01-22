# Implementation Plan: Quality & Security

> **Epic**: EP11
> **Spec**: specs/ep11-quality-security/spec.md
> **Created**: 2026-01-20
> **Status**: Design Complete
> **Author**: Claude Code

---

## Summary

**Primary Requirement**: Implement production-quality assurance and security capabilities for agentlint, including E2E testing with VCR recordings, LLM-as-judge evaluation framework, secret detection with redaction, and comprehensive debug mode for local development.

**Technical Approach**: Build on existing EP02 orchestration patterns (checkpointing, config loading) to add cross-cutting debug/logging infrastructure. Leverage Gitleaks TOML patterns for secret detection with LLM validation for false positive reduction. Use TruLens via Python subprocess for behavioral evaluation on release gates. Integrate with existing VCR infrastructure from ADR-0011.

---

## Technical Context

| Aspect | Value |
|--------|-------|
| **Language/Version** | TypeScript 5.x on Bun runtime |
| **Primary Dependencies** | @anthropic-ai/claude-agent-sdk, Commander, Zod, bun-bagel (VCR), TruLens (Python subprocess) |
| **Storage** | File system (JSON), SQLite (FTS5 for evals.db, outcomes.db) |
| **Testing Framework** | Bun test with VCR recordings |
| **Target Platform** | CLI, Bun runtime (cross-platform) |
| **Project Type** | CLI Tool with agentic orchestration |
| **Performance Goals** | Secret detection < 1s/file, debug overhead < 5%, VCR tests < 2 min |
| **Constraints** | Local-first (no external services except user LLM API), Python 3.11+ required for TruLens evals only |
| **Scale/Scope** | Single developer, local execution |

---

## Constitution Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Local-First | ✓ | All analysis runs locally. Secret values NEVER transmitted to LLM (redacted context only). TruLens runs locally. No telemetry without opt-in. |
| II | Improvement-Oriented | ✓ | Evaluation framework tracks quality over time. Outcome tracking measures recommendation effectiveness. Dogfooding creates baseline for self-improvement. |
| III | Causal-First | ✓ | Causal accuracy is a primary evaluation metric. Secret detection traces to file:line origin. Debug mode traces tool calls to findings. |
| IV | Mixed-Methods (Agent-Orchestrated) | ✓ | Quantitative metrics (entropy, scores) + qualitative LLM-as-judge evaluation. Agent decides which methods apply per ADR-0012. |
| V | Language-Agnostic | ✓ | Secret patterns (Gitleaks) work across all languages. Golden dataset includes diverse project types. No language-specific core logic. |
| VI | Agent-Agnostic | ✓ | Debug infrastructure works with any ACT adapter. Evaluation framework independent of specific agent implementation. |
| VII | Intelligent Tooling | ✓ | Secret detection tool provides candidates; agent reasons about classification. LLM-as-judge is a tool, not orchestration. |
| VIII | Compounding Value | ✓ | Golden dataset evolves via dogfooding. Outcome tracking feeds future recommendation quality. Evaluation baselines enable trend tracking. |
| IX | Agent-Aware | ✓ | Debug output structured for agent comprehension. Checkpoints preserve cognitive context. Verbose mode shows tool invocations for transparency. |

**Gate Status**: [x] All principles pass

---

## Project Structure

### Documentation Structure

```
specs/ep11-quality-security/
├── spec.md           # Feature specification (complete)
├── plan.md           # This file
├── research.md       # Research findings (Phase 1)
├── data-model.md     # Entity definitions (Phase 2)
├── quickstart.md     # Usage guide (Phase 2)
├── contracts/        # API definitions (Phase 2)
│   ├── debug.ts      # DebugLogger interface
│   ├── secrets.ts    # SecretCandidate, ClassifiedSecret
│   ├── eval.ts       # GoldenScenario, EvaluationResult
│   └── checkpoint.ts # SessionCheckpoint extension
└── checklists/       # Validation checklists
    ├── requirements.md
    └── design.md
```

### Source Code Structure (Proposed)

```
src/
├── debug/                    # NEW: Debug & logging infrastructure
│   ├── index.ts              # Public exports
│   ├── logger.ts             # DebugLogger implementation
│   ├── namespaces.ts         # Namespace constants
│   ├── redaction.ts          # Secret redaction utilities
│   └── types.ts              # Type definitions
├── security/                 # NEW: Secret detection
│   ├── index.ts              # Public exports
│   ├── detector.ts           # Pattern-based detection
│   ├── classifier.ts         # LLM validation layer
│   ├── entropy.ts            # Entropy calculation
│   ├── patterns/             # Gitleaks TOML patterns
│   │   └── gitleaks.toml     # Bundled patterns
│   └── types.ts              # Type definitions
├── eval/                     # NEW: Evaluation framework
│   ├── index.ts              # Public exports
│   ├── graders/              # Three-tier grading
│   │   ├── code-based.ts     # Format validation
│   │   └── llm-judge.ts      # LLM-as-judge
│   ├── runner.ts             # Evaluation orchestration
│   └── types.ts              # Type definitions
├── orchestration/            # EXISTING: Extend checkpoint
│   ├── checkpoint.ts         # Extend for session recording
│   └── session-state.ts      # Extend for replay
└── cli/                      # EXISTING: Add CLI flags
    └── program.ts            # Add --verbose, --debug, --quiet, --log-file

tests/
├── e2e/                      # NEW: End-to-end tests
│   ├── dogfood.test.ts       # Self-analysis test
│   └── workflows/            # Full workflow tests
├── evals/                    # NEW: TruLens evaluations
│   ├── golden/               # Golden dataset
│   │   ├── claude-md/        # CLAUDE.md examples
│   │   ├── sessions/         # Session log fixtures
│   │   └── manifest.json     # Metadata
│   ├── run-evals.ts          # Bun → TruLens orchestrator
│   ├── trulens.config.py     # TruLens configuration
│   └── behavioral/           # Behavioral test files
└── integration/
    └── recordings/           # VCR cassettes (extend)
```

---

## Complexity Tracking

> Only add rows if constitution principles require justified violations

| Principle | Violation | Justification | Mitigation |
|-----------|-----------|---------------|------------|
| None | - | - | - |

---

## Key Design Decisions

| Decision | Choice | Rationale | ADR |
|----------|--------|-----------|-----|
| Secret detection patterns | Gitleaks TOML | Battle-tested patterns (140+ detectors), community maintained | ADR-0013 |
| LLM-as-judge framework | TruLens via Python subprocess | Mature evaluation library, explainable metrics, self-hostable | ADR-0012 |
| VCR recording format | JSON cassettes with request matching | Simple, CI-compatible, existing bun-bagel integration | ADR-0011 |
| Debug logging | Namespaced env var + CLI flags | Follows Claude Code pattern, avoids DEBUG conflicts | Spec C1 |
| Checkpoint retention | Configurable with 7-day default | Balances disk usage with debugging window | Spec C2 |
| Golden dataset location | In codebase at tests/evals/golden/ | Version alignment, simpler CI | Spec C3 |
| Secret detection mode | Automatic (opt-out via --no-secrets) | Security-by-default, non-blocking alerts | Spec C6 |

---

## Implementation Phases

### Phase A: Debug Infrastructure (P1)
Foundation for all debugging capabilities.

1. Create `src/debug/` module with DebugLogger
2. Implement namespace-based filtering (`agentlint:*`)
3. Implement secret redaction layer
4. Add CLI flags (`--verbose`, `--debug`, `--quiet`, `--log-file`)
5. Integrate with existing orchestration

### Phase B: Secret Detection (P1)
Security scanning with privacy preservation.

1. Create `src/security/` module
2. Bundle and parse Gitleaks TOML patterns
3. Implement regex-based candidate detection
4. Implement entropy calculation
5. Create LLM validation tool for classification
6. Integrate with debug redaction

### Phase C: Testing Framework (P1)
E2E and VCR infrastructure.

1. Create `tests/e2e/` structure
2. Implement VCR strict mode for CI
3. Create dogfooding test suite
4. Set up golden dataset structure
5. Add npm scripts for recording

### Phase D: Evaluation Framework (P1)
LLM-as-judge with TruLens.

1. Create `tests/evals/` structure
2. Implement code-based graders
3. Create TruLens Python subprocess integration
4. Define evaluation rubrics (actionability, causal accuracy)
5. Set up 70% release gate threshold

### Phase E: Session Recording (P2)
Enhanced checkpointing for replay.

1. Extend checkpoint handler for session recording
2. Implement session replay (`--replay <id>`)
3. Add crash recovery prompts
4. Implement retention policy cleanup

### Phase F: Outcome Tracking (P3)
Recommendation effectiveness measurement.

1. Create SQLite schema for outcomes
2. Implement feedback collection prompts
3. Add implicit tracking (config change detection)
4. Create aggregation queries

---

## References

- **Spec**: [spec.md](./spec.md)
- **Epic**: [EP11-quality-security.md](../../docs/planning/epics/EP11-quality-security.md)
- **Arc42**: §8 Crosscutting Concepts (8.2 Security, 8.5 Testing, 8.6 Logging)
- **ADRs**:
  - [ADR-0011: Testing Strategy](../../docs/architecture/adr/0011-testing-strategy-for-agentic-components.md)
  - [ADR-0012: Evaluation Framework](../../docs/architecture/adr/0012-evaluation-framework-for-analysis-quality.md)
  - [ADR-0013: Secret Detection](../../docs/architecture/adr/0013-secret-detection-strategy.md)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-20 | Claude Code | Initial plan |
