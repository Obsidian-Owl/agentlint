# 11. Risks and Technical Debt

This section documents known risks, potential problems, and intentional technical debt in agentlint's architecture.

## 11.1 Technical Risks

### High Priority Risks

| ID | Risk | Impact | Likelihood | Mitigation | Status |
|----|------|--------|------------|------------|--------|
| **R1** | LLM API availability | Analysis degraded | Medium | Progressive value (static fallback) | Mitigated |
| **R2** | LLM cost overruns | User dissatisfaction | Medium | Cost estimates, level control | Mitigated |
| **R3** | Bun runtime stability | Tool unusable | Low | Pin version, monitor releases | Monitored |
| **R4** | SQLite corruption | Data loss | Low | WAL mode, checksums | Mitigated |
| **R5** | AI tool API changes | Adapters break | Medium | Abstraction layer, versioning | Designed |

### Detailed Risk Analysis

#### R1: LLM API Availability

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RISK: LLM API AVAILABILITY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Scenario: Anthropic/OpenAI API is unavailable (rate limit, outage)        │
│                                                                             │
│  Impact:                                                                    │
│  • Light/Full analysis cannot complete                                     │
│  • Recommendations not generated                                           │
│  • User experience degraded                                                │
│                                                                             │
│  Mitigations:                                                               │
│  1. Partial completion: Return what succeeded, explain what failed        │
│  2. Retry with backoff: Exponential backoff for transient failures        │
│  3. Multi-provider: Fallback to alternate provider (future)               │
│  4. Caching: Avoid repeat calls for same inputs                           │
│                                                                             │
│  Residual Risk: MEDIUM (requires LLM for full functionality)              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### R2: LLM Cost Overruns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RISK: LLM COST OVERRUNS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Scenario: User runs Full analysis frequently, unexpected API bill         │
│                                                                             │
│  Impact:                                                                    │
│  • User trust damage                                                       │
│  • Tool adoption resistance                                                │
│                                                                             │
│  Mitigations:                                                               │
│  1. Cost estimates: Show expected cost before analysis                     │
│  2. Model selection: Choose model for cost/quality tradeoff                │
│  3. Frequency modes: Calm/Regular/Active with cost estimates              │
│  4. Git hook throttling: Smart scheduling prevents over-analysis          │
│  5. Token tracking: Working memory tracks and compresses usage            │
│  6. Prompt caching: Leverage provider caching for cost reduction          │
│                                                                             │
│  Residual Risk: LOW (user has full cost visibility and control)           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### R5: AI Tool API Changes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RISK: AI TOOL API CHANGES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Scenario: Claude Code changes JSONL format, CLAUDE.md structure           │
│                                                                             │
│  Impact:                                                                    │
│  • Session parsing fails                                                   │
│  • Config analysis incorrect                                               │
│  • False findings generated                                                │
│                                                                             │
│  Mitigations:                                                               │
│  1. Adapter abstraction: Changes isolated to adapter code                 │
│  2. Version detection: Adapters detect and handle format versions         │
│  3. Graceful degradation: Unknown fields ignored, not crashed             │
│  4. Test fixtures: Golden tests catch breaking changes                    │
│  5. Update monitoring: Track AI tool release notes                        │
│                                                                             │
│  Residual Risk: MEDIUM (requires ongoing adapter maintenance)             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 11.2 Architectural Risks

### Complexity Risks

| Risk | Description | Mitigation |
|------|-------------|------------|
| **Agent complexity** | Agent-orchestrated architecture harder to debug | Extensive logging, OpenTelemetry traces |
| **Subagent coordination** | Parallel execution introduces race conditions | SQLite WAL mode, checkpointing |
| **Working memory** | Compression may lose critical context | Preserve decisions/errors, structured summaries |
| **Causal tracing** | False causation attribution | Multi-source evidence, confidence scores |

### Scalability Risks

| Risk | Description | Mitigation |
|------|-------------|------------|
| **Large codebases** | Analysis timeout for monorepos | Incremental analysis, sampling |
| **Long session logs** | Memory exhaustion parsing 100MB+ logs | Streaming parser, FTS5 indexing |
| **Many projects** | Global DB growth | Per-project storage, data cleanup |

## 11.3 Technical Debt

### Intentional Technical Debt

These items were deferred to accelerate MVP delivery:

| ID | Item | Rationale | Impact | Resolution Plan |
|----|------|-----------|--------|-----------------|
| **TD1** | Binary releases | npm covers primary users | Manual install for non-Node users | Post-MVP (v1.1) |
| **TD2** | Windows keychain | Env vars work | Less secure credential storage | Post-MVP (v1.2) |
| **TD3** | IDE plugins | CLI-first approach | No IDE integration | v2.0 |
| **TD4** | Team dashboards | Individual focus first | No aggregate metrics | v2.0 |
| **TD5** | Cross-project learning | Privacy concerns | Learnings don't transfer | Evaluate in v2.0 |

### Accumulated Technical Debt

| ID | Item | Origin | Impact | Priority |
|----|------|--------|--------|----------|
| **ATD1** | Test coverage gaps | Rapid development | Regression risk | High |
| **ATD2** | Documentation lag | Feature velocity | Onboarding friction | Medium |
| **ATD3** | Error message inconsistency | Multiple contributors | UX inconsistency | Medium |

### Debt Tracking

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TECHNICAL DEBT QUADRANT                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    │ Deliberate          │ Inadvertent                     │
│  ──────────────────┼─────────────────────┼────────────────────────         │
│  Prudent           │ TD1-TD5             │ ATD1-ATD3                       │
│  (Strategic)       │ "We'll do binary    │ "We didn't know how             │
│                    │  releases later"    │  coverage would slip"           │
│  ──────────────────┼─────────────────────┼────────────────────────         │
│  Reckless          │ (None identified)   │ (None identified)               │
│  (Anti-pattern)    │                     │                                 │
│                                                                             │
│  Current Status: All debt is Prudent (strategic or learning)              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 11.4 Dependency Risks

### Critical Dependencies

| Dependency | Risk | Mitigation |
|------------|------|------------|
| **Bun** | Breaking changes, abandonment | Pin version, monitor community |
| **Vercel AI SDK** | API changes | Pin version, abstraction layer |
| **SQLite** | None (Bun built-in) | N/A |
| **Anthropic API** | Pricing changes, deprecation | Multi-provider support |

### Supply Chain Security

| Measure | Implementation |
|---------|----------------|
| Dependency audit | `bun audit` in CI |
| Lockfile | `bun.lockb` committed |
| Minimal deps | Prefer built-ins, avoid bloat |
| License compliance | Apache 2.0 / MIT only |

## 11.5 Operational Risks

### Production Concerns

| Risk | Description | Mitigation |
|------|-------------|------------|
| **Config corruption** | Invalid TOML crashes CLI | Validation on load, fallback to defaults |
| **DB corruption** | SQLite file damaged | WAL mode, checksum validation |
| **Hook conflicts** | Existing git hooks overwritten | Append mode, detection |
| **Path issues** | XDG paths not writable | Fallback paths, clear errors |

### Monitoring & Alerting

| Metric | Threshold | Response |
|--------|-----------|----------|
| Analysis latency P95 | >60s | Investigate, optimize |
| LLM error rate | >10% | Check provider status |
| Cache miss rate | >50% | Review cache invalidation |

## 11.6 Risk Register

### Active Risk Summary

| ID | Risk | Severity | Status | Owner |
|----|------|----------|--------|-------|
| R1 | LLM API availability | Medium | Mitigated | Architecture |
| R2 | LLM cost overruns | Medium | Mitigated | Product |
| R3 | Bun stability | Low | Monitored | Engineering |
| R4 | SQLite corruption | Low | Mitigated | Engineering |
| R5 | AI tool API changes | Medium | Designed | Engineering |

### Risk Response Actions

| Response Type | Application |
|---------------|-------------|
| **Accept** | Bun stability (low likelihood, monitoring sufficient) |
| **Mitigate** | LLM availability (progressive value pattern) |
| **Transfer** | N/A (no external parties) |
| **Avoid** | Cross-project learning (deferred due to privacy concerns) |

## Related ADRs

- [ADR-0014](../adr/0014-error-handling-and-recovery.md) - Error handling for R1
- [ADR-0016](../adr/0016-concurrency-model.md) - SQLite safety for R4
- [ADR-0018](../adr/0018-ai-tool-adapter-architecture.md) - Adapter pattern for R5
- [ADR-0021](../adr/0021-caching-strategy.md) - Cost mitigation for R2
- [ADR-0027](../adr/0027-agent-working-memory-architecture.md) - Complexity management
