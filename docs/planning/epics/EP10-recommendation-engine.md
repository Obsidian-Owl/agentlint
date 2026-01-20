# EP10: Recommendation Advisor

> Implement a reasoning-heavy recommendation subagent with case-based state management and collaborative interaction.

## Classification

| Attribute | Value |
|-----------|-------|
| **Type** | Business |
| **Priority** | P1-High |
| **Size** | M |
| **Estimated Duration** | 4 weeks |
| **Target Stories** | 10-12 stories |

## Business Outcome Hypothesis

**If** we implement a recommendation advisor subagent that reasons about findings, maintains case history, and collaborates with the developer,
**Then** developers receive contextual, evolving guidance that compounds value over time,
**Measured by** recommendation implementation rate, case refinement frequency, and outcome improvement correlation.

## Core Design Principles

### Agent-First Architecture

The recommendation "engine" is a **reasoning-heavy subagent**, not a deterministic tool pipeline. Per Constitution IX (Agent-Aware):

- **Agent generates recommendations** through reasoning about context (findings, causal traces, baselines, historic recommendations)
- **Tools provide state management** (read/write recommendations, query history)
- **Collaborative interaction** follows the Constitution's collaborative model (Analyse → Discuss → Recommend → Decide → Implement)

### Recommendations as Cases

Recommendations are **living documents** that evolve over time:

- Append-only event log tracks observations, refinements, evidence, user feedback
- Soft completion (no hard delete) preserves learning history
- Two-tier storage: full history persisted, compressed view for agent context
- Automatic compaction when event history exceeds token budget

### Context Management

Large recommendation histories must not overflow agent context:

- Compressed summaries for context loading (~500 chars per recommendation)
- Rolling event summaries (recent verbatim, older summarized)
- Async LLM summarization when events exceed threshold
- Agent can drill down to full history on demand

## Scope Definition

### In Scope

#### Recommendation Advisor Subagent
- [ ] Context-engineered system prompt with domain knowledge
- [ ] Recommendation type guidance (symptomatic, preventive, systemic)
- [ ] Causal tracing integration (link to EP07 findings)
- [ ] Prioritization reasoning (compounding impact focus)
- [ ] Collaborative interaction pattern (clarifying questions, option presentation)

#### spawn_recommendation_advisor Tool
- [ ] Build analysis context from current findings
- [ ] Load historic recommendations for context awareness
- [ ] Configure interaction mode (ask, propose, confirm)
- [ ] Return subagent definition for SDK invocation

#### Recommendation Case Management Tools
- [ ] `create_recommendation` - Create new case with traced origin
- [ ] `get_recommendation` - Full recommendation with all events
- [ ] `get_recommendation_summary` - Compressed view for context loading
- [ ] `list_recommendations` - Query active/completed with filters
- [ ] `add_recommendation_event` - Append observation/refinement/feedback
- [ ] `update_recommendation_status` - Status transitions
- [ ] `refine_recommendation` - Update action/target/priority (logs event)
- [ ] `complete_recommendation` - Soft close with reason

#### Recommendation Storage Layer
- [ ] JSON file storage (`.agentlint/recommendations/{id}.json`)
- [ ] Atomic writes for crash safety
- [ ] Two-tier storage (full + compressed rollup)
- [ ] Event compaction with LLM summarization

#### Context Management
- [ ] `compactRecommendationForContext()` - Generate compressed view
- [ ] Rolling event summaries (verbatim recent, summarized older)
- [ ] Token budget enforcement (~2KB per recommendation in context)
- [ ] `summarize_recommendation_history` tool for manual compaction

### Out of Scope

#### Already Built (EP09)
- Implementation detection via config diff (`detector.ts`)
- Effectiveness correlation (`effectiveness.ts`)
- Recommendation tracking state machine (`api.ts`, `storage.ts`)

#### Different Epics
- Causal analysis (EP07 - provides input)
- Baseline comparison (EP09 - used for correlation)
- Global learning promotion (EP12)
- CLI recommendation output (EP04)

### Minimum Viable Product (MVP)

The minimum deliverable that proves the hypothesis:

1. Recommendation Advisor subagent with system prompt
2. `spawn_recommendation_advisor` tool
3. `create_recommendation` and `get_recommendation` tools
4. `list_recommendations` with basic filtering
5. `add_recommendation_event` for case evolution
6. Basic compression for context loading

**MVP validates:** Agentic recommendation workflow with case evolution before adding full compaction and collaborative interaction.

## Data Model

### Recommendation (Full)

```typescript
interface Recommendation {
  // Identity
  id: string;
  projectPath: string;
  createdAt: string;

  // Core recommendation
  type: 'symptomatic' | 'preventive' | 'systemic';
  action: string;           // SPECIFIC change to make
  target: string;           // WHERE to make the change
  rationale: string;        // WHY (agent reasoning)
  priority: 'high' | 'medium' | 'low';

  // Causal tracing (Constitution III)
  tracedOrigin: {
    findingId?: string;
    sessionId?: string;
    configGap?: string;
    pattern?: string;
  };

  // Evolving state
  status: RecommendationStatus;
  events: RecommendationEvent[];

  // Lifecycle
  completedAt?: string;
  completionReason?: 'implemented' | 'superseded' | 'obsolete' | 'rejected';
  supersededBy?: string;
}

type RecommendationStatus =
  | 'open'
  | 'pending_confirmation'
  | 'implemented'
  | 'monitoring';

interface RecommendationEvent {
  id: string;
  timestamp: string;
  type: 'created' | 'observation' | 'refinement' | 'user_feedback'
      | 'evidence' | 'implementation_signal' | 'status_change' | 'completed';
  content: string;          // Succinct - <200 chars enforced
  baselineId?: string;
  sessionId?: string;
  commitHash?: string;
}
```

### Recommendation Summary (Compressed)

```typescript
interface RecommendationSummary {
  id: string;
  type: 'symptomatic' | 'preventive' | 'systemic';
  status: RecommendationStatus;
  actionSummary: string;    // Truncated ~100 chars
  target: string;
  priority: 'high' | 'medium' | 'low';

  // History summary
  eventCount: number;
  lastEventAt: string;
  lastEventType: string;
  recentActivity: string;   // Rolling summary

  // Key milestones
  milestones: {
    created: string;
    firstEvidence?: string;
    implemented?: string;
    completed?: string;
  };
}
```

## Arc42 Traceability

| Source | References |
|--------|------------|
| **Building Blocks** | Subagent Layer (Recommendation Advisor), Tool Layer (Case Management) |
| **Runtime Scenarios** | 6.1 Full Analysis (recommendation synthesis), 6.2 Incremental (case updates) |
| **Quality Requirements** | Context efficiency, reasoning depth |
| **Crosscutting Concepts** | Subagent pattern (EP08), Two-tier storage, Context compression |
| **ADRs** | ADR-0005 (Tool Definition), ADR-0019 (Tool/Agent Boundary) |

## Requirements Traceability

| Source | References |
|--------|------------|
| **Personas** | Persona 1 (Optimizer), Persona 4 (Context Engineer) |
| **Use Cases** | UC-004 (Recommendations), UC-009 (Validate Effectiveness) |
| **Requirements** | FR-7 (Recommendation Engine) |

## Dependencies

### Blocked By (Cannot Start Without)

| Epic | Dependency Type | What's Needed |
|------|-----------------|---------------|
| EP01 | Hard | Project structure |
| EP02 | Hard | Orchestrator, subagent invocation pattern |
| EP03 | Hard | Persistence layer patterns |
| EP07 | Hard | Causal traces for preventive recommendations |
| EP08 | Hard | ACT subagent pattern to follow |

### Soft Dependencies (Enhances But Not Required)

| Epic | Dependency Type | What's Needed |
|------|-----------------|---------------|
| EP05 | Soft | Config assessment findings |
| EP06 | Soft | Session metrics findings |
| EP09 | Soft | Temporal trends, existing tracking infrastructure |

### Blocks (Other Epics Waiting On This)

| Epic | Dependency Type | What This Provides |
|------|-----------------|-------------------|
| EP12 | Soft | Completed recommendations for learning promotion |

## Technical Considerations

### Key Decisions

1. **Subagent over tools** - Recommendation synthesis is agent reasoning, not deterministic tool output
2. **Case-based model** - Recommendations evolve with append-only event logs
3. **Two-tier storage** - Full history persisted, compressed view for context
4. **Soft completion** - No hard delete, preserves learning history
5. **Token budgets** - ~2KB per recommendation in context, ~500 chars compressed

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Recommendations too vague | Medium | High | Subagent prompt enforces specificity |
| Event logs grow unbounded | Medium | Medium | Automatic compaction + summarization |
| Context overflow | Low | High | Token budget enforcement, compression |
| Subagent reasoning inconsistent | Medium | Medium | Structured output format, validation |

### Spikes Needed

- [ ] Test subagent prompt quality with real findings
- [ ] Validate compaction strategy effectiveness
- [ ] Measure context budget accuracy

### Constitution Alignment

| Principle | How This Epic Aligns |
|-----------|---------------------|
| **II. Improvement-Oriented** | Cases accumulate learnings, compounding value |
| **III. Causal-First** | Every recommendation traces to origin |
| **IV. Mixed-Methods** | Subagent reasons about which recommendation types apply |
| **VII. Intelligent Tooling** | Tools provide state; subagent provides judgment |
| **VIII. Compounding Value** | Historic recommendations inform future analysis |
| **IX. Agent-Aware** | Subagent IS the recommendation engine |
| **Collaborative Model** | Discuss phase via clarifying questions |

## Acceptance Criteria (High-Level)

### Functional

- [ ] Recommendation Advisor subagent generates contextual recommendations
- [ ] Subagent can ask clarifying questions during recommendation synthesis
- [ ] Each recommendation includes specific action, target, rationale, traced origin
- [ ] Recommendations categorized as symptomatic, preventive, or systemic
- [ ] Cases evolve with append-only events (observations, refinements, feedback)
- [ ] Historic recommendations loaded for context awareness
- [ ] Compressed summaries fit within token budget
- [ ] Automatic compaction triggers when events exceed threshold
- [ ] Cases can be completed with reason (no hard delete)

### Non-Functional

- [ ] Compressed recommendation < 500 chars
- [ ] 20 recommendations load in < 10KB context
- [ ] Event content enforced < 200 chars
- [ ] Storage operations atomic
- [ ] Subagent prompt < 50KB (NFR-002)

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] Code reviewed and merged
- [ ] Tests written and passing (unit, integration)
- [ ] Subagent prompt validated with real findings
- [ ] Documentation updated (case model, tools)
- [ ] Product owner sign-off

## Speckit Handoff Notes

> Guidance for `/speckit.specify` phase

### Primary Focus

- **Persona**: Persona 1 (Optimizer)
- **Workflow**: Analysis → Subagent reasoning → Case creation → Evolution → Completion
- **Outcome**: Contextual, evolving recommendations that compound value

### Constraints to Encode

From ADRs:
- ADR-0005: Tool definitions with Zod schemas
- ADR-0019: Tools return data, agent provides judgment

From Constitution:
- III. Causal-First: Include traced origin in every recommendation
- VII. Intelligent Tooling: Subagent reasons, tools provide state
- IX. Agent-Aware: Design serves subagent's cognitive needs
- Collaborative Model: Support clarifying questions

### Key Scenarios to Specify

1. Subagent synthesizes preventive recommendation from causal chain
2. User provides feedback, agent adds event to case
3. Agent notices related change, adds observation event
4. Event history exceeds threshold, triggers compaction
5. Load 20 recommendations for context (compressed)
6. Complete recommendation as implemented

### Tech Stack Notes

- Subagent via Claude Agent SDK `agents` option
- JSON storage for recommendations (`.agentlint/recommendations/`)
- Zod schemas for tool validation
- LLM summarization for event compaction (async)

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-15 | Arc42 Decomposer | Initial creation from Arc42 |
| 2026-01-20 | Claude Opus 4.5 | Major revision: Subagent architecture, case-based model, context management |
