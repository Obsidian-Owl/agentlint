# EP07: Causal Tracing Engine

> Implement causal analysis capabilities: evidence collection, chain reasoning, and origin linking.

## Classification

| Attribute | Value |
|-----------|-------|
| **Type** | Business |
| **Priority** | P1-High |
| **Size** | L |
| **Estimated Duration** | 6 weeks |
| **Target Stories** | 10-12 stories |

## Business Outcome Hypothesis

**If** we implement causal tracing that links issues to their origins,
**Then** developers can understand WHY issues occurred and how to prevent them,
**Measured by** successful origin identification and preventive recommendation quality.

## Scope Definition

### In Scope

- [ ] Implement DETECT → TRACE → UNDERSTAND → RECOMMEND flow
- [ ] Create evidence collection tools (session search, git correlation)
- [ ] Generate structured evidence chains (trigger → gap → mechanism → effect)
- [ ] Implement causal chain validation checklist (specificity, temporal, mechanistic)
- [ ] Assess confidence levels for causal claims
- [ ] Generate counterfactual analysis ("if X were present...")
- [ ] Pattern recognition across sessions (recurring issues)
- [ ] Cluster similar issues by root cause category
- [ ] Distinguish systemic vs. one-off issues
- [ ] Link issues to specific sessions, prompts, and config gaps

### Out of Scope

- Session log indexing (EP06 - must be complete first)
- Git integration details (EP08 provides via adapter)
- Recommendation persistence (EP10)
- LLM-as-judge evaluation (EP11)

### Minimum Viable Product (MVP)

The minimum deliverable that proves the hypothesis:

- Given a detected issue, search sessions for origin
- Generate basic evidence chain (issue → session → gap)
- Output counterfactual recommendation

**MVP validates:** Causal chain construction works before adding pattern recognition

## Arc42 Traceability

| Source | References |
|--------|------------|
| **Building Blocks** | Tool Layer, Orchestration Layer (agent reasoning) |
| **Runtime Scenarios** | 6.2 Causal Tracing (full flow) |
| **Quality Requirements** | N/A (quality is the feature) |
| **Crosscutting Concepts** | Domain model (Issue → origin → recommendation) |
| **ADRs** | ADR-0005 (Tool Definition) |

## Requirements Traceability

| Source | References |
|--------|------------|
| **Personas** | Persona 0 (Agent - causal reasoning), Persona 5 (Security - trace vulnerabilities) |
| **Use Cases** | UC-008 (Trace Issue Origins), FR-6 (Causal Analysis) |
| **Requirements** | FR-6.1 (Evidence Collection), FR-6.2 (Causal Chain Reasoning), FR-6.3 (Pattern Recognition) |

## Dependencies

### Blocked By (Cannot Start Without)

| Epic | Dependency Type | What's Needed |
|------|-----------------|---------------|
| EP01 | Hard | Project structure |
| EP02 | Hard | Agent reasoning infrastructure |
| EP03 | Hard | Storage for causal analysis state |
| EP05 | Soft | Config data for gap identification |
| EP06 | Hard | Session search for evidence collection |

### Blocks (Other Epics Waiting On This)

| Epic | Dependency Type | What This Provides |
|------|-----------------|-------------------|
| EP10 | Hard | Causal chains for preventive recommendations |

### External Dependencies

| System/Team | Dependency | Status |
|-------------|------------|--------|
| Claude API | LLM reasoning for causal analysis | Available |

## Technical Considerations

### Key Decisions

- Causal analysis is fundamentally agentic (LLM reasoning, not static rules)
- Evidence chains are structured for agent and human consumption
- Confidence levels based on validation checklist
- Pattern recognition builds on session indexing from EP06

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Causal claims too speculative | Medium | High | Confidence scoring, validation checklist |
| Missing evidence (logs purged) | Medium | Medium | Graceful degradation, partial analysis |
| Agent hallucinates connections | Medium | High | Evidence-based reasoning, source citations |

### Spikes Needed

- [ ] Test causal chain quality with real issues
- [ ] Benchmark pattern recognition accuracy
- [ ] Validate confidence scoring methodology

### Constitution Alignment

- **III. Causal-First**: This IS the causal-first principle implementation
- **IV. Mixed-Methods**: Quantitative evidence + qualitative reasoning
- **VII. Intelligent Tooling**: Agent reasons about causality, tools provide evidence

## Acceptance Criteria (High-Level)

### Functional

- [ ] Given an issue, search sessions for temporal origin
- [ ] Generate evidence chain: trigger → gap → mechanism → effect
- [ ] Assess confidence level with explicit criteria
- [ ] Generate counterfactual analysis
- [ ] Identify recurring patterns across sessions
- [ ] Cluster issues by root cause category
- [ ] Distinguish systemic from one-off issues
- [ ] Link to specific sessions with position markers

### Non-Functional

- [ ] Evidence chains human-readable
- [ ] Confidence levels calibrated (high confidence = accurate)
- [ ] Agent reasoning visible in verbose mode

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] Code reviewed and merged
- [ ] Tests written and passing (unit, integration)
- [ ] Documentation updated (causal model reference)
- [ ] Deployed to staging environment
- [ ] Product owner sign-off

## Speckit Handoff Notes

> Guidance for `/speckit.specify` phase

### Primary Focus

- **Persona**: Persona 0 (Agent) - causal reasoning capabilities
- **Workflow**: Detect issue → gather evidence → construct chain → assess confidence
- **Outcome**: Reliable causal attribution

### Constraints to Encode

From ADRs:
- Causal analysis is agentic (LLM reasoning)
- Evidence must be traceable to sources

From Constitution:
- III. Causal-First: Trace to origin, enable prevention
- IV. Mixed-Methods: Evidence-based reasoning

### Key Scenarios to Specify

1. Secret in config → trace to "add API config" session
2. High iteration session → trace to missing guidance
3. Recurring pattern detection across 10 sessions
4. Partial evidence available (some logs purged)

### Tech Stack Notes (for `/speckit.plan`)

- Claude Agent SDK for reasoning
- Session search tools from EP06
- Structured output for evidence chains

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-15 | Arc42 Decomposer | Initial creation from Arc42 |
