# Feature Specification: Causal Tracing Engine

> **Epic**: EP07
> **Created**: 2026-01-17
> **Status**: Ready for Planning
> **Author**: Claude
> **Clarified**: 2026-01-17

---

## 1. Overview

The Causal Tracing Engine implements agentlint's core differentiation: tracing detected issues to their origin and enabling preventive recommendations. Unlike traditional linters that merely detect problems, this engine constructs evidence-based causal chains from issues back to their source—whether a session prompt, missing configuration guidance, or a documentation gap.

### 1.1 Business Context

This epic implements Constitution Principle III (Causal-First): "The system MUST trace issues to their origin and recommend changes that enable prevention—not merely detect problems." It transforms agentlint from a point-in-time linter into a learning system that understands WHY issues occurred.

The causal analysis model is:
```
DETECT → TRACE → UNDERSTAND → RECOMMEND
```

EP07 handles TRACE and UNDERSTAND; EP10 (Recommendation Engine) handles RECOMMEND based on the causal chains produced here.

### 1.3 Agent Value Differentiation

The Claude Agent SDK provides native capabilities for session history, tool execution, and structured output within a single session. EP07 adds value **beyond native agent capabilities** in two ways:

1. **Cross-Session Correlation**: Trace patterns across MULTIPLE sessions that exceed a single context window. The agent cannot see previous sessions natively—EP07 persists causal chains (via EP03) enabling correlation across weeks or months of sessions.

2. **Pre-Computed Evidence Chains**: Provide ready-made causal chains via tools (`trace_issue_origin`, `get_issue_patterns`) so the agent doesn't spend tokens reasoning about causality from scratch. This is efficient retrieval, not re-derivation.

**Design principle**: Causal tracing tools are the PRIMARY consumer interface. Human-readable output is derived from structured tool output. The agent queries historical patterns; it does not re-derive them each session.

### 1.2 Out of Scope

- **Session log indexing**: Provided by EP06 (hard dependency)
- **Git integration details**: Provided by EP08 ACT Adapters
- **Recommendation persistence and tracking**: EP10 handles this
- **LLM-as-judge evaluation of causal quality**: EP11 provides evaluation framework
- **Config parsing and detection**: EP05 provides this capability
- **Automated remediation**: Per constitution, agentlint recommends but never changes without consent

---

## 2. User Scenarios & Testing

> User stories are prioritized: P1 (must-have), P2 (should-have), P3 (nice-to-have)

### US-001 [P1]: Trace Issue to Session Origin

**As a** developer investigating a detected issue,
**I want** to trace the issue to its session origin,
**So that** I understand what prompt or interaction introduced it.

**Acceptance Criteria:**
- [ ] Given a detected issue (e.g., secret in config), when tracing is invoked, then the system searches session logs for related prompts
- [ ] Given session search results, when constructing causal chain, then the system links issue → session → prompt with position markers (file:line)
- [ ] Given a traced issue, when displaying results, then the system shows temporal context (when it was introduced)

**Test Scenarios:**
- Happy path: Secret in CLAUDE.md traced to session where user prompted "add my API config"
- Error case: No matching sessions found → return partial trace with "origin unknown" indicator
- Edge case: Multiple potential origin sessions → rank by temporal proximity and content match

---

### US-002 [P1]: Identify Configuration Gap

**As a** developer,
**I want** to understand what missing guidance allowed an issue,
**So that** I can add preventive configuration.

**Acceptance Criteria:**
- [ ] Given a traced issue origin, when analyzing configuration state, then the system identifies what guidance was missing
- [ ] Given a gap identification, when outputting results, then the system provides counterfactual analysis ("if X were present, Y wouldn't have happened")
- [ ] Given multiple potential gaps, when presenting findings, then the system prioritizes by causal proximity

**Test Scenarios:**
- Happy path: High iteration session traced to missing domain glossary → gap is "no terminology guidance in CLAUDE.md"
- Error case: Configuration fully covered but issue still occurred → note "gap not in configuration"
- Edge case: Gap exists in inherited global config vs project config

---

### US-003 [P1]: Construct Evidence Chain

**As a** developer,
**I want** a structured evidence chain for each traced issue,
**So that** I can understand the full causal path from trigger to effect.

**Acceptance Criteria:**
- [ ] Given traced evidence, when constructing chain, then output follows: trigger → gap → mechanism → effect
- [ ] Given an evidence chain, when validating, then the system assesses against validation checklist (specificity, temporal, mechanistic)
- [ ] Given validation results, when outputting chain, then confidence level is included (high/medium/low)

**Test Scenarios:**
- Happy path: Secret exposure with complete chain: user prompt → no credential guidance → AI added secret → detected in scan
- Partial chain: Missing intermediate evidence → chain constructed with uncertainty markers
- Low confidence: Weak temporal correlation → chain output with "low" confidence and explanation

---

### US-004 [P2]: Recognize Recurring Patterns

**As a** developer with multiple sessions,
**I want** to identify recurring issue patterns across sessions,
**So that** I can address systemic problems rather than one-off incidents.

**Acceptance Criteria:**
- [ ] Given issue traces across multiple sessions, when pattern detection runs, then similar issues are clustered by root cause
- [ ] Given clustered issues, when outputting patterns, then frequency, severity, and first occurrence are included
- [ ] Given pattern results, when distinguishing issue types, then systemic vs one-off classification is provided

**Test Scenarios:**
- Happy path: 5 sessions with high iteration count traced to same gap (missing examples) → systemic pattern
- One-off: Single occurrence with unique prompt → classified as one-off
- Edge case: Pattern spans projects → detected in global learnings context

---

### US-005 [P2]: Generate Counterfactual Analysis

**As a** developer,
**I want** counterfactual analysis for traced issues,
**So that** I understand what would have prevented the problem.

**Acceptance Criteria:**
- [ ] Given a complete causal chain, when generating counterfactual, then output format is "If [X] were present, [Y] would not have occurred"
- [ ] Given counterfactual, when deriving recommendation, then actionable config change is suggested
- [ ] Given multiple counterfactuals, when prioritizing, then most impactful is ranked first

**Test Scenarios:**
- Happy path: "If 'Use environment variables for credentials' was in CLAUDE.md, secret exposure would not have occurred"
- Multi-factor: Multiple gaps contributed → all counterfactuals listed with relative weights
- Uncertain: Weak causal link → counterfactual phrased with uncertainty ("may have prevented")

---

### US-006 [P3]: Assess Confidence Levels

**As a** developer reviewing causal claims,
**I want** explicit confidence scoring,
**So that** I can trust high-confidence traces and investigate low-confidence ones.

**Acceptance Criteria:**
- [ ] Given an evidence chain, when assessing confidence, then validation checklist is applied: specificity, temporal, mechanistic, evidence quality, reproducibility, alternatives considered
- [ ] Given checklist results, when computing confidence, then score is categorized: high (≥5/6), medium (3-4/6), low (<3/6)
- [ ] Given confidence score, when outputting chain, then scoring breakdown is included in verbose mode

**Test Scenarios:**
- High confidence: Direct session match + temporal proximity + clear mechanism = high
- Medium confidence: Session match but mechanism inferred = medium
- Low confidence: No session match, git history only = low

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | User Story | FR Ref |
|----|-------------|----------|------------|--------|
| FR-CT-001 | Search session logs for issue-related prompts using FTS5 | P1 | US-001 | FR-6.1.1 |
| FR-CT-002 | Extract temporal data (when issue was first observed) | P1 | US-001 | FR-6.1.2 |
| FR-CT-003 | Return session position markers (filePath, lineNumber) for causal reference | P1 | US-001 | FR-6.1.5 |
| FR-CT-004 | Correlate with git commits (git blame, pickaxe) | P2 | US-001 | FR-6.1.3 |
| FR-CT-004a | Capture configuration state at time of issue | P2 | US-002 | FR-6.1.4 |
| FR-CT-005 | Identify configuration gaps that enabled issues | P1 | US-002 | FR-6.2.3 |
| FR-CT-006 | Generate structured evidence chains: trigger → gap → mechanism → effect | P1 | US-003 | FR-6.2.1 |
| FR-CT-007 | Distinguish symptoms from root causes | P1 | US-003 | FR-6.2.2 |
| FR-CT-008 | Assess confidence using validation checklist | P1 | US-006 | FR-6.2.4 |
| FR-CT-009 | Generate counterfactual analysis | P1 | US-005 | FR-6.2.5 |
| FR-CT-010 | Identify recurring patterns across sessions | P2 | US-004 | FR-6.3.1 |
| FR-CT-011 | Cluster similar issues by root cause category | P2 | US-004 | FR-6.3.2 |
| FR-CT-012 | Distinguish systemic vs one-off issues | P2 | US-004 | FR-6.3.3 |
| FR-CT-013 | Track issue frequency and severity over time | P3 | US-004 | FR-6.3.4 |
| FR-CT-014 | Output human-readable evidence chains | P1 | US-003 | - |
| FR-CT-015 | Persist causal chains for cross-session correlation | P1 | US-004 | - |
| FR-CT-016 | Provide pre-computed chains via tools for agent efficiency | P1 | US-001 | - |

### 3.2 Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-CT-001 | Causal analysis performance | Analysis time for single issue | < 5 seconds |
| NFR-CT-002 | Pattern detection scalability | Sessions analyzed for patterns | ≥ 100 sessions |
| NFR-CT-003 | Memory efficiency | Peak memory during analysis | < 200MB |
| NFR-CT-004 | Confidence calibration | High-confidence accuracy | ≥ 80% verified correct |
| NFR-CT-005 | Readable output | Evidence chain clarity | Human-interpretable |
| NFR-CT-006 | Graceful degradation | Partial evidence handling | Returns partial analysis |
| NFR-CT-007 | Maximum chain depth | Traversal limit | 5 steps (configurable) |

---

## 4. Key Entities

> Define the core domain entities this feature introduces or modifies

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| CausalChain | Linked evidence from issue to origin | id, issueId, trigger, gap, mechanism, effect, confidence, createdAt, projectPath, depth, depthLimitReached |
| EvidenceItem | A single piece of evidence | type, source, timestamp, content, position (filePath, line) |
| TracedIssue | An issue with its causal analysis | issueId, chain, counterfactual, patternId? |
| IssuePattern | Recurring issue type across sessions | patternId, category, issueIds, frequency, isSystemic, firstOccurrence, lastOccurrence |
| ConfidenceScore | Validation checklist result | specificity, temporal, mechanistic, evidenceQuality, reproducibility, alternatives, overall |
| Gap | Missing configuration element | gapType, location, expectedGuidance, counterfactual |

### 4.1 Entity Relationships

```
TracedIssue --1:1--> CausalChain
CausalChain --1:N--> EvidenceItem
TracedIssue --N:1--> IssuePattern (optional)
CausalChain --1:1--> ConfidenceScore
CausalChain --1:N--> Gap
```

### 4.2 Evidence Types

| Type | Source | Example |
|------|--------|---------|
| SessionMatch | FTS5 search result | Prompt mentioning "add API config" |
| GitCorrelation | git blame/pickaxe | Commit that added the line |
| ConfigGap | Config analysis comparison | Missing credential guidance |
| TemporalMarker | Timestamp correlation | Issue first appeared after session X |
| ToolTrace | Tool call pattern | Repeated file reads suggesting confusion |

---

## 5. Success Criteria

> How do we know this feature is successful? Define measurable outcomes.

- [ ] **Functional**: All user stories pass acceptance criteria with tests
- [ ] **Quality**: Test coverage > 80%, zero critical bugs
- [ ] **Performance**: Single-issue tracing < 5s, pattern detection across 100 sessions < 30s
- [ ] **Accuracy**: High-confidence traces verified correct ≥ 80% (evaluation in EP11)
- [ ] **Usability**: Evidence chains readable without documentation

---

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior | Priority |
|----------|-------------------|----------|
| No session logs available | Return partial trace using only git history, mark as low confidence | P1 |
| Session logs purged/incomplete | Graceful degradation with "evidence gap" markers | P1 |
| Issue predates session logging | Use git history only, note limitation | P1 |
| Multiple equally-likely origins | Present all candidates ranked by likelihood | P2 |
| Circular dependencies in chain | Detect and break cycles, log warning | P2 |
| Config file not parseable | Skip config gap analysis, note in output | P2 |
| FTS index not initialized | Auto-trigger indexing or return error with guidance | P1 |
| Very large session corpus (>1GB) | Stream processing, pagination, memory limits | P2 |
| FTS index stale (sessions modified after last index) | Return partial results with warning, suggest re-indexing | P2 |
| Chain depth exceeds 5 | Stop traversal, set `depthLimitReached: true` flag | P1 |

---

## 7. Dependencies & Assumptions

### 7.1 Dependencies

| Dependency | Type | Status | Impact if Missing |
|------------|------|--------|-------------------|
| EP01 Project Foundation | Hard | Complete | Cannot build |
| EP02 Orchestration Core | Hard | Complete | No agent reasoning infrastructure |
| EP03 Persistence Layer | Hard | Not Started | Cannot store causal analysis state |
| EP05 Config Analysis | Soft | Not Started | Cannot identify config gaps automatically |
| EP06 Session Analysis | Hard | Complete | No session search for evidence collection |
| Claude API | External | Available | LLM reasoning unavailable |

### 7.2 Assumptions

- Session logs are in standard Claude Code JSONL format (validated by EP06)
- Config analysis provides structured issue output with IDs for tracing
- Agent has sufficient context window for causal reasoning (using EP02 context management)
- Git is available for commit correlation (falls back gracefully if not)
- FTS5 index is populated before tracing (can auto-trigger if not)

---

## 8. Open Questions

> Questions resolved during clarification

- [x] **Q1**: Should causal chains persist to database or remain ephemeral per analysis run? — **RESOLVED: Persist for pattern detection** (see Clarifications)
- [x] **Q2**: What's the maximum depth for chain traversal (to prevent runaway analysis)? — **RESOLVED: Max 5 steps** (see Clarifications)
- [x] **Q3**: Should pattern detection operate on indexed sessions only, or re-parse files? — **RESOLVED: Indexed sessions only** (see Clarifications)

---

## 9. References

- [Epic: EP07 Causal Tracing Engine](../../docs/planning/epics/EP07-causal-tracing.md)
- [Use Case: UC-008 Trace Issue Origins](../../docs/requirements/use-cases.md#uc-008-trace-issue-origins)
- [Functional Requirements: FR-6 Causal Analysis](../../docs/requirements/functional-requirements.md#fr-6-causal-analysis)
- [Constitution: Principle III Causal-First](../../.specify/memory/constitution.md)
- [Arc42 Section 6.2: Causal Tracing Runtime Scenario](../../docs/architecture/arc42/)

---

## Clarifications

> This section is populated by /dev.clarify

### Session 2026-01-17

#### Agent Value Differentiation (Critical)

**Q: The Claude Agent SDK natively provides session history, tool execution logging, and structured output. What unique value should EP07's causal tracing provide BEYOND what the agent can already reason about from its context?**

A: **Both cross-session correlation AND pre-computed evidence chains.**

The agent's native capabilities are limited to the current session's context window. EP07 adds two distinct value layers:

1. **Cross-Session Correlation**: Trace patterns across MULTIPLE sessions that exceed a single context window. The agent cannot see previous sessions natively—agentlint's persistence layer (EP03) stores session analyses, allowing EP07 to correlate issues across weeks or months of sessions.

2. **Pre-Computed Evidence Chains**: Provide ready-made causal chains via tools so the agent doesn't spend tokens reasoning about causality from scratch. Tools like `trace_issue_origin` return structured chains that the agent can use directly.

**Updated requirements:**
- FR-CT-015: Persist causal chains to enable cross-session pattern detection
- FR-CT-016: Provide pre-computed chains via tools for agent efficiency

**Impact on design:**
- Causal tracing tools are the PRIMARY consumer interface
- Human-readable output is derived from structured tool output
- Agent uses tools to query historical patterns, not re-derive them

---

#### Q1: Persistence Strategy

**Q: Should causal chains persist to database or remain ephemeral per analysis run?**

A: **Persist for pattern detection.** Store chains in SQLite (via EP03 persistence layer).

**Rationale:**
- Required for FR-CT-010 (Identify recurring patterns across sessions)
- Enables learning over time per Constitution Principle VIII (Compounding Value)
- Supports cross-session correlation (core value-add over native agent capabilities)

**Updated constraints:**
- CausalChain entity includes `createdAt`, `projectPath` for temporal queries
- IssuePattern entity aggregates chains with matching root cause category
- Database schema defined in EP03 coordination, queried by EP07 tools

---

#### Q2: Maximum Chain Depth

**Q: What's the maximum depth for causal chain traversal?**

A: **Maximum 5 steps.** Chain structure:
1. Trigger (user action or prompt)
2. Gap (missing configuration/guidance)
3. Mechanism (how the gap led to issue)
4. Effect (the detected issue)
5. Nested cause (optional: why the gap existed)

**Rationale:**
- Sufficient for 95% of practical cases
- Prevents runaway analysis and context bloat
- Balances depth with performance (< 5s per issue)

**Updated constraints:**
- Chain traversal stops at depth 5 with `depthLimitReached: true` flag
- Deeper investigation can be triggered manually with explicit depth override
- Add NFR-CT-007: Max chain depth = 5 (configurable)

---

#### Q3: Pattern Detection Source

**Q: Should pattern detection operate on indexed sessions only, or re-parse files?**

A: **Indexed sessions only.** Use FTS5 index from EP06.

**Rationale:**
- Fast: FTS5 queries are sub-second even for large corpora
- Consistent: Uses same search infrastructure as session analysis
- Explicit: If index is stale, the solution is re-indexing (EP06), not dual paths

**Updated constraints:**
- Pattern detection requires FTS5 index to be current
- If index is stale (sessions modified after last index), emit warning
- User can trigger `agentlint sessions --index` to refresh before pattern detection
- Add edge case: "Index stale" → return partial results with warning

---

#### Summary of Clarification Impact

| Requirement | Update |
|-------------|--------|
| FR-CT-015 | NEW: Persist causal chains for cross-session correlation |
| FR-CT-016 | NEW: Provide pre-computed chains via tools |
| NFR-CT-007 | NEW: Max chain depth = 5 (configurable) |
| Edge Case | NEW: Index stale → partial results with warning |
| Section 1.1 | Clarify agent value-add vs native SDK capabilities |
| Dependencies | EP03 now HARD dependency (was already noted) |
