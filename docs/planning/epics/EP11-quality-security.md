# EP11: Quality & Security

> Implement LLM-as-judge evaluation framework, secret detection, and observability features.

## Classification

| Attribute | Value |
|-----------|-------|
| **Type** | Enabler |
| **Priority** | P2-Medium |
| **Size** | M |
| **Estimated Duration** | 4 weeks |
| **Target Stories** | 8-10 stories |

## Business Outcome Hypothesis

**If** we implement quality evaluation and security detection,
**Then** agentlint can assess its own analysis quality and help developers avoid security issues,
**Measured by** evaluation accuracy and secret detection rates.

## Scope Definition

### In Scope

- [ ] Implement LLM-as-judge evaluation framework (ADR-0012)
  - Evaluate analysis quality
  - Assess recommendation relevance
  - Measure causal chain accuracy
- [ ] Implement secret detection (ADR-0013)
  - Pattern-based detection (API keys, tokens, passwords)
  - Never store detected secrets
  - Alert but don't block
- [ ] Implement debug logging (`DEBUG=agentlint:*`)
- [ ] Implement verbose mode (tool invocations visible)
- [ ] Implement session recording (`.agentlint/session-state/`)
- [ ] Add agent transparency features

### Out of Scope

- Config analysis tools (EP05)
- Session analysis tools (EP06)
- CLI output implementation (EP04)
- Recommendation generation (EP10)

### Minimum Viable Product (MVP)

The minimum deliverable that proves the hypothesis:

- Secret detection in config files (patterns)
- Basic LLM-as-judge for recommendation quality
- Debug logging for troubleshooting

**MVP validates:** Quality and security mechanisms work before production use

## Arc42 Traceability

| Source | References |
|--------|------------|
| **Building Blocks** | Crosscutting (across all layers) |
| **Runtime Scenarios** | N/A (enabler) |
| **Quality Requirements** | All (quality assurance mechanism) |
| **Crosscutting Concepts** | 8.2 Security, 8.5 Testing, 8.6 Logging |
| **ADRs** | ADR-0012 (Evaluation Framework), ADR-0013 (Secret Detection) |

## Requirements Traceability

| Source | References |
|--------|------------|
| **Personas** | Persona 5 (Security-Conscious Developer) |
| **Use Cases** | FR-1.3.3 (Detect secrets), NFR-2.4 (Secrets detected not stored) |
| **Requirements** | FR-1.3.3, NFR-2 (Privacy and Security) |

## Dependencies

### Blocked By (Cannot Start Without)

| Epic | Dependency Type | What's Needed |
|------|-----------------|---------------|
| EP01 | Hard | Project structure, logging infrastructure |
| EP02 | Hard | Agent execution for LLM-as-judge |
| EP05 | Soft | Config files to scan for secrets |
| EP06 | Soft | Session data to scan for secrets |

### Blocks (Other Epics Waiting On This)

| Epic | Dependency Type | What This Provides |
|------|-----------------|-------------------|
| None | — | Enabler runs in parallel |

### External Dependencies

| System/Team | Dependency | Status |
|-------------|------------|--------|
| Claude API | LLM-as-judge evaluation | Available |

## Technical Considerations

### Key Decisions

- LLM-as-judge uses separate evaluation prompts (not inline)
- Secret patterns are configurable
- Secrets detected but NEVER stored or logged
- Debug logging environment-controlled

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Secret detection false positives | Medium | Low | Pattern tuning, user override |
| LLM-as-judge inconsistent | Medium | Medium | Multiple evaluations, calibration |
| Debug logging exposes secrets | Low | High | Explicit redaction in logging |

### Spikes Needed

- [ ] Test secret detection patterns accuracy
- [ ] Calibrate LLM-as-judge prompts
- [ ] Verify secret redaction in all logging paths

### Constitution Alignment

- **I. Local-First**: Secrets never transmitted
- **VII. Intelligent Tooling**: LLM-as-judge provides quality feedback
- **IX. Agent-Aware**: Transparency features support understanding

## Acceptance Criteria (High-Level)

### Functional

- [ ] LLM-as-judge evaluates recommendation quality
- [ ] LLM-as-judge assesses causal chain accuracy
- [ ] Secret detection identifies API keys, tokens, passwords
- [ ] Detected secrets NEVER stored or logged
- [ ] Alert on secret detection (don't block)
- [ ] `DEBUG=agentlint:*` enables debug logging
- [ ] `--verbose` shows tool invocations
- [ ] Session recording captures analysis state

### Non-Functional

- [ ] Secret detection < 1 second per file
- [ ] LLM-as-judge adds < 30 seconds to analysis
- [ ] Debug logs redact all secrets

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] Code reviewed and merged
- [ ] Tests written and passing (unit, integration)
- [ ] Documentation updated (security guidelines)
- [ ] Deployed to staging environment
- [ ] Product owner sign-off

## Speckit Handoff Notes

> Guidance for `/speckit.specify` phase

### Primary Focus

- **Persona**: Persona 5 (Security-Conscious Developer)
- **Workflow**: Scan configs → detect secrets → alert user
- **Outcome**: Security awareness without friction

### Constraints to Encode

From ADRs:
- ADR-0012: LLM-as-judge multi-dimension evaluation
- ADR-0013: Pattern-based, never store secrets

From Constitution:
- I. Local-First: Secrets never leave machine

### Key Scenarios to Specify

1. Detect AWS_SECRET_KEY in CLAUDE.md
2. Evaluate recommendation quality (good/bad examples)
3. Debug logging enabled, secrets redacted
4. User overrides false positive secret detection

### Tech Stack Notes (for `/speckit.plan`)

- Regex patterns for secret detection
- Claude API for LLM-as-judge
- Debug module for logging

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-15 | Arc42 Decomposer | Initial creation from Arc42 |
