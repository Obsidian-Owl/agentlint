# Feature Specification: Recommendation Advisor

> **Epic**: EP10
> **Created**: 2026-01-20
> **Status**: Clarified
> **Author**: Claude Opus 4.5

---

## 1. Overview

The Recommendation Advisor is a reasoning-heavy subagent that synthesizes actionable recommendations from analysis findings, maintains case-based state management, and collaborates with developers through clarifying questions. Unlike deterministic recommendation tools, the agent reasons about context (findings, causal traces, baselines, historic recommendations) to generate evolving guidance that compounds value over time.

### 1.1 Business Context

This feature is the culmination of agentlint's causal analysis pipeline (DETECT → TRACE → UNDERSTAND → RECOMMEND). EP07 traces issues to their origin; EP10 uses that traced context to synthesize recommendations that enable prevention, not just symptom fixes. The agent-first architecture ensures recommendations are contextual, prioritized by compounding impact, and refined through collaborative interaction with the developer.

**Business Outcome Hypothesis**: If we implement a recommendation advisor subagent that reasons about findings, maintains case history, and collaborates with the developer, developers will receive contextual, evolving guidance that compounds value over time.

### 1.2 Out of Scope

- **Implementation detection**: Already built in EP09 (`detector.ts`)
- **Effectiveness correlation**: Already built in EP09 (`effectiveness.ts`)
- **Recommendation tracking state machine**: Already built in EP09 (`api.ts`, `storage.ts`)
- **Causal analysis**: EP07 provides input
- **Baseline comparison**: EP09 provides input
- **Global learning promotion**: EP12 will consume completed recommendations
- **CLI recommendation output**: EP04 handles formatting

---

## 2. User Scenarios & Testing

> User stories are prioritized: P1 (must-have), P2 (should-have), P3 (nice-to-have)

### US-001 [P1]: Synthesize Recommendations from Analysis

**As a** developer completing an agentlint analysis,
**I want** the orchestrator to invoke a recommendation subagent that reasons about my findings,
**So that** I receive contextual recommendations tailored to my specific issues.

**Acceptance Criteria:**
- [ ] Given findings from EP05/EP06/EP07, when the orchestrator spawns the recommendation advisor, then recommendations are synthesized with traced origins
- [ ] Given a causal trace from EP07, when the advisor reasons about it, then the recommendation type is appropriate (symptomatic/preventive/systemic)
- [ ] Given the advisor needs clarification, when it encounters ambiguity, then it asks the user via structured questions
- [ ] Given multiple possible recommendations, when the advisor prioritizes, then compounding impact is the primary factor

**Test Scenarios:**
- Happy path: Causal trace leads to preventive recommendation with specific action
- Edge case: No actionable findings result in "no recommendations" with explanation
- Error case: Malformed causal trace returns graceful error

---

### US-002 [P1]: Create and Store Recommendation Case

**As a** developer receiving a recommendation,
**I want** the recommendation stored as a case that I can track over time,
**So that** I can see the recommendation evolve with new observations.

**Acceptance Criteria:**
- [ ] Given a synthesized recommendation, when `create_recommendation` is called, then a case is created with id, type, action, target, rationale, and traced origin
- [ ] Given a case is created, when it's persisted, then it's stored atomically in `.agentlint/recommendations/{id}.json`
- [ ] Given a new case, when the initial event is logged, then it has type 'created' with timestamp

**Test Scenarios:**
- Happy path: Recommendation created and retrievable by ID
- Edge case: Duplicate creation attempt returns existing case
- Error case: Missing required fields fails validation

---

### US-003 [P1]: Add Events to Recommendation Case

**As a** developer or agent observing changes,
**I want** to append events to a recommendation case,
**So that** the case history reflects ongoing observations, refinements, and feedback.

**Acceptance Criteria:**
- [ ] Given an existing recommendation, when `add_recommendation_event` is called, then the event is appended to the events array
- [ ] Given event content exceeds 200 characters, when the tool validates, then it rejects with error
- [ ] Given an event with type 'observation', when the agent notices a related change, then it can record context (baselineId, sessionId, commitHash)

**Test Scenarios:**
- Happy path: Event appended with all optional context fields
- Edge case: Maximum event content length (200 chars) works
- Error case: Event on non-existent recommendation fails gracefully

---

### US-004 [P1]: Query Recommendations with Compressed Context

**As a** the orchestrator loading context for analysis,
**I want** to query recommendations with compressed summaries,
**So that** historic recommendations inform new analysis without overflowing context.

**Acceptance Criteria:**
- [ ] Given recommendations to load, when `list_recommendations` returns summaries, then total context fits within 8K token budget
- [ ] Given a recommendation with 3 or fewer events, when compressed, then recent events are verbatim
- [ ] Given a recommendation with > 10 events, when compressed, then older events are summarized with "[+N earlier events]"
- [ ] Given filtering by status, when `list_recommendations` is called with status='open', then only open cases return

**Test Scenarios:**
- Happy path: Recommendations loaded newest-first within 8K token budget
- Edge case: Empty recommendations list returns empty array
- Error case: Invalid status filter returns validation error

---

### US-005 [P2]: Refine Recommendation Details

**As a** developer receiving updated guidance,
**I want** to refine a recommendation's action, target, or priority,
**So that** the recommendation evolves as understanding improves.

**Acceptance Criteria:**
- [ ] Given an existing recommendation, when `refine_recommendation` changes action, then the old action is logged in a 'refinement' event
- [ ] Given a priority change, when the refinement is applied, then the event content includes "Priority: {old} → {new}"
- [ ] Given a refinement, when the recommendation is retrieved, then both current state and refinement history are visible

**Test Scenarios:**
- Happy path: Action refined with audit trail
- Edge case: Refinement with no actual changes is idempotent
- Error case: Refinement on completed case fails

---

### US-006 [P2]: Complete Recommendation Case

**As a** developer who has addressed a recommendation,
**I want** to mark it as completed with a reason,
**So that** it no longer appears in active lists but remains for learning.

**Acceptance Criteria:**
- [ ] Given an implemented recommendation, when `complete_recommendation` is called with reason='implemented', then status transitions to completed
- [ ] Given a superseded recommendation, when completed with reason='superseded', then `supersededBy` links to the new recommendation
- [ ] Given a completed recommendation, when `list_recommendations` filters by status='open', then it's excluded

**Test Scenarios:**
- Happy path: Recommendation completed with 'implemented' reason
- Edge case: Completing already-completed case is idempotent
- Error case: Invalid completion reason fails validation

---

### US-007 [P2]: Collaborative Clarifying Questions

**As a** developer receiving recommendations,
**I want** the advisor to ask clarifying questions when context is ambiguous,
**So that** recommendations are more accurate and relevant.

**Acceptance Criteria:**
- [ ] Given ambiguous findings, when the advisor reasons, then it may return structured questions before finalizing recommendations
- [ ] Given multiple valid approaches, when the advisor presents options, then each option includes trade-offs
- [ ] Given user answers questions, when the advisor continues, then answers inform the final recommendations

**Test Scenarios:**
- Happy path: Question asked, answered, and recommendation refined
- Edge case: User declines to answer; advisor proceeds with stated assumptions
- Error case: Question format validation catches malformed questions

---

### US-008 [P3]: Automatic Event Compaction

**As a** the system managing long-lived recommendations,
**I want** event histories to be automatically compacted,
**So that** context budgets are maintained without losing essential history.

**Acceptance Criteria:**
- [ ] Given a recommendation with > 10 events, when compaction triggers, then older events are LLM-summarized
- [ ] Given a compacted recommendation, when `get_recommendation` is called, then full events are still available (separate from summary)
- [ ] Given a `summarize_recommendation_history` tool call, when manual compaction is requested, then summary is generated immediately

**Test Scenarios:**
- Happy path: Compaction preserves recent 3 events verbatim
- Edge case: Compaction on already-compacted case updates rollup
- Error case: LLM summarization failure falls back to truncation

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | Recommendation Advisor subagent with context-engineered system prompt | P1 | US-001 |
| FR-002 | `spawn_recommendation_advisor` tool builds context and returns subagent definition | P1 | US-001 |
| FR-003 | `create_recommendation` tool creates case with traced origin | P1 | US-002 |
| FR-004 | `get_recommendation` tool returns full recommendation with all events | P1 | US-002, US-004 |
| FR-005 | `get_recommendation_summary` tool returns compressed view | P1 | US-004 |
| FR-006 | `list_recommendations` tool queries with filters (status, type, priority) | P1 | US-004 |
| FR-007 | `add_recommendation_event` tool appends events with validation | P1 | US-003 |
| FR-008 | `update_recommendation_status` tool transitions status | P1 | US-006 |
| FR-009 | `refine_recommendation` tool updates fields with audit trail | P2 | US-005 |
| FR-010 | `complete_recommendation` tool soft-closes with reason | P2 | US-006 |
| FR-011 | Subagent can ask clarifying questions via structured format | P2 | US-007 |
| FR-012 | `summarize_recommendation_history` tool triggers manual compaction | P3 | US-008 |
| FR-013 | Automatic compaction when events exceed threshold | P3 | US-008 |

### 3.2 Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-001 | Compressed recommendation size | Characters | < 500 chars |
| NFR-002 | Recommendations context budget | Tokens | 8K tokens (rolling budget) |
| NFR-003 | Event content length | Characters | < 200 chars (enforced) |
| NFR-004 | Storage operations | Atomicity | 100% atomic writes |
| NFR-005 | Subagent prompt size | Characters | < 50KB (per existing NFR) |
| NFR-006 | Recommendation creation | Response time | < 500ms |
| NFR-007 | List recommendations | Response time | < 200ms for 100 recs |
| NFR-008 | Context loading strategy | Method | Newest-first until budget exhausted |

---

## 4. Key Entities

> Define the core domain entities this feature introduces or modifies

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| Recommendation | A living document tracking a suggested improvement | id, type, action, target, rationale, tracedOrigin, status, events, priority |
| RecommendationEvent | An append-only log entry for a recommendation | id, timestamp, type, content, baselineId?, sessionId?, commitHash? |
| RecommendationSummary | Compressed view for context loading | id, type, status, actionSummary, eventCount, recentActivity, milestones |
| TracedOrigin | Causal link to source of recommendation | findingId?, sessionId?, configGap?, pattern? |

### 4.1 Entity Relationships

```
Recommendation --1:N--> RecommendationEvent
Recommendation --1:1--> TracedOrigin
Recommendation --0:1--> Recommendation (supersededBy)
RecommendationSummary --derived-from--> Recommendation
```

### 4.2 Type Definitions

```typescript
type RecommendationType = 'symptomatic' | 'preventive' | 'systemic';

type RecommendationStatus = 'open' | 'pending_confirmation' | 'implemented' | 'monitoring';

type CompletionReason = 'implemented' | 'superseded' | 'obsolete' | 'rejected';

type EventType =
  | 'created'
  | 'observation'
  | 'refinement'
  | 'user_feedback'
  | 'evidence'
  | 'implementation_signal'
  | 'status_change'
  | 'completed';

type Priority = 'high' | 'medium' | 'low';
```

---

## 5. Success Criteria

> How do we know this feature is successful? Define measurable outcomes.

- [ ] **Functional**: All P1 user stories pass acceptance criteria
- [ ] **Quality**: Test coverage > 80%, no critical bugs
- [ ] **Performance**: Meets NFR response time targets
- [ ] **Context Efficiency**: Recommendations context fits within 8K token budget using rolling newest-first strategy
- [ ] **Constitution Alignment**: Recommendations include traced origin (III), tools provide state while subagent provides judgment (VII, IX)
- [ ] **Compounding Value**: Historic recommendations are loaded for context awareness in subsequent analyses

---

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior | Priority |
|----------|-------------------|----------|
| No findings to base recommendations on | Return empty recommendations with explanation "No actionable findings" | P1 |
| Causal trace missing required fields | Graceful degradation; symptomatic recommendation without full trace | P1 |
| Event content exceeds 200 char limit | Reject with validation error, suggest truncation | P1 |
| Recommendation file corrupted | Return null from `get_recommendation`, log warning | P1 |
| Concurrent writes to same recommendation | Atomic write ensures last-write-wins consistency | P2 |
| LLM summarization fails during compaction | Fallback to simple truncation with "[truncated]" marker | P2 |
| Subagent context exceeds budget | Truncate oldest recommendations from context | P2 |
| Completing an already-completed recommendation | Idempotent; return current state without error | P3 |
| Refining a completed recommendation | Reject with error "Cannot refine completed recommendation" | P2 |

---

## 7. Dependencies & Assumptions

### 7.1 Dependencies

| Dependency | Type | Status | Impact if Missing |
|------------|------|--------|-------------------|
| EP02 Orchestrator | Internal | Complete | Cannot invoke subagent |
| EP08 ACT Subagent Pattern | Internal | Complete | No pattern to follow for subagent definition |
| EP07 Causal Traces | Internal | Complete | Recommendations lack traced origins |
| EP03 Persistence Patterns | Internal | Complete | No storage patterns to follow |
| EP09 Tracking Infrastructure | Internal | Complete | Must rebuild tracking state machine |
| Claude Agent SDK | External | Available | Cannot implement subagent |

### 7.2 Assumptions

- **A1**: The orchestrator can invoke subagents via SDK's `agents` option (validated in EP08)
- **A2**: JSON file storage is sufficient for recommendation persistence (no SQLite needed for MVP)
- **A3**: Event content of 200 chars is sufficient for meaningful observations
- **A4**: LLM summarization for compaction can use the same model as orchestrator
- **A5**: Collaborative questions can be returned via structured tool output (subagent → orchestrator → user)

---

## 8. Open Questions

> Questions resolved during clarification session 2026-01-20

- [x] **Q1**: Should the Recommendation Advisor subagent have access to `ask_user_question` directly, or return questions for orchestrator to present? — **RESOLVED: Via Orchestrator** (subagent returns structured questions in tool output; orchestrator presents to user)
- [x] **Q2**: What's the maximum number of recommendations to load for context? — **RESOLVED: Token-based budget** (8K token budget, load newest-first until exhausted, compress on-the-fly)
- [x] **Q3**: Should compaction be triggered synchronously (blocking) or asynchronously (background job)? — **RESOLVED: Synchronous** (inline compaction when threshold exceeded; acceptable latency for P3 feature)
- [x] **Q4**: How should recommendations relate to the existing `RecommendationTracking` type from EP09? — **RESOLVED: Replace** (EP10 Recommendation replaces RecommendationTracking; migrate tracking fields into case-based model)

---

## 9. References

- [Linear Project: EP10 Recommendation Advisor](https://linear.app/obsidianowl/project/ep10-recommendation-advisor-9c31dbd16212)
- [Epic Specification](../../docs/planning/epics/EP10-recommendation-engine.md)
- [ADR-0005: Tool Definition and Invocation Pattern](../../docs/architecture/adr/0005-tool-definition-and-invocation-pattern.md)
- [ADR-0019: Tool/Agent Boundary](../../docs/architecture/adr/0019-tool-agent-boundary-temporal.md)
- [Constitution](../../.specify/memory/constitution.md)
- [Arc42 §5: Building Blocks](../../docs/architecture/arc42/05-building-blocks.md)
- [EP09 Temporal Analysis](../../specs/ep09-temporal-analysis/) - Existing tracking infrastructure
- [EP08 ACT Adapters](../../specs/ep08-act-adapters/) - Subagent pattern reference

---

## Clarifications

> This section is populated by /dev.clarify

### Session 2026-01-20

**Q1: Should the Recommendation Advisor subagent have access to `ask_user_question` directly, or return questions for orchestrator to present?**

A: **Via Orchestrator** — Subagent returns structured questions in tool output; orchestrator presents to user. This follows existing SDK patterns and is simpler to implement.

*Updated: A5 in Section 7.2, FR-011 in Section 3.1*

---

**Q2: What's the maximum number of recommendations to load for context?**

A: **Token-based rolling budget (8K tokens)** — Rather than a fixed count, use a rolling token budget. Load recommendations newest-first until the 8K token budget is exhausted. Compress older recommendations on-the-fly. This follows Anthropic's context engineering guidance: "treat context as a precious, finite resource" and load "the smallest set of high-signal tokens."

*Updated: NFR-002 in Section 3.2, US-004 acceptance criteria, Success Criteria in Section 5*

**Research Sources:**
- [Effective Context Engineering for AI Agents (Anthropic)](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [The Context Window Problem (Factory.ai)](https://factory.ai/news/context-window-problem)
- [Context Engineering Compaction (Jason Liu)](https://jxnl.co/writing/2025/08/30/context-engineering-compaction/)

---

**Q3: Should compaction be triggered synchronously (blocking) or asynchronously (background job)?**

A: **Synchronous** — Compaction runs inline when threshold exceeded. Simpler implementation with acceptable latency for a P3 feature. Avoid adding job queue infrastructure for MVP.

*Updated: US-008 acceptance criteria*

---

**Q4: How should recommendations relate to the existing `RecommendationTracking` type from EP09?**

A: **Replace** — EP10's `Recommendation` type replaces EP09's `RecommendationTracking`. The new case-based model subsumes tracking functionality:

| EP09 RecommendationTracking | EP10 Recommendation |
|----------------------------|---------------------|
| `recommendationId` | `id` |
| `recommendationText` | `action` + `rationale` |
| `status` (6 states) | `status` (4 states) + `completionReason` |
| `detectedAt`, `confirmedAt` | Events with timestamps |
| `preBaselineId`, `postBaselineId` | Events with `baselineId` context |
| `effectivenessScore` | Event with type 'evidence' |
| `notes` | Events with type 'user_feedback' |

Migration path: Create adapter to convert existing `RecommendationTracking` records to new `Recommendation` format during EP10 implementation.

*Updated: Section 4 Key Entities, Section 7.1 Dependencies*
